// Checks js/effect-math.js against numbers taken from the game. The reference
// file comes from tankyard-content's GroupPoses, the client's tint code and
// its map sound synthesiser; regenerate it if those change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STYLES, SOUNDS, SOUND_RATE, animation, keepPhase, tinted, launch, falloff, soundSamples } from '../js/effect-math.js';

const reference = JSON.parse(readFileSync(new URL('./effect-reference.json', import.meta.url)));
const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not ${expected}`);

// Every style at several sizes, speeds and times. The game works in 32-bit
// floats, so long-running phases differ in the last few places.
for (const a of reference.animations) {
  const pose = animation(a.style, a.size, a.now * a.speed + a.phase);
  const what = `${a.style} ${a.size} at ${a.now}`;
  const tolerance = 1e-3 * Math.max(1, a.size) * Math.max(1, a.now * a.speed);
  near(pose.x, a.x, tolerance, `${what} x`);
  near(pose.y, a.y, tolerance, `${what} y`);
  near(pose.turn, a.turn, tolerance, `${what} turn`);
  near(Math.min(8, Math.max(0, 1 + pose.grow)), a.scale, 1e-4 * Math.max(1, a.now * a.speed), `${what} scale`);
}
assert.equal(reference.animations.length, Object.keys(STYLES).length * 5);

// Changing pace keeps an animation where it is in its cycle.
for (const [now, speed, phase, next] of [[3.2, 0.5, 0.1, 2], [40, 9, 0.7, 0.25], [0, 1, 0.3, 4]]) {
  const before = (now * speed + phase) % 1;
  const after = (now * next + keepPhase(now, speed, phase, next)) % 1;
  near(Math.min(Math.abs(before - after), 1 - Math.abs(before - after)), 0, 1e-9, `phase kept at ${now}`);
}

for (const { rgb, tint, strength, out } of reference.tints) {
  assert.deepEqual(tinted(rgb, tint, strength), out, `tint ${rgb} by ${tint} at ${strength}`);
}

// A launch adds the missing speed along the pad and keeps sideways motion.
assert.deepEqual(launch([50, 0], [0, 900]), [50, 900]);
assert.equal(launch([0, 800], [0, 900]), null, 'already flying that way');
assert.equal(launch([0, 0], [0, 0]), null);

for (const [distance, value] of reference.falloff) near(falloff(distance), value, 1e-6, `falloff at ${distance}`);

assert.deepEqual([...SOUNDS].sort(), Object.keys(reference.sounds).sort());
for (const name of SOUNDS) {
  const samples = soundSamples(name);
  const expected = reference.sounds[name];
  assert.equal(samples.length, expected.length, `${name} length`);
  expected.every997.forEach((value, i) => near(samples[i * 997], value, 2e-3, `${name} sample ${i * 997}`));
  assert.ok(samples.length / SOUND_RATE < 3, `${name} is short`);
}
console.log(`effects: ${reference.animations.length} poses, ${reference.tints.length} tints, ${SOUNDS.length} sounds match the game`);
