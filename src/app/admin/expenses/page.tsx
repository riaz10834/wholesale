"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import type { Expense } from "@/lib/types";
import { errMsg, fmtDate, money } from "@/lib/utils";

const CATEGORIES = ["Fuel", "Salaries", "Rent", "Utilities", "Packaging", "Vehicle maintenance", "Marketing", "Purchases", "Other"];

export default function AdminExpenses() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ category: "Fuel", amount: "", description: "", expense_date: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(1000);
    setRows((data as Expense[]) || []);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!(amount > 0)) return toast.error("Enter a valid amount");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({ ...f, amount, description: f.description.trim() || null, created_by: u.user?.id });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Expense added");
    setF({ ...f, amount: "", description: "" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(errMsg(error));
    load();
  }

  const month = new Date().toISOString().slice(0, 7);
  const monthTotal = rows.filter((r) => r.expense_date.startsWith(month)).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader title="Expenses" subtitle={`This month: ${money(monthTotal)}`} />
      <form onSubmit={add} className="card mb-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="input" type="number" step="0.01" min="0.01" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input className="input" type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
        <input className="input" placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} />
        <button disabled={saving} className="btn-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add expense</button>
      </form>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? <Empty text="No expenses recorded" /> : (
          <table className="table-x">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-slate-500">{fmtDate(r.expense_date, false)}</td>
                  <td><span className="badge bg-slate-100 text-slate-700 ring-slate-200">{r.category}</span></td>
                  <td>{r.description || "—"}</td>
                  <td className="text-right font-semibold">{money(r.amount)}</td>
                  <td className="text-right"><button onClick={() => remove(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
