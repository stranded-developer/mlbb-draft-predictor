"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HeroCombobox } from "@/components/hero-combobox";
import { HeroChip } from "@/components/hero-avatar";
import { StatusToggle } from "@/components/status";
import { heroName } from "@/lib/heroes";
import {
  ITEM_SUGGESTIONS, MATCHUP_KINDS, MATCHUP_POINTS, TAGS, formatTrigger, parseTrigger,
  type Game, type ItemAdvice, type Matchup, type MatchupKind, type Rule, type Synergy, type Trigger,
} from "@/lib/kb";
import { deleteRow, saveRow } from "@/lib/kb-db";
import { EditSheet, Field } from "./edit-sheet";

type SheetProps<T> = {
  row: T | null;
  onClose: () => void;
  onSaved: (row: T) => void;
  onDeleted: (row: T) => void;
  canEdit: boolean;
};

// Keeps an editable copy of the row the sheet was opened with.
function useDraft<T>(row: T | null) {
  const [draft, setDraft] = useState<T | null>(row);
  const [source, setSource] = useState(row);
  if (row !== source) {
    setSource(row);
    setDraft(row);
  }
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  return [draft, set] as const;
}

const numberOrNull = (v: string) => (v === "" ? null : Number(v));

export function MatchupSheet({ row, onClose, onSaved, onDeleted, canEdit }: SheetProps<Matchup>) {
  const [m, set] = useDraft(row);
  if (!m) return null;
  const isNew = m.id == null;
  return (
    <EditSheet
      open={Boolean(row)}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "New counter" : `${heroName(m.counter)} vs ${heroName(m.target)}`}
      description="The counter hero has an advantage over the target hero."
      canEdit={canEdit}
      saveDisabled={!m.counter || !m.target || m.counter === m.target}
      onSave={async () => onSaved(await saveRow("matchups", m))}
      onDelete={isNew ? undefined : async () => { await deleteRow("matchups", "id", m.id!); onDeleted(m); }}
    >
      <Field label="Counter (wins)"><HeroCombobox value={m.counter} onChange={(v) => set("counter", v)} /></Field>
      <Field label="Target (loses)"><HeroCombobox value={m.target} onChange={(v) => set("target", v)} /></Field>
      <Field label="How strong" hint={MATCHUP_KINDS.find((k) => k.value === m.kind)?.hint}>
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[m.kind]} onValueChange={(v) => v[0] && set("kind", v[0] as MatchupKind)} className="flex-wrap">
          {MATCHUP_KINDS.map((k) => <ToggleGroupItem key={k.value} value={k.value}>{k.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>
      <Field label="Advantage points" hint={`Leave empty to use the default for "${m.kind}" (${MATCHUP_POINTS[m.kind]}).`}>
        <Input type="number" step="0.5" placeholder={String(MATCHUP_POINTS[m.kind])} value={m.points ?? ""} onChange={(e) => set("points", numberOrNull(e.target.value))} />
      </Field>
      <Field label="Why" hint="Shown under the analysis.">
        <Textarea rows={4} value={m.why} onChange={(e) => set("why", e.target.value)} />
      </Field>
      <Field label="Status"><StatusToggle value={m.status} onChange={(s) => set("status", s)} /></Field>
    </EditSheet>
  );
}

export function SynergySheet({ row, onClose, onSaved, onDeleted, canEdit }: SheetProps<Synergy>) {
  const [s, set] = useDraft(row);
  if (!s) return null;
  const isNew = s.id == null;
  return (
    <EditSheet
      open={Boolean(row)}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "New synergy" : `${heroName(s.hero_a)} + ${heroName(s.hero_b)}`}
      description="Two heroes that are stronger together on the same team."
      canEdit={canEdit}
      saveDisabled={!s.hero_a || !s.hero_b || s.hero_a === s.hero_b}
      onSave={async () => onSaved(await saveRow("synergies", s))}
      onDelete={isNew ? undefined : async () => { await deleteRow("synergies", "id", s.id!); onDeleted(s); }}
    >
      <Field label="Hero"><HeroCombobox value={s.hero_a} onChange={(v) => set("hero_a", v)} /></Field>
      <Field label="Paired with"><HeroCombobox value={s.hero_b} onChange={(v) => set("hero_b", v)} /></Field>
      <Field label="Advantage points">
        <Input type="number" step="0.5" value={s.points} onChange={(e) => set("points", Number(e.target.value))} />
      </Field>
      <Field label="Why"><Textarea rows={4} value={s.why} onChange={(e) => set("why", e.target.value)} /></Field>
      <Field label="Status"><StatusToggle value={s.status} onChange={(v) => set("status", v)} /></Field>
    </EditSheet>
  );
}

export function ItemSheet({ row, onClose, onSaved, onDeleted, canEdit }: SheetProps<ItemAdvice>) {
  const [it, set] = useDraft(row);
  if (!it) return null;
  const isNew = it.id == null;
  const trigger = parseTrigger(it.trigger);
  const setTrigger = (t: Trigger) => set("trigger", formatTrigger(t));
  return (
    <EditSheet
      open={Boolean(row)}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "New item advice" : it.item}
      description="Item or battle spell to suggest when the enemy draft matches."
      canEdit={canEdit}
      saveDisabled={!it.item.trim() || (trigger.type === "hero" && !trigger.hero)}
      onSave={async () => onSaved(await saveRow("item_advice", it))}
      onDelete={isNew ? undefined : async () => { await deleteRow("item_advice", "id", it.id!); onDeleted(it); }}
    >
      <Field label="When the enemy has">
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[trigger.type]}
          onValueChange={(v) => v[0] && setTrigger(v[0] === "hero" ? { type: "hero", hero: "" } : { type: "tag", tag: "thick", count: 2 })}>
          <ToggleGroupItem value="hero">A specific hero</ToggleGroupItem>
          <ToggleGroupItem value="tag">Several heroes of a type</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      {trigger.type === "hero" ? (
        <Field label="Enemy hero"><HeroCombobox value={trigger.hero} onChange={(v) => setTrigger({ type: "hero", hero: v })} /></Field>
      ) : (
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Hero type">
            <select
              className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 text-sm"
              value={trigger.tag}
              onChange={(e) => setTrigger({ ...trigger, tag: e.target.value })}
            >
              {TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="At least">
            <Input type="number" min={1} max={5} value={trigger.count} onChange={(e) => setTrigger({ ...trigger, count: Number(e.target.value) || 1 })} />
          </Field>
        </div>
      )}
      <Field label="Item / battle spell" hint="Start typing for suggestions.">
        <Input list="item-suggestions" value={it.item} onChange={(e) => set("item", e.target.value)} />
        <datalist id="item-suggestions">{ITEM_SUGGESTIONS.map((i) => <option key={i} value={i} />)}</datalist>
      </Field>
      <Field label="Why"><Textarea rows={4} value={it.why} onChange={(e) => set("why", e.target.value)} /></Field>
      <Field label="Status"><StatusToggle value={it.status} onChange={(v) => set("status", v)} /></Field>
    </EditSheet>
  );
}

export function RuleSheet({ row, isNew, onClose, onSaved, onDeleted, canEdit }: SheetProps<Rule> & { isNew: boolean }) {
  const [r, set] = useDraft(row);
  if (!r) return null;
  return (
    <EditSheet
      open={Boolean(row)}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "New rule" : r.id}
      description="A composition rule. The weight is the advantage given to the other team when a draft breaks it."
      canEdit={canEdit}
      saveDisabled={!r.id.trim()}
      onSave={async () => onSaved(await saveRow("rules", r))}
      onDelete={isNew ? undefined : async () => { await deleteRow("rules", "id", r.id); onDeleted(r); }}
    >
      <Field label="Rule id" hint={isNew ? "Short name in kebab-case, e.g. no-frontline. Can't be changed later." : undefined}>
        <Input value={r.id} disabled={!isNew} onChange={(e) => set("id", e.target.value.trim().toLowerCase().replace(/\s+/g, "-"))} className="font-mono" />
      </Field>
      <Field label="Weight (advantage points)">
        <Input type="number" step="0.5" value={r.weight} onChange={(e) => set("weight", Number(e.target.value))} />
      </Field>
      <Field label="Description"><Textarea rows={4} value={r.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label="Status"><StatusToggle value={r.status} onChange={(v) => set("status", v)} /></Field>
    </EditSheet>
  );
}

export function GameSheet({ row, onClose, onSaved, onDeleted, canEdit }: SheetProps<Game>) {
  const [g, set] = useDraft(row);
  if (!g) return null;
  const team = (label: string, slugs: string[]) => (
    <Field label={label}>
      <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        {slugs.length ? slugs.map((s) => <HeroChip key={s} slug={s} />) : <span className="text-muted-foreground">—</span>}
      </div>
    </Field>
  );
  return (
    <EditSheet
      open={Boolean(row)}
      onOpenChange={(o) => !o && onClose()}
      title="Logged game"
      description={g.played_at ? new Date(g.played_at).toLocaleString() : undefined}
      canEdit={canEdit}
      onSave={async () => onSaved(await saveRow("games", g))}
      onDelete={async () => { await deleteRow("games", "id", g.id!); onDeleted(g); }}
    >
      {team("Red team", g.red)}
      {team("Blue team", g.blue)}
      {team("Red bans", g.red_bans)}
      {team("Blue bans", g.blue_bans)}
      <Field label="Winner">
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[g.winner]} onValueChange={(v) => v[0] && set("winner", v[0] as Game["winner"])}>
          <ToggleGroupItem value="red" className="data-pressed:text-team-red">Red</ToggleGroupItem>
          <ToggleGroupItem value="blue" className="data-pressed:text-team-blue">Blue</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rank"><Input value={g.rank} onChange={(e) => set("rank", e.target.value)} /></Field>
        <Field label="Minutes"><Input type="number" value={g.duration_min ?? ""} onChange={(e) => set("duration_min", numberOrNull(e.target.value))} /></Field>
      </div>
      <Field label="Why they won"><Textarea rows={5} value={g.reasoning} onChange={(e) => set("reasoning", e.target.value)} /></Field>
    </EditSheet>
  );
}
