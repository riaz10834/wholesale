"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Search, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import { errMsg, variantLabel } from "@/lib/utils";

interface Row {
  variant_id: string;
  quantity: number;
  variant: { size: string | null; color: string | null; product: { name: string } | null } | null;
}

export default function AdminInventory() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("inventory")
      .select("variant_id,quantity,variant:product_variants(size,color,product:products(name))")
      .order("quantity")
      .limit(2000);
    const list = (data as unknown as Row[]) || [];
    setRows(list);
    setQty(Object.fromEntries(list.map((r) => [r.variant_id, String(r.quantity)])));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function label(r: Row) {
    const name = r.variant?.product?.name || "This item";
    const variant = variantLabel(r.variant?.size, r.variant?.color);
    return variant ? `${name} (${variant})` : name;
  }

  async function save(r: Row) {
    const next = Math.floor(Number(qty[r.variant_id]));
    if (!(next >= 0)) return toast.error("Stock cannot be negative");
    setBusy(r.variant_id);
    const { error } = await supabase.from("inventory").update({ quantity: next }).eq("variant_id", r.variant_id);
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success("Stock updated");
    load();
  }

  async function remove(r: Row) {
    const name = label(r);
    if (!confirm(`Remove ${name} from inventory? This only deletes the stock row.`)) return;
    setBusy(r.variant_id);
    const { error } = await supabase.from("inventory").delete().eq("variant_id", r.variant_id);
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success("Removed from inventory");
    load();
  }

  const term = q.trim().toLowerCase();
  const shown = rows.filter((r) => !term || label(r).toLowerCase().includes(term));

  return (
    <>
      <PageHeader title="Inventory" subtitle="The stock you have on hand" />
      <div className="card overflow-hidden">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search product…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : shown.length === 0 ? (
            <Empty text="No stock yet" />
          ) : (
            <table className="table-x">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>In stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const changed = qty[r.variant_id] !== String(r.quantity);
                  return (
                    <tr key={r.variant_id}>
                      <td>
                        <p className="font-medium">{r.variant?.product?.name}</p>
                        <p className="text-xs text-slate-500">{variantLabel(r.variant?.size, r.variant?.color) || "Standard"}</p>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input w-28 py-1.5"
                          value={qty[r.variant_id] ?? String(r.quantity)}
                          onChange={(e) => setQty((current) => ({ ...current, [r.variant_id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button disabled={!changed || busy === r.variant_id} onClick={() => save(r)} className="btn-primary btn-sm">
                            {busy === r.variant_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                          </button>
                          <button disabled={busy === r.variant_id} onClick={() => remove(r)} className="btn-danger btn-sm">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
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
