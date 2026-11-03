import { NextRequest, NextResponse } from "next/server";

const BIAS = "33.6844,73.0479";

export async function GET(req: NextRequest) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ predictions: [], error: "Maps key missing" });

  const placeId = req.nextUrl.searchParams.get("place_id")?.trim() || "";
  if (placeId) {
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

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("components", "country:pk");
  url.searchParams.set("location", BIAS);
  url.searchParams.set("radius", "80000");
  url.searchParams.set("key", key);
  const data = await fetch(url.toString()).then((r) => r.json());
  const predictions = ((data.predictions || []) as { description: string; place_id: string }[])
    .slice(0, 6)
    .map((p) => ({ description: p.description, place_id: p.place_id }));
  return NextResponse.json({
    predictions,
    error: predictions.length ? undefined : data.error_message,
  });
}
