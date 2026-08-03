// hand.js — webcam hand-tracking input source (MediaPipe HandLandmarker).
// Self-contained ES module, no build step: the tasks-vision bundle is dynamically
// import()ed from jsdelivr at start(), WASM + model are fetched from hosted CDNs.
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

// Grip mapping: ratio = avg(fingertip->wrist distance) / palmSize, where
// palmSize = wrist->middle-MCP distance. Empirically an open flat hand sits
// around ~2.0 and a closed fist around ~1.2 regardless of hand size/distance
// to camera (the palm-size division makes it scale invariant).
const RATIO_OPEN = 2.0;
const RATIO_CLOSED = 1.2;

// Exponential smoothing factors (per processed frame, ~30-60 Hz).
const POS_ALPHA = 0.45;
const CLOSURE_ALPHA = 0.35;

// Frames without a detection before we declare the hand gone (debounce flicker).
const MISS_LIMIT = 6;

function dist2d(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
  let rafId = 0;
  let lastVideoTime = -1;
  let missing = 0;
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
    lastVideoTime = -1; missing = 0; present = false; seeded = false; sc = 0;
    onUpdate({ present: false, x: sx, y: sy, closure: 0 });
  }

  function processResult(res) {
    const lm = res && res.landmarks && res.landmarks[0];
    if (!lm) {
      missing++;
      if (present && missing > MISS_LIMIT) { present = false; sc = 0; }
      onUpdate({ present, x: sx, y: sy, closure: present ? sc : 0 });
      return;
    }
    missing = 0;
    present = true;

    // Palm center: mean of wrist + the four finger knuckles (stable under curl).
    let px = lm[WRIST].x, py = lm[WRIST].y;
    for (const i of MCPS) { px += lm[i].x; py += lm[i].y; }
    px /= 1 + MCPS.length;
    py /= 1 + MCPS.length;
    px = 1 - px; // mirror X so the cursor tracks like a mirror

    // Grip closure: how curled the fingers are toward the wrist, scale-invariant.
    const palmSize = Math.max(dist2d(lm[WRIST], lm[9]), 1e-4);
    let reach = 0;
    for (const i of TIPS) reach += dist2d(lm[i], lm[WRIST]);
    const ratio = reach / TIPS.length / palmSize;
    const rawClosure = Math.max(0, Math.min(1, (RATIO_OPEN - ratio) / (RATIO_OPEN - RATIO_CLOSED)));

    if (!seeded) { sx = px; sy = py; sc = rawClosure; seeded = true; }
    sx += (px - sx) * POS_ALPHA;
    sy += (py - sy) * POS_ALPHA;
    sc += (rawClosure - sc) * CLOSURE_ALPHA;
    onUpdate({ present: true, x: sx, y: sy, closure: sc });
  }

  function frame() {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      let res = null;
      try {
        res = landmarker.detectForVideo(video, performance.now());
      } catch (e) {
        setStatus('error');
        cleanup();
        return;
      }
      processResult(res);
    }
    schedule();
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
    // 2) load the tasks-vision bundle + WASM + model from CDN
    try {
      const { FilesetResolver, HandLandmarker } = await import(TASKS_VISION_URL);
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1
      });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      cleanup();
      setStatus('error');
      return;
    }
    if (status !== 'loading') { cleanup(); return; } // stop() during model load
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
