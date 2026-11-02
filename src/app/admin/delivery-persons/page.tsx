"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, Radio, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import type { Profile } from "@/lib/types";
import { PHONE_RE, isLive, timeAgo } from "@/lib/utils";

type Row = Profile & { deliveries: { status: string }[] };

export default function DeliveryPersons() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ full_name: "", phone: "", email: "", password: "" });

  const load = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*, deliveries(status)").eq("role", "delivery").order("full_name");
    setRows((data as Row[]) || []);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-riders")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: "role=eq.delivery" }, () => load())
      .subscribe();
    const t = setInterval(load, 30000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [load, supabase]);

  async function call(method: "POST" | "PATCH", body: unknown) {
    const res = await fetch("/api/admin/delivery-persons", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (f.full_name.trim().length < 2) return toast.error("Name is required");
    if (!PHONE_RE.test(f.phone.trim())) return toast.error("Valid phone is required");
    if (f.password.length < 8) return toast.error("Password must be at least 8 characters");
    setSaving(true);
    try {
      await call("POST", f);
      toast.success("Delivery person created. Share their email & password with them.");
      setF({ full_name: "", phone: "", email: "", password: "" });
      setOpen(false);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: Row) {
    try {
      await call("PATCH", { id: r.id, is_active: !r.is_active });
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function resetPw(r: Row) {
    const pw = prompt(`New password for ${r.full_name} (min 8 chars)`);
    if (!pw) return;
    try {
      await call("PATCH", { id: r.id, password: pw });
      toast.success("Password updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Delivery team"
        subtitle="Create rider accounts. Riders log in at /login and are redirected to the delivery panel."
        actions={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add delivery person</button>}
      />
      {open && (
        <form onSubmit={create} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between sm:col-span-2 lg:col-span-4">
            <h2 className="font-bold">New delivery person</h2>
            <button type="button" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div><label className="label">Full name</label><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label">Login email</label><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><label className="label">Password</label><input type="text" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div><button disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create account</button></div>
        </form>
      )}
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty text="No delivery persons yet" />
        ) : (
          <table className="table-x">
            <thead><tr><th>Name</th><th>Phone</th><th>GPS</th><th>Last update</th><th>Active jobs</th><th>Delivered</th><th>Account</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const live = isLive(r.is_online, r.last_location_at);
                const activeJobs = r.deliveries.filter((d) => ["assigned", "picked_up", "out_for_delivery"].includes(d.status)).length;
                return (
                  <tr key={r.id}>
                    <td><p className="font-semibold">{r.full_name}</p><p className="text-xs text-slate-500">{r.email}</p></td>
                    <td><a href={`tel:${r.phone}`} className="text-brand-700">{r.phone}</a></td>
                    <td>
                      <span className={`badge ${live ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                        <Radio className="h-3 w-3" /> {live ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="text-slate-500">{timeAgo(r.last_location_at)}</td>
                    <td>{activeJobs}</td>
                    <td>{r.deliveries.filter((d) => d.status === "delivered").length}</td>
                    <td>
                      <button onClick={() => toggle(r)} className={`badge ${r.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
                        {r.is_active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td><button onClick={() => resetPw(r)} className="btn-ghost btn-sm"><KeyRound className="h-3.5 w-3.5" /> Reset password</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
