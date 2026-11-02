"use client";
import { useState } from "react";
import { AlertTriangle, Loader2, MapPin, Power, ShieldCheck, WifiOff } from "lucide-react";
import { useTracker } from "./TrackerProvider";
import { timeAgo } from "@/lib/utils";

export function ShiftCard() {
  const t = useTracker();
  const [consent, setConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  if (t.tracking) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-white">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">On shift — sharing live location</p>
            <p className="text-xs text-emerald-50">Updates every ~12 seconds while this app is open</p>
          </div>
          <button onClick={() => t.stop()} className="btn bg-white/15 text-white hover:bg-white/25">
            <Power className="h-4 w-4" /> End shift
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 text-xs text-slate-600 sm:grid-cols-4">
          <div><p className="text-slate-400">Last fix</p><p className="font-semibold">{t.lastFix ? timeAgo(new Date(t.lastFix.at).toISOString()) : "—"}</p></div>
          <div><p className="text-slate-400">Accuracy</p><p className="font-semibold">{t.lastFix?.accuracy ? `±${Math.round(t.lastFix.accuracy)} m` : "—"}</p></div>
          <div><p className="text-slate-400">Last sent</p><p className="font-semibold">{t.lastSentAt ? timeAgo(new Date(t.lastSentAt).toISOString()) : "—"}</p></div>
          <div><p className="text-slate-400">Queued</p><p className="font-semibold">{t.queued}</p></div>
        </div>
        {(!t.online || t.warning) && (
          <p className="flex items-center gap-2 border-t bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {!t.online ? <WifiOff className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {t.warning || "You are offline"}
          </p>
        )}
        <p className="border-t px-4 py-2 text-[11px] text-slate-400">Keep this screen open during deliveries. Some phones pause GPS when the browser is in the background.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><MapPin className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="font-semibold">You are off shift</p>
          <p className="text-sm text-slate-500">Start your shift to share your live GPS location with the dispatch team and your customers.</p>
        </div>
      </div>
      {showConsent ? (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-brand-600" /> Location sharing consent</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
            <li>Your GPS location is shared with admins while you are on shift.</li>
            <li>Customers can see your location only while their order is out for delivery.</li>
            <li>Sharing stops when you end your shift or sign out.</li>
          </ul>
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="accent-brand-600" />
            I agree to share my location during my shift
          </label>
          <button disabled={!consent || t.starting} onClick={() => t.start()} className="btn-success mt-3 w-full py-3">
            {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Allow GPS & start shift
          </button>
        </div>
      ) : (
        <button onClick={() => setShowConsent(true)} className="btn-success mt-4 w-full py-3"><Power className="h-4 w-4" /> Start shift</button>
      )}
      {t.error && <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0" /> {t.error}</p>}
    </div>
  );
}
