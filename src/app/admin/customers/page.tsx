"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Phone, Search, X } from "lucide-react";
import { GoogleMap, MarkerF } from "@react-google-maps/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PageHeader, Empty } from "@/components/ui/PageHeader";
import { useMaps, MAP_STYLE } from "@/components/maps/useMaps";
import { MapFallback } from "@/components/maps/MapFallback";
import { fmtDate, mapsNavUrl, money } from "@/lib/utils";

interface Row {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  shop_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  orders?: { total: number; status: string }[];
}

export default function AdminCustomers() {
  const supabase = supabaseBrowser();
  const { isLoaded, loadError, missingKey } = useMaps();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("customers").select("*, orders(total,status)").order("created_at", { ascending: false }).limit(1000);
    setRows((data as Row[]) || []);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () => rows.filter((r) => !term || `${r.name} ${r.phone} ${r.shop_name} ${r.address}`.toLowerCase().includes(term)),
    [rows, term]
  );
  const withLoc = shown.filter((r) => r.lat != null && r.lng != null);

  return (
    <>
      <PageHeader title="Customers" subtitle={`${rows.length} registered customers`} />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="card overflow-hidden xl:col-span-3">
          <div className="border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search name, phone, shop, address…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            {shown.length === 0 ? (
              <Empty text="No customers found" />
            ) : (
              <table className="table-x">
                <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Spent</th><th /></tr></thead>
                <tbody>
                  {shown.map((r) => {
                    const valid = (r.orders || []).filter((o) => !["cancelled", "returned", "failed"].includes(o.status));
                    return (
                      <tr key={r.id} onClick={() => setSel(r)} className={`cursor-pointer hover:bg-slate-50 ${sel?.id === r.id ? "bg-brand-50/60" : ""}`}>
                        <td><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-500">{r.shop_name || "—"}</p></td>
                        <td><a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="text-brand-700">{r.phone}</a></td>
                        <td>{r.orders?.length || 0}</td>
                        <td className="font-semibold">{money(valid.reduce((s, o) => s + Number(o.total), 0))}</td>
                        <td>{r.lat != null && <MapPin className="h-4 w-4 text-slate-400" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          {isLoaded ? (
            <div className="overflow-hidden rounded-2xl border">
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: 380 }}
                center={sel?.lat != null ? { lat: sel.lat, lng: sel.lng! } : withLoc[0] ? { lat: withLoc[0].lat!, lng: withLoc[0].lng! } : { lat: 24.86, lng: 67.0 }}
                zoom={sel ? 15 : 11}
                options={{ styles: MAP_STYLE, streetViewControl: false, mapTypeControl: false }}
              >
                {withLoc.map((r) => (
                  <MarkerF key={r.id} position={{ lat: r.lat!, lng: r.lng! }} title={r.name} onClick={() => setSel(r)} />
                ))}
              </GoogleMap>
            </div>
          ) : (
            <MapFallback missingKey={missingKey} error={!!loadError} height={380} />
          )}
          {sel && (
            <div className="card space-y-2 p-5 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold">{sel.name}</p>
                  <p className="text-slate-500">{sel.shop_name}</p>
                </div>
                <button onClick={() => setSel(null)}><X className="h-4 w-4" /></button>
              </div>
              <p className="flex gap-1 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{sel.address || "No address"}</p>
              <p className="text-xs text-slate-400">Customer since {fmtDate(sel.created_at, false)}</p>
              <div className="flex gap-2 pt-2">
                <a href={`tel:${sel.phone}`} className="btn-primary btn-sm"><Phone className="h-3.5 w-3.5" /> Call</a>
                {sel.lat != null && <a href={mapsNavUrl(sel.lat, sel.lng!)} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><Navigation className="h-3.5 w-3.5" /> Directions</a>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
