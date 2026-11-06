import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { orderAlertText } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SHOP_WHATSAPP = "923295587792";

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
    .select("id,order_number,customer_name,customer_phone,shop_name,address,total,payment_method,created_at,user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) return NextResponse.json({ ok: false }, { status: 404 });
  if (Date.now() - new Date(order.created_at).getTime() > 15 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return NextResponse.json({ ok: false, missing: true });

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: SHOP_WHATSAPP,
      type: "text",
      text: { preview_url: false, body: orderAlertText(order) },
    }),
    cache: "no-store",
  });

  return NextResponse.json({ ok: res.ok });
}
