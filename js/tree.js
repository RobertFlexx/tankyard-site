// The tank tree page, ported from tank_tree.rs. The layout itself comes
// precomputed from tank_tree_layout.rs by tools/build_data.py.
import { $, h, clamp, css, mixHex, onVisible, store } from "./util.js";
import { drawModel, placement, svgModel } from "./models.js";

const COLUMN = 124;
const CARD_W = 108;
const CARD_H = 74;
const CARD_COLORS = ["#00b2e1", "#a8f075", "#fc7677", "#bf7ff5", "#ffe869"];
const SHARES = [0.3, 0.5, 0.7, 0.4, 0.6];
const ABILITY = { CounterParry: "Counter", VolleyParry: "Reprisal", Stasis: "Stasis wave" };

export function initTree(data) {
  const view = $("#tree-view");
  const canvas = $("#tree");
  const ctx = canvas.getContext("2d");
  const detail = $("#tree-detail");
  const search = $("#tree-search");
  const found = $("#tree-found");
  const { classes, colors, layout } = data;
  const index = Object.fromEntries(classes.map((c, i) => [c.id, i]));
  const parents = classes.map(() => []);
  const children = classes.map(() => []);
  for (const [p, c] of layout.edges) {
    parents[c].push(p);
    children[p].push(c);
  }
  $("#tank-count").textContent = `${classes.length} tanks`;

  let width = 0;
  let height = 0;
  let ratio = 1;
  let zoom = 0;
  let pan = [0, 0];
  let selected = clamp(store.get("tank", 0) | 0, 0, classes.length - 1);
  let hovered = -1;
  let dragging = null;
  let active = false;
  let dirty = true;
  let frame = 0;
  let visible = false;
  let matches = new Set();
  let anim = null;
  const pointers = new Map();

  const vertical = (z) => Math.max(z, height / (layout.height + 100));
  const origin = () => [width / 2 + pan[0], height / 2 + pan[1]];
  const point = (i) => {
    const [ox, oy] = origin();
    const [x, y] = layout.nodes[i];
    return [ox + x * zoom, oy + y * vertical(zoom)];
  };

  function fitAll() {
    zoom = clamp(Math.min(width / (layout.width + 100), height / (layout.height + 80)), 0.055, 1.2);
    pan = [0, -layout.height * vertical(zoom) * 0.5 + 40 * vertical(zoom)];
    dirty = true;
  }
  function focus(i, smooth = true) {
    const targetZoom = clamp(width < 600 ? 0.7 : 1, 0.2, 2);
    const vz = Math.max(targetZoom, height / (layout.height + 100));
    const goal = [-layout.nodes[i][0] * targetZoom, -layout.nodes[i][1] * vz];
    if (!smooth) {
      zoom = targetZoom;
      pan = goal;
      dirty = true;
      return;
    }
    anim = { from: [zoom, ...pan], to: [targetZoom, ...goal], t: 0 };
    dirty = true;
  }
  function clampPan() {
    const range = [layout.width * zoom * 0.5 + width * 0.4, layout.height * vertical(zoom) + height * 0.4];
    pan[0] = clamp(pan[0], -range[0], range[0]);
    pan[1] = clamp(pan[1], -range[1], height * 0.4);
  }

  function resize() {
    const rect = view.getBoundingClientRect();
    if (!rect.width) return;
    const first = !width;
    width = rect.width;
    height = rect.height;
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    if (first) fitAll();
    dirty = true;
  }

  function lineage() {
    const set = new Set();
    const pending = [selected];
    while (pending.length) {
      const node = pending.pop();
      if (set.has(node)) continue;
      set.add(node);
      pending.push(...parents[node]);
    }
    return set;
  }

  function fitted(text, size, max) {
    ctx.font = `700 ${size}px "Yard Sans", sans-serif`;
    if (ctx.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + "…").width > max) cut = cut.slice(0, -1);
    return cut + "…";
  }

  function draw() {
    const line = css("--line");
    const accent = css("--accent");
    const surface = css("--surface");
    const muted = css("--muted");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const vz = vertical(zoom);
    const [ox, oy] = origin();
    const halfW = CARD_W * 0.5 * zoom;
    const halfH = CARD_H * 0.5 * zoom;
    const gutter = COLUMN * 0.5 * zoom;
    const family = lineage();
    const next = new Set(children[selected]);
    // Faint wires first, highlighted ones on top.
    for (let pass = 0; pass < 2; pass++) {
      for (const [a, b] of layout.edges) {
        const highlighted = (family.has(a) && family.has(b)) || a === selected;
        if (highlighted !== (pass === 1)) continue;
        const [ax, ay] = point(a);
        const [bx, by] = point(b);
        const parentFloor = oy + layout.tiers[layout.band[a]][1] * vz + halfH;
        const childRoof = oy + layout.tiers[layout.band[b]][0] * vz - halfH;
        const bus = parentFloor + (childRoof - parentFloor) * SHARES[layout.lane[a] % 5];
        const path = layout.blocked[a]
          ? [[ax + halfW, ay], [ax + gutter, ay], [ax + gutter, bus]]
          : [[ax, ay + halfH], [ax, bus]];
        if (layout.covered[b]) path.push([bx - gutter, bus], [bx - gutter, by], [bx - halfW, by]);
        else path.push([bx, bus], [bx, by - halfH]);
        ctx.strokeStyle = highlighted ? accent : line;
        ctx.globalAlpha = highlighted ? 1 : 0.55;
        ctx.lineWidth = highlighted ? 2.2 : Math.max(0.65, Math.min(1, zoom * 1.4));
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (const [x, y] of path.slice(1)) ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    const size = 13 * zoom;
    for (let i = 0; i < classes.length; i++) {
      const [cx, cy] = point(i);
      const x = cx - halfW;
      const y = cy - halfH;
      if (x > width || y > height || x + CARD_W * zoom < 0 || y + CARD_H * zoom < 0) continue;
      const related = family.has(i) || next.has(i);
      const dim = matches.size && !matches.has(i);
      ctx.globalAlpha = dim ? 0.3 : 1;
      ctx.fillStyle = mixHex(CARD_COLORS[i % 5], "#ffffff", hovered === i ? 0.3 : 0.12);
      ctx.fillRect(x, y, CARD_W * zoom, CARD_H * zoom);
      const border = selected === i ? 3 : related ? 1.8 : Math.max(zoom, 0.7);
      ctx.strokeStyle = related || matches.has(i) ? accent : line;
      ctx.lineWidth = border;
      ctx.strokeRect(x + border / 2, y + border / 2, CARD_W * zoom - border, CARD_H * zoom - border);
      const box = {
        x: x + 8 * zoom,
        y: y + 5 * zoom,
        w: CARD_W * zoom - 16 * zoom,
        h: CARD_H * zoom - (size >= 6.5 ? 23 * zoom : 10 * zoom),
      };
      const place = placement(classes[i], box, 18 * zoom);
      drawModel(ctx, classes[i], colors, place.x, place.y, place.scale);
      if (size >= 6.5) {
        const text = fitted(classes[i].name, size, CARD_W * zoom - 6 * zoom);
        ctx.fillStyle = "#1f262e";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(text, cx, y + CARD_H * zoom - 8 * zoom);
      }
      ctx.globalAlpha = 1;
    }
    // Level requirements stay pinned to the left edge while panning.
    layout.tiers.forEach(([row, , level], tier) => {
      const y = oy + row * vz - halfH - 7;
      if (y < 12 || y > height - 4) return;
      const text = `TIER ${tier + 1} · LV ${level}`;
      ctx.font = '700 10px "Yard Sans", sans-serif';
      const w = ctx.measureText(text).width + 12;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = surface;
      ctx.fillRect(8, y - 10, w, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.textAlign = "left";
      ctx.fillText(text, 14, y + 1);
    });
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);
    if (anim) {
      anim.t = Math.min(1, anim.t + 1 / 22);
      const e = 1 - Math.pow(1 - anim.t, 3);
      zoom = anim.from[0] + (anim.to[0] - anim.from[0]) * e;
      pan = [anim.from[1] + (anim.to[1] - anim.from[1]) * e, anim.from[2] + (anim.to[2] - anim.from[2]) * e];
      if (anim.t >= 1) anim = null;
      dirty = true;
    }
    if (dirty) {
      clampPan();
      draw();
      dirty = false;
    }
  }

  function cardAt(x, y) {
    for (let i = 0; i < classes.length; i++) {
      const [cx, cy] = point(i);
      if (Math.abs(x - cx) <= (CARD_W / 2) * zoom && Math.abs(y - cy) <= (CARD_H / 2) * zoom) return i;
    }
    return -1;
  }

  function select(i, { scroll = false } = {}) {
    selected = i;
    store.set("tank", i);
    renderDetail();
    if (scroll) focus(i);
    dirty = true;
  }

  function renderDetail() {
    const c = classes[selected];
    detail.innerHTML = "";
    detail.append(
      h("h3", { text: c.name }),
      h("div", { class: "tier", text: `TIER ${c.tier + 1} · LEVEL ${c.level}` }),
    );
    detail.insertAdjacentHTML("beforeend", svgModel(c, colors, { pad: 4, label: c.name }));
    detail.append(h("p", { class: "desc", text: c.description }));
    for (const [title, links] of [
      ["Upgrades to", children[selected]],
      ["Upgrades from", parents[selected]],
    ]) {
      if (!links.length) continue;
      detail.append(h("span", { class: "label accent", text: title }));
      const chips = h("div", { class: "chips" });
      for (const target of links) {
        chips.append(h("button", { class: "btn small", type: "button", text: classes[target].name, onclick: () => select(target, { scroll: true }) }));
      }
      detail.append(chips);
    }
    detail.append(
      h("span", { class: "label accent", text: "Strengths" }),
      h("p", { class: "text", text: c.strengths }),
      h("span", { class: "label warm", text: "Tradeoffs" }),
      h("p", { class: "text", text: c.weaknesses }),
    );
    if (c.ability && c.ability !== "None") {
      detail.append(h("div", { class: "ability", text: `Ability: ${ABILITY[c.ability] || c.ability} · ${Math.round(c.cooldown)}s` }));
    }
  }

  /* ----- Input ----- */
  const local = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  function zoomAt(factor, x, y) {
    const old = zoom;
    const oldV = vertical(old);
    zoom = clamp(zoom * factor, 0.05, 2.4);
    const anchor = [x - width / 2, y - height / 2];
    pan = [anchor[0] - (anchor[0] - pan[0]) * (zoom / old), anchor[1] - (anchor[1] - pan[1]) * (vertical(zoom) / oldV)];
    anim = null;
    dirty = true;
  }
  function setActive(on) {
    active = on;
    view.classList.toggle("active", on);
    $("#tree-help").textContent = on
      ? "Scroll to zoom · drag to explore · select a tank"
      : matchMedia("(hover: none)").matches
        ? "Tap a tank · drag sideways to explore · pinch to zoom"
        : "Click to explore, then scroll to zoom · drag to pan · select a tank";
  }
  canvas.addEventListener("pointerdown", (event) => {
    setActive(true);
    const [x, y] = local(event);
    pointers.set(event.pointerId, [x, y]);
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      dragging = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom };
      return;
    }
    dragging = { start: [x, y], last: [x, y], moved: false, card: cardAt(x, y) };
  });
  canvas.addEventListener("pointermove", (event) => {
    const [x, y] = local(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, [x, y]);
    if (dragging?.pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt((dragging.zoom * (d / dragging.pinch)) / zoom, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      return;
    }
    if (dragging && !dragging.pinch) {
      if (Math.hypot(x - dragging.start[0], y - dragging.start[1]) > 4) dragging.moved = true;
      if (dragging.moved) {
        pan = [pan[0] + x - dragging.last[0], pan[1] + y - dragging.last[1]];
        anim = null;
        canvas.classList.add("dragging");
        dirty = true;
      }
      dragging.last = [x, y];
      return;
    }
    const over = cardAt(x, y);
    if (over !== hovered) {
      hovered = over;
      canvas.classList.toggle("on-card", over >= 0);
      canvas.title = over >= 0 ? classes[over].name : "";
      dirty = true;
    }
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    if (dragging && !dragging.pinch && !dragging.moved && dragging.card >= 0) select(dragging.card);
    if (pointers.size < 2 && dragging?.pinch) dragging = null;
    if (!pointers.size) dragging = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", () => {
    if (hovered >= 0) {
      hovered = -1;
      dirty = true;
    }
  });
  view.addEventListener("pointerleave", () => setActive(false));
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!active) return;
      event.preventDefault();
      const [x, y] = local(event);
      const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
      zoomAt(Math.exp(-delta * 0.0012), x, y);
    },
    { passive: false },
  );
  $("#tree-fit").addEventListener("click", () => {
    anim = null;
    fitAll();
  });
  $("#tree-focus").addEventListener("click", () => focus(selected));

  function find(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = classes
      .map((c, i) => [i, c.name.toLowerCase().startsWith(q) ? 0 : c.name.toLowerCase().includes(q) ? 1 : c.description.toLowerCase().includes(q) ? 2 : 9])
      .filter(([, s]) => s < 9)
      .sort((a, b) => a[1] - b[1]);
    return scored.map(([i]) => i);
  }
  search.addEventListener("input", () => {
    const hits = find(search.value);
    matches = new Set(hits);
    found.textContent = search.value.trim() ? (hits.length ? `${hits.length} found` : "No tank by that name") : "";
    if (hits.length) select(hits[0], { scroll: true });
    dirty = true;
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      search.value = "";
      matches = new Set();
      found.textContent = "";
      dirty = true;
    }
  });

  onVisible(view, (isVisible) => {
    visible = isVisible;
    cancelAnimationFrame(frame);
    if (visible) {
      dirty = true;
      frame = requestAnimationFrame(loop);
    }
  });
  new ResizeObserver(resize).observe(view);
  document.addEventListener("tankyard:theme", () => (dirty = true));
  document.fonts?.ready.then(() => (dirty = true));
  setActive(false);
  resize();
  renderDetail();
  if (selected) focus(selected, false);
  return { select: (id) => index[id] != null && select(index[id], { scroll: true }) };
}
