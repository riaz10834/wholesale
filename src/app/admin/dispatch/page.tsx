"use client";
import { useEffect, useState } from "react";
import { Loader2, Warehouse } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { LocationPicker, type PickedLocation } from "@/components/maps/LocationPicker";
import { errMsg } from "@/lib/utils";

export default function DispatchLocationPage() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [name, setName] = useState("Warehouse");
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("store_settings")
      .select("warehouse_name,warehouse_address,warehouse_lat,warehouse_lng")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error(error.message.includes("store_settings") ? "Run supabase/add_dispatch_location.sql in the Supabase SQL editor first." : errMsg(error));
        if (data) {
          setName(data.warehouse_name || "Warehouse");
          if (data.warehouse_lat != null && data.warehouse_lng != null) {
            setLoc({ lat: Number(data.warehouse_lat), lng: Number(data.warehouse_lng), address: data.warehouse_address || "Pinned on map" });
          }
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // toast identity changes every render; this load should run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function save() {
    if (!loc) return toast.error("Pin the warehouse on the map");
    setSaving(true);
    const { error } = await supabase.from("store_settings").upsert({
      id: 1,
      warehouse_name: name.trim() || "Warehouse",
      warehouse_address: loc.address,
      warehouse_lat: loc.lat,
      warehouse_lng: loc.lng,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      const missing = error.message.includes("store_settings") || error.message.includes("schema cache");
      return toast.error(missing ? "Run supabase/add_dispatch_location.sql in the Supabase SQL editor, then save again." : errMsg(error));
    }
    toast.success("Dispatch location saved. Customers and admins can see where orders come from.");
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <>
      <PageHeader title="Dispatch location" subtitle="Where orders leave from. Customers and you both see this on the order map. Riders already know the pickup point." />
      <section className="card max-w-3xl space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Warehouse className="h-5 w-5" /></span>
          <p className="text-sm text-slate-600">Pin your warehouse or store. Until this is set, order maps only show the customer&apos;s shop and the rider.</p>
        </div>
        <div>
          <label className="label">Place name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main warehouse" maxLength={80} />
        </div>
        <LocationPicker
          value={loc}
          onChange={setLoc}
          searchPlaceholder="Search the warehouse or store address"
          emptyHint="Pin the place orders are packed and sent from. Customers and admins will see this on the order map."
        />
        <button onClick={save} disabled={saving || !loc} className="btn-primary">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save dispatch location
        </button>
      </section>
    </>
  );
}
