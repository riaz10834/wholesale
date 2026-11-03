"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, Navigation, Phone, Trash2, Truck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderTimeline } from "@/components/ui/OrderTimeline";
import { RouteMap } from "@/components/maps/RouteMap";
import type { Delivery, Order, OrderStatus, Payment, Profile } from "@/lib/types";
import { useMaps } from "@/components/maps/useMaps";
import { ALL_ORDER_STATUSES, ORDER_FLOW, STATUS_LABEL, errMsg, fmtDate, isLive, looksLikeCoords, mapsNavUrl, money, placeAddress, timeAgo, variantLabel } from "@/lib/utils";

type Rider = Pick<Profile, "id" | "full_name" | "phone" | "is_online" | "last_lat" | "last_lng" | "last_location_at">;

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const toast = useToast();
  const { isLoaded: mapsReady } = useMaps();
  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<(Delivery & { delivery_person: Rider | null }) | null>(null);
  const [history, setHistory] = useState<{ status: OrderStatus; created_at: string }[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [rider, setRider] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pay, setPay] = useState({ amount: "", method: "cash", reference: "" });

  const load = useCallback(async () => {
    const [o, d, h, p] = await Promise.all([
      supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle(),
      supabase.from("deliveries").select("*, delivery_person:profiles(id,full_name,phone,is_online,last_lat,last_lng,last_location_at)").eq("order_id", id).maybeSingle(),
      supabase.from("order_status_history").select("status,created_at").eq("order_id", id).order("created_at"),
      supabase.from("payments").select("*").eq("order_id", id).order("created_at"),
    ]);
    setOrder(o.data as unknown as Order);
    setDelivery(d.data as never);
    setHistory((h.data as never) || []);
    setPayments((p.data as Payment[]) || []);
    if (d.data) setRider((d.data as { delivery_person_id: string }).delivery_person_id);
  }, [id, supabase]);

  useEffect(() => {
    load();
    supabase
      .from("profiles")
      .select("id,full_name,phone,is_online,last_lat,last_lng,last_location_at")
      .eq("role", "delivery")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setRiders((data as Rider[]) || []));
    const ch = supabase
      .channel(`admin-order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `order_id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load, supabase]);

  // live rider position
  const riderId = delivery?.delivery_person_id;
  useEffect(() => {
    if (!riderId) return;
    const ch = supabase
      .channel(`admin-order-rider-${riderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${riderId}` }, (p) =>
        setDelivery((d) => (d ? { ...d, delivery_person: { ...(d.delivery_person as Rider), ...(p.new as Rider) } } : d))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [riderId, supabase]);

  useEffect(() => {
    if (!order || !mapsReady || !looksLikeCoords(order.address)) return;
    const orderId = order.id;
    let cancel = false;
    new google.maps.Geocoder().geocode({ location: { lat: order.lat, lng: order.lng } }, (res, status) => {
      const address = status === "OK" ? res?.[0]?.formatted_address : "";
      if (cancel || !address) return;
      setOrder((current) => (current && current.id === orderId ? { ...current, address } : current));
      supabase.from("orders").update({ address }).eq("id", orderId);
    });
    return () => {
      cancel = true;
    };
    // Resolve a stored coordinate string into a street address once per order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.address, mapsReady, supabase]);

  const destination = useMemo(() => (order ? { lat: order.lat, lng: order.lng } : null), [order]);
  const dp = delivery?.delivery_person;
  const riderPos = useMemo(() => (dp?.last_lat != null && dp?.last_lng != null ? { lat: dp.last_lat, lng: dp.last_lng } : null), [dp?.last_lat, dp?.last_lng]);

  async function setStatus(s: OrderStatus) {
    if (!order) return;
    let reason: string | null = null;
    if (["cancelled", "returned", "failed"].includes(s)) {
      reason = prompt(`Reason for marking as ${STATUS_LABEL[s]}?`);
      if (reason === null) return;
    }
    setBusy("status");
    const { error } = await supabase.from("orders").update({ status: s, ...(reason ? { cancel_reason: reason } : {}) }).eq("id", order.id);
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success(`Order marked ${STATUS_LABEL[s]}`);
    load();
  }

  async function assign() {
    if (!rider || !order) return toast.error("Select a delivery person");
    setBusy("assign");
    const { error } = await supabase.rpc("assign_delivery", { p_order_id: order.id, p_person_id: rider });
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success("Delivery person assigned");
    load();
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(pay.amount);
    if (!order || !(amount > 0)) return toast.error("Enter a valid amount");
    setBusy("pay");
    const { error } = await supabase.from("payments").insert({ order_id: order.id, amount, method: pay.method, reference: pay.reference || null });
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    setPay({ amount: "", method: "cash", reference: "" });
    toast.success("Payment recorded");
    load();
  }

  async function deletePayment(pid: string) {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", pid);
    if (error) return toast.error(errMsg(error));
    load();
  }

  if (!order) return <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const idx = ORDER_FLOW.indexOf(order.status);
  const nextStatus = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;
  const closed = ["delivered", "cancelled", "returned"].includes(order.status);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const profit = Number(order.total) - Number(order.total_cost);
  const live = dp ? isLive(dp.is_online, dp.last_location_at) : false;

  return (
    <>
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Orders</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{order.order_number}</h1>
        <StatusBadge status={order.status} />
        <StatusBadge status={order.payment_status} />
        <span className="text-sm text-slate-500">{fmtDate(order.created_at)}</span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-5">
            <h2 className="font-bold">Workflow</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {nextStatus && (
                <button disabled={!!busy} onClick={() => setStatus(nextStatus)} className="btn-primary">
                  {busy === "status" && <Loader2 className="h-4 w-4 animate-spin" />} Mark as {STATUS_LABEL[nextStatus]}
                </button>
              )}
              <select
                className="input w-auto"
                value=""
                onChange={(e) => e.target.value && setStatus(e.target.value as OrderStatus)}
                disabled={!!busy}
              >
                <option value="">Set status…</option>
                {ALL_ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            {order.cancel_reason && <p className="mt-3 text-sm text-slate-500">Note: {order.cancel_reason}</p>}
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold"><Truck className="h-4 w-4" /> Delivery</h2>
              {delivery && <StatusBadge status={delivery.status} />}
            </div>
            {!closed && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select className="input" value={rider} onChange={(e) => setRider(e.target.value)}>
                  <option value="">Select delivery person…</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} · {r.phone} {isLive(r.is_online, r.last_location_at) ? "(online)" : "(offline)"}
                    </option>
                  ))}
                </select>
                <button onClick={assign} disabled={busy === "assign" || !rider} className="btn-primary shrink-0">
                  {busy === "assign" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {delivery ? "Reassign" : "Assign"}
                </button>
              </div>
            )}
            {riders.length === 0 && <p className="mt-2 text-xs text-slate-500">No delivery persons yet. <Link href="/admin/delivery-persons" className="text-brand-600">Add one</Link>.</p>}
            {delivery && dp && (
              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <p><span className="text-slate-500">Rider:</span> <b>{dp.full_name}</b> <a href={`tel:${dp.phone}`} className="text-brand-600">{dp.phone}</a></p>
                <p><span className="text-slate-500">GPS:</span> {live ? <span className="text-emerald-600">online</span> : "offline"} · {timeAgo(dp.last_location_at)}</p>
                <p><span className="text-slate-500">Assigned:</span> {fmtDate(delivery.assigned_at)}</p>
                {delivery.completed_at && <p><span className="text-slate-500">Completed:</span> {fmtDate(delivery.completed_at)}</p>}
                {delivery.failure_reason && <p className="text-rose-600 sm:col-span-2">Failure: {delivery.failure_reason}</p>}
                {delivery.notes && <p className="sm:col-span-2">Notes: {delivery.notes}</p>}
                {Number(delivery.cash_collected) > 0 && <p>Cash collected: <b>{money(delivery.cash_collected)}</b></p>}
              </div>
            )}
            {destination && (
              <div className="mt-4">
                <RouteMap destination={destination} courier={riderPos} courierOnline={live} height={320} showRoute={order.status === "out_for_delivery"} />
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b px-5 py-4 font-bold">Items</h2>
            <div className="overflow-x-auto">
              <table className="table-x">
                <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Cost</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {order.order_items?.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {i.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={i.image_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium">{i.product_name}</p>
                            <p className="text-xs text-slate-500">{variantLabel(i.size, i.color) || "Standard"} · {money(i.unit_price)} each</p>
                          </div>
                        </div>
                      </td>
                      <td>{i.quantity}</td>
                      <td>{money(i.unit_price)}</td>
                      <td className="text-slate-500">{money(i.unit_cost)}</td>
                      <td className="text-right font-semibold">{money(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-1 border-t bg-slate-50 px-5 py-4 text-sm">
              <div className="flex justify-between"><span>Total</span><b>{money(order.total)}</b></div>
              <div className="flex justify-between text-slate-500"><span>Cost of goods</span><span>{money(order.total_cost)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Gross profit</span><b>{money(profit)}</b></div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-bold">Shop details</h2>
            <p className="text-base font-semibold">{order.shop_name || "No shop name"}</p>
            <p><span className="text-slate-500">Customer:</span> {order.customer_name}</p>
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 font-medium text-brand-600"><Phone className="h-4 w-4" /> {order.customer_phone}</a>
            <p className="flex gap-1 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {placeAddress(order.address)}</p>
            <p><span className="text-slate-500">Payment:</span> {order.payment_method === "cod" ? "Cash on delivery" : order.payment_method.replace("_", " ")}</p>
            <a href={mapsNavUrl(order.lat, order.lng)} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><Navigation className="h-3.5 w-3.5" /> Open in Google Maps</a>
            {order.notes && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Note: {order.notes}</p>}
            <div className="border-t pt-3">
              <p className="mb-2 font-semibold">Products in this order</p>
              <ul className="space-y-2">
                {order.order_items?.map((i) => (
                  <li key={i.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-medium">{i.product_name}</p>
                    <p className="text-xs text-slate-500">{variantLabel(i.size, i.color) || "Standard"} · Qty {i.quantity} · {money(i.line_total)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">Payments</h2>
            <p className="mt-1 text-sm text-slate-500">Paid {money(paid)} of {money(order.total)} · {order.payment_method === "cod" ? "Cash on delivery" : order.payment_method.replace("_", " ")}</p>
            <ul className="mt-3 space-y-2">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span><b>{money(p.amount)}</b> <span className="text-slate-500">· {p.method} · {fmtDate(p.created_at, false)}</span></span>
                  <button onClick={() => deletePayment(p.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <form onSubmit={addPayment} className="mt-4 grid grid-cols-2 gap-2">
              <input className="input col-span-2" type="number" step="0.01" min="0.01" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_wallet">Mobile wallet</option>
                <option value="cheque">Cheque</option>
              </select>
              <input className="input" placeholder="Reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
              <button disabled={busy === "pay"} className="btn-success col-span-2">{busy === "pay" && <Loader2 className="h-4 w-4 animate-spin" />} Record payment</button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-bold">History</h2>
            <OrderTimeline status={order.status} history={history} />
          </section>
        </div>
      </div>
    </>
  );
}
