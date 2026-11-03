"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const emptyResult = Promise.resolve({ data: null, error: null });

function unavailable(): SupabaseClient {
  const query: unknown = new Proxy(() => query, {
    get(_target, prop) {
      if (prop === "then") return emptyResult.then.bind(emptyResult);
      return query;
    },
    apply: () => query,
  });
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: "Supabase is not configured" } }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: "Supabase is not configured" } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => query,
    rpc: () => query,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  } as unknown as SupabaseClient;
}

export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return unavailable();
  if (!client) client = createBrowserClient(url, key);
  return client;
}
