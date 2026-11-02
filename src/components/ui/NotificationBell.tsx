"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Notification } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export function NotificationBell() {
  const { user } = useAuth();
  const supabase = supabaseBrowser();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setItems((data as Notification[]) || []));

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setItems((prev) => [p.new as Notification, ...prev].slice(0, 20))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, supabase]);

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!user) return null;
  const unread = items.filter((i) => !i.is_read).length;

  async function markAll() {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((p) => p.map((i) => ({ ...i, is_read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-brand-600">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No notifications yet</p>}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.link || "#"}
                onClick={() => {
                  setOpen(false);
                  if (!n.is_read) {
                    supabase.from("notifications").update({ is_read: true }).eq("id", n.id).then(() => {});
                    setItems((p) => p.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
                  }
                }}
                className={`block border-b border-slate-100 px-4 py-3 hover:bg-slate-50 ${n.is_read ? "" : "bg-brand-50/50"}`}
              >
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
