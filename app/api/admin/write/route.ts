// All backoffice writes (and game logging) go through here: checks the admin session, then writes with the secret key.
import { adminDb, isAdmin } from "@/lib/admin-session";

const TABLES = ["hero_profiles", "matchups", "synergies", "item_advice", "rules", "games"] as const;
type Table = (typeof TABLES)[number];
// Text primary keys; every other table uses a generated numeric id.
const TEXT_KEY: Partial<Record<Table, string>> = { hero_profiles: "slug", rules: "id" };

type Body =
  | { action: "save"; table: Table; row: Record<string, unknown> }
  | { action: "delete"; table: Table; key: string; value: string | number };

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Sign in to the backoffice first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || !TABLES.includes(body.table)) return Response.json({ error: "Unknown table." }, { status: 400 });
  const db = adminDb();
  const table = body.table;

  if (body.action === "delete") {
    const allowedKey = TEXT_KEY[table] ?? "id";
    if (body.key !== allowedKey) return Response.json({ error: "Bad key." }, { status: 400 });
    const { error } = await db.from(table).delete().eq(body.key, body.value);
    return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ ok: true });
  }

  const row = { ...body.row };
  if (table !== "games") row.updated_at = new Date().toISOString();
  const textKey = TEXT_KEY[table];
  let query;
  if (textKey) query = db.from(table).upsert(row, { onConflict: textKey });
  else if (row.id != null) query = db.from(table).update(row).eq("id", row.id as number);
  else {
    delete row.id;
    query = db.from(table).insert(row);
  }
  const { data, error } = await query.select().single();
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ row: data });
}
