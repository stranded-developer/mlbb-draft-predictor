const TEAM_SIZE = 5;
const draft = {
  red: Array(TEAM_SIZE).fill(null),
  blue: Array(TEAM_SIZE).fill(null),
  redBan: Array(BANS_PER_TEAM).fill(null),
  blueBan: Array(BANS_PER_TEAM).fill(null),
};
const GROUP_LABEL = { red: "Red team", blue: "Blue team", redBan: "Red ban", blueBan: "Blue ban" };
let activeSlot = null; // { team, index }
let kb = { ...KB, source: "seed" };
let signedIn = false;

const heroById = new Map(HEROES.map((h) => [h.id, h]));
const heroBySlug = new Map(HEROES.map((h) => [h.slug, h]));
const picker = document.getElementById("picker");
const grid = document.getElementById("hero-grid");
const search = document.getElementById("search");
const analyseBtn = document.getElementById("analyse");
const hint = document.getElementById("hint");
const result = document.getElementById("result");

function initials(name) {
  return name.split(/[\s-]+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Hero image with an initials fallback for heroes that don't have art yet.
function avatar(hero) {
  const img = document.createElement("img");
  img.className = "avatar";
  img.alt = hero.name;
  img.src = `assets/heroes/${hero.slug}.png`;
  img.onerror = () => {
    const fb = document.createElement("div");
    fb.className = "avatar-fallback";
    fb.textContent = initials(hero.name);
    img.replaceWith(fb);
  };
  return img;
}

// Which slot group (pick or ban) a hero is already in, if any.
function groupOf(heroId) {
  return Object.keys(draft).find((g) => draft[g].includes(heroId)) || null;
}

function renderSlots() {
  for (const team of Object.keys(draft)) {
    const container = document.querySelector(`.slots[data-team="${team}"]`);
    container.replaceChildren(
      ...draft[team].map((heroId, index) => {
        const hero = heroById.get(heroId);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot" + (hero ? " filled" : "");
        btn.setAttribute("aria-label", `${GROUP_LABEL[team]} ${index + 1}${hero ? `: ${hero.name}` : ""}`);
        const circle = document.createElement("div");
        circle.className = "slot-circle";
        if (hero) circle.append(avatar(hero));
        else circle.textContent = team.endsWith("Ban") ? "⊘" : "+";
        const label = document.createElement("span");
        label.className = "slot-name";
        label.textContent = hero ? hero.name : "";
        btn.append(circle, label);
        btn.addEventListener("click", () => openPicker(team, index));
        return btn;
      })
    );
  }
  renderRecBans();
  const filled = [...draft.red, ...draft.blue].filter(Boolean).length;
  analyseBtn.disabled = filled < TEAM_SIZE * 2;
  document.getElementById("log-game").hidden = !signedIn || analyseBtn.disabled;
  hint.textContent = analyseBtn.disabled
    ? `Pick all 10 heroes to analyse the draft (${filled}/10).`
    : "Draft complete — ready to analyse.";
}

function renderGrid() {
  const q = search.value.trim().toLowerCase();
  const current = draft[activeSlot.team][activeSlot.index];
  grid.replaceChildren(
    ...HEROES.filter((h) => h.name.toLowerCase().includes(q)).map((hero) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hero";
      const taken = groupOf(hero.id);
      // A hero can only appear once across all picks and bans (except re-picking the current slot).
      if (taken && hero.id !== current) {
        btn.disabled = true;
        btn.classList.add(taken.endsWith("Ban") ? "taken-ban" : `taken-${taken}`);
        btn.title = taken.endsWith("Ban") ? "Banned" : `Already picked by ${taken} team`;
      }
      const imgWrap = document.createElement("div");
      imgWrap.className = "hero-img";
      imgWrap.append(avatar(hero));
      const name = document.createElement("span");
      name.className = "hero-name";
      name.textContent = hero.name;
      btn.append(imgWrap, name);
      btn.addEventListener("click", () => selectHero(hero.id));
      return btn;
    })
  );
}

function openPicker(team, index) {
  activeSlot = { team, index };
  document.getElementById("picker-title").textContent =
    `${GROUP_LABEL[team]} — slot ${index + 1}`;
  search.value = "";
  renderGrid();
  picker.showModal();
  search.focus();
}

function selectHero(heroId) {
  draft[activeSlot.team][activeSlot.index] = heroId;
  picker.close();
  result.hidden = true;
  // Unproven knowledge is labelled "theory" everywhere it's shown.
function theoryBadge() {
  return Object.assign(document.createElement("span"), { className: "theory", textContent: "theory" });
}

const slugsOf = (group) => draft[group].filter(Boolean).map((id) => heroById.get(id).slug);

document.getElementById("log-game").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const status = document.getElementById("log-status");
  const db = await Store.client();
  const { error } = await db.from("games").insert({
    red: slugsOf("red"),
    blue: slugsOf("blue"),
    red_bans: slugsOf("redBan"),
    blue_bans: slugsOf("blueBan"),
    winner: form.get("winner"),
    reasoning: form.get("reasoning").trim(),
    rank: form.get("rank").trim(),
    duration_min: Number(form.get("duration_min")) || null,
  });
  status.textContent = error ? `Couldn't save: ${error.message}` : "Saved.";
  if (!error) e.target.reset();
});

renderSlots();
(async () => {
  kb = await Store.loadKB();
  signedIn = Boolean(await Store.session());
  renderSlots();
})();
}

// Clicking a recommended ban fills the next empty ban slot, alternating blue then red.
function addBan(heroId) {
  if (groupOf(heroId)) return;
  const count = (g) => draft[g].filter(Boolean).length;
  const order = count("blueBan") <= count("redBan") ? ["blueBan", "redBan"] : ["redBan", "blueBan"];
  const group = order.find((g) => draft[g].includes(null));
  if (!group) return;
  draft[group][draft[group].indexOf(null)] = heroId;
  renderSlots();
}

function renderRecBans() {
  const list = document.getElementById("rec-bans");
  const recs = kb.hero_profiles.filter((p) => p.ban_recommended && heroBySlug.has(p.slug));
  list.replaceChildren(
    ...recs.map(({ slug, ban_note: why, status }) => {
      const hero = heroBySlug.get(slug);
      const taken = groupOf(hero.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rec-ban" + (taken ? " used" : "");
      btn.disabled = Boolean(taken);
      btn.title = why;
      const imgWrap = document.createElement("div");
      imgWrap.className = "hero-img";
      imgWrap.append(avatar(hero));
      const name = document.createElement("span");
      name.className = "hero-name";
      name.textContent = hero.name;
      btn.append(imgWrap, name);
      if (status === "theory") btn.append(theoryBadge());
      btn.addEventListener("click", () => addBan(hero.id));
      return btn;
    })
  );
}

search.addEventListener("input", renderGrid);
search.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const first = grid.querySelector(".hero:not(:disabled)");
  if (first) first.click();
});
document.getElementById("close-picker").addEventListener("click", () => picker.close());
document.getElementById("clear-slot").addEventListener("click", () => selectHero(null));
picker.addEventListener("click", (e) => { if (e.target === picker) picker.close(); });

document.getElementById("reset").addEventListener("click", () => {
  Object.values(draft).forEach((slots) => slots.fill(null));
  result.hidden = true;
  renderSlots();
});

analyseBtn.addEventListener("click", () => {
  // Placeholder until the win-rate model is wired up.
  const names = (team) => draft[team].map((id) => heroById.get(id).name).join(", ");
  result.hidden = false;
  result.innerHTML = "";
  result.append(
    Object.assign(document.createElement("p"), { textContent: `Red: ${names("red")}` }),
    Object.assign(document.createElement("p"), { textContent: `Blue: ${names("blue")}` }),
    Object.assign(document.createElement("p"), { className: "hint", textContent: "Win-rate analysis coming next." })
  );
});

renderSlots();
