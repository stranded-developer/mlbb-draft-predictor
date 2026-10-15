import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, adminConfigured, createSessionToken, passwordMatches } from "@/lib/admin-session";

export async function POST(request: Request) {
  if (!adminConfigured()) return Response.json({ error: "Backoffice login isn't set up yet." }, { status: 503 });
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json({ ok: true });
}
