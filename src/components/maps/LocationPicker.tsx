"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, MarkerF } from "@react-google-maps/api";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { DEFAULT_CENTER, MAP_STYLE, useMaps } from "./useMaps";
import { MapFallback } from "./MapFallback";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

type Prediction = { description: string; place_id: string; lat?: number; lng?: number };

const ISB = { lat: 33.6844, lng: 73.0479 };
const PAKISTAN_PLACES: Prediction[] = [
  { description: "Islamabad, Pakistan", place_id: "local:islamabad", lat: 33.6844, lng: 73.0479 },
  { description: "Blue Area, Islamabad, Pakistan", place_id: "local:blue-area", lat: 33.7077, lng: 73.0551 },
  { description: "PWD Housing Society, Islamabad, Pakistan", place_id: "local:pwd", lat: 33.5703, lng: 73.1318 },
  { description: "Bahria Town, Rawalpindi, Pakistan", place_id: "local:bahria", lat: 33.532, lng: 73.1227 },
  { description: "Rawalpindi, Pakistan", place_id: "local:rawalpindi", lat: 33.5651, lng: 73.0169 },
  { description: "Peshawar, Pakistan", place_id: "local:peshawar", lat: 34.0151, lng: 71.5249 },
  { description: "University Town, Peshawar, Pakistan", place_id: "local:university-town-peshawar", lat: 34.0018, lng: 71.5445 },
  { description: "Hayatabad, Peshawar, Pakistan", place_id: "local:hayatabad", lat: 33.9767, lng: 71.4237 },
  { description: "Lahore, Pakistan", place_id: "local:lahore", lat: 31.5204, lng: 74.3587 },
  { description: "Karachi, Pakistan", place_id: "local:karachi", lat: 24.8607, lng: 67.0011 },
  { description: "Faisalabad, Pakistan", place_id: "local:faisalabad", lat: 31.4504, lng: 73.135 },
  { description: "Multan, Pakistan", place_id: "local:multan", lat: 30.1575, lng: 71.5249 },
  { description: "Quetta, Pakistan", place_id: "local:quetta", lat: 30.1798, lng: 66.975 },
  { description: "Gujranwala, Pakistan", place_id: "local:gujranwala", lat: 32.1877, lng: 74.1945 },
];

function localPredictions(input: string) {
  const q = input.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return PAKISTAN_PLACES.filter((place) => {
    const text = place.description.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

async function predict(input: string, allowClient: boolean): Promise<Prediction[]> {
  const local = localPredictions(input);
  if (allowClient && window.google?.maps?.places?.AutocompleteService) {
    const found = await new Promise<Prediction[] | null>((resolve) => {
      const svc = new google.maps.places.AutocompleteService();
      svc.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "pk" },
          location: new google.maps.LatLng(ISB.lat, ISB.lng),
          radius: 80000,
        },
        (results, status) => {
          if (status === "OK" && results) {
            resolve(results.map((r) => ({ description: r.description, place_id: r.place_id })));
            return;
          }
          if (status === "ZERO_RESULTS") {
            resolve([]);
            return;
          }
          resolve(null);
        }
      );
    });
    if (found?.length) {
      const ids = new Set(local.map((p) => p.place_id));
      return [...local, ...found.filter((p) => !ids.has(p.place_id))].slice(0, 6);
    }
  }
  const res = await fetch(`/api/places?q=${encodeURIComponent(input)}`);
  const data = (await res.json()) as { predictions?: Prediction[] };
  const ids = new Set(local.map((p) => p.place_id));
  return [...local, ...(data.predictions || []).filter((p) => !ids.has(p.place_id))].slice(0, 6);
}

async function resolvePlace(placeId: string, description: string, allowClient: boolean): Promise<PickedLocation | null> {
  if (allowClient && window.google?.maps?.places?.PlacesService) {
    const hit = await new Promise<PickedLocation | null>((resolve) => {
      const svc = new google.maps.places.PlacesService(document.createElement("div"));
      svc.getDetails({ placeId, fields: ["geometry", "formatted_address", "name"] }, (place, status) => {
        const point = place?.geometry?.location;
        if (status === "OK" && point) {
          resolve({ lat: point.lat(), lng: point.lng(), address: place.formatted_address || description });
          return;
        }
        resolve(null);
      });
    });
    if (hit) return hit;
  }
  const res = await fetch(`/api/places?place_id=${encodeURIComponent(placeId)}`);
  const data = (await res.json()) as { lat?: number; lng?: number; address?: string };
  if (data.lat == null || data.lng == null) return null;
  return { lat: data.lat, lng: data.lng, address: data.address || description };
}

export function LocationPicker({
  value,
  onChange,
  searchPlaceholder = "Search your shop / area address",
  emptyHint = "Type an area like Islamabad PWD or Blue Area, then pick a place below.",
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
  searchPlaceholder?: string;
  emptyHint?: string;
}) {
  const { isLoaded, loadError, missingKey, authFailed } = useMaps();
  const mapOk = isLoaded && !authFailed;
  const mapRef = useRef<google.maps.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [query, setQuery] = useState(value?.address || "");
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const skipSearch = useRef(false);
  const typed = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((lat: number, lng: number) => {
    const target = mapRef.current;
    target?.panTo({ lat, lng });
    target?.setZoom(16);
  }, []);

  const choose = useCallback(
    (lat: number, lng: number, address?: string) => {
      goTo(lat, lng);
      onChange({ lat, lng, address: address || "Finding address…" });
      if (!mapOk || !window.google?.maps?.Geocoder) return;
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (res, status) => {
        if (status === "OK" && res?.[0]?.formatted_address) onChange({ lat, lng, address: res[0].formatted_address });
        else if (!address) onChange({ lat, lng, address: "Pinned on map" });
      });
    },
    [goTo, mapOk, onChange]
  );

  useEffect(() => {
    if (!typed.current || skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setPreds([]);
      setSearching(false);
      return;
    }
    // Show familiar city/area matches immediately; the fuller online search follows.
    const nearby = localPredictions(q);
    if (nearby.length) {
      setPreds(nearby);
      setOpen(true);
    }
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      predict(q, mapOk)
        .then((list) => {
          setPreds(list);
          setOpen(true);
          if (!list.length) setSearchError(null);
        })
        .catch(() => setSearchError("Could not search places. Try again."))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(timer);
  }, [query, mapOk]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function pick(p: Prediction) {
    setOpen(false);
    skipSearch.current = true;
    setQuery(p.description);
    setPreds([]);
    const hit =
      p.lat != null && p.lng != null
        ? { lat: p.lat, lng: p.lng, address: p.description }
        : await resolvePlace(p.place_id, p.description, mapOk);
    if (!hit) {
      setSearchError("Could not open that place. Try another result.");
      return;
    }
    skipSearch.current = true;
    setQuery(hit.address);
    onChange(hit);
    goTo(hit.lat, hit.lng);
  }

  const useMyLocation = useCallback(() => {
    setGpsError(null);
    if (!("geolocation" in navigator)) {
      setGpsError("GPS is not supported on this device. Search for your area instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        choose(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Search for your shop area instead."
            : "Could not get your GPS location. Search for your area instead."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [choose]);

  return (
    <div className="space-y-2">
      <div className="relative" ref={boxRef}>
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          value={query}
          placeholder={searchPlaceholder}
          autoComplete="off"
          onFocus={() => preds.length && setOpen(true)}
          onChange={(e) => {
            typed.current = true;
            skipSearch.current = false;
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        {open && (searching || preds.length > 0) && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {searching && preds.length === 0 && (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching places…
              </li>
            )}
            {preds.map((p) => (
              <li key={p.place_id}>
                <button type="button" onClick={() => pick(p)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <span>{p.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mapOk ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: 300 }}
            center={value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER}
            zoom={value ? 16 : 12}
            onLoad={(loaded) => {
              mapRef.current = loaded;
            }}
            onClick={(e) => e.latLng && choose(e.latLng.lat(), e.latLng.lng())}
            options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false, fullscreenControl: false, gestureHandling: "greedy", clickableIcons: false }}
          >
            {value && (
              <MarkerF position={{ lat: value.lat, lng: value.lng }} draggable onDragEnd={(e) => e.latLng && choose(e.latLng.lat(), e.latLng.lng())} />
            )}
          </GoogleMap>
          <button
            type="button"
            onClick={useMyLocation}
            className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-card hover:bg-slate-50"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4 text-brand-600" />}
            Use my GPS location
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {!isLoaded && !missingKey && !loadError && !authFailed ? <MapFallback height={120} /> : null}
          {(missingKey || loadError || authFailed) && (
            <p className="text-xs text-amber-700">
              The map tiles could not load. Search still works: type your area and pick a place from the list.
              {authFailed ? " Google blocked this site, so add this website address to the API key restrictions." : ""}
            </p>
          )}
          <button type="button" onClick={useMyLocation} className="btn-secondary w-full">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            Use my current GPS location
          </button>
        </div>
      )}

      {searchError && <p className="text-xs text-rose-600">{searchError}</p>}
      {gpsError && <p className="text-xs text-rose-600">{gpsError}</p>}
      <p className="text-xs text-slate-500">
        {value ? (
          <>
            <span className="font-medium text-slate-700">Selected:</span> {value.address}
          </>
        ) : (
          emptyHint
        )}
      </p>
    </div>
  );
}
