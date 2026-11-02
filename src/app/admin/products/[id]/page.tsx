import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PRODUCT_CARD_SELECT } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { ProductForm } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data } = await supabase.from("products").select(PRODUCT_CARD_SELECT).eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const product = data as unknown as Product;
  return (
    <>
      <PageHeader title={`Edit: ${product.name}`} />
      <ProductForm product={product} />
    </>
  );
}
