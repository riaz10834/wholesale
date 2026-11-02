import { STATUS_COLOR, STATUS_LABEL, cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = (STATUS_LABEL as Record<string, string>)[status] || status.replace(/_/g, " ");
  return <span className={cn("badge capitalize", STATUS_COLOR[status] || "bg-slate-100 text-slate-600 ring-slate-200", className)}>{label}</span>;
}
