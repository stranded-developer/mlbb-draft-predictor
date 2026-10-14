"use client";

import { useEffect, useState } from "react";
import { SEED_KB, type KB } from "./kb";
import { supabase } from "./supabase";

const TABLES = ["hero_profiles", "matchups", "synergies", "item_advice", "rules"] as const;

// Returns the knowledge base from Supabase, or null when it can't be read.
async function fetchKb(): Promise<KB | null> {
  if (!supabase) return null;
  const results = await Promise.all(TABLES.map((t) => supabase!.from(t).select("*")));
  const failed = results.find((r) => r.error);
  if (failed) {
    console.warn("Falling back to bundled knowledge:", failed.error?.message);
    return null;
  }
  return Object.fromEntries(TABLES.map((t, i) => [t, results[i].data])) as KB;
}

// Loads the knowledge base from Supabase, falling back to the bundled seed when the database isn't reachable.
export function useKb() {
  const [kb, setKb] = useState<KB>(SEED_KB);
  const [source, setSource] = useState<"loading" | "db" | "seed">(supabase ? "loading" : "seed");

  useEffect(() => {
    let cancelled = false;
    fetchKb().then((data) => {
      if (cancelled) return;
      if (data) setKb(data);
      setSource(data ? "db" : "seed");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { kb, setKb, source };
}
