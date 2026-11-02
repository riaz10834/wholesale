import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Package } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate, money } from "@/lib/utils";
import type { Order } from "@/lib/types";

export const metadata = { title: "My Orders" };
export const revalidate = 0;

export default async function OrdersPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect("/login?next=/orders");
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = (data as unknown as Order[]) || [];

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My orders</h1>
      {orders.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold">No orders yet</p>
          <Link href="/products" className="btn-primary mt-5">Start shopping</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-lift sm:p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{o.order_number}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fmtDate(o.created_at)} · {o.order_items?.length || 0} items
                </p>
              </div>
              <p className="font-bold">{money(o.total)}</p>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
