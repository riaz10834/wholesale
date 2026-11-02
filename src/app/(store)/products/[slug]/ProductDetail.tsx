"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Minus, Plus, ShoppingCart, Truck, Layers, Zap } from "lucide-react";
import type { Product } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";

export function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const variants = useMemo(() => (product.product_variants || []).filter((v) => v.is_active), [product]);
  const sizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[], [variants]);
  const colors = useMemo(() => {
    const m = new Map<string, string | null>();
    variants.forEach((v) => v.color && m.set(v.color, v.color_hex));
    return Array.from(m.entries());
  }, [variants]);

  const [img, setImg] = useState(0);
  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(colors[0]?.[0] ?? null);
  const moq = product.min_order_qty;
  const [qty, setQty] = useState(moq);

  const variant =
    variants.find((v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true)) ||
    (variants.length === 1 ? variants[0] : undefined);
  const stock = variant?.inventory?.quantity ?? 0;
  const price = Number(variant?.price ?? product.wholesale_price);
  const available = (s: string | null, c: string | null) =>
    variants.some((v) => (s === null || v.size === s) && (c === null || v.color === c) && (v.inventory?.quantity || 0) > 0);

  function validate() {
    if (!variant) return "Please select an available size and colour";
    if (stock <= 0) return "This option is out of stock";
    if (qty < moq) return `Minimum order quantity is ${moq}`;
    if (qty > stock) return `Only ${stock} available`;
    return null;
  }

  function addToCart(goCheckout = false) {
    const err = validate();
    if (err) return toast.error(err);
    cart.add({
      variantId: variant!.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] || null,
      size: variant!.size,
      color: variant!.color,
      price,
      quantity: qty,
      moq,
      stock,
      unit: product.unit,
    });
    if (goCheckout) router.push("/checkout");
    else toast.success(`${qty} × ${product.name} added to cart`);
  }

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {product.images[img] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[img]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300"><ImageOff className="h-14 w-14" /></div>
          )}
        </div>
        {product.images.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
            {product.images.map((src, i) => (
              <button key={src} onClick={() => setImg(i)} className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2", i === img ? "border-brand-600" : "border-transparent")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {product.category && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{product.category.name}</p>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{product.name}</h1>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <span className="text-3xl font-extrabold">{money(price)}</span>
          <span className="pb-1 text-sm text-slate-500">per {product.unit} (wholesale)</span>
          {product.retail_price ? <span className="pb-1 text-sm text-slate-400 line-through">MRP {money(product.retail_price)}</span> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">
            <Layers className="h-3.5 w-3.5" /> Minimum order: {moq} {product.unit}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold", stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {variant ? (stock > 0 ? `${stock} in stock` : "Out of stock") : "Select options"}
          </span>
        </div>

        {sizes.length > 0 && (
          <div className="mt-6">
            <p className="label">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "min-w-12 rounded-xl border px-4 py-2 text-sm font-semibold transition",
                    size === s ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white hover:border-slate-300",
                    !available(s, colors.length ? color : null) && "opacity-40"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {colors.length > 0 && (
          <div className="mt-5">
            <p className="label">Colour: <span className="font-normal text-slate-500">{color}</span></p>
            <div className="flex flex-wrap gap-2">
              {colors.map(([c, hex]) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  title={c}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                    color === c ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200 bg-white hover:border-slate-300",
                    !available(sizes.length ? size : null, c) && "opacity-40"
                  )}
                >
                  {hex && <span className="h-4 w-4 rounded-full ring-1 ring-slate-300" style={{ background: hex }} />}
                  {c}
                  {color === c && <Check className="h-3.5 w-3.5 text-brand-600" />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="label">Quantity ({product.unit})</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white">
              <button className="p-3 disabled:opacity-40" disabled={qty <= moq} onClick={() => setQty((q) => Math.max(moq, q - 1))} aria-label="Decrease">
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={moq}
                max={stock || undefined}
                value={qty}
                onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                onBlur={() => setQty((q) => Math.max(moq, stock ? Math.min(q, stock) : q))}
                className="w-20 border-x border-slate-200 py-2.5 text-center text-sm font-semibold outline-none"
              />
              <button className="p-3 disabled:opacity-40" disabled={!!stock && qty >= stock} onClick={() => setQty((q) => q + 1)} aria-label="Increase">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="text-sm">
              <p className="text-slate-500">Line total</p>
              <p className="font-bold">{money(price * qty)}</p>
            </div>
          </div>
          {qty < moq && <p className="mt-2 text-xs text-rose-600">Minimum order quantity is {moq}.</p>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={() => addToCart(false)} disabled={!variant || stock <= 0} className="btn-secondary py-3">
            <ShoppingCart className="h-4 w-4" /> Add to cart
          </button>
          <button onClick={() => addToCart(true)} disabled={!variant || stock <= 0} className="btn-primary py-3">
            <Zap className="h-4 w-4" /> Buy now
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
          <Truck className="h-5 w-5 shrink-0 text-brand-600" />
          Delivered by our own riders. Track your delivery live and pay cash on delivery.
        </div>

        {product.description && (
          <div className="mt-8">
            <h2 className="text-lg font-bold">Product details</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
