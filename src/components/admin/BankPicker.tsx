"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { BankMark } from "@/components/ui/BankMark";
import { filterBanks, findBank, type PkBank, type PkBankGroup } from "@/lib/pkBanks";
import { cn } from "@/lib/utils";

const GROUPS: PkBankGroup[] = ["Banks", "Wallets", "Microfinance"];

export function BankPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const selected = findBank(value);

  useEffect(() => {
    if (!open) return;
    const focus = window.setTimeout(() => search.current?.focus(), 0);
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focus);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const list = filterBanks(q);
    return GROUPS.map((group) => ({ group, banks: list.filter((b) => b.group === group) })).filter((g) => g.banks.length);
  }, [q]);

  function pick(bank: PkBank) {
    onChange(bank.name);
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="input flex items-center gap-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <BankMark bank={selected} />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">PK</span>
        )}
        <span className={cn("min-w-0 flex-1 truncate", selected || value.trim() ? "font-semibold text-slate-900" : "text-slate-400")}>
          {selected?.name || value.trim() || "Select a Pakistani bank"}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={search}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search HBL, Meezan, JazzCash…"
                className="input py-2 pl-9"
                aria-label="Search banks"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1" role="listbox">
            {groups.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No bank matches “{q.trim()}”.</p>
            )}
            {groups.map(({ group, banks }) => (
              <div key={group} className="mb-1">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                {banks.map((bank) => {
                  const active = bank.name === selected?.name;
                  return (
                    <button
                      key={bank.name}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(bank)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50", active && "bg-brand-50")}
                    >
                      <BankMark bank={bank} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{bank.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
