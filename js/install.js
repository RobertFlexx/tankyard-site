// Install steps for each system and method, each with a small animated scene.
import { $, $$, h, reducedMotion, onVisible, formatSize } from "./util.js";
import { state as release, onChange, asset, PACKAGES, OS_NAMES } from "./release.js";
import { svgModel } from "./models.js";

const BASE = "https://github.com/RobertFlexx/tankyard/releases/latest/download";
const CMD = {
  linux: `curl -fsSL ${BASE}/install.sh | sh`,
  mac: `curl -fsSL ${BASE}/install-macos.sh | sh`,
  windows: `irm ${BASE}/install.ps1 | iex`,
  freebsd: `fetch -o - ${BASE}/install.sh | sh`,
};
// FreeBSD's windows keep to the left, clear of the logo on its wallpaper.
const BSD = { x: 18, y: 32, w: 388, h: 300 };
const CANCEL = Symbol("cancel");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let tankSvg = "";

/* ---------- Stage: a 640×400 scene scaled into the panel ---------- */

class Stage {
  constructor(root) {
    this.root = root;
    this.token = 0;
    this.instant = false;
    this.k = 1;
  }
  reset() {
    this.token++;
    this.root.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    this.root.innerHTML = "";
    this.cursor = h("div", { class: "s-cursor", html: CURSOR });
    this.cursor.style.transform = "translate(470px, 300px)";
    this.pos = [470, 300];
    this.root.append(this.cursor);
    return this.token;
  }
  pause() {
    this.token++;
    this.root.getAnimations({ subtree: true }).forEach((animation) => animation.pause());
  }
  live(token) {
    if (token !== this.token) throw CANCEL;
  }
  add(html, parent = this.root) {
    const holder = document.createElement("div");
    holder.innerHTML = html.trim();
    const node = holder.firstElementChild;
    parent.append(node);
    if (parent === this.root) this.root.append(this.cursor);
    return node;
  }
  async wait(ms) {
    if (this.instant) return;
    const token = this.token;
    await sleep(ms);
    this.live(token);
  }
  at(element, dx = 0, dy = 0) {
    const r = element.getBoundingClientRect();
    const s = this.root.getBoundingClientRect();
    return [(r.left + r.width / 2 - s.left) / this.k + dx, (r.top + r.height / 2 - s.top) / this.k + dy];
  }
  async move(target, ms = 650) {
    const [x, y] = Array.isArray(target) ? target : this.at(target);
    const from = `translate(${this.pos[0]}px, ${this.pos[1]}px)`;
    const to = `translate(${x}px, ${y}px)`;
    this.pos = [x, y];
    if (this.instant) {
      this.cursor.style.transform = to;
      return;
    }
    const token = this.token;
    const animation = this.cursor.animate([{ transform: from }, { transform: to }], {
      duration: ms,
      easing: "cubic-bezier(.35,.05,.25,1)",
      fill: "forwards",
    });
    await animation.finished.catch(() => {});
    this.live(token);
    this.cursor.style.transform = to;
    animation.cancel();
  }
  async click(target, { double = false, press } = {}) {
    if (target) await this.move(target);
    const [x, y] = this.pos;
    const pressed = press || (target instanceof Element ? target : null);
    if (!this.instant) {
      for (let i = 0; i < (double ? 2 : 1); i++) {
        const ring = h("div", { class: "s-ring", style: { left: `${x}px`, top: `${y}px` } });
        this.root.append(ring);
        setTimeout(() => ring.remove(), 500);
        if (double) await this.wait(120);
      }
    }
    pressed?.classList.add("press");
    await this.wait(220);
    pressed?.classList.remove("press");
  }
  async type(element, text, perChar = 28) {
    if (this.instant) {
      element.textContent += text;
      return;
    }
    const token = this.token;
    for (const ch of text) {
      element.textContent += ch;
      await sleep(perChar * (0.6 + Math.random() * 0.8));
      this.live(token);
    }
  }
  async fill(bar, ms) {
    if (this.instant) {
      bar.style.width = "100%";
      return;
    }
    const token = this.token;
    const animation = bar.animate([{ width: "0%" }, { width: "100%" }], { duration: ms, easing: "cubic-bezier(.3,.1,.4,1)", fill: "forwards" });
    await animation.finished.catch(() => {});
    this.live(token);
    bar.style.width = "100%";
    animation.cancel();
  }
}

const CURSOR = `<svg viewBox="0 0 16 22" width="16" height="22"><path d="M1.5 1.5v16.2l4.1-3.9 2.7 6.3 3-1.3-2.7-6.2h5.7z" fill="#fff" stroke="#1f262e" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

/* ---------- Scene pieces ---------- */

function desk(S, os) {
  const node = S.add(`<div class="s-desk ${os}"></div>`);
  if (os === "windows") {
    node.insertAdjacentHTML(
      "beforeend",
      `<div class="s-taskbar"><i class="start"></i><i class="search"></i><i></i><i class="app"></i><i></i><i class="clock">12:41</i></div>`,
    );
  } else if (os === "mac") {
    node.insertAdjacentHTML(
      "beforeend",
      `<div class="s-menubar"><b></b><b>Finder</b><span>File</span><span>Edit</span><span>View</span><span class="clock">Tue 12:41</span></div><div class="s-dock"><i></i><i></i><i></i><i class="app"></i><i></i></div>`,
    );
  } else if (os === "freebsd") {
    // The official FreeBSD logo, unaltered, from the FreeBSD Foundation.
    node.insertAdjacentHTML(
      "beforeend",
      `<img class="s-wallpaper" src="img/freebsd-logo.png" alt=""><div class="s-topbar bsd"><span class="apps">Applications</span><span>Tue 12:41</span></div>`,
    );
  } else {
    node.insertAdjacentHTML("beforeend", `<div class="s-topbar"><span>Activities</span><span>Tue 12:41</span><span>▾</span></div>`);
  }
  return node;
}

function win(S, os, { x, y, w, h: height, title = "", dark = false, icon = false }) {
  const controls =
    os === "mac"
      ? `<span class="dots"><i></i><i></i><i></i></span><span class="name" style="flex:1;text-align:center;margin-right:40px">${title}</span>`
      : `${icon ? '<img src="img/tankyard.svg" alt="">' : ""}<span class="name"${os === "linux" || os === "freebsd" ? ' style="flex:1;text-align:center;margin-left:30px"' : ""}>${title}</span><span class="ctl">${
          os === "windows" ? "<span>—</span><i class=\"max\"></i><span>✕</span>" : "<span>✕</span>"
        }</span>`;
  const el = S.add(
    `<div class="s-win${dark ? " dark" : ""}" style="left:${x}px;top:${y}px;width:${w}px;height:${height}px"><div class="s-title">${controls}</div><div class="s-body"></div></div>`,
  );
  if (!S.instant) el.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
  return { el, body: el.querySelector(".s-body"), name: el.querySelector(".name") };
}

function browser(S, os, file) {
  const wide = { x: 34, y: os === "mac" ? 30 : 26, w: 572, h: 318 };
  const b = win(S, os, { ...(os === "freebsd" ? BSD : wide), title: "Tank Yard" });
  b.body.innerHTML = `<div class="s-addr"><span>‹  ›  ↻</span><div class="s-input">robertflexx.github.io/tankyard-site</div></div>
    <div class="s-site"><div class="t">Tank Yard</div><div class="tank">${tankSvg}</div>
    <div class="pane"><i class="lbl"></i><i class="field"></i><i class="lbl"></i><i class="card"><b>${OS_NAMES[os]}</b></i>
    <div class="row"><span class="dl">Download [Enter]</span><i></i></div><div class="four"><i></i><i></i><i></i><i></i></div></div></div>`;
  return { ...b, download: b.body.querySelector(".dl") };
}

function bubble(S, file, x = 344, y = 70) {
  const node = S.add(
    `<div class="s-bubble" style="left:${x}px;top:${y}px"><div class="s-file"><i class="ico ${/\.zip$|\.tar\.gz$/.test(file.name) ? "zip" : "game"}"></i><b>${file.name}</b><small class="st">Starting…</small></div><div class="s-bar"><i></i></div></div>`,
  );
  if (!S.instant) node.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 200 });
  return { el: node, bar: node.querySelector(".s-bar i"), status: node.querySelector(".st") };
}

async function download(S, os, file) {
  const page = browser(S, os, file);
  await S.wait(350);
  await S.click(page.download);
  const b = os === "freebsd" ? bubble(S, file, 146, 70) : bubble(S, file);
  b.status.textContent = `0 of ${formatSize(file.size)}`;
  const counter = setInterval(() => {
    const share = b.bar.getBoundingClientRect().width / Math.max(1, b.bar.parentElement.getBoundingClientRect().width);
    b.status.textContent = `${formatSize(file.size * Math.min(1, share))} of ${formatSize(file.size)}`;
  }, 90);
  try {
    await S.fill(b.bar, 1900);
  } finally {
    clearInterval(counter);
  }
  b.status.textContent = `${formatSize(file.size)} · Done`;
  b.el.querySelector(".s-bar").remove();
  return { page, bubble: b };
}

function gameWindow(S, os, x = 120, y = 40, w = 400, height = 300) {
  if (os === "freebsd") ({ x, y, w, h: height } = BSD);
  const g = win(S, os, { x, y, w, h: height, title: "Tank Yard", icon: true });
  const shapes = [
    [30, 40, "#ffe869", 20, 0],
    [330, 70, "#fc7677", 0, 1],
    [60, 200, "#768dfc", 12, 0],
    [320, 190, "#ffe869", 35, 0],
    [180, 230, "#a3b3bf", 8, 0],
  ]
    .map(([sx, sy, color, turn, tri]) =>
      tri
        ? `<i class="shape" style="left:${sx}px;top:${sy}px;border:0;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid ${color}"></i>`
        : `<i class="shape" style="left:${sx}px;top:${sy}px;background:${color};transform:rotate(${turn}deg)"></i>`,
    )
    .join("");
  g.body.innerHTML = `<div class="s-game">${shapes}<div class="t">Tank Yard</div><div class="tank">${tankSvg}</div><div class="menu-pane"><i></i><i></i><i class="play"></i><i></i></div></div>`;
  return g;
}

function terminal(S, os, { x = 70, y = 44, w = 500, h: height = 290, title } = {}) {
  if (os === "freebsd") ({ x, y, w, h: height } = BSD);
  const names = { windows: "Windows PowerShell", mac: "Terminal — zsh", freebsd: "Terminal - you@freebsd: ~" };
  const t = win(S, os, { x, y, w, h: height, title: title || names[os] || "you@desktop: ~", dark: true });
  t.body.classList.add("s-term");
  const prompts = { windows: "PS C:\\Users\\you>", mac: "you@Mac ~ %", freebsd: "you@freebsd:~ $" };
  const prompt = prompts[os] || "you@desktop:~$";
  const caret = h("span", { class: "caret" });
  return {
    ...t,
    async run(command, perChar = 18) {
      const line = h("div");
      line.innerHTML = `<span class="p">${prompt}</span> `;
      const cmd = h("span");
      line.append(cmd, caret);
      t.body.append(line);
      await S.wait(260);
      await S.type(cmd, command, perChar);
      await S.wait(260);
      caret.remove();
    },
    print(html) {
      const line = h("div", { html: html || "&nbsp;" });
      t.body.append(line);
      t.body.scrollTop = t.body.scrollHeight;
      return line;
    },
    idle() {
      const line = h("div");
      line.innerHTML = `<span class="p">${prompt}</span> `;
      line.append(caret);
      t.body.append(line);
      t.body.scrollTop = t.body.scrollHeight;
    },
  };
}

function fileWindow(S, os, { title, side, rows, x = 70, y = 40, w = 500, h: height = 300 }) {
  const f = win(S, os, { x, y, w, h: height, title });
  f.body.style.display = "flex";
  const sideHtml = side.map((item) => `<div class="${item.startsWith("*") ? "on" : ""}">${item.replace("*", "")}</div>`).join("");
  f.body.innerHTML = `<div class="s-side">${sideHtml}</div><div class="s-list" style="flex:1"></div>`;
  const list = f.body.querySelector(".s-list");
  const add = (row) => {
    const node = h("div", { class: "s-row" });
    node.innerHTML = `<i class="ico ${row.icon || ""}"></i><span>${row.name}</span><small>${row.meta || ""}</small>`;
    list.append(node);
    return node;
  };
  const nodes = rows.map(add);
  return { ...f, list, nodes, add, side: f.body.querySelector(".s-side") };
}

function smartScreen(S, file) {
  const box = S.add(
    `<div class="s-win" style="left:150px;top:46px;width:340px;height:270px;border:0"><div class="s-warn" style="height:100%;display:flex;flex-direction:column"><h4>Windows protected your PC</h4><p>Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk.</p><p><u class="more">More info</u></p><p class="details" style="display:none">App: ${file}<br>Publisher: Unknown publisher</p><div style="margin-top:auto;display:flex;justify-content:flex-end;gap:6px"><span class="s-btn blue run" style="display:none">Run anyway</span><span class="s-btn">Don't run</span></div></div></div>`,
  );
  return {
    el: box,
    more: box.querySelector(".more"),
    details: box.querySelector(".details"),
    run: box.querySelector(".run"),
  };
}

async function passSmartScreen(S, name) {
  const dialog = smartScreen(S, name);
  await S.wait(700);
  await S.click(dialog.more);
  dialog.details.style.display = "";
  dialog.run.style.display = "";
  await S.wait(500);
  await S.click(dialog.run);
  dialog.el.remove();
}

const NSIS_PAGES = [
  { title: "Welcome to Tank Yard Setup", body: "<p>Setup will guide you through the installation of Tank Yard.</p><p>Click Next to continue.</p>", next: "Next >" },
  { title: "License Agreement", body: '<p>Please review the license terms before installing Tank Yard.</p><div class="s-input" style="height:54px;white-space:normal;line-height:1.4;padding-top:4px">Tank Yard is dual licensed under the MIT license or the Apache License 2.0, at your option.</div>', next: "I Agree" },
  { title: "Choose Components", body: '<p>Choose which features of Tank Yard you want to install.</p><div class="s-check"><i>✓</i>Tank Yard (required)</div><div class="s-check"><i>✓</i>Desktop shortcut</div>', next: "Next >" },
  { title: "Choose Install Location", body: '<p>Setup will install Tank Yard in the following folder. No administrator access is needed.</p><div class="s-input">C:\\Users\\you\\AppData\\Local\\Programs\\Tank Yard</div>', next: "Install" },
  { title: "Installing", body: '<p>Please wait while Tank Yard is being installed.</p><div class="s-bar" style="height:8px"><i class="go"></i></div><p class="m" style="margin-top:6px">Extract: tankyard.exe</p>', next: "Next >", busy: true },
  { title: "Completing Tank Yard Setup", body: '<p>Tank Yard has been installed on your computer.</p><div class="s-check"><i>✓</i>Play Tank Yard</div><p>Click Finish to close Setup.</p>', next: "Finish" },
];

function nsis(S) {
  const w = win(S, "windows", { x: 110, y: 50, w: 420, h: 280, title: "Tank Yard Setup", icon: true });
  w.body.innerHTML = `<div class="s-wizard"><div class="art"><img src="img/tankyard.svg" alt=""></div><div class="page"><h4></h4><div class="content"></div><div class="foot"><span class="s-btn back">< Back</span><span class="s-btn primary next">Next ></span><span class="s-btn">Cancel</span></div></div></div>`;
  const page = w.body.querySelector(".page");
  return {
    ...w,
    next: page.querySelector(".next"),
    show(i) {
      const p = NSIS_PAGES[i];
      page.querySelector("h4").textContent = p.title;
      page.querySelector(".content").innerHTML = p.body;
      page.querySelector(".next").textContent = p.next;
      page.querySelector(".back").style.visibility = i === 0 || i === 5 ? "hidden" : "";
      return page.querySelector(".go");
    },
  };
}

const MAC_STEPS = ["Introduction", "License", "Destination Select", "Installation Type", "Installation", "Summary"];
function macInstaller(S) {
  const w = win(S, "mac", { x: 90, y: 44, w: 460, h: 290, title: "Install Tank Yard" });
  w.body.style.display = "grid";
  w.body.style.gridTemplateColumns = "130px 1fr";
  w.body.innerHTML = `<div class="s-steps">${MAC_STEPS.map((s) => `<div>${s}</div>`).join("")}</div><div class="s-pane" style="display:flex;flex-direction:column"><h4></h4><div class="content box" style="flex:1"></div><div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px"><span class="s-btn back">Go Back</span><span class="s-btn primary next">Continue</span></div></div>`;
  const steps = $$(".s-steps div", w.body);
  return {
    ...w,
    next: w.body.querySelector(".next"),
    show(i, title, content, label = "Continue") {
      steps.forEach((s, j) => {
        s.className = j < i ? "done" : j === i ? "on" : "";
      });
      w.body.querySelector("h4").textContent = title;
      w.body.querySelector(".content").innerHTML = content;
      w.body.querySelector(".next").textContent = label;
    },
  };
}

async function runMacInstaller(S) {
  const inst = macInstaller(S);
  inst.show(0, "Welcome to the Tank Yard Installer", "You will be guided through the steps necessary to install this software.");
  await S.wait(600);
  await S.click(inst.next);
  inst.show(1, "Software License Agreement", "Tank Yard is dual licensed under the MIT license or the Apache License 2.0.");
  await S.wait(450);
  await S.click(inst.next);
  const sheet = S.add(
    `<div class="s-win" style="left:200px;top:90px;width:280px;height:110px"><div class="s-pane"><p style="margin:0">To continue installing the software you must agree to the terms of the software license agreement.</p><div style="display:flex;justify-content:flex-end;gap:6px"><span class="s-btn">Disagree</span><span class="s-btn primary agree">Agree</span></div></div></div>`,
  );
  await S.wait(450);
  await S.click(sheet.querySelector(".agree"));
  sheet.remove();
  inst.show(3, "Standard Install", "This will install Tank Yard.app in your Applications folder.", "Install");
  await S.wait(500);
  await S.click(inst.next);
  await password(S, "Installer is trying to install new software.");
  inst.show(4, "Installing Tank Yard", '<div class="s-bar" style="height:8px;margin-top:20px"><i class="go"></i></div><p style="margin-top:8px;color:#6e7a85">Writing files…</p>', "Continue");
  await S.fill(inst.body.querySelector(".go"), 1500);
  inst.show(5, "The installation was completed successfully.", '<div style="display:grid;place-items:center;height:100%"><div style="width:44px;height:44px;border-radius:50%;background:#54c773;color:#fff;display:grid;place-items:center;font-size:24px">✓</div><p style="margin-top:8px">The software was installed.</p></div>', "Close");
  await S.wait(700);
  await S.click(inst.next);
  inst.el.remove();
}

async function password(S, text) {
  const sheet = S.add(
    `<div class="s-win" style="left:190px;top:80px;width:260px;height:150px"><div class="s-pw"><b>${text}</b><span style="color:#6e7a85">Enter your password to allow this.</span><div class="s-input dots"></div><div style="display:flex;justify-content:flex-end;gap:6px"><span class="s-btn">Cancel</span><span class="s-btn primary ok">OK</span></div></div></div>`,
  );
  await S.wait(300);
  await S.type(sheet.querySelector(".dots"), "••••••••", 60);
  await S.wait(200);
  await S.click(sheet.querySelector(".ok"));
  sheet.remove();
}

async function openGame(S, os) {
  await S.wait(300);
  const game = gameWindow(S, os);
  await S.move([330, 210], 600);
  return game;
}

/* ---------- Steps ---------- */

function methods(os, file, tag) {
  const version = tag.replace(/^v/, "");
  if (os === "windows") {
    const setup = file("windows-setup");
    const zip = file("windows-zip");
    return [
      {
        id: "setup",
        name: "Setup",
        tag: "recommended",
        steps: [
          {
            title: "Download the setup",
            text: `<p>${setup.name} · ${formatSize(setup.size)}. Your browser saves it to Downloads.</p>`,
            download: "windows-setup",
            scene: async (S) => {
              desk(S, "windows");
              await download(S, "windows", setup);
            },
          },
          {
            title: "Open it",
            text: "<p>Open the file from your browser's downloads or the Downloads folder.</p><p>The setup isn't code-signed yet, so Windows may stop it the first time. Choose <b>More info</b>, then <b>Run anyway</b>.</p>",
            scene: async (S) => {
              desk(S, "windows");
              browser(S, "windows");
              const b = bubble(S, setup);
              b.status.innerHTML = `${formatSize(setup.size)} · Done  <u class="open" style="color:#1f6fb2">Open file</u>`;
              b.el.querySelector(".s-bar").remove();
              await S.wait(400);
              await S.click(b.status.querySelector(".open"));
              await passSmartScreen(S, setup.name);
            },
          },
          {
            title: "Click through the installer",
            text: "<p><b>Next</b>, <b>I Agree</b>, pick the shortcuts you want, then <b>Install</b>. It installs for your account only, with no administrator prompt, and adds a Start menu shortcut.</p>",
            scene: async (S) => {
              desk(S, "windows");
              const w = nsis(S);
              for (let i = 0; i < 5; i++) {
                const bar = w.show(i);
                if (bar) {
                  await S.fill(bar, 1500);
                  continue;
                }
                await S.wait(i === 0 ? 500 : 650);
                await S.click(w.next);
              }
              w.show(5);
            },
          },
          {
            title: "Play",
            text: "<p>Leave <b>Play Tank Yard</b> ticked and click <b>Finish</b>. Later, open it from Start. To update, run a newer setup; your settings and progress stay.</p>",
            scene: async (S) => {
              desk(S, "windows");
              const w = nsis(S);
              w.show(5);
              await S.wait(500);
              await S.click(w.next);
              w.el.remove();
              await openGame(S, "windows");
            },
          },
        ],
      },
      {
        id: "zip",
        name: "Portable ZIP",
        steps: [
          {
            title: "Download the ZIP",
            text: `<p>${zip.name} · ${formatSize(zip.size)}.</p>`,
            download: "windows-zip",
            scene: async (S) => {
              desk(S, "windows");
              await download(S, "windows", zip);
            },
          },
          {
            title: "Extract it",
            text: "<p>In Downloads, right-click the ZIP and choose <b>Extract All</b>, then <b>Extract</b>. Keep the extracted folder together: it holds the game, the server, tools and bundled mods.</p>",
            scene: async (S) => {
              desk(S, "windows");
              const ex = fileWindow(S, "windows", {
                title: "Downloads",
                side: ["Home", "Desktop", "*Downloads", "Documents", "This PC"],
                rows: [{ icon: "zip", name: zip.name, meta: formatSize(zip.size) }],
              });
              await S.wait(400);
              await S.move(ex.nodes[0]);
              ex.nodes[0].classList.add("sel");
              const [mx, my] = S.pos;
              const menu = S.add(`<div class="s-menu" style="left:${mx + 4}px;top:${my + 4}px"><div>Open</div><div class="x">Extract All…</div><hr><div>Copy</div><div>Rename</div><div>Properties</div></div>`);
              await S.wait(450);
              const extract = menu.querySelector(".x");
              await S.move(extract);
              extract.classList.add("hl");
              await S.click();
              menu.remove();
              const dlg = win(S, "windows", { x: 150, y: 90, w: 340, h: 170, title: "Extract Compressed (Zipped) Folders" });
              dlg.body.innerHTML = `<div class="s-pane"><b>Select a Destination and Extract Files</b><span>Files will be extracted to this folder:</span><div class="s-input">C:\\Users\\you\\Downloads\\${zip.name.replace(/\.zip$/, "")}</div><div style="display:flex;justify-content:flex-end;gap:6px"><span class="s-btn primary go">Extract</span><span class="s-btn">Cancel</span></div></div>`;
              await S.wait(600);
              await S.click(dlg.body.querySelector(".go"));
              dlg.el.remove();
              ex.add({ icon: "folder", name: zip.name.replace(/\.zip$/, ""), meta: "Folder" }).classList.add("sel");
              ex.nodes[0].classList.remove("sel");
            },
          },
          {
            title: "Open tankyard.exe",
            text: "<p>In the extracted folder, double-click <b>tankyard.exe</b>. If Windows warns about an unrecognized app, choose <b>More info</b>, then <b>Run anyway</b>.</p>",
            scene: async (S) => {
              desk(S, "windows");
              const ex = fileWindow(S, "windows", {
                title: zip.name.replace(/\.zip$/, ""),
                side: ["Home", "Desktop", "*Downloads", "Documents", "This PC"],
                rows: [
                  { icon: "folder", name: "configs", meta: "Folder" },
                  { icon: "folder", name: "docs", meta: "Folder" },
                  { icon: "folder", name: "mods", meta: "Folder" },
                  { icon: "game", name: "tankyard.exe", meta: "Application" },
                  { icon: "", name: "tankyard-server.exe", meta: "Application" },
                  { icon: "", name: "tankyard-tools.exe", meta: "Application" },
                  { icon: "", name: "README.md", meta: "Markdown" },
                ],
              });
              await S.wait(400);
              await S.click(ex.nodes[3], { double: true });
              ex.nodes[3].classList.add("sel");
              await passSmartScreen(S, "tankyard.exe");
              await openGame(S, "windows");
            },
          },
        ],
      },
      {
        id: "powershell",
        name: "PowerShell",
        steps: [
          {
            title: "Open PowerShell",
            text: "<p>Press Start, type <b>PowerShell</b> and open it. No administrator rights are needed.</p>",
            scene: async (S) => {
              desk(S, "windows");
              const start = S.add(`<div class="s-start"><div class="q"></div><div class="r"><i></i>Windows PowerShell</div></div>`);
              await S.click(S.root.querySelector(".s-taskbar .start"));
              await S.type(start.querySelector(".q"), "PowerShell", 70);
              await S.wait(300);
              await S.click(start.querySelector(".r"));
              start.remove();
              terminal(S, "windows").idle();
            },
          },
          {
            title: "Paste the command and press Enter",
            text: "<p>It downloads the latest build, checks its SHA-256 checksum, adds a Start menu shortcut and puts <code>tankyard</code> on your PATH. Run it again any time to update.</p>",
            cmd: CMD.windows,
            scene: async (S) => {
              desk(S, "windows");
              const t = terminal(S, "windows");
              await t.run(CMD.windows, 14);
              t.print('<span class="c">Tank Yard</span>');
              await S.wait(300);
              t.print(`Downloading ${tag} for Windows...`);
              await S.wait(1300);
              t.print("Download verified.");
              await S.wait(500);
              t.print('<span class="g">Installed to C:\\Users\\you\\AppData\\Local\\Programs\\Tank Yard</span>');
              t.print("Ready. Open Tank Yard from Start, or run tankyard in a new terminal.");
              t.idle();
            },
          },
          {
            title: "Play",
            text: "<p>Open Tank Yard from Start, or type <code>tankyard</code> in a new terminal.</p>",
            scene: async (S) => {
              desk(S, "windows");
              const t = terminal(S, "windows");
              await t.run("tankyard", 70);
              await openGame(S, "windows");
            },
          },
        ],
      },
    ];
  }
  if (os === "mac") {
    const pkg = file("mac-pkg");
    const tar = file("mac-tar");
    const folder = tar.name.replace(/\.tar\.gz$/, "");
    return [
      {
        id: "pkg",
        name: "Installer package",
        steps: [
          {
            title: "Download the installer",
            text: `<p>${pkg.name} · ${formatSize(pkg.size)}. One universal package for Apple silicon and Intel Macs.</p>`,
            download: "mac-pkg",
            scene: async (S) => {
              desk(S, "mac");
              await download(S, "mac", pkg);
            },
          },
          {
            title: "Allow it once",
            text: "<p>The package isn't notarized by Apple yet, so macOS stops it the first time: click <b>Done</b>.</p><p>Open <b>System Settings → Privacy &amp; Security</b>, scroll down, click <b>Open Anyway</b> and enter your password.</p>",
            scene: async (S) => {
              desk(S, "mac");
              const dlg = S.add(
                `<div class="s-win" style="left:225px;top:70px;width:190px;height:230px"><div class="s-dialog"><img src="img/tankyard.svg" alt=""><h4>“${pkg.name}” Not Opened</h4><p>Apple could not verify it is free of malware that may harm your Mac or compromise your privacy.</p><span class="s-btn primary done">Done</span><span class="s-btn">Move to Trash</span></div></div>`,
              );
              await S.wait(900);
              await S.click(dlg.querySelector(".done"));
              dlg.remove();
              const settings = win(S, "mac", { x: 60, y: 34, w: 520, h: 300, title: "Privacy & Security" });
              settings.body.style.display = "flex";
              settings.body.innerHTML = `<div class="s-side"><div>Wi-Fi</div><div>Bluetooth</div><div>General</div><div>Appearance</div><div class="on">Privacy &amp; Security</div><div>Desktop &amp; Dock</div></div><div class="s-pane" style="flex:1"><h4>Security</h4><div class="box">Allow applications from<br><b>App Store &amp; Known Developers</b></div><div class="box">“${pkg.name}” was blocked to protect your Mac.<div style="margin-top:8px"><span class="s-btn anyway">Open Anyway</span></div></div></div>`;
              await S.wait(700);
              await S.click(settings.body.querySelector(".anyway"));
              await password(S, "System Settings is trying to open a package.");
            },
          },
          {
            title: "Install",
            text: "<p>The installer walks through Introduction, License (<b>Agree</b>) and <b>Install</b>, then asks for your password. Tank Yard.app goes into Applications.</p>",
            scene: async (S) => {
              desk(S, "mac");
              await runMacInstaller(S);
            },
          },
          {
            title: "Play",
            text: "<p>Open Tank Yard from Applications or Launchpad. Install a newer package to update; your settings and mods are kept.</p>",
            scene: async (S) => {
              desk(S, "mac");
              const f = fileWindow(S, "mac", {
                title: "Applications",
                side: ["Favorites", "*Applications", "Desktop", "Documents", "Downloads"],
                rows: [
                  { icon: "app", name: "Calculator", meta: "" },
                  { icon: "app", name: "Tank Yard", meta: tag },
                  { icon: "app", name: "TextEdit", meta: "" },
                ],
              });
              f.nodes[0].querySelector(".ico").style.filter = "grayscale(1)";
              f.nodes[2].querySelector(".ico").style.filter = "grayscale(1)";
              await S.wait(400);
              await S.click(f.nodes[1], { double: true });
              f.nodes[1].classList.add("sel");
              await openGame(S, "mac");
            },
          },
        ],
      },
      {
        id: "terminal",
        name: "Terminal",
        tag: "no warning",
        steps: [
          {
            title: "Open Terminal",
            text: "<p>Press <b>⌘ Space</b>, type <b>Terminal</b> and press Return.</p>",
            scene: async (S) => {
              desk(S, "mac");
              const spot = S.add(`<div class="s-spot"><div class="q"></div><div class="r hl"><i class="ico app" style="filter:grayscale(1)"></i>Terminal</div></div>`);
              await S.type(spot.querySelector(".q"), "Terminal", 80);
              await S.wait(350);
              spot.remove();
              terminal(S, "mac").idle();
            },
          },
          {
            title: "Paste the command and press Return",
            text: "<p>It downloads the installer with curl, checks it against the release's SHA256SUMS, and opens the normal installer without the security warning.</p><p>Prefer no windows? Add <code>-s -- --cli</code> after <code>sh</code> to install from the terminal.</p>",
            cmd: CMD.mac,
            scene: async (S) => {
              desk(S, "mac");
              const t = terminal(S, "mac");
              await t.run(CMD.mac, 14);
              t.print(`<span class="c">Tank Yard ${tag} for macOS</span>`);
              await S.wait(300);
              t.print(`Downloading ${pkg.name}…`);
              await S.wait(1400);
              t.print('<span class="g">Verified against the official release checksum.</span>');
              await S.wait(400);
              t.print("Opening the installer. Follow its steps to finish.");
              t.idle();
            },
          },
          {
            title: "Finish the installer",
            text: "<p>Continue, <b>Agree</b> to the license, <b>Install</b>, and enter your password. Tank Yard.app goes into Applications.</p>",
            scene: async (S) => {
              desk(S, "mac");
              await runMacInstaller(S);
            },
          },
          {
            title: "Play",
            text: "<p>Open Tank Yard from Applications or Launchpad. Run the command again to update.</p>",
            scene: async (S) => {
              desk(S, "mac");
              await S.click(S.root.querySelector(".s-dock .app"));
              await openGame(S, "mac");
            },
          },
        ],
      },
      {
        id: "archive",
        name: "Archive",
        steps: [
          {
            title: "Download the archive",
            text: `<p>${tar.name} · ${formatSize(tar.size)}. It holds Tank Yard.app plus the dedicated server and command-line tools.</p>`,
            download: "mac-tar",
            scene: async (S) => {
              desk(S, "mac");
              await download(S, "mac", tar);
            },
          },
          {
            title: "Open it and move the app",
            text: "<p>Double-click the archive in Downloads to extract it, then drag <b>Tank Yard.app</b> into <b>Applications</b>.</p>",
            scene: async (S) => {
              desk(S, "mac");
              const f = fileWindow(S, "mac", {
                title: "Downloads",
                side: ["Favorites", "Applications", "Desktop", "*Downloads"],
                rows: [{ icon: "zip", name: tar.name, meta: formatSize(tar.size) }],
              });
              await S.wait(400);
              await S.click(f.nodes[0], { double: true });
              const dir = f.add({ icon: "folder", name: folder, meta: "Folder" });
              await S.wait(400);
              await S.click(dir, { double: true });
              f.name.textContent = folder;
              f.list.innerHTML = "";
              const app = f.add({ icon: "app", name: "Tank Yard.app", meta: "Application" });
              ["configs", "docs", "mods"].forEach((n) => f.add({ icon: "folder", name: n, meta: "Folder" }));
              f.add({ icon: "", name: "tankyard-server", meta: "Unix executable" });
              await S.wait(400);
              await S.move(app);
              app.classList.add("sel");
              const target = f.side.children[1];
              const ghost = S.add(`<div style="position:absolute;opacity:.8"><i class="ico app"></i></div>`);
              const follow = () => {
                ghost.style.left = `${S.pos[0] + 6}px`;
                ghost.style.top = `${S.pos[1] + 6}px`;
              };
              follow();
              const timer = setInterval(() => {
                const m = new DOMMatrix(getComputedStyle(S.cursor).transform);
                ghost.style.left = `${m.m41 + 6}px`;
                ghost.style.top = `${m.m42 + 6}px`;
              }, 16);
              try {
                await S.move(target, 900);
              } finally {
                clearInterval(timer);
              }
              ghost.remove();
              target.classList.add("on");
              await S.wait(300);
            },
          },
          {
            title: "Open it",
            text: "<p>The first time, macOS may say it can't verify the app. Open <b>System Settings → Privacy &amp; Security</b> and click <b>Open Anyway</b>.</p>",
            scene: async (S) => {
              desk(S, "mac");
              const f = fileWindow(S, "mac", {
                title: "Applications",
                side: ["Favorites", "*Applications", "Desktop", "Downloads"],
                rows: [{ icon: "app", name: "Tank Yard", meta: tag }],
              });
              await S.wait(300);
              await S.click(f.nodes[0], { double: true });
              const dlg = S.add(
                `<div class="s-win" style="left:225px;top:70px;width:190px;height:210px"><div class="s-dialog"><img src="img/tankyard.svg" alt=""><h4>“Tank Yard” Not Opened</h4><p>Apple could not verify it is free of malware.</p><span class="s-btn primary done">Done</span><span class="s-btn">Move to Trash</span></div></div>`,
              );
              await S.wait(700);
              await S.click(dlg.querySelector(".done"));
              dlg.remove();
              f.el.remove();
              const settings = win(S, "mac", { x: 60, y: 34, w: 520, h: 300, title: "Privacy & Security" });
              settings.body.style.display = "flex";
              settings.body.innerHTML = `<div class="s-side"><div>General</div><div>Appearance</div><div class="on">Privacy &amp; Security</div><div>Desktop &amp; Dock</div></div><div class="s-pane" style="flex:1"><h4>Security</h4><div class="box">“Tank Yard” was blocked to protect your Mac.<div style="margin-top:8px"><span class="s-btn anyway">Open Anyway</span></div></div></div>`;
              await S.wait(500);
              await S.click(settings.body.querySelector(".anyway"));
              await password(S, "System Settings is trying to open an app.");
              settings.el.remove();
              await openGame(S, "mac");
            },
          },
        ],
      },
    ];
  }
  if (os === "freebsd") return freebsdMethods(file, tag, version);
  const arm = release.system.arch === "arm";
  const archive = file(arm ? "linux-arm" : "linux-x64");
  const folder = archive.name.replace(/\.tar\.gz$/, "");
  const platform = arm ? "linux-aarch64" : "linux-x86_64";
  return [
    {
      id: "terminal",
      name: "Terminal",
      tag: "recommended",
      steps: [
        {
          title: "Open a terminal",
          text: "<p>Most desktops open one with <b>Ctrl+Alt+T</b>.</p>",
          scene: async (S) => {
            desk(S, "linux");
            const keys = S.add(`<div class="s-keys"><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>T</kbd></div>`);
            await S.wait(1100);
            keys.remove();
            terminal(S, "linux").idle();
          },
        },
        {
          title: "Paste the command and press Enter",
          text: "<p>It picks the right build for your machine, checks its SHA-256 checksum, installs to <code>~/.local/bin</code> and adds Tank Yard to your application menu. No sudo. Run it again to update.</p>",
          cmd: CMD.linux,
          scene: async (S) => {
            desk(S, "linux");
            const t = terminal(S, "linux");
            await t.run(CMD.linux, 14);
            t.print('<span class="c">Tank Yard</span>');
            t.print(`Downloading ${tag} for ${platform}…`);
            const bar = t.print("");
            const steps = S.instant ? 1 : 24;
            for (let i = 1; i <= steps; i++) {
              const share = i / steps;
              bar.textContent = "#".repeat(Math.round(share * 40)).padEnd(40, " ") + ` ${(share * 100).toFixed(1)}%`;
              await S.wait(55);
            }
            t.print("Download verified.");
            await S.wait(300);
            t.print(`tankyard ${version}`);
            t.print("Added Tank Yard to your application menu.");
            t.print('<span class="g">Installed to /home/you/.local/bin</span>');
            t.print("Ready. Run tankyard to start.");
            t.idle();
          },
        },
        {
          title: "Play",
          text: "<p>Run <code>tankyard</code>, or open Tank Yard from your application menu. Your settings and progress stay when you update.</p>",
          scene: async (S) => {
            desk(S, "linux");
            const t = terminal(S, "linux");
            await t.run("tankyard", 70);
            await openGame(S, "linux");
          },
        },
      ],
    },
    {
      id: "archive",
      name: "Archive",
      steps: [
        {
          title: "Download the archive",
          text: `<p>${archive.name} · ${formatSize(archive.size)}.</p>`,
          download: arm ? "linux-arm" : "linux-x64",
          also: arm ? "linux-x64" : "linux-arm",
          scene: async (S) => {
            desk(S, "linux");
            await download(S, "linux", archive);
          },
        },
        {
          title: "Extract it",
          text: "<p>In a terminal in your Downloads folder, or with your file manager's <b>Extract Here</b>:</p>",
          cmd: `tar -xzf ${archive.name}`,
          scene: async (S) => {
            desk(S, "linux");
            const t = terminal(S, "linux", { title: "you@desktop: ~/Downloads" });
            await t.run("cd ~/Downloads", 40);
            await t.run(`tar -xzf ${archive.name}`, 24);
            await t.run("ls", 80);
            t.print(`<span class="c">${folder}</span>  ${archive.name}`);
            t.idle();
          },
        },
        {
          title: "Run it",
          text: "<p>The folder also has the dedicated server, relay and tools. The game needs X11 and OpenGL.</p>",
          cmd: `cd ${folder} && ./tankyard`,
          scene: async (S) => {
            desk(S, "linux");
            const t = terminal(S, "linux", { title: "you@desktop: ~/Downloads" });
            await t.run(`cd ${folder} && ./tankyard`, 24);
            await openGame(S, "linux");
          },
        },
      ],
    },
  ];
}

function freebsdMethods(file, tag, version) {
  const archive = file("freebsd-x64");
  const folder = archive.name.replace(/\.tar\.gz$/, "");
  // Releases from before FreeBSD support have no FreeBSD build.
  const missing =
    release.release && !asset("freebsd-x64")
      ? `<p><b>${tag} has no FreeBSD build yet</b>; the next release brings it. Until then, <a href="https://github.com/RobertFlexx/tankyard/blob/main/docs/freebsd.md#building-from-source">build it from source</a>.</p>`
      : "";
  const progress = async (S, t) => {
    const line = t.print("");
    const steps = S.instant ? 1 : 20;
    for (let i = 1; i <= steps; i++) {
      line.textContent = `${archive.name}  ${Math.round((i / steps) * 100)}% of ${formatSize(archive.size)}`;
      await S.wait(65);
    }
    line.textContent = `${archive.name}  ${formatSize(archive.size)}  9 MBps  04s`;
  };
  return [
    {
      id: "terminal",
      name: "Terminal",
      tag: "recommended",
      steps: [
        {
          title: "Install the sound plugins",
          text: "<p>Open a terminal and install <code>alsa-plugins</code> as root, once. Tank Yard plays sound and voice chat through it. With <code>sudo</code> or <code>doas</code>, use that instead of <code>su</code>.</p>",
          cmd: "su root -c 'pkg install alsa-plugins'",
          scene: async (S) => {
            desk(S, "freebsd");
            const t = terminal(S, "freebsd");
            await t.run("su root -c 'pkg install alsa-plugins'", 22);
            t.print("Password:");
            await S.wait(900);
            t.print("Updating FreeBSD repository catalogue...");
            await S.wait(500);
            t.print("New packages to be INSTALLED:");
            t.print("&nbsp;&nbsp;alsa-lib");
            t.print("&nbsp;&nbsp;alsa-plugins");
            t.print("Proceed with this action? [y/N]: y");
            await S.wait(600);
            t.print("[1/2] Installing alsa-lib...");
            await S.wait(400);
            t.print("[2/2] Installing alsa-plugins...");
            await S.wait(300);
            t.idle();
          },
        },
        {
          title: "Paste the command and press Enter",
          text: `${missing}<p>FreeBSD's own <code>fetch</code> downloads the installer, so curl isn't needed. It checks the SHA-256 checksum, installs to <code>~/.local/bin</code> and adds Tank Yard to your application menu. No root. Run it again to update.</p>`,
          cmd: CMD.freebsd,
          scene: async (S) => {
            desk(S, "freebsd");
            const t = terminal(S, "freebsd");
            await t.run(CMD.freebsd, 14);
            t.print('<span class="c">Tank Yard</span>');
            t.print(`Downloading ${tag} for freebsd-x86_64…`);
            await progress(S, t);
            t.print("Download verified.");
            await S.wait(300);
            t.print(`tankyard ${version}`);
            t.print("Added Tank Yard to your application menu.");
            t.print('<span class="g">Installed to /home/you/.local/bin</span>');
            t.print('Run "/home/you/.local/bin/tankyard", or add "/home/you/.local/bin" to your PATH.');
            t.idle();
          },
        },
        {
          title: "Play",
          text: "<p>Open Tank Yard from your desktop's application menu, under <b>Games</b>, or run <code>~/.local/bin/tankyard</code>. Your settings and progress stay when you update.</p>",
          scene: async (S) => {
            desk(S, "freebsd");
            await S.click(S.root.querySelector(".s-topbar .apps"));
            const menu = S.add(`<div class="s-menu" style="left:6px;top:18px"><div>Accessories</div><div>Development</div><div class="games">Games ›</div><div>Internet</div><div>Multimedia</div><div>System</div></div>`);
            await S.wait(350);
            const games = menu.querySelector(".games");
            await S.move(games);
            games.classList.add("hl");
            const sub = S.add(`<div class="s-menu" style="left:154px;top:${S.at(games)[1] - 13}px"><div class="app">Tank Yard</div></div>`);
            await S.wait(300);
            await S.click(sub.querySelector(".app"));
            menu.remove();
            sub.remove();
            await openGame(S, "freebsd");
          },
        },
      ],
    },
    {
      id: "archive",
      name: "Archive",
      steps: [
        {
          title: "Download the archive",
          text: `${missing}<p>${archive.name} · ${formatSize(archive.size)}. For FreeBSD 15 or newer on amd64.</p>`,
          download: "freebsd-x64",
          scene: async (S) => {
            desk(S, "freebsd");
            await download(S, "freebsd", archive);
          },
        },
        {
          title: "Extract it",
          text: "<p>In a terminal in your Downloads folder:</p>",
          cmd: `tar -xzf ${archive.name}`,
          scene: async (S) => {
            desk(S, "freebsd");
            const t = terminal(S, "freebsd", { title: "Terminal - you@freebsd: ~/Downloads" });
            await t.run("cd ~/Downloads", 40);
            await t.run(`tar -xzf ${archive.name}`, 24);
            await t.run("ls", 80);
            t.print(`<span class="c">${folder}</span>`);
            t.print(archive.name);
            t.idle();
          },
        },
        {
          title: "Run it",
          text: "<p>It needs <code>alsa-plugins</code> (<code>pkg install alsa-plugins</code> as root) and an X11 desktop. The folder also has the dedicated server, its rc.d script and the tools.</p>",
          cmd: `cd ${folder} && ./tankyard`,
          scene: async (S) => {
            desk(S, "freebsd");
            const t = terminal(S, "freebsd", { title: "Terminal - you@freebsd: ~/Downloads" });
            await t.run(`cd ${folder} && ./tankyard`, 24);
            await openGame(S, "freebsd");
          },
        },
      ],
    },
  ];
}

/* ---------- Controller ---------- */

export function initInstall(models) {
  const vector = models.classes.find((c) => c.id === "vector");
  tankSvg = vector ? svgModel(vector, models.colors, { pad: 6 }) : "";
  const stageEl = $("#stage");
  const sceneEl = $("#scene");
  const S = new Stage(stageEl);
  const stepsEl = $("#steps");
  const methodsEl = $("#methods");
  const playButton = $("#scene-play");
  let os = "windows";
  let method = 0;
  let index = 0;
  let list = [];
  let playing = !reducedMotion.matches;
  let visible = false;
  let done = new Set();
  let followsSystem = true;
  let buildVersion = 0;

  const fit = () => {
    S.k = sceneEl.clientWidth / 640;
    stageEl.style.transform = `scale(${S.k})`;
  };
  new ResizeObserver(fit).observe(sceneEl);
  fit();

  function file(key) {
    return asset(key) || { name: `tankyard-${key}`, size: 0, browser_download_url: release.release?.html_url || "#" };
  }

  function build() {
    buildVersion++;
    const tag = release.release?.tag_name || "v0.16.0";
    list = methods(os, file, tag);
    method = Math.min(method, list.length - 1);
    $$("#os-tabs .btn").forEach((b) => {
      const on = b.dataset.os === os;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $$("#requirements > div").forEach((d) => d.classList.toggle("current", d.dataset.os === os));
    methodsEl.innerHTML = "";
    list.forEach((m, i) => {
      methodsEl.append(
        h(
          "button",
          {
            class: "btn small",
            type: "button",
            "aria-pressed": String(i === method),
            onclick: () => {
              followsSystem = false;
              method = i;
              done = new Set();
              build();
              go(0);
            },
          },
          m.name,
          m.tag ? h("span", { class: "tag", text: `· ${m.tag}` }) : null,
        ),
      );
    });
    stepsEl.innerHTML = "";
    const steps = list[method].steps;
    steps.forEach((step, i) => {
      const item = h("li", { class: "step", tabindex: "0", "aria-label": `Step ${i + 1}: ${step.title}` });
      item.append(h("h3", { text: step.title }), h("div", { html: step.text }));
      if (step.cmd) {
        item.append(h("div", { class: "command" }, h("code", { text: step.cmd }), h("button", { class: "btn small", type: "button", "data-copy-prev": "" }, "Copy")));
      }
      if (step.download) {
        const row = h("div", { class: "row" });
        for (const key of [step.download, step.also].filter(Boolean)) {
          const f = asset(key);
          const pkg = PACKAGES.find((p) => p.key === key);
          if (!f) continue;
          row.append(
            h("a", {
              class: "btn small" + (key === step.download ? " primary" : ""),
              href: f.browser_download_url,
              text: `${pkg.kind} · ${pkg.arch} · ${formatSize(f.size)}`,
              onclick: () => {
                done.add(0);
                const version = buildVersion;
                const selectedStep = index;
                setTimeout(() => {
                  if (version === buildVersion && index === selectedStep) go(1);
                }, 600);
              },
            }),
          );
        }
        item.append(row);
      }
      item.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) return;
        go(i, true);
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target === item) go(i, true);
      });
      stepsEl.append(item);
    });
    $("#scene-segments").innerHTML = steps.map(() => "<i></i>").join("");
  }

  async function go(i, user = false) {
    const steps = list[method].steps;
    index = (i + steps.length) % steps.length;
    $$(".step", stepsEl).forEach((item, j) => {
      item.classList.toggle("current", j === index);
      item.classList.toggle("done", j !== index && done.has(j));
    });
    if (user && window.innerWidth <= 1000) sceneEl.scrollIntoView({ block: "nearest", behavior: reducedMotion.matches ? "instant" : "smooth" });
    $("#scene-counter").textContent = `Step ${index + 1} of ${steps.length}`;
    $("#scene-fill").style.width = `${((index + 1) / steps.length) * 100}%`;
    sceneEl.setAttribute("aria-label", `Animation: ${steps[index].title}`);
    const token = S.reset();
    S.instant = reducedMotion.matches || !visible || !playing;
    try {
      await steps[index].scene(S);
      if (!playing) S.pause();
      if (S.instant || !playing) return;
      await S.wait(2600);
      if (token === S.token && playing && visible) go(index + 1 < steps.length ? index + 1 : 0);
    } catch (error) {
      if (error !== CANCEL) console.error(error);
    }
  }

  function setPlaying(on) {
    playing = on;
    playButton.textContent = on ? "Pause" : "Play";
    playButton.setAttribute("aria-pressed", String(on));
    if (on) go(index);
    else S.pause();
  }

  $("#os-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-os]");
    if (!button || button.dataset.os === os) return;
    followsSystem = false;
    os = button.dataset.os;
    method = 0;
    done = new Set();
    build();
    go(0);
  });
  $("#os-tabs").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const order = ["windows", "mac", "linux", "freebsd"];
    const next = order[(order.indexOf(os) + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];
    $(`#os-tabs [data-os="${next}"]`).click();
    $(`#os-tabs [data-os="${next}"]`).focus();
  });
  $("#scene-prev").addEventListener("click", () => go(index - 1, true));
  $("#scene-next").addEventListener("click", () => go(index + 1, true));
  playButton.addEventListener("click", () => setPlaying(!playing));
  if (!playing) setPlaying(false);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      setPlaying(false);
      go(index);
    }
  });

  document.addEventListener("tankyard:download", (event) => {
    const { os: picked, method: kind } = event.detail;
    followsSystem = false;
    os = picked;
    const found = methods(os, file, release.release?.tag_name || "v0.16.0").findIndex((m) => m.id === kind);
    method = found < 0 ? 0 : found;
    done = new Set([0]);
    build();
    go(1);
  });

  onVisible(
    sceneEl,
    (isVisible) => {
      const was = visible;
      visible = isVisible;
      if (visible && !was) go(index);
      if (!visible && was) S.reset();
    },
    0.35,
  );

  build();
  go(0);
  onChange(() => {
    if (followsSystem) os = release.system.os || "windows";
    build();
    go(index);
  });
}
