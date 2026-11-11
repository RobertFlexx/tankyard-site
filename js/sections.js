// Bosses, modes, arenas, practice, servers, mods and controls.
import { $, $$, h } from "./util.js";
import { svgModel } from "./models.js";

export function initBosses(data) {
  const grid = $("#boss-grid");
  grid.innerHTML = "";
  for (const boss of data.bosses) {
    const card = h("article", { class: "panel boss" });
    card.insertAdjacentHTML("beforeend", svgModel(boss, data.colors, { pad: 8, label: boss.name }));
    card.append(
      h("div", {}, h("h3", { text: boss.name }), h("span", { class: "hull", text: `HULL RADIUS ${boss.hull}` }), h("p", { text: boss.weapons + "." })),
    );
    grid.append(card);
  }
}

export function initModes(game, maps) {
  const grid = $("#mode-grid");
  let current = 0;
  const buttons = game.modes.map((mode, i) => {
    const button = h("button", { class: "btn mode", type: "button", "aria-pressed": String(i === 0) }, h("b", { text: mode.name }), h("span", { text: mode.blurb, title: mode.blurb }));
    button.addEventListener("click", () => {
      buttons[current].setAttribute("aria-pressed", "false");
      current = i;
      button.setAttribute("aria-pressed", "true");
    });
    grid.append(button);
    return button;
  });

  const bar = $("#arena-bar");
  const view = $("#arena-view");
  const tabs = maps.maps.map((map, i) => {
    const button = h("button", { class: "btn", type: "button", "aria-pressed": String(i === 0), text: map.name });
    button.addEventListener("click", () => show(i));
    bar.append(button);
    return button;
  });
  function show(i) {
    tabs.forEach((t, j) => t.setAttribute("aria-pressed", String(i === j)));
    const map = maps.maps[i];
    const [fw, fh] = map.frame;
    const shapes = map.prims.map((p) => shape(p, maps.colors)).join("");
    const cover = map.cover.length ? coverSvg(map, maps.colors) : "";
    view.innerHTML = "";
    const drawing = h("div");
    // The world grid, one line every 100 units.
    const cell = (fw / map.width) * 100;
    const grid = `<pattern id="map-grid" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M ${cell} 0 L 0 0 0 ${cell}" fill="none" stroke="var(--grid)" stroke-width="1"/></pattern>`;
    drawing.innerHTML = `<svg viewBox="-2 -2 ${fw + 4} ${fh + 4}" role="img" aria-label="Layout of ${map.name}"><defs>${grid}</defs><rect x="0" y="0" width="${fw}" height="${fh}" fill="var(--field)"/><rect x="0" y="0" width="${fw}" height="${fh}" fill="url(#map-grid)" stroke="#555" stroke-width="2"/>${shapes}</svg>`;
    const info = h(
      "div",
      {},
      h("h3", { text: map.name }),
      h("p", { class: "muted", text: map.description }),
      h(
        "dl",
        {},
        h("dt", { text: "Size" }),
        h("dd", { text: `${map.width.toLocaleString("en-US")} × ${map.height.toLocaleString("en-US")} units` }),
        h("dt", { text: "Players" }),
        h("dd", { text: `Up to ${map.capacity}` }),
        h("dt", { text: "Cover" }),
        h("dd", { text: map.prims.length ? (map.id === "maze" ? "A connected labyrinth" : map.id === "dense" ? "Garden planters" : "Walls and blocks") : "None, wide open" }),
      ),
      cover ? h("div", { class: "cover-swatch", html: cover, title: "How this arena's cover looks in the game" }) : null,
      h("p", { class: "note", style: { marginTop: "16px" }, text: "The arena grows as players join and reaches its full size at sixteen. Cover follows the moving border." }),
    );
    view.append(drawing, info);
  }
  show(0);
}

function shape(prim, colors) {
  const fill = colors[prim[0]];
  if (prim[1] === "c") return `<circle cx="${prim[2]}" cy="${prim[3]}" r="${prim[4]}" fill="${fill}"/>`;
  return `<polygon points="${prim.slice(2).join(" ")}" fill="${fill}"/>`;
}
function coverSvg(map, colors) {
  let maxX = 0;
  let maxY = 0;
  for (const p of map.cover) {
    const values = p[1] === "c" ? [p[2] + p[4], p[3] + p[4]] : p.slice(2);
    for (let i = 0; i < values.length; i += 2) {
      maxX = Math.max(maxX, values[i]);
      maxY = Math.max(maxY, values[i + 1]);
    }
  }
  return `<svg class="cover" viewBox="0 0 ${maxX} ${maxY}" aria-hidden="true">${map.cover.map((p) => shape(p, colors)).join("")}</svg>`;
}

export function initPractice(game, tanks) {
  const grid = $("#practice-grid");
  const byId = Object.fromEntries(tanks.classes.map((c) => [c.id, c]));
  $("#practice-count").textContent = `${game.practice.length} challenges`;
  game.practice.forEach((p, i) => {
    const tank = byId[p.class];
    const card = h("article", { class: "practice" });
    if (tank) card.insertAdjacentHTML("beforeend", svgModel(tank, tanks.colors, { pad: 3, label: tank.name }));
    else card.append(h("span"));
    card.append(
      h("h3", {}, p.title, i < 4 ? h("span", { class: "key hint-key", text: `F6 · ${i + 1}` }) : null),
      h("p", { text: p.description }),
      h("p", { class: "tip", text: p.tip }),
    );
    grid.append(card);
  });
}

// Keys inside the docs' wording: "Enter while alive, or Slash, on community servers".
const KEYS = /\b(?:WASD|Mouse|Right click|left click|Shift\+Tab|Shift|Space|Enter|Slash|Esc|Tab|PgUp|PgDn|Left|Right|F\d{1,2}|(\d) through (\d))\b|\b[A-Z]\b/g;
const keycap = (text) => h("kbd", { class: "keycap", text: text[0].toUpperCase() + text.slice(1) });

export function initControls(game) {
  const list = $("#controls-list");
  for (const [action, binding] of game.controls) {
    const keys = h("span", { class: "keys" });
    let last = 0;
    for (const match of binding.matchAll(KEYS)) {
      keys.append(binding.slice(last, match.index));
      if (match[1]) keys.append(keycap(match[1]), " to ", keycap(match[2]));
      else keys.append(keycap(match[0]));
      last = match.index + match[0].length;
    }
    keys.append(binding.slice(last));
    list.append(h("div", { class: "control" }, h("span", { text: action }), keys));
  }
}

const MODE_FLAGS = [
  ["ffa", "Free For All"],
  ["two-teams", "Two Teams"],
  ["four-teams", "Four Teams"],
  ["maze", "Maze"],
  ["domination", "Domination"],
  ["survival", "Survival"],
  ["tag", "Tag"],
  ["mothership", "Mothership"],
  ["capture-core", "Capture the Core"],
  ["boss-rush", "Boss Rush"],
  ["deathmatch", "Team Deathmatch"],
  ["sandbox", "Sandbox"],
  ["random-events", "Random Events"],
  ["coop-pve", "Co-op PvE"],
  ["infection", "Infection"],
  ["king-of-the-hill", "King of the Hill"],
];

export function initServer() {
  const form = $("#server-form");
  const modes = $("#srv-modes");
  let mode = "ffa";
  for (const [flag, name] of MODE_FLAGS) {
    modes.append(
      h("button", {
        class: "btn small",
        type: "button",
        "aria-pressed": String(flag === mode),
        text: name,
        onclick: (event) => {
          mode = flag;
          $$("button", modes).forEach((b) => b.setAttribute("aria-pressed", String(b === event.currentTarget)));
          update();
        },
      }),
    );
  }
  const quote = (value) => (/^[\w.:/-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`);
  function update() {
    const name = $("#srv-name").value.trim() || "My Tank Yard server";
    const port = Math.min(65535, Math.max(1, parseInt($("#srv-port").value, 10) || 5000));
    const max = +$("#srv-max").value;
    const lobby = +$("#srv-lobby").value;
    const bots = +$("#srv-bots").value;
    const pass = $("#srv-pass").value;
    for (const [id, value] of [
      ["srv-max", max],
      ["srv-lobby", lobby],
      ["srv-bots", bots],
    ]) {
      const input = $("#" + id);
      input.style.setProperty("--fill", `${((value - input.min) / (input.max - input.min)) * 100}%`);
    }
    $("#srv-max-v").textContent = max;
    $("#srv-lobby-v").textContent = lobby ? `${lobby} per lobby` : "One lobby";
    $("#srv-bots-v").textContent = bots;
    const parts = [
      "tankyard-server",
      `--name ${quote(name)}`,
      `--port ${port}`,
      `--mode ${mode}`,
      `--max-players ${max}`,
      `--arena-capacity ${lobby}`,
      `--bots ${bots}`,
    ];
    if (mode === "sandbox") parts.push("--allow-sandbox");
    if (pass) parts.push(`--password ${quote(pass)}`);
    $("#srv-cmd").textContent = parts.join(" ");
  }
  form.addEventListener("input", update);
  form.addEventListener("submit", (event) => event.preventDefault());
  update();
}

const CODE = {
  mod: {
    file: "mods/first-blood/main.luau · from the modding guide",
    source: `--!strict
local claimed = false

tankyard.on("round_start", function()
  claimed = false
end)

tankyard.on("kill", function(event)
  if claimed or event.actor == 0 then
    return
  end
  claimed = true
  local hunter = tankyard.tank(event.actor)
  tankyard.award(event.actor, 2000, 500)
  tankyard.announce(\`First blood: {if hunter then hunter.name else "someone"}!\`)
end)`,
  },
  plugin: {
    file: "An Arena Workshop tool · from the plugin guide",
    source: `editor.tool {
  id = "row",
  name = "Row of blocks",
  description = "Place a row, keeping it inside the arena.",
  params = {
    { id = "count", name = "Blocks", type = "integer", min = 1, max = 20, default = 4 },
    { id = "size", name = "Block size", type = "number", min = 10, max = 160, step = 10, default = 40 },
    { id = "gap", name = "Gap", type = "number", min = 0, max = 160, step = 10, default = 40 },
  },
  run = function(map, params, ctx)
    local span = params.count * params.size + (params.count - 1) * params.gap
    local pointer = ctx.pointer or { x = map.width / 2, y = map.height / 2 }
    local x = math.clamp(pointer.x, 0, map.width - span)
    local y = math.clamp(pointer.y, 0, map.height - params.size)
    for i = 1, params.count do
      table.insert(map.blocks, {
        rect = editor.rect(map, x + (i - 1) * (params.size + params.gap), y, params.size, params.size),
        style = "slate",
        group = 0,
      })
    end
    ctx.say(string.format("Placed %d blocks.", params.count))
  end,
}`,
  },
};

function highlight(source) {
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tokens = /(--[^\n]*)|("(?:[^"\\]|\\.)*"|`[^`]*`)|\b(local|function|end|if|then|else|return|for|in|do|or|and|not|nil|true|false)\b|\b(\d+(?:\.\d+)?)\b|\b(tankyard|editor|ctx|math|string|table)\b/g;
  let out = "";
  let last = 0;
  for (const m of source.matchAll(tokens)) {
    out += escape(source.slice(last, m.index));
    const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : m[4] ? "n" : "f";
    out += `<span class="${cls}">${escape(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escape(source.slice(last));
}

export function initMods() {
  const view = $("#code-view");
  const file = $("#code-file");
  const show = (key) => {
    view.innerHTML = highlight(CODE[key].source);
    file.textContent = CODE[key].file;
    $$("[data-code]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.code === key)));
  };
  $$("[data-code]").forEach((b) => b.addEventListener("click", () => show(b.dataset.code)));
  show("mod");
}
