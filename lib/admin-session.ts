// Server-only: password-only backoffice login. The password lives in the ADMIN_PASSWORD env var (never in code);
// a successful login gets a signed, HTTP-only session cookie. Writes then go through the server with the Supabase
// secret key, so the browser never holds a write-capable key.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const SESSION_COOKIE = "mlbb_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const secretKey = () => process.env.SUPABASE_SECRET_KEY ?? "";

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && secretKey() && process.env.SUPABASE_URL);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();
const sign = (payload: string) => createHmac("sha256", secretKey()).update(payload).digest("base64url");

export function passwordMatches(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare fixed-length hashes so timing doesn't leak the password length or content.
  return timingSafeEqual(sha256(input), sha256(expected));
}

export function createSessionToken() {
  const payload = `admin.${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string | undefined) {
  if (!token || !secretKey()) return false;
  const i = token.lastIndexOf(".");
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return false;
  return Number(payload.split(".")[1]) > Date.now();
}

export async function isAdmin() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

// Supabase client with the secret key — bypasses row-level security. Only ever used after isAdmin().
export function adminDb() {
  return createClient(process.env.SUPABASE_URL!, secretKey(), { auth: { persistSession: false } });
}
