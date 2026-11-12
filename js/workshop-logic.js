// A deliberately small, local demonstration of the workshop's lever gates.
// The game runs its full signal/counter engine; this preview connects two
// levers directly to each demo gate so it can be tried without a server.
export const LOGIC = ["Plate", "Timer", "Exit pad", "Start", "Sender", "Receiver", "Counter", "Goal", "Shapes", "Boss", "Capture", "Bonus", "Medic", "Trap", "Script"];
export const GATES = ["Gate", "AND", "OR", "XOR", "If/else", "Lever", "Coin flip", "Dice", "Sequence", "Display", "Alarm", "Reward", "Reset", "Rearm", "Crowd", "Clock"];
export const DEMO_GATES = new Set(["and", "or", "xor"]);

export function gateOpen(type, counters) {
  const left = (counters[0] || 0) >= 1;
  const right = (counters[1] || 0) >= 1;
  if (type === "and") return left && right;
  if (type === "or") return left || right;
  if (type === "xor") return left !== right;
  return false;
}

export function logicState() {
  return { counters: Array(8).fill(0), gateHidden: new Set(), insideLogic: new Set(), leverRest: new Map() };
}

export function stepLogic(objects, state, now) {
  const inside = (o) => state.x >= o.x && state.y >= o.y && state.x <= o.x + o.w && state.y <= o.y + o.h;
  const entered = new Set();
  let changed = false;
  for (const o of objects) {
    if (o.kind !== "logic" || !inside(o) || (o.type !== "plate" && o.type !== "lever")) continue;
    entered.add(o);
    if (state.insideLogic.has(o)) continue;
    if (o.type === "plate") state.hidden[o.group] = now + 5;
    else if (now >= (state.leverRest.get(o) || 0)) {
      const slot = Math.max(0, Math.min(7, (o.counter || 1) - 1));
      state.counters[slot] = state.counters[slot] ? 0 : 1;
      state.leverRest.set(o, now + 1);
      changed = true;
    }
  }
  state.insideLogic = entered;
  if (changed) {
    for (const o of objects) {
      if (o.kind !== "logic" || !DEMO_GATES.has(o.type)) continue;
      if (gateOpen(o.type, state.counters)) state.gateHidden.add(o.group);
      else state.gateHidden.delete(o.group);
    }
  }
  return changed;
}

export function vaultDemo() {
  const block = (x, y, w, h, group = 0) => ({ kind: "block", style: "slate", x, y, w, h, group });
  return [
    { kind: "marker", type: "spawn", x: 80, y: 640, w: 120, h: 80 },
    block(440, 120, 40, 240), block(720, 120, 40, 240), block(480, 120, 240, 40),
    block(480, 320, 240, 40, 1),
    { kind: "logic", type: "lever", counter: 1, group: 0, x: 280, y: 480, w: 120, h: 120 },
    { kind: "logic", type: "lever", counter: 2, group: 0, x: 800, y: 480, w: 120, h: 120 },
    { kind: "logic", type: "and", group: 1, x: 560, y: 440, w: 80, h: 80 },
  ];
}
