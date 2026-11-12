// The Arena Workshop section: a working miniature of the game's editor, with
// the real tutorial playing in the inspector and driving the editor's chrome.
import { $, $$, h, clamp, clock, reducedMotion, store, onVisible, css, typing } from "./util.js";
import { drawModel, EXPORT_AIM } from "./models.js";
import { TOURS } from "./workshop-tours.js";
import { LOGIC, GATES, DEMO_GATES, gateOpen, logicState, stepLogic, vaultDemo } from "./workshop-logic.js";

/* ---------- The tour ---------- */

const TABS = ["Map", "Object", "Logic", "Check", "Rules", "Files", "Tools"];

/* ---------- The palette ---------- */

const BLOCKS = [
  { id: "map", name: "Arena default", rim: "#5e696f", body: "#9aa6ab", face: "#aebabf" },
  { id: "slate", name: "Slate", rim: "#5e696f", body: "#9aa6ab", face: "#aebabf" },
  { id: "garden", name: "Hedge", rim: "#586666", body: "#90a09a", face: "#606d51", seeds: "#5a9a62" },
  { id: "circuit", name: "Circuit", rim: "#606870", body: "#9ea4ad", face: "#b3b8c1", link: "#9b87d6" },
  { id: "bastion", name: "Rampart", rim: "#62696b", body: "#a1a6a3", face: "#b6bab5" },
  { id: "relay", name: "Relay", rim: "#5c6a6f", body: "#96a7aa", face: "#aabbbd", link: "#3fa7a0" },
  { id: "orrery", name: "Orrery", rim: "#616770", body: "#9fa2ac", face: "#b4b6c0", link: "#a084d8" },
  { id: "sand", name: "Sandstone", rim: "#66655d", body: "#aaa695", face: "#c0bba8" },
];
const PADS = [
  { id: "speed", name: "Speed pad", size: 160 },
  { id: "mud", name: "Mud", size: 160 },
  { id: "repair", name: "Repair pad", size: 160 },
  { id: "hazard", name: "Hazard", size: 160 },
  { id: "shelter", name: "Shelter", size: 160 },
  { id: "conveyor", name: "Conveyor", size: 160 },
  { id: "portal", name: "Portal", size: 160 },
];
const DECOR = [
  { id: "tile", name: "Tile", w: 160, h: 160 },
  { id: "stripes", name: "Stripes", w: 240, h: 80 },
  { id: "light", name: "Light", w: 160, h: 160 },
  { id: "ring", name: "Ring", w: 120, h: 120 },
  { id: "arrow", name: "Arrow", w: 120, h: 60 },
  { id: "label", name: "Label", w: 280, h: 60 },
  { id: "embers", name: "Embers", w: 80, h: 80 },
  { id: "rain", name: "Rain", w: 80, h: 80 },
  { id: "dust", name: "Dust", w: 80, h: 80 },
  { id: "sparks", name: "Sparks", w: 80, h: 80 },
];
const MARKERS = [
  { id: "spawn", name: "Spawn", w: 120, h: 80, color: "#00b2e1" },
  { id: "team1", name: "Team 1 spawn", w: 120, h: 80, color: "#00b2e1" },
  { id: "team2", name: "Team 2 spawn", w: 120, h: 80, color: "#fc7677" },
  { id: "base1", name: "Base 1", w: 200, h: 200, color: "#00b2e1" },
  { id: "base2", name: "Base 2", w: 200, h: 200, color: "#fc7677" },
  { id: "objective", name: "Objective", w: 40, h: 40, color: "#ffe869" },
];
const ARENA_W = 1200;
const ARENA_H = 800;
const HINTS = {
  build: "Click to build, or drag to draw a wall of any size.",
  edit: "Drag across the floor to select. Drag to move it; Q and E turn it.",
  delete: "Click or drag over objects to delete them.",
  pan: "Drag to move the view. Ctrl/Cmd-scroll zooms around the pointer.",
  play: "WASD to drive · click to fire · Esc returns to the editor",
};

function starter() {
  const b = (x, y, w, h, style = "slate", group = 0) => ({ kind: "block", style, x, y, w, h, group });
  return [
    { kind: "marker", type: "spawn", x: 40, y: 40, w: 120, h: 80 },
    { kind: "marker", type: "spawn", x: 1040, y: 680, w: 120, h: 80 },
    b(280, 160, 40, 240),
    b(320, 160, 160, 40),
    b(760, 400, 40, 240, "circuit"),
    b(600, 600, 160, 40, "circuit"),
    b(560, 320, 40, 40, "garden"),
    b(600, 280, 40, 40, "garden"),
    b(1000, 160, 40, 200, "slate", 1),
    { kind: "pad", type: "conveyor", x: 120, y: 480, w: 320, h: 80, angle: 0 },
    { kind: "pad", type: "portal", x: 520, y: 80, w: 120, h: 120, exit: { x: 1100, y: 260 } },
    { kind: "logic", type: "plate", x: 880, y: 560, w: 120, h: 120, group: 1 },
    { kind: "decor", type: "light", x: 520, y: 360, w: 160, h: 160 },
  ];
}

export function initWorkshop(models) {
  const root = $("#ws");
  const holder = $("#ws-canvas");
  const canvas = $("#ws-gl");
  const ctx = canvas.getContext("2d");
  const video = $("#ws-video");
  const player = $("#ws-player");
  const tank = models.classes.find((c) => c.id === "vector");
  const colors = models.colors;
  let tour = TOURS.workshop;
  let CHAPTERS = tour.chapters;
  let CAPTIONS = tour.captions;

  /* ----- Editor state ----- */
  const draft = store.get("workshop");
  const validDraft = Array.isArray(draft) && draft.every((o) => o && ["block", "pad", "decor", "logic", "marker"].includes(o.kind)
    && [o.x, o.y, o.w, o.h].every(Number.isFinite) && o.w > 0 && o.h > 0
    && (o.type !== "portal" || (o.exit && [o.exit.x, o.exit.y].every(Number.isFinite))));
  let objects = validDraft ? draft : starter();
  let undo = [];
  let redo = [];
  let mode = "build";
  let cat = "Blocks";
  let brush = { kind: "block", style: "slate" };
  let selection = new Set();
  let group = 0;
  let gridSize = 40;
  const opts = { swipe: false, snap: true, hidden: true, groups: true, links: false };
  let saved = validDraft;
  let view = { zoom: 1, ox: 0, oy: 0 };
  let width = 0;
  let height = 0;
  let ratio = 1;
  let pointer = null;
  let drag = null;
  let dragPointer = null;
  let gesture = null;
  let play = null;
  let helpOpen = false;
  let visible = false;
  let dirty = true;
  let frame = 0;
  const keys = new Set();
  let palette = {};
  // The tour only drives the dock while nobody is using the editor.
  let lastUser = -1e9;

  const snap = (v) => (opts.snap ? Math.round(v / gridSize) * gridSize : Math.round(v));
  const floorSnap = (v) => (opts.snap ? Math.floor(v / gridSize) * gridSize : Math.round(v));
  const toWorld = (x, y) => [(x - view.ox) / view.zoom, (y - view.oy) / view.zoom];
  const toScreen = (x, y) => [x * view.zoom + view.ox, y * view.zoom + view.oy];

  function fit() {
    view.zoom = Math.min((width - 60) / ARENA_W, (height - 70) / ARENA_H);
    view.ox = (width - ARENA_W * view.zoom) / 2;
    view.oy = (height - ARENA_H * view.zoom) / 2 + 6;
    dirty = true;
  }
  function zoomBy(factor, sx = width / 2, sy = height / 2) {
    const [wx, wy] = toWorld(sx, sy);
    view.zoom = clamp(view.zoom * factor, 0.15, 3);
    view.ox = sx - wx * view.zoom;
    view.oy = sy - wy * view.zoom;
    dirty = true;
  }
  function resize() {
    const rect = holder.getBoundingClientRect();
    if (!rect.width) return;
    const first = !width;
    width = rect.width;
    height = rect.height;
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    if (first || !drag) fit();
    dirty = true;
  }

  function commit() {
    undo.push(JSON.stringify(objects));
    if (undo.length > 100) undo.shift();
    redo = [];
    saved = false;
    refreshTop();
  }
  function restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(objects));
    objects = JSON.parse(from.pop());
    selection.clear();
    saved = false;
    dirty = true;
    refreshTop();
  }
  function refreshTop() {
    $("#ws-undo").disabled = !undo.length;
    $("#ws-redo").disabled = !redo.length;
    const label = $("#ws-state");
    label.textContent = saved ? "Saved" : "Draft";
    label.classList.toggle("saved", saved);
  }

  /* ----- Hit testing ----- */
  const inside = (o, x, y) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
  const ORDER = { decor: 0, pad: 1, logic: 2, block: 3, marker: 4 };
  function sorted() {
    return objects.map((o, i) => [o, i]).sort((a, b) => ORDER[a[0].kind] - ORDER[b[0].kind] || a[1] - b[1]).map(([o]) => o);
  }
  function hit(x, y) {
    const list = sorted();
    for (let i = list.length - 1; i >= 0; i--) if (inside(list[i], x, y)) return list[i];
    return null;
  }
  function handleAt(sx, sy) {
    if (selection.size !== 1) return null;
    const o = [...selection][0];
    const [x0, y0] = toScreen(o.x, o.y);
    const [x1, y1] = toScreen(o.x + o.w, o.y + o.h);
    const corners = { nw: [x0, y0], ne: [x1, y0], sw: [x0, y1], se: [x1, y1] };
    for (const [name, [cx, cy]] of Object.entries(corners)) if (Math.abs(sx - cx) < 8 && Math.abs(sy - cy) < 8) return name;
    return null;
  }
  function exitAt(sx, sy) {
    for (const o of objects) {
      if (o.kind === "pad" && o.type === "portal") {
        const [ex, ey] = toScreen(o.exit.x, o.exit.y);
        if (Math.hypot(sx - ex, sy - ey) < 12) return o;
      }
    }
    return null;
  }

  /* ----- Brushes ----- */
  function brushName() {
    if (brush.kind === "block") return BLOCKS.find((b) => b.id === brush.style).name;
    if (brush.kind === "pad") return PADS.find((p) => p.id === brush.type).name;
    if (brush.kind === "decor") return DECOR.find((d) => d.id === brush.type).name;
    if (brush.kind === "logic") return brush.type === "plate" ? "Plate" : brush.type === "lever" ? `Lever · counter ${brush.counter || Math.min(group || 1, 8)}` : brush.type.toUpperCase();
    return MARKERS.find((m) => m.id === brush.type).name;
  }
  function brushSize() {
    if (brush.kind === "block") return [gridSize, gridSize];
    if (brush.kind === "pad") return [160, 160];
    if (brush.kind === "logic") return DEMO_GATES.has(brush.type) ? [80, 80] : [120, 120];
    if (brush.kind === "decor") {
      const d = DECOR.find((x) => x.id === brush.type);
      return [d.w, d.h];
    }
    const m = MARKERS.find((x) => x.id === brush.type);
    return [m.w, m.h];
  }
  function make(x, y, w, hgt) {
    const base = { x, y, w, h: hgt };
    if (brush.kind === "block") return { ...base, kind: "block", style: brush.style, group };
    if (brush.kind === "pad") {
      const pad = { ...base, kind: "pad", type: brush.type, group };
      if (brush.type === "conveyor") pad.angle = brush.angle || 0;
      if (brush.type === "portal") pad.exit = { x: clamp(x + w + 160, 40, ARENA_W - 40), y: clamp(y + hgt / 2, 40, ARENA_H - 40) };
      return pad;
    }
    if (brush.kind === "logic") return { ...base, kind: "logic", type: brush.type, group: brush.type === "lever" ? 0 : group || 1, ...(brush.type === "lever" ? { counter: brush.counter || Math.min(group || 1, 8) } : {}) };
    if (brush.kind === "decor") return { ...base, kind: "decor", type: brush.type, group };
    return { ...base, kind: "marker", type: brush.type };
  }
  function brushFrom(o) {
    if (o.kind === "block") return { kind: "block", style: o.style };
    if (o.kind === "pad") return { kind: "pad", type: o.type, angle: o.angle };
    if (o.kind === "logic") return { kind: "logic", type: o.type, counter: o.counter };
    return { kind: o.kind, type: o.type };
  }

  /* ----- Drawing ----- */
  function chamfer(g, x, y, w, hgt, c) {
    g.beginPath();
    g.moveTo(x + c, y);
    g.lineTo(x + w - c, y);
    g.lineTo(x + w, y + c);
    g.lineTo(x + w, y + hgt - c);
    g.lineTo(x + w - c, y + hgt);
    g.lineTo(x + c, y + hgt);
    g.lineTo(x, y + hgt - c);
    g.lineTo(x, y + c);
    g.closePath();
  }
  function drawBlock(g, style, x, y, w, hgt, cell) {
    const s = BLOCKS.find((b) => b.id === style) || BLOCKS[1];
    const m = Math.min(w, hgt);
    const c = Math.min(m * 0.2, 9);
    const rim = Math.max(1.5, Math.min(4, m * 0.08));
    g.save();
    chamfer(g, x, y, w, hgt, c);
    g.fillStyle = s.rim;
    g.fill();
    chamfer(g, x + rim, y + rim, w - rim * 2, hgt - rim * 2, Math.max(1, c - rim * 0.6));
    g.fillStyle = s.body;
    g.fill();
    const pad = rim + Math.max(2, m * 0.08);
    if (s.seeds) {
      g.fillStyle = s.face;
      g.fillRect(x + pad, y + pad, w - pad * 2, hgt - pad * 2);
      g.fillStyle = s.seeds;
      const r = Math.max(1.5, m * 0.13);
      const along = w >= hgt;
      const len = along ? w : hgt;
      const count = Math.max(2, Math.round(len / (m * 0.5)));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        g.beginPath();
        g.arc(along ? x + w * t : x + w / 2, along ? y + hgt / 2 : y + hgt * t, r, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.strokeStyle = s.face;
      g.lineWidth = Math.max(1, m * 0.05);
      g.beginPath();
      g.moveTo(x + pad, y + hgt - pad);
      g.lineTo(x + pad, y + pad);
      g.lineTo(x + w - pad, y + pad);
      g.stroke();
      if (s.link) {
        const along = w >= hgt;
        g.strokeStyle = "#7f8790";
        g.lineWidth = Math.max(1, m * 0.09);
        g.beginPath();
        if (along) {
          g.moveTo(x + pad * 1.6, y + hgt / 2);
          g.lineTo(x + w - pad * 1.6, y + hgt / 2);
        } else {
          g.moveTo(x + w / 2, y + pad * 1.6);
          g.lineTo(x + w / 2, y + hgt - pad * 1.6);
        }
        g.stroke();
        g.fillStyle = s.link;
        const k = Math.max(2, m * 0.16);
        if (along) {
          g.fillRect(x + pad * 1.3, y + hgt / 2 - k / 2, k, k);
          g.fillRect(x + w - pad * 1.3 - k, y + hgt / 2 - k / 2, k, k);
        } else {
          g.fillRect(x + w / 2 - k / 2, y + pad * 1.3, k, k);
          g.fillRect(x + w / 2 - k / 2, y + hgt - pad * 1.3 - k, k, k);
        }
      }
      g.fillStyle = "#6e7a85";
      const dot = Math.max(0.8, m * 0.035);
      g.beginPath();
      g.arc(x + pad * 1.4, y + pad * 1.4, dot, 0, Math.PI * 2);
      g.arc(x + w - pad * 1.4, y + hgt - pad * 1.4, dot, 0, Math.PI * 2);
      g.fill();
    }
    if (cell && cell > 6) {
      g.strokeStyle = s.rim;
      g.globalAlpha = 0.45;
      g.lineWidth = 1;
      g.beginPath();
      if (w > hgt * 1.5) for (let sx = x + cell; sx < x + w - 2; sx += cell) {
        g.moveTo(Math.round(sx) + 0.5, y + rim);
        g.lineTo(Math.round(sx) + 0.5, y + hgt - rim);
      }
      if (hgt > w * 1.5) for (let sy = y + cell; sy < y + hgt - 2; sy += cell) {
        g.moveTo(x + rim, Math.round(sy) + 0.5);
        g.lineTo(x + w - rim, Math.round(sy) + 0.5);
      }
      g.stroke();
    }
    g.restore();
  }

  function arrows(g, x, y, w, hgt, angle, time, color, speed = 1) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, hgt);
    g.clip();
    g.translate(x + w / 2, y + hgt / 2);
    g.rotate(angle);
    const span = Math.max(w, hgt) * 1.5;
    const step = Math.max(14, Math.min(w, hgt) * 0.45);
    const offset = ((time * 40 * speed) % step + step) % step;
    g.strokeStyle = color;
    g.lineWidth = Math.max(2, step * 0.14);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (let ax = -span + offset; ax < span; ax += step) {
      for (let ay = -span; ay < span; ay += step) {
        g.beginPath();
        g.moveTo(ax - step * 0.18, ay - step * 0.22);
        g.lineTo(ax + step * 0.12, ay);
        g.lineTo(ax - step * 0.18, ay + step * 0.22);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawPad(g, o, x, y, w, hgt, time) {
    g.save();
    const fill = {
      speed: "rgba(0,178,225,.28)",
      mud: "rgba(122,94,62,.42)",
      repair: "rgba(84,199,115,.3)",
      hazard: "rgba(252,118,119,.3)",
      shelter: "rgba(110,122,133,.32)",
      conveyor: "rgba(77,87,97,.55)",
      portal: "rgba(191,127,245,.22)",
    }[o.type];
    g.fillStyle = fill;
    g.fillRect(x, y, w, hgt);
    if (o.type === "speed") arrows(g, x, y, w, hgt, o.angle || 0, time, "rgba(0,178,225,.8)", 2);
    if (o.type === "conveyor") arrows(g, x, y, w, hgt, o.angle || 0, time, "rgba(242,245,247,.75)", 1);
    if (o.type === "hazard") {
      g.beginPath();
      g.rect(x, y, w, hgt);
      g.clip();
      g.strokeStyle = "rgba(252,118,119,.55)";
      g.lineWidth = Math.max(3, w * 0.06);
      for (let k = -hgt; k < w; k += Math.max(10, w * 0.2)) {
        g.beginPath();
        g.moveTo(x + k, y + hgt);
        g.lineTo(x + k + hgt, y);
        g.stroke();
      }
    }
    if (o.type === "repair") {
      const s = Math.min(w, hgt) * 0.35;
      g.fillStyle = "rgba(84,199,115,.85)";
      g.fillRect(x + w / 2 - s / 2, y + hgt / 2 - s / 7, s, (s * 2) / 7);
      g.fillRect(x + w / 2 - s / 7, y + hgt / 2 - s / 2, (s * 2) / 7, s);
    }
    if (o.type === "mud") {
      g.fillStyle = "rgba(92,70,46,.5)";
      for (const [a, b, r] of [[0.3, 0.35, 0.12], [0.65, 0.6, 0.16], [0.4, 0.72, 0.09]]) {
        g.beginPath();
        g.arc(x + w * a, y + hgt * b, Math.min(w, hgt) * r, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (o.type === "shelter") {
      g.setLineDash([6, 5]);
      g.strokeStyle = "rgba(110,122,133,.9)";
      g.lineWidth = 2;
      g.strokeRect(x + 3, y + 3, w - 6, hgt - 6);
    }
    if (o.type === "portal") {
      const r = Math.min(w, hgt) * 0.36;
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = `rgba(191,127,245,${0.9 - i * 0.25})`;
        g.lineWidth = Math.max(2, r * 0.12);
        g.beginPath();
        g.arc(x + w / 2, y + hgt / 2, r * (1 - i * 0.28) * (1 + Math.sin(time * 3 + i) * 0.04), 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawDecor(g, o, x, y, w, hgt, time) {
    g.save();
    if (o.type === "tile") {
      g.fillStyle = "rgba(113,158,181,.35)";
      g.fillRect(x, y, w, hgt);
    } else if (o.type === "stripes") {
      g.beginPath();
      g.rect(x, y, w, hgt);
      g.clip();
      g.fillStyle = "rgba(113,158,181,.5)";
      for (let k = 0; k < w + hgt; k += 24 * view.zoom) {
        g.beginPath();
        g.moveTo(x + k, y);
        g.lineTo(x + k + 10 * view.zoom, y);
        g.lineTo(x + k + 10 * view.zoom - hgt, y + hgt);
        g.lineTo(x + k - hgt, y + hgt);
        g.fill();
      }
    } else if (o.type === "light") {
      const r = Math.max(w, hgt) / 2;
      const glow = g.createRadialGradient(x + w / 2, y + hgt / 2, 0, x + w / 2, y + hgt / 2, r);
      glow.addColorStop(0, "rgba(236,196,112,.55)");
      glow.addColorStop(1, "rgba(236,196,112,0)");
      g.fillStyle = glow;
      g.fillRect(x, y, w, hgt);
    } else if (o.type === "ring") {
      g.strokeStyle = "rgba(113,158,181,.8)";
      g.lineWidth = Math.max(2, w * 0.06);
      g.beginPath();
      g.arc(x + w / 2, y + hgt / 2, Math.min(w, hgt) * 0.42, 0, Math.PI * 2);
      g.stroke();
    } else if (o.type === "arrow") {
      g.fillStyle = "rgba(232,196,92,.85)";
      g.beginPath();
      g.moveTo(x, y + hgt * 0.3);
      g.lineTo(x + w * 0.62, y + hgt * 0.3);
      g.lineTo(x + w * 0.62, y);
      g.lineTo(x + w, y + hgt / 2);
      g.lineTo(x + w * 0.62, y + hgt);
      g.lineTo(x + w * 0.62, y + hgt * 0.7);
      g.lineTo(x, y + hgt * 0.7);
      g.closePath();
      g.fill();
    } else if (o.type === "label") {
      g.fillStyle = "rgba(222,228,232,.92)";
      g.font = `700 ${Math.max(8, hgt * 0.55)}px "Yard Sans", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(o.text || "Arena", x + w / 2, y + hgt / 2);
    } else {
      const color = { embers: "#ec9c48", rain: "#7eaed3", dust: "#b8ab92", sparks: "#ffe869" }[o.type];
      g.fillStyle = color;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t = ((time * (o.type === "rain" ? 1.6 : 0.6) + i / n) % 1 + 1) % 1;
        const px = x + w * ((i * 0.37 + 0.15) % 1);
        const dir = o.type === "rain" ? 1 : -1;
        const py = y + hgt / 2 + dir * (t - 0.5) * hgt;
        g.globalAlpha = Math.sin(t * Math.PI);
        if (o.type === "rain") g.fillRect(px, py, 1.5, 6);
        else g.fillRect(px, py, 3, 3);
      }
      g.globalAlpha = 1;
      g.strokeStyle = color;
      g.setLineDash([3, 3]);
      g.strokeRect(x + 0.5, y + 0.5, w - 1, hgt - 1);
    }
    g.restore();
  }

  function drawPlate(g, o, x, y, w, hgt, pressed) {
    g.save();
    if (o.type === "lever" || DEMO_GATES.has(o.type)) {
      const on = play && (o.type === "lever" ? play.counters[(o.counter || 1) - 1] > 0 : gateOpen(o.type, play.counters));
      g.fillStyle = on ? "rgba(0,178,225,.35)" : "rgba(224,122,176,.20)";
      g.strokeStyle = on ? "#00b2e1" : "#c56898";
      g.lineWidth = 2;
      g.fillRect(x, y, w, hgt);
      g.strokeRect(x + 1, y + 1, w - 2, hgt - 2);
      g.fillStyle = css("--text") || "#2e3640";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `bold ${Math.max(9, Math.min(16, w * 0.28))}px Ubuntu, sans-serif`;
      g.fillText(o.type === "lever" ? `C${o.counter || 1} ${on ? "ON" : "OFF"}` : o.type.toUpperCase(), x + w / 2, y + hgt / 2);
      g.restore();
      return;
    }
    g.fillStyle = pressed ? "rgba(224,122,176,.5)" : "rgba(224,122,176,.28)";
    g.fillRect(x, y, w, hgt);
    g.strokeStyle = "rgba(224,122,176,.95)";
    g.lineWidth = 2;
    const r = Math.min(w, hgt) * 0.3;
    g.beginPath();
    g.arc(x + w / 2, y + hgt / 2, r, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x + w / 2, y + hgt / 2, r * 0.35, 0, Math.PI * 2);
    g.fillStyle = "rgba(224,122,176,.95)";
    g.fill();
    g.restore();
  }

  function drawMarker(g, o, x, y, w, hgt) {
    const m = MARKERS.find((k) => k.id === o.type);
    g.save();
    if (o.type === "objective") {
      g.fillStyle = m.color;
      g.strokeStyle = "#555";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + w / 2, y);
      g.lineTo(x + w, y + hgt / 2);
      g.lineTo(x + w / 2, y + hgt);
      g.lineTo(x, y + hgt / 2);
      g.closePath();
      g.fill();
      g.stroke();
    } else {
      g.globalAlpha = 0.16;
      g.fillStyle = m.color;
      g.fillRect(x, y, w, hgt);
      g.globalAlpha = 0.85;
      g.strokeStyle = m.color;
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, hgt - 1);
      g.globalAlpha = 1;
      g.fillStyle = m.color;
      g.font = `700 ${clamp(12 * view.zoom * 1.4, 8, 14)}px "Yard Sans", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(m.name.replace(" spawn", ""), x + w / 2, y + hgt / 2);
    }
    g.restore();
  }

  function groupBadge(x, y, n) {
    ctx.fillStyle = "#a084d8";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = '700 10px "Yard Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), x, y + 0.5);
  }

  function isHidden(o, now) {
    return play && o.group && (play.hidden[o.group] > now || play.gateHidden.has(o.group));
  }

  function draw(time) {
    const theme = document.documentElement.dataset.theme;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = theme === "dark" ? "#1a2027" : "#bcbcbc";
    ctx.fillRect(0, 0, width, height);
    const [ax, ay] = toScreen(0, 0);
    const aw = ARENA_W * view.zoom;
    const ah = ARENA_H * view.zoom;
    ctx.fillStyle = theme === "dark" ? "#2b343d" : "#c6c9c9";
    ctx.fillRect(ax, ay, aw, ah);
    // Fine grid.
    const step = gridSize * view.zoom;
    if (step >= 5) {
      ctx.strokeStyle = theme === "dark" ? "#323c46" : "#bfc3c4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx <= ARENA_W; gx += gridSize) {
        const sx = Math.round(ax + gx * view.zoom) + 0.5;
        ctx.moveTo(sx, ay);
        ctx.lineTo(sx, ay + ah);
      }
      for (let gy = 0; gy <= ARENA_H; gy += gridSize) {
        const sy = Math.round(ay + gy * view.zoom) + 0.5;
        ctx.moveTo(ax, sy);
        ctx.lineTo(ax + aw, sy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "#6d7a84";
    ctx.strokeRect(Math.round(ax) + 0.5, Math.round(ay) + 0.5, Math.round(aw), Math.round(ah));

    const now = performance.now() / 1000;
    for (const o of sorted()) {
      const [x, y] = toScreen(o.x, o.y);
      const w = o.w * view.zoom;
      const hgt = o.h * view.zoom;
      if (o.kind === "block") {
        if (isHidden(o, now)) {
          if (!opts.hidden) continue;
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = "#6e7a85";
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hgt - 1);
          ctx.restore();
          continue;
        }
        drawBlock(ctx, o.style, x, y, w, hgt, gridSize * view.zoom);
      } else if (o.kind === "pad") drawPad(ctx, o, x, y, w, hgt, time);
      else if (o.kind === "decor") drawDecor(ctx, o, x, y, w, hgt, time);
      else if (o.kind === "logic") drawPlate(ctx, o, x, y, w, hgt, play && play.onPlate === o);
      else drawMarker(ctx, o, x, y, w, hgt);
      if (opts.groups && o.group && o.kind !== "marker") groupBadge(x + w - 2, y + 2, o.group);
    }
    // Portal exits and plate links.
    for (const o of objects) {
      if (o.kind === "pad" && o.type === "portal") {
        const [ex, ey] = toScreen(o.exit.x, o.exit.y);
        const [px, py] = toScreen(o.x + o.w / 2, o.y + o.h / 2);
        ctx.save();
        if (opts.links || selection.has(o) || mode === "edit") {
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = "rgba(191,127,245,.9)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = "#bf7ff5";
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ex, ey - 8);
        ctx.lineTo(ex + 8, ey);
        ctx.lineTo(ex, ey + 8);
        ctx.lineTo(ex - 8, ey);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (opts.links && o.kind === "logic") {
        const [px, py] = toScreen(o.x + o.w / 2, o.y + o.h / 2);
        for (const b of objects) {
          const toGate = o.type === "lever" && b.kind === "logic" && DEMO_GATES.has(b.type);
          const toBlock = o.type !== "lever" && b.kind === "block" && b.group === o.group;
          if (!toGate && !toBlock) continue;
          const [bx, by] = toScreen(b.x + b.w / 2, b.y + b.h / 2);
          ctx.save();
          ctx.strokeStyle = "rgba(0,178,225,.85)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    // Selection.
    if (!play) {
      for (const o of selection) {
        const [x, y] = toScreen(o.x, o.y);
        ctx.strokeStyle = "#00b2e1";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, o.w * view.zoom + 2, o.h * view.zoom + 2);
        if (selection.size === 1) {
          const w = o.w * view.zoom;
          const hgt = o.h * view.zoom;
          for (const [cx, cy] of [[x, y], [x + w, y], [x, y + hgt], [x + w, y + hgt]]) {
            ctx.fillStyle = "#fbfcfc";
            ctx.fillRect(cx - 4, cy - 4, 8, 8);
            ctx.strokeStyle = "#00b2e1";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(cx - 4, cy - 4, 8, 8);
          }
        }
      }
      if (drag?.type === "marquee" || drag?.type === "build") {
        const r = drag.rect;
        if (r) {
          const [x, y] = toScreen(r.x, r.y);
          ctx.save();
          if (drag.type === "build") {
            ctx.globalAlpha = 0.6;
            if (brush.kind === "block") drawBlock(ctx, brush.style, x, y, r.w * view.zoom, r.h * view.zoom, gridSize * view.zoom);
            else {
              ctx.fillStyle = "rgba(0,178,225,.25)";
              ctx.fillRect(x, y, r.w * view.zoom, r.h * view.zoom);
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#333b45";
            ctx.font = '700 11px "Yard Sans", sans-serif';
            ctx.textAlign = "left";
            ctx.fillText(`${r.w} × ${r.h}`, x + r.w * view.zoom + 6, y + r.h * view.zoom + 12);
          } else {
            ctx.fillStyle = "rgba(0,178,225,.12)";
            ctx.strokeStyle = "#00b2e1";
            ctx.setLineDash([4, 3]);
            ctx.fillRect(x, y, r.w * view.zoom, r.h * view.zoom);
            ctx.strokeRect(x + 0.5, y + 0.5, r.w * view.zoom, r.h * view.zoom);
          }
          ctx.restore();
        }
      }
      // Ghost of the brush under the pointer.
      if (mode === "build" && pointer && !drag && !helpOpen) {
        const [wx, wy] = toWorld(pointer[0], pointer[1]);
        if (wx >= 0 && wy >= 0 && wx <= ARENA_W && wy <= ARENA_H && brush.kind === "block") {
          const [gx, gy] = toScreen(floorSnap(wx), floorSnap(wy));
          ctx.globalAlpha = 0.45;
          drawBlock(ctx, brush.style, gx, gy, gridSize * view.zoom, gridSize * view.zoom);
          ctx.globalAlpha = 1;
        }
      }
    }
    // Playtest tank and bullets.
    if (play) {
      for (const b of play.bullets) {
        const [x, y] = toScreen(b.x, b.y);
        ctx.globalAlpha = 1 - b.fade;
        ctx.fillStyle = "#555";
        ctx.beginPath();
        ctx.arc(x, y, (b.r + 2) * view.zoom * (1 + b.fade * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#00b2e1";
        ctx.beginPath();
        ctx.arc(x, y, b.r * view.zoom * (1 + b.fade * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (const ring of play.rings) {
        const [x, y] = toScreen(ring.x, ring.y);
        ctx.strokeStyle = `rgba(191,127,245,${1 - ring.t})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, (20 + ring.t * 40) * view.zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
      const [tx, ty] = toScreen(play.x, play.y);
      const tint = play.zone === "hazard" ? { "#00b2e1": "#fc7677" } : play.zone === "repair" ? { "#00b2e1": "#54c773" } : null;
      drawModel(ctx, tank, colors, tx, ty, view.zoom, play.aim - EXPORT_AIM, tint);
    }
    if (helpOpen) drawHelp();
    $("#ws-coords").textContent = pointer
      ? `${Math.round(toWorld(...pointer)[0])}, ${Math.round(toWorld(...pointer)[1])}  ·  ${Math.round(view.zoom * 100)}%`
      : `${Math.round(view.zoom * 100)}%`;
  }

  function drawHelp() {
    const lines = [
      ["1 · 2 · 3", "Build, Edit, Delete"],
      ["Click / drag", "Place one cell / draw a wall"],
      ["Right-click", "Build more like that object"],
      ["Q · E", "Turn the selection"],
      ["Alt-drag", "Leave a copy behind"],
      ["Delete", "Remove the selection"],
      ["Ctrl+Z · Ctrl+Y", "Undo, redo"],
      ["F", "Fit the arena in view"],
      ["L", "Show links"],
      ["F5 · Shift+F5", "Playtest, from the pointer"],
      ["Esc", "Back to the editor"],
    ];
    const w = Math.min(380, width - 40);
    const hgt = 46 + lines.length * 22;
    const x = (width - w) / 2;
    const y = Math.max(16, (height - hgt) / 2);
    ctx.fillStyle = "rgba(251,252,252,.97)";
    ctx.fillRect(x, y, w, hgt);
    ctx.strokeStyle = "#b0b8bf";
    ctx.strokeRect(x + 0.5, y + 0.5, w, hgt);
    ctx.fillStyle = "#00b2e1";
    ctx.font = '700 12px "Yard Sans", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SHORTCUTS IN THIS COPY", x + 16, y + 26);
    lines.forEach(([k, v], i) => {
      ctx.fillStyle = "#333b45";
      ctx.font = '700 13px "Yard Sans", sans-serif';
      ctx.fillText(k, x + 16, y + 52 + i * 22);
      ctx.fillStyle = "#6e7a85";
      ctx.fillText(v, x + 150, y + 52 + i * 22);
    });
  }

  /* ----- Playtest ----- */
  function startPlay(at) {
    if (play) return;
    const spawn = objects.find((o) => o.kind === "marker" && (o.type === "spawn" || o.type === "team1"));
    let x = spawn ? spawn.x + spawn.w / 2 : ARENA_W / 2;
    let y = spawn ? spawn.y + spawn.h / 2 : ARENA_H / 2;
    if (at) [x, y] = [clamp(at[0], 30, ARENA_W - 30), clamp(at[1], 30, ARENA_H - 30)];
    play = { x, y, vx: 0, vy: 0, aim: 0, bullets: [], rings: [], cooldown: 0, firing: false, hidden: {}, onPlate: null, portalLock: 0, zone: null, ...logicState() };
    selection.clear();
    holder.focus({ preventScroll: true });
    $("#ws-banner").hidden = false;
    $("#ws-tag").textContent = "Playtest";
    hint(HINTS.play, 0);
    $("#ws-play").classList.add("on");
  }
  function stopPlay() {
    if (!play) return;
    play = null;
    keys.clear();
    $("#ws-banner").hidden = true;
    $("#ws-play").classList.remove("on");
    setMode(mode);
  }
  function solid(now) {
    return objects.filter((o) => o.kind === "block" && !isHidden(o, now));
  }
  function stepPlay(dt) {
    const now = performance.now() / 1000;
    const p = play;
    let ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let iy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const len = Math.hypot(ix, iy) || 1;
    ix /= len;
    iy /= len;
    const zones = objects.filter((o) => (o.kind === "pad" || o.kind === "logic") && inside(o, p.x, p.y));
    const kind = (t) => zones.find((z) => z.type === t);
    p.zone = kind("hazard") ? "hazard" : kind("repair") ? "repair" : null;
    const top = 230 * (kind("speed") ? 1.6 : 1) * (kind("mud") ? 0.45 : 1);
    p.vx += ix * 1100 * dt;
    p.vy += iy * 1100 * dt;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > top) {
      p.vx *= top / speed;
      p.vy *= top / speed;
    }
    const friction = Math.pow(ix || iy ? 0.2 : 0.02, dt);
    p.vx *= friction;
    p.vy *= friction;
    let dx = p.vx * dt;
    let dy = p.vy * dt;
    for (const c of zones.filter((z) => z.type === "conveyor")) {
      dx += Math.cos(c.angle || 0) * 150 * dt;
      dy += Math.sin(c.angle || 0) * 150 * dt;
    }
    p.x = clamp(p.x + dx, 22, ARENA_W - 22);
    p.y = clamp(p.y + dy, 22, ARENA_H - 22);
    for (const b of solid(now)) {
      const cx = clamp(p.x, b.x, b.x + b.w);
      const cy = clamp(p.y, b.y, b.y + b.h);
      const ox = p.x - cx;
      const oy = p.y - cy;
      const d = Math.hypot(ox, oy);
      if (d < 22) {
        if (d > 0.001) {
          p.x = cx + (ox / d) * 22;
          p.y = cy + (oy / d) * 22;
        } else {
          p.y = b.y - 22;
        }
      }
    }
    // Portals and plates.
    p.portalLock = Math.max(0, p.portalLock - dt);
    const portal = kind("portal");
    if (portal && !p.portalLock) {
      p.rings.push({ x: p.x, y: p.y, t: 0 });
      p.x = portal.exit.x;
      p.y = portal.exit.y;
      p.rings.push({ x: p.x, y: p.y, t: 0 });
      p.portalLock = 0.9;
    }
    const plate = zones.find((z) => z.kind === "logic");
    if (stepLogic(objects, p, now)) {
      hint(`Counter 1: ${p.counters[0]} · Counter 2: ${p.counters[1]}. AND needs both, OR either, XOR just one.`, 0);
    }
    p.onPlate = plate || null;
    for (const ring of p.rings) ring.t += dt * 2;
    p.rings = p.rings.filter((r) => r.t < 1);
    // Aim and fire.
    if (pointer) {
      const [wx, wy] = toWorld(pointer[0], pointer[1]);
      p.aim = Math.atan2(wy - p.y, wx - p.x);
    }
    p.cooldown -= dt;
    if (p.firing && p.cooldown <= 0) {
      p.bullets.push({ x: p.x + Math.cos(p.aim) * 38, y: p.y + Math.sin(p.aim) * 38, vx: Math.cos(p.aim) * 520, vy: Math.sin(p.aim) * 520, r: 5.5, life: 1.6, fade: 0 });
      p.cooldown = 0.42;
    }
    const walls = solid(now);
    for (const b of p.bullets) {
      if (b.fade) {
        b.fade += dt * 6;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > ARENA_W || b.y > ARENA_H || walls.some((w) => inside(w, b.x, b.y))) b.fade = 0.01;
    }
    p.bullets = p.bullets.filter((b) => b.fade < 1);
  }

  /* ----- Pointer input ----- */
  function setPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = [event.clientX - rect.left, event.clientY - rect.top];
  }
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (dragPointer !== null || event.button > 2 || !event.isPrimary) return;
    dragPointer = event.pointerId;
    holder.focus({ preventScroll: true });
    setPointer(event);
    canvas.setPointerCapture(event.pointerId);
    hideHint();
    if (helpOpen) {
      helpOpen = false;
      dirty = true;
      return;
    }
    const [wx, wy] = toWorld(...pointer);
    if (play) {
      if (event.button === 0) play.firing = true;
      return;
    }
    if (event.button === 1 || (event.button === 0 && (keys.has(" ") || mode === "pan"))) {
      drag = { type: "pan", from: pointer, ox: view.ox, oy: view.oy };
      return;
    }
    if (event.button === 2) {
      if (mode === "pan") return;
      const o = hit(wx, wy);
      if (o) {
        brush = brushFrom(o);
        setCat(o.kind === "logic" && o.type !== "plate" ? "Gates" : { block: "Blocks", pad: "Pads", decor: "Decor", logic: "Logic", marker: "Markers" }[o.kind], false);
        setMode("build");
      } else drag = { type: "pan", from: pointer, ox: view.ox, oy: view.oy };
      return;
    }
    gesture = { objects: JSON.stringify(objects), undo: [...undo], redo: [...redo], saved };
    if (mode === "build") {
      if (wx < 0 || wy < 0 || wx > ARENA_W || wy > ARENA_H) return;
      commit();
      if (opts.swipe && brush.kind === "block") {
        drag = { type: "swipe" };
        paint(wx, wy);
      } else {
        drag = { type: "build", start: [wx, wy], rect: null };
        updateBuild(wx, wy);
      }
    } else if (mode === "edit") {
      const exit = exitAt(...pointer);
      const handle = handleAt(...pointer);
      if (exit) {
        commit();
        drag = { type: "exit", portal: exit };
      } else if (handle) {
        commit();
        const o = [...selection][0];
        drag = { type: "resize", handle, o, base: { ...o } };
      } else {
        const o = hit(wx, wy);
        if (o) {
          if (event.shiftKey) {
            selection.has(o) ? selection.delete(o) : selection.add(o);
          } else if (!selection.has(o)) {
            selection = new Set([o]);
          }
          commit();
          if (event.altKey) {
            for (const s of selection) objects.push(JSON.parse(JSON.stringify(s)));
          }
          drag = { type: "move", start: [wx, wy], base: [...selection].map((s) => [s, s.x, s.y, s.exit ? { ...s.exit } : null]) };
        } else {
          if (!event.shiftKey) selection.clear();
          drag = { type: "marquee", start: [wx, wy], rect: null };
        }
      }
    } else if (mode === "delete") {
      commit();
      drag = { type: "delete" };
      erase(wx, wy);
    }
    dirty = true;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragPointer !== null && event.pointerId !== dragPointer) return;
    setPointer(event);
    dirty = true;
    if (!drag) {
      if (mode === "edit" && !play) canvas.style.cursor = exitAt(...pointer) || handleAt(...pointer) ? "move" : hit(...toWorld(...pointer)) ? "grab" : "default";
      else canvas.style.cursor = play ? "crosshair" : mode === "pan" ? "grab" : "default";
      return;
    }
    const [wx, wy] = toWorld(...pointer);
    if (drag.type === "pan") {
      view.ox = drag.ox + pointer[0] - drag.from[0];
      view.oy = drag.oy + pointer[1] - drag.from[1];
    } else if (drag.type === "build") updateBuild(wx, wy);
    else if (drag.type === "swipe") paint(wx, wy);
    else if (drag.type === "delete") erase(wx, wy);
    else if (drag.type === "exit") {
      drag.portal.exit = { x: clamp(snap(wx), 20, ARENA_W - 20), y: clamp(snap(wy), 20, ARENA_H - 20) };
    } else if (drag.type === "move") {
      const ddx = snap(wx - drag.start[0]);
      const ddy = snap(wy - drag.start[1]);
      for (const [o, x, y, exit] of drag.base) {
        o.x = clamp(x + ddx, 0, ARENA_W - o.w);
        o.y = clamp(y + ddy, 0, ARENA_H - o.h);
        if (exit) o.exit = { x: exit.x + (o.x - x), y: exit.y + (o.y - y) };
      }
    } else if (drag.type === "resize") {
      const { o, base, handle } = drag;
      const min = opts.snap ? gridSize : 10;
      let x0 = base.x;
      let y0 = base.y;
      let x1 = base.x + base.w;
      let y1 = base.y + base.h;
      if (handle.includes("w")) x0 = Math.min(snap(wx), x1 - min);
      if (handle.includes("e")) x1 = Math.max(snap(wx), x0 + min);
      if (handle.includes("n")) y0 = Math.min(snap(wy), y1 - min);
      if (handle.includes("s")) y1 = Math.max(snap(wy), y0 + min);
      Object.assign(o, { x: clamp(x0, 0, ARENA_W), y: clamp(y0, 0, ARENA_H), w: Math.min(x1, ARENA_W) - clamp(x0, 0, ARENA_W), h: Math.min(y1, ARENA_H) - clamp(y0, 0, ARENA_H) });
    } else if (drag.type === "marquee") {
      const [sx, sy] = drag.start;
      drag.rect = { x: Math.min(sx, wx), y: Math.min(sy, wy), w: Math.abs(wx - sx), h: Math.abs(wy - sy) };
      selection = new Set(objects.filter((o) => o.x < drag.rect.x + drag.rect.w && o.x + o.w > drag.rect.x && o.y < drag.rect.y + drag.rect.h && o.y + o.h > drag.rect.y));
    }
  });
  const endDrag = (event) => {
    if (event.pointerId !== dragPointer) return;
    dragPointer = null;
    const cancelled = event.type !== "pointerup";
    if (play) play.firing = false;
    if (!drag) {
      gesture = null;
      return;
    }
    if (!cancelled && drag.type === "build" && drag.rect) {
      const r = drag.rect;
      if (r.w > 0 && r.h > 0) objects.push(make(r.x, r.y, r.w, r.h));
    }
    if (gesture && (cancelled || JSON.stringify(objects) === gesture.objects)) {
      if (cancelled) {
        objects = JSON.parse(gesture.objects);
        selection.clear();
      }
      undo = gesture.undo;
      redo = gesture.redo;
      saved = gesture.saved;
    }
    gesture = null;
    drag = null;
    dirty = true;
    refreshTop();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("dblclick", () => {
    if (mode !== "edit" || play || !pointer) return;
    const o = hit(...toWorld(...pointer));
    if (o?.group) {
      selection = new Set(objects.filter((x) => x.group === o.group));
      dirty = true;
    }
  });
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);
  canvas.addEventListener("pointerleave", () => {
    if (!drag) pointer = null;
    dirty = true;
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (document.activeElement !== holder) return;
      event.preventDefault();
      setPointer(event);
      zoomBy(Math.exp(-event.deltaY * 0.0015), ...pointer);
    },
    { passive: false },
  );

  function updateBuild(wx, wy) {
    const [sx, sy] = drag.start;
    const moved = Math.hypot((wx - sx) * view.zoom, (wy - sy) * view.zoom) > 6;
    if (!moved) {
      const [bw, bh] = brushSize();
      const x = brush.kind === "block" ? floorSnap(sx) : snap(sx - bw / 2);
      const y = brush.kind === "block" ? floorSnap(sy) : snap(sy - bh / 2);
      drag.rect = { x: clamp(x, 0, ARENA_W - bw), y: clamp(y, 0, ARENA_H - bh), w: bw, h: bh };
      return;
    }
    const x0 = clamp(floorSnap(Math.min(sx, wx)), 0, ARENA_W);
    const y0 = clamp(floorSnap(Math.min(sy, wy)), 0, ARENA_H);
    const x1 = clamp(floorSnap(Math.max(sx, wx)) + (opts.snap ? gridSize : 0), 0, ARENA_W);
    const y1 = clamp(floorSnap(Math.max(sy, wy)) + (opts.snap ? gridSize : 0), 0, ARENA_H);
    drag.rect = { x: x0, y: y0, w: Math.max(x1 - x0, 10), h: Math.max(y1 - y0, 10) };
  }
  function paint(wx, wy) {
    if (wx < 0 || wy < 0 || wx >= ARENA_W || wy >= ARENA_H) return;
    const x = Math.floor(wx / gridSize) * gridSize;
    const y = Math.floor(wy / gridSize) * gridSize;
    if (objects.some((o) => o.kind === "block" && o.x === x && o.y === y && o.w === gridSize && o.h === gridSize)) return;
    objects.push(make(x, y, gridSize, gridSize));
  }
  function erase(wx, wy) {
    const o = hit(wx, wy);
    if (o) {
      objects = objects.filter((x) => x !== o);
      selection.delete(o);
    }
  }

  /* ----- Keyboard ----- */
  holder.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (play) {
      if (key === "escape") {
        event.preventDefault();
        stopPlay();
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
        keys.add(key);
        if (key === " ") play.firing = true;
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? restore(redo, undo) : restore(undo, redo);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      restore(redo, undo);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      save();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === "f5") {
      event.preventDefault();
      play ? stopPlay() : startPlay(event.shiftKey && pointer ? toWorld(...pointer) : null);
      return;
    }
    if (key === "f1") {
      event.preventDefault();
      helpOpen = !helpOpen;
      dirty = true;
      return;
    }
    if (key === "escape") {
      if (helpOpen) helpOpen = false;
      else selection.clear();
      dirty = true;
      return;
    }
    if (play) return;
    if (key === "1") setMode("build");
    else if (key === "2") setMode("edit");
    else if (key === "3") setMode("delete");
    else if (key === "4") setMode("pan");
    else if (key === "f") fit();
    else if (key === "l") setOpt("links", !opts.links);
    else if (key === " ") {
      event.preventDefault();
      keys.add(" ");
    } else if ((key === "delete" || key === "backspace") && selection.size) {
      event.preventDefault();
      commit();
      objects = objects.filter((o) => !selection.has(o));
      selection.clear();
    } else if ((key === "q" || key === "e") && selection.size) {
      commit();
      for (const o of selection) {
        if (o.kind === "pad" && (o.type === "conveyor" || o.type === "speed")) o.angle = ((o.angle || 0) + (key === "e" ? 1 : -1) * (Math.PI / 4)) % (Math.PI * 2);
        else {
          const cx = o.x + o.w / 2;
          const cy = o.y + o.h / 2;
          [o.w, o.h] = [o.h, o.w];
          o.x = clamp(snap(cx - o.w / 2), 0, ARENA_W - o.w);
          o.y = clamp(snap(cy - o.h / 2), 0, ARENA_H - o.h);
        }
      }
    } else if ((key === "q" || key === "e") && mode === "build" && brush.kind === "pad") {
      brush.angle = ((brush.angle || 0) + (key === "e" ? 1 : -1) * (Math.PI / 4)) % (Math.PI * 2);
    } else return;
    dirty = true;
  });
  holder.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if (play && key === " ") play.firing = false;
  });
  holder.addEventListener("blur", () => {
    keys.clear();
    if (play) play.firing = false;
  });
  addEventListener("blur", () => {
    keys.clear();
    if (play) play.firing = false;
    if (dragPointer !== null) endDrag({ pointerId: dragPointer, type: "pointercancel" });
  });

  for (const part of [holder, $(".ws-dock", root), $(".ws-top", root)]) {
    part.addEventListener("pointerdown", () => (lastUser = performance.now()), true);
    part.addEventListener("keydown", () => (lastUser = performance.now()), true);
  }

  /* ----- Dock and top bar ----- */
  let hintTimer = 0;
  function hint(text, ms = 4000) {
    const el = $("#ws-hint");
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(hideHint, ms);
  }
  function hideHint() {
    if (play) return;
    $("#ws-hint").style.opacity = "0";
  }
  function setMode(next) {
    mode = next;
    $$(".ws-modes .btn").forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    $("#ws-tag").textContent = mode === "build" ? `Build · ${brushName()}` : mode === "edit" ? "Edit" : mode === "pan" ? "Pan" : "Delete";
    if (mode !== "edit" && mode !== "pan") selection.clear();
    hint(HINTS[mode]);
    dirty = true;
  }
  function setOpt(name, value) {
    opts[name] = value;
    const toggle = $(`[data-opt="${name}"]`);
    toggle?.setAttribute("aria-checked", String(value));
    dirty = true;
  }
  function setCat(next, pick = true) {
    cat = next;
    $$("#ws-cats [data-cat]").forEach((b) => b.classList.toggle("on", b.dataset.cat === cat));
    if (pick) {
      const first = palette[cat].find((item) => item.brush);
      if (first) brush = { ...first.brush };
    }
    renderTiles();
    if (mode === "build") $("#ws-tag").textContent = `Build · ${brushName()}`;
  }

  function tileCanvas(drawFn) {
    const c = h("canvas", { width: 116, height: 104, "aria-hidden": "true" });
    const g = c.getContext("2d");
    g.scale(2, 2);
    drawFn(g);
    return c;
  }
  palette = {
    Blocks: BLOCKS.map((b) => ({ name: b.name, brush: { kind: "block", style: b.id }, draw: (g) => drawBlock(g, b.id, 9, 4, 40, 40) })),
    Pads: PADS.map((p) => ({ name: p.name, brush: { kind: "pad", type: p.id, angle: 0 }, draw: (g) => drawPad(g, { type: p.id, angle: 0 }, 6, 2, 46, 46, 0.4) })),
    Decor: DECOR.map((d) => ({ name: d.name, brush: { kind: "decor", type: d.id }, draw: (g) => drawDecor(g, { type: d.id }, 6, 6, 46, d.h > d.w * 0.6 ? 40 : 22, 0.3) })),
    Logic: LOGIC.map((name, i) => ({ name, brush: i === 0 ? { kind: "logic", type: "plate" } : null, draw: (g) => (i === 0 ? drawPlate(g, {}, 6, 2, 46, 46) : logicIcon(g, i)) })),
    Gates: GATES.map((name, i) => {
      const type = name.toLowerCase();
      const working = type === "lever" || DEMO_GATES.has(type);
      return { name, brush: working ? { kind: "logic", type } : null,
        draw: (g) => working ? drawPlate(g, { type, counter: 1 }, 6, 2, 46, 46, false) : logicIcon(g, i) };
    }),
    Markers: MARKERS.map((m) => ({ name: m.name, brush: { kind: "marker", type: m.id }, draw: (g) => drawMarker(g, { type: m.id }, 4, 8, 50, m.id === "objective" ? 30 : 34) })),
  };
  function logicIcon(g, i) {
    g.fillStyle = "#2e3640";
    g.fillRect(14, 6, 30, 30);
    g.strokeStyle = "#ffe869";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(21, 15 + (i % 3) * 2);
    g.lineTo(37, 15 + (i % 3) * 2);
    g.moveTo(21, 21);
    g.lineTo(37 - (i % 4) * 3, 21);
    g.moveTo(21, 27);
    g.lineTo(31, 27);
    g.stroke();
  }
  function same(a, b) {
    return a && b && a.kind === b.kind && (a.style ?? a.type) === (b.style ?? b.type);
  }
  function renderTiles() {
    const box = $("#ws-tiles");
    box.innerHTML = "";
    for (const item of palette[cat]) {
      const button = h("button", { class: "ws-tile", type: "button", "aria-pressed": String(same(item.brush, brush)), title: item.name }, tileCanvas(item.draw), h("span", { text: item.name }));
      button.addEventListener("click", () => {
        if (!item.brush) {
          setTour("logic");
          seekChapter(1);
          hint(`${item.name} is available in the game. This preview supports Plates, Levers and AND/OR/XOR gates. See the logic tutorial for full wiring.`, 6000);
          return;
        }
        brush = { ...item.brush };
        setMode("build");
        renderTiles();
      });
      box.append(button);
    }
  }

  $$(".ws-modes .btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $("#ws-cats").addEventListener("click", (event) => {
    const button = event.target.closest("[data-cat]");
    if (button) setCat(button.dataset.cat);
  });
  $$("[data-opt]").forEach((t) => t.addEventListener("click", () => setOpt(t.dataset.opt, !opts[t.dataset.opt])));
  $$("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => {
      const z = Number(b.dataset.zoom);
      z === 0 ? fit() : zoomBy(z > 0 ? 1.25 : 0.8);
    }),
  );
  $("#ws-grid").addEventListener("click", () => {
    gridSize = gridSize === 40 ? 80 : gridSize === 80 ? 20 : 40;
    $("#ws-grid").textContent = `Grid ${gridSize}`;
    dirty = true;
  });
  const showGroup = () => ($("#ws-gval").textContent = group ? String(group) : "none");
  $("#ws-gminus").addEventListener("click", () => {
    group = Math.max(0, group - 1);
    showGroup();
  });
  $("#ws-gplus").addEventListener("click", () => {
    group = Math.min(64, group + 1);
    showGroup();
  });
  $("#ws-gfree").addEventListener("click", () => {
    const used = new Set(objects.map((o) => o.group).filter(Boolean));
    const free = Array.from({ length: 32 }, (_, i) => i + 1).find((n) => !used.has(n));
    if (!free) {
      hint("All 32 groups are in use. Remove a group before choosing another.", 5000);
      return;
    }
    group = free;
    showGroup();
    hint(`Group ${group} is free. New objects join it.`);
  });
  $("#ws-undo").addEventListener("click", () => restore(undo, redo));
  $("#ws-redo").addEventListener("click", () => restore(redo, undo));
  $("#ws-new").addEventListener("click", () => {
    commit();
    objects = objects.filter((o) => o.kind === "marker");
    selection.clear();
    dirty = true;
  });
  function save() {
    saved = store.set("workshop", objects);
    refreshTop();
    hint(saved ? "Saved in this browser. In the game, Ctrl+S saves an editable project." : "Browser storage is unavailable. Keep this page open to keep working.");
  }
  $("#ws-save").addEventListener("click", save);
  $("#ws-demo").addEventListener("click", () => {
    stopPlay();
    commit();
    objects = vaultDemo();
    selection.clear();
    setOpt("links", true);
    fit();
    dirty = true;
    hint("Try both levers in Playtest. The AND opens the vault while both are on. Undo restores your previous map.", 8000);
  });
  $("#ws-export").addEventListener("click", () => {
    setTour("workshop");
    seek(145.58);
    hint("Export makes a pack for the Mods page or a server. The tour shows it now.", 5000);
  });
  $("#ws-help").addEventListener("click", () => {
    helpOpen = !helpOpen;
    dirty = true;
  });
  $("#ws-play").addEventListener("click", () => (play ? stopPlay() : startPlay(null)));
  $("#ws-here").addEventListener("click", () => startPlay(pointer ? toWorld(...pointer) : [ARENA_W / 2, ARENA_H / 2]));

  /* ----- Loop ----- */
  let last = 0;
  function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const animated = play || objects.some((o) => o.type === "conveyor" || o.type === "speed" || o.type === "portal" || o.kind === "decor");
    if (play) stepPlay(dt);
    if (dirty || play || (animated && !reducedMotion.matches)) {
      draw(reducedMotion.matches ? 0 : now / 1000);
      dirty = false;
    }
  }
  function run(on) {
    cancelAnimationFrame(frame);
    if (on && holder.clientWidth && !document.hidden) {
      last = 0;
      frame = requestAnimationFrame(loop);
    }
  }

  /* ----- Video tours ----- */
  const tabs = $("#ws-tabs");
  const list = $("#ws-chapters");
  const ticks = $("#ws-ticks");
  const duration = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : tour.duration);
  function renderTour() {
    tabs.replaceChildren();
    list.replaceChildren();
    ticks.replaceChildren();
    for (const name of TABS) {
      const index = CHAPTERS.findIndex((c) => c.tab === name);
      tabs.append(h("button", { class: "btn small", type: "button", text: name,
        disabled: index < 0, title: index < 0 ? `${name} isn't covered in this tour` : `Jump to ${CHAPTERS[index].title}`,
        dataset: { tab: name }, onclick: () => seekChapter(index) }));
    }
    CHAPTERS.forEach((c, i) => list.append(h("li", {}, h("button", {
      type: "button", dataset: { chapter: i }, onclick: () => seekChapter(i),
    }, h("span", { class: "n", text: String(i) }), h("span", { text: c.title }),
    h("span", { class: "t", text: clock(c.t) }), h("span", { class: "p" })))));
    CHAPTERS.slice(1).forEach((c) => ticks.append(h("i", { style: { left: `${(c.t / tour.duration) * 100}%` } })));
  }
  function setTour(id) {
    const next = TOURS[id];
    if (!next || next === tour) return;
    video.pause();
    tour = next;
    CHAPTERS = tour.chapters;
    CAPTIONS = tour.captions;
    pendingSeek = null;
    chapterShown = captionShown = -1;
    userPaused = true;
    video.poster = tour.poster;
    video.setAttribute("aria-label", tour.label);
    video.replaceChildren(
      h("source", { src: `media/${tour.file}.webm`, type: 'video/webm; codecs="vp9"' }),
      h("source", { src: `media/${tour.file}.mp4`, type: "video/mp4" }),
      ...(id === "logic" ? [h("track", { kind: "captions", src: "media/logic-gates-tutorial.vtt", srclang: "en", label: "English" })] : []),
    );
    $("#ws-written").href = `https://github.com/RobertFlexx/tankyard/blob/main/docs/${id === "logic" ? "logic-gates-tutorial" : "map-editor"}.md`;
    video.preload = "metadata";
    video.load();
    renderTour();
    $$("[data-tour]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.tour === id)));
    $("#ws-tour-note").textContent = id === "logic" ? "Preview of the next release. In the demo, levers connect directly to gates. The game supports full signal wiring." : "The original workshop tour. Choose Logic gates for the new vault circuit.";
    syncVideo();
    syncButtons();
  }
  $$("[data-tour]").forEach((button) => button.addEventListener("click", () => setTour(button.dataset.tour)));
  renderTour();

  let userPaused = false;
  let chapterShown = -1;
  let captionShown = -1;
  let pendingSeek = null;
  function applySeek() {
    if (!pendingSeek || video.readyState < 1) return;
    const { time, resume } = pendingSeek;
    pendingSeek = null;
    video.currentTime = clamp(time, 0, duration());
    if (resume && visible && !document.hidden && video.paused) video.play().catch(() => {});
  }
  video.addEventListener("loadedmetadata", applySeek);
  function seek(t, resume = true) {
    if (video.preload === "none") video.preload = "auto";
    pendingSeek = { time: t, resume };
    if (video.readyState >= 1) applySeek();
    else if (video.networkState === 0) video.load();
    userPaused = !resume;
  }
  function seekChapter(i) {
    if (i < 0 || i >= CHAPTERS.length) return;
    seek(CHAPTERS[i].t + 0.05);
  }
  function syncVideo() {
    const t = video.currentTime || 0;
    const d = duration();
    $("#ws-progress").style.width = `${(t / d) * 100}%`;
    $("#ws-time").textContent = `${clock(t)} / ${clock(d)}`;
    $("#ws-seek").setAttribute("aria-valuenow", String(Math.round(t)));
    $("#ws-seek").setAttribute("aria-valuemax", String(Math.round(d)));
    $("#ws-seek").setAttribute("aria-valuetext", `${clock(t)} of ${clock(d)}`);
    let chapter = 0;
    CHAPTERS.forEach((c, i) => {
      if (t >= c.t - 0.01) chapter = i;
    });
    let caption = 0;
    CAPTIONS.forEach(([start], i) => {
      if (t >= start - 0.01) caption = i;
    });
    const end = CHAPTERS[chapter + 1]?.t ?? d;
    const share = clamp((t - CHAPTERS[chapter].t) / (end - CHAPTERS[chapter].t), 0, 1);
    $$("#ws-chapters button").forEach((b, i) => {
      b.classList.toggle("now", i === chapter);
      b.querySelector(".p").style.width = i === chapter ? `${share * 100}%` : i < chapter ? "100%" : "0";
    });
    if (chapter !== chapterShown) {
      chapterShown = chapter;
      const c = CHAPTERS[chapter];
      $$("#ws-tabs .btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === c.tab)));
      if (!video.paused && !play && performance.now() - lastUser > 20000) {
        if (c.mode && c.mode !== mode && visible) setMode(c.mode);
        if (c.cat && c.cat !== cat && visible) setCat(c.cat, c.cat !== "Logic");
      }
      const row = list.children[chapter];
      if (row && list.scrollHeight > list.clientHeight) list.scrollTo({ top: row.offsetTop - list.offsetTop - 30, behavior: reducedMotion.matches ? "instant" : "smooth" });
    }
    if (caption !== captionShown) {
      captionShown = caption;
      $("#ws-caption").innerHTML = "";
      $("#ws-caption").append(h("small", { text: chapter ? `${chapter} · ${CHAPTERS[chapter].title}` : tour.label }), h("span", { text: CAPTIONS[caption][1] }));
    }
  }
  function syncButtons() {
    const playing = !video.paused && !video.ended;
    $("#ws-vplay").textContent = playing ? "Pause" : "Play";
    $("#ws-vplay").setAttribute("aria-label", playing ? "Pause the tour" : "Play the tour");
    $("#ws-bigplay").hidden = playing || video.currentTime > 0.2;
  }
  video.addEventListener("timeupdate", syncVideo);
  video.addEventListener("seeked", syncVideo);
  video.addEventListener("loadedmetadata", syncVideo);
  video.addEventListener("play", syncButtons);
  video.addEventListener("pause", syncButtons);
  video.addEventListener("ended", syncButtons);
  video.addEventListener("error", () => {
    pendingSeek = null;
    $("#ws-caption").textContent = "The tour could not load. Press Play to try again.";
    syncButtons();
  });
  const toggleVideo = () => {
    if (video.paused) {
      userPaused = false;
      if (video.preload === "none") video.preload = "auto";
      if (video.error) video.load();
      video.play().catch(() => {});
    } else {
      userPaused = true;
      video.pause();
    }
  };
  $("#ws-vplay").addEventListener("click", toggleVideo);
  $("#ws-bigplay").addEventListener("click", toggleVideo);
  video.addEventListener("click", toggleVideo);
  const seekBar = $("#ws-seek");
  let seeking = null;
  let seekResume = false;
  const seekTo = (event) => {
    const rect = seekBar.getBoundingClientRect();
    if (rect.width) seek(clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration(), seekResume);
  };
  seekBar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || seeking !== null) return;
    event.preventDefault();
    seekBar.focus({ preventScroll: true });
    seeking = event.pointerId;
    seekResume = !video.paused;
    seekBar.setPointerCapture(event.pointerId);
    seekTo(event);
  });
  seekBar.addEventListener("pointermove", (event) => {
    if (event.pointerId === seeking) seekTo(event);
  });
  const endSeek = (event) => {
    if (event.pointerId === seeking) seeking = null;
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) seekBar.addEventListener(type, endSeek);
  seekBar.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const t = event.key === "Home" ? 0 : event.key === "End" ? duration() : (video.currentTime || 0) + (event.key === "ArrowRight" ? 5 : -5);
    seek(clamp(t, 0, duration()), !video.paused);
  });
  $("#ws-full").addEventListener("click", () => {
    if (video.preload === "none") video.preload = "auto";
    try {
      const fullscreen = (video.requestFullscreen || video.webkitEnterFullscreen)?.call(video);
      fullscreen?.catch(() => {});
    } catch { /* The browser may refuse fullscreen; inline playback still works. */ }
    if (video.paused) video.play().catch(() => {});
  });
  // Wide: the tour takes over the canvas so the captions are readable.
  let wide = false;
  function placeWide() {
    if (!wide) return;
    const box = root.getBoundingClientRect();
    const area = holder.getBoundingClientRect();
    if (!area.width || !area.height) {
      setWide(false);
      return;
    }
    const w = Math.min(area.width - 24, (area.height - 24) * (16 / 9));
    player.style.width = `${w}px`;
    player.style.left = `${area.left - box.left + (area.width - w) / 2}px`;
    player.style.top = `${area.top - box.top + (area.height - (w * 9) / 16) / 2}px`;
  }
  function setWide(on) {
    on = on && holder.clientWidth > 0;
    wide = on;
    root.classList.toggle("theater", on);
    $("#ws-big").setAttribute("aria-pressed", String(on));
    $("#ws-big").textContent = on ? "Side" : "Wide";
    if (on) placeWide();
    else player.removeAttribute("style");
  }
  $("#ws-big").addEventListener("click", () => setWide(!wide));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || holder.contains(event.target)) return;
    // Escape always ends a playtest, even after a click moved focus elsewhere.
    if (play) stopPlay();
    else if (wide && !typing(event)) setWide(false);
  });

  /* ----- Visibility and setup ----- */
  const autoplay = () => !reducedMotion.matches && innerWidth > 860 && !matchMedia("(any-pointer: coarse)").matches && !navigator.connection?.saveData;
  onVisible(
    root,
    (isVisible) => {
      visible = isVisible;
      run(isVisible);
      if (isVisible && autoplay() && !userPaused && video.paused) {
        video.preload = "auto";
        video.play().catch(() => {});
      }
      if (!isVisible && !video.paused && (document.hidden || !(document.fullscreenElement === video || video.webkitDisplayingFullscreen))) video.pause();
      if (!isVisible) {
        if (dragPointer !== null) endDrag({ pointerId: dragPointer, type: "pointercancel" });
        stopPlay();
      }
    },
    0.35,
  );
  new ResizeObserver(() => {
    resize();
    placeWide();
    run(visible);
  }).observe(holder);
  document.addEventListener("tankyard:theme", () => {
    dirty = true;
  });
  resize();
  setCat("Blocks");
  brush = { kind: "block", style: "slate" };
  renderTiles();
  setMode("build");
  refreshTop();
  syncVideo();
  syncButtons();
}
