// Draft knowledge base types and constants.
// Practical, experience-based rules for ranked (solo queue, low coordination) — not raw win rates.
// The live data is edited in /admin and stored in Supabase; lib/seed.json is the starting data and offline fallback.
import seed from "./seed.json";

export type Status = "confirmed" | "theory";
export type MatchupKind = "hard" | "soft" | "conditional" | "not";

export type HeroProfile = {
  slug: string;
  is_meta: boolean;
  ban_recommended: boolean;
  ban_note: string;
  tags: string[];
  power_early: number | null;
  power_mid: number | null;
  power_late: number | null;
  notes: string;
  status: Status;
};

export type Matchup = {
  id?: number;
  counter: string;
  target: string;
  kind: MatchupKind;
  points: number | null;
  why: string;
  status: Status;
};

export type Synergy = {
  id?: number;
  hero_a: string;
  hero_b: string;
  points: number;
  why: string;
  status: Status;
};

export type ItemAdvice = {
  id?: number;
  trigger: string;
  item: string;
  why: string;
  status: Status;
};

export type Rule = {
  id: string;
  weight: number;
  description: string;
  status: Status;
};

export type Game = {
  id?: number;
  played_at?: string;
  red: string[];
  blue: string[];
  red_bans: string[];
  blue_bans: string[];
  winner: "red" | "blue";
  predicted?: number | null;
  reasoning: string;
  rank: string;
  duration_min: number | null;
};

export type KB = {
  hero_profiles: HeroProfile[];
  matchups: Matchup[];
  synergies: Synergy[];
  item_advice: ItemAdvice[];
  rules: Rule[];
};

export const SEED_KB = seed as KB;

// Advantage scale: advantage = practical win chance − 50. 0 = even (skill decides), 50 = unwinnable for the other side.
export const ADVANTAGE_MAX = 50;
export const BANS_PER_TEAM = 5;

// Default advantage points per matchup kind when a matchup has no explicit points.
export const MATCHUP_POINTS: Record<MatchupKind, number> = { hard: 6, soft: 3, conditional: 1.5, not: 0 };

export const MATCHUP_KINDS: { value: MatchupKind; label: string; hint: string }[] = [
  { value: "hard", label: "Hard", hint: "Reliably beats them" },
  { value: "soft", label: "Soft", hint: "Has the edge" },
  { value: "conditional", label: "Conditional", hint: "Only in some situations" },
  { value: "not", label: "Not a counter", hint: "Looks like one on paper, isn't in practice" },
];

// Capability tags used by composition rules.
export const TAGS: { value: string; label: string; hint: string }[] = [
  { value: "frontline", label: "Frontline", hint: "Tank or tanky fighter who can shield the team" },
  { value: "thick", label: "Thick", hint: "High HP / very hard to kill — needs anti-tank damage" },
  { value: "enchanter", label: "Enchanter", hint: "Healer/buffer support that needs a frontline" },
  { value: "anti_tank", label: "Anti-tank", hint: "Damage that kills thick heroes (true or % damage)" },
  { value: "true_damage", label: "True damage", hint: "Deals true damage" },
  { value: "split", label: "Split pusher", hint: "Pushes side lanes fast on their own" },
  { value: "rush", label: "Rush", hint: "Sustain-heavy dive that can't be burst" },
  { value: "pickoff", label: "Pickoff", hint: "Catches and bursts single targets" },
  { value: "slow_teamfight", label: "Slow teamfight", hint: "Grouped tank/enchanter fighting style" },
  { value: "anti_dash", label: "Anti-dash", hint: "Stops dashes and blinks" },
  { value: "dash", label: "Dash-reliant", hint: "Kit depends on dashing" },
  { value: "anti_walking", label: "Anti-walking", hint: "Punishes heroes without mobility" },
];
export const TAG_LABEL = new Map(TAGS.map((t) => [t.value, t.label]));

// Item and battle spell names offered as autocomplete in the backoffice.
export const ITEM_SUGGESTIONS = [
  "Winter Crown", "Malefic Roar", "Malefic Gun", "Dominance Ice", "Sea Halberd", "Necklace of Durance",
  "Antique Cuirass", "Blade Armor", "Radiant Armor", "Athena's Shield", "Immortality", "Demon Hunter Sword",
  "Glowing Wand", "Divine Glaive", "Brute Force Breastplate", "Thunder Belt", "Oracle", "Rose Gold Meteor",
  "Wind of Nature", "Blade of Despair", "Corrosion Scythe", "Golden Staff", "Haas's Claws", "Hunter Strike",
  "Queen's Wings", "Bloodlust Axe", "War Axe", "Guardian Helmet", "Cursed Helmet", "Twilight Armor",
  "Holy Crystal", "Blood Wings", "Genius Wand", "Concentrated Energy", "Feather of Heaven", "Starlium Scythe",
  "Lightning Truncheon", "Clock of Destiny", "Ice Queen Wand", "Enchanted Talisman", "Fleeting Time",
  "Endless Battle", "Sky Piercer", "Great Dragon Spear", "Berserker's Fury", "Windtalker", "Scarlet Phantom",
  "Purify (spell)", "Flicker (spell)", "Vengeance (spell)", "Petrify (spell)", "Aegis (spell)",
  "Execute (spell)", "Retribution (spell)", "Inspire (spell)", "Sprint (spell)", "Revitalize (spell)",
  "Flameshot (spell)", "Arrival (spell)",
];

export function emptyProfile(slug: string): HeroProfile {
  return {
    slug, is_meta: false, ban_recommended: false, ban_note: "", tags: [],
    power_early: null, power_mid: null, power_late: null, notes: "", status: "theory",
  };
}

// Item triggers are stored as "enemy:<slug>" or "enemy_tag:<tag>>=<n>".
export type Trigger = { type: "hero"; hero: string } | { type: "tag"; tag: string; count: number };

export function parseTrigger(trigger: string): Trigger {
  const tag = trigger.match(/^enemy_tag:(\w+)>=(\d+)$/);
  if (tag) return { type: "tag", tag: tag[1], count: Number(tag[2]) };
  return { type: "hero", hero: trigger.replace(/^enemy:/, "") };
}

export function formatTrigger(t: Trigger): string {
  return t.type === "hero" ? `enemy:${t.hero}` : `enemy_tag:${t.tag}>=${t.count}`;
}
