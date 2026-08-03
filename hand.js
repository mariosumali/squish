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
  let rafId = 0;
  let lastVideoTime = -1;
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
    lastVideoTime = -1; missing = 0; hits = 0; present = false; seeded = false; sc = 0;
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
        numHands: 1,
        minHandDetectionConfidence: MIN_DETECT_CONF,
        minHandPresenceConfidence: MIN_PRESENCE_CONF,
        minTrackingConfidence: MIN_TRACK_CONF
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
