// Data access shared by the draft page and the backoffice.
// Reads the knowledge base from Supabase when it's configured (via /api/config), otherwise falls back to the
// bundled seed in data/knowledge.js so the site still works offline or before the database exists.
const KB_TABLES = ["hero_profiles", "matchups", "synergies", "item_advice", "rules"];

const Store = (() => {
  let clientPromise = null;

  function client() {
    clientPromise ||= (async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return null;
        const { url, anonKey } = await res.json();
        if (!url || !anonKey || !window.supabase) return null;
        return window.supabase.createClient(url, anonKey);
      } catch {
        return null;
      }
    })();
    return clientPromise;
  }

  async function loadKB() {
    const db = await client();
    if (!db) return { ...KB, source: "seed" };
    const results = await Promise.all(KB_TABLES.map((t) => db.from(t).select("*")));
    const failed = results.find((r) => r.error);
    if (failed) {
      console.warn("Falling back to bundled knowledge:", failed.error.message);
      return { ...KB, source: "seed" };
    }
    return { ...Object.fromEntries(KB_TABLES.map((t, i) => [t, results[i].data])), source: "db" };
  }

  async function session() {
    const db = await client();
    if (!db) return null;
    const { data } = await db.auth.getSession();
    return data.session;
  }

  return { client, loadKB, session };
})();
