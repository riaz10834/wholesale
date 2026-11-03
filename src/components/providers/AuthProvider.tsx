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

  const loadProfile = useCallback(
    (u: User | null) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const userId = u.id;
      supabase
        .from("profiles")
        .select("id,email,full_name,phone,role,is_active,is_online,last_lat,last_lng,last_accuracy,last_heading,last_speed,last_location_at,created_at")
        .eq("id", userId)
        .single()
        .then(({ data }) => {
          setProfile((data as Profile) ?? null);
          setLoading(false);
        });
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;
    // One local cookie read. getUser() would wait on the auth server before every page.
    supabase.auth.getSession().then(({ data }) => {
      if (active) loadProfile(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      loadProfile(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    loadProfile(data.session?.user ?? null);
  }, [supabase, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/";
  }, [supabase]);

  return <Ctx.Provider value={{ user, profile, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
