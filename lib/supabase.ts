import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values (inlined at build time via next.config.ts); row-level security controls who can write.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
