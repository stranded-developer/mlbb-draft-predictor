"use client";

import { useState } from "react";
import type { Rank } from "@/lib/engine";
import { cn } from "@/lib/utils";

const FALLBACK: Record<Rank, { text: string; className: string }> = {
  legend: { text: "L", className: "bg-amber-700/40 text-amber-200" },
  mythic: { text: "M", className: "bg-purple-700/40 text-purple-200" },
  glory: { text: "G", className: "bg-yellow-500/30 text-yellow-200" },
  immortal: { text: "I", className: "bg-rose-600/40 text-rose-200" },
};

// Rank emblem from public/ranks/<rank>.png, with a small lettered badge until the image exists.
export function RankIcon({ rank, className }: { rank: Rank; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    const f = FALLBACK[rank];
    return <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold", f.className, className)}>{f.text}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static emblem
    <img
      src={`/ranks/${rank}.png`}
      alt=""
      className={cn("size-5 shrink-0 object-contain", className)}
      onError={() => setBroken(true)}
      // The image may have failed before hydration attached onError.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setBroken(true);
      }}
    />
  );
}
