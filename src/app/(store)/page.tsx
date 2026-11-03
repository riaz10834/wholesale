import Link from "next/link";
import { ArrowRight, BadgePercent, MapPinned, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { supabasePublic } from "@/lib/supabase/server";
import { ProductCard } from "@/components/store/ProductCard";
import { PRODUCT_LIST_SELECT } from "@/lib/queries";
import type { Category, Product } from "@/lib/types";
import { STORE_NAME } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = supabasePublic();
  const [{ data: cats }, { data: featured }, { data: latest }] = await Promise.all([
    supabase.from("categories").select("id,name,slug,image_url").eq("is_active", true).order("sort_order").limit(12),
    supabase.from("products").select(PRODUCT_LIST_SELECT).eq("is_active", true).eq("is_featured", true).limit(8),
    supabase.from("products").select(PRODUCT_LIST_SELECT).eq("is_active", true).order("created_at", { ascending: false }).limit(8),
  ]);
  const categories = (cats as Category[]) || [];
  const featuredProducts = (featured as unknown as Product[]) || [];
  const latestProducts = (latest as unknown as Product[]) || [];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(51,125,255,.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(20,71,225,.35),transparent_50%)]" />
        <div className="container-x relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
              <BadgePercent className="h-3.5 w-3.5" /> Factory-direct wholesale prices
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Stock your shop <span className="bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">smarter</span>, delivered to your door.
            </h1>
            <p className="mt-5 max-w-lg text-base text-slate-300 sm:text-lg">
              {STORE_NAME} is the B2B marketplace for retailers. Order in bulk, pay on delivery and track your rider live on the map.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary px-6 py-3 text-base">
                Browse catalog <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/signup" className="btn border border-white/20 px-6 py-3 text-base text-white hover:bg-white/10">
                Open business account
              </Link>
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-4 md:grid">
            {[
              { icon: PackageCheck, t: "Bulk pricing", d: "Tiered wholesale rates with clear minimum order quantities." },
              { icon: Truck, t: "Fast delivery", d: "Our own fleet delivers directly to your shop." },
              { icon: MapPinned, t: "Live tracking", d: "Watch your delivery rider approach in real time." },
              { icon: ShieldCheck, t: "Cash on delivery", d: "Pay when goods arrive. No surprises." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <f.icon className="h-6 w-6 text-brand-300" />
                <p className="mt-3 font-semibold">{f.t}</p>
                <p className="mt-1 text-sm text-slate-400">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container-x mt-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Shop by category</h2>
              <p className="mt-1 text-sm text-slate-500">Everything your store needs, in bulk.</p>
            </div>
            <Link href="/products" className="text-sm font-semibold text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="group flex w-32 shrink-0 flex-col items-center rounded-2xl border border-slate-200/70 bg-white p-4 text-center shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 sm:w-auto"
              >
                <div className="h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl font-extrabold text-brand-600">{c.name.charAt(0)}</div>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-brand-700">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featuredProducts.length > 0 && (
        <section className="container-x mt-14">
          <h2 className="text-2xl font-bold tracking-tight">Featured deals</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {featuredProducts.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      <section className="container-x mt-14">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">New arrivals</h2>
          <Link href="/products" className="text-sm font-semibold text-brand-600 hover:underline">See catalog</Link>
        </div>
        {latestProducts.length === 0 ? (
          <div className="card mt-6 p-10 text-center text-slate-500">
            No products yet. Sign in as admin and add products from the dashboard.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {latestProducts.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      <section className="container-x mt-16">
        <div className="grid gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-900 p-8 text-white sm:p-12 md:grid-cols-3">
          {[
            ["1", "Pick products", "Choose sizes, colours and quantities at wholesale rates."],
            ["2", "Pin your shop", "Set your exact shop location on the map at checkout."],
            ["3", "Track & receive", "Follow your rider live and pay on delivery."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg font-bold">{n}</span>
              <p className="mt-4 text-lg font-semibold">{t}</p>
              <p className="mt-1 text-sm text-brand-100">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
