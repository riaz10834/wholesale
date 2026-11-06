import type { DeliveryStatus, OrderStatus } from "./types";

export const STORE_NAME = "Wholesale-Brand";
export const SHOP_WHATSAPP_DISPLAY = "0329 5587792";

export function shopWhatsAppUrl(text?: string) {
  const base = "https://wa.me/923295587792";
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function orderAlertText(order: {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  shop_name?: string | null;
  address?: string | null;
  total: number;
  payment_method: string;
}) {
  const pay = order.payment_method === "cod" ? "Cash on delivery" : "Bank transfer";
  return [
    `New order ${order.order_number}`,
    order.customer_name,
    order.customer_phone,
    order.shop_name || "",
    order.address || "",
    `${money(order.total)} · ${pay}`,
  ]
    .filter(Boolean)
    .join("\n");
}
const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY || "PKR").toUpperCase();

export function money(n: number | string | null | undefined) {
  const v = Number(n || 0);
  const amount = Number.isFinite(v) ? v : 0;
  const formatted = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amount);
  return `${CURRENCY} ${formatted}`;
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function fmtDate(d: string | null | undefined, withTime = true) {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(d: string | null | undefined) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** A courier is considered online if flagged online and has reported within 2 minutes. */
export function isLive(isOnline: boolean, lastAt: string | null) {
  if (!isOnline || !lastAt) return false;
  return Date.now() - new Date(lastAt).getTime() < 2 * 60 * 1000;
}

export const ORDER_FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "packed", "out_for_delivery", "delivered"];
export const ALL_ORDER_STATUSES: OrderStatus[] = [...ORDER_FLOW, "cancelled", "failed", "returned"];

export const STATUS_LABEL: Record<OrderStatus | DeliveryStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed Delivery",
  returned: "Returned",
  assigned: "Assigned",
  picked_up: "Picked Up",
};

export const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  confirmed: "bg-sky-50 text-sky-700 ring-sky-200",
  preparing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  packed: "bg-violet-50 text-violet-700 ring-violet-200",
  out_for_delivery: "bg-blue-50 text-blue-700 ring-blue-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  returned: "bg-orange-50 text-orange-700 ring-orange-200",
  assigned: "bg-sky-50 text-sky-700 ring-sky-200",
  picked_up: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  unpaid: "bg-rose-50 text-rose-700 ring-rose-200",
  partial: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  refunded: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function variantLabel(size?: string | null, color?: string | null) {
  return [size, color].filter(Boolean).join(" / ");
}

export function mapsNavUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function looksLikeCoords(value: string | null | undefined) {
  return !!value && /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(value.trim());
}

export function placeAddress(value: string | null | undefined) {
  if (!value || looksLikeCoords(value)) return "Address not available";
  return value;
}

export function errMsg(e: unknown) {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  const anyE = e as { message?: string };
  return anyE.message || "Something went wrong";
}

export const PHONE_RE = /^\+?[0-9 \-]{7,20}$/;
