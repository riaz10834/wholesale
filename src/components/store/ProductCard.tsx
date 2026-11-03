import Link from "next/link";
import { ImageOff, Layers } from "lucide-react";
import type { Product } from "@/lib/types";
import { colorShots, coverSrc } from "@/lib/colorImages";
import { money } from "@/lib/utils";

export function ProductCard({ p, color }: { p: Product; color?: string | null }) {
  const variants = (p.product_variants || []).filter((v) => v.is_active && (!color || v.color === color));
  const stock = variants.reduce((s, v) => s + (v.inventory?.quantity || 0), 0);
  const prices = variants.map((v) => Number(v.price ?? p.wholesale_price));
  const min = prices.length ? Math.min(...prices) : Number(p.wholesale_price);
  const hex = variants.find((v) => v.color_hex)?.color_hex ?? null;
  const discount = p.retail_price && p.retail_price > min ? Math.round(((p.retail_price - min) / p.retail_price) * 100) : 0;
  const cover = (color ? colorShots(p, [[color, hex]])[0]?.src : "") || coverSrc(p);
  const title = color ? `${p.name} — ${color}` : p.name;
  const href = color ? `/products/${p.slug}?color=${encodeURIComponent(color)}` : `/products/${p.slug}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
            Save {discount}%
          </span>
        )}
        {stock <= 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">Out of stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {p.category && <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{p.category.name}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{title}</h3>
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-slate-900">{money(min)}</span>
            <span className="text-xs text-slate-500">/ {p.unit}</span>
          </div>
          {p.retail_price ? <p className="text-xs text-slate-400 line-through">MRP {money(p.retail_price)}</p> : null}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
              <Layers className="h-3 w-3" /> MOQ {p.min_order_qty}
            </span>
            {hex && <span className="h-3.5 w-3.5 rounded-full border border-white ring-1 ring-slate-200" style={{ background: hex }} title={color || undefined} />}
          </div>
        </div>
      </div>
    </Link>
  );
}
