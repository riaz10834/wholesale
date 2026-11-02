"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (u: User | null) => {
      setUser(u);
      if (u) {
        const { data } = await supabase.from("profiles").select("*").eq("id", u.id).single();
        setProfile((data as Profile) ?? null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await load(data.user);
  }, [supabase, load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/";
  }, [supabase]);

  return <Ctx.Provider value={{ user, profile, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
