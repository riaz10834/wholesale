"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import { PasswordField } from "@/components/ui/PasswordField";
import { PHONE_RE, errMsg } from "@/lib/utils";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Enter your name");
    if (!PHONE_RE.test(form.phone.trim())) return toast.error("Enter a valid mobile number");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.name.trim(), phone: form.phone.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);
    if (error) return toast.error(errMsg(error));
    if (!data.session) {
      toast.success("Account created. Check your email to confirm, then sign in.");
      return router.replace("/login");
    }
    toast.success("Welcome! Your account is ready.");
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/products");
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-12 max-w-md space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-bold">Create business account</h1>
        <p className="mt-1 text-sm text-slate-500">Order wholesale stock and track deliveries live.</p>
      </div>
      <div>
        <label className="label" htmlFor="n">Full name</label>
        <input id="n" required className="input" value={form.name} onChange={set("name")} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="p">Mobile number</label>
        <input id="p" required className="input" value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="e">Email</label>
        <input id="e" type="email" required className="input" value={form.email} onChange={set("email")} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="pw">Password</label>
        <PasswordField id="pw" required minLength={6} value={form.password} onChange={set("password")} autoComplete="new-password" />
      </div>
      <button className="btn-primary w-full py-3" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
      </button>
      <p className="text-center text-sm text-slate-500">
        Already registered? <Link href="/login" className="font-semibold text-brand-600">Sign in</Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="container-x pb-10">
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
