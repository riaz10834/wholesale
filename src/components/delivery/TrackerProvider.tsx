"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const SEND_INTERVAL_MS = 12000;
const SHIFT_KEY = "wb_shift_on";

interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  at: number;
}

interface TrackerState {
  tracking: boolean;
  starting: boolean;
  lastFix: Fix | null;
  lastSentAt: number | null;
  error: string | null;
  warning: string | null;
  queued: number;
  online: boolean;
  supported: boolean;
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
}

const Ctx = createContext<TrackerState>(null as unknown as TrackerState);

type WakeLockSentinelLike = { release: () => Promise<void> };

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const [tracking, setTracking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lastFix, setLastFix] = useState<Fix | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  const [supported, setSupported] = useState(true);

  const watchId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const queue = useRef<Fix[]>([]);
  const sentFixAt = useRef<number>(0);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  const flushing = useRef(false);

  const toFix = (p: GeolocationPosition): Fix => ({
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy ?? null,
    heading: p.coords.heading ?? null,
    speed: p.coords.speed ?? null,
    at: p.timestamp || Date.now(),
  });

  const send = useCallback(
    async (fix: Fix) => {
      const { error } = await supabase.rpc("push_location", {
        p_lat: fix.lat,
        p_lng: fix.lng,
        p_accuracy: fix.accuracy,
        p_heading: fix.heading,
        p_speed: fix.speed,
        p_recorded_at: new Date(fix.at).toISOString(),
      });
      if (error) throw error;
      setLastSentAt(Date.now());
    },
    [supabase]
  );

  const flush = useCallback(async () => {
    if (flushing.current || queue.current.length === 0 || !navigator.onLine) return;
    flushing.current = true;
    try {
      while (queue.current.length) {
        await send(queue.current[0]);
        queue.current.shift();
        setQueued(queue.current.length);
      }
      setWarning(null);
    } catch {
      // keep remaining items queued
    } finally {
      flushing.current = false;
    }
  }, [send]);

  const tick = useCallback(async () => {
    const fix = fixRef.current;
    if (!fix) return;
    if (Date.now() - fix.at > 60000) setWarning("GPS signal is weak — waiting for a fresh location fix…");
    // the same fix is re-sent when the device hasn't moved, acting as an online heartbeat
    sentFixAt.current = fix.at;
    if (!navigator.onLine) {
      queue.current.push(fix);
      if (queue.current.length > 300) queue.current.shift();
      setQueued(queue.current.length);
      setWarning("You are offline. Locations are saved and will be sent when the connection returns.");
      return;
    }
    try {
      await flush();
      await send({ ...fix, at: fix.at });
      if (Date.now() - fix.at <= 60000) setWarning(null);
    } catch (e) {
      queue.current.push(fix);
      setQueued(queue.current.length);
      const msg = (e as { message?: string })?.message || "";
      setWarning(msg.includes("Delivery persons only") ? "Your account is not allowed to share location." : "Could not reach server. Retrying…");
    }
  }, [flush, send]);

  const cleanup = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
      if (nav.wakeLock) wakeLock.current = await nav.wakeLock.request("screen");
    } catch {
      /* not supported or denied */
    }
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setSupported(false);
      setError("This device/browser does not support GPS location.");
      return false;
    }
    if (!window.isSecureContext) {
      setError("GPS requires a secure (HTTPS) connection.");
      return false;
    }
    setStarting(true);
    const first = await new Promise<GeolocationPosition | GeolocationPositionError>((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, resolve, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
    );
    if (!("coords" in first)) {
      setStarting(false);
      const err = first as GeolocationPositionError;
      setError(
        err.code === err.PERMISSION_DENIED
          ? "Location permission was denied. Enable location for this site in your browser settings, then try again."
          : err.code === err.TIMEOUT
          ? "Timed out getting GPS. Move to an open area and try again."
          : "Location unavailable. Turn on device GPS / location services."
      );
      return false;
    }
    const fix = toFix(first);
    fixRef.current = fix;
    setLastFix(fix);

    const { error: onlineErr } = await supabase.rpc("set_online", { p_online: true });
    if (onlineErr) {
      setStarting(false);
      setError(onlineErr.message);
      return false;
    }
    try {
      await send(fix);
    } catch {
      queue.current.push(fix);
      setQueued(queue.current.length);
    }

    cleanup();
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const f = toFix(p);
        fixRef.current = f;
        setLastFix(f);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission was revoked. Tracking stopped.");
          cleanup();
          setTracking(false);
          localStorage.removeItem(SHIFT_KEY);
          supabase.rpc("set_online", { p_online: false }).then(() => {});
        } else {
          setWarning("GPS signal lost — retrying…");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    timer.current = setInterval(tick, SEND_INTERVAL_MS);
    await requestWakeLock();
    localStorage.setItem(SHIFT_KEY, "1");
    setTracking(true);
    setStarting(false);
    return true;
  }, [supabase, send, cleanup, tick, requestWakeLock]);

  const stop = useCallback(async () => {
    cleanup();
    setTracking(false);
    setWarning(null);
    localStorage.removeItem(SHIFT_KEY);
    await flush();
    await supabase.rpc("set_online", { p_online: false });
  }, [cleanup, flush, supabase]);

  // network status
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [flush]);

  // re-acquire wake lock when returning to the app; resume shift after reload if permission already granted
  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === "visible" && tracking) {
        requestWakeLock();
        tick();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [tracking, requestWakeLock, tick]);

  useEffect(() => {
    if (localStorage.getItem(SHIFT_KEY) !== "1" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        if (s.state === "granted") start();
        else localStorage.removeItem(SHIFT_KEY);
      })
      .catch(() => {});
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ tracking, starting, lastFix, lastSentAt, error, warning, queued, online, supported, start, stop }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTracker = () => useContext(Ctx);
