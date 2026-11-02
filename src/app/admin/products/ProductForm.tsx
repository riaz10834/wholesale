"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import type { Category, Product } from "@/lib/types";
import { errMsg, slugify } from "@/lib/utils";

interface VariantRow {
  id?: string;
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  price: string;
  cost_price: string;
  quantity: string;
  is_active: boolean;
}

const emptyVariant = (): VariantRow => ({ size: "", color: "", color_hex: "#000000", sku: "", price: "", cost_price: "", quantity: "0", is_active: true });

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    category_id: product?.category_id || "",
    unit: product?.unit || "pcs",
    wholesale_price: product ? String(product.wholesale_price) : "",
    retail_price: product?.retail_price != null ? String(product.retail_price) : "",
    cost_price: product ? String(product.cost_price) : "",
    min_order_qty: product ? String(product.min_order_qty) : "1",
    is_featured: product?.is_featured || false,
    is_active: product?.is_active ?? true,
  });
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.product_variants?.length
      ? product.product_variants.map((v) => ({
          id: v.id,
          size: v.size || "",
          color: v.color || "",
          color_hex: v.color_hex || "#000000",
          sku: v.sku || "",
          price: v.price != null ? String(v.price) : "",
          cost_price: v.cost_price != null ? String(v.cost_price) : "",
          quantity: String(v.inventory?.quantity ?? 0),
          is_active: v.is_active,
        }))
      : [emptyVariant()]
  );
  const [removedVariants, setRemovedVariants] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order").then(({ data }) => setCats((data as Category[]) || []));
  }, [supabase]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const setV = (i: number, k: keyof VariantRow, val: string | boolean) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, [k]: val } : v)));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 5MB`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) {
        toast.error(errMsg(error));
        continue;
      }
      urls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
    }
    setImages((im) => [...im, ...urls]);
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(f.wholesale_price);
    const moq = Math.floor(Number(f.min_order_qty));
    if (f.name.trim().length < 2) return toast.error("Product name is required");
    if (!(price >= 0) || f.wholesale_price === "") return toast.error("Valid wholesale price is required");
    if (!(moq >= 1)) return toast.error("Minimum order quantity must be at least 1");
    if (variants.length === 0) return toast.error("Add at least one variant");
    for (const v of variants) {
      if (!(Number(v.quantity) >= 0)) return toast.error("Stock quantity cannot be negative");
    }

    setSaving(true);
    const payload = {
      name: f.name.trim(),
      slug: slugify(f.slug || f.name) || `product-${Date.now()}`,
      description: f.description.trim() || null,
      category_id: f.category_id || null,
      unit: f.unit.trim() || "pcs",
      wholesale_price: price,
      retail_price: f.retail_price ? Number(f.retail_price) : null,
      cost_price: f.cost_price ? Number(f.cost_price) : 0,
      min_order_qty: moq,
      images,
      is_featured: f.is_featured,
      is_active: f.is_active,
    };

    try {
      let productId = product?.id;
      if (productId) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      if (removedVariants.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", removedVariants);
        if (error) throw error;
      }

      for (const v of variants) {
        const vp = {
          product_id: productId,
          size: v.size.trim() || null,
          color: v.color.trim() || null,
          color_hex: v.color.trim() ? v.color_hex : null,
          sku: v.sku.trim() || null,
          price: v.price ? Number(v.price) : null,
          cost_price: v.cost_price ? Number(v.cost_price) : null,
          is_active: v.is_active,
        };
        let vid = v.id;
        if (vid) {
          const { error } = await supabase.from("product_variants").update(vp).eq("id", vid);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("product_variants").insert(vp).select("id").single();
          if (error) throw error;
          vid = data.id;
        }
        const { error: invErr } = await supabase
          .from("inventory")
          .upsert({ variant_id: vid, quantity: Math.floor(Number(v.quantity) || 0) }, { onConflict: "variant_id" });
        if (invErr) throw invErr;
      }
      toast.success("Product saved");
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      const msg = errMsg(err);
      toast.error(msg.includes("duplicate key") ? "Slug or SKU already exists — use a unique value" : msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Basic information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Product name *</label>
              <input className="input" value={f.name} onChange={set("name")} required maxLength={200} />
            </div>
            <div>
              <label className="label">URL slug</label>
              <input className="input" value={f.slug} onChange={set("slug")} placeholder={slugify(f.name) || "auto"} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={f.category_id} onChange={set("category_id")}>
                <option value="">Uncategorised</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-28" value={f.description} onChange={set("description")} maxLength={5000} />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-bold">Images</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {images.map((src, i) => (
              <div key={src} className="group relative aspect-square overflow-hidden rounded-xl border bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 text-[10px] text-white">Cover</span>}
                <button type="button" onClick={() => setImages((im) => im.filter((x) => x !== src))} className="absolute right-1 top-1 rounded-full bg-white p-1 shadow">
                  <X className="h-3 w-3" />
                </button>
                {i > 0 && (
                  <button type="button" onClick={() => setImages((im) => [src, ...im.filter((x) => x !== src)])} className="absolute bottom-1 left-1 hidden rounded bg-white px-1.5 text-[10px] font-semibold shadow group-hover:block">
                    Make cover
                  </button>
                )}
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              Upload
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} disabled={uploading} />
            </label>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Variants & stock</h2>
              <p className="text-xs text-slate-500">Size / colour combinations. Leave price empty to use the product wholesale price.</p>
            </div>
            <button type="button" onClick={() => setVariants((v) => [...v, emptyVariant()])} className="btn-secondary btn-sm"><Plus className="h-3.5 w-3.5" /> Add variant</button>
          </div>
          <div className="mt-4 space-y-3">
            {variants.map((v, i) => (
              <div key={v.id || i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-4 lg:grid-cols-8">
                <input className="input" placeholder="Size" value={v.size} onChange={(e) => setV(i, "size", e.target.value)} />
                <input className="input" placeholder="Colour" value={v.color} onChange={(e) => setV(i, "color", e.target.value)} />
                <input type="color" className="input h-[42px] p-1" value={v.color_hex} onChange={(e) => setV(i, "color_hex", e.target.value)} title="Colour swatch" />
                <input className="input" placeholder="SKU" value={v.sku} onChange={(e) => setV(i, "sku", e.target.value)} />
                <input className="input" type="number" step="0.01" min="0" placeholder="Price" value={v.price} onChange={(e) => setV(i, "price", e.target.value)} />
                <input className="input" type="number" step="0.01" min="0" placeholder="Cost" value={v.cost_price} onChange={(e) => setV(i, "cost_price", e.target.value)} />
                <input className="input" type="number" min="0" placeholder="Stock" value={v.quantity} onChange={(e) => setV(i, "quantity", e.target.value)} title="Stock quantity" />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={v.is_active} onChange={(e) => setV(i, "is_active", e.target.checked)} className="accent-brand-600" /> Active
                  </label>
                  <button
                    type="button"
                    disabled={variants.length === 1}
                    onClick={() => {
                      if (v.id) setRemovedVariants((r) => [...r, v.id!]);
                      setVariants((vs) => vs.filter((_, idx) => idx !== i));
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Pricing</h2>
          <div>
            <label className="label">Wholesale price *</label>
            <input className="input" type="number" step="0.01" min="0" value={f.wholesale_price} onChange={set("wholesale_price")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Retail / MRP</label>
              <input className="input" type="number" step="0.01" min="0" value={f.retail_price} onChange={set("retail_price")} />
            </div>
            <div>
              <label className="label">Cost price</label>
              <input className="input" type="number" step="0.01" min="0" value={f.cost_price} onChange={set("cost_price")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Min. order qty *</label>
              <input className="input" type="number" min="1" value={f.min_order_qty} onChange={set("min_order_qty")} required />
            </div>
            <div>
              <label className="label">Unit</label>
              <input className="input" value={f.unit} onChange={set("unit")} placeholder="pcs, box, kg…" />
            </div>
          </div>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Visibility</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={set("is_active")} className="accent-brand-600" /> Active (visible in store)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_featured} onChange={set("is_featured")} className="accent-brand-600" /> Featured on homepage</label>
        </section>
        <button disabled={saving || uploading} className="btn-primary w-full py-3">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save product
        </button>
      </div>
    </form>
  );
}
