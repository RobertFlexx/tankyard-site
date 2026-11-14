# Tank Yard website

The website for Tank Yard, a free, open-source tank arena for Windows, macOS, Linux and FreeBSD.

Download the latest release, follow installation guides, and explore the tank tree,
bosses, and game modes. Build and playtest your own map in the interactive Arena Workshop.

[Visit the site](https://robertflexx.github.io/tankyard-site/) · [Game repository](https://github.com/RobertFlexx/tankyard)

Try the Arena Workshop in your browser. Draw walls, add pads, then press
**Playtest** to drive around your map. **Pan** or Space-drag moves the view.
Your draft can be saved in this browser.

**Logic demo** loads a vault with two levers and an AND gate. Walk over both
levers to open it, or try OR and XOR from **Gates**. Undo restores your previous
map. This small demo connects levers directly to gates. The game's editor also
has signals, watchers, counters and scripts for building larger circuits.

Choose **Getting started** for the full editor tour, **Logic gates** for the
vault walkthrough, or **Motions** for a gatehouse with sliding doors, curves,
chained motions, lights and particles. Each tour has chapter buttons and captions.
The [motions video](https://robertflexx.github.io/tankyard-site/#motions-video)
runs for 2 minutes 15 seconds; its
[written tutorial](https://github.com/RobertFlexx/tankyard/blob/main/docs/motions-tutorial.md)
builds the same map step by step. The interactive guide below the workshop lets
you try every curve, motion piece and particle preset.

The [Animate and effects tutorial](https://robertflexx.github.io/tankyard-site/#effects-tutorial)
adds four replayable examples: easing into Bob, combining Bob and Sway, chaining
an arrival chime and flash, and freezing a group with Stop. Each has Pause and
Replay controls. The effects lab, thirteen palette pieces, launch demo and eight
sounds below it use the game's own calculations. Follow the
[written guide](https://github.com/RobertFlexx/tankyard/blob/main/docs/effects-tutorial.md)
or open the bundled [Effects Lab map](https://github.com/RobertFlexx/tankyard/tree/main/mods/effects_lab)
to build the same room in Tank Yard 1.1.0.

The download button always offers the latest published release.

Follow the [written vault tutorial](https://github.com/RobertFlexx/tankyard/blob/main/docs/logic-gates-tutorial.md)
to build the circuit in the game, or read the
[plugin guide](https://github.com/RobertFlexx/tankyard/blob/main/docs/editor-plugins.md)
to make your own editor tools.

[Bacteria](https://github.com/RobertFlexx/tankyard/blob/main/docs/bacteria.md),
added in 1.0.1, is a level-55 tank with a ten-second pocket dimension. Its guide
covers the escape, healing and return.

## Checking workshop changes

Run the numeric reference and logic tests before changing the editor examples:

```sh
npm test
```

The Pages workflow runs these checks before publishing. Test layouts in light and
dark themes, narrow windows and reduced motion too. `tools/build_data.py` rebuilds
tank and boss geometry from the game's model exporter; see its command help.
