"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProof } from "@/lib/types";
import { compressReceipt, proofSetupMessage } from "@/lib/receiptImage";
import { errMsg, money } from "@/lib/utils";

export function PaymentProofForm({
  supabase,
  orderId,
  amount,
  proof,
  closed,
  onDone,
  onError,
  onSuccess,
}: {
  supabase: SupabaseClient;
  orderId: string;
  amount: number;
  proof: PaymentProof | null;
  closed: boolean;
  onDone: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const waiting = proof?.status === "submitted";
  const rejected = proof?.status === "rejected";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ref = reference.trim();
    if (ref.length < 4) return onError("Enter the transaction ID from your receipt");
    if (!file) return onError("Upload a photo of the receipt");
    setBusy(true);
    try {
      const image = await compressReceipt(file);
      const { error } = await supabase.rpc("submit_payment_proof", {
        p_order_id: orderId,
        p_reference: ref,
        p_image_base64: image,
      });
      if (error) return onError(proofSetupMessage(errMsg(error)));
      setReference("");
      setFile(null);
      onSuccess("Receipt sent. The shop will match it in their bank before marking this paid.");
      onDone();
    } catch (err) {
      onError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-slate-600">
        Transfer <b className="text-slate-900">{money(amount)}</b>, then send the receipt. This order stays unpaid until the shop sees the same transaction in their bank.
      </p>
      {proof?.image_base64 && (
        <figure className="overflow-hidden rounded-xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${proof.image_base64}`} alt="Your transfer receipt" className="max-h-72 w-full object-contain bg-slate-50" />
          <figcaption className="px-3 py-2 text-xs text-slate-500">Transaction ID: {proof.reference}</figcaption>
        </figure>
      )}
      {waiting && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Receipt sent. Waiting for the shop to confirm the money arrived.</p>}
      {rejected && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          The shop could not match this transfer{proof?.reject_reason ? `: ${proof.reject_reason}` : ""}. Send the correct receipt.
        </p>
      )}
      {!closed && !waiting && (
        <form onSubmit={submit} className="space-y-2">
          <label className="label" htmlFor="txn">Transaction ID</label>
          <input id="txn" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID from the bank or wallet receipt" maxLength={80} required />
          <label className="label" htmlFor="shot">Receipt screenshot</label>
          <input id="shot" className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <button disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send receipt</button>
        </form>
      )}
    </div>
  );
}
