"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BanIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HEROES, heroName } from "@/lib/heroes";
import { BANS_PER_TEAM } from "@/lib/kb";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { useKb } from "@/lib/use-kb";
import { cn } from "@/lib/utils";
import { HeroAvatar } from "./hero-avatar";
import { TheoryBadge } from "./status";

const TEAM_SIZE = 5;
type Group = "red" | "blue" | "redBan" | "blueBan";
type Draft = Record<Group, (string | null)[]>;
const GROUP_LABEL: Record<Group, string> = { red: "Red team", blue: "Blue team", redBan: "Red ban", blueBan: "Blue ban" };

const emptyDraft = (): Draft => ({
  red: Array(TEAM_SIZE).fill(null),
  blue: Array(TEAM_SIZE).fill(null),
  redBan: Array(BANS_PER_TEAM).fill(null),
  blueBan: Array(BANS_PER_TEAM).fill(null),
});

export function DraftBoard() {
  const { kb } = useKb();
  const { isAdmin } = useAuth();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [active, setActive] = useState<{ group: Group; index: number } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const groupOf = (slug: string) =>
    (Object.keys(draft) as Group[]).find((g) => draft[g].includes(slug)) ?? null;
  const filled = [...draft.red, ...draft.blue].filter(Boolean).length;
  const complete = filled === TEAM_SIZE * 2;

  const setSlot = (group: Group, index: number, slug: string | null) => {
    setDraft((d) => ({ ...d, [group]: d[group].map((s, i) => (i === index ? slug : s)) }));
    setShowResult(false);
  };

  // A recommended ban fills the next empty ban slot, alternating blue then red.
  const addBan = (slug: string) => {
    if (groupOf(slug)) return;
    const count = (g: Group) => draft[g].filter(Boolean).length;
    const order: Group[] = count("blueBan") <= count("redBan") ? ["blueBan", "redBan"] : ["redBan", "blueBan"];
    const group = order.find((g) => draft[g].includes(null));
    if (group) setSlot(group, draft[group].indexOf(null), slug);
  };

  const recBans = kb.hero_profiles.filter((p) => p.ban_recommended);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">MLBB Draft Predictor</h1>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin" />}>
          <SettingsIcon /> Backoffice
        </Button>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recommended bans
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-1">
          {recBans.map((p) => {
            const used = Boolean(groupOf(p.slug));
            return (
              <Tooltip key={p.slug}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={used}
                      onClick={() => addBan(p.slug)}
                      className="flex w-16 flex-col items-center gap-1 rounded-lg p-1 text-[11px] transition hover:bg-accent disabled:opacity-30"
                    />
                  }
                >
                  <HeroAvatar slug={p.slug} className="size-11" />
                  <span className="truncate">{heroName(p.slug)}</span>
                  {p.status === "theory" && <TheoryBadge />}
                </TooltipTrigger>
                <TooltipContent>{p.ban_note || "Recommended ban"}</TooltipContent>
              </Tooltip>
            );
          })}
        </CardContent>
      </Card>

      <TeamRow team="red" draft={draft} onSlot={(group, index) => setActive({ group, index })} />
      <div className="my-5 text-center text-lg font-extrabold text-primary">VS</div>
      <TeamRow team="blue" draft={draft} onSlot={(group, index) => setActive({ group, index })} />

      <div className="mt-8 flex justify-center gap-3">
        <Button variant="outline" size="lg" onClick={() => { setDraft(emptyDraft()); setShowResult(false); }}>
          Reset
        </Button>
        <Button size="lg" disabled={!complete} onClick={() => setShowResult(true)}>
          Analyse
        </Button>
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        {complete ? "Draft complete — ready to analyse." : `Pick all 10 heroes to analyse the draft (${filled}/10).`}
      </p>

      {showResult && (
        <Card className="mt-6">
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-team-red">Red:</span> {draft.red.map((s) => heroName(s!)).join(", ")}</p>
            <p><span className="text-team-blue">Blue:</span> {draft.blue.map((s) => heroName(s!)).join(", ")}</p>
            <p className="text-muted-foreground">Advantage analysis coming next.</p>
          </CardContent>
        </Card>
      )}

      {isAdmin && complete && <LogGame draft={draft} />}

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
    </main>
  );
}

function TeamRow({ team, draft, onSlot }: { team: "red" | "blue"; draft: Draft; onSlot: (g: Group, i: number) => void }) {
  const banGroup: Group = team === "red" ? "redBan" : "blueBan";
  const picks = (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {draft[team].map((slug, i) => (
        <Slot key={i} slug={slug} team={team} onClick={() => onSlot(team, i)} label={`${GROUP_LABEL[team]} ${i + 1}`} />
      ))}
    </div>
  );
  const bans = (
    <div className="flex flex-wrap justify-center gap-2">
      {draft[banGroup].map((slug, i) => (
        <Slot key={i} slug={slug} ban onClick={() => onSlot(banGroup, i)} label={`${GROUP_LABEL[banGroup]} ${i + 1}`} />
      ))}
    </div>
  );
  const title = (
    <h2 className={cn("text-center text-sm font-semibold uppercase tracking-[0.2em]", team === "red" ? "text-team-red" : "text-team-blue")}>
      {team === "red" ? "Red Team" : "Blue Team"}
    </h2>
  );
  return (
    <section className="space-y-3">
      {team === "red" ? <>{title}{bans}{picks}</> : <>{picks}{bans}{title}</>}
    </section>
  );
}

function Slot({ slug, team, ban, onClick, label }: { slug: string | null; team?: "red" | "blue"; ban?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={slug ? `${label}: ${heroName(slug)}` : label} className="group flex flex-col items-center gap-1">
      <span
        className={cn(
          "grid place-items-center overflow-hidden rounded-full border-2 bg-card text-muted-foreground transition group-hover:scale-105",
          ban ? "size-10 border-border sm:size-12" : "size-14 sm:size-20",
          !ban && (slug ? "border-solid" : "border-dashed"),
          team === "red" && "border-team-red/70",
          team === "blue" && "border-team-blue/70",
          !ban && slug && team === "red" && "shadow-[0_0_16px] shadow-team-red/40",
          !ban && slug && team === "blue" && "shadow-[0_0_16px] shadow-team-blue/40",
        )}
      >
        {slug ? (
          <HeroAvatar slug={slug} className={cn("size-full", ban && "grayscale brightness-75")} />
        ) : ban ? (
          <BanIcon className="size-4" />
        ) : (
          <PlusIcon className="size-6" />
        )}
      </span>
      <span className={cn("h-4 max-w-20 truncate", ban ? "text-[10px] text-muted-foreground" : "text-xs")}>
        {slug ? heroName(slug) : ""}
      </span>
    </button>
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

function LogGame({ draft }: { draft: Draft }) {
  const [winner, setWinner] = useState<string>("");
  const [rank, setRank] = useState("");
  const [minutes, setMinutes] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [saving, setSaving] = useState(false);
  const picks = (g: Group) => draft[g].filter(Boolean) as string[];

  const save = async () => {
    if (!supabase || !winner) return;
    setSaving(true);
    const { error } = await supabase.from("games").insert({
      red: picks("red"), blue: picks("blue"), red_bans: picks("redBan"), blue_bans: picks("blueBan"),
      winner, rank: rank.trim(), duration_min: Number(minutes) || null, reasoning: reasoning.trim(),
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success("Game logged");
    setWinner(""); setRank(""); setMinutes(""); setReasoning("");
  };

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Log this game</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Winner</Label>
            <ToggleGroup variant="outline" spacing={0} value={winner ? [winner] : []} onValueChange={(v) => setWinner(v[0] ?? "")}>
              <ToggleGroupItem value="red" className="data-pressed:text-team-red">Red</ToggleGroupItem>
              <ToggleGroupItem value="blue" className="data-pressed:text-team-blue">Blue</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rank">Rank</Label>
            <Input id="rank" placeholder="e.g. Mythic" value={rank} onChange={(e) => setRank(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minutes">Minutes</Label>
            <Input id="minutes" type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-24" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reasoning">Why did they win?</Label>
          <Textarea
            id="reasoning"
            rows={3}
            placeholder="e.g. Red had no answer to Sun split pushing; Karrie melted their two tanks late."
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={!winner || saving}>{saving ? "Saving…" : "Save game"}</Button>
      </CardContent>
    </Card>
  );
}
