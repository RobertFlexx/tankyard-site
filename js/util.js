// Small helpers shared by every part of the page.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
export const lerp = (a, b, t) => a + (b - a) * t;

export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem("tankyard-" + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("tankyard-" + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

const jsonCache = new Map();
export function loadJSON(url) {
  if (!jsonCache.has(url)) {
    jsonCache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json();
      }),
    );
  }
  return jsonCache.get(url);
}

export function formatSize(bytes) {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes >= 1e3) return Math.round(bytes / 1e3) + " KB";
  return bytes + " B";
}

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (!(days >= 0)) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  return months <= 1 ? "a month ago" : `${months} months ago`;
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Colors as [r, g, b] in 0..255, mixed the way the game's ui::mix does.
export function hexRgb(hex) {
  const value = parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
export function mixHex(a, b, t) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}

export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const active = document.activeElement;
    const area = h("textarea", { readonly: true, style: { position: "fixed", left: "0", top: "0", fontSize: "16px", opacity: "0" } }, text);
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    active?.focus?.({ preventScroll: true });
    return ok;
  }
}

// Watch whether an element is on screen; returns a function to stop watching.
export function onVisible(element, callback, threshold = 0) {
  let inView = !("IntersectionObserver" in window);
  let lastEntry;
  const update = () => callback(inView && !document.hidden, lastEntry);
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        lastEntry = entry;
        inView = entry.isIntersecting;
        update();
      }
    },
    { threshold },
  ) : null;
  if (observer) observer.observe(element);
  else update();
  document.addEventListener("visibilitychange", update);
  return () => {
    observer?.disconnect();
    document.removeEventListener("visibilitychange", update);
  };
}

// The Achievement card the game shows after a first round.
const HEX = `<svg viewBox="0 0 34 38" aria-hidden="true"><path d="M17 2 32 10.5v17L17 36 2 27.5v-17Z" fill="#00b2e1" stroke="#333b45" stroke-width="2.5" stroke-linejoin="round"/><path d="m10.5 19.5 4.5 4.5 8.5-9" fill="none" stroke="#333b45" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export function toast({ kicker = "Achievement unlocked", title, text = "", action, time = 6500 }) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const card = h("div", { class: "achievement", html: HEX });
  card.append(h("small", { text: kicker }), h("strong", { text: title }));
  if (action) {
    card.append(
      h("a", {
        class: "btn small",
        href: action.href,
        text: action.label,
        onclick: () => dismiss(),
      }),
    );
  }
  if (text) card.append(h("span", { text }));
  host.append(card);
  while (host.children.length > 2) host.firstElementChild.remove();
  let timer = setTimeout(dismiss, time);
  card.addEventListener("pointerenter", () => clearTimeout(timer));
  card.addEventListener("pointerleave", () => (timer = setTimeout(dismiss, 2500)));
  function dismiss() {
    clearTimeout(timer);
    card.classList.add("leaving");
    setTimeout(() => card.remove(), 320);
  }
}

// "Copy" buttons that copy the code element just before them.
export function wireCopyButtons(root = document) {
  const pending = new WeakMap();
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-prev], [data-copy]");
    if (!button) return;
    const previous = pending.get(button);
    if (previous?.busy) return;
    clearTimeout(previous?.timer);
    const entry = { label: previous?.label ?? button.textContent, busy: true };
    pending.set(button, entry);
    const text = button.dataset.copy ?? button.previousElementSibling?.textContent ?? "";
    const ok = await copyText(text.trim());
    entry.busy = false;
    button.textContent = ok ? "Copied" : "Copy failed";
    button.classList.add("on");
    entry.timer = setTimeout(() => {
      button.textContent = entry.label;
      button.classList.remove("on");
      pending.delete(button);
    }, 1400);
  });
}

// Typing in a field must never trigger the page's game-style shortcuts.
export function typing(event) {
  const target = event.target;
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
  );
}
