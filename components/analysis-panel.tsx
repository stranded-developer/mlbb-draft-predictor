"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { heroName } from "@/lib/heroes";
import { ADVANTAGE_MAX } from "@/lib/kb";
import { PHASES, describeType, type Analysis, type Reason, type Side } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { HeroAvatar } from "./hero-avatar";
import { TheoryBadge } from "./status";

const SIDE_NAME: Record<Side, string> = { red: "Red", blue: "Blue" };
const sideText = (s: Side) => (s === "red" ? "text-team-red" : "text-team-blue");

function verdict(advantage: number) {
  if (advantage < 3) return "Even — skill decides";
  if (advantage < 10) return "Slight edge";
  if (advantage < 20) return "Clear advantage";
  if (advantage < 30) return "Big advantage";
  return "Very hard to beat";
}

// Horizontal bar: red fills from the centre to the left, blue to the right.
function AdvantageBar({ advantage, favored, size = "lg" }: { advantage: number; favored: Side | null; size?: "lg" | "sm" }) {
  const pct = (advantage / ADVANTAGE_MAX) * 50;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-muted", size === "lg" ? "h-3" : "h-1.5")}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
      {favored && (
        <div
          className={cn("absolute inset-y-0", favored === "red" ? "right-1/2 bg-team-red" : "left-1/2 bg-team-blue")}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}

function ReasonRow({ r }: { r: Reason }) {
  return (
    <li className="flex gap-3 py-2">
      <span className={cn("w-9 shrink-0 text-right font-mono text-sm tabular-nums", sideText(r.side))}>+{+r.points.toFixed(1)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{r.title}</span>
          {r.status === "theory" && <TheoryBadge />}
        </div>
        {r.why && <p className="text-xs text-muted-foreground">{r.why}</p>}
      </div>
    </li>
  );
}

export function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  const { advantage, favored, phases, reasons, items, winConditions, types, unreviewed } = analysis;
  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Draft advantage</p>
              <p className="text-3xl font-semibold">
                {favored ? <span className={sideText(favored)}>{SIDE_NAME[favored]} +{advantage}</span> : "Even"}
              </p>
              <p className="text-sm text-muted-foreground">{verdict(advantage)}</p>
            </div>
            <div className="text-right font-mono text-xs text-muted-foreground tabular-nums">
              <div><span className="text-team-red">Red</span> {analysis.points.red.toFixed(1)} pts</div>
              <div><span className="text-team-blue">Blue</span> {analysis.points.blue.toFixed(1)} pts</div>
            </div>
          </div>
          <AdvantageBar advantage={advantage} favored={favored} />
          <div className="grid gap-2 sm:grid-cols-3">
            {PHASES.map((p) => (
              <div key={p} className="rounded-lg bg-muted/50 p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{p} game</span>
                  <span className={cn("font-medium", phases[p].favored && sideText(phases[p].favored!))}>
                    {phases[p].favored ? `${SIDE_NAME[phases[p].favored!]} +${phases[p].advantage}` : "Even"}
                  </span>
                </div>
                <AdvantageBar advantage={phases[p].advantage} favored={phases[p].favored} size="sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["red", "blue"] as Side[]).map((side) => (
          <Card key={side} size="sm">
            <CardHeader>
              <CardTitle className={sideText(side)}>{SIDE_NAME[side]}&apos;s win condition</CardTitle>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {describeType(types[side]).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {winConditions[side].map((w) => <li key={w}>{w}</li>)}
              </ul>
              {items[side].length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Itemization</p>
                  {items[side].map((t) => (
                    <div key={t.item} className="text-sm">
                      {t.forHeroes.length > 0 && <span className="text-muted-foreground">{t.forHeroes.map(heroName).join(", ")}: </span>}
                      <span className="font-medium">{t.item}</span>{" "}
                      <span className="text-muted-foreground">vs {t.because.map(heroName).join(", ")}</span>
                      {t.status === "theory" && <> <TheoryBadge /></>}
                      {t.why && <p className="text-xs text-muted-foreground">{t.why}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Why</CardTitle>
          <CardDescription>Every factor that moved the score, biggest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {reasons.length ? (
            <ul className="divide-y divide-border">{reasons.map((r, i) => <ReasonRow key={i} r={r} />)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">No counters, synergies or rule breaks found — the knowledge base has nothing on this draft yet.</p>
          )}
        </CardContent>
      </Card>

      {unreviewed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Draft specs</Badge>
          <span>Not yet reviewed:</span>
          {unreviewed.map((s) => <HeroAvatar key={s} slug={s} className="size-5" />)}
        </div>
      )}
    </div>
  );
}
