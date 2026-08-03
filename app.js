// squish play shell — full-bleed toy, whisper-quiet chrome. No framework, no build step.
import { createEngine } from './engine.js';
import { SQUISHIES, SEED_INPUT } from './squishies.js';

const $ = (id) => document.getElementById(id);
const dom = {
  mount: $('mount'),
  overlayBoot: $('overlay-boot'),
  overlayError: $('overlay-error'),
  errorMsg: $('error-msg'),
  toast: $('toast'),
  dots: $('dots'),
  prevBtn: $('prev-btn'),
  nextBtn: $('next-btn'),
  settingsBtn: $('settings-btn'),
  scrim: $('scrim'),
  panel: $('panel'),
  panelClose: $('panel-close'),
  objGrid: $('obj-grid'),
  looksRow: $('looks-row'),
  soundToggle: $('sound-toggle'),
  handStatus: $('hand-status'),
  handToggle: $('hand-toggle'),
  tuningBody: $('tuning-body'),
  resetBtn: $('reset-btn')
};

const START_OBJECT = 'wax-blob'; // the butter bar

const state = {
  objId: START_OBJECT,
  lookIdx: {},
  audioOn: true,
  p: {},
  input: { ...SEED_INPUT },
  gestured: false,
  panelOpen: false
};

for (const s of SQUISHIES) {
  state.p[s.id] = {
    deform: { ...s.deform },
    material: { ...s.looks[0] },
    audio: { ...s.audio },
    shell: s.shell ? { ...s.shell } : null
  };
  state.lookIdx[s.id] = 0;
}

let engine = null;
let toastTimer = 0;
let lastActivity = 0;

// ---------- hand-input seam (module built elsewhere; absence must break nothing) ----------
const hand = { mod: null, api: null, status: 'unavailable', enabled: false, pointerHold: false, previewEl: null };

function safeSetHand(d) {
  if (engine && typeof engine.setHandInput === 'function') {
    try { engine.setHandInput(d); } catch (e) { /* engine without hand support */ }
  }
}

// engine.setHandInput is a no-op unless setHandActive(true); pointer input is
// gated off while active, so a pointer press temporarily hands control back.
function setEngineHand(on) {
  if (engine && typeof engine.setHandActive === 'function') {
    try { engine.setHandActive(!!on); } catch (e) { /* engine without hand support */ }
  }
}

function handIsDriving() {
  return hand.enabled && hand.status === 'live';
}

function syncEngineHand() {
  setEngineHand(handIsDriving() && !hand.pointerHold);
}

function updateHandPreview() {
  const want = handIsDriving() && hand.api && hand.api.video;
  if (want && !hand.previewEl) {
    const v = hand.api.video;
    v.style.cssText = 'position:fixed;right:14px;top:14px;width:192px;height:144px;object-fit:cover;border-radius:12px;transform:scaleX(-1);opacity:0.85;z-index:30;pointer-events:none;box-shadow:0 4px 16px rgba(120,90,60,0.18);background:#000;';
    document.body.appendChild(v);
    hand.previewEl = v;
  } else if (!want && hand.previewEl) {
    hand.previewEl.remove();
    hand.previewEl = null;
  }
}

async function probeHand() {
  try {
    // probe first so a missing module never surfaces a load error in the console
    const res = await fetch('./hand.js', { method: 'HEAD' });
    if (!res || !res.ok) { renderInput(); return; }
    const mod = await import('./hand.js');
    if (!mod || typeof mod.createHandInput !== 'function') { renderInput(); return; }
    hand.mod = mod;
    hand.status = 'ready';
    if (state.gestured) startHand();
  } catch (e) {
    hand.mod = null;
    hand.status = 'unavailable';
  }
  renderInput();
}

function startHand() {
  if (!hand.mod || hand.api) return;
  try {
    hand.api = hand.mod.createHandInput({
      onUpdate: (d) => {
        if (!handIsDriving() || hand.pointerHold) { gestReset(); return; }
        if (!d) return;
        safeSetHand(d);
        feedGesture(d);
      },
      onStatus: (s) => {
        hand.status = String(s || 'unavailable');
        syncEngineHand();
        updateHandPreview();
        renderInput();
      }
    });
    hand.enabled = true;
    if (typeof hand.api.start === 'function') hand.api.start();
  } catch (e) {
    hand.api = null;
    hand.status = 'unavailable';
  }
  renderInput();
}

function toggleHand() {
  if (!hand.mod) return;
  if (!hand.api) { startHand(); return; }
  hand.enabled = !hand.enabled;
  try {
    if (!hand.enabled && typeof hand.api.stop === 'function') hand.api.stop();
    if (hand.enabled && typeof hand.api.start === 'function') hand.api.start();
  } catch (e) { /* tolerate partial hand APIs */ }
  if (!hand.enabled) { hand.status = 'off'; setEngineHand(false); }
  updateHandPreview();
  renderInput();
}

// click/touch always works, even while the camera drives: a pointer press
// pauses hand control for the duration of the drag
window.addEventListener('pointerdown', () => {
  if (!handIsDriving()) return;
  hand.pointerHold = true;
  setEngineHand(false);
}, { capture: true });
const endPointerHold = () => {
  if (!hand.pointerHold) return;
  hand.pointerHold = false;
  syncEngineHand();
};
window.addEventListener('pointerup', endPointerHold);
window.addEventListener('pointercancel', endPointerHold);

// ---------- hand gestures: open-palm swipe switches objects, shake resets ----------
// Recognized from the same smoothed ~30Hz {x, y, closure} stream that drives the
// squeeze. Every fire path is gated so steering and squeezing can never trigger
// one: gestures need an open palm, a quiet period after any grip, an arm delay
// when the hand first appears, and a cooldown after each fired gesture. Swipe
// vs shake is decided at stroke end — a stroke that turns around is never a
// swipe, and a shake needs three confident reversals.
const G = {
  // must mirror HAND_GRAB / HAND_RELEASE in engine.setHandInput — the lockout
  // has to cover the whole time the engine could still be dragging
  GRAB: 0.35,
  RELEASE: 0.18,
  OPEN_MAX: 0.28,        // closure at/below this reads as an open palm
  GRIP_LOCKOUT_MS: 450,  // quiet period after any grip — releasing a squeeze must not swipe
  ARM_DELAY_MS: 300,     // hand must be present this long before gestures arm
  COOLDOWN_MS: 900,      // dead time after any fired gesture

  SPEED_START: 0.35,     // frame-widths/s of horizontal motion that opens a stroke
  SPEED_STOP: 0.22,      // below this…
  STOP_MS: 130,          // …for this long ends a stroke as "stopped"
  REVERSE_EPS: 0.022,    // retreat from the stroke extreme that counts as turning around

  SWIPE_MIN_TRAVEL: 0.34, // fraction of frame width — a confident sweep, not a cursor move
  SWIPE_MAX_MS: 550,      // the travel must happen fast
  SWIPE_MIN_SPEED: 1.1,   // average widths/s over the stroke
  SWIPE_MAX_DRIFT: 0.55,  // vertical wander allowed, as a fraction of the travel

  SHAKE_MIN_SEG: 0.055,   // min travel per half-wave of a shake
  SHAKE_REVERSALS: 3,     // confident reversals needed…
  SHAKE_WINDOW_MS: 1100   // …within this window
};

const gest = {
  presentAt: 0, lockedUntil: 0, cooldownUntil: 0, gripped: false,
  prevX: 0, prevT: 0, hasPrev: false,
  dir: 0, startX: 0, startT: 0, extremeX: 0, minY: 0, maxY: 0, slowSince: 0,
  reversals: []
};

function gestDisarm() {
  gest.dir = 0;
  gest.slowSince = 0;
  gest.reversals.length = 0;
}

function gestReset() {
  gestDisarm();
  gest.hasPrev = false;
  gest.presentAt = 0;
  gest.gripped = false;
}

function fireSwipe(dir) {
  stepObject(dir); // toasts the new object's name
  lastActivity = performance.now();
  gest.cooldownUntil = lastActivity + G.COOLDOWN_MS;
}

function fireShake() {
  if (engine) engine.reset();
  showToast('reset');
  lastActivity = performance.now();
  gest.cooldownUntil = lastActivity + G.COOLDOWN_MS;
}

function feedGesture(d) {
  const now = performance.now();
  if (!d || !d.present) { gestReset(); return; }
  if (!gest.presentAt) gest.presentAt = now;

  let vx = 0;
  if (gest.hasPrev) {
    const dt = (now - gest.prevT) / 1000;
    // a stream gap (hidden tab, worker hiccup) is not a real velocity
    vx = dt > 0 && dt < 0.25 ? (d.x - gest.prevX) / dt : 0;
  }
  gest.prevX = d.x; gest.prevT = now; gest.hasPrev = true;

  // grip hysteresis mirrors the engine: a light hold (closure between RELEASE
  // and OPEN_MAX) may still be dragging the squeeze — treat it as gripped
  if (d.closure >= G.GRAB) gest.gripped = true;
  else if (d.closure < G.RELEASE) gest.gripped = false;
  if (gest.gripped || d.closure > G.OPEN_MAX) {
    gest.lockedUntil = now + G.GRIP_LOCKOUT_MS;
    gestDisarm();
    return;
  }
  if (state.panelOpen || now - gest.presentAt < G.ARM_DELAY_MS || now < gest.lockedUntil || now < gest.cooldownUntil) {
    gestDisarm();
    return;
  }

  if (gest.dir === 0) {
    if (Math.abs(vx) >= G.SPEED_START) {
      gest.dir = vx > 0 ? 1 : -1;
      gest.startX = d.x; gest.startT = now;
      gest.extremeX = d.x; gest.minY = d.y; gest.maxY = d.y;
      gest.slowSince = 0;
    }
    return;
  }

  // stroke in progress
  if (d.y < gest.minY) gest.minY = d.y;
  if (d.y > gest.maxY) gest.maxY = d.y;
  if ((d.x - gest.extremeX) * gest.dir > 0) gest.extremeX = d.x;

  if ((gest.extremeX - d.x) * gest.dir > G.REVERSE_EPS) {
    // ended by turning around — a shake half-wave, never a swipe
    const len = Math.abs(gest.extremeX - gest.startX);
    gest.reversals = gest.reversals.filter((t) => now - t <= G.SHAKE_WINDOW_MS);
    if (len >= G.SHAKE_MIN_SEG) {
      gest.reversals.push(now);
      if (gest.reversals.length >= G.SHAKE_REVERSALS) {
        gestDisarm();
        fireShake();
        return;
      }
    }
    // measure the return half-wave from the turn point
    gest.dir = -gest.dir;
    gest.startX = gest.extremeX; gest.startT = now;
    gest.extremeX = d.x; gest.minY = d.y; gest.maxY = d.y;
    gest.slowSince = 0;
    return;
  }

  if (Math.abs(vx) < G.SPEED_STOP) {
    if (!gest.slowSince) gest.slowSince = now;
    if (now - gest.slowSince >= G.STOP_MS) {
      // ended by stopping (or leaving the frame, which freezes the stream) —
      // the only ending that can be a swipe
      const len = Math.abs(gest.extremeX - gest.startX);
      const dur = gest.slowSince - gest.startT; // motion effectively ended when it went slow
      const drift = gest.maxY - gest.minY;
      const dir = gest.dir;
      gest.dir = 0; gest.slowSince = 0;
      gest.reversals = gest.reversals.filter((t) => now - t <= G.SHAKE_WINDOW_MS);
      const speed = dur > 0 ? len / (dur / 1000) : 0;
      // one prior reversal is allowed: swipes often start with a small backswing.
      // two or more means a wave is in progress — its last stroke is not a swipe.
      if (gest.reversals.length < 2 &&
          len >= G.SWIPE_MIN_TRAVEL && dur <= G.SWIPE_MAX_MS && speed >= G.SWIPE_MIN_SPEED &&
          drift <= Math.max(0.09, len * G.SWIPE_MAX_DRIFT)) {
        fireSwipe(dir);
      }
    }
  } else {
    gest.slowSince = 0;
  }
}

// ---------- helpers ----------
function entry() {
  return SQUISHIES.find((o) => o.id === state.objId);
}

function objIndex() {
  return SQUISHIES.findIndex((o) => o.id === state.objId);
}

function showToast(text) {
  dom.toast.textContent = text.toLowerCase();
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 1300);
}

function selectObject(id, toast = true) {
  const en = SQUISHIES.find((o) => o.id === id);
  if (!en || !engine) return;
  engine.setObject(en);
  const st = state.p[id];
  for (const k of Object.keys(st.deform)) engine.setDeform(k, st.deform[k]);
  engine.setLook(st.material);
  for (const k of ['transmission', 'thickness', 'ior', 'clearcoat', 'roughness']) engine.setMaterial(k, st.material[k]);
  for (const k of Object.keys(state.input)) engine.setInput(k, state.input[k]);
  engine.setAudioParam('squishHz', st.audio.squishHz);
  engine.setAudioParam('popHz', st.audio.popHz);
  if (st.shell) for (const k of Object.keys(st.shell)) engine.setShell(k, st.shell[k]);
  state.objId = id;
  if (toast) showToast(en.name);
  renderAll();
}

function stepObject(dir) {
  const n = SQUISHIES.length;
  const i = (objIndex() + dir + n) % n;
  selectObject(SQUISHIES[i].id);
}

function pickLook(i) {
  const en = entry();
  const look = en.looks[i];
  state.p[en.id] = { ...state.p[en.id], material: { ...look } };
  engine.setLook(look);
  for (const k of ['transmission', 'thickness', 'ior', 'clearcoat', 'roughness']) engine.setMaterial(k, look[k]);
  state.lookIdx[en.id] = i;
  renderLooks();
}

function applyDeform(key, val) {
  const en = entry();
  const st = state.p[en.id];
  st.deform = { ...st.deform, [key]: val };
  engine.setDeform(key, val);
}

function setAudioOn(on) {
  state.audioOn = on;
  if (engine) engine.setAudio(on);
  dom.soundToggle.classList.toggle('on', on);
  dom.soundToggle.setAttribute('aria-checked', String(on));
}

function setPanel(open) {
  state.panelOpen = open;
  dom.panel.classList.toggle('open', open);
  dom.scrim.classList.toggle('open', open);
  dom.settingsBtn.classList.toggle('open', open);
  if (open) renderAll();
}

// ---------- render ----------
function renderDots() {
  dom.dots.innerHTML = '';
  SQUISHIES.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'dotbtn' + (o.id === state.objId ? ' active' : '');
    b.setAttribute('aria-label', o.name.toLowerCase());
    b.innerHTML = '<span class="d"></span>';
    b.addEventListener('click', () => selectObject(o.id));
    dom.dots.appendChild(b);
  });
}

function renderObjGrid() {
  dom.objGrid.innerHTML = '';
  SQUISHIES.forEach((o) => {
    const b = document.createElement('button');
    b.className = 'obj-chip' + (o.id === state.objId ? ' active' : '');
    b.textContent = o.name.toLowerCase();
    b.addEventListener('click', () => selectObject(o.id));
    dom.objGrid.appendChild(b);
  });
}

function renderLooks() {
  const en = entry();
  dom.looksRow.innerHTML = '';
  if (!en) return;
  en.looks.forEach((lk, i) => {
    const active = (state.lookIdx[en.id] || 0) === i;
    const b = document.createElement('button');
    b.className = 'swatch' + (active ? ' active' : '');
    b.title = lk.name.toLowerCase();
    b.setAttribute('aria-label', `look ${lk.name.toLowerCase()}`);
    b.style.background = `linear-gradient(135deg, ${lk.color} 30%, ${lk.sss || lk.color})`;
    b.addEventListener('click', () => pickLook(i));
    dom.looksRow.appendChild(b);
  });
}

const TUNE_ROWS = [
  ['falloffRadius', 'falloff', 0.1, 0.8, 0.01],
  ['depth', 'depth', 0.1, 0.9, 0.01],
  ['stiffness', 'stiffness', 2, 30, 0.1],
  ['bulge', 'bulge', 0, 1.5, 0.01]
];

function renderTuning() {
  const en = entry();
  dom.tuningBody.innerHTML = '';
  if (!en) return;
  if (en.geometry === 'wrap') {
    const note = document.createElement('div');
    note.className = 'tune-label';
    note.style.padding = '2px 0 8px';
    note.textContent = 'bubble wrap just pops — nothing to tune';
    dom.tuningBody.appendChild(note);
    return;
  }
  const st = state.p[en.id];
  for (const [key, label, min, max, step] of TUNE_ROWS) {
    const v = st.deform[key];
    const row = document.createElement('div');
    row.className = 'tune-row';
    row.innerHTML = `
      <div class="tune-head">
        <span class="tune-label">${label}</span>
        <span class="tune-val">${Number(v).toFixed(step >= 0.1 ? 1 : 2)}</span>
      </div>
    `;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(v);
    input.setAttribute('aria-label', label);
    const valEl = row.querySelector('.tune-val');
    input.addEventListener('input', () => {
      const nv = parseFloat(input.value);
      applyDeform(key, nv);
      valEl.textContent = nv.toFixed(step >= 0.1 ? 1 : 2);
    });
    row.appendChild(input);
    dom.tuningBody.appendChild(row);
  }
}

function renderInput() {
  const label = !hand.mod
    ? 'unavailable'
    : !hand.enabled
      ? 'off'
      : hand.status;
  dom.handStatus.textContent = label;
  dom.handStatus.className = 'badge' + (label === 'live' ? ' live' : label === 'denied' ? ' denied' : '');
  dom.handToggle.hidden = !hand.mod;
  dom.handToggle.textContent = hand.enabled ? 'turn off' : 'turn on';
}

function renderAll() {
  renderDots();
  renderObjGrid();
  renderLooks();
  renderTuning();
  renderInput();
}

// ---------- input ----------
function onKey(e) {
  const i = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].indexOf(e.key);
  if (i >= 0 && SQUISHIES[i]) selectObject(SQUISHIES[i].id);
  if (e.key === 'r' || e.key === 'R') engine && engine.reset();
  if (e.key === 'p' || e.key === 'P') { if (state.gestured && engine) engine.pulse(); }
  if (e.key === 'ArrowLeft') stepObject(-1);
  if (e.key === 'ArrowRight') stepObject(1);
  if (e.key === 'Escape' && state.panelOpen) setPanel(false);
}

function onFirstGesture() {
  if (state.gestured) return;
  state.gestured = true;
  lastActivity = performance.now();
  // WebAudio needs a gesture — create/resume the context now, honoring the toggle
  if (engine) engine.setAudio(state.audioOn);
  if (hand.mod && !hand.api) startHand();
}

// gentle idle wobble: if the toy sits untouched for a while, give it a scripted squish
function idleTick() {
  if (!state.gestured || !engine || state.panelOpen) return;
  if (performance.now() - lastActivity > 14000) {
    engine.pulse();
    lastActivity = performance.now();
  }
}

// Build every object's geometry during idle time so switching never pays the
// SDF raymarch (~100ms+ per object) on a keypress. Nearest neighbors first —
// they're one arrow-key away.
function warmGeometryCache() {
  if (!engine || typeof engine.prebuild !== 'function') return;
  const start = objIndex();
  const queue = SQUISHIES
    .map((s, i) => ({ s, d: Math.min(Math.abs(i - start), SQUISHIES.length - Math.abs(i - start)) }))
    .filter((q) => q.d > 0)
    .sort((a, b) => a.d - b.d)
    .map((q) => q.s);
  const idle = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn) => setTimeout(fn, 250);
  const warmNext = () => {
    const en = queue.shift();
    if (!en) return;
    try { engine.prebuild(en); } catch (e) { /* a failed build just falls back to on-demand */ }
    idle(warmNext);
  };
  idle(warmNext);
}

function boot() {
  window.addEventListener('keydown', onKey);
  try {
    engine = createEngine(dom.mount, {
      onFrame: () => {},
      onPop: () => {},
      onState: () => {}
    });
    engine.setBackdrop('void');
    engine.setAutoRotate(true);
    dom.overlayBoot.style.display = 'none';

    window.addEventListener('pointerdown', onFirstGesture, { capture: true });
    dom.mount.addEventListener('pointerdown', () => { lastActivity = performance.now(); });
    dom.mount.addEventListener('pointermove', () => { lastActivity = performance.now(); });
    setInterval(idleTick, 2500);

    dom.prevBtn.addEventListener('click', () => stepObject(-1));
    dom.nextBtn.addEventListener('click', () => stepObject(1));
    dom.settingsBtn.addEventListener('click', () => setPanel(!state.panelOpen));
    dom.panelClose.addEventListener('click', () => setPanel(false));
    dom.scrim.addEventListener('click', () => setPanel(false));
    dom.soundToggle.addEventListener('click', () => setAudioOn(!state.audioOn));
    dom.handToggle.addEventListener('click', toggleHand);
    dom.resetBtn.addEventListener('click', () => engine && engine.reset());

    selectObject(START_OBJECT, false);
    probeHand();
    warmGeometryCache();
  } catch (e) {
    dom.overlayBoot.style.display = 'none';
    dom.overlayError.style.display = 'flex';
    dom.errorMsg.textContent = `renderer fault — ${String((e && e.message) || e)}`;
  }
}

boot();
