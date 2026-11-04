"use client";
import { useState } from "react";
import { Copy, Landmark } from "lucide-react";
import { BankMark } from "@/components/ui/BankMark";
import { findBank } from "@/lib/pkBanks";
import type { BankAccount } from "@/lib/types";
import { money } from "@/lib/utils";

export function hasBank(bank: BankAccount | null | undefined) {
  return Boolean(bank?.bank_name?.trim() && bank.account_title?.trim() && bank.account_number?.trim());
}

export function BankDetails({ bank, amount }: { bank: BankAccount | null; amount?: number }) {
  const [copied, setCopied] = useState("");
  if (!hasBank(bank)) {
    return <p className="text-sm text-slate-500">Bank details are not set yet. The shop will share them with you.</p>;
  }

  const mark = findBank(bank!.bank_name);
  const rows = [
    ["Bank", bank!.bank_name],
    ["Account title", bank!.account_title],
    ["Account number", bank!.account_number],
    ["IBAN", bank!.iban],
    ["Branch", bank!.branch],
  ].filter((row) => row[1]?.trim());

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Landmark className="h-4 w-4 text-brand-600" /> Transfer to this account
      </p>
      {amount != null && <p className="mt-1 text-sm text-slate-600">Amount: <span className="font-bold text-slate-900">{money(amount)}</span></p>}
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {label === "Bank" && mark && <BankMark bank={mark} className="h-8 w-8" />}
              <div>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="font-semibold text-slate-900">{value}</dd>
              </div>
            </div>
            {(label === "Account number" || label === "IBAN") && (
              <button type="button" onClick={() => copy(label!, value!)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                <Copy className="h-3.5 w-3.5" /> {copied === label ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
