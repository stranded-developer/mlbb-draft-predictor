import type { KB } from "./kb";

export type Table = keyof KB | "games";

// Writes go through /api/admin/write, which checks the backoffice session and writes with the server-side key.
async function write<T>(body: object): Promise<T> {
  const res = await fetch("/api/admin/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status})`);
  return json as T;
}

// Inserts or updates one row and returns the saved row. Hero profiles and rules are keyed by their text id;
// everything else by the generated numeric id.
export async function saveRow<T extends object>(table: Table, row: T): Promise<T> {
  const { row: saved } = await write<{ row: T }>({ action: "save", table, row });
  return saved;
}

export async function deleteRow(table: Table, key: string, value: string | number) {
  await write({ action: "delete", table, key, value });
}
