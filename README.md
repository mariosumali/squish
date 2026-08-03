# squish 🩷

A soft-body toybox in your browser. Twenty-one squishable objects — gummy
bears, jelly cubes, water balloons, bubble wrap, a snowglobe, a cheeseburger
you can literally eat — each with its own way of giving up: some bounce back,
some keep the dent, some crack, burst, shatter, or pop. Everything is
generated at runtime — geometry, deformation, particles, even the audio. No
assets, no build step.

## Run it

```sh
pnpm install
pnpm run dev
```

That opens [http://localhost:6173](http://localhost:6173). It's plain HTML +
ES modules, so any static server works (just not `file://`). Three.js is
vendored in `vendor/`, so it runs offline — only webcam hand tracking fetches
MediaPipe from a CDN on first use. Port already in use? A previous instance is
still running: `pkill -f http-server`.

## Play

- **Press and drag** an object to squish it. What happens next depends on the
  object: gummies bounce back (sugar squishies creep back slowly), dough and
  cheese keep the dent, brittle shells crack open, the water balloon and
  xiaolongbao strain then burst, ice and the snowglobe shatter into shards,
  bubble wrap pops cell by cell, and the cheeseburger loses a bite wherever
  you squeeze — five bites and it respawns.
- **Hand mode 🖐** — click `hand` in the input section to squish with your
  webcam: your palm moves the cursor, closing your fist squeezes. Click again
  to go back to the mouse.
- **Keys** — `1`–`9` pick objects, `r` resets, `p` fires a test squish.
- **Panels** — objects on the left, live tuning for the selected object on the
  right (deformation, cracking, materials, audio — drag any slider sideways).
  The bottom bar switches looks (raspberry / lime / cola…), `snd` toggles
  sound. On phones the panels become slide-in drawers and touch squishes
  directly.

## How it's put together

| File | Role |
| --- | --- |
| `index.html` | The page — HUD layout, sliders, drawers. |
| `app.js` | Wires the DOM to the engine. No rendering code. |
| `engine.js` | Three.js scene, GPU deformer, crack/burst/shatter FX, procedural audio. No UI code. |
| `hand.js` | Webcam hand tracking as a smoothed `{x, y, closure}` stream. |
| `hand.worker.js` | Runs MediaPipe inference off the main thread. |
| `squishies.js` | Pure data — every object's geometry, failure mode, and tuning. |

Want to add a squishy? Add an entry to `SQUISHIES` in
[squishies.js](squishies.js) with an existing geometry type and your own
deform/audio/look values — it appears in the list automatically. New shapes
need a builder in [engine.js](engine.js).

## Under the hood

- Deformation runs entirely on the GPU — the engine injects a displacement
  function into `MeshPhysicalMaterial` via `onBeforeCompile`; the CPU only
  tracks grabs, dents, and failure events.
- Sound is 100% synthesized WebAudio — filtered noise, resonant pings, no
  audio files.
- Hand tracking runs MediaPipe's HandLandmarker in a Web Worker at ~30Hz;
  grip strength is fingertip-to-wrist distance normalized by palm size, so it
  works at any distance from the camera.
- Performance tricks: adaptive pixel ratio, half-res transmission pass, a
  shader fast path while objects sit untouched, instanced bubble wrap, and
  geometries prebuilt during idle so switching never hitches.
