"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, LogInIcon, LogOutIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Game, HeroProfile, ItemAdvice, KB, Matchup, Rule, Synergy } from "@/lib/kb";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import { useKb } from "@/lib/use-kb";
import { GameSheet, ItemSheet, MatchupSheet, RuleSheet, SynergySheet } from "./entry-sheets";
import { HeroesTab } from "./heroes-tab";
import { CountersTab, GamesTab, ItemsTab, RulesTab, SynergiesTab } from "./list-tabs";

type Editing =
  | { type: "matchup"; row: Matchup }
  | { type: "synergy"; row: Synergy }
  | { type: "item"; row: ItemAdvice }
  | { type: "rule"; row: Rule; isNew: boolean }
  | { type: "game"; row: Game }
  | null;

// Replace (or add) a row in a list by key.
function upsertBy<T>(list: T[], row: T, same: (a: T, b: T) => boolean) {
  return list.some((r) => same(r, row)) ? list.map((r) => (same(r, row) ? row : r)) : [...list, row];
}

export function AdminApp() {
  const { kb, setKb, source } = useKb();
  const { session, isAdmin, ready } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const canEdit = isAdmin && source === "db";

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.from("games").select("*").order("played_at", { ascending: false }).then(({ data }) => {
      if (!cancelled && data) setGames(data as Game[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = <K extends keyof KB>(table: K, fn: (rows: KB[K]) => KB[K]) =>
    setKb((cur) => ({ ...cur, [table]: fn(cur[table]) }));
  const close = () => setEditing(null);
  const byId = <T extends { id?: number }>(a: T, b: T) => a.id === b.id;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/" aria-label="Back to draft" />}>
          <ArrowLeftIcon />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Backoffice</h1>
          <p className="text-sm text-muted-foreground">The knowledge the draft analysis is built on.</p>
        </div>
        {session ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{session.user.email}</span>
            {isAdmin && <Badge variant="secondary">Admin</Badge>}
            <Button variant="outline" size="sm" onClick={() => supabase?.auth.signOut()}>
              <LogOutIcon /> Sign out
            </Button>
          </div>
        ) : (
          supabase && ready && (
            <Button onClick={() => setLoginOpen(true)}>
              <LogInIcon /> Sign in to edit
            </Button>
          )
        )}
      </header>

      {source === "seed" && (
        <Alert className="mb-4">
          <TriangleAlertIcon />
          <AlertTitle>Database not connected</AlertTitle>
          <AlertDescription>Showing the starting data, read-only.</AlertDescription>
        </Alert>
      )}
      {session && !isAdmin && source === "db" && (
        <Alert className="mb-4">
          <TriangleAlertIcon />
          <AlertTitle>Signed in, but not an admin</AlertTitle>
          <AlertDescription>
            Add your email to the admins table in Supabase&apos;s SQL Editor:{" "}
            <code className="font-mono">insert into admins (email) values (&apos;{session.user.email}&apos;);</code>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="heroes">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="heroes">Heroes <Count n={kb.hero_profiles.length} /></TabsTrigger>
          <TabsTrigger value="counters">Counters <Count n={kb.matchups.length} /></TabsTrigger>
          <TabsTrigger value="synergies">Synergies <Count n={kb.synergies.length} /></TabsTrigger>
          <TabsTrigger value="items">Items <Count n={kb.item_advice.length} /></TabsTrigger>
          <TabsTrigger value="rules">Rules <Count n={kb.rules.length} /></TabsTrigger>
          <TabsTrigger value="games">Games <Count n={games.length} /></TabsTrigger>
        </TabsList>

        <TabsContent value="heroes">
          <HeroesTab
            kb={kb}
            canEdit={canEdit}
            onProfileSaved={(p: HeroProfile) => patch("hero_profiles", (rows) => upsertBy(rows, p, (a, b) => a.slug === b.slug))}
            openMatchup={(row) => setEditing({ type: "matchup", row })}
            openSynergy={(row) => setEditing({ type: "synergy", row })}
          />
        </TabsContent>
        <TabsContent value="counters">
          <CountersTab
            rows={kb.matchups}
            onOpen={(row) => setEditing({ type: "matchup", row })}
            onAdd={canEdit ? () => setEditing({ type: "matchup", row: { counter: "", target: "", kind: "soft", points: null, why: "", status: "theory" } }) : undefined}
          />
        </TabsContent>
        <TabsContent value="synergies">
          <SynergiesTab
            rows={kb.synergies}
            onOpen={(row) => setEditing({ type: "synergy", row })}
            onAdd={canEdit ? () => setEditing({ type: "synergy", row: { hero_a: "", hero_b: "", points: 2, why: "", status: "theory" } }) : undefined}
          />
        </TabsContent>
        <TabsContent value="items">
          <ItemsTab
            rows={kb.item_advice}
            onOpen={(row) => setEditing({ type: "item", row })}
            onAdd={canEdit ? () => setEditing({ type: "item", row: { trigger: "enemy:", item: "", why: "", status: "theory" } }) : undefined}
          />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab
            rows={kb.rules}
            onOpen={(row) => setEditing({ type: "rule", row, isNew: false })}
            onAdd={canEdit ? () => setEditing({ type: "rule", row: { id: "", weight: 5, description: "", status: "theory" }, isNew: true }) : undefined}
          />
        </TabsContent>
        <TabsContent value="games">
          <GamesTab rows={games} onOpen={(row) => setEditing({ type: "game", row })} />
        </TabsContent>
      </Tabs>

      <MatchupSheet
        row={editing?.type === "matchup" ? editing.row : null}
        canEdit={canEdit}
        onClose={close}
        onSaved={(m) => patch("matchups", (rows) => upsertBy(rows, m, byId))}
        onDeleted={(m) => patch("matchups", (rows) => rows.filter((r) => r.id !== m.id))}
      />
      <SynergySheet
        row={editing?.type === "synergy" ? editing.row : null}
        canEdit={canEdit}
        onClose={close}
        onSaved={(s) => patch("synergies", (rows) => upsertBy(rows, s, byId))}
        onDeleted={(s) => patch("synergies", (rows) => rows.filter((r) => r.id !== s.id))}
      />
      <ItemSheet
        row={editing?.type === "item" ? editing.row : null}
        canEdit={canEdit}
        onClose={close}
        onSaved={(i) => patch("item_advice", (rows) => upsertBy(rows, i, byId))}
        onDeleted={(i) => patch("item_advice", (rows) => rows.filter((r) => r.id !== i.id))}
      />
      <RuleSheet
        row={editing?.type === "rule" ? editing.row : null}
        isNew={editing?.type === "rule" && editing.isNew}
        canEdit={canEdit}
        onClose={close}
        onSaved={(r) => patch("rules", (rows) => upsertBy(rows, r, (a, b) => a.id === b.id))}
        onDeleted={(r) => patch("rules", (rows) => rows.filter((x) => x.id !== r.id))}
      />
      <GameSheet
        row={editing?.type === "game" ? editing.row : null}
        canEdit={canEdit}
        onClose={close}
        onSaved={(g) => setGames((rows) => upsertBy(rows, g, byId))}
        onDeleted={(g) => setGames((rows) => rows.filter((r) => r.id !== g.id))}
      />

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </main>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground tabular-nums">{n}</span>;
}

function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPassword("");
    onOpenChange(false);
    toast.success("Signed in");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>Use the account you created in Supabase (Authentication → Users).</DialogDescription>
        </DialogHeader>
        <form onSubmit={signIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
