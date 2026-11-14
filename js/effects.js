// The workshop's 1.1 effects: an effects lab, the Effects palette, launch
// pads and the map sounds. Poses, tints and sounds come from effect-math.js,
// which follows the game's own code.
import { $, $$, clamp } from "./util.js";
import { ease, trip } from "./motion-math.js";
import { STYLES, SOUNDS, SOUND_RATE, LAUNCH_COAST, animation, keepPhase, tinted, launch, falloff, soundSamples } from "./effect-math.js";
import {
  scene, refresh, stage, floor, block, badge, area, signal, timer, text, circle, tank, light, arrowDecor,
  rgba, mix, palette, LOGIC, NEON, LANTERN, ARROW, PANEL, LAMP_ALPHA,
} from "./motions.js";

const TAU = Math.PI * 2;
const LAUNCH = [166, 204, 60];
const WHITE = [1, 1, 1];
const RED = [1, 64 / 255, 48 / 255];
const CYAN = [96 / 255, 224 / 255, 1];

// How far along its track a slider is, for the site's range style.
function fill(input) {
  input.style.setProperty("--fill", `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
}

/* ---------- Decor, as scenery.rs draws it with a group's pose ---------- */

// `pose`: { x, y, turn, scale, tint: [r, g, b] (0-1), strength, alpha }.
const REST = { x: 0, y: 0, turn: 0, scale: 1, tint: WHITE, strength: 0, alpha: 1 };

function decor(ctx, kind, cx, cy, w, hgt, rgb, pose = REST) {
  const p = { ...REST, ...pose };
  const color = tinted(rgb, p.tint, p.strength);
  const x = cx + p.x;
  const y = cy + p.y;
  const sw = w * p.scale;
  const sh = hgt * p.scale;
  switch (kind) {
    case "light":
      light(ctx, x, y, sw / 2, color, LAMP_ALPHA * p.alpha);
      return;
    case "arrow":
      arrowDecor(ctx, x, y, sw, sh, p.turn, color, p.alpha);
      return;
    case "ring":
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, sw / 2 - 2), 0, TAU);
      ctx.lineWidth = Math.max(1.5, sw * 0.06);
      ctx.strokeStyle = rgba(color, 0.95 * p.alpha);
      ctx.stroke();
      return;
    default:
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((p.turn * Math.PI) / 180);
      ctx.fillStyle = rgba(color, 0.9 * p.alpha);
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
      ctx.lineWidth = Math.max(1, Math.min(sw, sh) * 0.06);
      ctx.strokeStyle = rgba(mix(color, [20, 26, 32], 0.45), p.alpha);
      ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
      ctx.restore();
  }
}

// An animation's pose at `phase` cycles, as GroupPoses applies it.
function animated(style, size, phase) {
  const a = animation(style, size, phase);
  return { x: a.x, y: a.y, turn: a.turn, scale: clamp(1 + a.grow, 0, 8) };
}

// A tank that drives in from the left and stops at `stop`; returns when it gets there.
function arriving(ctx, t, stop, y = 70) {
  tank(ctx, Math.min(stop, -12 + Math.max(0, t - 0.3) * 60), y, 9, 0);
  return 0.3 + (stop + 12) / 60;
}

// A speaker, as the palette's Play sound badge draws one, with rings while it sounds.
function speaker(ctx, x, y, rgb, sounding) {
  ctx.fillStyle = rgba(rgb);
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 4);
  ctx.lineTo(x - 4, y - 4);
  ctx.lineTo(x + 2, y - 9);
  ctx.lineTo(x + 2, y + 9);
  ctx.lineTo(x - 4, y + 4);
  ctx.lineTo(x - 9, y + 4);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const u = (sounding * 1.4 + i / 3) % 1;
    if (sounding <= 0) break;
    ctx.beginPath();
    ctx.arc(x + 2, y, 8 + u * 46, -0.7, 0.7);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(rgb, (1 - u) * Math.min(1, sounding * 3));
    ctx.stroke();
  }
}

/* ---------- The Effects palette ---------- */

// Each piece plays with the settings the workshop gives it; comments name them.
const PIECES = {
  float(ctx, t) {
    // At start, Animate Bob 14 units, once every 1.7 s (0.6 a second).
    ctx.fillStyle = rgba([0, 0, 0], palette.dark ? 0.25 : 0.12);
    ctx.beginPath();
    ctx.ellipse(110, 104, 26, 6, 0, 0, TAU);
    ctx.fill();
    const pose = animated("Bob", 14, t * 0.6);
    decor(ctx, "light", 110, 66, 92, 92, LANTERN, pose);
    decor(ctx, "tile", 110, 66, 16, 22, [214, 170, 92], pose);
    badge(ctx, 96 + pose.x, 50 + pose.y, 1);
  },
  sway(ctx, t) {
    // At start, Animate Sway 12°, once every 2 s.
    const pose = animated("Sway", 12, t * 0.5);
    ctx.strokeStyle = rgba(palette.dark ? [200, 210, 220] : [70, 80, 90], 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(110, 14);
    const a = ((pose.turn - 90) * Math.PI) / 180;
    ctx.lineTo(110 - Math.cos(a) * 34, 14 - Math.sin(a) * 34);
    ctx.stroke();
    const cx = 110 - Math.cos(a) * 56;
    const cy = 14 - Math.sin(a) * 56;
    decor(ctx, "tile", cx, cy, 78, 30, PANEL, pose);
    decor(ctx, "arrow", cx, cy, 52, 20, ARROW, { turn: pose.turn });
    badge(ctx, cx - 36, cy - 26, 1);
  },
  throb(ctx, t) {
    // At start, Animate Throb 12%, 1.2 times a second.
    const pose = animated("Throb", 12, t * 1.2);
    decor(ctx, "light", 110, 70, 96, 96, [255, 120, 140], { scale: pose.scale });
    decor(ctx, "ring", 110, 70, 56, 56, [255, 150, 165], { scale: pose.scale });
    badge(ctx, 136, 38, 1);
  },
  orbit(ctx, t) {
    // At start, Animate Orbit 40 units, once every 4 s.
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = rgba(LOGIC, 0.45);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(110, 70, 40, 0, TAU);
    ctx.stroke();
    ctx.restore();
    circle(ctx, 110, 70, 2.5, rgba(LOGIC, 0.7));
    const pose = animated("Orbit", 40, t * 0.25);
    decor(ctx, "light", 110, 70, 60, 60, NEON, pose);
    decor(ctx, "ring", 110, 70, 18, 18, NEON, pose);
    badge(ctx, 116 + pose.x, 50 + pose.y, 1);
  },
  quiver(ctx, t) {
    // On enter, Animate Shake 6 units, 9 times a second, over 1 s, back after 1 s.
    const period = 6;
    t %= period;
    const entered = arriving(ctx, t, 60);
    area(ctx, 40, 40, 60, 60, clamp(1 - (t - entered) / 0.6, 0, 1) * (t >= entered ? 1 : 0));
    const size = t < entered ? 0 : 6 * trip("Sine", "In and out", 1, 1, t - entered);
    const pose = animated("Shake", size, t * 9);
    for (const [x, y] of [[150, 46], [178, 70], [150, 94]]) decor(ctx, "tile", x, y, 22, 22, [190, 150, 110], pose);
    badge(ctx, 136 + pose.x, 30 + pose.y, 1);
  },
  flash(ctx, t) {
    // On enter, Tint white 90% over 0.08 s, Quad Ease out, back after 0.12 s.
    const period = 4;
    t %= period;
    const entered = arriving(ctx, t, 60);
    area(ctx, 40, 40, 60, 60, clamp(1 - (t - entered) / 0.6, 0, 1) * (t >= entered ? 1 : 0));
    const p = t < entered ? 0 : trip("Quad", "Ease out", 0.08, 0.12, t - entered);
    for (const [x, y] of [[156, 44], [156, 96]]) decor(ctx, "tile", x, y, 52, 14, NEON, { tint: WHITE, strength: 0.9 * p });
    decor(ctx, "light", 156, 70, 70, 70, NEON, { tint: WHITE, strength: 0.9 * p });
    badge(ctx, 128, 26, 1);
  },
  alarm(ctx, t) {
    // Every 1.2 s, Tint red 80% over 0.25 s, Sine In and out, back after 0.35 s.
    const u = (t + 0.9) % 1.2;
    const p = trip("Sine", "In and out", 0.25, 0.35, u);
    const pose = { tint: RED, strength: 0.8 * p };
    decor(ctx, "light", 104, 70, 96, 96, [255, 214, 150], pose);
    decor(ctx, "tile", 104, 70, 30, 30, [230, 200, 140], pose);
    badge(ctx, 86, 50, 1);
    timer(ctx, 202, 18, 9, u / 1.2);
  },
  dye(ctx, t) {
    // On signal 1, Tint cyan 70% over 1 s, Sine In and out.
    const period = 4.4;
    t %= period;
    const sent = 0.7;
    const p = t < sent ? 0 : ease("Sine", "In and out", (t - sent) / 1);
    const shown = clamp((period - t) / 0.3, 0, 1);
    signal(ctx, [32, 70], [118, 70], 1, clamp(1 - Math.abs(t - sent) / 0.45, 0, 1));
    ctx.globalAlpha = shown;
    for (const [x, y] of [[132, 44], [168, 44], [132, 96], [168, 96]]) {
      decor(ctx, "tile", x, y, 28, 28, [222, 222, 214], { tint: CYAN, strength: 0.7 * p });
    }
    badge(ctx, 116, 28, 1);
    ctx.globalAlpha = 1;
  },
  grow(ctx, t) {
    // On enter, Scale 140% over 0.4 s, Back Ease out, back after 2 s.
    const period = 5;
    t %= period;
    const entered = arriving(ctx, t, 52);
    area(ctx, 32, 40, 60, 60, clamp(1 - (t - entered) / 0.6, 0, 1) * (t >= entered ? 1 : 0));
    const p = t < entered ? 0 : trip("Back", "Ease out", 0.4, 2, t - entered);
    const scale = 1 + 0.4 * p;
    decor(ctx, "light", 156, 70, 64, 64, [255, 190, 110], { scale });
    decor(ctx, "ring", 156, 70, 40, 40, [255, 190, 110], { scale });
    text(ctx, `${Math.round(scale * 100)}%`, 210, 124, 11, palette.ink, "right");
    badge(ctx, 128, 36, 1);
  },
  stop(ctx, t) {
    // On signal 1, Stop group 1: the orbiting light freezes where it is.
    const period = 5.2;
    const round = Math.floor(t / period);
    t %= period;
    const sent = 2.2;
    const shown = clamp(Math.min(t / 0.25, (period - t) / 0.25), 0, 1);
    const phase = Math.min(t, sent) * 0.35 + round * 0.37;
    const pose = animated("Orbit", 32, phase);
    signal(ctx, [32, 70], [140 + pose.x, 70 + pose.y], 1, clamp(1 - Math.abs(t - sent) / 0.45, 0, 1));
    ctx.globalAlpha = shown;
    decor(ctx, "light", 140, 70, 56, 56, NEON, pose);
    decor(ctx, "arrow", 140, 70, 30, 14, ARROW, { ...pose, turn: phase * 360 });
    badge(ctx, 146 + pose.x, 50 + pose.y, 1);
    ctx.globalAlpha = 1;
    if (t >= sent) text(ctx, "held", 210, 124, 11, palette.ink, "right");
  },
  quake(ctx, t, s) {
    // On enter, Shake screen 45% for 0.8 s; rests 3 s between quakes.
    const period = 4.6;
    t %= period;
    const entered = 0.3 + 82 / 60;
    const left = t < entered ? 0 : Math.max(0, 0.8 - (t - entered));
    // effects.rs: full strength until the last third, then easing away.
    const level = 0.45 * 40 * Math.min(1, (left / 0.8) * 3) * 0.25;
    ctx.translate(Math.sin(t * 73) * level, Math.cos(t * 97) * level);
    floor(ctx, s.view, 20);
    area(ctx, 50, 20, 130, 100, left > 0 ? 1 : 0);
    block(ctx, 186, 40, 18, 60);
    tank(ctx, Math.min(70, -12 + Math.max(0, t - 0.3) * 60), 70, 9, 0);
    if (left > 0) text(ctx, "view shaking", 210, 130, 11, palette.ink, "right");
  },
  chime(ctx, t) {
    // On enter, Play sound Chime at 80%; rests 2 s between chimes.
    const period = 4;
    t %= period;
    const entered = arriving(ctx, t, 60);
    area(ctx, 40, 40, 60, 60, clamp(1 - (t - entered) / 0.6, 0, 1) * (t >= entered ? 1 : 0));
    const sounding = t < entered ? 0 : clamp(1.4 - (t - entered), 0, 1.4);
    speaker(ctx, 150, 70, LOGIC, sounding);
  },
  siren(ctx, t) {
    // On signal 1, Play sound Alarm at 100%.
    const period = 4;
    t %= period;
    const sent = 0.6;
    const sounding = t < sent ? 0 : clamp(1.5 - (t - sent), 0, 1.5);
    signal(ctx, [32, 70], [130, 70], 1, clamp(1 - Math.abs(t - sent) / 0.45, 0, 1));
    const red = Math.floor((t - sent) / 0.19) % 2 === 0;
    speaker(ctx, 146, 70, sounding > 0 && red ? [255, 90, 70] : LOGIC, sounding);
  },
};
const STILL = { float: 0.4, sway: 0.5, throb: 0.2, orbit: 1.3, quiver: 2.1, flash: 1.64, alarm: 0.2, dye: 1.4, grow: 1.9, stop: 3, quake: 1.7, chime: 2, siren: 1 };

function initPieces() {
  for (const canvas of $$("canvas[data-fx]")) {
    const name = canvas.dataset.fx;
    const paint = PIECES[name];
    if (!paint) continue;
    scene(canvas, (ctx, s, moving) => {
      s.view = stage(ctx, s, 220, 140);
      floor(ctx, s.view, 20);
      paint(ctx, moving ? s.clock : STILL[name], s);
    });
  }
}

/* ---------- The effects lab ---------- */

const LAB_TINTS = { None: null, Red: [255, 64, 48], Cyan: [96, 224, 255], Gold: [255, 200, 64], Violet: [191, 127, 245], White: [255, 255, 255] };
// The site keeps sizes within its stage; the game allows up to the style's limit.
const LAB_SIZE = { Bob: 60, Sway: 180, Throb: 100, Shake: 30, Orbit: 80 };

function initLab() {
  const root = $("#fx-lab");
  if (!root) return;
  const state = { style: "Orbit", size: 40, speed: STYLES.Orbit.speed, phase: 0, tint: "None", strength: 70, scale: 100, held: false };
  const styleButtons = $$("[data-fx-style]", root);
  const tintButtons = $$("[data-fx-tint]", root);
  const size = $("#fx-size", root);
  const speed = $("#fx-speed", root);
  const strength = $("#fx-strength", root);
  const scale = $("#fx-scale", root);
  const hold = $("#fx-hold", root);
  const say = $("#fx-say", root);
  let lab = null;
  const now = () => (lab ? lab.clock : 0);

  const describe = () => {
    const style = STYLES[state.style];
    const rate = Number(state.speed.toFixed(2));
    const every = rate === 1 ? "once a second" : rate > 1 ? `${rate} times a second` : `once every ${Number((1 / rate).toFixed(1))} s`;
    const amount = style.unit === "units" ? `${state.size} units` : `${state.size}${style.unit}`;
    let line = state.size === 0
      ? `<b>${state.style}</b> at size 0 settles the decor.`
      : `<b>${state.style}</b> by ${amount}, ${every}.`;
    if (LAB_TINTS[state.tint] && state.strength > 0) line += ` Tinted ${state.tint.toLowerCase()} at ${state.strength}%.`;
    if (state.scale !== 100) line += ` Drawn at ${state.scale}% of its size.`;
    if (state.held) line += " <b>Stopped</b>: held mid-pose until it plays again.";
    say.innerHTML = line;
  };
  const sync = () => {
    for (const b of styleButtons) b.setAttribute("aria-pressed", String(b.dataset.fxStyle === state.style));
    for (const b of tintButtons) b.setAttribute("aria-pressed", String(b.dataset.fxTint === state.tint));
    size.max = String(LAB_SIZE[state.style]);
    size.value = String(state.size);
    speed.value = String(state.speed);
    $("#fx-size-v", root).textContent = STYLES[state.style].unit === "units" ? `${state.size}` : `${state.size}${STYLES[state.style].unit}`;
    $("#fx-speed-v", root).textContent = `${Number(state.speed.toFixed(2))}`;
    $("#fx-strength-v", root).textContent = `${state.strength}%`;
    $("#fx-scale-v", root).textContent = `${state.scale}%`;
    for (const input of [size, speed, strength, scale]) fill(input);
    hold.textContent = state.held ? "Play again" : "Stop";
    hold.setAttribute("aria-pressed", String(state.held));
    describe();
  };
  // A new pace keeps the animation where it is in its cycle, as in the game.
  const setSpeed = (next) => {
    if (!state.held) state.phase = keepPhase(now(), state.speed, state.phase, next);
    state.speed = next;
  };
  for (const b of styleButtons) {
    b.addEventListener("click", () => {
      state.style = b.dataset.fxStyle;
      state.size = Math.min(LAB_SIZE[state.style], { Bob: 20, Sway: 20, Throb: 20, Shake: 8, Orbit: 40 }[state.style]);
      setSpeed(STYLES[state.style].speed);
      sync();
    });
  }
  for (const b of tintButtons) b.addEventListener("click", () => { state.tint = b.dataset.fxTint; sync(); });
  size.addEventListener("input", () => { state.size = Number(size.value); sync(); });
  speed.addEventListener("input", () => { setSpeed(Number(speed.value)); sync(); });
  strength.addEventListener("input", () => { state.strength = Number(strength.value); sync(); });
  scale.addEventListener("input", () => { state.scale = Number(scale.value); sync(); });
  hold.addEventListener("click", () => {
    // Stop keeps the phase it reached; playing again carries on from there.
    const t = now();
    if (state.held) state.phase = ((state.phase - t * state.speed) % 1 + 1) % 1;
    else state.phase = ((t * state.speed + state.phase) % 1 + 1) % 1;
    state.held = !state.held;
    sync();
  });

  lab = scene($("#fx-view", root), (ctx, s, moving) => {
    const view = stage(ctx, s, 560, 280);
    floor(ctx, view, 20);
    const phase = state.held ? state.phase : s.clock * state.speed + state.phase;
    // Reduced motion holds animations still and keeps tints and sizes.
    const a = moving || state.held ? animated(state.style, state.size, phase) : { x: 0, y: 0, turn: 0, scale: 1 };
    const tint = LAB_TINTS[state.tint];
    const pose = {
      ...a,
      scale: a.scale * (state.scale / 100),
      tint: tint ? tint.map((v) => v / 255) : WHITE,
      strength: tint ? state.strength / 100 : 0,
    };
    // Cover in the group stays put: effects change only how decor looks.
    block(ctx, 60, 190, 120, 22);
    block(ctx, 400, 60, 22, 110);
    badge(ctx, 64, 194, 1);
    badge(ctx, 404, 64, 1);
    decor(ctx, "light", 150, 100, 130, 130, LANTERN, pose);
    decor(ctx, "tile", 150, 100, 26, 34, [214, 170, 92], pose);
    decor(ctx, "light", 290, 150, 110, 110, NEON, pose);
    decor(ctx, "ring", 290, 150, 50, 50, NEON, pose);
    decor(ctx, "tile", 470, 200, 70, 26, PANEL, pose);
    decor(ctx, "arrow", 470, 200, 46, 18, ARROW, pose);
    for (const [x, y] of [[134, 70], [306, 116], [436, 178]]) badge(ctx, x + pose.x, y + pose.y, 1);
    tank(ctx, 230, 236, 12, -0.4);
  });
  sync();
}

/* ---------- Launch pads ---------- */

function initLaunch() {
  const canvas = $("#launch-view");
  if (!canvas) return;
  const pad = [210, 110, 110, 90];
  const angle = -Math.PI / 4;
  const fling = [Math.cos(angle) * 900, Math.sin(angle) * 900];
  // The run, worked out once from the shared launch rule, in stage units
  // (a quarter of the game's world units).
  const path = [];
  const drive = [300, 0];
  let pos = [100, 170];
  let vel = drive.slice();
  let coast = 0;
  let launched = -1;
  for (let i = 0; i <= 300; i++) {
    const t = i / 60;
    path.push({ t, pos: pos.slice() });
    const onPad = pos[0] > pad[0] && pos[0] < pad[0] + pad[2] && pos[1] > pad[1] && pos[1] < pad[1] + pad[3];
    if (onPad) {
      const next = launch(vel, fling);
      if (next) {
        vel = next;
        coast = LAUNCH_COAST;
        if (launched < 0) launched = t;
      }
    }
    // Coasting keeps its speed; after that the driver, still holding right,
    // steers it back to its own pace.
    if (coast > 0) coast -= 1 / 60;
    else if (launched >= 0) vel = vel.map((v, i) => drive[i] + (v - drive[i]) * Math.exp(-4 / 60));
    pos = [pos[0] + (vel[0] / 60) * 0.25, pos[1] + (vel[1] / 60) * 0.25];
  }
  scene(canvas, (ctx, s, moving) => {
    const view = stage(ctx, s, 560, 280);
    floor(ctx, view, 20);
    const t = moving ? s.clock % 4 : launched + 0.3;
    const [x, y, w, hgt] = pad;
    ctx.fillStyle = rgba(LAUNCH, 0.13);
    ctx.fillRect(x, y, w, hgt);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(LAUNCH, 0.65);
    ctx.strokeRect(x, y, w, hgt);
    // scenery.rs: arrows light up one after another toward where the pad flings.
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const px = x + ((col + 0.5) / 3) * w;
        const py = y + ((row + 0.5) / 3) * hgt;
        const along = ((px - x - w / 2) * cos + (py - y - hgt / 2) * sin) / 30;
        const lit = 0.35 + 0.55 * (1 - ((((t * 1.6 - along * 0.25) % 1) + 1) % 1));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.fillStyle = rgba(LAUNCH, lit);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-1, -9);
        ctx.lineTo(-1, 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-10, -2, 9, 4);
        ctx.restore();
      }
    }
    const at = path[Math.min(path.length - 1, Math.floor(t * 60))];
    // The trail of the last half second.
    ctx.strokeStyle = rgba(LAUNCH, 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const p of path) if (p.t <= at.t && p.t > at.t - 0.5) ctx.lineTo(p.pos[0], p.pos[1]);
    ctx.stroke();
    if (launched >= 0 && t >= launched && t < launched + 0.5) {
      const k = (t - launched) / 0.5;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + hgt / 2, 20 + 50 * k, 0, TAU);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(LAUNCH, 1 - k);
      ctx.stroke();
    }
    const fade = clamp((4 - t) / 0.3, 0, 1);
    ctx.globalAlpha = fade;
    tank(ctx, at.pos[0], at.pos[1], 12, t < launched ? 0 : angle);
    ctx.globalAlpha = 1;
  });
}

/* ---------- Map sounds ---------- */

function initSounds() {
  const root = $("#fx-sounds");
  if (!root) return;
  const buffers = new Map();
  const wave = $("#fx-wave", root);
  const distance = $("#fx-distance", root);
  const volume = $("#fx-volume", root);
  const peaks = { key: "", values: [] };
  let audio = null;
  let last = null;
  const gain = () => (Number(volume.value) / 100) * falloff(Number(distance.value));
  const update = () => {
    fill(distance);
    fill(volume);
    $("#fx-distance-v", root).textContent = `${distance.value} units`;
    $("#fx-volume-v", root).textContent = `${volume.value}%`;
    $("#fx-heard", root).textContent = `Heard at ${Math.round(gain() * 100)}%`;
  };
  const samples = (name) => {
    if (!buffers.has(name)) buffers.set(name, soundSamples(name));
    return buffers.get(name);
  };
  scene(wave, (ctx, s) => {
    ctx.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
    if (!last) {
      text(ctx, "Choose a sound to hear it and see its shape", s.w / 2, s.h / 2, 12, palette.muted);
      return;
    }
    const data = samples(last);
    const columns = Math.max(1, Math.floor(s.w));
    const key = `${last}/${columns}`;
    if (peaks.key !== key) {
      // The loudest sample under each column, worked out once per sound and width.
      const step = data.length / columns;
      peaks.key = key;
      peaks.values = Array.from({ length: columns }, (_, c) => {
        let peak = 0;
        const to = Math.min(data.length, Math.floor((c + 1) * step));
        for (let i = Math.floor(c * step); i < to; i++) peak = Math.max(peak, Math.abs(data[i]));
        return peak;
      });
    }
    // The label gets its own strip at the top; the wave fills the rest.
    const top = 20;
    const middle = (s.h + top) / 2;
    const room = Math.max(4, (s.h - top) / 2 - 4);
    const level = Math.max(0.05, gain());
    ctx.strokeStyle = palette.dark ? "rgba(242,245,247,0.15)" : "rgba(51,59,69,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, middle);
    ctx.lineTo(s.w, middle);
    ctx.stroke();
    ctx.fillStyle = rgba(LOGIC, 0.85);
    peaks.values.forEach((peak, c) => {
      const half = (peak * level * room) / 0.8;
      ctx.fillRect(c, middle - half, 1, half * 2);
    });
    text(ctx, `${last} · ${(data.length / SOUND_RATE).toFixed(1)} s`, 8, 11, 11, palette.ink, "left");
  });
  for (const button of $$("[data-sound]", root.closest("section") ?? root)) {
    button.addEventListener("click", () => {
      const name = button.dataset.sound;
      if (!SOUNDS.includes(name)) return;
      last = name;
      // A palette piece plays as its trigger would, heard from close by.
      if (button.dataset.volume) {
        volume.value = button.dataset.volume;
        distance.value = "0";
        update();
      }
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        audio ??= new Context();
        audio.resume?.();
        const data = samples(name);
        const buffer = audio.createBuffer(1, data.length, SOUND_RATE);
        buffer.copyToChannel(data, 0);
        const source = audio.createBufferSource();
        const level = audio.createGain();
        level.gain.value = gain();
        source.buffer = buffer;
        source.connect(level).connect(audio.destination);
        source.start();
      } catch (error) {
        console.error("Tank Yard site: a map sound failed to play", error);
      } finally {
        for (const s of $$("[data-sound]", root)) s.setAttribute("aria-pressed", String(s.dataset.sound === name));
        refresh();
      }
    });
  }
  for (const input of [distance, volume]) {
    input.addEventListener("input", () => {
      update();
      refresh();
    });
  }
  update();
}

/* ---------- Guided combinations, using the same poses as the palette ---------- */

function initTutorial() {
  const examples = {
    float(ctx, t) {
      const enter = ease("Sine", "In and out", clamp(t, 0, 1));
      const pose = animated("Bob", 14 * enter, t * 0.6);
      decor(ctx, "light", 160, 88, 110, 110, LANTERN, pose);
      decor(ctx, "tile", 160, 88, 20, 32, [214, 170, 92], pose);
      badge(ctx, 182 + pose.x, 62 + pose.y, 1);
      text(ctx, t < 1 ? "Over 1 s: ease in" : "Bob 14 units · 0.6 cycles/s", 160, 148, 11, palette.muted);
    },
    combine(ctx, t) {
      const enter = ease("Sine", "In and out", clamp(t, 0, 1));
      const pose = animated("Bob", 14 * enter, t * 0.6);
      pose.turn = animated("Sway", 12 * enter, t * 0.5).turn;
      decor(ctx, "light", 160, 88, 110, 110, LANTERN, pose);
      decor(ctx, "tile", 160, 88, 20, 32, [214, 170, 92], pose);
      badge(ctx, 182 + pose.x, 62 + pose.y, 1);
      text(ctx, "Bob + Sway · separate animation channels", 160, 148, 11, palette.muted);
    },
    arrival(ctx, t) {
      t %= 7;
      const entry = 0.3 + 52 / 60;
      const age = t - entry;
      area(ctx, 40, 48, 62, 62, age >= 0 && age < 0.5 ? 1 - age * 2 : 0);
      arriving(ctx, t, 70, 80);
      const grow = age < 0 ? 0 : trip("Back", "Ease out", 0.4, 2, age);
      const arrival = age >= 2.8 ? age - 2.8 : age - 0.4;
      const flash = arrival < 0 ? 0 : trip("Quad", "Ease out", 0.08, 0.12, arrival);
      decor(ctx, "arrow", 205, 70, 60, 26, ARROW, { scale: 1 + 0.4 * grow });
      decor(ctx, "light", 205, 112, 54, 54, NEON, { tint: WHITE, strength: 0.9 * flash });
      badge(ctx, 235, 48, 2);
      badge(ctx, 235, 118, 3);
      text(ctx, arrival >= 0 && arrival < 0.45 ? "On arrive 2 → Chime + Flash 3" : "Enter → Grow group 2", 160, 148, 11, palette.muted);
    },
    stop(ctx, t) {
      t %= 7;
      const at = Math.min(t, 2.5);
      const enter = ease("Sine", "In and out", clamp(at, 0, 1));
      const pose = animated("Bob", 14 * enter, at * 0.6);
      pose.turn = animated("Sway", 12 * enter, at * 0.5).turn;
      decor(ctx, "light", 160, 88, 110, 110, LANTERN, pose);
      decor(ctx, "tile", 160, 88, 20, 32, [214, 170, 92], pose);
      badge(ctx, 182 + pose.x, 62 + pose.y, 1);
      text(ctx, t < 2.5 ? "Bob and Sway are running" : "Signal 1 → Stop group 1 · pose held", 160, 148, 11, palette.muted);
    },
  };
  for (const canvas of $$("[data-fx-tutorial]")) {
    const paint = examples[canvas.dataset.fxTutorial];
    if (!paint) continue;
    const demo = scene(canvas, (ctx, s, moving) => {
      const view = stage(ctx, s, 320, 170);
      floor(ctx, view, 20);
      paint(ctx, moving ? s.clock : 1.8);
    });
    const controls = canvas.closest("article");
    const replay = controls?.querySelector("[data-fx-replay]");
    const pause = controls?.querySelector("[data-fx-pause]");
    const name = pause?.getAttribute("aria-label").replace(/^Pause /, "");
    const update = () => {
      if (!pause) return;
      pause.textContent = demo.paused ? "Resume" : "Pause";
      pause.setAttribute("aria-pressed", String(demo.paused));
      pause.setAttribute("aria-label", `${demo.paused ? "Resume" : "Pause"} ${name}`);
      demo.last = 0;
      refresh();
    };
    replay?.addEventListener("click", () => { demo.clock = 0; demo.paused = false; update(); });
    pause?.addEventListener("click", () => { demo.paused = !demo.paused; update(); });
  }
}

export function initEffects() {
  if (!$("#effects")) return;
  initLab();
  initPieces();
  initLaunch();
  initSounds();
  initTutorial();
}
