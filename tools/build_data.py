#!/usr/bin/env python3
"""Rebuild the site's data files from a Tank Yard checkout.

    python3 tools/build_data.py ~/src/tankyard
    python3 tools/build_data.py --release-only

The checkout needs a release build of the model exporter:

    cargo build --locked --release -p tankyard-client --bin tankyard-models

Writes data/tanks.json, data/bosses.json, data/maps.json, data/game.json and
data/release.json. --release-only refreshes data/release.json alone: the
latest release, its files and the notes of the releases before it. The Pages
workflow runs it every hour, so the copy the site falls back on stays current.
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
DATA = SITE / "data"
REPO = "RobertFlexx/tankyard"
CYAN = "#00b2e1"

# Tank tree layout, kept identical to crates/tankyard-client/src/tank_tree_layout.rs.
COLUMN = 124.0
ROW = 100.0
TIER_GAP = 172.0
MAX_COLUMNS = 28

POLYGON = re.compile(r'<polygon points="([^"]*)" fill="rgb\((\d+),(\d+),(\d+)\)" fill-opacity="([\d.]+)"/>')
TEXT = re.compile(r'<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</text>')


def run_models(game, *args):
    exporter = game / "target" / "release" / "tankyard-models"
    if not exporter.exists():
        sys.exit(f"{exporter} is missing. Build it with:\n"
                 "  cargo build --locked --release -p tankyard-client --bin tankyard-models")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "sheet.svg"
        subprocess.run([str(exporter), *args, "--output", str(out)], cwd=game, check=True,
                       stdout=subprocess.DEVNULL)
        return out.read_text()


def polygons(svg):
    """Every filled polygon as (points, color)."""
    result = []
    for points, r, g, b, opacity in POLYGON.findall(svg):
        pts = [tuple(map(float, p.split(","))) for p in points.split()]
        color = "#%02x%02x%02x" % (int(r), int(g), int(b))
        if float(opacity) < 0.999:
            color += "%02x" % round(float(opacity) * 255)
        result.append((pts, color))
    return result


def centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def area(pts):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2


def primitive(pts, color, cx, cy, scale, digits):
    """A circle when the polygon is a fine regular one, otherwise a point list.

    Coordinates are relative to (cx, cy) and divided by scale."""
    c = centroid(pts)
    radii = [math.hypot(x - c[0], y - c[1]) for x, y in pts]
    if len(pts) >= 20 and max(radii) - min(radii) < max(radii) * 0.01:
        r = sum(radii) / len(radii)
        return [color, "c", round((c[0] - cx) / scale, digits), round((c[1] - cy) / scale, digits),
                round(r / scale, digits)]
    flat = []
    for x, y in pts:
        flat += [round((x - cx) / scale, digits), round((y - cy) / scale, digits)]
    return [color, "p", *flat]


def bounds(prims):
    lo = [math.inf, math.inf]
    hi = [-math.inf, -math.inf]
    for prim in prims:
        if prim[1] == "c":
            _, _, x, y, r = prim
            points = [(x - r, y - r), (x + r, y + r)]
        else:
            values = prim[2:]
            points = list(zip(values[::2], values[1::2]))
        for x, y in points:
            lo = [min(lo[0], x), min(lo[1], y)]
            hi = [max(hi[0], x), max(hi[1], y)]
    return [round(lo[0], 2), round(lo[1], 2), round(hi[0], 2), round(hi[1], 2)]


def palette(entries):
    """Replace colors with indices into one shared list."""
    colors = []
    for entry in entries:
        for prim in entry["prims"]:
            if prim[0] not in colors:
                colors.append(prim[0])
            prim[0] = colors.index(prim[0])
    return colors


def tree_layout(classes):
    """Port of Layout::new: card centers, tier rows, wiring lanes."""
    count = len(classes)
    index = {c["id"]: i for i, c in enumerate(classes)}
    parents = [[index[p] for p in c["parents"] if p in index] for c in classes]
    nodes = [[0.0, 0.0] for _ in range(count)]
    band = [0] * count
    lane = [0] * count
    covered = [False] * count
    blocked = [False] * count
    tiers = []
    rows_by_tier = []
    top = 0.0
    for tier in range(max(c["tier"] for c in classes) + 1):
        row = [i for i in range(count) if classes[i]["tier"] == tier]
        if not row:
            continue

        def center(i):
            items = parents[i]
            return sum(nodes[p][0] for p in items) / max(len(items), 1)

        row.sort(key=lambda i: (center(i), classes[i]["name"].encode()))
        rows = max(-(-len(row) // MAX_COLUMNS), 1)
        columns = -(-len(row) // rows)
        tiers.append([top, top + (rows - 1) * ROW, classes[row[0]]["min_level"]])
        b = len(tiers) - 1
        for slot, i in enumerate(row):
            column, line = slot // rows, slot % rows
            nodes[i] = [(column - max(columns - 1, 0) * 0.5) * COLUMN, top + line * ROW]
            covered[i] = line > 0
            blocked[i] = line + 1 < rows and slot + 1 < len(row)
            band[i] = b
        top += (rows - 1) * ROW + TIER_GAP
        rows_by_tier.append(row)

    def width_key(b):
        row = rows_by_tier[b]
        return (-(-len(row) // max(-(-len(row) // MAX_COLUMNS), 1)), b)

    widest = max(range(len(rows_by_tier)), key=width_key)
    children = [[] for _ in range(count)]
    for child, items in enumerate(parents):
        for p in items:
            children[p].append(child)

    def mean(items, fallback):
        return sum(nodes[i][0] for i in items) / len(items) if items else fallback

    def place(row, desired):
        order = sorted(range(len(row)), key=lambda k: (desired[k], k))
        wanted = [desired[k] for k in order]
        ordered = [row[k] for k in order]
        placed = []
        for x in wanted:
            placed.append(x if not placed else max(x, placed[-1] + COLUMN))
        drift = sum(w - p for w, p in zip(wanted, placed)) / max(len(placed), 1)
        for i, x in zip(ordered, placed):
            nodes[i][0] = x + drift
        row[:] = ordered

    for row in rows_by_tier[widest + 1:]:
        if len(row) > MAX_COLUMNS:
            continue
        place(row, [mean(parents[i], nodes[i][0]) for i in row])
    for b in range(widest - 1, -1, -1):
        row = rows_by_tier[b]
        if len(row) > MAX_COLUMNS:
            continue
        desired = []
        for i in row:
            below = [c for c in children[i] if band[c] == b + 1]
            desired.append(mean(below, nodes[i][0]))
        place(row, desired)
    for row in rows_by_tier:
        for position, i in enumerate(sorted(row, key=lambda i: nodes[i][0])):
            lane[i] = position
    left = min(n[0] for n in nodes)
    right = max(n[0] for n in nodes)
    shift = (left + right) * 0.5
    for n in nodes:
        n[0] -= shift
    edges = [[p, child] for child, items in enumerate(parents) for p in items]
    return {
        "nodes": [[round(x, 2), round(y, 2)] for x, y in nodes],
        "band": band,
        "lane": lane,
        "covered": [int(v) for v in covered],
        "blocked": [int(v) for v in blocked],
        "tiers": tiers,
        "edges": edges,
        "width": right - left + COLUMN,
        "height": max(top - TIER_GAP, 0) + ROW,
    }


def build_tanks(game):
    classes = json.loads((game / "assets/content/classes.json").read_text())["classes"]
    columns = 16
    svg = run_models(game, "--columns", str(columns))
    labels = TEXT.findall(svg)
    if len(labels) != len(classes):
        sys.exit(f"Expected {len(classes)} tank labels, found {len(labels)}")
    width = int(re.search(r'width="(\d+)"', svg).group(1))
    cell_w = width / columns
    first_label_y = float(labels[0][1])
    cell_h = first_label_y + 18
    grouped = [[] for _ in classes]
    for pts, color in polygons(svg):
        x, y = centroid(pts)
        slot = int(y // cell_h) * columns + int(x // cell_w)
        grouped[slot].append((pts, color))
    entries = []
    for i, cls in enumerate(classes):
        prims = grouped[i]
        bodies = [p for p in prims if p[1] == CYAN]
        if bodies:
            cx, cy = centroid(max(bodies, key=lambda p: area(p[0]))[0])
        else:
            cx = (i % columns + 0.5) * cell_w
            cy = (i // columns) * cell_h + (cell_h - 64) / 2 + 16
        shapes = [primitive(pts, color, cx, cy, 1.3, 2) for pts, color in prims]
        m0 = cls["multipliers"][0]
        r0 = 22 * min(max(math.sqrt(m0), 0.85), 1.6) * cls.get("body_scale", 1.0)
        entries.append({
            "id": cls["id"],
            "name": cls["name"],
            "description": cls["description"],
            "tier": cls["tier"],
            "level": cls["min_level"],
            "parents": cls["parents"],
            "strengths": cls["strengths"],
            "weaknesses": cls["weaknesses"],
            "ability": cls["ability"],
            "cooldown": cls["ability_cooldown"],
            "square": cls.get("hull_sides") == 4,
            "r0": round(r0, 3),
            "prims": shapes,
        })
        entries[-1]["box"] = bounds(shapes)
    colors = palette(entries)
    return {"colors": colors, "classes": entries, "layout": tree_layout(classes)}


def build_bosses(game):
    svg = run_models(game, "--bosses", "--columns", "4")
    table = {}
    doc = (game / "docs/bosses-and-learning.md").read_text()
    for name, weapons, hull in re.findall(r"^\| ([^|]+?) \| ([^|]+?) \| (\d+) \|$", doc, re.M):
        table[name] = (weapons, int(hull))
    labels = TEXT.findall(svg)
    grouped = [[] for _ in labels]
    for pts, color in polygons(svg):
        x, y = centroid(pts)
        grouped[int(y // 320) * 4 + int(x // 360)].append((pts, color))
    bosses = []
    for i, (_, _, name) in enumerate(labels):
        cx, cy = (i % 4) * 360 + 180, (i // 4) * 320 + 145
        prims = [primitive(pts, color, cx, cy, 1, 1) for pts, color in grouped[i]]
        weapons, hull = table.get(name, ("", 0))
        bosses.append({"name": name, "weapons": weapons, "hull": hull, "prims": prims,
                       "box": bounds(prims)})
    colors = palette(bosses)
    return {"colors": colors, "bosses": bosses}


def build_maps(game):
    svg = run_models(game, "--maps", "--columns", "4")
    meta = json.loads((game / "assets/content/maps.json").read_text())["maps"]
    frames = [tuple(map(float, f)) for f in re.findall(
        r'<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none"', svg)]
    if len(frames) != len(meta):
        sys.exit(f"Expected {len(meta)} map frames, found {len(frames)}")
    walls = [[] for _ in frames]
    covers = [[] for _ in frames]
    for pts, color in polygons(svg):
        x, y = centroid(pts)
        cell = int(y // 620) * 4 + int(x // 640)
        fx, fy, fw, fh = frames[cell]
        if fy <= y <= fy + fh:
            walls[cell].append(primitive(pts, color, fx, fy, 1, 1))
        else:
            covers[cell].append((pts, color))
    maps = []
    for i, m in enumerate(meta):
        fx, fy, fw, fh = frames[i]
        cover = []
        if covers[i]:
            xs = [x for pts, _ in covers[i] for x, _ in pts]
            ys = [y for pts, _ in covers[i] for _, y in pts]
            ox, oy = min(xs), min(ys)
            cover = [primitive(pts, color, ox, oy, 1, 1) for pts, color in covers[i]]
        maps.append({
            "id": m["id"], "name": m["name"], "description": m["description"],
            "width": m["width"], "height": m["height"], "capacity": m["capacity"],
            "frame": [round(fw, 2), round(fh, 2)], "prims": walls[i], "cover": cover,
        })
    entries = [{"prims": m["prims"] + m["cover"]} for m in maps]
    colors = palette(entries)
    return {"colors": colors, "maps": maps}


def build_game(game):
    core = (game / "crates/tankyard-core/src/model.rs").read_text()
    names = dict(re.findall(r'Self::(\w+) => "([^"]+)",', core.split("pub fn name(self)")[1].split("}")[0]))
    menu = (game / "crates/tankyard-client/src/menu.rs").read_text()
    blurb_block = menu.split("pub fn mode_blurb")[1].split("\n}\n")[0]
    blurbs = dict(re.findall(r'Mode::(\w+) => "([^"]+)",', blurb_block))
    order = re.findall(r"Self::(\w+),", core.split("pub const ALL")[1].split("];")[0])
    modes = [{"name": names[m], "blurb": blurbs[m]} for m in order]

    practice_src = (game / "crates/tankyard-client/src/practice.rs").read_text()
    practice = [
        {"title": t, "description": d, "tip": tip, "class": c}
        for t, d, tip, c in re.findall(
            r'title: "([^"]+)",\s*description: "([^"]+)",\s*tip: "([^"]+)",\s*class: "([^"]+)"',
            practice_src)
    ]
    playing = (game / "docs/playing.md").read_text()
    table = playing.split("## Controls")[1].split("\n\n")[1]
    controls = [list(map(str.strip, line.strip("|").split("|")))
                for line in table.splitlines()[2:] if line.startswith("|")]
    cargo = (game / "Cargo.toml").read_text()
    return {"modes": modes, "practice": practice, "controls": controls,
            "rust": re.search(r'rust-version = "([^"]+)"', cargo).group(1)}


def github(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "tankyard-site"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"https://api.github.com/repos/{REPO}/{path}", headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def build_release():
    """The latest release with its files, plus the notes of the five before it."""
    latest = github("releases/latest")
    earlier = [
        {key: release[key] for key in ("tag_name", "name", "published_at", "html_url", "body")}
        for release in github("releases?per_page=12")
        if not release["draft"] and not release["prerelease"] and release["published_at"]
        and release["tag_name"] != latest["tag_name"] and release["published_at"] < latest["published_at"]
    ]
    earlier.sort(key=lambda release: release["published_at"], reverse=True)
    return {
        "tag_name": latest["tag_name"],
        "name": latest["name"],
        "published_at": latest["published_at"],
        "html_url": latest["html_url"],
        "body": latest["body"],
        "assets": [
            {"name": a["name"], "size": a["size"], "digest": a.get("digest"),
             "browser_download_url": a["browser_download_url"]}
            for a in latest["assets"]
        ],
        "earlier": earlier[:5],
    }


def write(name, value):
    DATA.mkdir(exist_ok=True)
    path = DATA / name
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"{path.relative_to(SITE)}  {path.stat().st_size / 1024:.0f} KB")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("game", nargs="?", type=Path, help="Tank Yard checkout")
    parser.add_argument("--release-only", action="store_true")
    args = parser.parse_args()
    if not args.release_only:
        if not args.game:
            parser.error("give the path of a Tank Yard checkout, or --release-only")
        game = args.game.expanduser().resolve()
        write("tanks.json", build_tanks(game))
        write("bosses.json", build_bosses(game))
        write("maps.json", build_maps(game))
        write("game.json", build_game(game))
    write("release.json", build_release())


if __name__ == "__main__":
    main()
