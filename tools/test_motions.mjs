// Checks js/motion-math.js against numbers taken from the game. The reference
// file comes from tankyard-content's Easing::apply and a verbatim copy of the
// client's particle and flicker code; regenerate it if those change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURVES, MODES, EFFECTS, DEFAULT_EFFECT, ease, trip, hash, flicker, lightFalloff, particles } from '../js/motion-math.js';

const reference = JSON.parse(readFileSync(new URL('./motion-reference.json', import.meta.url)));
const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not ${expected}`);

// Every curve and mode, at 41 points and outside 0 to 1.
for (const curve of CURVES) {
  for (const mode of MODES) {
    const expected = reference.easing[`${curve}|${mode}`];
    assert.ok(expected, `no reference for ${curve} ${mode}`);
    const at = [...Array.from({ length: 41 }, (_, i) => i / 40), -0.25, 1.25];
    at.forEach((t, i) => near(ease(curve, mode, t), expected[i], 2e-6, `${curve} ${mode} at ${t}`));
  }
}
assert.equal(Object.keys(reference.easing).length, CURVES.length * MODES.length);
assert.equal(ease('Bounce', 'Ease out', NaN), 1, 'a broken time ends the motion, as in the game');

// Going back: out, a wait, then the same curve home; 0 stays.
assert.equal(trip('Cubic', 'Ease out', 0.5, 4, 0.5), 1);
assert.equal(trip('Cubic', 'Ease out', 0.5, 4, 4.4), 1);
near(trip('Cubic', 'Ease out', 0.5, 4, 4.75), 1 - ease('Cubic', 'Ease out', 0.5), 1e-12, 'halfway home');
assert.equal(trip('Cubic', 'Ease out', 0.5, 4, 9), 0);
assert.equal(trip('Cubic', 'Ease out', 0.5, 0, 9), 1);
assert.equal(trip('Linear', 'Ease in', 0, 1, 0.5), 1, 'Over 0 moves at once');

for (const [value, expected] of reference.hashes) assert.equal(hash(value), expected, `hash ${value}`);

for (const { amount, at, time, value } of reference.flicker) near(flicker(amount, at[0], at[1], time), value, 1e-5, `flicker ${amount}`);
assert.equal(flicker(0, 0.3, 0.3, 5), 1);
assert.equal(lightFalloff(0), 1);
assert.equal(lightFalloff(1), 0);
assert.equal(lightFalloff(1.5), 0);

const effects = {
  fountain: EFFECTS.Fountain,
  embers: EFFECTS.Embers,
  edge: { ...DEFAULT_EFFECT, area: 'Edge', drag: 0 },
  round: { ...DEFAULT_EFFECT, area: 'Round', spin: 90 },
};
for (const { name, time, seed, zoom, particles: expected } of reference.cases) {
  const actual = particles(effects[name], reference.rect, zoom, time, seed);
  assert.equal(actual.length, expected.length, `${name}: particle count`);
  actual.forEach((p, i) => {
    const e = expected[i];
    assert.equal(p.birth, e.birth, `${name}: birth order`);
    for (const key of ['x', 'y']) near(p[key], e[key], 0.01, `${name} #${e.birth} ${key}`);
    for (const key of ['radius', 'fraction', 'alpha']) near(p[key], e[key], 1e-4, `${name} #${e.birth} ${key}`);
    near(p.rotation, e.rotation, 0.01, `${name} #${e.birth} rotation`);
    near(p.heading, e.heading, 1e-5, `${name} #${e.birth} heading`);
  });
}
assert.equal(Object.keys(EFFECTS).join(), 'Embers,Rain,Dust,Sparks,Fireflies,Smoke,Snow,Glitter,Fountain,Pulse');
for (const [name, effect] of Object.entries(EFFECTS)) {
  assert.ok(effect.rate * effect.lifetime <= 240, `${name} stays within the particle budget`);
}
console.log('Easing, going back, hashing, flicker, light falloff and particles match the game.');
