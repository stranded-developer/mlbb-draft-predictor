"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HeroAvatar, HeroChip } from "@/components/hero-avatar";
import { StatusToggle, TheoryBadge } from "@/components/status";
import { HEROES, heroName } from "@/lib/heroes";
import {
  MATCHUP_KINDS, TAGS, emptyProfile, type HeroProfile, type KB, type Matchup, type Synergy,
} from "@/lib/kb";
import { saveRow } from "@/lib/kb-db";
import { cn } from "@/lib/utils";

type Filter = "all" | "meta" | "ban" | "profiled";
const KIND_LABEL = new Map(MATCHUP_KINDS.map((k) => [k.value, k.label]));

export function HeroesTab({
  kb, canEdit, onProfileSaved, openMatchup, openSynergy,
}: {
  kb: KB;
  canEdit: boolean;
  onProfileSaved: (p: HeroProfile) => void;
  openMatchup: (m: Matchup) => void;
  openSynergy: (s: Synergy) => void;
}) {
  const profiles = useMemo(() => new Map(kb.hero_profiles.map((p) => [p.slug, p])), [kb.hero_profiles]);
  const [selected, setSelected] = useState("lukas");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const heroes = HEROES.filter((h) => {
    const p = profiles.get(h.slug);
    if (query && !h.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "meta") return p?.is_meta;
    if (filter === "ban") return p?.ban_recommended;
    if (filter === "profiled") return Boolean(p);
    return true;
  });

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card className="gap-3 py-3 md:sticky md:top-4 md:h-[calc(100vh-8rem)]">
        <div className="space-y-2 px-3">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Find hero…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
          </div>
          <ToggleGroup variant="outline" size="sm" spacing={0} value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as Filter)} className="w-full *:flex-1">
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="meta">Meta</ToggleGroupItem>
            <ToggleGroupItem value="ban">Ban</ToggleGroupItem>
            <ToggleGroupItem value="profiled">Noted</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="max-h-72 overflow-y-auto px-2 md:max-h-none md:flex-1">
          {heroes.map((h) => {
            const p = profiles.get(h.slug);
            return (
              <button
                key={h.slug}
                type="button"
                onClick={() => setSelected(h.slug)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-accent",
                  selected === h.slug && "bg-accent",
                )}
              >
                <HeroAvatar slug={h.slug} className="size-7" />
                <span className="flex-1 truncate">{h.name}</span>
                {p?.is_meta && <Badge variant="secondary">Meta</Badge>}
                {p?.ban_recommended && <Badge variant="destructive">Ban</Badge>}
                {p?.status === "theory" && <span className="size-1.5 rounded-full bg-amber-400" title="theory" />}
              </button>
            );
          })}
          {!heroes.length && <p className="p-3 text-sm text-muted-foreground">No heroes match.</p>}
        </div>
      </Card>

      <HeroEditor
        key={selected}
        profile={profiles.get(selected) ?? emptyProfile(selected)}
        isNew={!profiles.has(selected)}
        kb={kb}
        canEdit={canEdit}
        onSaved={onProfileSaved}
        openMatchup={openMatchup}
        openSynergy={openSynergy}
      />
    </div>
  );
}

function HeroEditor({
  profile, isNew, kb, canEdit, onSaved, openMatchup, openSynergy,
}: {
  profile: HeroProfile;
  isNew: boolean;
  kb: KB;
  canEdit: boolean;
  onSaved: (p: HeroProfile) => void;
  openMatchup: (m: Matchup) => void;
  openSynergy: (s: Synergy) => void;
}) {
  const [p, setP] = useState(profile);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const slug = p.slug;
  const set = <K extends keyof HeroProfile>(key: K, value: HeroProfile[K]) => {
    setP((cur) => ({ ...cur, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveRow("hero_profiles", p);
      onSaved(saved);
      setDirty(false);
      toast.success(`${heroName(slug)} saved`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const beatenBy = kb.matchups.filter((m) => m.target === slug && m.kind !== "not");
  const beats = kb.matchups.filter((m) => m.counter === slug && m.kind !== "not");
  const notCounters = kb.matchups.filter((m) => (m.target === slug || m.counter === slug) && m.kind === "not");
  const synergies = kb.synergies.filter((s) => s.hero_a === slug || s.hero_b === slug);
  const newMatchup = (side: Partial<Matchup>): Matchup =>
    ({ counter: "", target: "", kind: "soft", points: null, why: "", status: "theory", ...side });

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <HeroAvatar slug={slug} className="size-16 ring-2 ring-primary/40" />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold">{heroName(slug)}</h2>
            <p className="text-sm text-muted-foreground">
              {isNew ? "No notes yet — fill in what you know." : "Edit and save. Unproven calls stay as theory."}
            </p>
          </div>
          <StatusToggle value={p.status} onChange={(s) => set("status", s)} disabled={!canEdit} />
          {canEdit && (
            <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>
          )}
        </CardContent>
      </Card>

      <fieldset disabled={!canEdit} className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Draft value</CardTitle>
            <CardDescription>Is this hero a meta threat worth banning?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>Meta hero <span className="block text-xs text-muted-foreground">Swings a draft on their own</span></span>
              <Switch checked={p.is_meta} onCheckedChange={(v) => set("is_meta", v)} disabled={!canEdit} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>Recommend ban <span className="block text-xs text-muted-foreground">Shows in the draft page&apos;s ban strip</span></span>
              <Switch checked={p.ban_recommended} onCheckedChange={(v) => set("ban_recommended", v)} disabled={!canEdit} />
            </label>
            {p.ban_recommended && (
              <div className="space-y-1.5">
                <Label>Ban reason</Label>
                <Input value={p.ban_note} placeholder="Shown when hovering the ban" onChange={(e) => set("ban_note", e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Power by game phase</CardTitle>
            <CardDescription>1 = weak, 5 = dominant. Click again to clear.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["power_early", "power_mid", "power_late"] as const).map((key) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="w-12 text-sm text-muted-foreground">{{ power_early: "Early", power_mid: "Mid", power_late: "Late" }[key]}</span>
                <ToggleGroup variant="outline" size="sm" spacing={0} value={p[key] ? [String(p[key])] : []}
                  onValueChange={(v) => set(key, v[0] ? Number(v[0]) : null)} disabled={!canEdit}>
                  {[1, 2, 3, 4, 5].map((n) => <ToggleGroupItem key={n} value={String(n)} className="w-9">{n}</ToggleGroupItem>)}
                </ToggleGroup>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>What this hero brings — used by the composition rules (e.g. &quot;no frontline&quot;).</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleGroup multiple variant="outline" size="sm" value={p.tags} onValueChange={(v) => set("tags", v as string[])} disabled={!canEdit} className="flex-wrap">
              {TAGS.map((t) => (
                <Tooltip key={t.value}>
                  <TooltipTrigger render={<ToggleGroupItem value={t.value} />}>{t.label}</TooltipTrigger>
                  <TooltipContent>{t.hint}</TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Strengths, weaknesses, how to play against them.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea rows={4} value={p.notes} onChange={(e) => set("notes", e.target.value)} />
          </CardContent>
        </Card>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <RelationList
          title={`Countered by`}
          description={`Heroes that beat ${heroName(slug)}`}
          items={beatenBy.map((m) => ({ key: `${m.id ?? m.counter}`, slug: m.counter, kind: m.kind, why: m.why, status: m.status, onClick: () => openMatchup(m) }))}
          onAdd={canEdit ? () => openMatchup(newMatchup({ target: slug })) : undefined}
          addLabel="Add counter"
        />
        <RelationList
          title="Counters"
          description={`Heroes ${heroName(slug)} beats`}
          items={beats.map((m) => ({ key: `${m.id ?? m.target}`, slug: m.target, kind: m.kind, why: m.why, status: m.status, onClick: () => openMatchup(m) }))}
          onAdd={canEdit ? () => openMatchup(newMatchup({ counter: slug })) : undefined}
          addLabel="Add hero it beats"
        />
        <RelationList
          title="Synergies"
          description="Stronger together on the same team"
          items={synergies.map((s) => ({ key: `${s.id ?? s.hero_b}`, slug: s.hero_a === slug ? s.hero_b : s.hero_a, why: s.why, status: s.status, onClick: () => openSynergy(s) }))}
          onAdd={canEdit ? () => openSynergy({ hero_a: slug, hero_b: "", points: 2, why: "", status: "theory" }) : undefined}
          addLabel="Add synergy"
        />
        <RelationList
          title="Not actually counters"
          description="Look like counters on paper, don't work in practice"
          items={notCounters.map((m) => ({ key: `${m.id ?? m.counter}`, slug: m.counter === slug ? m.target : m.counter, why: m.why, status: m.status, onClick: () => openMatchup(m) }))}
          onAdd={canEdit ? () => openMatchup(newMatchup({ target: slug, kind: "not" })) : undefined}
          addLabel="Add"
        />
      </div>
    </div>
  );
}

function RelationList({
  title, description, items, onAdd, addLabel,
}: {
  title: string;
  description: string;
  items: { key: string; slug: string; kind?: Matchup["kind"]; why: string; status: string; onClick: () => void }[];
  onAdd?: () => void;
  addLabel: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((it) => (
          <button key={it.key} type="button" onClick={it.onClick} className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-accent">
            <div className="flex items-center gap-2 text-sm">
              <HeroChip slug={it.slug} className="flex-1" />
              {it.kind && <Badge variant={it.kind === "hard" ? "default" : "secondary"}>{KIND_LABEL.get(it.kind)}</Badge>}
              {it.status === "theory" && <TheoryBadge />}
            </div>
            {it.why && <p className="mt-0.5 line-clamp-2 pl-8 text-xs text-muted-foreground">{it.why}</p>}
          </button>
        ))}
        {!items.length && <p className="px-2 py-1 text-sm text-muted-foreground">None yet.</p>}
        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd} className="mt-1">
            <PlusIcon /> {addLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
