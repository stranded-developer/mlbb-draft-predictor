// Draft knowledge base types and constants.
// Practical, experience-based rules for ranked (solo queue, low coordination) — not raw win rates.
// The live data is edited in /admin and stored in Supabase; lib/seed.json is the starting data and offline fallback.
import seed from "./seed.json";

export type Status = "confirmed" | "theory";
export type MatchupKind = "hard" | "soft" | "conditional" | "not";

export type DamageType = "physical" | "magic" | "mixed";
export type Ratings = Partial<Record<RatingKey, number>>;

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
  damage_type: DamageType | null;
  roles: string[];
  ratings: Ratings;
  difficulty: number | null;
  specs_reviewed: boolean;
  tier: Tier | null;
  rank_bias: number; // −2 (stronger in high ranks) … +2 (stronger in low ranks)
  strong_vs_types: string[];
  weak_vs_types: string[];
  strong_vs_traits: string[]; // tags/ratings (see TRIGGER_TRAITS) this hero is good against
  weak_vs_traits: string[];
  good_with_traits: string[]; // traits it wants on its own team (e.g. Arlott with crowd control)
};

export type Tier = "S" | "A" | "B" | "C" | "D";
export const TIERS: { value: Tier; hint: string }[] = [
  { value: "S", hint: "Meta — swings drafts" },
  { value: "A", hint: "Strong, close to meta" },
  { value: "B", hint: "Average" },
  { value: "C", hint: "Weak in the meta" },
  { value: "D", hint: "Out of the meta" },
];

export const RANK_BIAS: { value: number; label: string }[] = [
  { value: -2, label: "Much better high" },
  { value: -1, label: "Better high" },
  { value: 0, label: "Same" },
  { value: 1, label: "Better low" },
  { value: 2, label: "Much better low" },
];

// Draft-type labels (see classify in lib/engine.ts), grouped by axis.
export const DRAFT_TYPES = {
  plan: ["Split push", "Pickoff", "Teamfight"],
  style: ["Front-to-back", "Poke", "Dive"],
  tempo: ["Early pressure", "Late scaling"],
};
export const ALL_DRAFT_TYPES = [...DRAFT_TYPES.plan, ...DRAFT_TYPES.style, ...DRAFT_TYPES.tempo];

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
  for_role: string | null;
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

// 0–5 capability ratings (0 = none, 5 = among the best). Drive the composition rules and win conditions.
// A real frontline is 4+; "thick" (needs anti-tank damage) is also 4+.
export const RATINGS = [
  { key: "frontline", label: "Frontline", hint: "Absorbs damage and protects the team (4+ = a real frontline)" },
  { key: "cc", label: "Crowd control", hint: "Amount and reliability of stuns, slows, taunts" },
  { key: "mobility", label: "Mobility", hint: "Dashes and gap-close — can reach or escape" },
  { key: "objective", label: "Objectives", hint: "Takes Lord, Turtle and turrets quickly" },
  { key: "hg_defense", label: "High-ground defense / wave clear", hint: "Clears waves and holds base: range and zone control" },
  { key: "teamfight", label: "Teamfight", hint: "Area impact in 5v5 fights" },
  { key: "pickoff", label: "Pickoff", hint: "Catches and bursts a single target" },
  { key: "sustain", label: "Sustain", hint: "Healing, lifesteal and regeneration" },
] as const;
export type RatingKey = (typeof RATINGS)[number]["key"];

export const ROLES = [
  { value: "exp", label: "EXP" },
  { value: "jungle", label: "Jungle" },
  { value: "mid", label: "Mid" },
  { value: "gold", label: "Gold" },
  { value: "roam", label: "Roam" },
];

export const DAMAGE_TYPES: { value: DamageType; label: string }[] = [
  { value: "physical", label: "Physical" },
  { value: "magic", label: "Magic" },
  { value: "mixed", label: "Mixed" },
];

// Yes/no hero traits. `counterable: false` traits describe the hero (used as reasons and bonuses) but can't be
// picked under "strong against" or "good with allies" — nobody is specifically good against true damage.
export const TAGS: { value: string; label: string; hint: string; counterable: boolean }[] = [
  { value: "thick", label: "Tank", hint: "Very hard to kill — needs anti-tank damage", counterable: true },
  { value: "enchanter", label: "Support / healer", hint: "Healer/buffer support that needs a tank or sustain hero", counterable: true },
  { value: "dive", label: "Dive", hint: "Commits onto the backline (with sustain: brawls through pickoff)", counterable: true },
  { value: "pickoff", label: "Pickoff", hint: "Catches and bursts single targets", counterable: true },
  { value: "poke", label: "Poke", hint: "Damages from long range before fights start", counterable: true },
  { value: "split", label: "Split pusher", hint: "Pushes side lanes fast on their own", counterable: true },
  { value: "dash", label: "Dash-reliant", hint: "Kit depends on dashing", counterable: true },
  { value: "escape", label: "Escape", hint: "Can get out of fights easily — hard to pick off", counterable: true },
  { value: "burst", label: "Burst damage", hint: "Kills in one quick combo", counterable: true },
  { value: "sustained", label: "Sustained damage", hint: "Damage over time in long fights — grinds tanks down", counterable: true },
  { value: "stealth", label: "Camouflage", hint: "Camouflage/invisibility — beats heroes that rely on targeting", counterable: true },
  { value: "targeted", label: "Relies on targeting", hint: "Point-and-click or lock-on skills — weak to camouflage", counterable: true },
  { value: "true_damage", label: "True damage", hint: "Deals true damage — counts as anti-tank", counterable: false },
  { value: "global", label: "Global presence", hint: "Can affect fights anywhere on the map — small bonus", counterable: false },
  { value: "anti_dash", label: "Anti-dash", hint: "Stops dashes and blinks", counterable: false },
  { value: "anti_heal", label: "Anti-heal", hint: "Cuts enemy healing and shields from their kit", counterable: false },
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
    damage_type: null, roles: [], ratings: {}, difficulty: null, specs_reviewed: false,
    tier: null, rank_bias: 0, strong_vs_types: [], weak_vs_types: [], strong_vs_traits: [], weak_vs_traits: [], good_with_traits: [],
  };
}

// Item triggers are stored as "enemy:<slug>", "enemy_tag:<tag or rating>>=<n>" or "enemy_damage:<type>>=<n>".
// A rating in enemy_tag counts heroes rated 2 or higher in it (e.g. enemy_tag:sustain>=3).
export type Trigger =
  | { type: "hero"; hero: string }
  | { type: "tag"; tag: string; count: number }
  | { type: "damage"; damage: DamageType; count: number };

export function parseTrigger(trigger: string): Trigger {
  const tag = trigger.match(/^enemy_tag:(\w+)>=(\d+)$/);
  if (tag) return { type: "tag", tag: tag[1], count: Number(tag[2]) };
  const dmg = trigger.match(/^enemy_damage:(\w+)>=(\d+)$/);
  if (dmg) return { type: "damage", damage: dmg[1] as DamageType, count: Number(dmg[2]) };
  return { type: "hero", hero: trigger.replace(/^enemy:/, "") };
}

export function formatTrigger(t: Trigger): string {
  if (t.type === "hero") return `enemy:${t.hero}`;
  if (t.type === "damage") return `enemy_damage:${t.damage}>=${t.count}`;
  return `enemy_tag:${t.tag}>=${t.count}`;
}

// Hero traits for "strong/weak against", "good with allies" and item triggers: tags, derived traits and strong ratings.
// Teamfight isn't offered (it overlaps crowd control).
export const TRIGGER_TRAITS = [
  { value: "lockdown", label: "Suppression / lockdown (CC 4+)", counterable: true },
  { value: "immobile", label: "Immobile (mobility 0–1)", counterable: true },
  ...TAGS.map((t) => ({ value: t.value, label: t.label, counterable: t.counterable })),
  // Ratings, except teamfight and any that share a name with a tag (pickoff: the tag covers it).
  ...RATINGS.filter((r) => r.key !== "teamfight" && !TAGS.some((t) => t.value === r.key))
    .map((r) => ({ value: r.key as string, label: `Strong ${r.label.toLowerCase()}`, counterable: true })),
];
// What a hero can be strong against or want on its team (no anti-… or descriptive-only traits).
export const STRONG_TRAITS = TRIGGER_TRAITS.filter((t) => t.counterable);
