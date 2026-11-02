"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Wallet } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PageHeader, StatCard, Empty } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Order, Payment } from "@/lib/types";
import { fmtDate, money } from "@/lib/utils";

export default function AdminPayments() {
  const supabase = supabaseBrowser();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [due, setDue] = useState<Order[]>([]);
  const [tab, setTab] = useState<"received" | "due">("received");

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([
      supabase.from("payments").select("*, order:orders(id,order_number,customer_name)").order("created_at", { ascending: false }).limit(500),
      supabase.from("orders").select("*, payments(amount)").in("payment_status", ["unpaid", "partial"]).not("status", "in", "(cancelled,returned)").order("created_at", { ascending: false }).limit(500),
    ]);
    setPayments((p.data as unknown as Payment[]) || []);
    setDue((d.data as unknown as Order[]) || []);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const received = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = due.reduce((s, o) => {
    const paid = ((o as unknown as { payments: { amount: number }[] }).payments || []).reduce((a, p) => a + Number(p.amount), 0);
    return s + Number(o.total) - paid;
  }, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Record payments from the order page; cash collected by riders is added automatically." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Payments received (latest 500)" value={money(received)} icon={Wallet} tone="emerald" />
        <StatCard label="Outstanding receivables" value={money(outstanding)} hint={`${due.length} orders`} icon={CreditCard} tone="rose" />
      </div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("received")} className={tab === "received" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Received</button>
        <button onClick={() => setTab("due")} className={tab === "due" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Outstanding</button>
      </div>
      <div className="card overflow-x-auto">
        {tab === "received" ? (
          payments.length === 0 ? <Empty text="No payments recorded" /> : (
            <table className="table-x">
              <thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-slate-500">{fmtDate(p.created_at)}</td>
                    <td><Link href={`/admin/orders/${p.order_id}`} className="font-semibold text-brand-700">{p.order?.order_number}</Link></td>
                    <td>{p.order?.customer_name}</td>
                    <td className="capitalize">{p.method.replace("_", " ")}</td>
                    <td className="text-slate-500">{p.reference || p.notes || "—"}</td>
                    <td className="text-right font-semibold">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : due.length === 0 ? <Empty text="No outstanding payments" /> : (
          <table className="table-x">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {due.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-700">{o.order_number}</Link></td>
                  <td>{o.customer_name}<p className="text-xs text-slate-500">{o.customer_phone}</p></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><StatusBadge status={o.payment_status} /></td>
                  <td className="text-right font-semibold">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
