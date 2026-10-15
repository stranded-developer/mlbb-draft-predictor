import { adminConfigured, isAdmin } from "@/lib/admin-session";

export async function GET() {
  return Response.json({ admin: await isAdmin(), configured: adminConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
