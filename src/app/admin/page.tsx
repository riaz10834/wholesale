import Link from "next/link";
import { AlertTriangle, Banknote, Clock, ShoppingBag, TrendingUp, Truck, Users } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate, isLive, money } from "@/lib/utils";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = supabaseServer();
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersRes, recentRes, customersRes, couriersRes, lowStockRes, expensesRes] = await Promise.all([
    supabase.from("orders").select("id,total,total_cost,status,created_at").gte("created_at", since.toISOString()),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id,is_online,last_location_at").eq("role", "delivery").eq("is_active", true),
    supabase.from("inventory").select("quantity,low_stock_threshold,variant:product_variants(id,size,color,is_active,product:products(name,is_active))").order("quantity").limit(500),
    supabase.from("expenses").select("amount").gte("expense_date", since.toISOString().slice(0, 10)),
  ]);

  const orders = (ordersRes.data || []) as Pick<Order, "id" | "total" | "total_cost" | "status" | "created_at">[];
  const valid = orders.filter((o) => !["cancelled", "returned", "failed"].includes(o.status));
  const delivered = orders.filter((o) => o.status === "delivered");
  const sales = valid.reduce((s, o) => s + Number(o.total), 0);
  const grossProfit = delivered.reduce((s, o) => s + Number(o.total) - Number(o.total_cost), 0);
  const expenses = (expensesRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
  const todayOrders = orders.filter((o) => new Date(o.created_at) >= today);
  const pending = orders.filter((o) => o.status === "pending").length;
  const couriers = couriersRes.data || [];
  const online = couriers.filter((c) => isLive(c.is_online, c.last_location_at)).length;
  type LowRow = {
    quantity: number;
    low_stock_threshold: number;
    variant: { id: string; size: string | null; color: string | null; is_active: boolean; product: { name: string; is_active: boolean } | { name: string; is_active: boolean }[] | null } | null;
  };
  const lowStock = ((lowStockRes.data || []) as unknown as LowRow[])
    .map((r) => {
      const product = Array.isArray(r.variant?.product) ? r.variant?.product[0] : r.variant?.product;
      return {
        id: r.variant?.id || "",
        name: product?.name || "Unknown product",
        active: product?.is_active !== false && r.variant?.is_active !== false,
        label: [r.variant?.size, r.variant?.color].filter(Boolean).join(" / "),
        quantity: Number(r.quantity),
        threshold: Number(r.low_stock_threshold),
      };
    })
    .filter((r) => r.active && r.id && r.quantity <= r.threshold)
    .sort((a, b) => a.quantity - b.quantity);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const series = days.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    return {
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      value: valid.filter((o) => new Date(o.created_at) >= d && new Date(o.created_at) < next).reduce((s, o) => s + Number(o.total), 0),
    };
  });
  const max = Math.max(...series.map((s) => s.value), 1);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Last 30 days overview" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={money(sales)} hint={`${valid.length} orders`} icon={Banknote} />
        <StatCard label="Net profit" value={money(grossProfit - expenses)} hint={`Gross ${money(grossProfit)} − expenses ${money(expenses)}`} icon={TrendingUp} tone="emerald" />
        <StatCard label="Today's orders" value={todayOrders.length} hint={`${pending} pending confirmation`} icon={ShoppingBag} tone="amber" />
        <StatCard label="Riders online" value={`${online} / ${couriers.length}`} hint={`${customersRes.count || 0} customers`} icon={Truck} tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <h2 className="font-bold">Sales — last 30 days</h2>
          <div className="mt-6 overflow-x-auto">
            <div className="flex h-48 min-w-[40rem] items-end gap-1">
              {series.map((s, i) => (
                <div key={s.label} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition group-hover:from-brand-700" style={{ height: `${Math.max(2, (s.value / max) * 100)}%` }} />
                    <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{money(s.value)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{i % 5 === 0 || i === series.length - 1 ? s.label.split(" ")[0] : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock</h2>
            <Link href="/admin/inventory" className="text-xs font-semibold text-brand-600">Manage</Link>
          </div>
          <ul className="no-scrollbar mt-4 max-h-56 space-y-2 overflow-y-auto">
            {lowStockRes.error && <li className="text-sm text-rose-600">Could not load stock. Open Inventory to check.</li>}
            {!lowStockRes.error && lowStock.length === 0 && <li className="text-sm text-slate-500">No low stock. Items appear here only when quantity is at or below their alert level.</li>}
            {lowStock.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-slate-500">{r.label || "Standard"} · alert at {r.threshold}</span>
                </span>
                <span className={`shrink-0 font-semibold ${r.quantity === 0 ? "text-rose-600" : "text-amber-600"}`}>{r.quantity} left</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold"><Clock className="h-4 w-4" /> Recent orders</h2>
          <Link href="/admin/orders" className="text-xs font-semibold text-brand-600">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {((recentRes.data || []) as Order[]).map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.order_number}</Link></td>
                  <td><p className="font-medium">{o.customer_name}</p><p className="text-xs text-slate-500">{o.shop_name}</p></td>
                  <td className="whitespace-nowrap text-slate-500">{fmtDate(o.created_at)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right font-semibold">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(recentRes.data || []).length === 0 && <p className="p-8 text-center text-sm text-slate-500"><Users className="mx-auto mb-2 h-6 w-6" />No orders yet</p>}
        </div>
      </section>
    </>
  );
}
