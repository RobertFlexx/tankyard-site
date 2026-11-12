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
  workshop: { title: "Getting started", label: "Arena Workshop tour", duration: 157.23,
    poster: "media/tutorial-poster.jpg", file: "arena-workshop-tutorial",
    chapters: WORKSHOP_CHAPTERS, captions: WORKSHOP_CAPTIONS },
  logic: {
  "title": "Logic gates",
  "label": "Logic gates tour · next release",
  "duration": 101.63,
  "poster": "media/logic-gates-poster.jpg",
  "file": "logic-gates-tutorial",
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
}
};
