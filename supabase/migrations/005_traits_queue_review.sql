-- 005: strong/weak against hero traits, solo/party queue setting, Alice / Alpha / Alucard review. Safe to re-run.

alter table hero_profiles
  add column if not exists strong_vs_traits text[] not null default '{}',
  add column if not exists weak_vs_traits text[] not null default '{}';

insert into hero_profiles (slug, is_meta, tags, power_early, power_mid, power_late, notes, status, ratings, difficulty, specs_reviewed, tier, rank_bias, strong_vs_types, weak_vs_types, strong_vs_traits, weak_vs_traits) values
  ('alice', true, array['thick']::text[], 2, 3, 5, 'S tier with Angela, A tier without; in the meta. Sustain teamfighter, front-to-back. Easily kited early; scales hard late. Weak to anti-heal (Baxia), crowd control and kiting heroes (Karrie, Lunox). Strong against tanky EXP fighters and fighter gold laners. Alpha can win early but Alice mostly out-sustains him late. Franco''s suppress is strong before Alice stacks. Lower ranks have a harder time against her.', 'confirmed', '{"frontline":4,"cc":4,"mobility":3,"wave_clear":3,"objective":1,"hg_defense":3,"teamfight":5,"pickoff":2,"sustain":5}'::jsonb, 3, true, 'A', 2, array[]::text[], array[]::text[], array['thick']::text[], array['anti_heal', 'cc', 'mobility']::text[]),
  ('alucard', false, array[]::text[], 3, 4, 4, 'Decent against certain drafts: strong sustain and damage against enemies without stuns (lifesteal). Bad against drafts with stunners. If he gets ahead early he snowballs very hard and farms very fast. Weak to anti-heal, hard crowd control and kiting. Much stronger in low ranks and solo queue (uncoordinated teams).', 'confirmed', '{"frontline":2,"cc":0,"mobility":3,"wave_clear":3,"objective":3,"hg_defense":2,"teamfight":2,"pickoff":2,"sustain":5}'::jsonb, 1, true, 'C', 2, array[]::text[], array[]::text[], array[]::text[], array['cc', 'anti_heal']::text[]),
  ('alpha', false, array['anti_tank', 'dive', 'pickoff', 'true_damage']::text[], 3, 5, 3, 'Strong against Belerick, Carmilla and tank-heavy drafts (true damage). Falls off late. Pickoff/dive, all-in commit — can''t really poke. Must land his ultimate. Estes is a strong counter.', 'confirmed', '{"frontline":3,"cc":3,"mobility":3,"wave_clear":3,"objective":3,"hg_defense":2,"teamfight":3,"pickoff":2,"sustain":3}'::jsonb, 2, true, 'B', 0, array[]::text[], array[]::text[], array['thick']::text[], array[]::text[])
on conflict (slug) do update set is_meta = excluded.is_meta, tags = excluded.tags, power_early = excluded.power_early, power_mid = excluded.power_mid, power_late = excluded.power_late, notes = excluded.notes, status = excluded.status, ratings = excluded.ratings, difficulty = excluded.difficulty, specs_reviewed = excluded.specs_reviewed, tier = excluded.tier, rank_bias = excluded.rank_bias, strong_vs_types = excluded.strong_vs_types, weak_vs_types = excluded.weak_vs_types, strong_vs_traits = excluded.strong_vs_traits, weak_vs_traits = excluded.weak_vs_traits;

insert into matchups (counter, target, kind, status, why) values
  ('alice', 'aulus', 'soft', 'confirmed', 'Alice out-sustains Aulus.'),
  ('estes', 'alpha', 'hard', 'confirmed', 'Estes''s healing out-sustains Alpha''s all-in.'),
  ('baxia', 'alice', 'hard', 'confirmed', 'Baxia''s anti-heal shuts down Alice''s sustain.'),
  ('karrie', 'alice', 'soft', 'confirmed', 'Kites Alice and shreds her with true damage.'),
  ('lunox', 'alice', 'soft', 'confirmed', 'Kites Alice from range.'),
  ('alpha', 'alice', 'conditional', 'confirmed', 'Alpha can win early; Alice out-sustains him late.'),
  ('alice', 'alpha', 'soft', 'confirmed', 'Late game Alice mostly out-sustains Alpha.'),
  ('franco', 'alice', 'soft', 'confirmed', 'Franco''s suppress is strong before Alice gets her stacks.'),
  ('alpha', 'belerick', 'hard', 'confirmed', 'True damage melts Belerick.'),
  ('alpha', 'carmilla', 'hard', 'confirmed', 'True damage melts Carmilla.'),
  ('franco', 'alucard', 'soft', 'confirmed', 'Hard crowd control locks Alucard down before he can lifesteal.'),
  ('kaja', 'alucard', 'soft', 'confirmed', 'Hard crowd control locks Alucard down before he can lifesteal.'),
  ('chou', 'alucard', 'soft', 'confirmed', 'Hard crowd control locks Alucard down before he can lifesteal.'),
  ('baxia', 'alucard', 'soft', 'confirmed', 'Anti-heal cuts Alucard''s lifesteal.')
on conflict (counter, target) do update set kind = excluded.kind, status = excluded.status, why = excluded.why;

update synergies set points = 6, status = 'confirmed', why = 'Angela makes Alice S tier (A tier without her).' where hero_a = 'alice' and hero_b = 'angela';

insert into item_advice (trigger, item, for_role, status, why) values
  ('enemy:alice', 'Dominance Ice / Necklace of Durance', null, 'confirmed', 'Anti-heal is the key answer to Alice''s sustain.'),
  ('enemy:alucard', 'Dominance Ice / Sea Halberd', null, 'confirmed', 'Anti-heal cuts Alucard''s lifesteal.')
on conflict (trigger, item) do nothing;

insert into rules (id, weight, status, description) values
  ('trait-fit', 2, 'theory', 'Points when a hero faces enemy heroes with a trait it is strong against (or lost when weak against it). Counted once per trait.'),
  ('setting-solo-queue', 0.5, 'theory', 'Setting: in solo queue, rank-sensitive heroes count as this many ranks lower (party queue: this many higher).')
on conflict (id) do nothing;
