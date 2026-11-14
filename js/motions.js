// The Workshop's "New in 1.0" guide: an easing explorer, the Motion palette's
// pieces at work, a chain of motions, and lights and particles. Curves, glow
// and particles use the game's own math from motion-math.js; the scenes here
// only stage them, drawn the way the workshop draws them.
import { $, $$, h, clamp, reducedMotion, onVisible, store } from "./util.js";
import { drawModel, EXPORT_AIM } from "./models.js";
import { CURVES, MODES, EFFECTS, ease, trip, flicker, lightFalloff, particles } from "./motion-math.js";

const TAU = Math.PI * 2;
// brushes::LOGIC, the color of logic on the workshop's canvas.
const LOGIC = [237, 179, 69];
const SIGNAL = [191, 127, 245];
const ACCENT = [0, 178, 225];
const WHITE = [255, 255, 255];
const STYLES = {
  slate: { rim: "#5e696f", body: "#9aa6ab", face: "#aebabf" },
  rampart: { rim: "#62696b", body: "#a1a6a3", face: "#b6bab5" },
};
// The palette's lamps (brushes::lamp) and decor colors.
const TORCH = [255, 158, 72];
const NEON = [96, 224, 255];
const LANTERN = [255, 214, 150];
const LAMP_ALPHA = 220 / 255;
const ARROW = [232, 196, 92];
const PANEL = [113, 158, 181];
const FLOORS = {
  dark: { floor: "#232a32", grid: "#2b333b" },
  light: { floor: "#c6c9c9", grid: "#bfc3c4" },
};

const rgba = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp(a, 0, 1).toFixed(3)})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

let palette = themeColors();
function themeColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  return dark
    ? { dark, floor: "#2b343d", grid: "#323c46", ink: "#f2f5f7", muted: "#b3bdc7", line: "#4d5761", plot: "#262e37", veil: "rgba(23,28,34,0.82)" }
    : { dark, floor: "#c6c9c9", grid: "#bfc3c4", ink: "#333b45", muted: "#6e7a85", line: "#b0b8bf", plot: "#f1f3f4", veil: "rgba(251,252,252,0.9)" };
}

/* ---------- One animation loop for every canvas; each draws only while on screen ---------- */

const scenes = [];
let frame = 0;

function scene(canvas, paint) {
  const s = { canvas, ctx: canvas.getContext("2d"), paint, w: 0, h: 0, ratio: 1, visible: false, dirty: true, paused: false, clock: 0, last: 0 };
  const fit = () => {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    s.ratio = Math.min(2, window.devicePixelRatio || 1);
    s.w = box.width;
    s.h = box.height;
    canvas.width = Math.round(box.width * s.ratio);
    canvas.height = Math.round(box.height * s.ratio);
    s.dirty = true;
    wake();
  };
  new ResizeObserver(fit).observe(canvas);
  onVisible(canvas, (visible) => {
    s.visible = visible;
    s.last = 0;
    if (visible) {
      s.dirty = true;
      wake();
    }
  });
  fit();
  scenes.push(s);
  return s;
}

function wake() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function refresh() {
  for (const s of scenes) s.dirty = true;
  wake();
}

// With reduced motion each scene draws one still frame instead of playing.
function tick(now) {
  frame = 0;
  const moving = !reducedMotion.matches;
  let again = false;
  for (const s of scenes) {
    if (!s.visible || !s.w) continue;
    if (moving && !s.paused) {
      s.clock += s.last ? Math.min(0.1, (now - s.last) / 1000) : 0;
      s.last = now;
      again = true;
    } else if (!s.dirty) {
      continue;
    }
    s.dirty = false;
    const { ctx } = s;
    ctx.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, s.w, s.h);
    try {
      s.paint(ctx, s, moving);
    } catch (error) {
      // One broken scene stops; the rest of the guide plays on.
      console.error("Tank Yard site: a motions scene failed", error);
      s.visible = false;
      s.w = 0;
    }
  }
  if (again) frame = requestAnimationFrame(tick);
}

// Fits a stage `vw` by `vh` units into the canvas, centered, and returns the
// visible part of the stage so floors can reach the canvas edges.
function stage(ctx, s, vw, vh) {
  const k = Math.min(s.w / vw, s.h / vh);
  const ox = (s.w - vw * k) / 2;
  const oy = (s.h - vh * k) / 2;
  ctx.setTransform(s.ratio * k, 0, 0, s.ratio * k, s.ratio * ox, s.ratio * oy);
  return { k, x0: -ox / k, y0: -oy / k, x1: (s.w - ox) / k, y1: (s.h - oy) / k };
}

/* ---------- Drawing, after the workshop's canvas ---------- */

function floor(ctx, view, cell, colors = palette) {
  const { x0, y0, x1, y1 } = view;
  ctx.fillStyle = colors.floor;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1 / view.k;
  ctx.beginPath();
  for (let x = Math.ceil(x0 / cell) * cell; x < x1; x += cell) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = Math.ceil(y0 / cell) * cell; y < y1; y += cell) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
}

function chamfer(ctx, x, y, w, hgt, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + hgt - c);
  ctx.lineTo(x + w - c, y + hgt);
  ctx.lineTo(x + c, y + hgt);
  ctx.lineTo(x, y + hgt - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

// A block as the site's workshop draws one: rim, body, the face's light edge and two rivets.
function block(ctx, x, y, w, hgt, style = STYLES.slate) {
  const m = Math.min(w, hgt);
  const c = Math.min(m * 0.2, 9);
  const rim = Math.max(1.5, Math.min(4, m * 0.08));
  chamfer(ctx, x, y, w, hgt, c);
  ctx.fillStyle = style.rim;
  ctx.fill();
  chamfer(ctx, x + rim, y + rim, w - rim * 2, hgt - rim * 2, Math.max(1, c - rim * 0.6));
  ctx.fillStyle = style.body;
  ctx.fill();
  const pad = rim + Math.max(2, m * 0.08);
  ctx.strokeStyle = style.face;
  ctx.lineWidth = Math.max(1, m * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + pad, y + hgt - pad);
  ctx.lineTo(x + pad, y + pad);
  ctx.lineTo(x + w - pad, y + pad);
  ctx.stroke();
  const dot = Math.max(0.8, m * 0.035);
  ctx.fillStyle = "#6e7a85";
  ctx.beginPath();
  ctx.arc(x + pad * 1.4, y + pad * 1.4, dot, 0, TAU);
  ctx.moveTo(x + w - pad * 1.4 + dot, y + hgt - pad * 1.4);
  ctx.arc(x + w - pad * 1.4, y + hgt - pad * 1.4, dot, 0, TAU);
  ctx.fill();
}

function text(ctx, value, x, y, size, color, align = "center") {
  ctx.font = `700 ${size}px "Yard Sans", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

// The group number the canvas shows on each member with G.
function badge(ctx, x, y, group) {
  ctx.fillStyle = rgba(LOGIC, 0.95);
  ctx.fillRect(x, y, 11, 11);
  text(ctx, String(group), x + 5.5, y + 6, 8.5, "#1f262e");
}

function dashed(ctx, x, y, w, hgt, width, dash, color) {
  ctx.save();
  ctx.setLineDash([dash, dash]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.strokeRect(x, y, w, hgt);
  ctx.restore();
}

function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

// canvas::arrow: a line with a head, as wide as `thickness`.
function arrow(ctx, [ax, ay], [bx, by], thickness, color) {
  const length = Math.hypot(bx - ax, by - ay);
  if (length < 2) return;
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  const head = Math.min(thickness * 4.5, length * 0.5);
  const baseX = bx - ux * head;
  const baseY = by - uy * head;
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(baseX, baseY);
  ctx.stroke();
  const sx = -uy * head * 0.55;
  const sy = ux * head * 0.55;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(baseX + sx, baseY + sy);
  ctx.lineTo(baseX - sx, baseY - sy);
  ctx.closePath();
  ctx.fill();
}

function diamond(ctx, x, y, r = 9) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x, y - r);
  ctx.closePath();
  ctx.fillStyle = rgba(LOGIC);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

// canvas::draw_travel, for a selected Move trigger: a ghost of the group
// where the motion takes it, joined by an arrow to the diamond.
function travel(ctx, rect, dx, dy) {
  const [x, y, w, hgt] = rect;
  ctx.fillStyle = rgba(LOGIC, 0.1);
  ctx.fillRect(x + dx, y + dy, w, hgt);
  dashed(ctx, x + dx, y + dy, w, hgt, 1.5, 5, rgba(LOGIC, 0.75));
  const from = [x + w / 2, y + hgt / 2];
  const to = [from[0] + dx, from[1] + dy];
  arrow(ctx, from, to, 2, rgba(LOGIC, 0.85));
  diamond(ctx, to[0], to[1]);
}

// While the logic preview runs, objects away from home show where the map puts them.
function home(ctx, rect, away) {
  if (away < 0.5) return;
  const [x, y, w, hgt] = rect;
  dashed(ctx, x, y, w, hgt, 1.5, 4, palette.dark ? "rgba(242,245,247,0.55)" : "rgba(51,59,69,0.5)");
}

// A trigger's area on the canvas, brighter for a moment when a tank sets it off.
function area(ctx, x, y, w, hgt, lit) {
  ctx.fillStyle = rgba(LOGIC, 0.07 + 0.2 * lit);
  ctx.fillRect(x, y, w, hgt);
  dashed(ctx, x, y, w, hgt, 1.5, 4, rgba(LOGIC, 0.6 + 0.4 * lit));
}

// An Every trigger's clock, filling until it fires again.
function timer(ctx, x, y, r, fraction) {
  circle(ctx, x, y, r, palette.veil);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * fraction);
  ctx.closePath();
  ctx.fillStyle = rgba(LOGIC, 0.8);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(LOGIC);
  ctx.stroke();
}

// A trigger that sends a signal, with its link to what hears it; both light up as it sends.
function signal(ctx, [x, y], to, number, lit) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5 + lit;
  ctx.strokeStyle = rgba(SIGNAL, 0.45 + 0.55 * lit);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  ctx.restore();
  if (lit > 0) circle(ctx, x, y, 11 + 10 * (1 - lit), rgba(SIGNAL, 0.35 * lit));
  ctx.fillStyle = rgba(SIGNAL, 0.2 + 0.8 * lit);
  ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(SIGNAL);
  ctx.strokeRect(x - 9, y - 9, 18, 18);
  text(ctx, String(number), x, y + 0.5, 10, lit > 0.5 ? "#1f262e" : rgba(SIGNAL));
}

let tankModel = null;
let tankColors = null;
function tank(ctx, x, y, radius, aim, alpha = 1) {
  if (tankModel) {
    drawModel(ctx, tankModel, tankColors, x, y, radius / tankModel.r0, aim - EXPORT_AIM, null, alpha);
    return;
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(aim);
  ctx.fillStyle = "#999999";
  ctx.fillRect(0, -radius * 0.42, radius * 1.9, radius * 0.84);
  circle(ctx, 0, 0, radius, "#00b2e1");
  ctx.restore();
}

// scenery::DecorKind::Arrow
function arrowDecor(ctx, x, y, w, hgt, degrees, rgb, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.strokeStyle = rgba(rgb, alpha);
  ctx.lineWidth = Math.max(1, hgt * 0.22);
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, 0);
  ctx.lineTo(w * 0.1, 0);
  ctx.stroke();
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(0, -hgt * 0.5);
  ctx.lineTo(0, hgt * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ---------- Light and particles, as scenery.rs and glow.rs draw them ---------- */

// The glow shader's falloff sampled for a radial gradient, closer together
// near the middle where it changes fastest.
const FALLOFF = [0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.33, 0.42, 0.52, 0.63, 0.75, 0.87, 1].map((s) => [s, lightFalloff(s * s)]);

function spot(ctx, x, y, radius, rgb, alpha) {
  if (radius <= 0.3 || alpha <= 0.002) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const [r, g, b] = rgb.map(Math.round);
  for (const [s, f] of FALLOFF) gradient.addColorStop(s, `rgba(${r},${g},${b},${(alpha * f).toFixed(4)})`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

// scenery::light: a wash of color over the floor, light added on top that
// brightens toward the middle, a hot core and the bulb itself.
function light(ctx, x, y, radius, rgb, strength) {
  if (strength <= 0.004 || radius < 0.5) return;
  const hot = mix(rgb, WHITE, 0.55);
  spot(ctx, x, y, radius, rgb, strength * 0.42);
  ctx.globalCompositeOperation = "lighter";
  spot(ctx, x, y, radius * 0.9, rgb, strength * 0.8);
  spot(ctx, x, y, radius * 0.3, hot, strength);
  ctx.globalCompositeOperation = "source-over";
  circle(ctx, x, y, Math.max(radius * 0.05, 1.2), rgba(mix(rgb, WHITE, 0.8), strength));
}

function polygon(ctx, x, y, sides, radius, degrees) {
  const turn = (degrees * Math.PI) / 180;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU + turn;
    ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
  }
  ctx.closePath();
}

function star(ctx, x, y, radius, degrees) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = ((degrees - 90 + i * 36) * Math.PI) / 180;
    const r = i % 2 ? radius * 0.42 : radius;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// scenery::particles: glowing effects add their light, soft ones fade at the edge.
function emit(ctx, effect, rect, zoom, time, seed, opacity = 1) {
  ctx.globalCompositeOperation = effect.glow ? "lighter" : "source-over";
  for (const p of particles(effect, rect, zoom, time, seed)) {
    const a = p.alpha * opacity;
    if (a <= 0.003) continue;
    const rgb = mix(effect.color, effect.endColor, p.fraction);
    const color = rgba(rgb, a);
    switch (effect.shape) {
      case "Soft":
        spot(ctx, p.x, p.y, p.radius * 2, rgb, a);
        break;
      case "Square":
        polygon(ctx, p.x, p.y, 4, p.radius, p.rotation + 45);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case "Triangle":
        polygon(ctx, p.x, p.y, 3, p.radius, p.rotation);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case "Star":
        star(ctx, p.x, p.y, p.radius * 1.3, p.rotation);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      case "Ring":
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, TAU);
        ctx.lineWidth = Math.max(zoom * 2, 1);
        ctx.strokeStyle = color;
        ctx.stroke();
        break;
      case "Spark": {
        const dx = Math.cos(p.heading) * p.radius;
        const dy = Math.sin(p.heading) * p.radius;
        ctx.beginPath();
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.lineWidth = Math.max(p.radius * 0.3, 1);
        ctx.strokeStyle = color;
        ctx.stroke();
        break;
      }
      default:
        circle(ctx, p.x, p.y, p.radius, color);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

/* ---------- The easing explorer ---------- */

const USES = {
  Linear: "conveyors and sliding targets",
  Sine: "floating platforms and slow patrols",
  Quad: "doors and lifts",
  Cubic: "doors and lifts",
  Quart: "doors and lifts",
  Quint: "doors and lifts",
  Expo: "pistons and slamming gates",
  Circ: "heavy gates",
  Back: "signs and hinged barriers",
  Elastic: "bumpers",
  Bounce: "things that drop into place",
};
const MODE_FEEL = {
  "Ease in": "starts slowly and ends at full speed",
  "Ease out": "starts fast and ends slowly",
  "In and out": "is slow at both ends",
  "Out and in": "is fast at both ends and slow in the middle",
};
const SHAPED = {
  Back: { "Ease in": "pulls back first, then sets off", "Ease out": "overshoots a little and settles", "In and out": "pulls back first and overshoots at the end", "Out and in": "overshoots the middle, then pulls back before going on" },
  Elastic: { "Ease in": "winds up with growing wobbles, then leaps", "Ease out": "springs past the end and wobbles back", "In and out": "wobbles at both ends", "Out and in": "wobbles through the middle" },
  Bounce: { "Ease in": "bounces off the start", "Ease out": "bounces against the end", "In and out": "bounces at both ends", "Out and in": "bounces through the middle" },
};
const seconds = (value) => `${Number(value.toFixed(1))} s`;
const reaches = new Map();
// How far below its start and past its end a curve goes, at least 0 to 1.
function reach(curve, mode) {
  const key = `${curve}|${mode}`;
  if (!reaches.has(key)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i <= 200; i++) {
      const v = ease(curve, mode, i / 200);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    reaches.set(key, [lo, hi]);
  }
  return reaches.get(key);
}

// A curve's sparkline for its button, on the same scale as the big graph.
function sparkline(curve, mode) {
  const y = (v) => (28 - ((v + 0.45) / 1.9) * 26).toFixed(1);
  const points = Array.from({ length: 41 }, (_, i) => `${(3 + (i / 40) * 42).toFixed(1)},${y(ease(curve, mode, i / 40))}`);
  return `<svg viewBox="0 0 48 30" aria-hidden="true" focusable="false"><path class="spark-guide" d="M3 ${y(0)}H45M3 ${y(1)}H45"/><polyline points="${points.join(" ")}"/></svg>`;
}

function initExplorer() {
  const root = $("#ease-lab");
  if (!root) return;
  const saved = store.get("motion-explorer", {}) || {};
  const lab = {
    curve: CURVES.includes(saved.curve) ? saved.curve : "Bounce",
    mode: MODES.includes(saved.mode) ? saved.mode : "Ease out",
    over: clamp(Number(saved.over) || 1.2, 0.2, 3),
    back: Number.isFinite(saved.back) ? clamp(saved.back, 0, 3) : 1,
    start: performance.now(),
  };
  const LEAD = 0.5;
  const REST = 1.2;
  const cycle = () => LEAD + lab.over + (lab.back > 0 ? lab.back + lab.over : 0.4) + REST;
  // Where the motion is `t` seconds after Replay: which trip, how far through
  // it in time (`along`) and how far the group has come (`p`).
  const moment = (t) => {
    const { curve, mode, over, back } = lab;
    const into = t % cycle();
    let u = into - LEAD;
    if (u < 0) return { phase: "Ready", along: 0, p: 0, shown: back > 0 ? 1 : clamp(into / 0.25, 0, 1) };
    if (u < over) return { phase: "Out", along: u / over, p: ease(curve, mode, u / over), shown: 1 };
    u -= over;
    if (back <= 0) return { phase: "Stays", along: 1, p: 1, shown: clamp(1 - (u - REST) / 0.25, 0, 1) };
    if (u < back) return { phase: "Waiting", along: 1, p: 1, shown: 1 };
    u -= back;
    if (u < over) return { phase: "Going back", along: u / over, p: 1 - ease(curve, mode, u / over), shown: 1 };
    return { phase: "Home", along: 1, p: 0, shown: 1 };
  };
  const now = () => (performance.now() - lab.start) / 1000;

  const curveBox = $("#ease-curves", root);
  const curveButtons = CURVES.map((curve) => {
    const button = h("button", { class: "btn ease-curve", type: "button", "aria-pressed": "false", onclick: () => choose({ curve }) });
    curveBox.append(button);
    return button;
  });
  const modeBox = $("#ease-modes", root);
  const modeButtons = MODES.map((mode) => {
    const button = h("button", { class: "btn small", type: "button", "aria-pressed": "false", text: mode, onclick: () => choose({ mode }) });
    modeBox.append(button);
    return button;
  });
  const over = $("#ease-over", root);
  const back = $("#ease-back", root);
  const say = $("#ease-say", root);

  const fill = (input) => input.style.setProperty("--fill", `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
  const labels = () => {
    over.value = lab.over;
    back.value = lab.back;
    $("#ease-over-v", root).textContent = seconds(lab.over);
    $("#ease-back-v", root).textContent = lab.back > 0 ? seconds(lab.back) : "Stays";
    fill(over);
    fill(back);
  };
  const describe = () => {
    const { curve, mode } = lab;
    const how = curve === "Linear" ? "moves at one speed whatever the mode" : SHAPED[curve]?.[mode] ?? MODE_FEEL[mode];
    const after = lab.back > 0 ? `goes back after ${seconds(lab.back)}` : "stays where it ends";
    say.innerHTML = "";
    say.append(h("b", { text: curve === "Linear" ? "Linear" : `${curve}, ${mode}` }), ` ${how}. Over ${seconds(lab.over)}, it ${after}. Try ${curve} for ${USES[curve]}.`);
  };
  const render = () => {
    curveButtons.forEach((button, i) => {
      button.setAttribute("aria-pressed", String(CURVES[i] === lab.curve));
      button.innerHTML = `${sparkline(CURVES[i], lab.mode)}<span>${CURVES[i]}</span>`;
    });
    modeButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(MODES[i] === lab.mode)));
    labels();
  };
  const save = () => store.set("motion-explorer", { curve: lab.curve, mode: lab.mode, over: lab.over, back: lab.back });
  function choose(change) {
    Object.assign(lab, change);
    lab.start = performance.now();
    render();
    describe();
    save();
    refresh();
  }
  over.addEventListener("input", () => {
    lab.over = clamp(Number(over.value), 0.2, 3);
    lab.start = performance.now();
    labels();
    refresh();
  });
  back.addEventListener("input", () => {
    lab.back = clamp(Number(back.value), 0, 3);
    lab.start = performance.now();
    labels();
    refresh();
  });
  // Spoken once a slider settles, not at every step of a drag.
  for (const input of [over, back]) {
    input.addEventListener("change", () => {
      describe();
      save();
    });
  }
  $("#ease-replay", root).addEventListener("click", () => {
    lab.start = performance.now();
    refresh();
  });
  render();
  describe();

  scene($("#ease-graph", root), (ctx, s, moving) => {
    const { w, h: hgt } = s;
    const left = 50;
    const top = 26;
    const gw = w - left - 16;
    const gh = hgt - top - 30;
    const LO = -0.45;
    const HI = 1.45;
    const X = (x) => left + x * gw;
    const Y = (v) => top + ((HI - v) / (HI - LO)) * gh;
    ctx.fillStyle = palette.plot;
    ctx.fillRect(left, top, gw, gh);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, top + 0.5, gw - 1, gh - 1);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = palette.muted;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const v of [0, 1]) {
      ctx.moveTo(left, Y(v));
      ctx.lineTo(left + gw, Y(v));
    }
    for (const x of [0.25, 0.5, 0.75]) {
      ctx.moveTo(X(x), top);
      ctx.lineTo(X(x), top + gh);
    }
    ctx.stroke();
    ctx.restore();
    text(ctx, "End", left - 8, Y(1), 11, palette.muted, "right");
    text(ctx, "Start", left - 8, Y(0), 11, palette.muted, "right");
    text(ctx, "0 s", X(0), top + gh + 14, 11, palette.muted, "left");
    text(ctx, seconds(lab.over), X(1), top + gh + 14, 11, palette.muted, "right");
    text(ctx, "Time", X(0.5), top + gh + 14, 11, palette.muted);
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) ctx.lineTo(X(i / 240), Y(ease(lab.curve, lab.mode, i / 240)));
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(LOGIC);
    ctx.stroke();
    if (!moving) {
      // A still frame: where the group is after each tenth of the motion.
      for (let k = 0; k <= 10; k++) circle(ctx, X(k / 10), Y(ease(lab.curve, lab.mode, k / 10)), 3.5, rgba(ACCENT, 0.9));
      text(ctx, `${lab.curve}, ${lab.mode}`, left + 8, top - 13, 12, palette.ink, "left");
      return;
    }
    const m = moment(now());
    ctx.strokeStyle = rgba(ACCENT, 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(m.along), top);
    ctx.lineTo(X(m.along), top + gh);
    ctx.stroke();
    const y = Y(ease(lab.curve, lab.mode, m.along));
    circle(ctx, X(m.along), y, 7, "#ffffff");
    circle(ctx, X(m.along), y, 5, rgba(ACCENT));
    text(ctx, m.phase, left + 8, top - 13, 12, palette.ink, "left");
    text(ctx, `${lab.curve}, ${lab.mode}`, left + gw, top - 13, 12, palette.muted, "right");
  });

  scene($("#ease-yard", root), (ctx, s, moving) => {
    const { w, h: hgt } = s;
    floor(ctx, { k: 1, x0: 0, y0: 0, x1: w, y1: hgt }, 24);
    const wide = w >= 520;
    const side = 172;
    const lane = wide ? { x: 0, y: 0, w: w - side, h: hgt } : { x: 0, y: 0, w, h: Math.round(hgt * 0.56) };
    const cells = wide
      ? [{ x: w - side, y: 0, w: side, h: hgt / 2 }, { x: w - side, y: hgt / 2, w: side, h: hgt / 2 }]
      : [{ x: 0, y: lane.h, w: w / 2, h: hgt - lane.h }, { x: w / 2, y: lane.h, w: w / 2, h: hgt - lane.h }];
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of cells) {
      ctx.moveTo(c.x + 0.5, c.y);
      ctx.lineTo(c.x + 0.5, c.y + c.h);
      ctx.moveTo(c.x, c.y + 0.5);
      ctx.lineTo(c.x + c.w, c.y + 0.5);
    }
    ctx.stroke();

    const m = moving ? moment(now()) : { p: 1, shown: 1 };
    const size = clamp(Math.round(lane.h * 0.2), 26, 40);
    const [lo, hi] = reach(lab.curve, lab.mode);
    const travelX = (lane.w - 64 - size) / (hi - lo);
    const homeX = lane.x + 30 - lo * travelX;
    const y = Math.round(lane.y + lane.h * 0.5 - size * 0.7);
    const rect = [homeX, y, size, size];
    text(ctx, "MOVE GROUP", lane.x + 12, lane.y + 14, 11, palette.muted, "left");
    // Each mark is where the group is after another tenth of the motion:
    // close together where it moves slowly, far apart where it's fast.
    const ticks = y + size + 18;
    ctx.strokeStyle = rgba(LOGIC, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const x = homeX + size / 2 + travelX * ease(lab.curve, lab.mode, k / 10);
      const tall = k % 5 === 0 ? 7 : 4;
      ctx.moveTo(x, ticks - tall);
      ctx.lineTo(x, ticks + tall);
    }
    ctx.stroke();
    text(ctx, "Every tenth of the time", homeX, ticks + 18, 11, palette.muted, "left");
    travel(ctx, rect, travelX, 0);
    if (!moving) {
      for (let k = 1; k < 10; k++) {
        ctx.globalAlpha = 0.18;
        block(ctx, homeX + travelX * ease(lab.curve, lab.mode, k / 10), y, size, size);
      }
      ctx.globalAlpha = 1;
    }
    home(ctx, rect, Math.abs(m.p) * travelX);
    ctx.globalAlpha = m.shown;
    block(ctx, homeX + travelX * m.p, y, size, size);
    badge(ctx, homeX + travelX * m.p + 3, y + 3, 1);
    ctx.globalAlpha = 1;

    const [turn, fade] = cells;
    text(ctx, "TURN DECOR · 90°", turn.x + 12, turn.y + 14, 11, palette.muted, "left");
    const tx = turn.x + turn.w / 2;
    const ty = turn.y + turn.h / 2 + 8;
    const span = Math.min(turn.w, turn.h) * 0.3;
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = rgba(LOGIC, 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx + span * 1.15, ty);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx, ty + span * 1.15);
    ctx.stroke();
    ctx.restore();
    if (!moving) arrowDecor(ctx, tx, ty, span * 1.8, span * 0.9, 0, ARROW, 0.25);
    arrowDecor(ctx, tx, ty, span * 1.8, span * 0.9, 90 * m.p, ARROW, m.shown);

    text(ctx, "FADE DECOR · 15%", fade.x + 12, fade.y + 14, 11, palette.muted, "left");
    const opacity = clamp(1 + (0.15 - 1) * m.p, 0, 1);
    const lamp = Math.min(fade.w, fade.h) * 0.42;
    light(ctx, fade.x + fade.w / 2, fade.y + fade.h / 2 + 8, lamp, NEON, LAMP_ALPHA * opacity * m.shown);
    text(ctx, `${Math.round(opacity * 100)}%`, fade.x + fade.w - 12, fade.y + fade.h - 14, 11, palette.ink, "right");
  });
}

/* ---------- The Motion palette's pieces at work ---------- */

// Each piece's scene on a 220 by 140 stage, with the timings the palette gives it.
const PIECES = {
  door(ctx, t) {
    // On enter, Move group to 6% higher over 0.5 s, Cubic Ease out, back after 4 s.
    const period = 8.6;
    t %= period;
    const tx = -12 + Math.max(0, t - 0.6) * 48;
    const enter = 0.6 + 90 / 48;
    const shut = enter + 0.5 + 4;
    let p = 0;
    if (t >= enter && t < shut) p = ease("Cubic", "Ease out", (t - enter) / 0.5);
    else if (t >= shut) p = 1 - ease("Cubic", "Ease out", (t - shut) / 0.5);
    area(ctx, 78, 38, 64, 64, clamp(1 - (t - enter) / 0.6, 0, 1) * (t >= enter ? 1 : 0));
    block(ctx, 102, -14, 16, 60);
    block(ctx, 102, 94, 16, 60);
    tank(ctx, tx, 70, 9, 0);
    const doorY = 46 - 56 * p;
    home(ctx, [102, 46, 16, 48], 56 * p);
    block(ctx, 102, doorY, 16, 48);
    badge(ctx, 104.5, doorY + 34, 1);
  },
  shuttle(ctx, t) {
    // Every 6 s, Move group 15% across over 2 s, Sine In and out, back after 1 s.
    const u = (t + 5.4) % 6;
    const p = trip("Sine", "In and out", 2, 1, u);
    const rect = [36, 42, 14, 56];
    travel(ctx, rect, 132, 0);
    home(ctx, rect, 132 * p);
    block(ctx, 36 + 132 * p, 42, 14, 56);
    badge(ctx, 37.5 + 132 * p, 45, 1);
    tank(ctx, 204, 70, 8, Math.PI);
    timer(ctx, 202, 18, 9, u / 6);
  },
  piston(ctx, t) {
    // Every 2 s, Move group 4% across over 0.2 s, Expo Ease out, back after 0.4 s.
    const u = (t + 1.6) % 2;
    const p = trip("Expo", "Ease out", 0.2, 0.4, u);
    block(ctx, 22, 16, 18, 108);
    const x = 40 + 40 * p;
    if (u > 0.05 && u < 0.6) {
      const fade = 1 - (u - 0.05) / 0.55;
      ctx.strokeStyle = rgba(LOGIC, 0.8 * fade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const dy of [-14, 0, 14]) {
        ctx.moveTo(x + 32, 70 + dy);
        ctx.lineTo(x + 32 + 10 + 8 * (1 - fade), 70 + dy * 1.3);
      }
      ctx.stroke();
    }
    home(ctx, [40, 56, 28, 28], 40 * p);
    block(ctx, x, 56, 28, 28);
    badge(ctx, x + 3, 59, 1);
    tank(ctx, 168, 70, 10, Math.PI);
    timer(ctx, 202, 18, 9, u / 2);
  },
  lift(ctx, t) {
    // On signal 1, Move group to 12% below its place over 1.5 s, Quad In and out.
    const period = 5;
    t %= period;
    const sent = 0.7;
    const p = t < sent ? 0 : ease("Quad", "In and out", (t - sent) / 1.5);
    const shown = clamp(Math.min(t / 0.25, (period - t) / 0.25), 0, 1);
    const rect = [104, 26, 64, 16];
    if (t < sent + 1.5) travel(ctx, rect, 0, 68);
    signal(ctx, [32, 70], [104, 34 + 68 * p], 1, clamp(1 - Math.abs(t - sent) / 0.45, 0, 1));
    home(ctx, rect, 68 * p);
    ctx.globalAlpha = shown;
    block(ctx, 104, 26 + 68 * p, 64, 16);
    badge(ctx, 107, 28.5 + 68 * p, 1);
    ctx.globalAlpha = 1;
  },
  home(ctx, t) {
    // On signal 2, Move group to its place over 1.5 s, Quad In and out: from anywhere.
    const period = 4.6;
    const round = Math.floor(t / period);
    t %= period;
    const [dx, dy] = [[70, 48], [-64, 40], [58, -10]][round % 3];
    const sent = 0.8;
    const p = t < sent ? 0 : ease("Quad", "In and out", (t - sent) / 1.5);
    const shown = clamp(Math.min(t / 0.25, (period - t) / 0.25), 0, 1);
    const x = 118 + dx * (1 - p);
    const y = 40 + dy * (1 - p);
    dashed(ctx, 118, 40, 30, 30, 1.5, 4, palette.dark ? "rgba(242,245,247,0.55)" : "rgba(51,59,69,0.5)");
    signal(ctx, [32, 70], [x + 15, y + 15], 2, clamp(1 - Math.abs(t - sent) / 0.45, 0, 1));
    ctx.globalAlpha = shown;
    block(ctx, x, y, 30, 30);
    badge(ctx, x + 3, y + 3, 1);
    ctx.globalAlpha = 1;
  },
  drop(ctx, t) {
    // At start, Move group 8% down over 1.2 s, Bounce Ease out.
    const period = 3.8;
    t %= period;
    const start = 0.6;
    const p = t < start ? 0 : ease("Bounce", "Ease out", (t - start) / 1.2);
    const shown = clamp(Math.min(t / 0.25, (period - t) / 0.25), 0, 1);
    const rect = [70, 22, 80, 18];
    if (t < start + 1.2) travel(ctx, rect, 0, 70);
    home(ctx, rect, 70 * p);
    ctx.globalAlpha = shown;
    block(ctx, 70, 22 + 70 * p, 80, 18, STYLES.rampart);
    badge(ctx, 73, 25.5 + 70 * p, 1);
    ctx.globalAlpha = 1;
    const go = clamp(1 - Math.abs(t - start - 0.2) / 0.6, 0, 1);
    if (go > 0) {
      ctx.globalAlpha = go;
      text(ctx, "Round starts", 110, 124, 11, palette.ink);
      ctx.globalAlpha = 1;
    }
  },
  spinner(ctx, t) {
    // Every 3 s, Turn decor a quarter turn over 0.8 s, Back Ease out.
    const u = (t + 2.4) % 12;
    const turns = Math.floor(u / 3);
    const angle = 90 * (turns + ease("Back", "Ease out", (u - turns * 3) / 0.8));
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = rgba(LOGIC, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(110, 72, 44, 0, TAU);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      circle(ctx, 110 + Math.cos(a) * 44, 72 + Math.sin(a) * 44, 2.5, rgba(LOGIC, 0.85));
    }
    arrowDecor(ctx, 110, 72, 70, 34, angle, ARROW);
    timer(ctx, 202, 18, 9, (u % 3) / 3);
  },
  fader(ctx, t) {
    // On enter, Fade decor to 15% over 0.6 s, Sine In and out, back after 5 s.
    const period = 9.4;
    t %= period;
    const tx = -12 + Math.max(0, t - 0.4) * 34;
    const enter = 0.4 + 62 / 34;
    const back = enter + 0.6 + 5;
    let p = 0;
    if (t >= enter && t < back) p = ease("Sine", "In and out", (t - enter) / 0.6);
    else if (t >= back) p = 1 - ease("Sine", "In and out", (t - back) / 0.6);
    tank(ctx, tx, 72, 9, 0);
    const opacity = 1 - 0.85 * p;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = rgba(PANEL);
    ctx.fillRect(50, 32, 120, 80);
    ctx.beginPath();
    ctx.rect(50, 32, 120, 80);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let x = 30; x < 190; x += 18) {
      ctx.moveTo(x, 112);
      ctx.lineTo(x + 40, 32);
    }
    ctx.stroke();
    ctx.restore();
    badge(ctx, 53, 35, 1);
    area(ctx, 50, 32, 120, 80, t >= enter ? clamp(1 - (t - enter) / 0.6, 0, 1) : 0);
    text(ctx, `${Math.round(opacity * 100)}%`, 210, 14, 11, palette.ink, "right");
  },
  blink(ctx, t) {
    // Every 2 s, Fade decor to nothing over 0.3 s, Sine In and out, back after 0.7 s.
    const u = (t + 1.4) % 2;
    const opacity = 1 - trip("Sine", "In and out", 0.3, 0.7, u);
    light(ctx, 110, 66, 62, NEON, LAMP_ALPHA * opacity);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "#1c232b";
    ctx.fillRect(80, 52, 60, 28);
    ctx.strokeStyle = rgba(NEON);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(80.75, 52.75, 58.5, 26.5);
    text(ctx, "EXIT", 110, 67, 14, rgba(mix(NEON, WHITE, 0.4)));
    badge(ctx, 66, 52, 1);
    ctx.globalAlpha = 1;
    dashed(ctx, 80, 52, 60, 28, 1.5, 4, palette.dark ? "rgba(242,245,247,0.35)" : "rgba(51,59,69,0.35)");
    text(ctx, `${Math.round(opacity * 100)}%`, 210, 124, 11, palette.ink, "right");
    timer(ctx, 202, 18, 9, u / 2);
  },
  then(ctx, t) {
    // On arrive group 1, Send signal 1: once at each end of every trip.
    const u = t % 4;
    const p = trip("Cubic", "In and out", 1, 1, u);
    const x = 26 + 70 * p;
    const arrivals = [1, 3];
    const since = Math.min(...arrivals.map((a) => (u >= a ? u - a : u + 4 - a)));
    const lit = clamp(1 - since / 0.6, 0, 1);
    if (lit > 0) {
      ctx.beginPath();
      ctx.arc(x + 15, 70, 18 + 26 * (1 - lit), 0, TAU);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(SIGNAL, lit);
      ctx.stroke();
    }
    signal(ctx, [190, 70], [x + 30, 70], 1, lit);
    block(ctx, x, 55, 30, 30);
    badge(ctx, x + 3, 58, 1);
  },
};

function initPieces() {
  for (const canvas of $$("canvas[data-piece]")) {
    const paint = PIECES[canvas.dataset.piece];
    if (!paint) continue;
    scene(canvas, (ctx, s, moving) => {
      const view = stage(ctx, s, 220, 140);
      floor(ctx, view, 20);
      // A still frame catches each piece partway through its motion.
      paint(ctx, moving ? s.clock : STILL[canvas.dataset.piece] ?? 1);
    });
  }
}
const STILL = { door: 3.4, shuttle: 1.6, piston: 0.5, lift: 1.8, home: 1.4, drop: 1.1, spinner: 0.9, fader: 3.2, blink: 0.75, then: 1.08 };

/* ---------- On arrive: barricades that land in turn ---------- */

function initChain() {
  const canvas = $("#chain-view");
  if (!canvas) return;
  const steps = $$("#chain-steps li");
  let shown = -2;
  const period = 8;
  const starts = [0.6, 1.8, 3];
  scene(canvas, (ctx, s, moving) => {
    const view = stage(ctx, s, 560, 280);
    floor(ctx, view, 20);
    const t = moving ? s.clock % period : 5;
    const fade = clamp(Math.min(t / 0.3, (period - t) / 0.4), 0, 1);
    const xs = [70, 230, 390];
    const landed = (i) => t >= starts[i] + 1.2;
    for (const [x, w] of [[-20, 90], [170, 60], [330, 60], [490, 90]]) block(ctx, x, 140, w, 18);
    // The logic links, lit as each landing sets off the next Drop.
    for (let i = 0; i < 2; i++) {
      const lit = landed(i) ? clamp(1 - (t - starts[i] - 1.2) / 0.8, 0, 1) : 0;
      const color = rgba(SIGNAL, 0.45 + 0.55 * lit);
      const [ax, bx, cx] = [xs[i] + 60, xs[i + 1] + 40, (xs[i] + xs[i + 1]) / 2 + 50];
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 + 1.5 * lit;
      ctx.beginPath();
      ctx.moveTo(ax, 134);
      ctx.quadraticCurveTo(cx, 84, bx, 132);
      ctx.stroke();
      ctx.restore();
      const along = Math.hypot(bx - cx, 132 - 84);
      arrow(ctx, [bx - ((bx - cx) / along) * 12, 132 - ((132 - 84) / along) * 12], [bx, 132], 2, color);
      if (lit > 0) circle(ctx, ax, 136, 4 + 12 * (1 - lit), rgba(SIGNAL, 0.5 * lit));
    }
    for (let i = 0; i < 3; i++) {
      const p = t < starts[i] ? 0 : ease("Bounce", "Ease out", (t - starts[i]) / 1.2);
      if (!landed(i)) {
        ctx.fillStyle = rgba(LOGIC, 0.08);
        ctx.fillRect(xs[i], 140, 100, 18);
        dashed(ctx, xs[i], 140, 100, 18, 1.5, 5, rgba(LOGIC, 0.6));
      }
      ctx.globalAlpha = fade;
      block(ctx, xs[i], 44 + 96 * p, 100, 18, STYLES.rampart);
      badge(ctx, xs[i] + 3, 47.5 + 96 * p, 3 + i);
      ctx.globalAlpha = 1;
    }
    const go = clamp(1 - Math.abs(t - 0.7) / 0.6, 0, 1);
    if (go > 0) {
      ctx.globalAlpha = go;
      text(ctx, "Round starts", 280, 238, 12, palette.ink);
      ctx.globalAlpha = 1;
    }
    // Then: on arrive group 5, Announce.
    const said = t >= 4.2 ? clamp(Math.min((t - 4.2) / 0.25, (period - 0.5 - t) / 0.3), 0, 1) : 0;
    if (said > 0) {
      ctx.globalAlpha = said;
      ctx.fillStyle = "rgba(23,28,34,0.82)";
      ctx.fillRect(140, 214, 280, 40);
      text(ctx, "The gates are set!", 280, 234.5, 18, "#ffffff");
      ctx.globalAlpha = 1;
    }
    let active = -1;
    if (moving) {
      active = starts.findIndex((start) => t >= start && t < start + 1.2);
      if (active < 0 && t >= 4.2 && t < period - 0.5) active = 3;
    }
    if (active !== shown) {
      shown = active;
      steps.forEach((step, i) => step.classList.toggle("on", i === active));
    }
  });
}

/* ---------- Lights and particles in the yard ---------- */

// Where each preset plays on the 560 by 280 stage.
const EMITTERS = {
  Embers: [400, 190, 90, 40],
  Rain: [330, -16, 240, 8],
  Dust: [360, 160, 170, 90],
  Sparks: [436, 206, 24, 10],
  Fireflies: [340, 110, 210, 150],
  Smoke: [436, 210, 24, 24],
  Snow: [330, -16, 240, 8],
  Glitter: [380, 130, 130, 100],
  Fountain: [438, 226, 24, 12],
  Pulse: [438, 186, 24, 24],
};

function initGlow() {
  const root = $("#glow");
  if (!root) return;
  const state = { effect: "Fountain", flicker: 0.55, dark: true };
  const presets = $$("[data-effect]", root);
  const pick = (name) => {
    state.effect = name;
    presets.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.effect === name)));
    refresh();
  };
  presets.forEach((b) => b.addEventListener("click", () => pick(b.dataset.effect)));
  pick(state.effect);
  const flickerInput = $("#glow-flicker", root);
  const fill = () => flickerInput.style.setProperty("--fill", `${flickerInput.value * 100}%`);
  flickerInput.addEventListener("input", () => {
    state.flicker = clamp(Number(flickerInput.value), 0, 1);
    $("#glow-flicker-v", root).textContent = state.flicker.toFixed(2);
    fill();
    refresh();
  });
  fill();
  const dark = $("#glow-dark", root);
  dark.addEventListener("click", () => {
    state.dark = !state.dark;
    dark.setAttribute("aria-checked", String(state.dark));
    refresh();
  });

  const lamps = [
    { x: 248, y: 132, r: 64, rgb: TORCH, torch: true },
    { x: 312, y: 132, r: 64, rgb: TORCH, torch: true },
    { x: 116, y: 188, r: 112, rgb: LANTERN, flicker: 0.15 },
    { x: 312, y: 236, r: 54, rgb: NEON, flicker: 0 },
  ];
  scene($("#glow-view", root), (ctx, s, moving) => {
    const view = stage(ctx, s, 560, 280);
    floor(ctx, view, 20, state.dark ? FLOORS.dark : FLOORS.light);
    // Lights hold steady for players with reduced motion, as in the game.
    const t = moving ? s.clock + 3 : 7.3;
    for (const lamp of lamps) {
      const amount = lamp.torch ? state.flicker : lamp.flicker;
      const wave = moving ? flicker(amount, lamp.x / 560, lamp.y / 280, t) : 1;
      light(ctx, lamp.x, lamp.y, lamp.r, lamp.rgb, LAMP_ALPHA * wave);
    }
    // The gatehouse wall, its door in the gap.
    block(ctx, 272, -12, 16, 120);
    block(ctx, 272, 108, 16, 52);
    block(ctx, 272, 160, 16, 132);
    badge(ctx, 274.5, 111, 1);
    for (const lamp of lamps.filter((l) => l.torch)) {
      emit(ctx, EFFECTS.Embers, [lamp.x - 8, lamp.y - 18, 16, 10], 0.5, t, Math.round(lamp.x));
    }
    arrowDecor(ctx, 230, 236, 40, 20, 180, ARROW, 0.95);
    emit(ctx, EFFECTS.Fireflies, [24, 18, 150, 70], 0.6, t, 5);
    emit(ctx, EFFECTS[state.effect], EMITTERS[state.effect], 0.6, t, 9);
  });
}

// The effects section (effects.js) draws with the same pieces.
export {
  scene, refresh, stage, floor, block, badge, area, signal, timer, text, circle, tank, light, arrowDecor,
  rgba, mix, palette, LOGIC, SIGNAL, NEON, LANTERN, TORCH, ARROW, PANEL, LAMP_ALPHA,
};

export function initMotions(tanks) {
  const root = $("#motions");
  if (!root) return;
  tankModel = tanks?.classes?.find((c) => c.id === "vector") ?? null;
  tankColors = tanks?.colors ?? null;
  if (!tankColors) tankModel = null;
  initExplorer();
  initPieces();
  initChain();
  initGlow();
  document.addEventListener("tankyard:theme", () => {
    palette = themeColors();
    refresh();
  });
  reducedMotion.addEventListener?.("change", refresh);
  document.fonts?.ready.then(refresh);
}
