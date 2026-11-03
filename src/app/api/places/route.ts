import { NextRequest, NextResponse } from "next/server";

const BIAS = "33.6844,73.0479";
type PlacePrediction = { description: string; place_id: string; lat?: number; lng?: number; source?: string };

function unique(predictions: PlacePrediction[]) {
  const seen = new Set<string>();
  return predictions.filter((place) => {
    const key = `${place.lat?.toFixed(4)},${place.lng?.toFixed(4)}:${place.description.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function openStreetMapSearch(query: string): Promise<PlacePrediction[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Pakistan`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  const response = await fetch(url, {
    headers: { "User-Agent": "WholesaleHub delivery address search" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((row) => ({
    description: row.display_name,
    place_id: `osm:${row.lat},${row.lon}`,
    lat: Number(row.lat),
    lng: Number(row.lon),
    source: "osm",
  }));
}

async function photonSearch(query: string): Promise<PlacePrediction[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", `${query}, Pakistan`);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  const response = await fetch(url, {
    headers: { "User-Agent": "WholesaleHub delivery address search" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    features?: { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> }[];
  };
  const places: PlacePrediction[] = [];
  for (const feature of data.features || []) {
      const [lng, lat] = feature.geometry?.coordinates || [];
      const p = feature.properties || {};
      const description = [p.name, p.street, p.district, p.city, p.state, p.country]
        .filter((part, index, parts) => !!part && parts.indexOf(part) === index)
        .join(", ");
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !description) continue;
      places.push({
        description,
        place_id: `photon:${lat},${lng}`,
        lat: lat!,
        lng: lng!,
        source: "photon",
      });
  }
  return places;
}

export async function GET(req: NextRequest) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const placeId = req.nextUrl.searchParams.get("place_id")?.trim() || "";
  if (placeId.startsWith("osm:")) {
    const [lat, lng] = placeId.slice(4).split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return NextResponse.json({ lat, lng, address: "" });
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }
  if (placeId) {
    if (!key) return NextResponse.json({ error: "Place not found" }, { status: 404 });
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "formatted_address,geometry,name");
    url.searchParams.set("key", key);
    const data = await fetch(url.toString()).then((r) => r.json());
    const loc = data.result?.geometry?.location;
    if (!loc) return NextResponse.json({ error: data.error_message || "Place not found" });
    return NextResponse.json({
      lat: loc.lat,
      lng: loc.lng,
      address: data.result.formatted_address || data.result.name || "",
    });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ predictions: [] });

  let google: PlacePrediction[] = [];
  let error: string | undefined;
  if (key) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", q);
    url.searchParams.set("components", "country:pk");
    url.searchParams.set("location", BIAS);
    url.searchParams.set("radius", "80000");
    url.searchParams.set("key", key);
    const data = await fetch(url.toString()).then((r) => r.json());
    google = ((data.predictions || []) as { description: string; place_id: string }[])
      .slice(0, 6)
      .map((p) => ({ description: p.description, place_id: p.place_id, source: "google" }));
    error = data.error_message;
  }
  // Different map databases index different streets and neighbourhoods. Combining them lets
  // partial text such as "pesha" return Peshawar and places in/around it.
  const [osm, photon] = await Promise.all([openStreetMapSearch(q), photonSearch(q)]);
  const predictions = unique([...google, ...photon, ...osm]).slice(0, 10);
  return NextResponse.json({
    predictions,
    error: predictions.length ? undefined : error,
  });
}
