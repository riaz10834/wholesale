"use client";
import Link from "next/link";
import { ImageOff, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { money, variantLabel } from "@/lib/utils";

export default function CartPage() {
  const { items, subtotal, setQty, remove, ready } = useCart();
  const invalid = items.some((i) => i.quantity < i.moq || i.quantity > i.stock);

  if (!ready) return <div className="container-x py-20" />;

  if (items.length === 0) {
    return (
      <div className="container-x py-20 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-1 text-slate-500">Browse the catalog and add wholesale stock for your shop.</p>
        <Link href="/products" className="btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Shopping cart</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((i) => (
            <div key={i.variantId} className="card flex gap-4 p-4">
              <Link href={`/products/${i.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {i.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300"><ImageOff /></div>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/products/${i.slug}`} className="line-clamp-1 font-semibold hover:text-brand-700">{i.name}</Link>
                    {variantLabel(i.size, i.color) && <p className="text-xs text-slate-500">{variantLabel(i.size, i.color)}</p>}
                    <p className="mt-1 text-sm text-slate-600">{money(i.price)} / {i.unit}</p>
                  </div>
                  <button onClick={() => remove(i.variantId)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                  <div>
                    <div className="flex items-center rounded-xl border border-slate-200">
                      <button className="p-2 disabled:opacity-40" disabled={i.quantity <= i.moq} onClick={() => setQty(i.variantId, i.quantity - 1)}><Minus className="h-3.5 w-3.5" /></button>
                      <input
                        type="number"
                        value={i.quantity}
                        min={i.moq}
                        max={i.stock}
                        onChange={(e) => setQty(i.variantId, Math.floor(Number(e.target.value) || 1))}
                        className="w-16 border-x border-slate-200 py-1.5 text-center text-sm font-semibold outline-none"
                      />
                      <button className="p-2 disabled:opacity-40" disabled={i.quantity >= i.stock} onClick={() => setQty(i.variantId, i.quantity + 1)}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    {i.quantity < i.moq && <p className="mt-1 text-xs text-rose-600">Minimum {i.moq}</p>}
                  </div>
                  <p className="font-bold">{money(i.price * i.quantity)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="font-bold">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Items</dt><dd>{items.reduce((s, i) => s + i.quantity, 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Delivery</dt><dd className="text-emerald-600">Free</dd></div>
            <div className="flex justify-between border-t pt-3 text-base font-bold"><dt>Total</dt><dd>{money(subtotal)}</dd></div>
          </dl>
          {invalid ? (
            <button disabled className="btn-primary mt-6 w-full py-3">Fix quantities to continue</button>
          ) : (
            <Link href="/checkout" className="btn-primary mt-6 w-full py-3">Proceed to checkout</Link>
          )}
          <p className="mt-3 text-center text-xs text-slate-500">Final prices and stock are verified when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
