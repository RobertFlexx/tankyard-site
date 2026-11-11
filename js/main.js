// Starts each part of the page. A part that fails leaves the rest working.
import { $, $$, loadJSON, wireCopyButtons, typing, clamp } from "./util.js";
import { initRelease } from "./release.js";
import { initArena } from "./arena.js";
import { initInstall } from "./install.js";
import { initWorkshop } from "./workshop.js";
import { initTree } from "./tree.js";
import { initBosses, initModes, initPractice, initControls, initServer, initMods } from "./sections.js";

function boot(name, start) {
  try {
    return start();
  } catch (error) {
    console.error(`Tank Yard site: ${name} failed to start`, error);
    return null;
  }
}

/* ---------- Theme, the same F9 toggle as the game ---------- */

const BG = { light: "#cdcdcd", dark: "#1f262e" };
function showTheme(theme) {
  const button = $("#theme");
  button.firstChild.textContent = theme === "dark" ? "Dark  " : "Light  ";
  button.setAttribute("aria-label", `Theme: ${theme}. Press F9 to switch.`);
  for (const meta of $$('meta[name="theme-color"]')) meta.content = BG[theme];
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("tankyard-theme", theme);
  } catch {
    /* storage off: the choice lasts until the page closes */
  }
  showTheme(theme);
  document.dispatchEvent(new CustomEvent("tankyard:theme", { detail: theme }));
}
const flipTheme = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
$("#theme").addEventListener("click", flipTheme);
addEventListener("keydown", (event) => {
  if (event.key !== "F9" || typing(event) || event.repeat) return;
  event.preventDefault();
  flipTheme();
});
showTheme(document.documentElement.dataset.theme);

/* ---------- Scrolling: the page fades in over the arena, the tabs follow ---------- */

const pageBg = $("#page-bg");
const tabs = $$("#tabs a");
const targets = tabs.map((tab) => document.querySelector(tab.getAttribute("href")));
let current = null;
let queued = false;
function onScroll() {
  queued = false;
  pageBg.style.opacity = String(clamp(scrollY / (innerHeight * 0.7), 0, 1));
  let found = null;
  targets.forEach((section, i) => {
    if (section && section.getBoundingClientRect().top <= 140) found = tabs[i];
  });
  // At the very bottom, the last section wins even if it's short.
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) found = tabs[tabs.length - 1];
  if (found === current) return;
  current?.removeAttribute("aria-current");
  current = found;
  if (!current) return;
  current.setAttribute("aria-current", "true");
  const bar = $("#tabs-bar");
  if (bar.scrollWidth > bar.clientWidth) {
    bar.scrollTo({ left: current.offsetLeft - (bar.clientWidth - current.offsetWidth) / 2, behavior: "smooth" });
  }
}
addEventListener(
  "scroll",
  () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(onScroll);
    }
  },
  { passive: true },
);
addEventListener("resize", onScroll);
onScroll();

wireCopyButtons();

/* ---------- Data-driven parts ---------- */

boot("release", () => initRelease().catch((error) => console.error(error)));
boot("server", initServer);
boot("mods", initMods);

const tanks = await loadJSON("data/tanks.json").catch((error) => {
  console.error(error);
  return null;
});
if (tanks) {
  boot("arena", () => initArena(tanks));
  boot("install", () => initInstall(tanks));
  boot("workshop", () => initWorkshop(tanks));
  boot("tree", () => initTree(tanks));
}

const [game, bosses, maps] = await Promise.all(
  ["data/game.json", "data/bosses.json", "data/maps.json"].map((url) =>
    loadJSON(url).catch((error) => {
      console.error(error);
      return null;
    }),
  ),
);
if (bosses) boot("bosses", () => initBosses(bosses));
if (game && maps) boot("modes", () => initModes(game, maps));
if (game && tanks) boot("practice", () => initPractice(game, tanks));
if (game) {
  boot("controls", () => initControls(game));
  $("#rust-version").textContent = game.rust;
}
if (tanks && bosses && game) {
  $("#status").textContent = `${tanks.classes.length} tanks  ·  ${bosses.bosses.length} bosses  ·  ${game.modes.length} modes`;
}

// Opened with a #section link: the sections above have filled in by now, so land there again.
if (location.hash.length > 1) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target && target !== $("#top")) target.scrollIntoView({ behavior: "instant" });
}
onScroll();
