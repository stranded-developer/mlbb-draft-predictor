-- MLBB draft predictor schema. Run once in the Supabase SQL editor, then run seed.sql.
-- Anyone can read the knowledge base; only emails listed in `admins` can write.

create table if not exists admins (
  email text primary key
);

create table if not exists hero_profiles (
  slug text primary key,
  is_meta boolean not null default false,
  ban_recommended boolean not null default false,
  ban_note text not null default '',
  tags text[] not null default '{}',
  power_early smallint check (power_early between 1 and 5),
  power_mid smallint check (power_mid between 1 and 5),
  power_late smallint check (power_late between 1 and 5),
  notes text not null default '',
  status text not null default 'theory' check (status in ('confirmed', 'theory')),
  updated_at timestamptz not null default now()
);

create table if not exists matchups (
  id bigint generated always as identity primary key,
  counter text not null,
  target text not null,
  kind text not null check (kind in ('hard', 'soft', 'conditional', 'not')),
  points numeric,
  why text not null default '',
  status text not null default 'theory' check (status in ('confirmed', 'theory')),
  updated_at timestamptz not null default now(),
  unique (counter, target)
);

create table if not exists synergies (
  id bigint generated always as identity primary key,
  hero_a text not null,
  hero_b text not null,
  points numeric not null default 2,
  why text not null default '',
  status text not null default 'theory' check (status in ('confirmed', 'theory')),
  updated_at timestamptz not null default now(),
  unique (hero_a, hero_b)
);

create table if not exists item_advice (
  id bigint generated always as identity primary key,
  trigger text not null,
  item text not null,
  why text not null default '',
  status text not null default 'theory' check (status in ('confirmed', 'theory')),
  updated_at timestamptz not null default now(),
  unique (trigger, item)
);

create table if not exists rules (
  id text primary key,
  weight numeric not null,
  description text not null default '',
  status text not null default 'theory' check (status in ('confirmed', 'theory')),
  updated_at timestamptz not null default now()
);

-- Logged 5v5 games with the result and the reasoning behind it, for refining the analysis.
create table if not exists games (
  id bigint generated always as identity primary key,
  played_at timestamptz not null default now(),
  red text[] not null,
  blue text[] not null,
  red_bans text[] not null default '{}',
  blue_bans text[] not null default '{}',
  winner text not null check (winner in ('red', 'blue')),
  predicted numeric,
  reasoning text not null default '',
  rank text not null default '',
  duration_min smallint
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

do $$
declare t text;
begin
  foreach t in array array['hero_profiles', 'matchups', 'synergies', 'item_advice', 'rules', 'games'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

alter table admins enable row level security;
drop policy if exists "admin read" on admins;
create policy "admin read" on admins for select using (is_admin());
