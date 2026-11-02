"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import { PRODUCT_CARD_SELECT } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { errMsg, money } from "@/lib/utils";

export default function AdminProducts() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase.from("products").select(PRODUCT_CARD_SELECT).order("created_at", { ascending: false }).limit(500);
    const term = q.trim().replace(/[%,()]/g, "");
    if (term) query = query.ilike("name", `%${term}%`);
    const { data } = await query;
    setRows((data as unknown as Product[]) || []);
    setLoading(false);
  }, [supabase, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function toggle(p: Product) {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(errMsg(error));
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Product deleted");
    load();
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${rows.length} products`}
        actions={<Link href="/admin/products/new" className="btn-primary"><Plus className="h-4 w-4" /> Add product</Link>}
      />
      <div className="card overflow-hidden">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : rows.length === 0 ? (
            <Empty text="No products yet. Click “Add product” to create your first one." />
          ) : (
            <table className="table-x">
              <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>MOQ</th><th>Variants</th><th>Stock</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const stock = (p.product_variants || []).reduce((s, v) => s + (v.inventory?.quantity || 0), 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {p.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-slate-300"><ImageOff className="h-4 w-4" /></div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            {p.is_featured && <span className="text-[11px] font-semibold text-amber-600">★ Featured</span>}
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600">{p.category?.name || "—"}</td>
                      <td><p className="font-semibold">{money(p.wholesale_price)}</p><p className="text-xs text-slate-400">cost {money(p.cost_price)}</p></td>
                      <td>{p.min_order_qty}</td>
                      <td>{p.product_variants?.length || 0}</td>
                      <td className={stock === 0 ? "font-semibold text-rose-600" : ""}>{stock}</td>
                      <td>
                        <button onClick={() => toggle(p)} className={`badge ${p.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                          {p.is_active ? "Active" : "Hidden"}
                        </button>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/products/${p.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></Link>
                          <button onClick={() => remove(p)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
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
