import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { supabasePublic } from "@/lib/supabase/server";
import { PRODUCT_CARD_SELECT } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { ProductDetail } from "./ProductDetail";
import { ProductCard } from "@/components/store/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = supabasePublic();
  const { data } = await supabase.from("products").select("name,description").eq("slug", params.slug).maybeSingle();
  return { title: data?.name || "Product", description: data?.description?.slice(0, 160) };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const supabase = supabasePublic();
  const { data } = await supabase.from("products").select(PRODUCT_CARD_SELECT).eq("slug", params.slug).eq("is_active", true).maybeSingle();
  if (!data) notFound();
  const product = data as unknown as Product;

  const { data: related } = product.category_id
    ? await supabase
        .from("products")
        .select(PRODUCT_CARD_SELECT)
        .eq("is_active", true)
        .eq("category_id", product.category_id)
        .neq("id", product.id)
        .limit(4)
    : { data: [] };

  return (
    <div className="container-x py-6">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-800">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/products" className="hover:text-slate-800">Catalog</Link>
        {product.category && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/products?category=${product.category.slug}`} className="hover:text-slate-800">{product.category.name}</Link>
          </>
        )}
      </nav>
      <ProductDetail product={product} />
      {related && related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">More in {product.category?.name}</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(related as unknown as Product[]).map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
