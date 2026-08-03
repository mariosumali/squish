# squish 🩷

A soft-body toybox that runs in the browser. Squish, dent, crack, and pop eleven
procedurally generated objects — gummy bears, jelly cubes, chocolate bars,
overripe bananas, bubble wrap — each with its own physical personality and
failure mode.

Everything is procedural: geometry, deformation, crack patterns, and audio are
generated at runtime. There are no assets to download and no build step.

## Running it

```sh
pnpm install
pnpm run dev
```

This starts a static server on [http://localhost:5173](http://localhost:5173)
and opens the app. That's it — the app is plain HTML + ES modules, so any
static file server works (it just can't be opened from `file://` because the
page dynamically imports ES modules).

> **Note:** the app pulls React, Babel, and Three.js from unpkg at runtime, so
> it needs an internet connection on first load.

## How to play

- **Press + drag** on an object to squish it. How it responds depends on the
  object — elastic things bounce back, dough keeps the dent, shelled things
  (butter bar, avocado) crack open when you squeeze hard enough.
- **Bubble wrap** is special: click or drag across cells to pop them.
- **Keyboard:** `1`–`9` select objects, `r` resets the current object,
  `p` runs a debug squish pulse.
- **Left panel** lists all objects with their failure mode
  (`elastic` / `dent` / `crack` / `pop`).
- **Right panel** exposes live tuning for the selected object: deformation
  (falloff, depth, stiffness, damping, bulge, permanence, recovery), shell
  cracking, PBR material (transmission, thickness, IOR, clearcoat, roughness),
  input response, and audio resonance. Drag horizontally on any slider.
- **Bottom bar** switches material "looks" (e.g. raspberry / lime / cola for
  the gummy bear) and shows the grip-closure meter.
- **snd on/off** (top right) toggles the procedural squish/pop audio.

## Project layout

| File | Role |
| --- | --- |
| `Squish.dc.html` | The app page — UI layout plus the component logic that wires HUD, sliders, keyboard, and object selection to the engine. |
| `engine.js` | The engine: Three.js scene, GLSL vertex-shader deformer (grab push, dents, Voronoi crack shattering), pointer input, procedural WebAudio. No UI code. |
| `squishies.js` | Content registry — pure data. Each entry defines an object's geometry type, failure mode, deform parameters, audio tuning, and material looks. |
| `support.js` | Generated runtime (`dc-runtime`) that boots the page: loads React from CDN, parses the `<x-dc>` template, and mounts the component. Do not edit — see the header comment for how it's rebuilt. |

### Adding a new squishy

Add an entry to `SQUISHIES` in [squishies.js](squishies.js) with an existing
`geometry` type (`bear`, `butter`, `cube`, `dough`, `peach`, `banana`,
`tomato`, `avocado`, `mallow`, `wrap`) and your own deform/audio/look values —
it appears in the object list automatically. New geometry types require a
matching builder in [engine.js](engine.js).

## Tech notes

- Deformation happens entirely on the GPU: the engine injects uniforms and a
  displacement function into Three.js's `MeshPhysicalMaterial` via
  `onBeforeCompile`. The CPU only tracks grab state, dent history, and crack
  events.
- Sound is 100% synthesized (filtered noise for squish, resonant pings for
  pops) — no audio files.
- The `hand` input source shown in the UI is a placeholder (`n/a in build`);
  mouse/pointer is the only input in this build.
