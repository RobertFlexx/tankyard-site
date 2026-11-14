// The game's motion, light and particle math, ported from tankyard-content's
// tween.rs and the client's scenery.rs so the page moves exactly like the
// workshop. No DOM here: tools/test_motions.mjs checks it against numbers
// taken from the game itself.

export const CURVES = ["Linear", "Sine", "Quad", "Cubic", "Quart", "Quint", "Expo", "Circ", "Back", "Elastic", "Bounce"];
export const MODES = ["Ease in", "Ease out", "In and out", "Out and in"];

const TAU = Math.PI * 2;
const OVERSHOOT = 1.70158;

function bounceOut(t) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) {
    t -= 1.5 / d;
    return n * t * t + 0.75;
  }
  if (t < 2.5 / d) {
    t -= 2.25 / d;
    return n * t * t + 0.9375;
  }
  t -= 2.625 / d;
  return n * t * t + 0.984375;
}

// The curve eased in: slow at the start. Back and Elastic leave 0 to 1 on the way.
function easeIn(curve, t) {
  switch (curve) {
    case "Linear":
      return t;
    case "Sine":
      return 1 - Math.cos((t * Math.PI) / 2);
    case "Quad":
      return t * t;
    case "Cubic":
      return t * t * t;
    case "Quart":
      return t * t * t * t;
    case "Quint":
      return t * t * t * t * t;
    case "Expo":
      return t <= 0 ? 0 : 2 ** (10 * t - 10);
    case "Circ":
      return 1 - Math.sqrt(Math.max(1 - t * t, 0));
    case "Back":
      return (OVERSHOOT + 1) * t * t * t - OVERSHOOT * t * t;
    case "Elastic":
      if (t <= 0 || t >= 1) return Math.min(1, Math.max(0, t));
      return -(2 ** (10 * t - 10)) * Math.sin(((t * 10 - 10.75) * TAU) / 3);
    case "Bounce":
      return 1 - bounceOut(1 - t);
    default:
      return t;
  }
}

// Progress at `t` from 0 to 1, as Easing::apply.
export function ease(curve, mode, t) {
  if (!Number.isFinite(t)) return 1;
  t = Math.min(1, Math.max(0, t));
  const out = (x) => 1 - easeIn(curve, 1 - x);
  let value;
  switch (mode) {
    case "Ease in":
      value = easeIn(curve, t);
      break;
    case "Ease out":
      value = out(t);
      break;
    case "Out and in":
      value = t < 0.5 ? out(t * 2) * 0.5 : 0.5 + easeIn(curve, t * 2 - 1) * 0.5;
      break;
    default:
      value = t < 0.5 ? easeIn(curve, t * 2) * 0.5 : 0.5 + out(t * 2 - 1) * 0.5;
  }
  return Number.isFinite(value) ? value : t;
}

// A motion that may go back: `over` seconds out, a wait of `back` seconds,
// then the same curve home. `back` 0 stays. Returns progress at `time`.
export function trip(curve, mode, over, back, time) {
  if (time <= 0) return 0;
  const there = over > 0 ? ease(curve, mode, time / over) : 1;
  if (back <= 0 || time < over + back) return there;
  const home = time - over - back;
  return over > 0 ? 1 - ease(curve, mode, home / over) : 0;
}

/* ---------- Hashing, as scenery.rs: the same seeds draw the same particles ---------- */

export function hash(value) {
  value >>>= 0;
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return (value >>> 8) / 16777216;
}

const bits = new DataView(new ArrayBuffer(4));
function f32Bits(value) {
  bits.setFloat32(0, value);
  return bits.getUint32(0);
}
const rotateLeft = (value, by) => ((value << by) | (value >>> (32 - by))) >>> 0;

// How bright a light with `amount` of flicker is at `time`: value noise at
// nine steps a second, seeded by where the light sits.
export function flicker(amount, x, y, time) {
  if (amount <= 0) return 1;
  const seed = (f32Bits(x) ^ rotateLeft(f32Bits(y), 13)) >>> 0;
  const t = time * 9;
  const step = Math.floor(t);
  let f = t - step;
  f = f * f * (3 - 2 * f);
  const a = hash(seed ^ (step >>> 0));
  const b = hash(seed ^ ((step + 1) >>> 0));
  return 1 - amount * 0.85 * (a + (b - a) * f);
}

// The glow shader's falloff at `d`, the squared distance from the center
// as a fraction of the radius: inverse square, taken smoothly to zero.
export function lightFalloff(d) {
  const edge = Math.max(1 - d, 0);
  return edge * edge * (0.25 + 0.75 / (1 + 10 * d));
}

/* ---------- Particles ---------- */

export const DEFAULT_EFFECT = Object.freeze({
  shape: "Dot",
  rate: 8,
  lifetime: 1.6,
  speed: 60,
  direction: 270,
  spread: 50,
  gravity: 0,
  drag: 0.6,
  size: 9,
  endSize: 3,
  color: [255, 200, 90],
  endColor: [230, 90, 60],
  fade: true,
  spin: 0,
  glow: false,
  wobble: 0,
  twinkle: 0,
  area: "Fill",
});

const preset = (fields) => Object.freeze({ ...DEFAULT_EFFECT, ...fields });

// The Decor tab's ten presets, as brushes::effect_preset. An effect's area is
// Fill, Round, Edge or Point (the workshop's Center).
export const EFFECTS = Object.freeze({
  Embers: preset({ shape: "Soft", glow: true, rate: 10, speed: 50, spread: 40, gravity: -18, size: 8, endSize: 2, wobble: 24, twinkle: 0.3 }),
  Rain: preset({ shape: "Spark", direction: 90, spread: 10, speed: 260, rate: 28, color: [126, 174, 211], endColor: [103, 148, 190], size: 9, endSize: 5 }),
  Dust: preset({ shape: "Soft", speed: 18, spread: 360, rate: 5, size: 14, endSize: 22, color: [164, 156, 140], endColor: [164, 156, 140], wobble: 12 }),
  Sparks: preset({ shape: "Spark", glow: true, speed: 240, spread: 75, gravity: 170, rate: 14, lifetime: 1.2 }),
  Fireflies: preset({ shape: "Soft", glow: true, rate: 3, lifetime: 4, speed: 12, spread: 360, drag: 0.2, size: 7, endSize: 6, color: [210, 255, 120], endColor: [170, 230, 90], wobble: 40, twinkle: 0.85 }),
  Smoke: preset({ shape: "Soft", rate: 6, lifetime: 3.5, speed: 30, spread: 25, gravity: -10, drag: 0.4, size: 16, endSize: 46, color: [120, 120, 124], endColor: [168, 168, 172], wobble: 18, area: "Point" }),
  Snow: preset({ shape: "Soft", rate: 14, lifetime: 6, speed: 40, direction: 90, spread: 20, drag: 0, size: 5, endSize: 4, color: [240, 245, 255], endColor: [220, 230, 245], wobble: 30 }),
  Glitter: preset({ shape: "Star", glow: true, rate: 10, lifetime: 1.4, speed: 20, spread: 360, size: 7, endSize: 1, color: [255, 240, 170], endColor: [255, 180, 220], spin: 120, twinkle: 0.8 }),
  Fountain: preset({ rate: 30, lifetime: 1.3, speed: 300, spread: 18, gravity: 420, drag: 0.1, size: 5, endSize: 3, color: [130, 200, 255], endColor: [90, 150, 230], area: "Point" }),
  Pulse: preset({ shape: "Ring", glow: true, rate: 1.5, lifetime: 1.6, speed: 0, spread: 0, size: 6, endSize: 60, color: [120, 220, 255], endColor: [90, 140, 255], area: "Point" }),
});

// Where in `rect` ([x, y, w, h]) a particle starts, from two random fractions.
function emitPoint(area, [x, y, w, h], u, v) {
  switch (area) {
    case "Round": {
      const reach = Math.sqrt(v) * 0.5;
      return [x + w / 2 + Math.cos(u * TAU) * w * reach, y + h / 2 + Math.sin(u * TAU) * h * reach];
    }
    case "Edge": {
      const along = u * 2 * (w + h);
      if (along < w) return [x + along, y];
      if (along < w + h) return [x + w, y + along - w];
      if (along < 2 * w + h) return [x + w - (along - w - h), y + h];
      return [x, y + h - (along - 2 * w - h)];
    }
    case "Point":
      return [x + w / 2, y + h / 2];
    default:
      return [x + u * w, y + v * h];
  }
}

// Every particle alive at `time`, as scenery::particles places them: no state
// is kept, so the same time and seed always give the same picture.
export function particles(effect, rect, zoom, time, seed) {
  const list = [];
  const last = Math.floor(time * effect.rate);
  const count = Math.min(Math.ceil(effect.rate * effect.lifetime), 240);
  for (let birth = Math.max(last - count + 1, 0); birth <= last; birth++) {
    const age = time - birth / effect.rate;
    if (age < 0 || age > effect.lifetime) continue;
    const key = (Math.imul(seed >>> 0, 0x9e3779b9) + Math.imul(birth >>> 0, 37)) >>> 0;
    const random = (n) => hash(key + n);
    const angle = ((effect.direction + (random(0) - 0.5) * effect.spread) * Math.PI) / 180;
    const speed = effect.speed * (0.65 + 0.35 * random(1));
    const displacement = effect.drag > 0.001 ? -Math.expm1(-effect.drag * age) / effect.drag : age;
    const hx = Math.cos(angle);
    const hy = Math.sin(angle);
    const [sx, sy] = emitPoint(effect.area, rect, random(2), random(3));
    let x = sx + hx * speed * displacement * zoom;
    let y = sy + hy * speed * displacement * zoom + effect.gravity * age * age * 0.5 * zoom;
    if (effect.wobble > 0) {
      // Sway across the direction of travel, starting from the origin.
      const phase = random(5) * TAU;
      const rate = TAU * (0.4 + 0.8 * random(6));
      const sway = Math.sin(age * rate + phase) - Math.sin(phase);
      x += -hy * effect.wobble * 0.5 * sway * zoom;
      y += hx * effect.wobble * 0.5 * sway * zoom;
    }
    const fraction = age / effect.lifetime;
    const radius = (effect.size + (effect.endSize - effect.size) * fraction) * zoom;
    if (radius < 0.4) continue;
    let shimmer = 1;
    if (effect.twinkle > 0) {
      const rate = TAU * (1.2 + 2 * random(7));
      shimmer = 1 - effect.twinkle * (0.5 + 0.5 * Math.sin(age * rate + random(8) * TAU));
    }
    const fade = effect.fade ? Math.min(1, Math.max(0, Math.min(1 - fraction, age * 10))) : 1;
    list.push({
      birth,
      x,
      y,
      radius,
      fraction,
      alpha: fade * shimmer,
      rotation: random(4) * 360 + effect.spin * age,
      heading: angle,
    });
  }
  return list;
}
