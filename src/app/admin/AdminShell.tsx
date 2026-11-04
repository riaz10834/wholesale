"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Boxes, CreditCard, LayoutDashboard, LogOut, MapPinned, Menu, Package, Receipt, ShoppingBag, Store, Tags, Truck, Users, Warehouse, X,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/components/providers/ThemeProvider";
import { STORE_NAME, cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/tracking", label: "Live Tracking", icon: MapPinned },
  { href: "/admin/dispatch", label: "Dispatch location", icon: Warehouse },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/delivery-persons", label: "Delivery Team", icon: Truck },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const path = usePathname();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-brand-600 text-white shadow-lift" : dark ? "text-slate-300 hover:bg-white/5 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className={cn("admin-root min-h-screen lg:pl-64", dark ? "bg-ink-900 text-slate-100" : "bg-slate-50 text-slate-900")}>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex", dark ? "bg-ink-800" : "border-r border-slate-200 bg-white")}>
        <div className="flex h-16 items-center px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark ? "/logo-dark.png?v=1" : "/logo.png?v=6"} alt={STORE_NAME} className="h-9 w-auto rounded-lg" />
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto">{nav}</div>
        <div className={cn("border-t p-3", dark ? "border-white/10" : "border-slate-200")}>
          <Link href="/" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", dark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-600 hover:bg-slate-100")}><Store className="h-4 w-4" /> View store</Link>
          <button onClick={signOut} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm", dark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-600 hover:bg-slate-100")}><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className={cn("no-scrollbar absolute inset-y-0 left-0 w-72 overflow-y-auto", dark ? "bg-ink-800 text-white" : "bg-white text-slate-900")}>
            <div className="flex h-16 items-center justify-between px-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dark ? "/logo-dark.png?v=1" : "/logo.png?v=6"} alt={STORE_NAME} className="h-9 w-auto rounded-lg" />
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {nav}
            <div className={cn("border-t p-3", dark ? "border-white/10" : "border-slate-200")}>
              <Link href="/" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm", dark ? "text-slate-400" : "text-slate-600")}><Store className="h-4 w-4" /> View store</Link>
              <button onClick={signOut} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm", dark ? "text-slate-400" : "text-slate-600")}><LogOut className="h-4 w-4" /> Sign out</button>
            </div>
          </aside>
        </div>
      )}

      <header className={cn("sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6", dark ? "border-white/10 bg-ink-800/90" : "border-slate-200 bg-white/90")}>
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
        <p className={cn("font-semibold", dark ? "text-slate-100" : "text-slate-700")}>Admin</p>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
          <span className={cn("hidden text-sm sm:block", dark ? "text-slate-400" : "text-slate-500")}>{name}</span>
        </div>
      </header>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
