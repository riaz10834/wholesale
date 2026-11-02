import { MapPinOff, Loader2 } from "lucide-react";

export function MapFallback({ missingKey, error, height = 320 }: { missingKey?: boolean; error?: boolean; height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500"
    >
      {missingKey || error ? (
        <>
          <MapPinOff className="h-6 w-6" />
          <p className="font-medium text-slate-700">{missingKey ? "Google Maps API key not configured" : "Google Maps failed to load"}</p>
          <p className="max-w-sm text-xs">
            Set <code className="rounded bg-slate-200 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your environment and enable
            Maps JavaScript, Directions, Geocoding and Places APIs.
          </p>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading map…</p>
        </>
      )}
    </div>
  );
}
