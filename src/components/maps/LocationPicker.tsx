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
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!isLoaded) return onChange({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (res, status) => {
        const address = status === "OK" && res?.[0] ? res[0].formatted_address : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onChange({ lat, lng, address });
      });
    },
    [isLoaded, onChange]
  );

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
        reverseGeocode(latitude, longitude);
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
  }, [map, reverseGeocode]);

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
        onPlaceChanged={() => {
          const place = acRef.current?.getPlace();
          const loc = place?.geometry?.location;
          if (loc) {
            const lat = loc.lat();
            const lng = loc.lng();
            map?.panTo({ lat, lng });
            map?.setZoom(17);
            onChange({ lat, lng, address: place?.formatted_address || place?.name || `${lat}, ${lng}` });
          }
        }}
      >
        <input className="input" placeholder="Search your shop / area address" />
      </Autocomplete>
      <div className="relative overflow-hidden rounded-xl border border-slate-200">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: 300 }}
          center={value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER}
          zoom={value ? 17 : 12}
          onLoad={setMap}
          onClick={(e) => e.latLng && reverseGeocode(e.latLng.lat(), e.latLng.lng())}
          options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {value && (
            <MarkerF
              position={{ lat: value.lat, lng: value.lng }}
              draggable
              onDragEnd={(e) => e.latLng && reverseGeocode(e.latLng.lat(), e.latLng.lng())}
            />
          )}
        </GoogleMap>
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-card hover:bg-slate-50"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4 text-brand-600" />}
          Use my GPS location
        </button>
      </div>
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
