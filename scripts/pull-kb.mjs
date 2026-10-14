// Pulls the live knowledge base from Supabase into lib/seed.json, so local edits (and review migrations
// generated from it) build on what's been changed in the backoffice. Read-only; uses the public key.
// Usage: node --env-file=.env.local scripts/pull-kb.mjs
import fs from "node:fs";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not set (run `vercel env pull .env.local`).");
  process.exit(1);
}

const root = path.join(import.meta.dirname, "..");
const seedPath = path.join(root, "lib/seed.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const order = { hero_profiles: "slug", matchups: "id", synergies: "id", item_advice: "id", rules: "id" };

for (const [table, sort] of Object.entries(order)) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&order=${sort}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  // Keep the seed's column set and order; drop database-only columns (id, updated_at).
  const cols = Object.keys(seed[table][0] ?? rows[0] ?? {});
  seed[table] = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? seed[table][0]?.[c] ?? null])));
  console.log(`${table}: ${rows.length}`);
}
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 1));
console.log("wrote lib/seed.json");
