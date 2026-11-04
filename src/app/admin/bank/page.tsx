"use client";
import { useEffect, useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { BankPicker } from "@/components/admin/BankPicker";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadBankAccount, saveBankAccount } from "@/lib/bankAccount";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { errMsg } from "@/lib/utils";

const EMPTY = { bank_name: "", account_title: "", account_number: "", iban: "", branch: "" };

export default function BankAccountPage() {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadBankAccount(supabase).then((data) => {
      if (!active) return;
      if (data) {
        setForm({
          bank_name: data.bank_name || "",
          account_title: data.account_title || "",
          account_number: data.account_number || "",
          iban: data.iban || "",
          branch: data.branch || "",
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  function set(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bank_name.trim() || !form.account_title.trim() || !form.account_number.trim()) {
      return toast.error("Bank name, account title and account number are required");
    }
    setSaving(true);
    const { error } = await saveBankAccount(supabase, {
      bank_name: form.bank_name.trim(),
      account_title: form.account_title.trim(),
      account_number: form.account_number.trim(),
      iban: form.iban.trim() || null,
      branch: form.branch.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Bank account saved. Customers see it when they choose bank transfer.");
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <>
      <PageHeader title="Bank account" subtitle="Customers see this when they pay by bank transfer. Cash on delivery stays the same." />
      <form onSubmit={save} className="card max-w-xl space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Landmark className="h-5 w-5" /></span>
          <p className="text-sm text-slate-600">Put the account you want paid into. The customer sees the bank, title, number, IBAN and branch at checkout and on the order.</p>
        </div>
        <div>
          <label className="label">Bank *</label>
          <BankPicker value={form.bank_name} onChange={(bank_name) => setForm((f) => ({ ...f, bank_name }))} />
        </div>
        <div>
          <label className="label">Account title *</label>
          <input className="input" value={form.account_title} onChange={set("account_title")} placeholder="Vinci Shoes" maxLength={120} required />
        </div>
        <div>
          <label className="label">Account number *</label>
          <input className="input" value={form.account_number} onChange={set("account_number")} placeholder="0000123456789" maxLength={40} required />
        </div>
        <div>
          <label className="label">IBAN</label>
          <input className="input" value={form.iban} onChange={set("iban")} placeholder="PK00XXXX0000000000000000" maxLength={34} />
        </div>
        <div>
          <label className="label">Branch</label>
          <input className="input" value={form.branch} onChange={set("branch")} placeholder="Rawalpindi, Itefaq Shoe Market" maxLength={120} />
        </div>
        <button disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save bank account</button>
      </form>
    </>
  );
}
