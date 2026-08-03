# squish 🩷

A soft-body toybox that runs in the browser. Squish, dent, crack, pop, burst,
shatter, and even eat twenty-one procedurally generated objects — gummy bears,
jelly cubes, chocolate bars, water balloons, ice cubes, bubble wrap, sugar
squishies, snowglobes, cheese wedges, xiaolongbao, cheeseburgers, crème
brûlée, candy apples — each with its own physical personality and failure
mode.

Everything is procedural: geometry, deformation, crack patterns, particles, and
audio are generated at runtime. There are no assets to download and no build
step.

## Running it

```sh
pnpm install
pnpm run dev
```

This starts a static server on [http://localhost:6173](http://localhost:6173)
and opens the app. That's it — the app is plain HTML + ES modules, so any
static file server works (it just can't be opened from `file://` because the
page dynamically imports ES modules).

> **Notes:** Three.js is vendored in `vendor/`, so the core app works fully
> offline. Only hand input still needs the network on first use (MediaPipe's
> WASM + model come from CDNs). If `pnpm run dev` says the address is already
> in use, a previous instance is still running — `pkill -f http-server` clears
> it.

## How to play

- **Press + drag** on an object to squish it. How it responds depends on its
  failure mode:
  - `elastic` — bounces right back (gummy bear, jelly cube, tomato…). The
    sugar squishy and memory foam are the slow-recovery variants: they compress
    deep and creep back to shape over a few seconds.
  - `dent` — keeps the dent (dough, banana, cheese wedge)
  - `crack` — a shell cracks open under hard squeezing (butter bar, avocado,
    crème brûlée, candy apple, choco egg)
  - `chomp` — the cheeseburger gets eaten: every hard squeeze bites a chunk
    out of the mesh right where you grabbed it, with crumbs; after five bites
    it's gone (then respawns)
  - `pop` — bubble wrap: click or drag across cells to pop them
  - `burst` — the water balloon and xiaolongbao strain, then burst in a spray
    of droplets (soup, in the bao's case)
  - `shatter` — the ice cube and snowglobe resist, then shatter into tumbling
    shards
- **Hand input 🖐** — click the `hand` row in the input-source section to
  drive squishing with your webcam: MediaPipe hand tracking maps your palm to
  the cursor and your grip (open hand → fist) to squeeze strength. A small
  camera preview shows while it's live; click again to go back to mouse. If
  camera permission is denied the app just stays on mouse input.
- **Keyboard:** `1`–`9` select objects, `r` resets the current object,
  `p` runs a debug squish pulse.
- **Left panel** lists all objects with their failure mode; **right panel**
  exposes live tuning for the selected object: deformation (falloff, depth,
  stiffness, damping, bulge, permanence, recovery), shell cracking,
  burst/shatter thresholds, PBR material (transmission, thickness, IOR,
  clearcoat, roughness), input response, and audio resonance. Drag
  horizontally on any slider.
- **Bottom bar** switches material "looks" (e.g. raspberry / lime / cola for
  the gummy bear) and shows the grip-closure meter.
- **snd on/off** (top right) toggles the procedural squish/pop audio.
- **On phones/small windows** the side panels become slide-in drawers — use
  the `obj` and `tune` buttons in the top bar. Touch dragging squishes
  directly.

## Project layout

| File | Role |
| --- | --- |
| `index.html` | The app page — DOM layout and styling for the HUD, sliders, panels, and mobile drawers. |
| `app.js` | Wires the DOM to the engine: state, keyboard, slider drag handling, object/look selection, hand-input UI. No rendering code. |
| `engine.js` | The engine: Three.js scene, GLSL vertex-shader deformer (grab push, dents, Voronoi crack shattering), burst/shatter particle FX, pointer + external hand input, procedural WebAudio. No UI code. |
| `hand.js` | Webcam hand tracking — MediaPipe HandLandmarker (loaded from CDN) turned into a smoothed `{x, y, closure}` stream. |
| `squishies.js` | Content registry — pure data. Each entry defines an object's geometry type, failure mode, deform parameters, audio tuning, and material looks. |

### Adding a new squishy

Add an entry to `SQUISHIES` in [squishies.js](squishies.js) with an existing
`geometry` type (`bear`, `butter`, `cube`, `dough`, `peach`, `banana`,
`tomato`, `avocado`, `mallow`, `wrap`, `balloon`, `ice`, `sugar`, `globe`,
`cheese`, `bao`, `burger`, `brulee`, `apple`, `egg`) and your own
deform/audio/look values — it appears in the object list automatically.
Objects with `failureMode: 'crack'` take a `shell: {...}` block, `'burst'` a
`burst: {...}` block, `'shatter'` a `shatter: {...}` block, and `'chomp'` a
`chomp: {threshold, radius, bites}` block (bites carve the mesh on the CPU and
persist until reset/respawn). New geometry types require a matching builder in
[engine.js](engine.js).

## Tech notes

- Deformation happens entirely on the GPU: the engine injects uniforms and a
  displacement function into Three.js's `MeshPhysicalMaterial` via
  `onBeforeCompile`. The CPU only tracks grab state, dent history, and
  crack/burst/shatter events.
- Burst spray is a gravity-driven `THREE.Points` cloud colored from the
  current look; shatter swaps the mesh for ~26 tumbling shard tetrahedra that
  fade and respawn.
- Sound is 100% synthesized (filtered noise for squish, resonant pings for
  pops, splats and shatter snaps built from the same primitives) — no audio
  files.
- Hand tracking runs MediaPipe's HandLandmarker in VIDEO mode; grip closure is
  the average fingertip-to-wrist distance normalized by palm size, so it's
  distance-invariant. Tuning constants live at the top of
  [hand.js](hand.js). Inference is capped at ~30Hz so it never eats a whole
  frame budget.
- Performance: the renderer adapts its pixel ratio to a rolling FPS estimate
  (transmission renders the scene twice, so resolution is the main GPU cost);
  the vertex shader skips all displacement work while the object is untouched;
  hover raycasts are coalesced to one per rendered frame; bubble wrap draws as
  two `InstancedMesh`es instead of 54 meshes; and all object geometries are
  prebuilt during idle time so switching never hitches.
