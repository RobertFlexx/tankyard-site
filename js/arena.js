// The title screen's backdrop: a small arena of shapes and four bots, faded
// behind the menu like the game's ambient arena. The menu tank aims at the
// pointer; click the yard (or press E for auto-fire) to shoot it.
import { $, clamp, reducedMotion, store, toast } from "./util.js";
import { drawModel, EXPORT_AIM, CYAN } from "./models.js";

const WORLD_W = 1500;
const WORLD_H = 1100;
const GRID = 40;
const LEVEL_XP = [
  0, 5, 16, 35, 62, 97, 141, 196, 265, 347, 444, 558, 690, 845, 1020, 1235, 1452, 1712, 2006, 2350, 2708, 3123, 3574,
  4118, 4682, 5322, 6032, 6817, 7685, 8644, 9702, 10865, 12108, 13433, 14846, 16353, 17962, 19677, 21506, 23455,
  25533, 27748, 30108, 32625, 35304, 38144, 41154, 44345, 47727, 51312, 55112, 59140, 63410, 67936, 72734,
];
// Spawn chances, sizes and rewards from the game's target table.
const KINDS = [
  { until: 0.003, name: "rare", r: 30, hp: 450, xp: 1800, sides: 7, color: "#8aeb59" },
  { until: 0.07, name: "fortress", r: 54, hp: 650, xp: 400, sides: 6, color: "#5987e6" },
  { until: 0.19, name: "pentagon", r: 33, hp: 150, xp: 130, sides: 5, color: "#768dfc" },
  { until: 0.3, name: "reinforced", r: 25, hp: 190, xp: 90, sides: 4, color: "#a3b3bf" },
  { until: 0.42, name: "mobile", r: 19, hp: 65, xp: 55, sides: 3, color: "#ff9959", moves: true },
  { until: 0.65, name: "triangle", r: 17, hp: 75, xp: 45, sides: 3, color: "#fc7677" },
  { until: 1, name: "square", r: 14, hp: 35, xp: 22, sides: 4, color: "#ffe869" },
];
const THEMES = {
  light: { world: "#c7cacb", grid: "#bbbfc1", overlay: "rgba(205,205,205,0.6)" },
  dark: { world: "#29333b", grid: "#39444f", overlay: "rgba(31,38,46,0.6)" },
};
const OUTLINE = "#555555";
const RED = "#fc7677";
const AMBER = "#ffe869";

export function initArena(models) {
  const canvas = $("#arena");
  const hero = $("#top");
  const slot = $("#tank-slot");
  const fpsLabel = $("#fps");
  const hud = $("#hud");
  const ctx = canvas.getContext("2d");
  const colors = models.colors;
  const byId = Object.fromEntries(models.classes.map((c) => [c.id, c]));
  const botClasses = ["fork", "lance", "spray", "orbit", "vector"].map((id) => byId[id]).filter(Boolean);

  let width = 0;
  let height = 0;
  let ratio = 1;
  let zoom = 1;
  let running = false;
  let frame = 0;
  let last = 0;
  let theme = THEMES[document.documentElement.dataset.theme] || THEMES.light;
  let random = mulberry(91827);

  const shapes = [];
  const bots = [];
  const bullets = [];
  const floats = [];
  const you = {
    model: byId.vector,
    aim: -0.4,
    target: null,
    cooldown: 0,
    barrel: 0,
    firing: false,
    auto: false,
    score: 0,
    level: 1,
    kills: 0,
    recoil: 0,
  };
  let pointer = null;
  let pointerSeen = 0;

  function spawnShape(fadeIn) {
    const roll = random();
    const kind = KINDS.find((k) => roll < k.until);
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 20; tries++) {
      x = 60 + random() * (WORLD_W - 120);
      y = 60 + random() * (WORLD_H - 120);
      if (shapes.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + kind.r + 30)) break;
    }
    const speed = kind.moves ? 22 : 2 + random() * 4;
    const heading = random() * Math.PI * 2;
    shapes.push({
      ...kind,
      kind: kind.name,
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      angle: random() * Math.PI * 2,
      spin: (random() - 0.5) * (kind.moves ? 0.9 : 0.35),
      health: kind.hp,
      flash: 0,
      bar: 0,
      byYou: 0,
      dying: 0,
      born: fadeIn ? 0 : 1,
    });
  }

  function spawnBot(index) {
    const model = botClasses[index % botClasses.length];
    bots.push({
      model,
      x: 200 + random() * (WORLD_W - 400),
      y: 200 + random() * (WORLD_H - 400),
      vx: 0,
      vy: 0,
      aim: random() * Math.PI * 2,
      radius: model.r0 * 1.08,
      cooldown: random(),
      barrel: 0,
      target: null,
      retarget: 0,
      wander: random() * Math.PI * 2,
    });
  }

  for (let i = 0; i < 38; i++) spawnShape(false);
  for (let i = 0; i < 4; i++) spawnBot(i);

  // Screen <-> world, with the world centered and zoomed to cover the screen.
  const toScreen = (x, y) => [width / 2 + (x - WORLD_W / 2) * zoom, height / 2 + (y - WORLD_H / 2) * zoom];
  const toWorld = (x, y) => [WORLD_W / 2 + (x - width / 2) / zoom, WORLD_H / 2 + (y - height / 2) / zoom];

  function resize() {
    ratio = Math.min(devicePixelRatio || 1, 2);
    width = document.documentElement.clientWidth;
    height = innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    zoom = Math.max(width / WORLD_W, height / WORLD_H) * 1.12;
    if (!running) draw(0);
  }

  function tankCenter() {
    const rect = slot.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  }

  function fire(owner, x, y, angle, team) {
    const barrelLength = 38;
    const twin = owner.model.id === "fork";
    let ox = 0;
    if (twin) {
      owner.barrel ^= 1;
      ox = owner.barrel ? 9 : -9;
    }
    const scale = team === "you" ? 1 : owner.radius / owner.model.r0;
    const reach = barrelLength * scale;
    const side = ox * scale;
    const bx = x + Math.cos(angle) * reach - Math.sin(angle) * side;
    const by = y + Math.sin(angle) * reach + Math.cos(angle) * side;
    const speed = team === "you" ? 420 : 190;
    bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 5.5 * (team === "you" ? 1 : scale),
      life: team === "you" ? 2.4 : 3.8,
      team,
      fade: 0,
    });
  }

  function award(shape) {
    you.score += shape.xp;
    you.kills += 1;
    floats.push({ x: shape.x, y: shape.y, text: `+${shape.xp}`, t: 0 });
    let level = 1;
    while (level < LEVEL_XP.length && LEVEL_XP[level] <= you.score) level++;
    if (you.kills === 1) {
      hud.hidden = false;
      toast({ title: "First shape", text: "Destroyed a shape from the title screen. E toggles auto-fire." });
      store.set("first-shape", true);
    }
    if (shape.name === "rare") toast({ title: "Lucky find", text: "Destroyed a rare shape. One in about three hundred." });
    if (level >= 15 && you.level < 15 && byId.fork) {
      you.model = byId.fork;
      toast({ kicker: "Level 15", title: "Twin unlocked", text: "Two cannons, alternating. The full tree is below." });
    }
    you.level = level;
    renderHud();
  }

  function renderHud() {
    const next = LEVEL_XP[you.level] ?? LEVEL_XP[LEVEL_XP.length - 1];
    const prev = LEVEL_XP[you.level - 1] ?? 0;
    const into = next > prev ? (you.score - prev) / (next - prev) : 1;
    const best = Math.max(you.score, 1);
    hud.querySelector(".score .text").textContent = `Score: ${you.score.toLocaleString("en-US")}`;
    hud.querySelector(".score .fill").style.width = `${Math.min(100, (you.score / best) * 100)}%`;
    hud.querySelector(".level .text").textContent = `Lvl ${you.level} ${you.model.name === "Basic Tank" ? "Basic Tank" : you.model.name}`;
    hud.querySelector(".level .fill").style.width = `${clamp(into, 0, 1) * 100}%`;
  }

  // The world runs at half speed like the game's menu arena; your tank doesn't.
  function step(real) {
    const dt = real * 0.5;
    const time = performance.now() / 1000;
    // Shapes drift, spin and push each other apart.
    for (const s of shapes) {
      if (s.dying) {
        s.dying += dt * 4;
        continue;
      }
      s.born = Math.min(1, s.born + dt * 2);
      if (s.moves && random() < dt * 0.4) {
        const heading = Math.atan2(s.vy, s.vx) + (random() - 0.5) * 1.6;
        s.vx = Math.cos(heading) * 22;
        s.vy = Math.sin(heading) * 22;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.angle += s.spin * dt;
      if (s.x < s.r || s.x > WORLD_W - s.r) s.vx = Math.abs(s.vx) * (s.x < s.r ? 1 : -1);
      if (s.y < s.r || s.y > WORLD_H - s.r) s.vy = Math.abs(s.vy) * (s.y < s.r ? 1 : -1);
      s.flash = Math.max(0, s.flash - dt * 6);
      s.bar = Math.max(0, s.bar - dt * 0.25);
      s.byYou = Math.max(0, s.byYou - dt * 0.25);
    }
    for (let i = 0; i < shapes.length; i++) {
      const a = shapes[i];
      if (a.dying) continue;
      for (let j = i + 1; j < shapes.length; j++) {
        const b = shapes[j];
        if (b.dying) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const gap = a.r + b.r + 4 - Math.hypot(dx, dy);
        if (gap > 0) {
          const d = Math.hypot(dx, dy) || 1;
          const push = (gap / d) * 0.5 * Math.min(1, dt * 8);
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (shapes[i].dying >= 1) {
        shapes.splice(i, 1);
        setTimeout(() => spawnShape(true), 1200 + random() * 2500);
      }
    }
    // Bots farm the nearest shape, keep their distance and wander a little.
    for (const bot of bots) {
      bot.retarget -= dt;
      if (!bot.target || bot.target.dying || bot.retarget <= 0) {
        let best = null;
        let bestScore = Infinity;
        for (const s of shapes) {
          if (s.dying) continue;
          const score = Math.hypot(s.x - bot.x, s.y - bot.y) - s.xp * 0.4;
          if (score < bestScore) {
            best = s;
            bestScore = score;
          }
        }
        bot.target = best;
        bot.retarget = 2 + random() * 2;
      }
      let ax = 0;
      let ay = 0;
      bot.wander += (random() - 0.5) * dt * 2;
      if (bot.target) {
        const dx = bot.target.x - bot.x;
        const dy = bot.target.y - bot.y;
        const d = Math.hypot(dx, dy) || 1;
        const want = d > 300 ? 1 : d < 180 ? -0.7 : 0;
        ax += (dx / d) * want;
        ay += (dy / d) * want;
        ax += Math.cos(bot.wander) * 0.45;
        ay += Math.sin(bot.wander) * 0.45;
        const goal = Math.atan2(dy, dx);
        let delta = goal - bot.aim;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        bot.aim += delta * Math.min(1, dt * 3);
        bot.cooldown -= dt;
        if (bot.cooldown <= 0 && Math.abs(delta) < 0.25 && d < 520) {
          fire(bot, bot.x, bot.y, bot.aim, "bot");
          bot.cooldown = bot.model.id === "spray" ? 0.5 : bot.model.id === "lance" ? 1.4 : 0.85;
        }
      }
      for (const other of bots) {
        if (other === bot) continue;
        const dx = bot.x - other.x;
        const dy = bot.y - other.y;
        const d = Math.hypot(dx, dy);
        if (d < 140 && d > 0) {
          ax += (dx / d) * 0.8;
          ay += (dy / d) * 0.8;
        }
      }
      const margin = 120;
      if (bot.x < margin) ax += 1;
      if (bot.x > WORLD_W - margin) ax -= 1;
      if (bot.y < margin) ay += 1;
      if (bot.y > WORLD_H - margin) ay -= 1;
      bot.vx = (bot.vx + ax * 90 * dt) * Math.pow(0.35, dt);
      bot.vy = (bot.vy + ay * 90 * dt) * Math.pow(0.35, dt);
      bot.x = clamp(bot.x + bot.vx * dt, bot.radius, WORLD_W - bot.radius);
      bot.y = clamp(bot.y + bot.vy * dt, bot.radius, WORLD_H - bot.radius);
      for (const s of shapes) {
        if (s.dying) continue;
        const dx = bot.x - s.x;
        const dy = bot.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        const gap = bot.radius + s.r - d;
        if (gap > 0) {
          bot.x += (dx / d) * gap * 0.6;
          bot.y += (dy / d) * gap * 0.6;
          s.x -= (dx / d) * gap * 0.4;
          s.y -= (dy / d) * gap * 0.4;
        }
      }
    }
    // The menu tank aims at the pointer, or idles the way it does in the game.
    const [cx, cy] = tankCenter();
    let goal = -0.4 + Math.sin(time * 0.26) * 0.16;
    if (pointer && time - pointerSeen < 6) goal = Math.atan2(pointer[1] - cy, pointer[0] - cx);
    let delta = goal - you.aim;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    you.aim += delta * Math.min(1, real * 14);
    you.cooldown -= real;
    you.recoil = Math.max(0, you.recoil - real * 6);
    if ((you.firing || you.auto) && you.cooldown <= 0 && heroVisible()) {
      const [wx, wy] = toWorld(cx, cy);
      fire(you, wx, wy, you.aim, "you");
      you.cooldown = you.model.id === "fork" ? 0.22 : 0.34;
      you.recoil = 1;
    }
    // Bullets.
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const t = b.team === "you" ? real : dt;
      if (b.fade) {
        b.fade += t * 6;
        if (b.fade >= 1) bullets.splice(i, 1);
        continue;
      }
      b.x += b.vx * t;
      b.y += b.vy * t;
      b.life -= t;
      if (b.life <= 0 || b.x < -50 || b.y < -50 || b.x > WORLD_W + 50 || b.y > WORLD_H + 50) {
        b.fade = 0.01;
        continue;
      }
      for (const s of shapes) {
        if (s.dying || s.born < 1) continue;
        if (Math.hypot(s.x - b.x, s.y - b.y) < s.r + b.r) {
          s.health -= 13;
          s.flash = 1;
          s.bar = 1;
          if (b.team === "you") s.byYou = 1;
          s.vx += (b.vx / 420) * 8;
          s.vy += (b.vy / 420) * 8;
          b.fade = 0.01;
          if (s.health <= 0) {
            s.dying = 0.01;
            if (b.team === "you") award(s);
          }
          break;
        }
      }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].t += real;
      if (floats[i].t > 1.2) floats.splice(i, 1);
    }
  }

  function polygon(x, y, r, sides, angle) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function healthBar(x, y, r, fraction, alpha) {
    const w = Math.max(r * 1.8, 28) * zoom;
    const hgt = 6 * zoom;
    const top = y + (r + 8) * zoom;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = OUTLINE;
    roundRect(x - w / 2 - 1.5, top - 1.5, w + 3, hgt + 3, (hgt + 3) / 2);
    ctx.fillStyle = AMBER;
    roundRect(x - w / 2, top, Math.max(hgt, w * clamp(fraction, 0, 1)), hgt, hgt / 2);
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function draw(dt) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = theme.world;
    ctx.fillRect(0, 0, width, height);
    // World grid, 40 units like the game.
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [x0, y0] = toWorld(0, 0);
    for (let gx = Math.floor(x0 / GRID) * GRID; gx < WORLD_W / 2 + width / zoom; gx += GRID) {
      const sx = Math.floor(toScreen(gx, 0)[0]) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let gy = Math.floor(y0 / GRID) * GRID; gy < WORLD_H / 2 + height / zoom; gy += GRID) {
      const sy = Math.floor(toScreen(0, gy)[1]) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();

    for (const s of shapes) {
      const [x, y] = toScreen(s.x, s.y);
      const grow = 1 + s.dying * 0.5;
      const alpha = s.dying ? 1 - s.dying : s.born;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = OUTLINE;
      polygon(x, y, (s.r + 2.5) * zoom * grow, s.sides, s.angle);
      ctx.fill();
      ctx.fillStyle = s.flash > 0 ? mix(s.color, "#ffffff", s.flash * 0.5) : s.color;
      polygon(x, y, s.r * zoom * grow, s.sides, s.angle);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const s of shapes) {
      if (s.bar > 0 && !s.byYou && !s.dying) {
        const [x, y] = toScreen(s.x, s.y);
        healthBar(x, y, s.r, s.health / s.hp, Math.min(1, s.bar * 3));
      }
    }
    for (const b of bullets) if (b.team === "bot") bullet(b, RED);
    for (const bot of bots) {
      const [x, y] = toScreen(bot.x, bot.y);
      drawModel(ctx, bot.model, colors, x, y, (bot.radius / bot.model.r0) * zoom, bot.aim - EXPORT_AIM, { [CYAN]: RED });
    }

    ctx.fillStyle = theme.overlay;
    ctx.fillRect(0, 0, width, height);

    // In front of the veil: your shots, what they hit, and the menu tank.
    for (const s of shapes) {
      if (s.byYou > 0 && !s.dying) {
        const [x, y] = toScreen(s.x, s.y);
        healthBar(x, y, s.r, s.health / s.hp, Math.min(1, s.byYou * 3));
      }
    }
    for (const b of bullets) if (b.team === "you") bullet(b, CYAN);
    ctx.font = `700 ${Math.round(15 * Math.max(zoom, 0.8))}px "Yard Sans", sans-serif`;
    ctx.textAlign = "center";
    for (const f of floats) {
      const [x, y] = toScreen(f.x, f.y);
      ctx.globalAlpha = clamp(1.4 - f.t, 0, 1);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#333b45";
      ctx.strokeText(f.text, x, y - f.t * 40);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(f.text, x, y - f.t * 40);
      ctx.globalAlpha = 1;
    }
    const [cx, cy] = tankCenter();
    if (cy > -40 && cy < height + 40) {
      const back = you.recoil * 2.5;
      drawModel(ctx, you.model, colors, cx - Math.cos(you.aim) * back, cy - Math.sin(you.aim) * back, 25 / 22, you.aim - EXPORT_AIM);
    }
  }

  function bullet(b, color) {
    const [x, y] = toScreen(b.x, b.y);
    const grow = 1 + b.fade * 0.6;
    ctx.globalAlpha = 1 - b.fade;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(x, y, (b.r + 2) * zoom * grow, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, b.r * zoom * grow, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Frame loop with an honest FPS readout, paused whenever nobody can see it.
  let frames = 0;
  let fpsTime = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    frames++;
    if (now - fpsTime > 500) {
      fpsLabel.textContent = Math.round((frames * 1000) / (now - fpsTime));
      frames = 0;
      fpsTime = now;
    }
    step(dt);
    draw(dt);
    frame = requestAnimationFrame(loop);
  }

  function heroVisible() {
    return hero.getBoundingClientRect().bottom > 80;
  }

  function update() {
    const visible = heroVisible();
    const want = !document.hidden && visible && !reducedMotion.matches;
    if (want && !running) {
      running = true;
      last = 0;
      fpsTime = performance.now();
      frames = 0;
      frame = requestAnimationFrame(loop);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(frame);
    }
    if (!running && visible && !document.hidden) draw(0);
    hud.style.opacity = visible && you.kills ? "1" : "0";
  }

  // Shooting: the canvas sits under the menu, so empty parts of the title
  // screen land here. Anything below the title screen is ignored.
  const inHero = (y) => y < hero.getBoundingClientRect().bottom - 10;
  canvas.addEventListener("pointerdown", (event) => {
    if (!inHero(event.clientY) || event.button > 0) return;
    pointer = [event.clientX, event.clientY];
    pointerSeen = performance.now() / 1000;
    you.firing = true;
    you.cooldown = Math.min(you.cooldown, 0);
    if (reducedMotion.matches) {
      // No animation: still answer the click with a single frame.
      const [cx, cy] = tankCenter();
      you.aim = Math.atan2(pointer[1] - cy, pointer[0] - cx);
      draw(0);
    }
  });
  addEventListener("pointerup", () => (you.firing = false));
  addEventListener("pointercancel", () => (you.firing = false));
  addEventListener("blur", () => (you.firing = false));
  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch" && !you.firing) return;
      pointer = [event.clientX, event.clientY];
      pointerSeen = performance.now() / 1000;
      canvas.classList.toggle("aiming", inHero(event.clientY) && event.target === canvas);
      if (!running && reducedMotion.matches && heroVisible() && !document.hidden) {
        const [cx, cy] = tankCenter();
        you.aim = Math.atan2(pointer[1] - cy, pointer[0] - cx);
        draw(0);
      }
    },
    { passive: true },
  );
  addEventListener("keydown", (event) => {
    if (event.key !== "e" && event.key !== "E") return;
    if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (!heroVisible() || event.repeat) return;
    you.auto = !you.auto;
    toast({ kicker: "Auto-fire", title: you.auto ? "On" : "Off", text: "Press E again to toggle.", time: 2200 });
  });

  addEventListener("resize", resize);
  addEventListener("scroll", update, { passive: true });
  document.addEventListener("visibilitychange", update);
  reducedMotion.addEventListener?.("change", update);
  document.addEventListener("tankyard:theme", (event) => {
    theme = THEMES[event.detail] || THEMES.light;
    if (!running) draw(0);
  });
  resize();
  update();
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
