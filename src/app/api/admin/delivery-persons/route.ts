import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile, supabaseAdmin } from "@/lib/supabase/server";

const CreateSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/, "Invalid phone number"),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8).max(72).optional(),
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().regex(/^\+?[0-9 \-]{7,20}$/).optional(),
  is_active: z.boolean().optional(),
});

async function requireAdmin() {
  const { profile } = await getSessionProfile();
  return profile?.role === "admin" && profile.is_active;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const { full_name, phone, email, password } = parsed.data;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone },
    app_metadata: { role: "delivery" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // trigger creates the profile; make sure role/fields are set even if the profile pre-existed
  await admin.from("profiles").upsert({ id: data.user.id, email, full_name, phone, role: "delivery", is_active: true });
  return NextResponse.json({ id: data.user.id });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const { id, password, ...rest } = parsed.data;
  const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
  if (target?.role !== "delivery") return NextResponse.json({ error: "Not a delivery account" }, { status: 400 });

  if (password) {
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (Object.keys(rest).length) {
    const patch: Record<string, unknown> = { ...rest };
    if (rest.is_active === false) patch.is_online = false;
    const { error } = await admin.from("profiles").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
