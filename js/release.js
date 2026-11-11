// The latest release, the visitor's system, and every place the page offers a download.
import { $, h, store, loadJSON, formatSize, formatDate, timeAgo, toast, copyText } from "./util.js";
import { renderMarkdown } from "./markdown.js";

export const REPO = "RobertFlexx/tankyard";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

export const PACKAGES = [
  { key: "windows-setup", os: "windows", pattern: /windows-x86_64-setup\.exe$/, kind: "Setup", arch: "x64", method: "setup" },
  { key: "windows-zip", os: "windows", pattern: /windows-x86_64\.zip$/, kind: "Portable ZIP", arch: "x64", method: "zip" },
  { key: "mac-pkg", os: "mac", pattern: /macos-universal\.pkg$/, kind: "Installer", arch: "Universal", method: "pkg" },
  { key: "mac-tar", os: "mac", pattern: /macos-universal\.tar\.gz$/, kind: "Archive", arch: "Universal", method: "archive" },
  { key: "linux-x64", os: "linux", pattern: /linux-x86_64\.tar\.gz$/, kind: "Archive", arch: "x86-64", method: "archive" },
  { key: "linux-arm", os: "linux", pattern: /linux-aarch64\.tar\.gz$/, kind: "Archive", arch: "ARM64", method: "archive" },
];
export const OS_NAMES = { windows: "Windows", mac: "macOS", linux: "Linux" };

const listeners = new Set();
export const state = {
  release: null,
  source: "snapshot",
  system: { os: null, arch: null, label: "", mobile: false },
  picked: null,
};
export function onChange(callback) {
  listeners.add(callback);
  if (state.release) callback(state);
}
function emit() {
  for (const callback of listeners) callback(state);
}

export function asset(key, release = state.release) {
  const pkg = PACKAGES.find((p) => p.key === key);
  return pkg && release?.assets.find((a) => pkg.pattern.test(a.name));
}

export function defaultPackage(system = state.system) {
  if (system.os === "windows") return "windows-setup";
  if (system.os === "mac") return "mac-pkg";
  if (system.os === "linux") return system.arch === "arm" ? "linux-arm" : "linux-x64";
  return null;
}

// What the browser tells us about the computer. The architecture only comes
// from Chromium's client hints; other browsers report it in the user agent.
export async function detectSystem() {
  const ua = navigator.userAgent;
  const data = navigator.userAgentData;
  let os = null;
  let arch = null;
  let version = "";
  let mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || data?.mobile === true;
  const platform = data?.platform || "";
  // ChromeOS keeps "CrOS" in even a reduced user agent, so it goes first.
  if (/Chrome OS|ChromeOS/i.test(platform) || /CrOS/.test(ua)) os = "chromeos";
  else if (/Windows/i.test(platform) || /Windows NT/.test(ua)) os = "windows";
  else if (/Android/i.test(platform) || /Android/.test(ua)) os = "android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "ios";
  else if (/macOS/i.test(platform) || /Macintosh|Mac OS X/.test(ua)) {
    os = "mac";
    if (navigator.maxTouchPoints > 1) {
      os = "ios";
      mobile = true;
    }
  } else if (/Linux/i.test(platform) || /Linux|X11/.test(ua)) os = "linux";
  if (/aarch64|arm64|armv8/i.test(ua)) arch = "arm";
  else if (/x86_64|x64|Win64|WOW64|amd64/i.test(ua)) arch = "x86";
  if (data?.getHighEntropyValues) {
    try {
      const hints = await data.getHighEntropyValues(["architecture", "bitness", "platformVersion"]);
      // A user agent that names ARM outright isn't a reduced one; trust it.
      if (hints.architecture && arch !== "arm") arch = hints.architecture === "arm" ? "arm" : "x86";
      if (os === "windows" && hints.platformVersion) {
        version = parseInt(hints.platformVersion, 10) >= 13 ? "11" : "10";
      }
    } catch {
      /* hints refused: keep the user agent's answer */
    }
  }
  if (os === "android" || os === "ios") mobile = true;
  if (os === "chromeos") os = "linux";
  const label = mobile
    ? "Phone or tablet"
    : os === "windows"
      ? `Windows${version ? " " + version : ""}`
      : os === "mac"
        ? "macOS"
        : os === "linux"
          ? /CrOS/.test(ua)
            ? "ChromeOS (Linux)"
            : "Linux"
          : "Your computer";
  return { os: mobile ? null : os, arch, label, mobile };
}

function trim(release) {
  return {
    tag_name: release.tag_name,
    name: release.name,
    published_at: release.published_at,
    html_url: release.html_url,
    body: release.body || "",
    assets: (release.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      digest: a.digest || null,
      browser_download_url: a.browser_download_url,
    })),
  };
}

// Every visit asks GitHub, so a new release shows up as soon as it's
// published (GitHub lets browsers reuse an answer for a minute). If GitHub
// can't be reached or the hourly rate limit is used up, the newer of this
// browser's last answer and the site's own copy stands in.
async function fetchRelease() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(String(response.status));
    const data = trim(await response.json());
    store.set("release", { time: Date.now(), data });
    return { data, source: "live" };
  } catch {
    const cached = store.get("release")?.data;
    const snapshot = await loadJSON("data/release.json").then(trim, () => null);
    const options = [cached, snapshot].filter((release) => release?.assets?.length);
    if (!options.length) throw new Error("no release data");
    options.sort((a, b) => b.published_at.localeCompare(a.published_at));
    return { data: options[0], source: options[0] === cached ? "cached" : "snapshot" };
  }
}

// The site's copy also carries the notes of the releases before the latest one.
async function earlierReleases(latest) {
  const snapshot = await loadJSON("data/release.json").catch(() => null);
  if (!snapshot) return [];
  const seen = new Set([latest.tag_name]);
  return [snapshot, ...(snapshot.earlier || [])]
    .filter((release) => release.published_at < latest.published_at && !seen.has(release.tag_name) && seen.add(release.tag_name))
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, 5);
}

// The first plain sentence of the notes: what the release is about.
function summaryOf(release) {
  const line = (release.body || "")
    .split("\n")
    .map((text) => text.trim())
    .find((text) => text && !/^(#|-|\*|\d+\.|```|>)/.test(text));
  return line ? line.replace(/\*\*|`|\[|\]\([^)]*\)/g, "") : "";
}

// Visitors who have been here before hear about a newer release once.
function announce() {
  const { release } = state;
  const seen = store.get("seen-release");
  if (seen?.published_at && release.published_at > seen.published_at) {
    const text = summaryOf(release);
    setTimeout(
      () =>
        toast({
          kicker: "New release",
          title: `Tank Yard ${release.tag_name}`,
          text: text.length > 120 ? text.slice(0, 117).replace(/\s+\S*$/, "") + "…" : text,
          action: { href: "#whats-new", label: "What's new ›" },
          time: 10000,
        }),
      1200,
    );
  }
  if (!seen?.published_at || release.published_at > seen.published_at) {
    store.set("seen-release", { tag: release.tag_name, published_at: release.published_at });
  }
}

export async function initRelease() {
  const [system, result] = await Promise.all([detectSystem(), fetchRelease().catch(() => null)]);
  state.system = system;
  state.picked = defaultPackage(system);
  if (!result) {
    $("#platform-name").textContent = system.label;
    $("#platform-meta").textContent = "Downloads on GitHub";
    return;
  }
  state.release = result.data;
  state.source = result.source;
  renderHero();
  renderNews();
  emit();
  announce();
}

function packageLabel(key) {
  const pkg = PACKAGES.find((p) => p.key === key);
  const file = asset(key);
  return { pkg, file, text: `${pkg.kind} · ${pkg.arch}${file ? " · " + formatSize(file.size) : ""}` };
}

function renderHero() {
  const { release, system } = state;
  const date = formatDate(release.published_at);
  $("#release-version").textContent = release.tag_name;
  $("#release-date").textContent = date;
  $("#badge-title").textContent = `Tank Yard ${release.tag_name}`;
  const summary = summaryOf(release);
  if (summary) $("#badge-text").textContent = summary;
  $("#release-badge").title = `Released ${timeAgo(release.published_at)}`;
  $("#install-count").textContent = `${release.tag_name} · ${date}`;
  renderCard();
  renderPackages();
  const button = $("#download");
  button.addEventListener("click", (event) => {
    if (!state.picked) {
      event.preventDefault();
      if (system.mobile) shareLink(button);
      else openList(true);
      return;
    }
    started(state.picked);
  });
  $("#platform-card").addEventListener("click", () => openList());
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target !== document.body || event.repeat) return;
    if (window.scrollY > innerHeight * 0.5) return;
    button.click();
  });
}

function renderCard() {
  const { system, picked } = state;
  const button = $("#download");
  $("#platform-name").textContent = system.label;
  if (picked) {
    const { file, text } = packageLabel(picked);
    $("#platform-meta").innerHTML = "";
    $("#platform-meta").append(h("span", { class: "long", text: text.split(" · ").slice(0, 2).join(" · ") + " · " }), text.split(" · ").pop());
    button.href = file?.browser_download_url || state.release.html_url;
    button.removeAttribute("aria-disabled");
    button.innerHTML = 'Download <span class="key">[Enter]</span>';
  } else if (system.mobile) {
    $("#platform-meta").textContent = "Desktop only";
    button.href = location.href.split("#")[0];
    button.textContent = "Copy link for your computer";
  } else {
    $("#platform-meta").textContent = "Pick a download";
    button.href = state.release.html_url;
    button.innerHTML = 'Choose a download';
  }
}

function renderPackages() {
  const list = $("#packages");
  list.innerHTML = "";
  const largest = Math.max(...PACKAGES.map((p) => asset(p.key)?.size || 0));
  for (const pkg of PACKAGES) {
    const file = asset(pkg.key);
    if (!file) continue;
    const row = h(
      "a",
      {
        class: "lobby" + (pkg.key === state.picked ? " picked" : ""),
        href: file.browser_download_url,
        title: file.name,
        onclick: () => {
          state.picked = pkg.key;
          renderCard();
          renderPackages();
          started(pkg.key);
          openList(false);
        },
      },
      h("span", { class: "os", text: OS_NAMES[pkg.os] }),
      h("span", { class: "detail", text: `${pkg.kind} · ${pkg.arch}` }),
      h("span", { class: "meter" }, h("i", { style: { width: `${Math.round((file.size / largest) * 100)}%` } })),
      h("span", { class: "size", text: formatSize(file.size) }),
    );
    list.append(h("li", {}, row));
  }
  list.append(
    h(
      "li",
      {},
      h(
        "a",
        { class: "lobby more", href: state.release.html_url },
        h("span", { class: "detail", text: "Install scripts, checksums and every file" }),
        h("span", { class: "size", text: "GitHub ›" }),
      ),
    ),
  );
}

function openList(force) {
  const card = $("#platform-card");
  const list = $("#packages");
  const open = force ?? list.hidden;
  list.hidden = !open;
  card.setAttribute("aria-expanded", String(open));
}

async function shareLink(button) {
  const url = location.href.split("#")[0];
  if (navigator.share) {
    try {
      await navigator.share({ title: "Tank Yard", url });
      return;
    } catch {
      /* closed the share sheet: fall back to copying */
    }
  }
  const ok = await copyText(url);
  button.textContent = ok ? "Link copied" : url;
}

function started(key) {
  const { pkg, file } = packageLabel(key);
  if (!file) return;
  toast({
    title: "Download started",
    text: `${file.name} · ${formatSize(file.size)}`,
    action: { href: "#install", label: "Next step ›" },
  });
  document.dispatchEvent(new CustomEvent("tankyard:download", { detail: { key, os: pkg.os, method: pkg.method } }));
}

function renderNews() {
  const { release } = state;
  $("#news-count").textContent = `Tank Yard ${release.tag_name} · ${formatDate(release.published_at)}`;
  $("#news-link").href = release.html_url;
  const notes = $("#notes");
  notes.innerHTML = renderMarkdown(release.body || "No notes for this release.");
  const body = $("#files tbody");
  body.innerHTML = "";
  const order = (name) => {
    const index = PACKAGES.findIndex((p) => p.pattern.test(name));
    return index < 0 ? 100 + (/\.mp4$/.test(name) ? 50 : 0) : index;
  };
  for (const file of [...release.assets].sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name))) {
    const sum = file.digest?.startsWith("sha256:") ? file.digest.slice(7) : "";
    const name = h("td", {}, h("a", { href: file.browser_download_url, text: file.name }));
    if (sum) {
      name.append(
        h("span", {
          class: "sum",
          text: sum.slice(0, 16) + "…" + sum.slice(-8),
          title: "SHA-256: " + sum,
          role: "button",
          tabindex: "0",
          onclick: async (event) => {
            const ok = await copyText(sum);
            event.target.textContent = ok ? "SHA-256 copied" : sum;
          },
        }),
      );
    }
    body.append(h("tr", {}, name, h("td", { text: formatSize(file.size) })));
  }
  renderEarlier();
}

async function renderEarlier() {
  const host = $("#earlier");
  const list = await earlierReleases(state.release);
  host.querySelectorAll("details").forEach((item) => item.remove());
  host.hidden = !list.length;
  for (const release of list) {
    host.append(
      h(
        "details",
        {},
        h(
          "summary",
          {},
          h("b", { text: release.tag_name }),
          h("span", { class: "date", text: formatDate(release.published_at) }),
          h("span", { class: "chevron", "aria-hidden": "true" }),
        ),
        h("div", { class: "notes", html: renderMarkdown(release.body || "No notes for this release.") }),
        h("a", { class: "btn small", href: release.html_url, text: "Release page ›" }),
      ),
    );
  }
}
