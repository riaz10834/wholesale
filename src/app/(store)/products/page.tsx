import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { ProductCard } from "@/components/store/ProductCard";
import { PRODUCT_LIST_SELECT } from "@/lib/queries";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalog" };

const SORTS = {
  new: { col: "created_at", asc: false, label: "Newest" },
  price_asc: { col: "wholesale_price", asc: true, label: "Price: low to high" },
  price_desc: { col: "wholesale_price", asc: false, label: "Price: high to low" },
  name: { col: "name", asc: true, label: "Name" },
} as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sort?: string; page?: string };
}) {
  const supabase = supabasePublic();
  const q = (searchParams.q || "").trim().slice(0, 80);
  const sortKey = (searchParams.sort as keyof typeof SORTS) in SORTS ? (searchParams.sort as keyof typeof SORTS) : "new";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 24;

  const { data: cats } = await supabase.from("categories").select("id,name,slug,image_url").eq("is_active", true).order("sort_order");
  const categories = (cats as Category[]) || [];
  const active = categories.find((c) => c.slug === searchParams.category);

  let query = supabase.from("products").select(PRODUCT_LIST_SELECT, { count: "exact" }).eq("is_active", true);
  if (active) query = query.eq("category_id", active.id);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,description.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const s = SORTS[sortKey];
  const { data, count } = await query.order(s.col, { ascending: s.asc }).range((page - 1) * perPage, page * perPage - 1);
  const products = (data as unknown as Product[]) || [];
  const pages = Math.ceil((count || 0) / perPage);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, category: active?.slug, sort: sortKey !== "new" ? sortKey : undefined, ...over };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const str = p.toString();
    return `/products${str ? `?${str}` : ""}`;
  };

  return (
    <div className="container-x py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{active ? active.name : q ? `Results for “${q}”` : "All products"}</h1>
          <p className="mt-1 text-sm text-slate-500">{count || 0} products</p>
        </div>
        <form className="flex gap-2" action="/products">
          {q && <input type="hidden" name="q" value={q} />}
          {active && <input type="hidden" name="category" value={active.slug} />}
          <select name="sort" defaultValue={sortKey} className="input w-auto">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button className="btn-secondary">Sort</button>
        </form>
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <Link href={qs({ category: undefined, page: undefined })} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1", !active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}>
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={qs({ category: c.slug, page: undefined })}
            className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1", active?.id === c.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="card mt-8 p-12 text-center">
          <p className="font-semibold">No products found</p>
          <p className="mt-1 text-sm text-slate-500">Try a different search or category.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-10 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={qs({ page: n === 1 ? undefined : String(n) })} className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold", n === page ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-50")}>
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
