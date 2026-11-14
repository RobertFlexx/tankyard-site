// The workshop's effects, as the game computes them: animations from
// tankyard-content's tween.rs, tints from the client's scenery.rs and map
// sounds from its map_sounds.rs. tools/test_effects.mjs checks them against
// numbers taken from the game.

const TAU = Math.PI * 2;

/** The five Animate decor styles, with their size limits and default pace. */
export const STYLES = {
  Bob: { unit: "units", limit: 400, speed: 1 },
  Sway: { unit: "°", limit: 180, speed: 1 },
  Throb: { unit: "%", limit: 100, speed: 1 },
  Shake: { unit: "units", limit: 400, speed: 8 },
  Orbit: { unit: "units", limit: 400, speed: 0.5 },
};

// The game's hash works on 32-bit unsigned integers.
function hashStep(n, seed) {
  let x = ((n >>> 0) ^ Math.imul(seed, 0x2c1b3c6d)) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x297a2d39) >>> 0;
  x = (x ^ (x >>> 12)) >>> 0;
  return (x / 0xffffffff) * 2 - 1;
}

/** Smooth value noise from -1 to 1, one new value per whole `t`. */
export function noise(t, seed) {
  const step = Math.floor(t);
  let f = t - step;
  f = f * f * (3 - 2 * f);
  const a = hashStep(step, seed);
  return a + (hashStep(step + 1, seed) - a) * f;
}

/**
 * Where an animation of `style` is at `phase` cycles, scaled by `size`: an
 * offset in world units (y down), a turn in degrees and a change of scale.
 */
export function animation(style, size, phase) {
  const wave = Math.sin(phase * TAU);
  switch (style) {
    case "Bob": return { x: 0, y: -size * wave, turn: 0, grow: 0 };
    case "Sway": return { x: 0, y: 0, turn: size * wave, grow: 0 };
    case "Throb": return { x: 0, y: 0, turn: 0, grow: (size / 100) * wave };
    case "Orbit": return { x: size * Math.cos(phase * TAU), y: size * wave, turn: 0, grow: 0 };
    case "Shake": return { x: size * noise(phase, 0x9e37), y: size * noise(phase, 0x7f4a), turn: 0, grow: 0 };
    default: return { x: 0, y: 0, turn: 0, grow: 0 };
  }
}

/** The phase that keeps an animation where it is when its speed changes. */
export function keepPhase(now, speed, phase, newSpeed) {
  const cycle = now * speed + phase;
  return ((cycle - now * newSpeed) % 1 + 1) % 1;
}

/** `rgb` (0-255) with `tint` (0-1 each) mixed in at `strength` (0-1). */
export function tinted(rgb, tint, strength) {
  if (strength <= 0) return rgb.slice();
  // In 32-bit floats, as the game rounds, so colors match exactly.
  const f = Math.fround;
  const amount = f(Math.min(strength, 1));
  return rgb.map((v, i) => {
    const own = f(v / 255);
    return Math.round(f(f(own + f(f(f(tint[i]) - own) * amount)) * 255));
  });
}

/** Launch pads fling at this many units a second per unit of strength. */
export const LAUNCH_SPEED = 900;
/** Seconds a launched tank coasts before steering takes over again. */
export const LAUNCH_COAST = 0.45;

/**
 * A tank's velocity after a launch pad flings it along `fling`; null when it
 * already travels that way at most of that speed, so a pad launches once.
 */
export function launch(vel, fling) {
  const speed = Math.hypot(fling[0], fling[1]);
  if (!Number.isFinite(speed) || speed < 1) return null;
  const d = [fling[0] / speed, fling[1] / speed];
  const along = vel[0] * d[0] + vel[1] * d[1];
  if (along >= speed * 0.8) return null;
  return [vel[0] + d[0] * (speed - along), vel[1] + d[1] * (speed - along)];
}

/* ---------- Map sounds ---------- */

export const SOUNDS = ["Chime", "Bell", "Alarm", "Switch", "Whoosh", "Rumble", "Fanfare", "Thump"];
export const SOUND_RATE = 48000;
const LENGTHS = { Chime: 1.4, Bell: 2.4, Alarm: 1.5, Switch: 0.3, Whoosh: 0.8, Rumble: 1.8, Fanfare: 1.3, Thump: 0.7 };

/** How loud a sound `distance` world units away is, 0 to 1. */
export function falloff(distance) {
  const NEAR = 420, FAR = 2200;
  return Math.pow(Math.min(1, Math.max(0, 1 - (distance - NEAR) / (FAR - NEAR))), 1.6);
}

function strike(t, attack, decay) {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
}

function bell(t, pitch, decay) {
  let sum = 0;
  for (const [ratio, level] of [[1, 1], [2, 0.5], [2.76, 0.32], [4.07, 0.18], [5.4, 0.1]]) {
    sum += Math.sin(TAU * pitch * ratio * t) * level * strike(t, 0.004, decay / Math.sqrt(ratio));
  }
  return sum;
}

/** Repeatable white noise, as the game's xorshift makes it. */
function noiseSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >>> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

/** The samples of map sound `name` at 48 kHz, peaking at 0.8. */
export function soundSamples(name) {
  const seconds = LENGTHS[name];
  if (!seconds) throw new Error(`unknown sound ${name}`);
  // The game sizes the buffer in 32-bit floats; 1.3 s is one sample short.
  const count = Math.floor(Math.fround(Math.fround(seconds) * SOUND_RATE));
  const out = new Float32Array(count);
  const next = noiseSource(0x2545f491);
  let low = 0;
  let band = 0;
  for (let i = 0; i < count; i++) {
    const t = i / SOUND_RATE;
    const tail = Math.min((seconds - t) / 0.02, 1);
    let value = 0;
    switch (name) {
      case "Chime":
        value = bell(t, 784, 0.55) + bell(t - 0.13, 1046.5, 0.7);
        break;
      case "Bell":
        value = bell(t, 880, 1.3);
        break;
      case "Alarm": {
        const pitch = Math.floor(t / 0.19) % 2 === 0 ? 880 : 660;
        const envelope = Math.min(t / 0.02, 1) * Math.min(1, Math.max(0, (1.5 - t) / 0.12));
        value = Math.tanh(Math.sin(TAU * pitch * t) * 2.2) * envelope * 0.6;
        break;
      }
      case "Switch": {
        const click = next() * strike(t, 0.0005, 0.004);
        const clunk = Math.sin(TAU * 140 * t) * strike(t - 0.045, 0.002, 0.05);
        value = click * 0.7 + clunk;
        break;
      }
      case "Whoosh": {
        const shape = Math.sin((t / 0.8) * Math.PI);
        const cutoff = 0.02 + 0.25 * shape;
        low += (next() - low) * cutoff;
        band += (low - band) * 0.08;
        value = (low - band) * shape * shape;
        break;
      }
      case "Rumble": {
        low += (next() - low) * 0.012;
        const swell = Math.min(t / 0.25, 1) * Math.min(1, Math.max(0, (1.8 - t) / 1.1));
        value = (low * 6 + Math.sin(TAU * 44 * t) * 0.35) * swell;
        break;
      }
      case "Fanfare":
        for (const [start, pitch, decay] of [[0, 523.25, 0.18], [0.11, 659.25, 0.18], [0.22, 783.99, 0.75]]) {
          const u = t - start;
          let tone = 0;
          for (let n = 1; n <= 5; n++) tone += Math.sin(TAU * pitch * n * u) / n;
          value += tone * strike(u, 0.012, decay) * 0.5;
        }
        break;
      case "Thump":
        [0, 0.28].forEach((start, beat) => {
          const u = t - start;
          const pitch = 52 + 40 * Math.exp(-u / 0.03);
          value += Math.sin(TAU * pitch * u) * strike(u, 0.003, 0.09) * (beat === 0 ? 1 : 0.6);
        });
        break;
    }
    out[i] = value * tail;
  }
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  if (peak > 0) {
    const gain = 0.8 / peak;
    for (let i = 0; i < count; i++) out[i] *= gain;
  }
  return out;
}
