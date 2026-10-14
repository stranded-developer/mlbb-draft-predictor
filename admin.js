// Backoffice: edit every knowledge-base value and review logged games.
// Reads/writes Supabase directly; row-level security only lets admins (see supabase/schema.sql) write.
const heroBySlug = new Map(HEROES.map((h) => [h.slug, h]));
const STATUS = ["confirmed", "theory"];
const POWER = ["", "1", "2", "3", "4", "5"];

// Field types: hero (hero picker), text, longtext, number, bool, select, tags (comma list), readonly, heroes (list).
const TABS = {
  hero_profiles: {
    label: "Heroes",
    key: "slug",
    help: "Meta status, ban recommendation, tags used by composition rules, and power by game phase (1–5).",
    fields: [
      { key: "slug", type: "readonlyHero" },
      { key: "status", type: "select", options: STATUS },
      { key: "is_meta", label: "Meta", type: "bool" },
      { key: "ban_recommended", label: "Recommend ban", type: "bool" },
      { key: "ban_note", label: "Ban reason", type: "text" },
      { key: "tags", type: "tags", hint: "thick, frontline, enchanter, anti_tank, split, rush, pickoff, slow_teamfight, anti_dash, dash, true_damage, anti_walking" },
      { key: "power_early", label: "Early", type: "select", options: POWER },
      { key: "power_mid", label: "Mid", type: "select", options: POWER },
      { key: "power_late", label: "Late", type: "select", options: POWER },
      { key: "notes", type: "longtext" },
    ],
    // Every hero gets a card, even ones with no profile yet.
    expand: (rows) => {
      const bySlug = new Map(rows.map((r) => [r.slug, r]));
      return HEROES.map((h) => bySlug.get(h.slug) || {
        slug: h.slug, is_meta: false, ban_recommended: false, ban_note: "", tags: [],
        power_early: null, power_mid: null, power_late: null, notes: "", status: "theory", _new: true,
      });
    },
    blank: null,
  },
  matchups: {
    label: "Counters",
    key: "id",
    help: `Counter beats target. Points empty = default for the kind (${Object.entries(MATCHUP_POINTS).map(([k, v]) => `${k} ${v}`).join(", ")}). "not" logs matchups that look like counters but aren't.`,
    fields: [
      { key: "counter", type: "hero" },
      { key: "target", type: "hero" },
      { key: "kind", type: "select", options: ["hard", "soft", "conditional", "not"] },
      { key: "points", type: "number" },
      { key: "status", type: "select", options: STATUS },
      { key: "why", type: "longtext" },
    ],
    blank: () => ({ counter: "", target: "", kind: "soft", points: null, why: "", status: "theory" }),
  },
  synergies: {
    label: "Synergies",
    key: "id",
    help: "Pairs that are stronger together. Points are added when both are on the same team.",
    fields: [
      { key: "hero_a", type: "hero" },
      { key: "hero_b", type: "hero" },
      { key: "points", type: "number" },
      { key: "status", type: "select", options: STATUS },
      { key: "why", type: "longtext" },
    ],
    blank: () => ({ hero_a: "", hero_b: "", points: 2, why: "", status: "theory" }),
  },
  item_advice: {
    label: "Items",
    key: "id",
    help: 'Trigger is "enemy:<hero>" (e.g. enemy:gloo) or "enemy_tag:<tag>>=<n>" (e.g. enemy_tag:thick>=2).',
    fields: [
      { key: "trigger", type: "text" },
      { key: "item", type: "text" },
      { key: "status", type: "select", options: STATUS },
      { key: "why", type: "longtext" },
    ],
    blank: () => ({ trigger: "", item: "", why: "", status: "theory" }),
  },
  rules: {
    label: "Rules",
    key: "id",
    upsertKey: "id",
    help: "Composition rules. Weight = advantage points against the team that breaks the rule.",
    fields: [
      { key: "id", type: "text" },
      { key: "weight", type: "number" },
      { key: "status", type: "select", options: STATUS },
      { key: "description", type: "longtext" },
    ],
    blank: () => ({ id: "", weight: 5, description: "", status: "theory" }),
  },
  games: {
    label: "Games",
    key: "id",
    help: "Logged games (add them from the draft page after picking). Edit the result or reasoning here.",
    fields: [
      { key: "played_at", label: "Played", type: "readonly" },
      { key: "red", type: "heroes" },
      { key: "blue", type: "heroes" },
      { key: "red_bans", label: "Red bans", type: "heroes" },
      { key: "blue_bans", label: "Blue bans", type: "heroes" },
      { key: "winner", type: "select", options: ["red", "blue"] },
      { key: "rank", type: "text" },
      { key: "duration_min", label: "Minutes", type: "number" },
      { key: "reasoning", type: "longtext" },
    ],
    blank: null,
    order: { column: "played_at", ascending: false },
  },
};

let db = null;
let canEdit = false;
let tab = "hero_profiles";
let rows = [];

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const heroName = (slug) => heroBySlug.get(slug)?.name || slug;
// Accepts a hero name or slug typed into a hero field.
const toSlug = (value) => {
  const v = value.trim().toLowerCase();
  return HEROES.find((h) => h.slug === v || h.name.toLowerCase() === v)?.slug || v;
};

function heroChip(slug) {
  const img = el("img", { src: `assets/heroes/${slug}.png`, alt: "", className: "chip-img" });
  return el("span", { className: "chip" }, [img, heroName(slug)]);
}

function fieldInput(field, value, onChange) {
  const label = field.label || field.key.replace(/_/g, " ");
  let input;
  switch (field.type) {
    case "readonlyHero":
      return el("div", { className: "field field-hero-title" }, [heroChip(value)]);
    case "readonly":
      return el("div", { className: "field" }, [el("span", { className: "field-label", textContent: label }),
        el("span", { textContent: value ? new Date(value).toLocaleString() : "" })]);
    case "heroes":
      return el("div", { className: "field field-wide" }, [el("span", { className: "field-label", textContent: label }),
        el("div", { className: "chips" }, (value || []).map(heroChip))]);
    case "bool":
      input = el("input", { type: "checkbox", checked: Boolean(value) });
      input.addEventListener("change", () => onChange(input.checked));
      return el("label", { className: "field field-bool" }, [input, label]);
    case "select":
      input = el("select", {}, field.options.map((o) => el("option", { value: o, textContent: o || "—" })));
      input.value = value == null ? "" : String(value);
      input.addEventListener("change", () =>
        onChange(field.options === POWER ? (input.value ? Number(input.value) : null) : input.value));
      break;
    case "longtext":
      input = el("textarea", { rows: 2, value: value || "" });
      input.addEventListener("input", () => onChange(input.value));
      break;
    case "number":
      input = el("input", { type: "number", step: "0.5", value: value ?? "" });
      input.addEventListener("input", () => onChange(input.value === "" ? null : Number(input.value)));
      break;
    case "tags":
      input = el("input", { value: (value || []).join(", "), placeholder: field.hint });
      input.addEventListener("input", () => onChange(input.value.split(",").map((t) => t.trim()).filter(Boolean)));
      break;
    case "hero":
      input = el("input", { value: value ? heroName(value) : "", placeholder: "Hero" });
      input.setAttribute("list", "hero-options");
      input.addEventListener("input", () => onChange(toSlug(input.value)));
      break;
    default:
      input = el("input", { value: value ?? "" });
      input.addEventListener("input", () => onChange(input.value));
  }
  input.disabled = !canEdit;
  const wide = field.type === "longtext" || field.type === "tags";
  return el("label", { className: "field" + (wide ? " field-wide" : "") }, [
    el("span", { className: "field-label", textContent: label }), input,
  ]);
}

function rowCard(row) {
  const cfg = TABS[tab];
  const draftRow = { ...row };
  const saveBtn = el("button", { className: "btn btn-primary", type: "button", textContent: "Save", disabled: true });
  const delBtn = el("button", { className: "btn btn-ghost", type: "button", textContent: "Delete" });
  const status = el("span", { className: "hint" });
  const card = el("div", { className: "card" + (row.status === "theory" ? " is-theory" : "") });

  const fields = cfg.fields.map((f) => fieldInput(f, row[f.key], (v) => {
    draftRow[f.key] = v;
    saveBtn.disabled = false;
    card.classList.add("dirty");
  }));

  saveBtn.addEventListener("click", async () => {
    const { _new, ...data } = draftRow;
    data.updated_at = new Date().toISOString();
    let res;
    if (tab === "hero_profiles") res = await db.from(tab).upsert(data, { onConflict: "slug" }).select().single();
    else if (cfg.upsertKey) res = await db.from(tab).upsert(data, { onConflict: cfg.upsertKey }).select().single();
    else if (data.id) {
      if (tab === "games") delete data.updated_at;
      res = await db.from(tab).update(data).eq("id", data.id).select().single();
    } else {
      delete data.id;
      res = await db.from(tab).insert(data).select().single();
    }
    if (res.error) {
      status.textContent = res.error.message;
      return;
    }
    Object.assign(row, res.data);
    delete row._new;
    Object.assign(draftRow, res.data);
    saveBtn.disabled = true;
    card.classList.remove("dirty");
    card.classList.toggle("is-theory", res.data.status === "theory");
    status.textContent = "Saved";
  });

  delBtn.addEventListener("click", async () => {
    const keyVal = row[cfg.key];
    if (keyVal != null && !row._new) {
      const { error } = await db.from(tab).delete().eq(cfg.key, keyVal);
      if (error) {
        status.textContent = error.message;
        return;
      }
    }
    rows = rows.filter((r) => r !== row);
    card.remove();
  });

  const actions = canEdit ? [saveBtn, ...(tab === "hero_profiles" ? [] : [delBtn]), status] : [];
  card.append(el("div", { className: "card-fields" }, fields), el("div", { className: "card-actions" }, actions));
  return card;
}

function matchesFilter(row, q) {
  if (!q) return true;
  return Object.values(row).some((v) => {
    const vals = Array.isArray(v) ? v : [v];
    return vals.some((x) => x != null && (String(x).toLowerCase().includes(q) || heroName(String(x)).toLowerCase().includes(q)));
  });
}

function renderRows() {
  const q = $("filter").value.trim().toLowerCase();
  $("rows").replaceChildren(...rows.filter((r) => matchesFilter(r, q)).map(rowCard));
}

async function loadTab() {
  const cfg = TABS[tab];
  $("tab-help").textContent = cfg.help;
  $("add-row").hidden = !canEdit || !cfg.blank;
  let data;
  if (db) {
    let query = db.from(tab).select("*");
    if (cfg.order) query = query.order(cfg.order.column, { ascending: cfg.order.ascending });
    const res = await query;
    data = res.error ? [] : res.data;
    if (res.error) $("tab-help").textContent = `Couldn't load: ${res.error.message}`;
  } else {
    data = KB[tab] ? KB[tab].map((r) => ({ ...r })) : [];
  }
  rows = cfg.expand ? cfg.expand(data) : data;
  renderRows();
}

function renderTabs() {
  $("tabs").replaceChildren(...Object.entries(TABS).map(([key, cfg]) => {
    const b = el("button", { type: "button", className: "tab" + (key === tab ? " active" : ""), textContent: cfg.label });
    b.addEventListener("click", () => {
      tab = key;
      $("filter").value = "";
      renderTabs();
      loadTab();
    });
    return b;
  }));
}

async function refreshAuth() {
  const session = await Store.session();
  let admin = false;
  if (session) {
    const { data } = await db.from("admins").select("email").limit(1);
    admin = Boolean(data && data.length);
  }
  canEdit = admin;
  $("login").hidden = Boolean(session);
  $("account").hidden = !session;
  $("account-email").textContent = session
    ? `${session.user.email}${admin ? "" : " — not an admin, read-only"}`
    : "";
}

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const { error } = await db.auth.signInWithPassword({ email: form.get("email"), password: form.get("password") });
  $("login-status").textContent = error ? error.message : "";
  if (!error) {
    e.target.reset();
    await refreshAuth();
    loadTab();
  }
});

$("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  await refreshAuth();
  loadTab();
});

$("filter").addEventListener("input", renderRows);
$("add-row").addEventListener("click", () => {
  const row = { ...TABS[tab].blank(), _new: true };
  rows.unshift(row);
  $("rows").prepend(rowCard(row));
});

$("hero-options").append(...HEROES.map((h) => el("option", { value: h.name })));

(async () => {
  db = await Store.client();
  if (db) {
    $("db-status").hidden = true;
    await refreshAuth();
  } else {
    $("db-status").textContent = "Database not connected — showing the bundled knowledge base read-only.";
  }
  renderTabs();
  loadTab();
})();
