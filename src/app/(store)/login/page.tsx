"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PasswordField } from "@/components/ui/PasswordField";
import { errMsg } from "@/lib/utils";

function LoginForm() {
  const params = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setLoading(false);
      return toast.error(errMsg(error || "Sign in failed"));
    }
    const profileResult = await Promise.race([
      supabase.from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle(),
      new Promise<{ data: { role?: string; is_active?: boolean } | null }>((resolve) => setTimeout(() => resolve({ data: null }), 6000)),
    ]);
    const profile = profileResult.data;
    const role = profile?.role || (data.user.app_metadata?.role as string | undefined);
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      return toast.error("Your account is disabled. Contact the administrator.");
    }
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const dest = safeNext || (role === "admin" ? "/admin" : role === "delivery" ? "/delivery" : "/");
    window.location.assign(dest);
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-12 max-w-md space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your business, admin or delivery account.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="pw">Password</label>
        <PasswordField id="pw" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      <button className="btn-primary w-full py-3" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
      </button>
      <p className="text-center text-sm text-slate-500">
        New customer?{" "}
        <Link href={`/signup${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-semibold text-brand-600">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="container-x pb-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
