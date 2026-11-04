import { cn } from "@/lib/utils";
import type { PkBank } from "@/lib/pkBanks";

export function BankMark({ bank, className }: { bank: PkBank; className?: string }) {
  const letters = bank.short.length;
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold uppercase leading-none tracking-tight text-white",
        letters >= 4 ? "text-[8px]" : letters === 3 ? "text-[10px]" : "text-xs",
        className
      )}
      style={{ backgroundColor: bank.color }}
    >
      {bank.short}
    </span>
  );
}
