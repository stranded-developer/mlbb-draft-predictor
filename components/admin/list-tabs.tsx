"use client";

import { useState, type ReactNode } from "react";
import { ArrowRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HeroAvatar, HeroChip } from "@/components/hero-avatar";
import { StatusBadge } from "@/components/status";
import { heroName } from "@/lib/heroes";
import {
  MATCHUP_KINDS, MATCHUP_POINTS, TAG_LABEL, parseTrigger,
  type Game, type ItemAdvice, type Matchup, type Rule, type Synergy,
} from "@/lib/kb";
import { cn } from "@/lib/utils";

const KIND_LABEL = new Map(MATCHUP_KINDS.map((k) => [k.value, k.label]));
const matches = (q: string, ...values: string[]) => !q || values.some((v) => v.toLowerCase().includes(q.toLowerCase()));

function Toolbar({ query, setQuery, onAdd, addLabel, children }: {
  query: string; setQuery: (q: string) => void; onAdd?: () => void; addLabel: string; children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by hero or text…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>
      {children}
      {onAdd && <Button onClick={onAdd}><PlusIcon /> {addLabel}</Button>}
    </div>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">{text}</TableCell>
    </TableRow>
  );
}

export function CountersTab({ rows, onOpen, onAdd }: { rows: Matchup[]; onOpen: (m: Matchup) => void; onAdd?: () => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const shown = rows
    .filter((m) => (kind === "all" || m.kind === kind) && matches(query, heroName(m.counter), heroName(m.target), m.why))
    .sort((a, b) => heroName(a.target).localeCompare(heroName(b.target)));
  return (
    <>
      <Toolbar query={query} setQuery={setQuery} onAdd={onAdd} addLabel="Add counter">
        <ToggleGroup variant="outline" size="sm" spacing={0} value={[kind]} onValueChange={(v) => v[0] && setKind(v[0])}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {MATCHUP_KINDS.map((k) => <ToggleGroupItem key={k.value} value={k.value}>{k.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </Toolbar>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Counter</TableHead>
              <TableHead />
              <TableHead>Target</TableHead>
              <TableHead>Strength</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="hidden md:table-cell">Why</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((m) => (
              <TableRow key={m.id ?? `${m.counter}-${m.target}`} onClick={() => onOpen(m)} className="cursor-pointer">
                <TableCell><HeroChip slug={m.counter} /></TableCell>
                <TableCell className="px-0 text-muted-foreground"><ArrowRightIcon className="size-4" /></TableCell>
                <TableCell><HeroChip slug={m.target} /></TableCell>
                <TableCell>
                  <Badge variant={m.kind === "hard" ? "default" : m.kind === "not" ? "destructive" : "secondary"}>{KIND_LABEL.get(m.kind)}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {m.points ?? <span className="text-muted-foreground">{MATCHUP_POINTS[m.kind]}</span>}
                </TableCell>
                <TableCell className="hidden max-w-72 truncate text-muted-foreground md:table-cell">{m.why}</TableCell>
                <TableCell><StatusBadge status={m.status} /></TableCell>
              </TableRow>
            ))}
            {!shown.length && <Empty cols={7} text="No counters match." />}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function SynergiesTab({ rows, onOpen, onAdd }: { rows: Synergy[]; onOpen: (s: Synergy) => void; onAdd?: () => void }) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((s) => matches(query, heroName(s.hero_a), heroName(s.hero_b), s.why));
  return (
    <>
      <Toolbar query={query} setQuery={setQuery} onAdd={onAdd} addLabel="Add synergy" />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="hidden md:table-cell">Why</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((s) => (
              <TableRow key={s.id ?? `${s.hero_a}-${s.hero_b}`} onClick={() => onOpen(s)} className="cursor-pointer">
                <TableCell>
                  <span className="flex items-center gap-2"><HeroChip slug={s.hero_a} /> <span className="text-muted-foreground">+</span> <HeroChip slug={s.hero_b} /></span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{s.points}</TableCell>
                <TableCell className="hidden max-w-80 truncate text-muted-foreground md:table-cell">{s.why}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
              </TableRow>
            ))}
            {!shown.length && <Empty cols={4} text="No synergies yet." />}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function TriggerLabel({ trigger }: { trigger: string }) {
  const t = parseTrigger(trigger);
  if (t.type === "hero") return <span className="flex items-center gap-2">Enemy has <HeroChip slug={t.hero} /></span>;
  return <span>Enemy has {t.count}+ <b>{TAG_LABEL.get(t.tag) ?? t.tag}</b> heroes</span>;
}

export function ItemsTab({ rows, onOpen, onAdd }: { rows: ItemAdvice[]; onOpen: (i: ItemAdvice) => void; onAdd?: () => void }) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((i) => matches(query, i.item, i.why, i.trigger, heroName(parseTrigger(i.trigger).type === "hero" ? i.trigger.slice(6) : "")));
  return (
    <>
      <Toolbar query={query} setQuery={setQuery} onAdd={onAdd} addLabel="Add item advice" />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Buy</TableHead>
              <TableHead className="hidden md:table-cell">Why</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((i) => (
              <TableRow key={i.id ?? `${i.trigger}-${i.item}`} onClick={() => onOpen(i)} className="cursor-pointer">
                <TableCell><TriggerLabel trigger={i.trigger} /></TableCell>
                <TableCell className="font-medium">{i.item}</TableCell>
                <TableCell className="hidden max-w-80 truncate text-muted-foreground md:table-cell">{i.why}</TableCell>
                <TableCell><StatusBadge status={i.status} /></TableCell>
              </TableRow>
            ))}
            {!shown.length && <Empty cols={4} text="No item advice yet." />}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function RulesTab({ rows, onOpen, onAdd }: { rows: Rule[]; onOpen: (r: Rule) => void; onAdd?: () => void }) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((r) => matches(query, r.id, r.description)).sort((a, b) => b.weight - a.weight);
  return (
    <>
      <Toolbar query={query} setQuery={setQuery} onAdd={onAdd} addLabel="Add rule" />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.id} onClick={() => onOpen(r)} className="cursor-pointer">
                <TableCell className="whitespace-normal">
                  <div className="font-mono text-xs text-muted-foreground">{r.id}</div>
                  <div>{r.description}</div>
                </TableCell>
                <TableCell className="text-right font-mono text-base tabular-nums">{r.weight}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
              </TableRow>
            ))}
            {!shown.length && <Empty cols={3} text="No rules match." />}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function TeamIcons({ slugs, won, team }: { slugs: string[]; won: boolean; team: "red" | "blue" }) {
  return (
    <div className={cn("flex items-center gap-1 rounded-lg p-1", won && (team === "red" ? "bg-team-red/15" : "bg-team-blue/15"))}>
      {slugs.map((s) => <HeroAvatar key={s} slug={s} className="size-7" />)}
    </div>
  );
}

export function GamesTab({ rows, onOpen }: { rows: Game[]; onOpen: (g: Game) => void }) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((g) => matches(query, g.reasoning, g.rank, ...[...g.red, ...g.blue].map(heroName)));
  return (
    <>
      <Toolbar query={query} setQuery={setQuery} addLabel="" />
      <p className="mb-3 text-sm text-muted-foreground">Log games from the draft page: pick all 10 heroes while signed in, then fill in &quot;Log this game&quot;.</p>
      <div className="space-y-2">
        {shown.map((g) => (
          <Card key={g.id} size="sm" onClick={() => onOpen(g)} className="cursor-pointer px-3 transition hover:ring-primary/40">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={g.winner === "red" ? "bg-team-red text-white" : "bg-team-blue text-white"}>
                {g.winner === "red" ? "Red won" : "Blue won"}
              </Badge>
              <TeamIcons slugs={g.red} won={g.winner === "red"} team="red" />
              <span className="text-xs text-muted-foreground">vs</span>
              <TeamIcons slugs={g.blue} won={g.winner === "blue"} team="blue" />
              <span className="ml-auto text-xs text-muted-foreground">
                {[g.rank, g.duration_min && `${g.duration_min} min`, g.played_at && new Date(g.played_at).toLocaleDateString()].filter(Boolean).join(" · ")}
              </span>
            </div>
            {g.reasoning && <p className="line-clamp-2 text-sm text-muted-foreground">{g.reasoning}</p>}
          </Card>
        ))}
        {!shown.length && <Card className="py-10 text-center text-muted-foreground">No games logged yet.</Card>}
      </div>
    </>
  );
}
