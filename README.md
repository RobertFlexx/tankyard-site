# Tank Yard website

The download page for [Tank Yard](https://github.com/RobertFlexx/tankyard), live at
**https://robertflexx.github.io/tankyard-site/**.

It is built to look and behave like the game's own menus:

- The title screen is a live arena. The download card detects Windows, macOS or Linux
  (and x86-64 or ARM64) and the button downloads that file from the newest release.
- **Install** shows each way to install, step by step, with an animated desktop for
  every step: the Windows setup and ZIP, PowerShell, the macOS package, Terminal and
  archive, and the Linux terminal and archive.
- **Arena Workshop** is a working copy of the map editor. Build walls, pads, portals and
  plates, then playtest them. The real tutorial plays beside it, and its chapters move the
  editor's tabs as it plays.
- The tank tree, bosses, arenas and practice challenges are drawn from the game's own
  vector models, so they match the game exactly.

## New releases

Nothing needs updating by hand when a new version of the game is released.

- Every visit asks the GitHub API for the latest release. The version, the download
  buttons, the install steps and **What's new** all come from that answer, so a new
  release appears as soon as it is published.
- Returning visitors get a notice the first time they visit after a new release.
- `data/release.json` is the site's own copy of the latest release, with the notes of the
  five releases before it. The page falls back on it when GitHub can't be reached or a
  visitor has used up GitHub's limit of 60 requests an hour.
- The **Pages** workflow refreshes that copy every hour and republishes the site when it
  changes. To publish straight away, run the workflow from the Actions tab.

GitHub pauses scheduled workflows in a repository that has had no activity for 60 days.
The page still shows new releases from the API. Re-enable the workflow in the Actions tab
to keep the saved copy current.

## Game data

`tools/build_data.py` rebuilds `data/` from a Tank Yard checkout with a release build of
the model exporter:

```sh
cargo build --locked --release -p tankyard-client --bin tankyard-models   # in the game
python3 tools/build_data.py ~/src/tankyard                               # here
```

`python3 tools/build_data.py --release-only` refreshes only `data/release.json`.

## Running it locally

It is a static site with no build step:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Python's server doesn't support range requests, so the
tutorial video can't seek there; GitHub Pages can.

The fonts are DejaVu Sans Bold and DejaVu Sans Mono, under the license in
`fonts/LICENSE-DejaVu.txt`.
