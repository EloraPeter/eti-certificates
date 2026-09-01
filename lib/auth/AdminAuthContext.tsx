"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Mirrors ETI-cohort's AdminAuthContext pattern: client-side session
// management for UX only (redirect to /admin on sign-out, show a
// loading state) — NOT the security boundary. Every API route
// independently calls verifyAdminRequest() server-side regardless of
// what this context believes. Same Supabase Auth project/users as
// ETI-cohort; no separate account system.
//
// NOTE on cross-app session sharing: this app and ETI-cohort are
// deployed on separate domains/subdomains. Supabase Auth's default
// browser session storage (localStorage, via @supabase/ssr's
// createBrowserClient) is origin-scoped, so a session created by
// signing into ETI-cohort does NOT automatically carry over here —
// see README "Authentication — cross-app session reuse" for the full
// investigation and why a thin, same-credentials login (this file)
// was implemented instead of true SSO for v1.
interface AdminAuthState {
  email: string | null;
  accessToken: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setAccessToken(data.session?.access_token ?? null);
      setLoading(false);
      if (!data.session) router.replace("/admin");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setAccessToken(session?.access_token ?? null);
      if (!session) router.replace("/admin");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/admin");
  }, [router, supabase]);

  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      return fetch(input, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: token ? `Bearer ${token}` : "" },
      });
    },
    [supabase]
  );

  return (
    <AdminAuthContext.Provider value={{ email, accessToken, loading, signOut, authedFetch }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
