import { Check, X } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { ORDER_FLOW, STATUS_LABEL, cn, fmtDate } from "@/lib/utils";

export function OrderTimeline({
  status,
  history,
}: {
  status: OrderStatus;
  history: { status: OrderStatus; created_at: string }[];
}) {
  const terminalBad = ["cancelled", "failed", "returned"].includes(status);
  const idx = ORDER_FLOW.indexOf(status);
  const reachedIdx = terminalBad
    ? Math.max(...history.map((h) => ORDER_FLOW.indexOf(h.status)).filter((i) => i >= 0), 0)
    : idx;
  const at = (s: OrderStatus) => history.filter((h) => h.status === s).slice(-1)[0]?.created_at;

  return (
    <ol className="relative space-y-5">
      {ORDER_FLOW.map((s, i) => {
        const done = i <= reachedIdx;
        const current = !terminalBad && i === idx;
        return (
          <li key={s} className="relative flex gap-3">
            {i < ORDER_FLOW.length - 1 && (
              <span className={cn("absolute left-[13px] top-7 h-[calc(100%-4px)] w-0.5", i < reachedIdx ? "bg-brand-600" : "bg-slate-200")} />
            )}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs",
                done ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-400",
                current && "ring-4 ring-brand-600/20"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div>
              <p className={cn("text-sm font-semibold", done ? "text-slate-900" : "text-slate-400")}>{STATUS_LABEL[s]}</p>
              {at(s) && <p className="text-xs text-slate-500">{fmtDate(at(s))}</p>}
            </div>
          </li>
        );
      })}
      {terminalBad && (
        <li className="relative flex gap-3">
          <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
            <X className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-rose-700">{STATUS_LABEL[status]}</p>
            {at(status) && <p className="text-xs text-slate-500">{fmtDate(at(status))}</p>}
          </div>
        </li>
      )}
    </ol>
  );
}
