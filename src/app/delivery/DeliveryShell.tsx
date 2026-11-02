"use client";
import Link from "next/link";
import { LogOut, Truck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { TrackerProvider, useTracker } from "@/components/delivery/TrackerProvider";

function ShiftPill() {
  const { tracking } = useTracker();
  return (
    <span className={`badge ${tracking ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
      <span className={`h-2 w-2 rounded-full ${tracking ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
      {tracking ? "Sharing GPS" : "Off shift"}
    </span>
  );
}

export function DeliveryShell({ name, isDelivery, children }: { name: string; isDelivery: boolean; children: React.ReactNode }) {
  const { signOut } = useAuth();
  return (
    <TrackerProvider>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
            <Link href="/delivery" className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><Truck className="h-4 w-4" /></span>
              Deliveries
            </Link>
            {isDelivery && <ShiftPill />}
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
              <SignOutButton signOut={signOut} />
            </div>
          </div>
        </header>
        {!isDelivery && (
          <p className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">You are viewing the delivery panel as admin. GPS sharing is only available for delivery accounts.</p>
        )}
        <main className="mx-auto max-w-3xl p-4 pb-24">
          <p className="mb-4 text-sm text-slate-500">Hi {name || "rider"} 👋</p>
          {children}
        </main>
      </div>
    </TrackerProvider>
  );
}

function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  const tracker = useTracker();
  return (
    <button
      onClick={async () => {
        if (tracker.tracking) await tracker.stop();
        await signOut();
      }}
      className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
      title="Sign out"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
