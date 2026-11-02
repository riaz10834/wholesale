"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, MapPin, Navigation, Phone, PackageCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { ShiftCard } from "@/components/delivery/ShiftCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Delivery } from "@/lib/types";
import { cn, fmtDate, mapsNavUrl, money } from "@/lib/utils";

export default function DeliveryHome() {
  const supabase = supabaseBrowser();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    let q = supabase
      .from("deliveries")
      .select("*, order:orders(id,order_number,customer_name,customer_phone,shop_name,address,lat,lng,total,status,payment_status,payment_method,created_at)")
      .order("assigned_at", { ascending: false })
      .limit(100);
    if (profile?.role === "delivery") q = q.eq("delivery_person_id", user.id);
    q = tab === "active" ? q.in("status", ["assigned", "picked_up", "out_for_delivery"]) : q.in("status", ["delivered", "failed", "cancelled"]);
    const { data } = await q;
    setRows((data as unknown as Delivery[]) || []);
    setLoading(false);
  }, [supabase, user, profile?.role, tab]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`rider-deliveries-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `delivery_person_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, supabase, user]);

  return (
    <div className="space-y-5">
      {profile?.role === "delivery" && <ShiftCard />}

      <div className="flex gap-2">
        {(["active", "done"] as const).map((t) => (
          <button key={t} onClick={() => { setLoading(true); setTab(t); }} className={cn("rounded-xl px-4 py-2 text-sm font-semibold", tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>
            {t === "active" ? "Assigned to me" : "Completed"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 font-semibold">{tab === "active" ? "No deliveries assigned" : "No completed deliveries yet"}</p>
          <p className="text-sm text-slate-500">New assignments appear here automatically.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.id} className="card overflow-hidden">
              <Link href={`/delivery/orders/${d.id}`} className="block p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{d.order?.order_number}</p>
                  <StatusBadge status={d.status} />
                </div>
                <p className="mt-1 font-medium">{d.order?.customer_name}{d.order?.shop_name ? ` · ${d.order.shop_name}` : ""}</p>
                <p className="mt-0.5 flex gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span className="line-clamp-2">{d.order?.address}</span></p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{fmtDate(d.assigned_at)}</span>
                  <span className="flex items-center gap-1 font-bold">
                    {d.order?.payment_status !== "paid" && d.order?.payment_method === "cod" ? `Collect ${money(d.order?.total)}` : money(d.order?.total)}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </span>
                </div>
              </Link>
              {tab === "active" && d.order && (
                <div className="grid grid-cols-2 border-t">
                  <a href={`tel:${d.order.customer_phone}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-brand-700 hover:bg-slate-50"><Phone className="h-4 w-4" /> Call</a>
                  <a href={mapsNavUrl(d.order.lat, d.order.lng)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-l py-3 text-sm font-semibold text-brand-700 hover:bg-slate-50"><Navigation className="h-4 w-4" /> Navigate</a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
