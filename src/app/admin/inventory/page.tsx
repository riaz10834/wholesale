"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import { cn, errMsg, variantLabel } from "@/lib/utils";

interface Row {
  variant_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
  variant: { sku: string | null; size: string | null; color: string | null; product: { name: string } | null } | null;
}

export default function AdminInventory() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, { quantity?: string; adjust?: string; low?: string }>>({});
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("inventory")
      .select("variant_id,quantity,low_stock_threshold,updated_at,variant:product_variants(sku,size,color,product:products(name))")
      .order("quantity")
      .limit(2000);
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(r: Row) {
    const e = edits[r.variant_id] || {};
    let qty = e.quantity !== undefined && e.quantity !== "" ? Math.floor(Number(e.quantity)) : r.quantity;
    if (e.adjust) qty += Math.floor(Number(e.adjust));
    const low = e.low !== undefined && e.low !== "" ? Math.floor(Number(e.low)) : r.low_stock_threshold;
    if (!(qty >= 0) || !(low >= 0)) return toast.error("Stock cannot be negative");
    setSaving(r.variant_id);
    const { error } = await supabase.from("inventory").update({ quantity: qty, low_stock_threshold: low }).eq("variant_id", r.variant_id);
    setSaving(null);
    if (error) return toast.error(errMsg(error));
    setEdits((x) => {
      const n = { ...x };
      delete n[r.variant_id];
      return n;
    });
    toast.success("Stock updated");
    load();
  }

  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (filter === "low" && !(r.quantity > 0 && r.quantity <= r.low_stock_threshold)) return false;
    if (filter === "out" && r.quantity > 0) return false;
    if (term && !`${r.variant?.product?.name} ${r.variant?.sku} ${r.variant?.size} ${r.variant?.color}`.toLowerCase().includes(term)) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Inventory" subtitle="Set stock levels or add/remove stock with adjustments" />
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search product, SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1.5">
            {(["all", "low", "out"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")}>
                {f === "all" ? "All" : f === "low" ? "Low stock" : "Out of stock"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : shown.length === 0 ? (
            <Empty text="No inventory items" />
          ) : (
            <table className="table-x">
              <thead><tr><th>Product</th><th>SKU</th><th>In stock</th><th>Set quantity</th><th>Adjust (+/−)</th><th>Low alert at</th><th /></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const e = edits[r.variant_id] || {};
                  const setE = (k: "quantity" | "adjust" | "low", v: string) => setEdits((x) => ({ ...x, [r.variant_id]: { ...x[r.variant_id], [k]: v } }));
                  return (
                    <tr key={r.variant_id}>
                      <td><p className="font-medium">{r.variant?.product?.name}</p><p className="text-xs text-slate-500">{variantLabel(r.variant?.size, r.variant?.color) || "Standard"}</p></td>
                      <td className="text-slate-500">{r.variant?.sku || "—"}</td>
                      <td>
                        <span className={cn("font-bold", r.quantity === 0 ? "text-rose-600" : r.quantity <= r.low_stock_threshold ? "text-amber-600" : "text-emerald-700")}>{r.quantity}</span>
                      </td>
                      <td><input type="number" min={0} className="input w-24 py-1.5" placeholder={String(r.quantity)} value={e.quantity ?? ""} onChange={(ev) => setE("quantity", ev.target.value)} /></td>
                      <td><input type="number" className="input w-24 py-1.5" placeholder="+50" value={e.adjust ?? ""} onChange={(ev) => setE("adjust", ev.target.value)} /></td>
                      <td><input type="number" min={0} className="input w-20 py-1.5" placeholder={String(r.low_stock_threshold)} value={e.low ?? ""} onChange={(ev) => setE("low", ev.target.value)} /></td>
                      <td>
                        <button disabled={!edits[r.variant_id] || saving === r.variant_id} onClick={() => save(r)} className="btn-primary btn-sm">
                          {saving === r.variant_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
