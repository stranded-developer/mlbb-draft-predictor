"use client";

import { useCallback, useEffect, useState } from "react";

type SessionState = { isAdmin: boolean; configured: boolean; ready: boolean };

async function fetchSession(): Promise<Omit<SessionState, "ready">> {
  try {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    const json = await res.json();
    return { isAdmin: Boolean(json.admin), configured: Boolean(json.configured) };
  } catch {
    return { isAdmin: false, configured: false };
  }
}

// Backoffice session (password login, see lib/admin-session.ts).
export function useAuth() {
  const [state, setState] = useState<SessionState>({ isAdmin: false, configured: true, ready: false });

  useEffect(() => {
    let cancelled = false;
    fetchSession().then((s) => {
      if (!cancelled) setState({ ...s, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (password: string) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Sign in failed");
    setState((s) => ({ ...s, isAdmin: true }));
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setState((s) => ({ ...s, isAdmin: false }));
  }, []);

  return { ...state, signIn, signOut };
}
