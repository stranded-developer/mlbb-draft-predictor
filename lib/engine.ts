// Draft scoring engine. Turns the knowledge base into an advantage for one side, with the reasons behind it.
// Points come from counters, synergies, meta picks and composition rules; the net points are mapped onto the
// practical 0–50 advantage scale with a saturating curve, so stacked flaws climb toward ~40 but never reach 50.
import { heroName } from "./heroes";
import {
  ADVANTAGE_MAX, MATCHUP_POINTS, RATINGS, TRIGGER_TRAITS, parseTrigger,
  type HeroProfile, type KB, type Matchup, type RatingKey, type Status,
} from "./kb";

export type Side = "red" | "blue";
export type Phase = "early" | "mid" | "late";
export const PHASES: Phase[] = ["early", "mid", "late"];
const TRAIT_LABEL = new Map(TRIGGER_TRAITS.map((t) => [t.value, t.label]));

export type Reason = {
  side: Side; // who benefits
  points: number;
  category: "counter" | "synergy" | "meta" | "rule";
  title: string;
  why?: string;
  status: Status;
  heroes: string[];
};

export type ItemTip = { item: string; why: string; status: Status; because: string[]; forHeroes: string[] };

// What kind of draft a team is, on three axes. `second` is set when another label is close (a mixed draft).
export type TypeLabel = { label: string; second?: string };
export type DraftType = { plan: TypeLabel; style: TypeLabel; tempo: TypeLabel };

export type PhaseResult = { advantage: number; favored: Side | null };

export type Analysis = {
  points: Record<Side, number>;
  advantage: number; // 0–50
  favored: Side | null;
  phases: Record<Phase, PhaseResult>;
  reasons: Reason[];
  items: Record<Side, ItemTip[]>;
  winConditions: Record<Side, string[]>;
  types: Record<Side, DraftType>;
  unreviewed: string[]; // heroes in the draft whose specs are still drafts
};

export const other = (s: Side): Side => (s === "red" ? "blue" : "red");

// The rank the game is played at: rank-sensitive heroes gain points in low ranks and lose them in high ranks.
export type Rank = "low" | "mid" | "high";
export type Queue = "solo" | "party";
export type Context = { rank: Rank; queue: Queue };
export const DEFAULT_CONTEXT: Context = { rank: "mid", queue: "solo" };
const RANK_SIGN: Record<Rank, number> = { low: 1, mid: 0, high: -1 };

// Thresholds on the 0–5 rating scale.
const FRONTLINE = 4; // a real frontline
const HIGH = 3; // "high" in a rating (item triggers, heavy sustain)
const names = (slugs: string[]) => slugs.map(heroName).join(", ");

// Read-only view over the knowledge base with the lookups the engine needs.
export class Knowledge {
  private profiles: Map<string, HeroProfile>;
  private rules: Map<string, { weight: number; status: Status }>;
  constructor(public kb: KB) {
    this.profiles = new Map(kb.hero_profiles.map((p) => [p.slug, p]));
    this.rules = new Map(kb.rules.map((r) => [r.id, r]));
  }
  profile(slug: string) {
    return this.profiles.get(slug);
  }
  tags(slug: string) {
    return this.profiles.get(slug)?.tags ?? [];
  }
  has(slug: string, tag: string) {
    return this.tags(slug).includes(tag);
  }
  rating(slug: string, key: RatingKey): number {
    const r = this.profiles.get(slug)?.ratings?.[key];
    if (r != null) return r;
    // Fall back to tags for heroes without ratings.
    if (key === "frontline") return this.has(slug, "frontline") ? 5 : this.has(slug, "thick") ? 4 : 0;
    return 0;
  }
  thick(slug: string) {
    return this.has(slug, "thick") || this.rating(slug, "frontline") >= FRONTLINE;
  }
  roles(slug: string) {
    return this.profiles.get(slug)?.roles ?? [];
  }
  // Counts toward an item trigger: a tag, a high rating, or "thick".
  trait(slug: string, trait: string) {
    if (trait === "thick") return this.thick(slug);
    if (trait === "lockdown") return this.rating(slug, "cc") >= 4;
    if (RATINGS.some((r) => r.key === trait)) return this.rating(slug, trait as RatingKey) >= HIGH;
    return this.has(slug, trait);
  }
  rule(id: string) {
    return this.rules.get(id);
  }
  setting(id: string, fallback: number) {
    return this.rules.get(id)?.weight ?? fallback;
  }
  // Meta tier points (S/A positive, C/D negative) plus rank-sensitivity points for the game's rank.
  heroPoints(slug: string, ctx: Context) {
    const p = this.profiles.get(slug);
    const out: { text: string; points: number; status: Status }[] = [];
    const tier = p?.tier && this.rule(`tier-${p.tier.toLowerCase()}`);
    if (tier && tier.weight) out.push({ text: `${p!.tier}-tier hero`, points: tier.weight, status: tier.status });
    const bias = this.rule("rank-bias");
    // Low coordination (low rank, solo queue) favours rank-sensitive heroes; high rank / party queue punishes them.
    const solo = this.setting("setting-solo-queue", 0.5);
    const coordination = RANK_SIGN[ctx.rank] + (ctx.queue === "solo" ? solo : -solo);
    if (bias && p?.rank_bias && coordination) {
      const points = bias.weight * p.rank_bias * coordination;
      const where = `${ctx.rank} rank ${ctx.queue} queue`;
      out.push({ text: points > 0 ? `Stronger in ${where}` : `Weaker in ${where}`, points, status: bias.status });
    }
    return out;
  }
  matchupPoints(m: Matchup) {
    return m.points ?? MATCHUP_POINTS[m.kind];
  }
  // Real counters (kind hard/soft/conditional) of one hero against another.
  counters(counter: string, target: string) {
    return this.kb.matchups.filter((m) => m.counter === counter && m.target === target && m.kind !== "not");
  }
}

export function curve(net: number, scale: number) {
  const value = ADVANTAGE_MAX * (1 - Math.exp(-Math.abs(net) / Math.max(scale, 1)));
  return Math.sign(net) * value;
}

const toResult = (signed: number): PhaseResult => ({
  advantage: Math.round(Math.abs(signed)),
  favored: Math.round(Math.abs(signed)) === 0 ? null : signed > 0 ? "red" : "blue",
});

// Highest-scoring label, or a mixed pair when the runner-up is close.
function pick(scores: Record<string, number>, fallback: string): TypeLabel {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] <= 0) return { label: fallback };
  const [first, second] = sorted;
  return second && second[1] > 0 && second[1] >= first[1] * 0.85 ? { label: first[0], second: second[0] } : { label: first[0] };
}

export function classify(k: Knowledge, team: string[]): DraftType {
  const sum = (key: RatingKey) => team.reduce((s, h) => s + k.rating(h, key), 0);
  const count = (fn: (h: string) => boolean) => team.filter(fn).length;
  const plan = pick({
    "Split push": count((h) => k.has(h, "split")) * 8 + count((h) => k.rating(h, "wave_clear") >= 4 && k.rating(h, "objective") >= 4),
    Pickoff: sum("pickoff") + count((h) => k.has(h, "pickoff")) * 2,
    Teamfight: sum("teamfight") + count((h) => k.has(h, "rush")),
  }, "Teamfight");
  const style = pick({
    "Front-to-back": count((h) => k.rating(h, "frontline") >= FRONTLINE) * 2 + count((h) => k.roles(h)[0] === "gold" && k.rating(h, "mobility") <= 3) * 2,
    Poke: count((h) => k.has(h, "poke")) * 3,
    Dive: count((h) => k.has(h, "dive") || (k.rating(h, "mobility") >= 3 && (k.rating(h, "frontline") >= 3 || k.rating(h, "pickoff") >= 4))) * 2,
  }, "Front-to-back");
  const early = phasePower(k, team, "early");
  const late = phasePower(k, team, "late");
  const tempo = { label: early - late > 0.4 ? "Early pressure" : late - early > 0.4 ? "Late scaling" : "Balanced" };
  return { plan, style, tempo };
}

const typeName = (t: TypeLabel) => (t.second ? `${t.label} / ${t.second}` : t.label);
// Every label a draft has (including mixed second labels).
const typeLabels = (t: DraftType) => [t.plan, t.style, t.tempo].flatMap((x) => (x.second ? [x.label, x.second] : [x.label]));
export const describeType = (t: DraftType) => [t.plan, t.style, t.tempo].map(typeName);

// Points one side gets from facing the other: counters, synergies, meta. Usable for partial drafts.
export function matchupReasons(k: Knowledge, teams: Record<Side, string[]>, ctx: Context = DEFAULT_CONTEXT): Reason[] {
  const reasons: Reason[] = [];
  for (const side of ["red", "blue"] as Side[]) {
    const team = teams[side];
    const enemy = teams[other(side)];
    for (const a of team) {
      for (const b of enemy) {
        for (const m of k.counters(a, b)) {
          reasons.push({
            side, points: k.matchupPoints(m), category: "counter", status: m.status, heroes: [a, b],
            title: `${heroName(a)} ${m.kind === "hard" ? "hard counters" : m.kind === "soft" ? "counters" : "can counter"} ${heroName(b)}`,
            why: m.why || undefined,
          });
        }
      }
    }
    for (const s of k.kb.synergies) {
      if (team.includes(s.hero_a) && team.includes(s.hero_b)) {
        reasons.push({
          side, points: s.points, category: "synergy", status: s.status, heroes: [s.hero_a, s.hero_b],
          title: `${heroName(s.hero_a)} + ${heroName(s.hero_b)} synergy`, why: s.why || undefined,
        });
      }
    }
    for (const h of team) {
      for (const hp of k.heroPoints(h, ctx)) {
        // Negative points (weak tier, wrong rank) go to the other side.
        reasons.push({
          side: hp.points > 0 ? side : other(side), points: Math.abs(hp.points), category: "meta", status: hp.status, heroes: [h],
          title: `${heroName(h)}: ${hp.text}`,
        });
      }
    }
  }
  return reasons;
}

// Composition rules for complete teams. A broken rule gives points to the other side.
export function ruleReasons(k: Knowledge, teams: Record<Side, string[]>): Reason[] {
  const reasons: Reason[] = [];
  const add = (id: string, side: Side, title: string, heroes: string[] = []) => {
    const r = k.rule(id);
    if (r) reasons.push({ side, points: r.weight, category: "rule", status: r.status, heroes, title, why: k.kb.rules.find((x) => x.id === id)?.description });
  };

  for (const side of ["red", "blue"] as Side[]) {
    const team = teams[side];
    const enemy = teams[other(side)];
    const T = side === "red" ? "Red" : "Blue";
    const E = side === "red" ? "Blue" : "Red";
    const winner = other(side);
    const frontMax = Math.max(0, ...team.map((h) => k.rating(h, "frontline")));

    if (frontMax < FRONTLINE) add("no-frontline", winner, `${T} has no frontline`);
    // Enchanters need a tank or another sustain hero to keep the team alive.
    const enchanters = team.filter((h) => k.has(h, "enchanter"));
    const protectors = team.filter((h) => !k.has(h, "enchanter") && (k.rating(h, "frontline") >= FRONTLINE || k.rating(h, "sustain") >= 4));
    if (enchanters.length && !protectors.length) add("enchanter-no-frontline", winner, `${T}'s ${names(enchanters)} has no tank or sustain hero to protect`, enchanters);

    const thick = enemy.filter((h) => k.thick(h));
    if (thick.length >= 2 && !team.some((h) => k.has(h, "anti_tank"))) {
      add("no-anti-tank", winner, `${E} has ${thick.length} thick heroes (${names(thick)}) and ${T} has no anti-tank damage`, thick);
    }

    const types = team.map((h) => k.profile(h)?.damage_type).filter(Boolean);
    if (types.length === team.length && !types.includes("mixed") && new Set(types).size === 1) {
      add("single-damage-type", winner, `${T} deals only ${types[0]} damage — easy to itemize against`);
    }

    for (const splitter of enemy.filter((h) => k.has(h, "split"))) {
      const answered = team.some((h) => k.counters(h, splitter).some((m) => m.kind !== "conditional"));
      if (!answered) add("no-split-answer", winner, `${T} has no answer to ${heroName(splitter)}'s split push`, [splitter]);
    }

    if (!team.some((h) => k.roles(h).includes("jungle"))) add("no-jungler", winner, `${T} has no jungler`);

    const sustainers = enemy.filter((h) => k.rating(h, "sustain") >= HIGH);
    if (sustainers.length >= 3 && !team.some((h) => k.has(h, "anti_heal"))) {
      add("no-anti-heal", winner, `${E} has heavy sustain (${names(sustainers)}) and ${T} has no anti-heal hero`, sustainers);
    }

    const rush = team.filter((h) => k.has(h, "rush"));
    const pickoff = enemy.filter((h) => k.has(h, "pickoff"));
    if (rush.length >= 2 && pickoff.length >= 2) add("rush-beats-pickoff", side, `${T}'s rush (${names(rush)}) beats ${E}'s pickoff (${names(pickoff)})`, [...rush, ...pickoff]);

    const split = team.filter((h) => k.has(h, "split"));
    const slow = enemy.filter((h) => k.has(h, "slow_teamfight"));
    if (split.length && slow.length >= 2) add("split-beats-slow-teamfight", side, `${T}'s split push (${names(split)}) beats ${E}'s slow teamfight (${names(slow)})`, [...split, ...slow]);

    // Fight-style matchups (primary style only).
    const mine = classify(k, team).style.label;
    const theirs = classify(k, enemy).style.label;
    const beats: Record<string, [string, string]> = {
      Dive: ["Poke", "dive-beats-poke"],
      Poke: ["Front-to-back", "poke-beats-front-to-back"],
      "Front-to-back": ["Dive", "front-to-back-beats-dive"],
    };
    if (beats[mine]?.[0] === theirs) add(beats[mine][1], side, `${T}'s ${mine.toLowerCase()} style beats ${E}'s ${theirs.toLowerCase()}`);

    // Heroes that are strong or weak against the enemy's draft type.
    const enemyTypes = typeLabels(classify(k, enemy));
    const fit = k.rule("type-fit");
    if (fit) {
      for (const h of team) {
        const p = k.profile(h);
        const strong = (p?.strong_vs_types ?? []).filter((t) => enemyTypes.includes(t));
        const weak = (p?.weak_vs_types ?? []).filter((t) => enemyTypes.includes(t));
        if (strong.length) reasons.push({ side, points: fit.weight, category: "rule", status: fit.status, heroes: [h], title: `${heroName(h)} is strong against ${E}'s ${strong.join(" / ").toLowerCase()} draft` });
        if (weak.length) reasons.push({ side: winner, points: fit.weight, category: "rule", status: fit.status, heroes: [h], title: `${heroName(h)} is weak against ${E}'s ${weak.join(" / ").toLowerCase()} draft` });
      }
    }

    // Heroes that are strong or weak against enemy traits (e.g. Alpha vs thick heroes, Alucard vs crowd control).
    const traitFit = k.rule("trait-fit");
    if (traitFit) {
      for (const h of team) {
        const p = k.profile(h);
        for (const [list, good] of [[p?.strong_vs_traits ?? [], true], [p?.weak_vs_traits ?? [], false]] as const) {
          for (const trait of list) {
            const matching = enemy.filter((e) => k.trait(e, trait));
            if (!matching.length) continue;
            reasons.push({
              side: good ? side : winner, points: traitFit.weight, category: "rule", status: traitFit.status, heroes: [h, ...matching],
              title: `${heroName(h)} is ${good ? "strong" : "weak"} against ${TRAIT_LABEL.get(trait)?.toLowerCase() ?? trait} heroes (${names(matching)})`,
            });
          }
        }
      }
    }

    const allyFit = k.rule("ally-trait-fit");
    if (allyFit) {
      for (const h of team) {
        for (const trait of k.profile(h)?.good_with_traits ?? []) {
          const allies = team.filter((a) => a !== h && k.trait(a, trait));
          if (allies.length) {
            reasons.push({
              side, points: allyFit.weight, category: "synergy", status: allyFit.status, heroes: [h, ...allies],
              title: `${heroName(h)} works with ${TRAIT_LABEL.get(trait)?.toLowerCase() ?? trait} allies (${names(allies)})`,
            });
          }
        }
      }
    }

    const stealth = team.filter((h) => k.has(h, "stealth"));
    const targeted = enemy.filter((h) => k.has(h, "targeted"));
    if (stealth.length && targeted.length >= 2) add("stealth-vs-targeted", side, `${T}'s ${names(stealth)} camouflage beats ${E}'s targeting heroes (${names(targeted)})`, [...stealth, ...targeted]);
  }
  return reasons;
}

// Average power per phase (unrated phases count as 3 = average).
function phasePower(k: Knowledge, team: string[], phase: Phase) {
  const key = `power_${phase}` as const;
  return team.reduce((sum, h) => sum + (k.profile(h)?.[key] ?? 3), 0) / Math.max(team.length, 1);
}

// Which teammate plays a role: their main role first, otherwise anyone who can play it.
function playersOf(k: Knowledge, team: string[], role: string) {
  const main = team.filter((h) => k.roles(h)[0] === role);
  return main.length ? main : team.filter((h) => k.roles(h).includes(role)).slice(0, 1);
}

function itemTips(k: Knowledge, team: string[], enemy: string[]): ItemTip[] {
  const tips: ItemTip[] = [];
  for (const a of k.kb.item_advice) {
    const t = parseTrigger(a.trigger);
    let because: string[] = [];
    if (t.type === "hero" && enemy.includes(t.hero)) because = [t.hero];
    if (t.type === "tag") {
      const matching = enemy.filter((h) => k.trait(h, t.tag));
      if (matching.length >= t.count) because = matching;
    }
    if (t.type === "damage") {
      const matching = enemy.filter((h) => k.profile(h)?.damage_type === t.damage);
      if (matching.length >= t.count) because = matching;
    }
    if (!because.length) continue;
    const forHeroes = a.for_role ? playersOf(k, team, a.for_role) : [];
    if (a.for_role && !forHeroes.length) continue;
    tips.push({ item: a.item, why: a.why, status: a.status, because, forHeroes });
  }
  return tips;
}

function winConditions(k: Knowledge, side: Side, teams: Record<Side, string[]>, phases: Record<Phase, PhaseResult>): string[] {
  const team = teams[side];
  const enemy = teams[other(side)];
  const out: string[] = [];
  const favoredIn = PHASES.filter((p) => phases[p].favored === side);
  const behindIn = PHASES.filter((p) => phases[p].favored === other(side));
  if (favoredIn.length === 3) out.push("Ahead in every phase — play your game and avoid throwing.");
  else if (favoredIn.includes("early") && !favoredIn.includes("late")) out.push("Play fast: snowball the early game and end before late game — the enemy outscales you.");
  else if (favoredIn.includes("late") && !favoredIn.includes("early")) out.push("Survive the early game, give up nothing risky, and win late.");
  else if (favoredIn.includes("mid")) out.push("Your window is mid game — force objectives around Lord before the enemy scales.");
  else if (behindIn.length === 3) out.push("Behind on paper in every phase — win through better execution and punish their mistakes.");
  else if (behindIn.length === 0) out.push("Even draft — execution decides.");
  else if (!behindIn.includes("late")) out.push("Weather their early pressure — the draft evens out late.");
  else out.push("They outscale you — take fights early while it's even.");

  const split = team.filter((h) => k.has(h, "split"));
  if (split.length) out.push(`Split push with ${names(split)} while the team holds mid.`);
  if (team.filter((h) => k.has(h, "rush")).length >= 2) out.push("Group and dive together — your sustain wins long fights.");
  if (team.filter((h) => k.has(h, "pickoff")).length >= 2) out.push("Catch isolated heroes from vision; avoid long 5v5 fights.");
  const anti = team.filter((h) => k.has(h, "anti_tank"));
  if (anti.length && enemy.filter((h) => k.thick(h)).length >= 2) out.push(`Protect ${names(anti)} — the answer to their tanks.`);
  const teamfight = team.reduce((s, h) => s + k.rating(h, "teamfight"), 0);
  if (teamfight >= 20) out.push("Force 5v5 teamfights around objectives — your teamfight is stronger.");
  return out.slice(0, 4);
}

export function analyze(kb: KB, teams: Record<Side, string[]>, ctx: Context = DEFAULT_CONTEXT): Analysis {
  const k = new Knowledge(kb);
  const reasons = [...matchupReasons(k, teams, ctx), ...ruleReasons(k, teams)].sort((a, b) => b.points - a.points);
  const points = { red: 0, blue: 0 };
  for (const r of reasons) points[r.side] += r.points;
  const net = points.red - points.blue;

  const scale = k.setting("setting-curve", 40);
  const phaseWeight = k.setting("setting-phase-weight", 4);
  const phaseDiff = Object.fromEntries(
    PHASES.map((p) => [p, (phasePower(k, teams.red, p) - phasePower(k, teams.blue, p)) * phaseWeight]),
  ) as Record<Phase, number>;
  const phases = Object.fromEntries(PHASES.map((p) => [p, toResult(curve(net + phaseDiff[p], scale))])) as Record<Phase, PhaseResult>;
  const avgPhase = PHASES.reduce((s, p) => s + phaseDiff[p], 0) / PHASES.length;
  const overall = toResult(curve(net + avgPhase, scale));

  const all = [...teams.red, ...teams.blue];
  return {
    points,
    advantage: overall.advantage,
    favored: overall.favored,
    phases,
    reasons,
    items: { red: itemTips(k, teams.red, teams.blue), blue: itemTips(k, teams.blue, teams.red) },
    winConditions: { red: winConditions(k, "red", teams, phases), blue: winConditions(k, "blue", teams, phases) },
    types: { red: classify(k, teams.red), blue: classify(k, teams.blue) },
    unreviewed: all.filter((h) => !k.profile(h)?.specs_reviewed),
  };
}

export type Suggestion = { slug: string; score: number; reasons: { text: string; points: number; status: Status }[] };

// Can every hero get a different role from their role list? (Lanes aren't fixed, but two heroes can't both jungle.)
function rolesFit(k: Knowledge, heroes: string[]): boolean {
  const used = new Set<string>();
  const assign = (i: number): boolean => {
    if (i === heroes.length) return true;
    const roles = k.roles(heroes[i]);
    if (!roles.length) return assign(i + 1); // unknown roles never block
    for (const r of roles) {
      if (used.has(r)) continue;
      used.add(r);
      if (assign(i + 1)) return true;
      used.delete(r);
    }
    return false;
  };
  return assign(0);
}

// How much a hero would be worth to `side` right now (counters, synergies, meta) — used for denial.
function heroValue(k: Knowledge, c: string, team: string[], enemy: string[], ctx: Context) {
  let v = 0;
  for (const e of enemy) {
    for (const m of k.counters(c, e)) v += k.matchupPoints(m);
    for (const m of k.counters(e, c)) v -= k.matchupPoints(m);
  }
  for (const s of k.kb.synergies) {
    const partner = s.hero_a === c ? s.hero_b : s.hero_b === c ? s.hero_a : null;
    if (partner && team.includes(partner)) v += s.points;
  }
  for (const hp of k.heroPoints(c, ctx)) v += hp.points;
  return v;
}

// Ranks every available hero for `side`'s next pick, given what's picked and banned so far.
export function suggestPicks(
  kb: KB,
  side: Side,
  teams: Record<Side, string[]>,
  bans: string[],
  candidates: string[],
  ctx: Context = DEFAULT_CONTEXT,
): Suggestion[] {
  const k = new Knowledge(kb);
  const team = teams[side];
  const enemy = teams[other(side)];
  const taken = new Set([...teams.red, ...teams.blue, ...bans]);
  const enemyPicksLeft = 5 - enemy.length;
  const risk = k.setting("setting-counter-risk", 0.5);
  const half = (id: string) => (k.rule(id)?.weight ?? 0) / 2;
  const frontMax = Math.max(0, ...team.map((h) => k.rating(h, "frontline")));

  return candidates
    .filter((c) => !taken.has(c))
    .map((c) => {
      const reasons: Suggestion["reasons"] = [];
      const push = (text: string, points: number, status: Status = "confirmed") => {
        if (points) reasons.push({ text, points, status });
      };
      for (const e of enemy) {
        for (const m of k.counters(c, e)) push(`Counters ${heroName(e)}`, k.matchupPoints(m), m.status);
        for (const m of k.counters(e, c)) push(`Countered by ${heroName(e)}`, -k.matchupPoints(m), m.status);
      }
      for (const s of kb.synergies) {
        const partner = s.hero_a === c ? s.hero_b : s.hero_b === c ? s.hero_a : null;
        if (partner && team.includes(partner)) push(`Synergy with ${heroName(partner)}`, s.points, s.status);
      }
      for (const hp of k.heroPoints(c, ctx)) push(hp.text, hp.points, hp.status);

      // Fill what the team is missing.
      if (frontMax < FRONTLINE && k.rating(c, "frontline") >= FRONTLINE) push("Gives the team a frontline", half("no-frontline") + (team.some((h) => k.has(h, "enchanter")) ? half("enchanter-no-frontline") : 0));
      const protected_ = team.some((h) => !k.has(h, "enchanter") && (k.rating(h, "frontline") >= FRONTLINE || k.rating(h, "sustain") >= 4));
      if (k.has(c, "enchanter") && !protected_) push("Enchanter without a tank or sustain hero yet", -half("enchanter-no-frontline"));
      const allyFit = k.rule("ally-trait-fit");
      for (const trait of k.profile(c)?.good_with_traits ?? []) {
        const allies = team.filter((a) => k.trait(a, trait));
        if (allyFit && allies.length) push(`Works with ${names(allies)}`, allyFit.weight, allyFit.status);
      }
      if (!team.some((h) => k.roles(h).includes("jungle")) && k.roles(c).includes("jungle")) push("Fills jungle", half("no-jungler"));
      const thick = enemy.filter((h) => k.thick(h));
      if (thick.length >= 2 && !team.some((h) => k.has(h, "anti_tank")) && k.has(c, "anti_tank")) push(`Anti-tank vs ${names(thick)}`, half("no-anti-tank"));
      const overlap = k.rule("role-overlap");
      if (overlap && rolesFit(k, team) && !rolesFit(k, [...team, c])) push(`Roles already taken (${k.roles(c).join(", ")})`, -overlap.weight, overlap.status);

      // Taking a hero the enemy wants denies it to them.
      if (enemyPicksLeft > 0) {
        const forEnemy = heroValue(k, c, enemy, team, ctx);
        if (forEnemy > 0) push("Denies it from the enemy", forEnemy * k.setting("setting-denial", 0.3));
      }

      // Counters still available to the enemy make a pick riskier; banning them makes it safer.
      if (enemyPicksLeft > 0) {
        for (const m of kb.matchups) {
          if (m.target !== c || m.kind === "not" || m.kind === "conditional" || taken.has(m.counter)) continue;
          push(`${heroName(m.counter)} still available to counter`, -k.matchupPoints(m) * risk, m.status);
        }
      }

      reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
      return { slug: c, score: reasons.reduce((s, r) => s + r.points, 0), reasons };
    })
    .sort((a, b) => b.score - a.score);
}

// Ranks heroes to ban: recommended/meta heroes first, then heroes with many counters on the knowledge base.
export function suggestBans(kb: KB, taken: string[], candidates: string[]): Suggestion[] {
  const k = new Knowledge(kb);
  const out = new Set(taken);
  return candidates
    .filter((c) => !out.has(c))
    .map((c) => {
      const p = k.profile(c);
      const reasons: Suggestion["reasons"] = [];
      if (p?.ban_recommended) reasons.push({ text: p.ban_note || "Recommended ban", points: 6, status: p.status });
      if (p?.tier === "S") reasons.push({ text: "S-tier hero", points: 3, status: p.status });
      if (p?.tier === "A") reasons.push({ text: "A-tier hero", points: 1.5, status: p.status });
      const beats = kb.matchups.filter((m) => m.counter === c && (m.kind === "hard" || m.kind === "soft"));
      if (beats.length) reasons.push({ text: `Counters ${beats.length} heroes`, points: beats.length * 0.5, status: "theory" });
      const answers = kb.matchups.filter((m) => m.target === c && m.kind === "hard" && !out.has(m.counter));
      if (p?.ban_recommended && answers.length === 0) reasons.push({ text: "No hard counter left available", points: 2, status: "theory" });
      return { slug: c, score: reasons.reduce((s, r) => s + r.points, 0), reasons };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}
