import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Vercel env vars are named SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY; expose them to the browser.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  // Hero portraits are tiny pre-sized PNGs; skip the image optimizer.
  images: { unoptimized: true },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
