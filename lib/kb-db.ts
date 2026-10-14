import type { KB } from "./kb";
import { supabase } from "./supabase";

export type Table = keyof KB | "games";

// Inserts or updates one row and returns the saved row. Hero profiles and rules are keyed by their text id;
// everything else by the generated numeric id.
export async function saveRow<T extends object>(table: Table, row: T): Promise<T> {
  if (!supabase) throw new Error("Database not connected");
  const data = { ...row } as Record<string, unknown>;
  if (table !== "games") data.updated_at = new Date().toISOString();

  let query;
  if (table === "hero_profiles") query = supabase.from(table).upsert(data, { onConflict: "slug" });
  else if (table === "rules") query = supabase.from(table).upsert(data, { onConflict: "id" });
  else if (data.id != null) query = supabase.from(table).update(data).eq("id", data.id as number);
  else {
    delete data.id;
    query = supabase.from(table).insert(data);
  }
  const { data: saved, error } = await query.select().single();
  if (error) throw new Error(error.message);
  return saved as T;
}

export async function deleteRow(table: Table, key: string, value: string | number) {
  if (!supabase) throw new Error("Database not connected");
  const { error } = await supabase.from(table).delete().eq(key, value);
  if (error) throw new Error(error.message);
}
