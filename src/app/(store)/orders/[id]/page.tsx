"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Phone, Radio, Truck, Warehouse } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTimeline } from "@/components/ui/OrderTimeline";
import { RouteMap } from "@/components/maps/RouteMap";
import { BANK_SELECT, BankDetails } from "@/components/store/BankDetails";
import { useDispatchPoint } from "@/components/maps/useDispatchPoint";
import type { BankAccount, Order, OrderStatus, Profile } from "@/lib/types";
import { errMsg, fmtDate, isLive, money, placeAddress, timeAgo, variantLabel } from "@/lib/utils";

type Courier = Pick<Profile, "id" | "full_name" | "phone" | "is_online" | "last_lat" | "last_lng" | "last_location_at">;

export default function OrderDetailPage() {
  return (
    <Suspense>
      <OrderDetail />
    </Suspense>
  );
}

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const placed = useSearchParams().get("placed");
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [history, setHistory] = useState<{ status: OrderStatus; created_at: string }[]>([]);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [courierId, setCourierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const { point: dispatch } = useDispatchPoint();

  const load = useCallback(async () => {
    const [{ data: o }, { data: h }] = await Promise.all([
      supabase.from("orders").select("*, order_items(*), deliveries(id,status,delivery_person_id,assigned_at,started_at,completed_at)").eq("id", id).maybeSingle(),
      supabase.from("order_status_history").select("status,created_at").eq("order_id", id).order("created_at"),
    ]);
    const orderRow = o as unknown as Order;
    setOrder(orderRow);
    if (orderRow?.payment_method === "bank_transfer") {
      const { data: settings } = await supabase.from("store_settings").select(BANK_SELECT).eq("id", 1).maybeSingle();
      setBank((settings as BankAccount) || null);
    } else {
      setBank(null);
    }
    setHistory((h as { status: OrderStatus; created_at: string }[]) || []);
    const d = o ? (Array.isArray(o.deliveries) ? o.deliveries[0] : o.deliveries) : null;
    setCourierId(d?.delivery_person_id ?? null);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `order_id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load, supabase]);

  const tracking = order?.status === "out_for_delivery" && !!courierId;

  // Live courier location: only visible (RLS) while the order is out for delivery
  useEffect(() => {
    if (!tracking || !courierId) {
      setCourier(null);
      return;
    }
    let active = true;
    const fetchCourier = () =>
      supabase
        .from("profiles")
        .select("id,full_name,phone,is_online,last_lat,last_lng,last_location_at")
        .eq("id", courierId)
        .maybeSingle()
        .then(({ data }) => active && data && setCourier(data as Courier));
    fetchCourier();
    const ch = supabase
      .channel(`courier-${courierId}-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${courierId}` }, (p) =>
        setCourier((c) => ({ ...(c as Courier), ...(p.new as Courier) }))
      )
      .subscribe();
    const poll = setInterval(fetchCourier, 30000); // fallback if realtime drops
    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [tracking, courierId, id, supabase]);

  const destination = useMemo(() => (order ? { lat: order.lat, lng: order.lng } : null), [order]);
  const origin = useMemo(() => (dispatch ? { lat: dispatch.lat, lng: dispatch.lng } : null), [dispatch]);
  const courierPos = useMemo(
    () => (courier?.last_lat != null && courier?.last_lng != null ? { lat: courier.last_lat, lng: courier.last_lng } : null),
    [courier?.last_lat, courier?.last_lng]
  );

  async function cancel() {
    if (!order || !confirm("Cancel this order?")) return;
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_my_order", { p_order_id: order.id, p_reason: "Cancelled by customer" });
    setCancelling(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Order cancelled");
    load();
  }

  if (loading) return <div className="container-x flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!order) return <div className="container-x py-20 text-center"><p className="font-semibold">Order not found</p><Link href="/orders" className="btn-secondary mt-4">Back to orders</Link></div>;

  const live = courier ? isLive(courier.is_online, courier.last_location_at) : false;

  return (
    <div className="container-x py-8">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> My orders</Link>

      {placed && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">Thank you! Your order has been placed.</p>
            <p className="text-sm">We will confirm it shortly. You can track progress here.</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{order.order_number}</h1>
        <StatusBadge status={order.status} />
        <StatusBadge status={order.payment_status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">Placed {fmtDate(order.created_at)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(tracking || origin) && destination && (
            <section className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${tracking ? "bg-brand-600" : "bg-emerald-600"}`}>
                    {tracking ? <Truck className="h-5 w-5" /> : <Warehouse className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {tracking
                        ? `${courier?.full_name || "Your delivery rider"} is on the way`
                        : `Your order is coming from ${dispatch?.name || "our warehouse"}`}
                    </p>
                    {tracking ? (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Radio className={`h-3 w-3 ${live ? "text-emerald-500" : "text-slate-400"}`} />
                        {live ? "Live" : "Offline"} · updated {timeAgo(courier?.last_location_at)}
                        {dispatch ? ` · from ${dispatch.name}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">{dispatch?.address || "Dispatch location"}</p>
                    )}
                  </div>
                </div>
                {tracking && courier?.phone && (
                  <a href={`tel:${courier.phone}`} className="btn-secondary btn-sm"><Phone className="h-3.5 w-3.5" /> Call rider</a>
                )}
              </div>
              <RouteMap
                destination={destination}
                origin={origin}
                originLabel={dispatch?.name || "Warehouse"}
                courier={courierPos}
                courierOnline={live}
                destinationLabel="Your shop"
                showRoute
              />
              {tracking && !courierPos && <p className="mt-2 text-xs text-slate-500">Waiting for the rider&apos;s GPS signal. The green pin is where the order left from.</p>}
            </section>
          )}

          <section className="card overflow-hidden">
            <h2 className="border-b px-5 py-4 font-bold">Items</h2>
            <ul className="divide-y">
              {order.order_items?.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.image_url && <img src={i.image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{i.product_name}</p>
                    <p className="text-xs text-slate-500">{[variantLabel(i.size, i.color), `${i.quantity} × ${money(i.unit_price)}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <p className="text-sm font-semibold">{money(i.line_total)}</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t bg-slate-50 px-5 py-4 font-bold">
              <span>Total</span>
              <span>{money(order.total)}</span>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-bold">Order status</h2>
            <OrderTimeline status={order.status} history={history} />
            {order.cancel_reason && <p className="mt-4 text-xs text-slate-500">Reason: {order.cancel_reason}</p>}
            {order.status === "pending" && (
              <button onClick={cancel} disabled={cancelling} className="btn-secondary mt-5 w-full text-rose-600">
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />} Cancel order
              </button>
            )}
          </section>
          <section className="card space-y-2 p-5 text-sm">
            <h2 className="mb-2 font-bold">Delivery details</h2>
            <p className="font-medium">{order.customer_name}{order.shop_name ? ` · ${order.shop_name}` : ""}</p>
            <p className="text-slate-600">{order.customer_phone}</p>
            <p className="flex gap-1 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {placeAddress(order.address)}</p>
            {dispatch && (
              <p className="flex gap-1 text-slate-600"><Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Coming from {dispatch.name}{dispatch.address ? ` · ${dispatch.address}` : ""}</p>
            )}
            <p className="pt-2 text-slate-500">Payment: {order.payment_method === "cod" ? "Cash on delivery" : "Bank transfer"}</p>
            {order.payment_method === "bank_transfer" && order.payment_status !== "paid" && (
              <div className="pt-3">
                <BankDetails bank={bank} amount={order.total} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
