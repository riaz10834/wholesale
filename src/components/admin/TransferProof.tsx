"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, PaymentProof } from "@/lib/types";
import { errMsg, money } from "@/lib/utils";

export function TransferProof({
  supabase,
  order,
  proof,
  paid,
  onDone,
  onError,
  onSuccess,
}: {
  supabase: SupabaseClient;
  order: Order;
  proof: PaymentProof | null;
  paid: number;
  onDone: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const due = Math.max(0, Number(order.total) - paid);
  const open = proof?.status === "submitted";

  async function accept() {
    if (!proof) return;
    if (!confirm(`Mark ${money(due || order.total)} received for ${proof.reference}? Only do this after you see that transaction in your bank app.`)) return;
    setBusy("yes");
    if (due > 0) {
      const { error } = await supabase.from("payments").insert({
        order_id: order.id,
        amount: due,
        method: "bank_transfer",
        reference: proof.reference,
        notes: "Confirmed against the customer receipt and the shop bank",
      });
      if (error) {
        setBusy(null);
        return onError(errMsg(error));
      }
    }
    const { error: proofError } = await supabase
      .from("payment_proofs")
      .update({ status: "accepted", reject_reason: null, reviewed_at: new Date().toISOString() })
      .eq("order_id", order.id);
    if (!proofError) {
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        title: "Payment confirmed",
        body: `We received your transfer for ${order.order_number}.`,
        link: `/orders/${order.id}`,
      });
    }
    setBusy(null);
    if (proofError) return onError(errMsg(proofError));
    onSuccess("Marked received. The customer is notified.");
    onDone();
  }

  async function reject() {
    if (!proof) return;
    const reason = prompt("Why was this transfer not accepted? The customer will see this.");
    if (reason === null) return;
    const note = reason.trim();
    if (note.length < 3) return onError("Write a short reason");
    setBusy("no");
    const { error } = await supabase
      .from("payment_proofs")
      .update({ status: "rejected", reject_reason: note.slice(0, 300), reviewed_at: new Date().toISOString() })
      .eq("order_id", order.id);
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: order.user_id,
        title: "Transfer not confirmed",
        body: note.slice(0, 300),
        link: `/orders/${order.id}`,
      });
    }
    setBusy(null);
    if (error) return onError(errMsg(error));
    onSuccess("Receipt rejected. The customer can send another one.");
    onDone();
  }

  if (order.payment_status === "paid" && proof?.status !== "submitted") {
    return proof ? <p className="text-sm text-emerald-700">You confirmed transaction {proof.reference}.</p> : null;
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">Check this transfer in your bank app</p>
      <p className="mt-1 text-amber-900">A photo is not proof by itself. Match the transaction ID and the amount {money(order.total)} in your bank SMS or statement, then mark it received.</p>
      {!proof && <p className="mt-2">The customer has not sent a receipt yet. Leave this order unpaid.</p>}
      {proof?.status === "rejected" && <p className="mt-2">You rejected the last receipt{proof.reject_reason ? `: ${proof.reject_reason}` : ""}. Waiting for a new one.</p>}
      {proof?.status === "accepted" && <p className="mt-2 text-emerald-800">You already confirmed transaction {proof.reference}.</p>}
      {open && proof && (
        <div className="mt-3 space-y-3">
          <p>Customer transaction ID: <b>{proof.reference}</b></p>
          {proof.image_base64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/jpeg;base64,${proof.image_base64}`} alt="Customer transfer receipt" className="max-h-96 w-full rounded-lg border border-amber-200 bg-white object-contain" />
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={!!busy} onClick={accept} className="btn-success">
              {busy === "yes" && <Loader2 className="h-4 w-4 animate-spin" />} Payment received
            </button>
            <button type="button" disabled={!!busy} onClick={reject} className="btn-danger">
              {busy === "no" && <Loader2 className="h-4 w-4 animate-spin" />} Not in my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
