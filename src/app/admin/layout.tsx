import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/admin");
  if (!profile || profile.role !== "admin" || !profile.is_active) redirect("/");
  return <AdminShell name={profile.full_name || profile.email || "Admin"}>{children}</AdminShell>;
}
