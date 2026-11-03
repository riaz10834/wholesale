"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LogOut, Package, Search, ShoppingCart, Truck, User, Menu, X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { STORE_NAME } from "@/lib/utils";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { count, ready } = useCart();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lift">
            <Package className="h-5 w-5" />
          </span>
          <span className="hidden text-lg font-extrabold tracking-tight text-slate-900 sm:block">{STORE_NAME}</span>
        </Link>

        <form onSubmit={submit} className="relative mx-auto hidden max-w-xl flex-1 md:block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-10" placeholder="Search products, brands, categories…" />
        </form>

        <nav className="ml-auto flex items-center gap-1">
          <Link href="/products" className="btn-ghost hidden lg:inline-flex">
            Catalog
          </Link>
          {profile?.role === "admin" && (
            <Link href="/admin" className="btn-ghost hidden sm:inline-flex">
              <LayoutDashboard className="h-4 w-4" /> Admin
            </Link>
          )}
          {profile?.role === "delivery" && (
            <Link href="/delivery" className="btn-ghost hidden sm:inline-flex">
              <Truck className="h-4 w-4" /> Deliveries
            </Link>
          )}
          {user && profile?.role === "customer" && (
            <Link href="/account" className="btn-ghost hidden sm:inline-flex">
              Shop address
            </Link>
          )}
          {user && (
            <Link href="/orders" className="btn-ghost hidden sm:inline-flex">
              My Orders
            </Link>
          )}
          <NotificationBell />
          <Link href="/cart" className="relative rounded-xl p-2 text-slate-700 hover:bg-slate-100" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {ready && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {count > 999 ? "999+" : count}
              </span>
            )}
          </Link>
          {user ? (
            <button onClick={signOut} className="btn-ghost hidden sm:inline-flex" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/login" className="btn-primary hidden sm:inline-flex">
              <User className="h-4 w-4" /> Sign in
            </Link>
          )}
          <button className="rounded-xl p-2 sm:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu">
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      <div className="container-x pb-3 md:hidden">
        <form onSubmit={submit} className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-10" placeholder="Search products…" />
        </form>
      </div>

      {menu && (
        <div className="border-t border-slate-200 bg-white sm:hidden">
          <div className="container-x flex flex-col py-2" onClick={() => setMenu(false)}>
            <Link href="/products" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50">Catalog</Link>
            {user && profile?.role === "customer" && <Link href="/account" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50">Shop address</Link>}
            {user && <Link href="/orders" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50">My Orders</Link>}
            {profile?.role === "admin" && <Link href="/admin" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50">Admin Dashboard</Link>}
            {profile?.role === "delivery" && <Link href="/delivery" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50">Delivery Panel</Link>}
            {user ? (
              <button onClick={signOut} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-slate-50">Sign out</button>
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-600 hover:bg-slate-50">Sign in / Register</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
