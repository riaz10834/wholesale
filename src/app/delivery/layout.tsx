import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { DeliveryShell } from "./DeliveryShell";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/delivery");
  if (!profile || !["delivery", "admin"].includes(profile.role) || !profile.is_active) redirect("/");
  return (
    <DeliveryShell name={profile.full_name} isDelivery={profile.role === "delivery"}>
      {children}
    </DeliveryShell>
  );
}
