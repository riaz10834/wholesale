"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LocationPicker, type PickedLocation } from "@/components/maps/LocationPicker";
import { PHONE_RE, errMsg } from "@/lib/utils";

export default function AccountPage() {
  const supabase = supabaseBrowser();
  const { user, profile, loading, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shop, setShop] = useState("");
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setReady(true);
      return;
    }
    setName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    supabase
      .from("customers")
      .select("name,phone,shop_name,address,lat,lng")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name || profile?.full_name || "");
          setPhone(data.phone || profile?.phone || "");
          setShop(data.shop_name || "");
          if (data.lat != null && data.lng != null) {
            setLoc({ lat: Number(data.lat), lng: Number(data.lng), address: data.address || "" });
          }
        }
        setReady(true);
      });
  }, [loading, user, profile, supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Enter your name");
    if (!PHONE_RE.test(phone.trim())) return toast.error("Enter a valid mobile number");
    if (!loc) return toast.error("Search and pick your shop location");
    setSaving(true);
    const row = {
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim(),
      shop_name: shop.trim() || null,
      address: loc.address,
      lat: loc.lat,
      lng: loc.lng,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("customers").update(row).eq("user_id", user.id).select("id");
    let saveError = error;
    if (!error && !data?.length) {
      const inserted = await supabase.from("customers").insert(row);
      saveError = inserted.error;
    }
    if (!saveError) {
      await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim() }).eq("id", user.id);
      await refresh();
    }
    setSaving(false);
    if (saveError) return toast.error(errMsg(saveError));
    toast.success("Shop address updated");
  }

  if (!ready || loading) {
    return (
      <div className="container-x flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container-x py-20 text-center">
        <p className="font-semibold">Sign in to update your shop address</p>
        <Link href="/login?next=/account" className="btn-primary mt-4">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold tracking-tight">Shop address</h1>
      <p className="mt-1 text-sm text-slate-500">Change where riders deliver. The next order uses this location.</p>
      <form onSubmit={save} className="card mt-6 max-w-2xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Mobile</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="shop">Shop name</label>
            <input id="shop" className="input" value={shop} onChange={(e) => setShop(e.target.value)} maxLength={120} />
          </div>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-brand-600" /> Shop location</p>
          <LocationPicker value={loc} onChange={setLoc} />
        </div>
        <button disabled={saving} className="btn-primary">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save shop address
        </button>
      </form>
    </div>
  );
}
