import Link from "next/link";
import { STORE_NAME } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png?v=4" alt={STORE_NAME} className="h-16 w-auto rounded-lg" />
          <p className="mt-2 max-w-xs text-sm text-slate-500">
            Wholesale stock for retailers and shop owners — bulk prices, minimum order quantities, and live-tracked delivery to your door.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link href="/products" className="hover:text-slate-900">All products</Link></li>
            <li><Link href="/cart" className="hover:text-slate-900">Cart</Link></li>
            <li><Link href="/orders" className="hover:text-slate-900">Track orders</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li><Link href="/login" className="hover:text-slate-900">Sign in</Link></li>
            <li><Link href="/signup" className="hover:text-slate-900">Create business account</Link></li>
            <li><Link href="/delivery" className="hover:text-slate-900">Delivery partner login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {STORE_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
