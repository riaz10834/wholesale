"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { STATUS_LABEL, money } from "@/lib/utils";
import type { Expense, OrderStatus } from "@/lib/types";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  status: OrderStatus;
  total: number;
  total_cost: number;
  customer_name: string;
  order_items: { product_name: string; quantity: number; line_total: number; unit_cost: number }[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Reports() {
  const supabase = supabaseBrowser();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return iso(d);
  });
  const [to, setTo] = useState(() => iso(new Date()));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const end = new Date(to);
    end.setDate(end.getDate() + 1);
    const [o, e] = await Promise.all([
      supabase
        .from("orders")
        .select("id,order_number,created_at,status,total,total_cost,customer_name,order_items(product_name,quantity,line_total,unit_cost)")
        .gte("created_at", new Date(from).toISOString())
        .lt("created_at", end.toISOString())
        .limit(5000),
      supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to).limit(5000),
    ]);
    setOrders((o.data as unknown as OrderRow[]) || []);
    setExpenses((e.data as Expense[]) || []);
    setLoading(false);
  }, [supabase, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const r = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
    const cogs = delivered.reduce((s, o) => s + Number(o.total_cost), 0);
    const exp = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const booked = orders.filter((o) => !["cancelled", "returned", "failed"].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);
    const byStatus: Record<string, number> = {};
    orders.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1));
    const products = new Map<string, { qty: number; revenue: number; profit: number }>();
    delivered.forEach((o) =>
      o.order_items.forEach((i) => {
        const p = products.get(i.product_name) || { qty: 0, revenue: 0, profit: 0 };
        p.qty += i.quantity;
        p.revenue += Number(i.line_total);
        p.profit += Number(i.line_total) - Number(i.unit_cost) * i.quantity;
        products.set(i.product_name, p);
      })
    );
    const expByCat = new Map<string, number>();
    expenses.forEach((e) => expByCat.set(e.category, (expByCat.get(e.category) || 0) + Number(e.amount)));
    const daily = new Map<string, { revenue: number; profit: number }>();
    delivered.forEach((o) => {
      const k = o.created_at.slice(0, 10);
      const d = daily.get(k) || { revenue: 0, profit: 0 };
      d.revenue += Number(o.total);
      d.profit += Number(o.total) - Number(o.total_cost);
      daily.set(k, d);
    });
    return {
      revenue, cogs, exp, booked, gross: revenue - cogs, net: revenue - cogs - exp, count: orders.length, deliveredCount: delivered.length, byStatus,
      topProducts: Array.from(products.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 15),
      expByCat: Array.from(expByCat.entries()).sort((a, b) => b[1] - a[1]),
      daily: Array.from(daily.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [orders, expenses]);

  function exportCsv() {
    const lines = [["Order", "Date", "Customer", "Status", "Total", "Cost", "Profit"].join(",")];
    orders.forEach((o) =>
      lines.push([o.order_number, o.created_at.slice(0, 10), `"${o.customer_name.replace(/"/g, '""')}"`, o.status, o.total, o.total_cost, (Number(o.total) - Number(o.total_cost)).toFixed(2)].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const maxDaily = Math.max(...r.daily.map((d) => d[1].revenue), 1);

  return (
    <>
      <PageHeader
        title="Sales & profit reports"
        subtitle="Revenue and profit are counted on delivered orders"
        actions={
          <>
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            <button onClick={exportCsv} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
          </>
        }
      />
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue (delivered)" value={money(r.revenue)} hint={`${r.deliveredCount} of ${r.count} orders`} />
            <StatCard label="Gross profit" value={money(r.gross)} hint={`COGS ${money(r.cogs)}`} tone="emerald" />
            <StatCard label="Expenses" value={money(r.exp)} tone="rose" />
            <StatCard label="Net profit" value={money(r.net)} hint={`Booked sales ${money(r.booked)}`} tone={r.net >= 0 ? "emerald" : "rose"} />
          </div>

          <section className="card mt-6 p-5">
            <h2 className="font-bold">Daily revenue</h2>
            {r.daily.length === 0 ? <p className="mt-4 text-sm text-slate-500">No delivered orders in this period.</p> : (
              <div className="mt-6 flex h-48 items-end gap-1 overflow-x-auto">
                {r.daily.map(([day, v]) => (
                  <div key={day} className="group flex min-w-6 flex-1 flex-col items-center gap-1">
                    <div className="relative flex w-full flex-1 items-end">
                      <div className="w-full rounded-t bg-brand-500" style={{ height: `${(v.revenue / maxDaily) * 100}%` }} />
                      <span className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                        {money(v.revenue)}<br />profit {money(v.profit)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{day.slice(8)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <section className="card overflow-x-auto xl:col-span-2">
              <h2 className="border-b px-5 py-4 font-bold">Top products</h2>
              <table className="table-x">
                <thead><tr><th>Product</th><th>Qty sold</th><th>Revenue</th><th className="text-right">Profit</th></tr></thead>
                <tbody>
                  {r.topProducts.map(([name, v]) => (
                    <tr key={name}><td className="font-medium">{name}</td><td>{v.qty}</td><td>{money(v.revenue)}</td><td className="text-right font-semibold text-emerald-700">{money(v.profit)}</td></tr>
                  ))}
                  {r.topProducts.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500">No data</td></tr>}
                </tbody>
              </table>
            </section>
            <div className="space-y-6">
              <section className="card p-5">
                <h2 className="font-bold">Orders by status</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(r.byStatus).map(([s, n]) => (
                    <li key={s} className="flex justify-between"><span>{STATUS_LABEL[s as OrderStatus]}</span><b>{n}</b></li>
                  ))}
                  {r.count === 0 && <li className="text-slate-500">No orders</li>}
                </ul>
              </section>
              <section className="card p-5">
                <h2 className="font-bold">Expenses by category</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {r.expByCat.map(([c, v]) => <li key={c} className="flex justify-between"><span>{c}</span><b>{money(v)}</b></li>)}
                  {r.expByCat.length === 0 && <li className="text-slate-500">No expenses</li>}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
