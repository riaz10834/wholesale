"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Navigation, PackageOpen, Phone, Truck, XCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useTracker } from "@/components/delivery/TrackerProvider";
import { RouteMap } from "@/components/maps/RouteMap";
import { OrderChat } from "@/components/order/OrderChat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Delivery, DeliveryStatus, Order } from "@/lib/types";
import { errMsg, fmtDate, mapsNavUrl, money, placeAddress, variantLabel } from "@/lib/utils";

export default function DeliveryOrder() {
  const { id } = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const toast = useToast();
  const { user, profile } = useAuth();
  const tracker = useTracker();
  const [d, setD] = useState<(Delivery & { order: Order }) | null>(null);
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | "deliver" | "fail">(null);
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("deliveries").select("*, order:orders(*, order_items(*), payments(amount))").eq("id", id).maybeSingle();
    if (data) {
      setD(data as never);
      const p = ((data as { order: { payments?: { amount: number }[] } }).order?.payments || []).reduce((s, x) => s + Number(x.amount), 0);
      setPaid(p);
      setCash(String(Math.max(0, Number((data as { order: Order }).order.total) - p)));
    }
  }, [id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const destination = useMemo(() => (d?.order ? { lat: d.order.lat, lng: d.order.lng } : null), [d?.order]);
  const me = useMemo(() => (tracker.lastFix ? { lat: tracker.lastFix.lat, lng: tracker.lastFix.lng } : null), [tracker.lastFix]);

  async function update(status: DeliveryStatus) {
    if (!d) return;
    if (status === "failed" && note.trim().length < 3) return toast.error("Please enter the reason for failed delivery");
    const cashNum = status === "delivered" ? Number(cash) || 0 : 0;
    if (cashNum < 0) return toast.error("Invalid amount");
    setBusy(true);
    if ((status === "picked_up" || status === "out_for_delivery") && profile?.role === "delivery" && !tracker.tracking) {
      const ok = await tracker.start();
      if (!ok) toast.error("GPS sharing could not start — customer won't see live location. You can still continue.");
    }
    const { error } = await supabase.rpc("update_delivery_status", {
      p_delivery_id: d.id,
      p_status: status,
      p_note: note.trim() || null,
      p_cash: cashNum,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(status === "delivered" ? "Delivered! Great job." : status === "failed" ? "Marked as failed delivery" : "Status updated — customer can now track you");
    setMode(null);
    setNote("");
    await load();

    if ((status === "delivered" || status === "failed") && tracker.tracking && user) {
      const { count } = await supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("delivery_person_id", user.id)
        .in("status", ["assigned", "picked_up", "out_for_delivery"]);
      if (!count && confirm("No more active deliveries. End your shift and stop sharing GPS location?")) {
        await tracker.stop();
        toast.success("Shift ended. GPS sharing stopped.");
      }
    }
  }

  if (!d) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  const o = d.order;
  const closed = ["delivered", "failed", "cancelled"].includes(d.status);
  const due = Math.max(0, Number(o.total) - paid);

  return (
    <div className="space-y-4">
      <Link href="/delivery" className="inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> All deliveries</Link>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{o.order_number}</h1>
          <StatusBadge status={d.status} />
        </div>
        <p className="mt-3 text-lg font-semibold">{o.customer_name}</p>
        {o.shop_name && <p className="text-slate-600">{o.shop_name}</p>}
        <p className="mt-1 flex gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {placeAddress(o.address)}</p>
        {o.notes && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Note: {o.notes}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${o.customer_phone}`} className="btn-primary py-3"><Phone className="h-4 w-4" /> Call {o.customer_phone}</a>
          <a href={mapsNavUrl(o.lat, o.lng)} target="_blank" rel="noreferrer" className="btn-secondary py-3"><Navigation className="h-4 w-4" /> Navigate</a>
        </div>
      </div>

      {user && <OrderChat orderId={o.id} meId={user.id} title={`Chat with ${o.customer_name}`} />}

      {destination && <RouteMap destination={destination} courier={me} height={280} showRoute={!closed && !!me} />}
      {!tracker.tracking && profile?.role === "delivery" && !closed && (
        <p className="text-xs text-slate-500">Start your shift on the deliveries screen to share GPS and see your route.</p>
      )}

      <div className="card overflow-hidden">
        <p className="border-b px-5 py-3 font-semibold">Items ({o.order_items?.length})</p>
        <ul className="divide-y text-sm">
          {o.order_items?.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-5 py-3">
              <span><b>{i.quantity}×</b> {i.product_name} <span className="text-slate-500">{variantLabel(i.size, i.color)}</span></span>
              <span className="shrink-0">{money(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t bg-slate-50 px-5 py-3 font-bold">
          <span>{o.payment_method === "cod" && due > 0 ? "Amount to collect" : "Order total"}</span>
          <span>{money(o.payment_method === "cod" ? due : o.total)}</span>
        </div>
      </div>

      {!closed && (
        <div className="card space-y-3 p-5">
          <p className="font-semibold">Update delivery status</p>
          {d.status === "assigned" && (
            <button disabled={busy} onClick={() => update("out_for_delivery")} className="btn-primary w-full py-3">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Picked up — start delivery
            </button>
          )}
          {d.status === "picked_up" && (
            <button disabled={busy} onClick={() => update("out_for_delivery")} className="btn-primary w-full py-3"><Truck className="h-4 w-4" /> Out for delivery</button>
          )}

          {mode === null && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode("deliver")} className="btn-success py-3"><CheckCircle2 className="h-4 w-4" /> Delivered</button>
              <button onClick={() => setMode("fail")} className="btn-danger py-3"><XCircle className="h-4 w-4" /> Failed</button>
            </div>
          )}

          {mode === "deliver" && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div>
                <label className="label">Cash collected</label>
                <input type="number" min={0} step="0.01" className="input" value={cash} onChange={(e) => setCash(e.target.value)} />
                <p className="mt-1 text-xs text-slate-500">Due: {money(due)}. Enter 0 if paid already / on credit.</p>
              </div>
              <input className="input" placeholder="Note (optional) — e.g. received by shop owner" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode(null)} className="btn-secondary">Back</button>
                <button disabled={busy} onClick={() => update("delivered")} className="btn-success">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm delivered</button>
              </div>
            </div>
          )}

          {mode === "fail" && (
            <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <label className="label">Reason *</label>
              <select className="input" value={note} onChange={(e) => setNote(e.target.value)}>
                <option value="">Select reason…</option>
                <option>Customer not reachable</option>
                <option>Shop closed</option>
                <option>Customer refused order</option>
                <option>Wrong address</option>
                <option>Payment not available</option>
                <option>Vehicle issue</option>
              </select>
              <input className="input" placeholder="Or type another reason" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode(null)} className="btn-secondary">Back</button>
                <button disabled={busy} onClick={() => update("failed")} className="btn-danger">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm failed</button>
              </div>
            </div>
          )}
        </div>
      )}

      {closed && (
        <div className="card flex items-center gap-3 p-5 text-sm">
          <PackageOpen className="h-5 w-5 text-slate-400" />
          <div>
            <p className="font-semibold">Delivery closed {fmtDate(d.completed_at)}</p>
            {d.failure_reason && <p className="text-rose-600">Reason: {d.failure_reason}</p>}
            {Number(d.cash_collected) > 0 && <p>Cash collected: {money(d.cash_collected)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
