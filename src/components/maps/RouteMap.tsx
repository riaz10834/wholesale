"use client";
import { useEffect, useRef, useState } from "react";
import { DirectionsRenderer, GoogleMap, MarkerF } from "@react-google-maps/api";
import { MAP_STYLE, useMaps } from "./useMaps";
import { MapFallback } from "./MapFallback";
import { courierIcon, destinationIcon } from "./markers";

type LatLng = { lat: number; lng: number };

/** Shows a destination and (optionally) a moving courier with a driving route between them. */
export function RouteMap({
  destination,
  courier,
  courierOnline = true,
  height = 360,
  showRoute = true,
}: {
  destination: LatLng;
  courier?: LatLng | null;
  courierOnline?: boolean;
  height?: number;
  showRoute?: boolean;
}) {
  const { isLoaded, loadError, missingKey } = useMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const lastRouteRef = useRef<{ at: number; from: LatLng } | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !showRoute || !courier) return;
    const last = lastRouteRef.current;
    const movedFar =
      !last ||
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(last.from),
        new google.maps.LatLng(courier)
      ) > 150;
    // re-route at most every 45s or when courier moved > 150m, to save API quota
    if (last && !movedFar && Date.now() - last.at < 45000) return;
    lastRouteRef.current = { at: Date.now(), from: courier };
    new google.maps.DirectionsService().route(
      { origin: courier, destination, travelMode: google.maps.TravelMode.DRIVING },
      (res, status) => {
        if (status === "OK" && res) {
          setDirections(res);
          const leg = res.routes[0]?.legs[0];
          if (leg) setEta(`${leg.distance?.text} · ${leg.duration?.text}`);
        }
      }
    );
  }, [isLoaded, courier, destination, showRoute]);

  useEffect(() => {
    if (!map || fittedRef.current) return;
    if (courier) {
      const b = new google.maps.LatLngBounds();
      b.extend(destination);
      b.extend(courier);
      map.fitBounds(b, 60);
      fittedRef.current = true;
    }
  }, [map, courier, destination]);

  if (!isLoaded) return <MapFallback missingKey={missingKey} error={!!loadError} height={height} />;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height }}
        center={courier || destination}
        zoom={14}
        onLoad={setMap}
        options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false }}
      >
        <MarkerF position={destination} icon={destinationIcon()} title="Delivery location" />
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
      {eta && courier && (
        <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-card">
          ETA {eta}
        </div>
      )}
    </div>
  );
}
