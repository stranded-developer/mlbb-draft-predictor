// Exposes the public Supabase URL and anon key to the static pages. Both are public by design;
// row-level security in supabase/schema.sql controls who can write.
module.exports = function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ url, anonKey });
};
