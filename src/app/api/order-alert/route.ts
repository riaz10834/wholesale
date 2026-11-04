import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

function whatsappPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  else if (digits.length === 10) digits = `92${digits}`;
  return digits;
}

export async function POST(request: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const orderId = String((body as { orderId?: string }).orderId || "");
  if (!orderId) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: order } = await supabase
    .from("orders")
    .select("id,order_number,customer_name,customer_phone,shop_name,total,payment_method,created_at,user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) return NextResponse.json({ ok: false }, { status: 404 });
  if (Date.now() - new Date(order.created_at).getTime() > 15 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const key = process.env.CALLMEBOT_APIKEY;
  if (!key) return NextResponse.json({ ok: false, missing: true });

  const phone = `+${whatsappPhone(process.env.ADMIN_WHATSAPP || "03295587792")}`;
  const pay = order.payment_method === "cod" ? "Cash on delivery" : "Bank transfer";
  const text = [
    `New order ${order.order_number}`,
    order.customer_name,
    order.customer_phone,
    order.shop_name || "",
    `${money(order.total)} · ${pay}`,
  ]
    .filter(Boolean)
    .join("\n");

  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", key);

  const res = await fetch(url, { cache: "no-store" });
  const reply = await res.text();
  const ok = res.ok && !/error|invalid|not activated/i.test(reply);
  return NextResponse.json({ ok });
}
