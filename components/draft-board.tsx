"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { BanIcon, PlusIcon, SettingsIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RANKS, analyze, suggestBans, suggestPicks, type Queue, type Rank, type Side, type Suggestion } from "@/lib/engine";
import { HEROES, heroName } from "@/lib/heroes";
import { BANS_PER_TEAM } from "@/lib/kb";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { useKb } from "@/lib/use-kb";
import { cn } from "@/lib/utils";
import { AnalysisPanel } from "./analysis-panel";
import { HeroAvatar } from "./hero-avatar";
import { RankIcon } from "./rank-icon";
import { TheoryBadge } from "./status";

const TEAM_SIZE = 5;
type Mode = "free" | "live";
type Group = "red" | "blue" | "redBan" | "blueBan";
type Draft = Record<Group, (string | null)[]>;
const GROUP_LABEL: Record<Group, string> = { red: "Red team", blue: "Blue team", redBan: "Red ban", blueBan: "Blue ban" };
const SIDE_LABEL: Record<Side, string> = { red: "Red", blue: "Blue" };

// Ranked pick order: blue 1, red 2, blue 2, red 2, blue 2, red 1.
const PICK_ORDER: Side[] = ["blue", "red", "red", "blue", "blue", "red", "red", "blue", "blue", "red"];
// Overall pick number (1–10) of each team's slot, e.g. red slot 1 is pick 2.
const PICK_NUMBER: Record<Side, number[]> = {
  blue: PICK_ORDER.flatMap((s, i) => (s === "blue" ? [i + 1] : [])),
  red: PICK_ORDER.flatMap((s, i) => (s === "red" ? [i + 1] : [])),
};

const emptyDraft = (): Draft => ({
  red: Array(TEAM_SIZE).fill(null),
  blue: Array(TEAM_SIZE).fill(null),
  redBan: Array(BANS_PER_TEAM).fill(null),
  blueBan: Array(BANS_PER_TEAM).fill(null),
});
const isEmpty = (d: Draft) => Object.values(d).every((slots) => slots.every((s) => !s));
const filledOf = (slots: (string | null)[]) => slots.filter(Boolean) as string[];

export function DraftBoard() {
  const { kb } = useKb();
  const { isAdmin } = useAuth();
  // Each mode keeps its own board, so switching back restores where you left off.
  const [boards, setBoards] = useState<Record<Mode, Draft>>(() => ({ free: emptyDraft(), live: emptyDraft() }));
  const [mode, setMode] = useState<Mode>("free");
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [active, setActive] = useState<{ group: Group; index: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [bansDone, setBansDone] = useState(false);
  const [rank, setRank] = useState<Rank>("mythic");
  const [queue, setQueue] = useState<Queue>("solo");
  const ctx = useMemo(() => ({ rank, queue }), [rank, queue]);

  const draft = boards[mode];
  const setDraft = (fn: (d: Draft) => Draft) => setBoards((b) => ({ ...b, [mode]: fn(b[mode]) }));
  const groupOf = (slug: string) => (Object.keys(draft) as Group[]).find((g) => draft[g].includes(slug)) ?? null;

  const teams = { red: filledOf(draft.red), blue: filledOf(draft.blue) };
  const bans = [...filledOf(draft.redBan), ...filledOf(draft.blueBan)];
  const filled = teams.red.length + teams.blue.length;
  const complete = filled === TEAM_SIZE * 2;
  const live = mode === "live";
  // In live mode the next pick is fixed by the ranked order; it always fills that team's next empty slot.
  const nextSide = live && !complete ? PICK_ORDER[filled] : null;
  const nextSlot = nextSide ? draft[nextSide].indexOf(null) : -1;
  const banPhase = live && !bansDone && filled === 0 && bans.length < BANS_PER_TEAM * 2;

  const setSlot = (group: Group, index: number, slug: string | null) => {
    setDraft((d) => ({ ...d, [group]: d[group].map((s, i) => (i === index ? slug : s)) }));
    setShowResult(false);
  };

  // A suggested/recommended ban fills the next empty ban slot, alternating blue then red.
  const addBan = (slug: string) => {
    if (groupOf(slug)) return;
    const count = (g: Group) => filledOf(draft[g]).length;
    const order: Group[] = count("blueBan") <= count("redBan") ? ["blueBan", "redBan"] : ["redBan", "blueBan"];
    const group = order.find((g) => draft[g].includes(null));
    if (group) setSlot(group, draft[group].indexOf(null), slug);
  };

  const undo = () => {
    if (!filled) return;
    const side = PICK_ORDER[filled - 1];
    setSlot(side, filledOf(draft[side]).length - 1, null);
  };

  const reset = () => {
    setDraft(() => emptyDraft());
    setShowResult(false);
    setBansDone(false);
  };

  const requestMode = (next: Mode) => {
    if (next === mode) return;
    if (isEmpty(draft) && isEmpty(boards[next])) setMode(next);
    else setPendingMode(next);
  };

  const analysis = useMemo(() => (complete ? analyze(kb, teams, ctx) : null), [complete, kb, draft, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggestions = useMemo(
    () => (nextSide && !banPhase ? suggestPicks(kb, nextSide, teams, bans, HEROES.map((h) => h.slug), ctx).slice(0, 8) : []),
    [nextSide, banPhase, kb, draft, ctx], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const banSuggestions = useMemo(
    () => (banPhase ? suggestBans(kb, bans, HEROES.map((h) => h.slug)).slice(0, 8) : []),
    [banPhase, kb, draft], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openSlot = (group: Group, index: number) => {
    // Live draft: picks only in order; bans any time.
    if (live && (group === "red" || group === "blue") && !(group === nextSide && index === nextSlot)) return;
    setActive({ group, index });
  };

  const status = complete
    ? "Draft complete"
    : live
      ? banPhase ? "Ban phase — bans are optional" : `Pick ${filled + 1} of 10 · ${SIDE_LABEL[nextSide!]} picks`
      : `${filled}/10 picked`;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-base font-semibold tracking-tight">MLBB Draft Predictor</h1>
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && requestMode(v[0] as Mode)}>
          <ToggleGroupItem value="free">Free pick</ToggleGroupItem>
          <ToggleGroupItem value="live">Live draft</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[rank]} onValueChange={(v) => v[0] && setRank(v[0] as Rank)}>
          {RANKS.map((r) => (
            <Tooltip key={r.value}>
              <TooltipTrigger render={<ToggleGroupItem value={r.value} aria-label={r.label} className="gap-1 px-2" />}>
                <RankIcon rank={r.value} className="size-5" />
                <span className="hidden md:inline">{r.short}</span>
              </TooltipTrigger>
              <TooltipContent>{r.label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[queue]} onValueChange={(v) => v[0] && setQueue(v[0] as Queue)}>
          <ToggleGroupItem value="solo">Solo</ToggleGroupItem>
          <ToggleGroupItem value="party">Party</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="sm" className="ml-auto" nativeButton={false} render={<Link href="/admin" />}>
          <SettingsIcon /> Backoffice
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[210px_minmax(0,1fr)_210px]">
        <TeamColumn side="blue" draft={draft} live={live} active={nextSide === "blue" ? nextSlot : -1} onSlot={openSlot} />
        <section className="order-last col-span-2 min-w-0 space-y-3 lg:order-none lg:col-span-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium", nextSide === "red" && "text-team-red", nextSide === "blue" && "text-team-blue")}>{status}</span>
            <div className="ml-auto flex gap-2">
              {live && <Button variant="outline" size="sm" onClick={undo} disabled={!filled}><Undo2Icon /> Undo</Button>}
              <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
              <Button size="sm" disabled={!complete} onClick={() => setShowResult(true)}>Analyse</Button>
            </div>
          </div>

          {banPhase && (
            <Suggestions
              title="Suggested bans"
              action={<Button size="sm" variant="outline" onClick={() => setBansDone(true)}>Done banning</Button>}
              suggestions={banSuggestions}
              onPick={addBan}
            />
          )}
          {nextSide && !banPhase && (
            <Suggestions
              title={<>Suggestions for <span className={nextSide === "red" ? "text-team-red" : "text-team-blue"}>{SIDE_LABEL[nextSide]}</span> · pick {filled + 1}</>}
              suggestions={suggestions}
              onPick={(slug) => setSlot(nextSide, nextSlot, slug)}
            />
          )}
          {!live && !showResult && <RecommendedBans kb={kb} groupOf={groupOf} onBan={addBan} />}
          {showResult && analysis && <AnalysisPanel analysis={analysis} />}
          {isAdmin && complete && (
            <LogGame
              draft={draft}
              context={`${RANKS.find((r) => r.value === rank)?.label} · ${queue === "solo" ? "Solo" : "Party"}`}
              predicted={analysis ? (analysis.favored === "blue" ? -1 : 1) * analysis.advantage : null}
            />
          )}
        </section>
        <TeamColumn side="red" draft={draft} live={live} active={nextSide === "red" ? nextSlot : -1} onSlot={openSlot} />
      </div>

      <HeroPicker
        active={active}
        draft={draft}
        groupOf={groupOf}
        onClose={() => setActive(null)}
        onPick={(slug) => {
          if (active) setSlot(active.group, active.index, slug);
          setActive(null);
        }}
      />

      <AlertDialog open={Boolean(pendingMode)} onOpenChange={(o) => !o && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pendingMode === "live" ? "Live draft" : "Free pick"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMode === "live"
                ? "Live draft starts on its own board and follows the ranked pick order (Blue 1, Red 2, Blue 2…). Your free-pick board is saved and comes back when you switch back."
                : "Free pick uses its own board. Your live draft is saved and comes back when you switch back."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setMode(pendingMode!); setPendingMode(null); setShowResult(false); }}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// One team, vertical like the in-game draft screen: picks top to bottom, bans underneath.
function TeamColumn({
  side, draft, live, active, onSlot,
}: {
  side: Side;
  draft: Draft;
  live: boolean;
  active: number;
  onSlot: (g: Group, i: number) => void;
}) {
  const banGroup: Group = side === "red" ? "redBan" : "blueBan";
  const color = side === "red" ? "text-team-red" : "text-team-blue";
  return (
    <section className={cn("rounded-xl bg-card p-2 ring-1 ring-foreground/10", side === "red" ? "lg:order-none" : "")}>
      <h2 className={cn("mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em]", color)}>{SIDE_LABEL[side]} team</h2>
      <div className="space-y-1">
        {draft[side].map((slug, i) => {
          const locked = live && !slug && i !== active;
          const isActive = i === active;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSlot(side, i)}
              disabled={locked}
              aria-label={slug ? `${GROUP_LABEL[side]} ${i + 1}: ${heroName(slug)}` : `${GROUP_LABEL[side]} ${i + 1}`}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-accent disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
                isActive && (side === "red" ? "bg-team-red/15 ring-1 ring-team-red/60" : "bg-team-blue/15 ring-1 ring-team-blue/60"),
              )}
            >
              <span
                className={cn(
                  "relative grid size-12 shrink-0 place-items-center rounded-full border-2 bg-background text-muted-foreground",
                  side === "red" ? "border-team-red/70" : "border-team-blue/70",
                  slug ? "border-solid" : "border-dashed",
                  isActive && "animate-pulse",
                )}
              >
                {slug ? <HeroAvatar slug={slug} className="size-full" /> : <PlusIcon className="size-5" />}
                {live && (
                  <span className={cn("absolute -top-1 -left-1 grid size-5 place-items-center rounded-full text-[10px] font-bold text-white", side === "red" ? "bg-team-red" : "bg-team-blue")}>
                    {PICK_NUMBER[side][i]}
                  </span>
                )}
              </span>
              <span className={cn("truncate text-sm", !slug && "text-muted-foreground")}>
                {slug ? heroName(slug) : isActive ? "Picking…" : live ? `Pick ${PICK_NUMBER[side][i]}` : "Empty"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-center gap-1">
        {draft[banGroup].map((slug, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSlot(banGroup, i)}
            aria-label={slug ? `${GROUP_LABEL[banGroup]} ${i + 1}: ${heroName(slug)}` : `${GROUP_LABEL[banGroup]} ${i + 1}`}
            title={slug ? `Banned: ${heroName(slug)}` : "Ban"}
            className="grid size-8 place-items-center overflow-hidden rounded-full border border-border bg-background text-muted-foreground transition hover:scale-105"
          >
            {slug ? <HeroAvatar slug={slug} className="size-full grayscale brightness-75" /> : <BanIcon className="size-3.5" />}
          </button>
        ))}
      </div>
    </section>
  );
}

function RecommendedBans({ kb, groupOf, onBan }: { kb: ReturnType<typeof useKb>["kb"]; groupOf: (s: string) => Group | null; onBan: (s: string) => void }) {
  const recs = kb.hero_profiles.filter((p) => p.ban_recommended);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recommended bans</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1">
        {recs.map((p) => (
          <Tooltip key={p.slug}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={Boolean(groupOf(p.slug))}
                  onClick={() => onBan(p.slug)}
                  className="flex w-14 flex-col items-center gap-0.5 rounded-lg p-1 text-[10px] transition hover:bg-accent disabled:opacity-30"
                />
              }
            >
              <HeroAvatar slug={p.slug} className="size-10" />
              <span className="w-full truncate text-center">{heroName(p.slug)}</span>
              {p.status === "theory" && <TheoryBadge />}
            </TooltipTrigger>
            <TooltipContent>{p.ban_note || "Recommended ban"}</TooltipContent>
          </Tooltip>
        ))}
      </CardContent>
    </Card>
  );
}

function HeroPicker({
  active, draft, groupOf, onClose, onPick,
}: {
  active: { group: Group; index: number } | null;
  draft: Draft;
  groupOf: (slug: string) => Group | null;
  onClose: () => void;
  onPick: (slug: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const current = active ? draft[active.group][active.index] : null;
  const heroes = useMemo(
    () => HEROES.filter((h) => h.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );
  const available = heroes.filter((h) => !groupOf(h.slug) || h.slug === current);

  return (
    <Dialog open={Boolean(active)} onOpenChange={(open) => { if (!open) { onClose(); setQuery(""); } }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{active ? `${GROUP_LABEL[active.group]} — slot ${active.index + 1}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Search heroes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && available[0]) { onPick(available[0].slug); setQuery(""); }
            }}
          />
          {current && <Button variant="outline" onClick={() => { onPick(null); setQuery(""); }}>Clear slot</Button>}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-x-1 gap-y-3 overflow-y-auto pr-1">
          {heroes.map((h) => {
            const taken = groupOf(h.slug);
            const disabled = Boolean(taken) && h.slug !== current;
            return (
              <button
                key={h.slug}
                type="button"
                disabled={disabled}
                title={disabled ? (taken!.endsWith("Ban") ? "Banned" : `Picked by ${taken}`) : undefined}
                onClick={() => { onPick(h.slug); setQuery(""); }}
                className="flex flex-col items-center gap-1 rounded-lg p-1 text-[11px] leading-tight transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30"
              >
                <HeroAvatar slug={h.slug} className={cn("size-14", taken?.endsWith("Ban") && "grayscale")} />
                <span className="text-center">{h.name}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Suggestions({
  title, action, suggestions, onPick,
}: {
  title: ReactNode;
  action?: ReactNode;
  suggestions: Suggestion[];
  onPick: (slug: string) => void;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="grid gap-0.5 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => onPick(s.slug)}
            className="flex items-start gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-accent"
          >
            <HeroAvatar slug={s.slug} className="size-9" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{heroName(s.slug)}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{s.score > 0 ? "+" : ""}{s.score.toFixed(1)}</span>
              </div>
              {s.reasons.slice(0, 2).map((r) => (
                <p key={r.text} className={cn("truncate text-[11px]", r.points < 0 ? "text-destructive" : "text-muted-foreground")}>
                  {r.points > 0 ? "+" : ""}{+r.points.toFixed(1)} {r.text}{r.status === "theory" ? " (theory)" : ""}
                </p>
              ))}
              {!s.reasons.length && <p className="text-[11px] text-muted-foreground">No notes affecting this pick yet.</p>}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function LogGame({ draft, context, predicted }: { draft: Draft; context: string; predicted: number | null }) {
  const [winner, setWinner] = useState<string>("");
  const [minutes, setMinutes] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supabase || !winner) return;
    setSaving(true);
    const { error } = await supabase.from("games").insert({
      red: filledOf(draft.red), blue: filledOf(draft.blue), red_bans: filledOf(draft.redBan), blue_bans: filledOf(draft.blueBan),
      winner, rank: context, duration_min: Number(minutes) || null, reasoning: reasoning.trim(), predicted,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success("Game logged");
    setWinner(""); setMinutes(""); setReasoning("");
  };

  return (
    <Card size="sm">
      <CardHeader><CardTitle>Log this game <span className="text-xs font-normal text-muted-foreground">({context})</span></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Winner</Label>
            <ToggleGroup variant="outline" size="sm" spacing={0} value={winner ? [winner] : []} onValueChange={(v) => setWinner(v[0] ?? "")}>
              <ToggleGroupItem value="blue" className="data-pressed:text-team-blue">Blue</ToggleGroupItem>
              <ToggleGroupItem value="red" className="data-pressed:text-team-red">Red</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minutes">Minutes</Label>
            <Input id="minutes" type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-7 w-20" />
          </div>
        </div>
        <Textarea
          rows={2}
          placeholder="Why did they win? e.g. Red had no answer to Sun split pushing; Karrie melted their two tanks late."
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
        />
        <Button size="sm" onClick={save} disabled={!winner || saving}>{saving ? "Saving…" : "Save game"}</Button>
      </CardContent>
    </Card>
  );
}
