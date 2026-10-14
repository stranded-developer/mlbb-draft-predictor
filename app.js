const TEAM_SIZE = 5;
const draft = { red: Array(TEAM_SIZE).fill(null), blue: Array(TEAM_SIZE).fill(null) };
let activeSlot = null; // { team, index }

const heroById = new Map(HEROES.map((h) => [h.id, h]));
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

function teamOf(heroId) {
  if (draft.red.includes(heroId)) return "red";
  if (draft.blue.includes(heroId)) return "blue";
  return null;
}

function renderSlots() {
  for (const team of ["red", "blue"]) {
    const container = document.querySelector(`.slots[data-team="${team}"]`);
    container.replaceChildren(
      ...draft[team].map((heroId, index) => {
        const hero = heroById.get(heroId);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot" + (hero ? " filled" : "");
        btn.setAttribute("aria-label", `${team} team slot ${index + 1}${hero ? `: ${hero.name}` : ""}`);
        const circle = document.createElement("div");
        circle.className = "slot-circle";
        if (hero) circle.append(avatar(hero));
        else circle.textContent = "+";
        const label = document.createElement("span");
        label.className = "slot-name";
        label.textContent = hero ? hero.name : "";
        btn.append(circle, label);
        btn.addEventListener("click", () => openPicker(team, index));
        return btn;
      })
    );
  }
  const filled = [...draft.red, ...draft.blue].filter(Boolean).length;
  analyseBtn.disabled = filled < TEAM_SIZE * 2;
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
      const taken = teamOf(hero.id);
      // A hero can only be picked once across both teams (except re-picking the current slot).
      if (taken && hero.id !== current) {
        btn.disabled = true;
        btn.classList.add(`taken-${taken}`);
        btn.title = `Already picked by ${taken} team`;
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
    `${team === "red" ? "Red" : "Blue"} team — slot ${index + 1}`;
  search.value = "";
  renderGrid();
  picker.showModal();
  search.focus();
}

function selectHero(heroId) {
  draft[activeSlot.team][activeSlot.index] = heroId;
  picker.close();
  result.hidden = true;
  renderSlots();
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
  draft.red.fill(null);
  draft.blue.fill(null);
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
