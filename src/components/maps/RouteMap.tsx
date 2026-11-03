"use client";
import { useEffect, useRef, useState } from "react";
import { DirectionsRenderer, GoogleMap, MarkerF } from "@react-google-maps/api";
import { MAP_STYLE, useMaps } from "./useMaps";
import { MapFallback } from "./MapFallback";
import { courierIcon, destinationIcon, originIcon } from "./markers";

type LatLng = { lat: number; lng: number };

/** Destination, optional warehouse the order leaves from, and a moving courier. */
export function RouteMap({
  destination,
  origin,
  courier,
  courierOnline = true,
  height = 360,
  showRoute = true,
  destinationLabel = "Delivery location",
  originLabel = "Warehouse",
}: {
  destination: LatLng;
  origin?: LatLng | null;
  courier?: LatLng | null;
  courierOnline?: boolean;
  height?: number;
  showRoute?: boolean;
  destinationLabel?: string;
  originLabel?: string;
}) {
  const { isLoaded, loadError, missingKey } = useMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const lastRouteRef = useRef<{ at: number; from: LatLng } | null>(null);
  const fitKeyRef = useRef("");

  const routeFrom = showRoute ? courier || origin || null : null;
  const fromLat = routeFrom?.lat;
  const fromLng = routeFrom?.lng;

  useEffect(() => {
    if (!isLoaded || fromLat == null || fromLng == null || !routeFrom) return;
    const last = lastRouteRef.current;
    const movedFar =
      !last ||
      google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(last.from), new google.maps.LatLng(routeFrom)) > 150;
    if (last && !movedFar && Date.now() - last.at < 45000) return;
    lastRouteRef.current = { at: Date.now(), from: routeFrom };
    new google.maps.DirectionsService().route(
      { origin: routeFrom, destination, travelMode: google.maps.TravelMode.DRIVING },
      (res, status) => {
        if (status === "OK" && res) {
          setDirections(res);
          const leg = res.routes[0]?.legs[0];
          if (leg) setEta(`${leg.distance?.text} · ${leg.duration?.text}`);
        }
      }
    );
  }, [isLoaded, fromLat, fromLng, routeFrom, destination, showRoute]);

  const fitKey = `${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}|${origin ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}` : ""}|${courier ? "rider" : ""}`;

  useEffect(() => {
    if (!map || fitKeyRef.current === fitKey) return;
    const pts: LatLng[] = [destination];
    if (origin) pts.push(origin);
    if (courier) pts.push(courier);
    const b = new google.maps.LatLngBounds();
    pts.forEach((p) => b.extend(p));
    if (pts.length === 1) {
      map.setCenter(pts[0]);
      map.setZoom(14);
    } else {
      map.fitBounds(b, 60);
    }
    fitKeyRef.current = fitKey;
  }, [map, fitKey, destination, origin, courier]);

  if (!isLoaded) return <MapFallback missingKey={missingKey} error={!!loadError} height={height} />;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="relative">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height }}
          center={courier || origin || destination}
          zoom={14}
          onLoad={setMap}
          options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false }}
        >
          <MarkerF position={destination} icon={destinationIcon()} title={destinationLabel} />
          {origin && <MarkerF position={origin} icon={originIcon()} title={originLabel} zIndex={5} />}
          {courier && <MarkerF position={courier} icon={courierIcon(courierOnline)} title="Delivery person" zIndex={10} />}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: { strokeColor: "#1b5cf5", strokeWeight: 5, strokeOpacity: 0.8 },
              }}
            />
          )}
        </GoogleMap>
        {eta && routeFrom && (
          <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-card">
            {courier ? `ETA ${eta}` : `From warehouse · ${eta}`}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t bg-white px-3 py-2 text-[11px] font-medium text-slate-600">
        {origin && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> {originLabel}
          </span>
        )}
        {courier && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Rider
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> {destinationLabel}
        </span>
      </div>
    </div>
  );
}
