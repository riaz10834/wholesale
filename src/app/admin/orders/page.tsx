"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ALL_ORDER_STATUSES, STATUS_LABEL, cn, fmtDate, money } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

type Row = Order & { deliveries: { delivery_person: { full_name: string } | null }[] | { delivery_person: { full_name: string } | null } | null };

export default function AdminOrders() {
  const supabase = supabaseBrowser();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from("orders")
      .select("*, deliveries(delivery_person:profiles(full_name))")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") query = query.eq("status", status);
    const term = q.trim().replace(/[%,()]/g, "");
    if (term) query = query.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,shop_name.ilike.%${term}%`);
    const { data } = await query;
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }, [supabase, status, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const rider = (r: Row) => {
    const d = Array.isArray(r.deliveries) ? r.deliveries[0] : r.deliveries;
    return d?.delivery_person?.full_name;
  };

  return (
    <>
      <PageHeader title="Orders" subtitle="Confirm, prepare, and dispatch orders" />
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search order #, customer, phone, shop…" />
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {(["all", ...ALL_ORDER_STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold", status === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <Empty text="No orders match your filters" />
          ) : (
            <table className="table-x">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Payment</th><th>Rider</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.order_number}</Link></td>
                    <td>
                      <p className="font-medium">{o.customer_name}</p>
                      <p className="text-xs text-slate-500">{o.customer_phone}{o.shop_name ? ` · ${o.shop_name}` : ""}</p>
                    </td>
                    <td className="whitespace-nowrap text-slate-500">{fmtDate(o.created_at)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.payment_status} /></td>
                    <td className="text-slate-600">{rider(o) || <span className="text-slate-400">—</span>}</td>
                    <td className="text-right font-semibold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
