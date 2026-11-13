// Tank Yard 1.0: the title wears a 1.0 tag, What's new opens with a thank-you,
// and a visitor's first look after the release bursts with the arena's own
// shapes. Reduced motion keeps the tag and the words and skips the burst.
import { $, store, reducedMotion } from "./util.js";
import { onChange } from "./release.js";

// Squares, triangles and pentagons, in the arena's colors.
const SHAPES = [
  { sides: 4, color: "#ffe869", r: 8 },
  { sides: 3, color: "#fc7677", r: 8 },
  { sides: 5, color: "#768dfc", r: 10 },
];
const OUTLINE = "#555555";
const SECONDS = 3.6;

// The celebration belongs to 1.0 and its patch releases.
const milestone = (tag) => /^v?1\.0\.\d+$/.test(tag || "");

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

  // Two poppers in the bottom corners fire up and inward.
  const pieces = [];
  const count = width < 600 ? 36 : 64;
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const shape = SHAPES[i % SHAPES.length];
      const tilt = 0.12 + Math.random() * 0.62;
      const speed = height * (0.85 + Math.random() * 0.75);
      pieces.push({
        shape,
        x: side < 0 ? -10 : width + 10,
        y: height + 10,
        vx: -side * Math.sin(tilt) * speed,
        vy: -Math.cos(tilt) * speed,
        size: shape.r * (0.8 + Math.random() * 0.7),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 9,
        delay: Math.random() * 0.3,
      });
    }
  }

  const gravity = () => height * 0.95;
  let last = performance.now();
  let age = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    age += dt;
    ctx.clearRect(0, 0, width, height);
    const fade = Math.min(1, (SECONDS - age) / 0.9);
    for (const p of pieces) {
      if (age < p.delay) continue;
      p.vy += gravity() * dt;
      p.vx *= 1 - 0.9 * dt;
      p.vy *= 1 - 0.35 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.y > height + 40 && p.vy > 0) continue;
      ctx.globalAlpha = Math.max(0, fade);
      polygon(p.x, p.y, p.size, p.shape.sides, p.angle);
      ctx.fillStyle = p.shape.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
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
  function polygon(x, y, r, sides, angle) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + (i / sides) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  requestAnimationFrame(frame);
}

export function initCelebration() {
  const tag = $("#milestone");
  const card = $("#milestone-card");
  let started = false;
  onChange(({ release }) => {
    const on = milestone(release?.tag_name);
    tag.hidden = !on;
    card.hidden = !on;
    if (!on || started) return;
    started = true;
    if (store.get("celebrated") === "1.0") return;
    store.set("celebrated", "1.0");
    setTimeout(burst, 600);
  });
  $("#celebrate").addEventListener("click", burst);
}
