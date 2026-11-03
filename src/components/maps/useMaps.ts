"use client";
import { useEffect, useState } from "react";
import { useJsApiLoader, type Libraries } from "@react-google-maps/api";

const LIBRARIES: Libraries = ["places", "geometry"];
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const DEFAULT_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || 24.8607),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || 67.0011),
};

if (typeof window !== "undefined" && !(window as Window & { __gmapsAuthHook?: boolean }).__gmapsAuthHook) {
  (window as Window & { __gmapsAuthHook?: boolean; gm_authFailure?: () => void }).__gmapsAuthHook = true;
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    window.dispatchEvent(new Event("gmaps-auth-failed"));
  };
}

export function useMaps() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-maps-script",
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });
  const [authFailed, setAuthFailed] = useState(false);
  useEffect(() => {
    const onFail = () => setAuthFailed(true);
    window.addEventListener("gmaps-auth-failed", onFail);
    return () => window.removeEventListener("gmaps-auth-failed", onFail);
  }, []);
  return { isLoaded: isLoaded && !!MAPS_KEY, loadError, missingKey: !MAPS_KEY, authFailed };
}

export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];
