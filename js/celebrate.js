// Tank Yard 2.0: the title wears a 2.0 tag, a section at the top of the page
// shows what changed, and a visitor's first look assembles a giant 2.0 out of
// the arena's own shapes and blows it apart. Reduced motion keeps the tag, the
// section and the words, and skips the movement.
import { $, $$, h, store, css, onVisible, reducedMotion } from "./util.js";
import { onChange } from "./release.js";
import { drawModel, svgModel, EXPORT_AIM } from "./models.js";

// Squares, triangles and pentagons, in the arena's colors.
const SHAPES = [
  { sides: 4, color: "#ffe869", r: 8 },
  { sides: 3, color: "#fc7677", r: 8 },
  { sides: 5, color: "#768dfc", r: 10 },
];
const OUTLINE = "#555555";

// The celebration belongs to 2.0 and its patch releases.
const milestone = (tag) => /^v?2\.0\.\d+$/.test(tag || "");

/* ---------- The burst: shapes fly in, form a 2.0, and explode ---------- */

const GATHER = 1.25; // Seconds for the shapes to fly in.
const HOLD = 2.05; // When the 2.0 blows apart.
const SECONDS = 6;

// Evenly spaced points inside the letters of `text`, centered on (0, 0).
function glyphPoints(text, width, wanted) {
  const canvas = document.createElement("canvas");
  const w = 420;
  const hgt = 210;
  canvas.width = w;
  canvas.height = hgt;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.font = `900 180px ${css("--sans") || "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, hgt / 2 + 8);
  const { data } = ctx.getImageData(0, 0, w, hgt);
  const filled = [];
  for (let y = 0; y < hgt; y += 2) {
    for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 128) filled.push([x, y]);
  }
  const step = Math.max(1, Math.floor(filled.length / wanted));
  const scale = Math.min(width * 0.8, 860) / w;
  const points = [];
  for (let i = 0; i < filled.length; i += step) {
    points.push([(filled[i][0] - w / 2) * scale, (filled[i][1] - hgt / 2) * scale]);
  }
  return points;
}

let bursting = false;

function burst() {
  if (bursting || reducedMotion.matches) return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  bursting = true;
  canvas.className = "celebration";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const scale = Math.min(devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  const fit = () => {
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  };
  fit();
  addEventListener("resize", fit);

  const small = width < 600;
  const corners = [[-30, -30], [width + 30, -30], [-30, height + 30], [width + 30, height + 30]];
  const middle = { x: width / 2, y: height * 0.46 };
  const pieces = glyphPoints("2.0", width, small ? 130 : 240).map(([x, y], i) => {
    const shape = SHAPES[i % SHAPES.length];
    const [fromX, fromY] = corners[i % 4];
    const goalX = middle.x + x;
    const goalY = middle.y + y;
    const out = Math.atan2(y, x) + (Math.random() - 0.5) * 0.7;
    const speed = Math.max(width, height) * (0.45 + Math.random() * 0.8);
    return {
      shape,
      fromX,
      fromY,
      goalX,
      goalY,
      x: fromX,
      y: fromY,
      vx: Math.cos(out) * speed,
      vy: Math.sin(out) * speed - height * 0.25,
      size: shape.r * (small ? 0.65 : 0.95) * (0.85 + Math.random() * 0.4),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 7,
      delay: Math.random() * 0.45,
      free: false,
    };
  });
  // Two poppers answer the blast from the bottom corners.
  const poppers = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < (small ? 30 : 60); i++) {
      const shape = SHAPES[i % SHAPES.length];
      const tilt = 0.12 + Math.random() * 0.62;
      const speed = height * (0.9 + Math.random() * 0.8);
      poppers.push({
        shape,
        x: side < 0 ? -10 : width + 10,
        y: height + 10,
        vx: -side * Math.sin(tilt) * speed,
        vy: -Math.cos(tilt) * speed,
        size: shape.r * (0.8 + Math.random() * 0.7),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 9,
        delay: HOLD + Math.random() * 0.3,
      });
    }
  }

  const gravity = () => height * 0.95;
  const ease = (t) => 1 - (1 - t) ** 3;
  let last = performance.now();
  let age = 0;
  function polygon(x, y, r, sides, angle) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + (i / sides) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function paint(p) {
    polygon(p.x, p.y, p.size, p.shape.sides, p.angle);
    ctx.fillStyle = p.shape.color;
    ctx.fill();
    ctx.stroke();
  }
  function fall(p, dt) {
    p.vy += gravity() * dt;
    p.vx *= 1 - 0.9 * dt;
    p.vy *= 1 - 0.35 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    age += dt;
    ctx.clearRect(0, 0, width, height);
    const fade = Math.max(0, Math.min(1, (SECONDS - age) / 1));
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.globalAlpha = fade;
    for (const p of pieces) {
      p.angle += p.spin * dt * (age < HOLD ? 0.4 : 1);
      if (age >= HOLD) {
        p.free = true;
        fall(p, dt);
        if (p.y > height + 40 && p.vy > 0) continue;
      } else {
        const t = ease(Math.max(0, Math.min(1, (age - p.delay) / GATHER)));
        // A slight shiver as it charges, just before the blast.
        const shake = Math.max(0, (age - (HOLD - 0.5)) / 0.5) * 2.5;
        p.x = p.fromX + (p.goalX - p.fromX) * t + (Math.random() - 0.5) * shake;
        p.y = p.fromY + (p.goalY - p.fromY) * t + (Math.random() - 0.5) * shake;
      }
      paint(p);
    }
    for (const p of poppers) {
      if (age < p.delay) continue;
      p.angle += p.spin * dt;
      fall(p, dt);
      if (p.y > height + 40 && p.vy > 0) continue;
      paint(p);
    }
    // The shock ring and a soft flash as it goes off.
    const since = age - HOLD;
    if (since >= 0 && since < 0.7) {
      const t = since / 0.7;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.lineWidth = 8 * (1 - t) + 1;
      ctx.strokeStyle = "#fff4c2";
      ctx.beginPath();
      ctx.arc(middle.x, middle.y, ease(t) * Math.max(width, height) * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = (1 - t) ** 2 * 0.28;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = 1;
    if (age < SECONDS) {
      requestAnimationFrame(frame);
    } else {
      removeEventListener("resize", fit);
      canvas.remove();
      bursting = false;
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- The stage: the Siege Engine warns, fires, and a tank dodges ---------- */

const CYCLE = 4.2; // Seconds from one shot to the next.
const WINDUP = 1.5; // The boss's warning, as in the game.
const FLIGHT = 0.32; // How long its round takes to cross the stage.

function startStage(tanks, bosses) {
  const canvas = $("#two-stage");
  const ctx = canvas.getContext("2d");
  const siege = bosses.bosses.find((boss) => boss.name === "Siege Engine");
  const tank = tanks.classes.find((c) => c.id === "reprisal") || tanks.classes[0];
  const escort = ["railstorm", "gatewright", "commodore"]
    .map((id) => tanks.classes.find((c) => c.id === id))
    .filter(Boolean);
  if (!ctx || !siege) return;
  let width = 0;
  let height = 0;
  const scale = () => Math.min(devicePixelRatio || 1, 2);
  const fit = () => {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    canvas.width = Math.round(width * scale());
    canvas.height = Math.round(height * scale());
    ctx.setTransform(scale(), 0, 0, scale(), 0, 0);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  let field = "";
  let lines = "";
  const readColors = () => {
    field = css("--field");
    lines = css("--grid");
  };

  function draw(time) {
    const t = time % CYCLE;
    const cycle = Math.floor(time / CYCLE);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = lines;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 26) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = 0; y <= height; y += 26) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();

    const r = Math.min(height * 0.2, width * 0.13);
    const boss = { x: width * 0.76, y: height * 0.5 };
    const size = r / 104;
    const muzzle = boss.x - r * 1.55;
    const left = width * 0.14;
    // The tank waits on the line, then slips off it just before the shot.
    const away = (cycle % 2 ? 1 : -1) * height * 0.28;
    const dodge = smooth(clamp01((t - WINDUP + 0.42) / 0.3)) * (1 - smooth(clamp01((t - WINDUP - 1.1) / 0.8)));
    const player = { x: left, y: height * 0.5 + away * dodge };

    if (t < WINDUP) {
      const p = t / WINDUP;
      const band = r * 0.46;
      ctx.fillStyle = `rgb(252 70 80 / ${0.07 + 0.16 * p})`;
      ctx.fillRect(0, boss.y - band / 2, muzzle, band);
      ctx.fillStyle = `rgb(252 70 80 / ${0.4 + 0.45 * p})`;
      ctx.fillRect(0, boss.y - band / 2 - 1, muzzle, 2);
      ctx.fillRect(0, boss.y + band / 2 - 1, muzzle, 2);
      if (p < 0.75 || Math.sin(t * 28) > 0) {
        ctx.fillStyle = `rgb(255 214 214 / ${0.3 + 0.6 * p})`;
        ctx.fillRect(0, boss.y - 1.5, muzzle, 3);
      }
    }

    // Shapes drifting in the back of the arena.
    for (let i = 0; i < 7; i++) {
      const shape = SHAPES[i % SHAPES.length];
      const x = (i * 0.137 + 0.08) * width + Math.sin(time * 0.3 + i) * 8;
      const y = ((i * 0.41 + 0.14) % 0.86 + 0.06) * height + Math.cos(time * 0.27 + i * 2) * 8;
      if (Math.abs(y - boss.y) < r * 0.36) continue;
      ctx.beginPath();
      for (let s = 0; s < shape.sides; s++) {
        const a = time * 0.3 + i + (s / shape.sides) * Math.PI * 2;
        ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      }
      ctx.closePath();
      ctx.fillStyle = shape.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }

    // Escorts hold the flanks.
    escort.forEach((model, i) => {
      const x = width * (0.1 + i * 0.13);
      const y = (i % 2 ? height * 0.14 : height * 0.86) + Math.sin(time * 0.8 + i) * 5;
      if (Math.abs(y - player.y) < 30 && Math.abs(x - player.x) < 30) return;
      drawModel(ctx, model, tanks.colors, x, y, 0.62, Math.atan2(boss.y - y, boss.x - x) - EXPORT_AIM);
    });
    drawModel(ctx, tank, tanks.colors, player.x, player.y, 0.95, Math.atan2(boss.y - player.y, boss.x - player.x) - EXPORT_AIM);
    // The exported boss faces down and to the right; turn it toward the tank.
    drawModel(ctx, siege, bosses.colors, boss.x, boss.y, size, Math.PI - EXPORT_AIM);

    if (t >= WINDUP && t < WINDUP + FLIGHT) {
      const p = (t - WINDUP) / FLIGHT;
      const x = muzzle * (1 - p);
      const slug = r * 0.3;
      // A wake that narrows and fades back toward the cannon.
      const wake = Math.min(slug * 11, muzzle - x);
      const fade = ctx.createLinearGradient(x, 0, x + wake, 0);
      fade.addColorStop(0, "rgb(252 110 70 / 0.65)");
      fade.addColorStop(1, "rgb(252 70 80 / 0)");
      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.moveTo(x, boss.y - slug * 1.25);
      ctx.lineTo(x + wake, boss.y - slug * 0.2);
      ctx.lineTo(x + wake, boss.y + slug * 0.2);
      ctx.lineTo(x, boss.y + slug * 1.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.arc(x, boss.y, slug + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x, boss.y - slug - 2, slug * 3, slug * 2 + 4);
      ctx.fillStyle = "#ff8a5c";
      ctx.beginPath();
      ctx.arc(x, boss.y, slug, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x, boss.y - slug, slug * 3, slug * 2);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x, boss.y, slug * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (t >= WINDUP + FLIGHT && t < WINDUP + FLIGHT + 0.5) {
      // It hits the far wall.
      const p = (t - WINDUP - FLIGHT) / 0.5;
      ctx.strokeStyle = `rgb(255 138 92 / ${1 - p})`;
      ctx.lineWidth = 5 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(0, boss.y, r * (0.3 + p * 1.6), -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
  }

  // Reduced motion gets one clear frame: the warning, about to fire.
  const still = () => {
    fit();
    draw(WINDUP * 0.8);
  };
  let frame = 0;
  let last = 0;
  let clock = 0;
  const tick = (now) => {
    clock += Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(clock);
    frame = requestAnimationFrame(tick);
  };
  let shown = false;
  const play = (visible) => {
    shown = visible;
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) {
      still();
    } else if (visible) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  readColors();
  still();
  addEventListener("resize", () => {
    fit();
    if (reducedMotion.matches) still();
  });
  document.addEventListener("tankyard:theme", () => {
    readColors();
    if (reducedMotion.matches) still();
  });
  reducedMotion.addEventListener?.("change", () => play(shown));
  onVisible(canvas, play);
}

/* ---------- The section ---------- */

export function initTwoPointOh(tanks, bosses) {
  const parade = $("#two-parade");
  const strip = h("div", { class: "two-strip" });
  // The strip is two copies, so the loop never shows a seam. The second
  // copy is hidden from screen readers.
  for (const copy of [0, 1]) {
    for (const boss of bosses.bosses) {
      const item = h("div", { class: "two-boss", "aria-hidden": copy ? "true" : null });
      item.insertAdjacentHTML("beforeend", svgModel(boss, bosses.colors, { pad: 8, label: copy ? "" : boss.name }));
      item.append(h("span", { text: boss.name }));
      strip.append(item);
    }
  }
  parade.replaceChildren(strip);
  const count = (id, value) => {
    const node = $(id);
    if (node) node.textContent = String(value);
  };
  count("#two-tanks", tanks.classes.length);
  count("#two-bosses", bosses.bosses.length);
  startStage(tanks, bosses);
}

export function initCelebration() {
  const tag = $("#milestone");
  const card = $("#milestone-card");
  const parts = [$("#two"), ...$$(".two-only")];
  let started = false;
  onChange(({ release }) => {
    const on = milestone(release?.tag_name);
    tag.hidden = !on;
    card.hidden = !on;
    for (const part of parts) part.hidden = !on;
    if (on) dispatchEvent(new Event("resize"));
    if (!on || started) return;
    started = true;
    if (store.get("celebrated") === "2.0") return;
    store.set("celebrated", "2.0");
    setTimeout(burst, 700);
  });
  for (const button of $$("[data-celebrate]")) button.addEventListener("click", burst);
}
