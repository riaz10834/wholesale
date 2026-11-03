"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DirectionsRenderer, GoogleMap, InfoWindowF, MarkerF, PolylineF } from "@react-google-maps/api";
import { Crosshair, Phone, Radio, RefreshCw, Route } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DEFAULT_CENTER, MAP_STYLE, useMaps } from "@/components/maps/useMaps";
import { MapFallback } from "@/components/maps/MapFallback";
import { courierIcon, destinationIcon } from "@/components/maps/markers";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DeliveryStatus, Profile } from "@/lib/types";
import { cn, isLive, placeAddress, timeAgo } from "@/lib/utils";

type Rider = Pick<Profile, "id" | "full_name" | "phone" | "is_online" | "is_active" | "last_lat" | "last_lng" | "last_accuracy" | "last_speed" | "last_location_at">;
interface ActiveDelivery {
  id: string;
  status: DeliveryStatus;
  delivery_person_id: string;
  order: { id: string; order_number: string; customer_name: string; customer_phone: string; shop_name: string | null; address: string | null; lat: number; lng: number; status: string } | null;
}

export default function LiveTracking() {
  const supabase = supabaseBrowser();
  const { isLoaded, loadError, missingKey } = useMaps();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [trail, setTrail] = useState<google.maps.LatLngLiteral[]>([]);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "online" | "busy">("all");
  const [, setTick] = useState(0);
  const mapRef = useRef<google.maps.Map | null>(null);
  const fitted = useRef(false);

  const loadRiders = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,phone,is_online,is_active,last_lat,last_lng,last_accuracy,last_speed,last_location_at")
      .eq("role", "delivery")
      .eq("is_active", true);
    setRiders((data as Rider[]) || []);
  }, [supabase]);

  const loadDeliveries = useCallback(async () => {
    const { data } = await supabase
      .from("deliveries")
      .select("id,status,delivery_person_id,order:orders(id,order_number,customer_name,customer_phone,shop_name,address,lat,lng,status)")
      .in("status", ["assigned", "picked_up", "out_for_delivery"]);
    setDeliveries((data as unknown as ActiveDelivery[]) || []);
  }, [supabase]);

  useEffect(() => {
    loadRiders();
    loadDeliveries();
    const ch = supabase
      .channel("fleet-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: "role=eq.delivery" }, (p) => {
        const n = p.new as Rider;
        setRiders((rs) => (rs.some((r) => r.id === n.id) ? rs.map((r) => (r.id === n.id ? { ...r, ...n } : r)) : [...rs, n]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => loadDeliveries())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_locations" }, (p) => {
        const n = p.new as { delivery_person_id: string; lat: number; lng: number };
        setTrail((t) => (selectedRef.current === n.delivery_person_id ? [...t, { lat: n.lat, lng: n.lng }].slice(-300) : t));
      })
      .subscribe();
    const tick = setInterval(() => setTick((t) => t + 1), 15000);
    const poll = setInterval(loadRiders, 60000); // safety net if realtime disconnects
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [supabase, loadRiders, loadDeliveries]);

  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // trail of the selected rider (last 3 hours)
  useEffect(() => {
    setTrail([]);
    if (!selected) return;
    const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    supabase
      .from("delivery_locations")
      .select("lat,lng")
      .eq("delivery_person_id", selected)
      .gte("created_at", since)
      .order("created_at")
      .limit(1000)
      .then(({ data }) => setTrail((data as google.maps.LatLngLiteral[]) || []));
  }, [selected, supabase]);

  const byRider = useMemo(() => {
    const m = new Map<string, ActiveDelivery[]>();
    deliveries.forEach((d) => m.set(d.delivery_person_id, [...(m.get(d.delivery_person_id) || []), d]));
    return m;
  }, [deliveries]);

  const selRider = riders.find((r) => r.id === selected) || null;
  const selDelivery = selected ? (byRider.get(selected) || []).find((d) => d.status !== "assigned") || byRider.get(selected)?.[0] : undefined;

  // route for selected rider to current destination
  const lastRoute = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (!isLoaded || !selRider?.last_lat || !selDelivery?.order) {
      setDirections(null);
      setEta(null);
      return;
    }
    const key = `${selRider.id}-${selDelivery.id}`;
    if (lastRoute.current?.key === key && Date.now() - lastRoute.current.at < 45000) return;
    lastRoute.current = { key, at: Date.now() };
    new google.maps.DirectionsService().route(
      {
        origin: { lat: selRider.last_lat, lng: selRider.last_lng! },
        destination: { lat: selDelivery.order.lat, lng: selDelivery.order.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (res, status) => {
        if (status === "OK" && res) {
          setDirections(res);
          const leg = res.routes[0]?.legs[0];
          setEta(leg ? `${leg.distance?.text} · ${leg.duration?.text}` : null);
        }
      }
    );
  }, [isLoaded, selRider?.id, selRider?.last_lat, selRider?.last_lng, selDelivery?.id, selDelivery?.order]); // eslint-disable-line react-hooks/exhaustive-deps

  // fit all riders once
  useEffect(() => {
    if (!isLoaded || !mapRef.current || fitted.current) return;
    const pts = riders.filter((r) => r.last_lat != null).map((r) => ({ lat: r.last_lat!, lng: r.last_lng! }));
    deliveries.forEach((d) => d.order && pts.push({ lat: d.order.lat, lng: d.order.lng }));
    if (pts.length === 0) return;
    const b = new google.maps.LatLngBounds();
    pts.forEach((p) => b.extend(p));
    mapRef.current.fitBounds(b, 80);
    if (pts.length === 1) mapRef.current.setZoom(15);
    fitted.current = true;
  }, [isLoaded, riders, deliveries]);

  function focus(r: Rider) {
    setSelected(r.id);
    setInfo(r.id);
    if (r.last_lat != null && mapRef.current) {
      mapRef.current.panTo({ lat: r.last_lat, lng: r.last_lng! });
      mapRef.current.setZoom(15);
    }
  }

  const list = riders
    .filter((r) => (filter === "online" ? isLive(r.is_online, r.last_location_at) : filter === "busy" ? byRider.has(r.id) : true))
    .sort((a, b) => Number(isLive(b.is_online, b.last_location_at)) - Number(isLive(a.is_online, a.last_location_at)));
  const onlineCount = riders.filter((r) => isLive(r.is_online, r.last_location_at)).length;

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col sm:-m-6 lg:flex-row">
      <aside className="order-2 flex max-h-[45vh] flex-col border-t border-slate-200 bg-white lg:order-1 lg:max-h-none lg:w-96 lg:border-r lg:border-t-0">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Live fleet</h1>
            <button onClick={() => { loadRiders(); loadDeliveries(); }} className="btn-ghost btn-sm"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          <p className="text-xs text-slate-500">{onlineCount} online · {riders.length} riders · {deliveries.length} active deliveries</p>
          <div className="mt-3 flex gap-1.5">
            {(["all", "online", "busy"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1 text-xs font-semibold capitalize", filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")}>
                {f === "busy" ? "On delivery" : f}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 divide-y overflow-y-auto">
          {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No riders to show</li>}
          {list.map((r) => {
            const live = isLive(r.is_online, r.last_location_at);
            const jobs = byRider.get(r.id) || [];
            return (
              <li key={r.id}>
                <button onClick={() => focus(r)} className={cn("w-full p-4 text-left hover:bg-slate-50", selected === r.id && "bg-brand-50")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{r.full_name}</p>
                    <span className={cn("badge", live ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200")}>
                      <Radio className="h-3 w-3" /> {live ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{r.phone} · updated {timeAgo(r.last_location_at)}</p>
                  {jobs.map((j) => (
                    <p key={j.id} className="mt-1.5 flex items-center gap-2 text-xs">
                      <StatusBadge status={j.status} /> <span className="font-medium">{j.order?.order_number}</span>
                      <span className="truncate text-slate-500">{j.order?.shop_name || j.order?.customer_name}</span>
                    </p>
                  ))}
                  {r.last_lat == null && <p className="mt-1 text-xs text-amber-600">No GPS data received yet</p>}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="relative order-1 flex-1 lg:order-2">
        {!isLoaded ? (
          <div className="p-4"><MapFallback missingKey={missingKey} error={!!loadError} height={500} /></div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%", minHeight: 360 }}
            center={DEFAULT_CENTER}
            zoom={12}
            onLoad={(m) => {
              mapRef.current = m;
            }}
            onClick={() => setInfo(null)}
            options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
          >
            {deliveries.map((d) =>
              d.order ? (
                <MarkerF
                  key={`dest-${d.id}`}
                  position={{ lat: d.order.lat, lng: d.order.lng }}
                  icon={destinationIcon()}
                  opacity={!selected || selected === d.delivery_person_id ? 1 : 0.35}
                  onClick={() => setInfo(`dest-${d.id}`)}
                >
                  {info === `dest-${d.id}` && (
                    <InfoWindowF onCloseClick={() => setInfo(null)}>
                      <div className="min-w-48 text-sm">
                        <p className="font-bold">{d.order.order_number}</p>
                        <p>{d.order.customer_name}{d.order.shop_name ? ` · ${d.order.shop_name}` : ""}</p>
                        <p className="text-slate-500">{placeAddress(d.order.address)}</p>
                        <a href={`tel:${d.order.customer_phone}`} className="text-blue-600">{d.order.customer_phone}</a>
                        <p className="mt-1"><Link href={`/admin/orders/${d.order.id}`} className="text-blue-600 underline">Open order</Link></p>
                      </div>
                    </InfoWindowF>
                  )}
                </MarkerF>
              ) : null
            )}

            {riders
              .filter((r) => r.last_lat != null && r.last_lng != null)
              .map((r) => {
                const live = isLive(r.is_online, r.last_location_at);
                const jobs = byRider.get(r.id) || [];
                return (
                  <MarkerF
                    key={r.id}
                    position={{ lat: r.last_lat!, lng: r.last_lng! }}
                    icon={courierIcon(live, selected === r.id)}
                    zIndex={selected === r.id ? 100 : live ? 50 : 10}
                    onClick={() => focus(r)}
                  >
                    {info === r.id && (
                      <InfoWindowF onCloseClick={() => setInfo(null)}>
                        <div className="min-w-52 text-sm">
                          <p className="font-bold">{r.full_name}</p>
                          <p><a href={`tel:${r.phone}`} className="text-blue-600">{r.phone}</a></p>
                          <p className={live ? "text-emerald-600" : "text-slate-500"}>{live ? "Online" : "Offline"} · {timeAgo(r.last_location_at)}</p>
                          {r.last_speed != null && <p className="text-slate-500">Speed {(r.last_speed * 3.6).toFixed(0)} km/h · ±{Math.round(r.last_accuracy || 0)}m</p>}
                          {jobs.length === 0 && <p className="text-slate-500">No active delivery</p>}
                          {jobs.map((j) => (
                            <p key={j.id} className="mt-1">
                              <Link href={`/admin/orders/${j.order?.id}`} className="font-semibold text-blue-600">{j.order?.order_number}</Link> → {j.order?.shop_name || j.order?.customer_name}
                            </p>
                          ))}
                          {selected === r.id && eta && <p className="mt-1 font-semibold">ETA: {eta}</p>}
                        </div>
                      </InfoWindowF>
                    )}
                  </MarkerF>
                );
              })}

            {trail.length > 1 && <PolylineF path={trail} options={{ strokeColor: "#64748b", strokeOpacity: 0.6, strokeWeight: 3 }} />}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{ suppressMarkers: true, preserveViewport: true, polylineOptions: { strokeColor: "#1b5cf5", strokeWeight: 5, strokeOpacity: 0.85 } }}
              />
            )}
          </GoogleMap>
        )}

        {selRider && (
          <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-card backdrop-blur sm:right-auto">
            <div>
              <p className="text-sm font-bold">{selRider.full_name}</p>
              <p className="text-xs text-slate-500">
                {selDelivery?.order ? <>To {selDelivery.order.shop_name || selDelivery.order.customer_name}{eta ? ` · ${eta}` : ""}</> : "No active delivery"}
              </p>
            </div>
            <a href={`tel:${selRider.phone}`} className="btn-secondary btn-sm"><Phone className="h-3.5 w-3.5" /></a>
            {selRider.last_lat != null && (
              <button onClick={() => focus(selRider)} className="btn-secondary btn-sm"><Crosshair className="h-3.5 w-3.5" /></button>
            )}
            {directions && <span className="inline-flex items-center gap-1 text-xs text-brand-700"><Route className="h-3.5 w-3.5" /> Route shown</span>}
            <button onClick={() => { setSelected(null); setInfo(null); setDirections(null); }} className="btn-ghost btn-sm">Clear</button>
          </div>
        )}
      </div>
    </div>
  );
}
