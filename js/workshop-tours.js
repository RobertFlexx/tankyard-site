const WORKSHOP_CHAPTERS = [
  { t: 0, title: "Intro", tab: null },
  { t: 6.85, title: "Set up", tab: "Map" },
  { t: 22.42, title: "Build", tab: "Object", mode: "build", cat: "Blocks" },
  { t: 47.48, title: "Edit", tab: "Object", mode: "edit" },
  { t: 63.33, title: "Pads", tab: "Object", mode: "build", cat: "Pads" },
  { t: 78.43, title: "Logic", tab: "Logic", mode: "build", cat: "Logic" },
  { t: 110.02, title: "Tools", tab: "Tools" },
  { t: 127.55, title: "Test", tab: "Check" },
  { t: 143.43, title: "Share", tab: "Files" },
];
const WORKSHOP_CAPTIONS = [
  [0, "Map editor on the main menu opens the Arena Workshop."],
  [3.05, "Canvas in the middle, tools below, settings on the right."],
  [6.85, "Name the arena in Map. Its id follows the name."],
  [10.26, "Then give it a size."],
  [14.61, "F fits the whole arena in view."],
  [16.61, "Drag a panel's edge to resize it. Double-click the edge to put it back."],
  [22.42, "In Build, pick a block and click to place it."],
  [28.48, "Drag to draw a wall of any size."],
  [34.12, "Swipe paints a cell everywhere the pointer passes."],
  [41.6, "Right-click an object to build more just like it."],
  [47.48, "Press 2 for Edit. Drag across the floor to select."],
  [50.85, "Drag to move it. Q and E turn it."],
  [55.36, "Alt-drag leaves a copy behind. Handles resize."],
  [63.33, "Conveyors carry tanks the way their arrows point."],
  [70.55, "A portal sends tanks to its exit. Drag the marker to move it."],
  [78.43, "Free picks an unused group. New objects join it."],
  [84.07, "Draw the door in that group."],
  [87.01, "A plate fires when a tank steps on it."],
  [93.43, "Set it to Hide group, and it opens the door for 5 seconds."],
  [97.85, "L draws a line from each trigger to what it changes."],
  [100.67, "P runs the logic in place. Hold T for a test tank."],
  [105.29, "The door opens, then closes again on its own."],
  [110.02, "Plugin packs add tools. Click where one should go, then open Tools."],
  [119.25, "Countdown wires a timer, a counter and a label as one undo step."],
  [122.38, "Run the logic and the label counts down."],
  [127.55, "Check lists anything that would stop a playtest or export."],
  [132.47, "Shift+F5 playtests from the pointer."],
  [136.35, "Step on the plate and the door opens."],
  [139.38, "The portal sends the tank to its exit, onto the conveyor."],
  [141.73, "Escape brings you back to the editor."],
  [143.43, "Ctrl+S saves an editable project."],
  [145.58, "Export makes a pack for the Mods page or a server."],
  [152.41, "F1 lists every shortcut."],
];
export const TOURS = {
  boards: {
  "title": "Boards",
  "label": "Boards tutorial",
  "duration": 42.63,
  "poster": "media/boards-poster.jpg",
  "file": "boards-tutorial",
  "guide": "boards-tutorial",
  "track": "media/boards-tutorial.vtt",
  "note": "The 1.7 board designer and a switch panel that opens a vault, recorded in the game. The browser editor does not simulate UI triggers.",
  "chapters": [
    {
      "t": 0.0,
      "title": "Board",
      "tab": "Object"
    },
    {
      "t": 12.88,
      "title": "Preview",
      "tab": "Object"
    },
    {
      "t": 25.76,
      "title": "Playtest"
    }
  ],
  "captions": [
    [
      0.0,
      "A Show UI widget can be a board: a grid of buttons, screens, digits, lights and meters."
    ],
    [
      4.05,
      "In the designer, click a square to add a cell, drag a cell to move it, or drag its corner to resize it."
    ],
    [
      9.28,
      "Each button signals its own channel and lights up from one bit of counter 1."
    ],
    [
      12.88,
      "P runs the logic preview, with the board over the canvas."
    ],
    [
      15.18,
      "Four receivers flip counter 1's bits. 8 and 4 make 1100, and the vault stays shut."
    ],
    [
      19.76,
      "Only 1011 opens it: 8, 2 and 1 on, 4 off."
    ],
    [
      25.76,
      "F5 plays the map. Everyone clicks the same board, and it stays up after each click."
    ],
    [
      32.28,
      "Clicking 8, 2 and 1 in the match opens the vault for every player."
    ],
    [
      39.93,
      "Escape returns to the workshop. The boards tutorial builds this panel step by step."
    ]
  ]
},
  styles: {
  "title": "Widget styles",
  "label": "Widget styles tutorial",
  "duration": 37.7,
  "poster": "media/widget-styles-poster.jpg",
  "file": "widget-styles-tutorial",
  "guide": "widget-styles-tutorial",
  "track": "media/widget-styles-tutorial.vtt",
  "note": "The 1.6 preset looks and style options, recorded in the game. The browser editor does not simulate UI triggers.",
  "chapters": [
    {
      "t": 0.0,
      "title": "Preview",
      "tab": "Object"
    },
    {
      "t": 5.87,
      "title": "Looks",
      "tab": "Object"
    },
    {
      "t": 24.11,
      "title": "Your own",
      "tab": "Object"
    },
    {
      "t": 30.7,
      "title": "Playtest"
    }
  ],
  "captions": [
    [
      0.0,
      "Select a Show UI trigger, then press P to run the logic preview."
    ],
    [
      3.47,
      "Its widget appears over the canvas as players will see it."
    ],
    [
      5.87,
      "Twelve preset looks change the colors and style in one click."
    ],
    [
      9.83,
      "Neon: cut corners, a grid fill and glowing capitals. Shift+P restarts the preview."
    ],
    [
      13.72,
      "Parchment: a ribbon with a double border and underlined choices."
    ],
    [
      17.62,
      "Hazard: a slanted, striped panel with outlined capitals and a striped bar."
    ],
    [
      21.51,
      "Royal: cut corners, a double border and a gradient fill."
    ],
    [
      24.11,
      "Or set each part yourself: here a tag shape, corner brackets and a glass fill."
    ],
    [
      30.7,
      "F5 plays the map, and the widget appears in the match."
    ],
    [
      35.0,
      "Escape returns to the workshop. Scripts set the same options with tankyard.hud."
    ]
  ]
},
  ui: {
  "title": "Menus and waypoints",
  "label": "Menus and waypoints tutorial",
  "duration": 34.233984,
  "poster": "media/ui-poster.jpg",
  "file": "ui-tutorial",
  "guide": "ui-tutorial",
  "track": "media/ui-tutorial.vtt",
  "note": "The 1.5 designer and Arcade Hall shop, recorded in the game. The browser editor does not simulate these UI triggers.",
  "chapters": [
    {
      "t": 0,
      "title": "Designer",
      "tab": "Object"
    },
    {
      "t": 12,
      "title": "Placement",
      "tab": "Object"
    },
    {
      "t": 18,
      "title": "Playtest"
    },
    {
      "t": 21.8,
      "title": "Waypoint"
    },
    {
      "t": 28.3,
      "title": "Reward"
    }
  ],
  "captions": [
    [
      0,
      "Arcade Hall open in the Arena Workshop. Select its Show UI trigger."
    ],
    [
      3,
      "The live preview shows six choices in a grid. Replay entrance runs its animation."
    ],
    [
      7,
      "{name} becomes the viewer\u2019s name. {cause} names the tank that set it off."
    ],
    [
      12,
      "Choose a screen position, an area in the arena, or the tank that set it off."
    ],
    [
      18,
      "Point at the shop and press Shift+F5 to playtest from here."
    ],
    [
      21.8,
      "Vault guide sends a signal that shows a personal waypoint."
    ],
    [
      24,
      "The arrow points toward the vault, clear of the normal HUD."
    ],
    [
      26,
      "Escape returns to the editor. Start another playtest to try another choice."
    ],
    [
      28.3,
      "+300 points rewards the player who chose it. The click does not fire a shot."
    ],
    [
      31,
      "Check lists map issues. Save keeps a project; Export makes a shareable pack."
    ]
  ]
},
  workshop: { title: "Getting started", label: "Arena Workshop tour", duration: 157.23,
    poster: "media/tutorial-poster.jpg", file: "arena-workshop-tutorial",
    guide: "map-editor",
    note: "The full editor tour. Choose Logic gates for the vault circuit, Motions for the gatehouse or Physics for push doors and light.",
    chapters: WORKSHOP_CHAPTERS, captions: WORKSHOP_CAPTIONS },
  logic: {
  "title": "Logic gates",
  "label": "Logic gates tour · 0.16",
  "duration": 101.63,
  "poster": "media/logic-gates-poster.jpg",
  "file": "logic-gates-tutorial",
  "guide": "logic-gates-tutorial",
  "track": "media/logic-gates-tutorial.vtt",
  "note": "Gates from 0.16. This browser demo connects levers directly to gates; the game supports full signal wiring.",
  "chapters": [
    {
      "t": 0.0,
      "title": "The circuit",
      "tab": "Logic"
    },
    {
      "t": 9.78,
      "title": "The AND gate",
      "tab": "Object",
      "mode": "build",
      "cat": "Gates"
    },
    {
      "t": 52.82,
      "title": "Try it",
      "tab": "Logic"
    },
    {
      "t": 70.69,
      "title": "Other gates",
      "tab": "Object"
    },
    {
      "t": 92.52,
      "title": "Check",
      "tab": "Check"
    }
  ],
  "captions": [
    [
      0.0,
      "A vault that opens while both levers are on."
    ],
    [
      2.2,
      "Each lever flips a counter between 0 and 1."
    ],
    [
      5.5,
      "A watcher sends signal 1 whenever its counter changes."
    ],
    [
      9.78,
      "Gates holds ready-made logic. Hover a tile to see what it does."
    ],
    [
      18.75,
      "Place an AND between the watchers and the wall."
    ],
    [
      24.02,
      "Set Do to Hide group, on group 1: the wall."
    ],
    [
      31.44,
      "Two conditions: counter 1 is on and counter 2 is on."
    ],
    [
      36.66,
      "Combine is All (AND): it acts only when both hold."
    ],
    [
      42.5,
      "Otherwise send a signal makes an if/else: a shut gate signals instead."
    ],
    [
      45.08,
      "Use signal 2, the receiver that closes the vault."
    ],
    [
      48.26,
      "A receiver on signal 2 shows the wall again."
    ],
    [
      52.82,
      "P runs the logic right in the editor."
    ],
    [
      56.35,
      "Click a counter to change it without driving."
    ],
    [
      58.91,
      "Both on: the wall hides, the alarm speaks and the lights cycle."
    ],
    [
      65.95,
      "Right-click clears a counter. The gate shuts and the wall comes back."
    ],
    [
      70.69,
      "Combine changes the gate. Just one (XOR) opens for exactly one lever."
    ],
    [
      82.26,
      "One lever on: open."
    ],
    [
      88.34,
      "Both on: shut again."
    ],
    [
      92.52,
      "Check looks the logic over too. This vault has nothing to fix."
    ],
    [
      97.59,
      "The written tutorial builds the whole vault, step by step."
    ]
  ]
},
  motions: {
  "title": "Motions",
  "label": "Motions tutorial \u00b7 doors, curves, lights and particles",
  "poster": "media/motions-poster.jpg",
  "file": "motions-tutorial",
  "guide": "motions-tutorial",
  "track": "media/motions-tutorial.vtt",
  "note": "A gatehouse in the game: sliding doors, curves, chains, lights and particles. Try the interactive motions guide below.",
  "duration": 134.67,
  "chapters": [
    {
      "t": 0.0,
      "title": "The door",
      "tab": "Object",
      "mode": "build"
    },
    {
      "t": 31.91,
      "title": "Curves",
      "tab": "Object",
      "mode": "edit"
    },
    {
      "t": 51.4,
      "title": "Try it",
      "tab": "Object"
    },
    {
      "t": 65.05,
      "title": "Chains",
      "tab": "Object"
    },
    {
      "t": 81.74,
      "title": "Lights",
      "tab": "Object",
      "cat": "Decor"
    },
    {
      "t": 101.16,
      "title": "Particles",
      "tab": "Object",
      "cat": "Decor"
    },
    {
      "t": 117.77,
      "title": "Play",
      "tab": "Check"
    }
  ],
  "captions": [
    [
      0.0,
      "A wall with a gap. The blocks in the gap are group 1: the door."
    ],
    [
      5.24,
      "Motion holds ready-made motions. Hover a tile to see what it does."
    ],
    [
      15.04,
      "Choose group 1 in the dock, then drag out a Door over the gap."
    ],
    [
      21.71,
      "In Edit, the Door shows its motion: group 1 moves 6% up over half a second."
    ],
    [
      27.2,
      "The ghost shows where the door goes. Drag the diamond to move it."
    ],
    [
      31.91,
      "Over sets how long it takes. The curve and mode set how it feels."
    ],
    [
      38.23,
      "Bounce bounces against the end."
    ],
    [
      41.7,
      "Back overshoots a little, and Elastic springs past the end."
    ],
    [
      47.86,
      "Cubic with Ease out starts fast and settles gently."
    ],
    [
      51.4,
      "P runs the logic in place. Hold T for a test tank at the pointer."
    ],
    [
      55.15,
      "Drive it into the Door's area, and the door slides up out of the way."
    ],
    [
      58.86,
      "Four seconds after the last tank arrives, the door slides shut."
    ],
    [
      61.54,
      "The neon beside the door blinks each time the door comes to rest."
    ],
    [
      65.05,
      "On arrive starts a motion when another ends. Shift+P runs the preview again."
    ],
    [
      71.25,
      "Each Drop waits for the barricade before it, and a Then announces the last."
    ],
    [
      76.52,
      "A Shuttle glides group 2 across every 6 seconds: cover that moves."
    ],
    [
      81.74,
      "F9 switches to the dark theme, where lights glow brightest."
    ],
    [
      86.11,
      "Torches waver like flames, and a lantern spreads a wide, soft light."
    ],
    [
      91.2,
      "Select a light to set its Flicker, from steady to a failing lamp."
    ],
    [
      97.68,
      "Ctrl+Shift+A selects every light, so one change reaches them all."
    ],
    [
      101.16,
      "Particle presets fill in every setting at once."
    ],
    [
      113.42,
      "Shape, Emit from, Speed and Gravity fine-tune them."
    ],
    [
      117.77,
      "Check finds nothing to fix. Shift+F5 playtests from the pointer."
    ],
    [
      124.62,
      "The door opens for real tanks too, and shuts behind them."
    ],
    [
      130.65,
      "The written tutorial builds the whole gatehouse, step by step."
    ]
  ]
},
  physics: {
  "title": "Physics",
  "label": "Physics and lighting tutorial",
  "poster": "media/physics-poster.jpg",
  "file": "physics-tutorial",
  "guide": "physics-tutorial",
  "track": "media/physics-tutorial.vtt",
  "note": "Push doors, a crate puzzle, paths and darkness in the game, then the Foundry arena. The browser demo doesn't push bodies yet.",
  "duration": 113.15,
  "chapters": [
    {
      "t": 0.0,
      "title": "Darkness",
      "tab": "Map"
    },
    {
      "t": 9.59,
      "title": "Paths",
      "tab": "Map"
    },
    {
      "t": 19.13,
      "title": "Groups",
      "tab": "Map"
    },
    {
      "t": 25.73,
      "title": "Bodies",
      "tab": "Object"
    },
    {
      "t": 33.44,
      "title": "Physics pieces"
    },
    {
      "t": 47.35,
      "title": "Preview"
    },
    {
      "t": 52.94,
      "title": "Push door"
    },
    {
      "t": 63.15,
      "title": "Crate"
    },
    {
      "t": 75.94,
      "title": "Lights"
    },
    {
      "t": 88.61,
      "title": "Foundry"
    }
  ],
  "captions": [
    [
      0.0,
      "Night Works, the example pack, open in the Arena Workshop."
    ],
    [
      3.7,
      "In the Map tab, Darkness sets how dark a round starts and the color tints it."
    ],
    [
      9.59,
      "Paths move a group through points, each with its own timing, wait and curve."
    ],
    [
      14.82,
      "The canvas draws the ferry's path from where it rests, with a dot riding it."
    ],
    [
      19.13,
      "The group list shows what each group holds. Hidden, Lock and Select act on all of it."
    ],
    [
      25.73,
      "Pushable turns a group into one solid body that tanks shove by driving into it."
    ],
    [
      29.65,
      "Choose which way it slides and how far, its weight, a spring home, friction and bounce."
    ],
    [
      33.44,
      "The Physics palette holds ready-made pieces. Hover one to see what it does."
    ],
    [
      43.59,
      "Lightning flashes a dark arena every nine seconds, then Go back after returns the dark."
    ],
    [
      47.44,
      "P runs the logic in place: the ferry rides its path and the ring pulses."
    ],
    [
      55.98,
      "Shift+F5 playtests from the pointer. Drive into the push door and it gives way."
    ],
    [
      58.86,
      "Steer past it and it springs shut behind you. The roof clears while you're inside."
    ],
    [
      66.21,
      "Shove the crate onto the plate to open the vault gate."
    ],
    [
      78.98,
      "The lights plate brightens the yard for ten seconds. Every six, the middle blasts tanks outward."
    ],
    [
      88.61,
      "Foundry, a new built-in arena for every mode, built from the same pieces."
    ],
    [
      91.8,
      "A furnace, belts, cranes on paths, and press rooms behind push doors."
    ],
    [
      96.25,
      "Belts carry tanks along, and cranes ride back and forth on their paths."
    ],
    [
      107.85,
      "Every ten seconds the furnace glows red, then blows back every tank near it."
    ]
  ]
}
};

// Tutorial fragments select the matching video as well as scrolling to it.
export function tourFromHash(hash) {
  let fragment;
  try { fragment = decodeURIComponent(hash); } catch { return null; }
  return Object.keys(TOURS).find((id) => fragment === `#${id}-video`) ?? null;
}
