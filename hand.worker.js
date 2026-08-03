// hand.worker.js — runs MediaPipe HandLandmarker off the main thread.
// Loaded as a CLASSIC worker (not module): MediaPipe's WASM glue loads via
// importScripts, which module workers forbid. The tasks-vision ESM bundle
// still arrives through dynamic import(), which classic workers do support.
// The page posts ImageBitmap frames (transferred, ≤30Hz, one in flight at a
// time); this worker replies with the first hand's raw landmarks or null.
// All smoothing/debounce/closure math stays in hand.js, so this file knows
// nothing about how the landmarks are used.

let landmarker = null;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      const { FilesetResolver, HandLandmarker } = await import(msg.visionUrl);
      const vision = await FilesetResolver.forVisionTasks(msg.wasmBase);
      landmarker = await HandLandmarker.createFromOptions(vision, msg.options);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'init-error', error: String(err) });
    }
  } else if (msg.type === 'frame') {
    let landmarks = null;
    try {
      const res = landmarker.detectForVideo(msg.bitmap, msg.ts);
      landmarks = (res && res.landmarks && res.landmarks[0]) || null;
    } catch (err) {
      msg.bitmap.close();
      self.postMessage({ type: 'detect-error', error: String(err) });
      return;
    }
    msg.bitmap.close();
    self.postMessage({ type: 'result', landmarks });
  } else if (msg.type === 'close') {
    if (landmarker) { try { landmarker.close(); } catch (err) {} landmarker = null; }
    self.close();
  }
};
