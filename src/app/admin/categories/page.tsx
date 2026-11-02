"use client";
import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import type { Category } from "@/lib/types";
import { errMsg, slugify } from "@/lib/utils";

const blank = { id: "", name: "", slug: "", description: "", image_url: "", sort_order: "0", is_active: true };

export default function AdminCategories() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<(Category & { products: { count: number }[] })[]>([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*, products(count)").order("sort_order");
    setRows((data as never) || []);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    const path = `categories/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "")}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    setUploading(false);
    if (error) return toast.error(errMsg(error));
    setForm((f) => ({ ...f, image_url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: slugify(form.slug || form.name),
      description: form.description.trim() || null,
      image_url: form.image_url || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("categories").update(payload).eq("id", form.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);
    if (error) return toast.error(errMsg(error).includes("duplicate") ? "Slug already exists" : errMsg(error));
    toast.success("Category saved");
    setOpen(false);
    setForm(blank);
    load();
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}"? Products will become uncategorised.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(errMsg(error));
    load();
  }

  return (
    <>
      <PageHeader
        title="Categories"
        actions={<button onClick={() => { setForm(blank); setOpen(true); }} className="btn-primary"><Plus className="h-4 w-4" /> Add category</button>}
      />

      {open && (
        <form onSubmit={save} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between sm:col-span-2 lg:col-span-4">
            <h2 className="font-bold">{form.id ? "Edit category" : "New category"}</h2>
            <button type="button" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Slug</label><input className="input" value={form.slug} placeholder={slugify(form.name)} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div><label className="label">Sort order</label><input type="number" className="input" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
          <div>
            <label className="label">Image</label>
            <label className="btn-secondary w-full cursor-pointer">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {form.image_url ? "Change image" : "Upload"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3"><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-600" /> Active</label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button disabled={saving || uploading} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty text="No categories yet" />
        ) : (
          <table className="table-x">
            <thead><tr><th>Category</th><th>Slug</th><th>Products</th><th>Order</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-brand-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-brand-600">{c.name[0]}</div>}
                      </div>
                      <span className="font-semibold">{c.name}</span>
                    </div>
                  </td>
                  <td className="text-slate-500">{c.slug}</td>
                  <td>{c.products?.[0]?.count ?? 0}</td>
                  <td>{c.sort_order}</td>
                  <td><span className={`badge ${c.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{c.is_active ? "Active" : "Hidden"}</span></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setForm({ id: c.id, name: c.name, slug: c.slug, description: c.description || "", image_url: c.image_url || "", sort_order: String(c.sort_order), is_active: c.is_active });
                          setOpen(true);
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(c)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
