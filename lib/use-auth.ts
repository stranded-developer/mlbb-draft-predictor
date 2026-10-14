"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Current session plus whether the signed-in email is in the `admins` table (the only accounts allowed to write).
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    const check = async (s: Session | null) => {
      setSession(s);
      if (s) {
        const { data } = await supabase!.from("admins").select("email").limit(1);
        setIsAdmin(Boolean(data?.length));
      } else {
        setIsAdmin(false);
      }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => check(data.session));
    // Defer: calling Supabase inside the auth callback can deadlock the client.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => check(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, isAdmin, ready };
}
