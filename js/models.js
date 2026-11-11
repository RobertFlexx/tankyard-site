// Draws the game's exported vector models (see tools/build_data.py).
// A primitive is [color, "c", x, y, r] for a circle or [color, "p", x0, y0, x1, y1, ...].

export const EXPORT_AIM = -0.45;
export const CYAN = "#00b2e1";

function colorOf(prim, colors, swap) {
  const color = colors[prim[0]];
  return (swap && swap[color]) || color;
}

export function tracePrim(ctx, prim) {
  ctx.beginPath();
  if (prim[1] === "c") {
    ctx.arc(prim[2], prim[3], prim[4], 0, Math.PI * 2);
  } else {
    ctx.moveTo(prim[2], prim[3]);
    for (let i = 4; i < prim.length; i += 2) ctx.lineTo(prim[i], prim[i + 1]);
    ctx.closePath();
  }
}

// Draw a model centered at (x, y). `turn` rotates it from the exported aim.
export function drawModel(ctx, model, colors, x, y, scale, turn = 0, swap = null, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (turn) ctx.rotate(turn);
  ctx.scale(scale, scale);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  for (const prim of model.prims) {
    ctx.fillStyle = colorOf(prim, colors, swap);
    tracePrim(ctx, prim);
    ctx.fill();
  }
  ctx.restore();
}

// The game's preview_placement: fit a tank into a box without exceeding maxRadius.
export function placement(model, rect, maxRadius) {
  const [lx, ly, hx, hy] = model.box;
  const limit = model.square ? maxRadius * Math.SQRT2 : maxRadius;
  const scale = Math.max(0, Math.min(limit / model.r0, rect.w / (hx - lx), rect.h / (hy - ly)));
  return {
    x: rect.x + rect.w / 2 - ((lx + hx) / 2) * scale,
    y: rect.y + rect.h / 2 - ((ly + hy) / 2) * scale,
    scale,
  };
}

const round = (v) => Math.round(v * 100) / 100;
export function svgModel(model, colors, { pad = 4, swap = null, label = "", className = "model" } = {}) {
  const [lx, ly, hx, hy] = model.box;
  const view = [lx - pad, ly - pad, hx - lx + pad * 2, hy - ly + pad * 2].map(round).join(" ");
  const shapes = model.prims
    .map((prim) => {
      const fill = colorOf(prim, colors, swap);
      if (prim[1] === "c") return `<circle cx="${prim[2]}" cy="${prim[3]}" r="${prim[4]}" fill="${fill}"/>`;
      return `<polygon points="${prim.slice(2).join(" ")}" fill="${fill}"/>`;
    })
    .join("");
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="${view}" ${a11y}>${shapes}</svg>`;
}
