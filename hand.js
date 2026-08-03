// hand.js — webcam hand-tracking input source (MediaPipe HandLandmarker).
// Self-contained ES module, no build step: the tasks-vision bundle is dynamically
// import()ed from jsdelivr at start(), WASM + model are fetched from hosted CDNs.
// Inference runs in a Web Worker (hand.worker.js) so the 5-15ms detect call
// never blocks the render loop; if the worker can't come up (old browser,
// blocked module workers) it falls back to inline main-thread detection.
//
// createHandInput({ onUpdate, onStatus }) ->
//   { start(), stop(), video, status }
//
// onStatus(s): 'idle' | 'loading' | 'live' | 'denied' | 'error'
// onUpdate({ present, x, y, closure }): per processed video frame.
//   x/y   — palm center normalized to [0..1] of the frame, X mirrored so moving
//           your hand right moves the cursor right (webcam is a mirror).
//   closure — 0 (open hand) .. 1 (fist), exponentially smoothed.

const TASKS_VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Landmark indices (21-point MediaPipe hand model).
const WRIST = 0;
const MCPS = [5, 9, 13, 17]; // index/middle/ring/pinky knuckles — with wrist, a stable palm center
const TIPS = [8, 12, 16, 20]; // index/middle/ring/pinky fingertips

// Grip mapping: per-finger extension = (tip->wrist - knuckle->wrist) / palmSize,
// in 3D so tilting the hand toward the camera doesn't read as a curl. An
// extended finger's tip sits well past its knuckle (~+0.9 palm units); in a
// fist the tip curls back level with or inside the knuckle (~0). Scale
// invariant via the palmSize division.
const EXT_OPEN = 0.85;
const EXT_CLOSED = 0.15;

// Exponential smoothing factors (per processed frame, ~30-60 Hz).
const POS_ALPHA = 0.45;
const CLOSURE_ALPHA = 0.35;

// Detection cadence cap (~30Hz): bounds worker frame traffic, and in the
// inline fallback keeps the synchronous 5-15ms detect call from running more
// than ~30 times a second. The exponential smoothing absorbs the sample rate.
const MIN_DETECT_INTERVAL_MS = 33;

// Frames without a detection before we declare the hand gone (debounce flicker),
// and consecutive detections required before we declare it arrived — a single
// noisy frame (a face, a shoulder) must not register as a hand.
const MISS_LIMIT = 6;
const CONFIRM_LIMIT = 5;

// Detector confidence floors (MediaPipe defaults are 0.5, which lets phantom
// hands through on empty frames).
const MIN_DETECT_CONF = 0.7;
const MIN_PRESENCE_CONF = 0.7;
const MIN_TRACK_CONF = 0.6;

function dist3d(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function createHandInput(opts) {
  const onUpdate = (opts && opts.onUpdate) || (() => {});
  const onStatus = (opts && opts.onStatus) || (() => {});

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');

  let status = 'idle';
  let running = false;
  let stream = null;
  let landmarker = null;
  let worker = null;
  let workerMode = false;
  let inFlight = false; // one frame in the worker at a time — no queue buildup
  let rafId = 0;
  let lastVideoTime = -1;
  let lastDetectTs = 0;
  let missing = 0;
  let hits = 0;
  let present = false;
  let seeded = false;
  let sx = 0.5, sy = 0.5, sc = 0; // smoothed outputs

  function setStatus(s) {
    if (status === s) return;
    status = s;
    onStatus(s);
  }

  function cleanup() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
    video.srcObject = null;
    if (landmarker) { try { landmarker.close(); } catch (e) {} landmarker = null; }
    if (worker) {
      try { worker.postMessage({ type: 'close' }); } catch (e) {}
      try { worker.terminate(); } catch (e) {}
      worker = null;
    }
    workerMode = false; inFlight = false;
    lastVideoTime = -1; lastDetectTs = 0; missing = 0; hits = 0; present = false; seeded = false; sc = 0;
    onUpdate({ present: false, x: sx, y: sy, closure: 0 });
  }

  function processResult(res) {
    const lm = res && res.landmarks && res.landmarks[0];
    if (!lm) {
      hits = 0;
      missing++;
      if (present && missing > MISS_LIMIT) { present = false; sc = 0; seeded = false; }
      onUpdate({ present, x: sx, y: sy, closure: present ? sc : 0 });
      return;
    }
    missing = 0;
    hits++;
    if (!present && hits < CONFIRM_LIMIT) {
      onUpdate({ present: false, x: sx, y: sy, closure: 0 });
      return;
    }
    present = true;

    // Palm center: mean of wrist + the four finger knuckles (stable under curl).
    let px = lm[WRIST].x, py = lm[WRIST].y;
    for (const i of MCPS) { px += lm[i].x; py += lm[i].y; }
    px /= 1 + MCPS.length;
    py /= 1 + MCPS.length;
    px = 1 - px; // mirror X so the cursor tracks like a mirror

    // Grip closure: average per-finger curl (tip past knuckle = extended).
    const palmSize = Math.max(dist3d(lm[WRIST], lm[9]), 1e-4);
    let curl = 0;
    for (let f = 0; f < TIPS.length; f++) {
      const ext = (dist3d(lm[TIPS[f]], lm[WRIST]) - dist3d(lm[MCPS[f]], lm[WRIST])) / palmSize;
      curl += Math.max(0, Math.min(1, (EXT_OPEN - ext) / (EXT_OPEN - EXT_CLOSED)));
    }
    const rawClosure = curl / TIPS.length;

    if (!seeded) { sx = px; sy = py; sc = rawClosure; seeded = true; }
    sx += (px - sx) * POS_ALPHA;
    sy += (py - sy) * POS_ALPHA;
    sc += (rawClosure - sc) * CLOSURE_ALPHA;
    onUpdate({ present: true, x: sx, y: sy, closure: sc });
  }

  function frame() {
    if (!running) return;
    const now = performance.now();
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastDetectTs >= MIN_DETECT_INTERVAL_MS) {
      if (workerMode) {
        if (!inFlight) {
          lastVideoTime = video.currentTime;
          lastDetectTs = now;
          inFlight = true;
          createImageBitmap(video).then((bmp) => {
            if (!running || !worker) { bmp.close(); inFlight = false; return; }
            worker.postMessage({ type: 'frame', bitmap: bmp, ts: now }, [bmp]);
          }).catch(() => { inFlight = false; });
        }
      } else {
        lastVideoTime = video.currentTime;
        lastDetectTs = now;
        let res = null;
        try {
          res = landmarker.detectForVideo(video, now);
        } catch (e) {
          setStatus('error');
          cleanup();
          return;
        }
        processResult(res);
      }
    }
    schedule();
  }

  function onWorkerMessage(e) {
    const m = e.data;
    if (m.type === 'result') {
      inFlight = false;
      if (running) processResult({ landmarks: m.landmarks ? [m.landmarks] : [] });
    } else if (m.type === 'detect-error') {
      inFlight = false;
      setStatus('error');
      cleanup();
    }
  }

  function landmarkerOptions() {
    return {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: MIN_DETECT_CONF,
      minHandPresenceConfidence: MIN_PRESENCE_CONF,
      minTrackingConfidence: MIN_TRACK_CONF
    };
  }

  // Bring up the worker; resolves false on any failure (no module workers,
  // CDN blocked, GPU init failed in the worker) so start() can fall back inline.
  function startWorker() {
    return new Promise((resolve) => {
      if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') { resolve(false); return; }
      let w;
      try {
        // classic worker on purpose: MediaPipe's WASM glue loads via
        // importScripts, which throws in module workers ("ModuleFactory not
        // set"); classic workers still support dynamic import() for the bundle
        w = new Worker(new URL('./hand.worker.js', import.meta.url));
      } catch (e) { resolve(false); return; }
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { w.terminate(); } catch (e) {}
        resolve(false);
      };
      const timer = setTimeout(fail, 30000); // model + wasm can be slow on first fetch
      w.onerror = fail;
      w.onmessage = (e) => {
        if (settled) return;
        if (e.data && e.data.type === 'ready') {
          settled = true;
          clearTimeout(timer);
          worker = w;
          w.onmessage = onWorkerMessage;
          w.onerror = () => { setStatus('error'); cleanup(); };
          resolve(true);
        } else if (e.data && e.data.type === 'init-error') fail();
      };
      w.postMessage({ type: 'init', visionUrl: TASKS_VISION_URL, wasmBase: WASM_BASE_URL, options: landmarkerOptions() });
    });
  }

  function schedule() {
    if (!running) return;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(frame);
    else rafId = requestAnimationFrame(frame);
  }

  async function start() {
    if (running || status === 'loading') return;
    setStatus('loading');
    // 1) camera permission first — fail fast on deny
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError');
      cleanup();
      setStatus(denied ? 'denied' : 'error');
      return;
    }
    if (status !== 'loading') { // stop() was called while we awaited the camera
      for (const t of stream.getTracks()) t.stop();
      stream = null;
      return;
    }
    // 2) start the video, then bring up inference — worker first, inline fallback
    try {
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      cleanup();
      setStatus('error');
      return;
    }
    if (status !== 'loading') { cleanup(); return; } // stop() while starting video
    workerMode = await startWorker();
    if (status !== 'loading') { cleanup(); return; } // stop() during worker init
    if (!workerMode) {
      try {
        const { FilesetResolver, HandLandmarker } = await import(TASKS_VISION_URL);
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        landmarker = await HandLandmarker.createFromOptions(vision, landmarkerOptions());
      } catch (e) {
        cleanup();
        setStatus('error');
        return;
      }
      if (status !== 'loading') { cleanup(); return; } // stop() during model load
    }
    running = true;
    setStatus('live');
    schedule();
  }

  function stop() {
    cleanup();
    setStatus('idle');
  }

  return {
    start,
    stop,
    get video() { return video; },
    get status() { return status; }
  };
}
