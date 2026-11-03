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
      void Promise.resolve(
        supabase
          .from("profiles")
          .select("id,email,full_name,phone,role,is_active,is_online,last_lat,last_lng,last_accuracy,last_heading,last_speed,last_location_at,created_at")
          .eq("id", userId)
          .single()
      )
        .then(({ data }) => {
          setProfile((data as Profile) ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;
    // INITIAL_SESSION reads the cookie. A separate getSession() call deadlocks the auth lock and leaves the rider screen spinning.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "TOKEN_REFRESHED") return;
      const u = session?.user ?? null;
      setTimeout(() => {
        if (active) loadProfile(u);
      }, 0);
    });
    const giveUp = setTimeout(() => {
      if (active) setLoading(false);
    }, 8000);
    return () => {
      active = false;
      clearTimeout(giveUp);
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
