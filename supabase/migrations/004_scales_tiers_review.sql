-- 004: 0–5 ratings and 1–5 difficulty, meta tiers, rank sensitivity, strong/weak vs draft types,
-- plus the Aamon / Akai / Aldous review. Safe to re-run: the rescale only ever runs once.

create table if not exists applied_migrations (id text primary key, applied_at timestamptz not null default now());
alter table applied_migrations enable row level security;

alter table hero_profiles
  add column if not exists tier text check (tier in ('S', 'A', 'B', 'C', 'D')),
  add column if not exists rank_bias smallint not null default 0 check (rank_bias between -2 and 2),
  add column if not exists strong_vs_types text[] not null default '{}',
  add column if not exists weak_vs_types text[] not null default '{}';
alter table hero_profiles drop constraint if exists hero_profiles_difficulty_check;

do $$
begin
  if not exists (select 1 from applied_migrations where id = '004-rescale') then
    -- ratings 0–3 → 0–5 (0→0, 1→2, 2→3, 3→5); difficulty 1–3 → 1–5 (1→1, 2→3, 3→5)
    update hero_profiles set ratings = (
      select coalesce(jsonb_object_agg(key, case value::int when 1 then 2 when 2 then 3 when 3 then 5 else value::int end), '{}'::jsonb)
      from jsonb_each_text(ratings)
    );
    update hero_profiles set difficulty = case difficulty when 2 then 3 when 3 then 5 else difficulty end;
    update hero_profiles set tier = 'S' where is_meta and tier is null;
    insert into applied_migrations (id) values ('004-rescale');
  end if;
end $$;
alter table hero_profiles add constraint hero_profiles_difficulty_check check (difficulty between 1 and 5);

delete from rules where id = 'meta-hero';
insert into rules (id, weight, status, description) values
  ('tier-s', 4, 'theory', 'Points for each S-tier (meta) hero picked.'),
  ('tier-a', 2, 'theory', 'Points for each A-tier hero picked.'),
  ('tier-c', -2, 'theory', 'Points for each C-tier hero picked (negative = weak in the meta).'),
  ('tier-d', -4, 'theory', 'Points for each D-tier hero picked (negative = out of the meta).'),
  ('rank-bias', 1.5, 'theory', 'Points per step of a hero''s rank sensitivity: added in low-rank games, subtracted in high-rank games.'),
  ('type-fit', 3, 'theory', 'Points when a hero is strong against the enemy''s draft type (or lost when weak against it).'),
  ('stealth-vs-targeted', 3, 'theory', 'A stealth hero (e.g. Aamon) against 2+ enemies that rely on targeting skills.')
on conflict (id) do nothing;

-- Reviewed heroes (your answers).
insert into hero_profiles (slug, tags, power_early, power_mid, power_late, notes, status, ratings, difficulty, specs_reviewed, tier, rank_bias, strong_vs_types, weak_vs_types) values
  ('akai', array[]::text[], 4, 4, 3, 'Very recommended against certain drafts, e.g. Aulus, Lukas and dive comps — easily disrupts them. Very strong high-ground defense. Not naturally a frontline. Falls off late due to long cooldowns and more mobile enemies. Strong invade: built-in dash + stun at levels 1–2 for pickoffs. Weak to Purify and CC immunity (Diggie). Lesley is the best anti-tank into him; Karrie, X.Borg and Dyrroth get spun by his ultimate.', 'confirmed', '{"frontline":2,"cc":5,"mobility":2,"wave_clear":2,"objective":2,"hg_defense":4,"teamfight":4,"pickoff":3,"sustain":2}'::jsonb, 3, true, null, 0, array['Dive']::text[], array[]::text[]),
  ('aldous', array['pickoff', 'split']::text[], 1, 2, 4, 'Out of meta — too immobile, hard to make viable. Plays as an assassin finisher from the EXP lane. Very weak early. Late game easily bursts far-back squishies (Lesley, Layla) but needs good timing. Split push is strong and must be respected, but leaves the team without an EXP frontline. Countered by defensive items and teams that stick together.', 'confirmed', '{"frontline":3,"cc":2,"mobility":1,"wave_clear":3,"objective":4,"hg_defense":0,"teamfight":1,"pickoff":5,"sustain":3}'::jsonb, 4, true, 'D', 0, array[]::text[], array['Teamfight']::text[]),
  ('aamon', array['pickoff', 'stealth']::text[], 2, 4, 4, 'Strong mid to late game, weak early. No dash, but camouflage is very strong in lower ranks; higher ranks can dodge his ultimate with dashes and Flicker (not easy). Easy to play but timing matters. Strong against immobile heroes and heroes that rely on targeting (camouflage). Recommended jungle pick against front-to-back drafts with an immobile backline. Close to meta (A tier).', 'confirmed', '{"frontline":0,"cc":0,"mobility":5,"wave_clear":0,"objective":2,"hg_defense":0,"teamfight":0,"pickoff":5,"sustain":3}'::jsonb, 1, true, 'A', 1, array['Front-to-back']::text[], array[]::text[])
on conflict (slug) do update set tags = excluded.tags, power_early = excluded.power_early, power_mid = excluded.power_mid, power_late = excluded.power_late, notes = excluded.notes, status = excluded.status, ratings = excluded.ratings, difficulty = excluded.difficulty, specs_reviewed = excluded.specs_reviewed, tier = excluded.tier, rank_bias = excluded.rank_bias, strong_vs_types = excluded.strong_vs_types, weak_vs_types = excluded.weak_vs_types;

insert into matchups (counter, target, kind, status, why) values
  ('aamon', 'layla', 'soft', 'confirmed', 'Camouflage walks past the frontline onto immobile backliners.'),
  ('aamon', 'miya', 'soft', 'confirmed', 'Camouflage walks past the frontline onto immobile backliners.'),
  ('aamon', 'eudora', 'soft', 'confirmed', 'Camouflage walks past the frontline onto immobile backliners.'),
  ('aamon', 'cyclops', 'soft', 'confirmed', 'Camouflage walks past the frontline onto immobile backliners.'),
  ('gloo', 'aamon', 'hard', 'confirmed', 'Aamon is very weak against Gloo.'),
  ('freya', 'aamon', 'soft', 'confirmed', 'Strong fighters like Freya beat Aamon.'),
  ('aurora', 'aamon', 'soft', 'confirmed', 'Area crowd control catches Aamon while camouflaged.'),
  ('vexana', 'aamon', 'soft', 'confirmed', 'Area crowd control catches Aamon while camouflaged.'),
  ('novaria', 'aamon', 'soft', 'confirmed', 'Novaria''s vision reveals Aamon.'),
  ('akai', 'aulus', 'hard', 'confirmed', 'Akai''s ultimate disrupts Aulus''s dive.'),
  ('akai', 'lukas', 'hard', 'confirmed', 'Akai''s ultimate disrupts Lukas''s dive.'),
  ('diggie', 'akai', 'hard', 'confirmed', 'Diggie''s ultimate cleanses Akai''s ultimate.'),
  ('lesley', 'akai', 'soft', 'confirmed', 'Best anti-tank into Akai — out of range of his spin.'),
  ('karrie', 'akai', 'not', 'confirmed', 'Gets spun by Akai''s ultimate, so the anti-tank damage doesn''t land.'),
  ('x-borg', 'akai', 'not', 'confirmed', 'Gets spun by Akai''s ultimate, so the anti-tank damage doesn''t land.'),
  ('dyrroth', 'akai', 'not', 'confirmed', 'Gets spun by Akai''s ultimate, so the anti-tank damage doesn''t land.'),
  ('aldous', 'lesley', 'soft', 'confirmed', 'Late game Aldous bursts far-back squishies — needs good timing.'),
  ('aldous', 'layla', 'soft', 'confirmed', 'Late game Aldous bursts far-back squishies — needs good timing.')
on conflict (counter, target) do update set kind = excluded.kind, status = excluded.status, why = excluded.why;

insert into synergies (hero_a, hero_b, points, status, why) values
  ('aamon', 'alice', 2, 'confirmed', 'Frontliner who exposes the backline for Aamon to finish.'),
  ('aamon', 'minotaur', 2, 'confirmed', 'Frontliner who exposes the backline for Aamon to finish.'),
  ('aamon', 'lapu-lapu', 2, 'confirmed', 'Frontliner who exposes the backline for Aamon to finish.')
on conflict (hero_a, hero_b) do nothing;

insert into item_advice (trigger, item, for_role, status, why) values ('enemy:akai', 'Purify (spell)', null, 'confirmed', 'Purify escapes Akai''s ultimate.') on conflict (trigger, item) do nothing;
