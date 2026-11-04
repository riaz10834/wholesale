import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankAccount } from "@/lib/types";

const PATH = "settings/bank-account.json";

function asAccount(raw: Partial<BankAccount> | null): BankAccount | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    bank_name: raw.bank_name?.trim() || null,
    account_title: raw.account_title?.trim() || null,
    account_number: raw.account_number?.trim() || null,
    iban: raw.iban?.trim() || null,
    branch: raw.branch?.trim() || null,
  };
}

/** Shop bank account. Stored in the public images bucket because store_settings has no bank columns yet. */
export async function loadBankAccount(supabase: SupabaseClient): Promise<BankAccount | null> {
  const { data } = supabase.storage.from("product-images").getPublicUrl(PATH);
  try {
    const res = await fetch(`${data.publicUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return asAccount(await res.json());
  } catch {
    return null;
  }
}

export async function saveBankAccount(supabase: SupabaseClient, bank: BankAccount) {
  const file = new File([JSON.stringify(bank)], "bank-account.json", { type: "application/json" });
  return supabase.storage.from("product-images").upload(PATH, file, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
}
