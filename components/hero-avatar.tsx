"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { heroName } from "@/lib/heroes";

function initials(name: string) {
  return name.split(/[\s-]+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Round hero portrait with an initials fallback.
export function HeroAvatar({ slug, className }: { slug: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const name = heroName(slug);
  if (!slug || broken) {
    return (
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold", className)}>
        {slug ? initials(name) : "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static portraits, no optimization needed
    <img
      src={`/heroes/${slug}.png`}
      alt={name}
      className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      onError={() => setBroken(true)}
    />
  );
}

export function HeroChip({ slug, className }: { slug: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <HeroAvatar slug={slug} className="size-6" />
      <span className="truncate">{heroName(slug)}</span>
    </span>
  );
}
