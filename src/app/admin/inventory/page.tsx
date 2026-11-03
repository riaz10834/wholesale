"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Search, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import { errMsg } from "@/lib/utils";

interface VariantStock {
  id: string;
  quantity: number;
  color: string | null;
  colorHex: string | null;
}

interface ProductStock {
  id: string;
  name: string;
  variants: VariantStock[];
  colors: { name: string; hex: string | null }[];
}

export default function AdminInventory() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<ProductStock[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,is_active,product_variants(id,is_active,color,color_hex,inventory(quantity))")
      .eq("is_active", true)
      .order("name");
    const list: ProductStock[] = ((data || []) as {
      id: string;
      name: string;
      product_variants: { id: string; is_active: boolean; color: string | null; color_hex: string | null; inventory: { quantity: number } | { quantity: number }[] | null }[] | null;
    }[])
      .map((product) => {
        const variants = (product.product_variants || [])
          .filter((variant) => variant.is_active && variant.inventory)
          .map((variant) => {
            const stock = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
            return { id: variant.id, quantity: Number(stock?.quantity || 0), color: variant.color, colorHex: variant.color_hex };
          });
        const colors = variants.reduce<{ name: string; hex: string | null }[]>((list, variant) => {
          if (!variant.color || list.some((color) => color.name === variant.color)) return list;
          list.push({ name: variant.color, hex: variant.colorHex });
          return list;
        }, []);
        return { id: product.id, name: product.name, variants, colors };
      })
      .filter((product) => product.variants.length > 0);
    setRows(list);
    setQty(Object.fromEntries(list.map((product) => [product.id, String(product.variants.reduce((sum, variant) => sum + variant.quantity, 0))])));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function total(product: ProductStock) {
    return product.variants.reduce((sum, variant) => sum + variant.quantity, 0);
  }

  async function save(product: ProductStock) {
    const next = Math.floor(Number(qty[product.id]));
    if (!(next >= 0)) return toast.error("Stock cannot be negative");
    const current = total(product);
    let delta = next - current;
    const updates = product.variants.map((variant) => ({ ...variant }));
    if (delta > 0) updates[0].quantity += delta;
    for (let i = updates.length - 1; i >= 0 && delta < 0; i -= 1) {
      const take = Math.min(updates[i].quantity, -delta);
      updates[i].quantity -= take;
      delta += take;
    }
    setBusy(product.id);
    const results = await Promise.all(
      updates.map((variant) => supabase.from("inventory").upsert({ variant_id: variant.id, quantity: variant.quantity }, { onConflict: "variant_id" }))
    );
    setBusy(null);
    const error = results.find((result) => result.error)?.error;
    if (error) return toast.error(errMsg(error));
    toast.success("Stock updated");
    load();
  }

  async function remove(product: ProductStock) {
    if (!confirm(`Remove ${product.name} from inventory?`)) return;
    setBusy(product.id);
    const { error } = await supabase.from("inventory").delete().in("variant_id", product.variants.map((variant) => variant.id));
    setBusy(null);
    if (error) return toast.error(errMsg(error));
    toast.success("Removed from inventory");
    load();
  }

  const term = q.trim().toLowerCase();
  const shown = rows.filter((product) => !term || product.name.toLowerCase().includes(term));

  return (
    <>
      <PageHeader title="Inventory" subtitle={`${rows.length} products in stock`} />
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
            <Empty text="No products in stock" />
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
                {shown.map((product) => {
                  const changed = qty[product.id] !== String(total(product));
                  return (
                    <tr key={product.id}>
                      <td>
                        <p className="font-medium">{product.name}</p>
                        {product.colors.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {product.colors.map((color) => (
                              <span key={color.name} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-slate-300" style={{ background: color.hex || "#cbd5e1" }} />
                                {color.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input w-28 py-1.5"
                          value={qty[product.id] ?? String(total(product))}
                          onChange={(e) => setQty((current) => ({ ...current, [product.id]: e.target.value }))}
                        />
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button disabled={!changed || busy === product.id} onClick={() => save(product)} className="btn-primary btn-sm">
                            {busy === product.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                          </button>
                          <button disabled={busy === product.id} onClick={() => remove(product)} className="btn-danger btn-sm">
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
