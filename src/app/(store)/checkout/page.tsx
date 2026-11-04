"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, MapPin } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LocationPicker, type PickedLocation } from "@/components/maps/LocationPicker";
import { BANK_SELECT, BankDetails } from "@/components/store/BankDetails";
import type { BankAccount } from "@/lib/types";
import { PHONE_RE, errMsg, money, variantLabel } from "@/lib/utils";

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { items, subtotal, clear, ready } = useCart();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shop, setShop] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"cod" | "bank_transfer">("cod");
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("store_settings").select(BANK_SELECT).eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setBank(data as BankAccount);
    });
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName((n) => n || data.name || "");
          setPhone((p) => p || data.phone || "");
          setShop((s) => s || data.shop_name || "");
          if (data.lat && data.lng) setLoc((l) => l || { lat: data.lat, lng: data.lng, address: data.address || "" });
        } else if (profile) {
          setName((n) => n || profile.full_name || "");
          setPhone((p) => p || profile.phone || "");
        }
      });
  }, [user, profile, supabase]);

  const onLoc = useCallback((v: PickedLocation) => setLoc(v), []);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Please enter your name";
    if (!PHONE_RE.test(phone.trim())) errs.phone = "Enter a valid mobile number";
    if (!loc) errs.loc = "Please select your delivery location on the map";
    const bad = items.find((i) => i.quantity < i.moq);
    if (bad) errs.cart = `Minimum order for ${bad.name} is ${bad.moq}`;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_shop_name: shop.trim() || null,
      p_address: loc!.address,
      p_lat: loc!.lat,
      p_lng: loc!.lng,
      p_notes: notes.trim() || null,
      p_payment_method: payment,
    });
    setSubmitting(false);
    if (error) return toast.error(errMsg(error));
    clear();
    toast.success("Order placed successfully!");
    router.replace(`/orders/${data}?placed=1`);
  }

  if (!ready) return <div className="container-x py-20" />;
  if (items.length === 0) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/products" className="btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
      <form onSubmit={placeOrder} className="mt-6 grid gap-6 lg:grid-cols-3" noValidate>
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="font-bold">Contact details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Full name *</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
                {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
              </div>
              <div>
                <label className="label" htmlFor="phone">Mobile number *</label>
                <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="03XX XXXXXXX" autoComplete="tel" />
                {errors.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="shop">Shop name <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="shop" className="input" value={shop} onChange={(e) => setShop(e.target.value)} maxLength={120} />
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand-600" /> Delivery location *</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Pin your exact shop location so our rider can find you.</p>
            <LocationPicker value={loc} onChange={onLoc} />
            {errors.loc && <p className="mt-2 text-xs text-rose-600">{errors.loc}</p>}
            {loc && (
              <div className="mt-3">
                <label className="label" htmlFor="addr">Address / landmark</label>
                <input id="addr" className="input" value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} maxLength={300} />
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-bold">Payment & notes</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { v: "cod", t: "Cash on delivery", d: "Pay the rider when goods arrive" },
                { v: "bank_transfer", t: "Bank transfer", d: "Pay into the shop account shown below" },
              ].map((o) => (
                <label key={o.v} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${payment === o.v ? "border-brand-600 bg-brand-50/50" : "border-slate-200"}`}>
                  <input type="radio" name="pay" checked={payment === o.v} onChange={() => setPayment(o.v as "cod" | "bank_transfer")} className="mt-1 accent-brand-600" />
                  <span>
                    <span className="block text-sm font-semibold">{o.t}</span>
                    <span className="text-xs text-slate-500">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
            {payment === "bank_transfer" && (
              <div className="mt-4">
                <BankDetails bank={bank} amount={subtotal} />
              </div>
            )}
            <label className="label mt-4" htmlFor="notes">Order notes</label>
            <textarea id="notes" className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Delivery timing, special instructions…" />
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="font-bold">Your order</h2>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto">
            {items.map((i) => (
              <li key={i.variantId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="line-clamp-1 font-medium">{i.name}</span>
                  <span className="text-xs text-slate-500">{[variantLabel(i.size, i.color), `${i.quantity} × ${money(i.price)}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 font-semibold">{money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t pt-4 text-base font-bold">
            <span>Total</span>
            <span>{money(subtotal)}</span>
          </div>
          {errors.cart && <p className="mt-2 text-xs text-rose-600">{errors.cart}</p>}
          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full py-3">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Place order
          </button>
        </aside>
      </form>
    </div>
  );
}
