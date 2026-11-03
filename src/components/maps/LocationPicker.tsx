"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Crosshair, Loader2 } from "lucide-react";
import { DEFAULT_CENTER, MAP_STYLE, useMaps } from "./useMaps";
import { MapFallback } from "./MapFallback";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
}) {
  const { isLoaded, loadError, missingKey } = useMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const onFail = () =>
      setMapError("Google Maps blocked this website. In the API key, open Website restrictions and add this site address, then wait 5 minutes.");
    window.addEventListener("gmaps-auth-failed", onFail);
    return () => window.removeEventListener("gmaps-auth-failed", onFail);
  }, []);

  const goTo = useCallback((lat: number, lng: number) => {
    const target = mapRef.current;
    target?.panTo({ lat, lng });
    target?.setZoom(17);
  }, []);

  const choose = useCallback(
    (lat: number, lng: number, address?: string) => {
      goTo(lat, lng);
      onChange({ lat, lng, address: address || "Finding address…" });
      if (!isLoaded || !window.google?.maps?.Geocoder) return;
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (res, status) => {
        if (status === "OK" && res?.[0]?.formatted_address) onChange({ lat, lng, address: res[0].formatted_address });
        else if (!address) onChange({ lat, lng, address: "Pinned on map" });
      });
    },
    [goTo, isLoaded, onChange]
  );

  const selectPlace = useCallback(() => {
    const place = acRef.current?.getPlace();
    const query = place?.formatted_address || place?.name || "";
    const point = place?.geometry?.location;
    if (point) {
      const lat = point.lat();
      const lng = point.lng();
      goTo(lat, lng);
      onChange({ lat, lng, address: place?.formatted_address || place?.name || query });
      return;
    }
    if (!query || !window.google?.maps?.Geocoder) return;
    new google.maps.Geocoder().geocode({ address: query, componentRestrictions: { country: "PK" } }, (res, status) => {
      const hit = status === "OK" ? res?.[0] : undefined;
      const loc = hit?.geometry?.location;
      if (!loc) return;
      const lat = loc.lat();
      const lng = loc.lng();
      goTo(lat, lng);
      onChange({ lat, lng, address: hit?.formatted_address || query });
    });
  }, [goTo, onChange]);

  const useMyLocation = useCallback(() => {
    setGpsError(null);
    if (!("geolocation" in navigator)) {
      setGpsError("GPS is not supported on this device. Please pick your location on the map.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        map?.panTo({ lat: latitude, lng: longitude });
        map?.setZoom(17);
        choose(latitude, longitude);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location access in your browser or tap on the map to set your shop location."
            : "Could not get your GPS location. Please try again or tap on the map."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [map, choose]);

  useEffect(() => {
    if (value && map) map.panTo({ lat: value.lat, lng: value.lng });
  }, [value, map]);

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <MapFallback missingKey={missingKey} error={!!loadError} height={300} />
        <button type="button" onClick={useMyLocation} className="btn-secondary w-full">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          Use my current GPS location
        </button>
        {gpsError && <p className="text-xs text-rose-600">{gpsError}</p>}
        {value && <p className="text-xs text-slate-600">Selected: {value.address}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Autocomplete
        onLoad={(ac) => (acRef.current = ac)}
        onPlaceChanged={selectPlace}
        options={{
          fields: ["formatted_address", "geometry", "name"],
          componentRestrictions: { country: "pk" },
        }}
      >
        <input
          className="input"
          placeholder="Search your shop / area address"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </Autocomplete>
      <div className="relative overflow-hidden rounded-xl border border-slate-200">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: 300 }}
          center={value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER}
          zoom={value ? 17 : 12}
          onLoad={(loaded) => {
            mapRef.current = loaded;
            setMap(loaded);
          }}
          onClick={(e) => e.latLng && choose(e.latLng.lat(), e.latLng.lng())}
          options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false, fullscreenControl: false, gestureHandling: "greedy", clickableIcons: false }}
        >
          {value && (
            <MarkerF
              position={{ lat: value.lat, lng: value.lng }}
              draggable
              onDragEnd={(e) => e.latLng && choose(e.latLng.lat(), e.latLng.lng())}
            />
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
      {mapError && <p className="text-xs text-rose-600">{mapError}</p>}
      {gpsError && <p className="text-xs text-rose-600">{gpsError}</p>}
      <p className="text-xs text-slate-500">
        {value ? (
          <>
            <span className="font-medium text-slate-700">Selected:</span> {value.address}
          </>
        ) : (
          "Tap on the map, search, or use GPS to set your delivery location. Drag the pin to adjust."
        )}
      </p>
    </div>
  );
}
