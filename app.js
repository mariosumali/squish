// squish play shell — full-bleed toy, whisper-quiet chrome. No framework, no build step.
import { createEngine, BACKGROUNDS } from './engine.js';
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
  bgRow: $('bg-row'),
  soundToggle: $('sound-toggle'),
  spinToggle: $('spin-toggle'),
  handStatus: $('hand-status'),
  handToggle: $('hand-toggle'),
  handHint: $('hand-hint'),
  zonePrev: $('zone-prev'),
  zoneNext: $('zone-next'),
  tuningBody: $('tuning-body'),
  resetBtn: $('reset-btn')
};

const START_OBJECT = 'wax-blob'; // the butter bar

const state = {
  objId: START_OBJECT,
  bgId: 'cream',
  lookIdx: {},
  audioOn: true,
  spinOn: true,
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
const hand = { mod: null, api: null, status: 'unavailable', enabled: false, wanted: false, pointerHold: false, previewEl: null };

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
  updateHandZones();
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
    if (hand.wanted) startHand();
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
  syncEngineHand();
}, { capture: true });
const endPointerHold = () => {
  if (!hand.pointerHold) return;
  hand.pointerHold = false;
  syncEngineHand();
};
window.addEventListener('pointerup', endPointerHold);
window.addEventListener('pointercancel', endPointerHold);

// ---------- hand gestures: edge zones click prev/next, shake resets ----------
// Recognized from the same smoothed ~30Hz {x, y, closure} stream that drives the
// squeeze. Prev/next is a mid-air button press on purpose: hover the on-screen
// zone at either edge with an open hand, then close your fist to "click" it —
// velocity gestures proved too fragile against real tracking noise, and a click
// needs no timing at all. The hand must re-open before it can click again, so a
// held fist can't repeat-fire. Shake keeps its own gates: open palm, a quiet
// period after any grip, an arm delay when the hand first appears.
const G = {
  // must mirror HAND_GRAB / HAND_RELEASE in engine.setHandInput — the lockout
  // has to cover the whole time the engine could still be dragging
  GRAB: 0.35,
  RELEASE: 0.18,
  OPEN_MAX: 0.30,        // closure at/below this reads as an open palm — a noisy
                         // blip above it only pauses gestures, it doesn't lock out
  GRIP_LOCKOUT_MS: 450,  // quiet period after a real grip
  ARM_DELAY_MS: 300,     // hand must be present this long before gestures arm
  COOLDOWN_MS: 700,      // dead time after a fired shake

  // edge click (prev/next object): hover a zone, close your hand to press it.
  // The object lives at center frame, so a grab at an edge is always deliberate
  // — position plus a closure edge, nothing velocity- or timing-based.
  EDGE_IN: 0.15,          // entering this outer band hovers the zone…
  EDGE_OUT: 0.19,         // …and only retreating past this leaves it (hysteresis)
  CLICK_REARM: 0.25,      // hand must re-open below this before it can click again
  CLICK_DEBOUNCE_MS: 300, // min gap between zone clicks
  CLICK_FLASH_MS: 220,    // zone flashes full-bright right after a click

  // shake (reset): three confident direction reversals
  SPEED_START: 0.32,     // frame-widths/s of horizontal motion that opens a stroke
  SPEED_STOP: 0.26,      // below this…
  STOP_MS: 130,          // …for this long quietly closes the stroke
  REVERSE_EPS: 0.035,    // retreat from the stroke extreme that counts as turning
                         // around — above tracking jitter so noise can't reverse
  SHAKE_MIN_SEG: 0.04,   // min travel per half-wave (smoothing shrinks fast waves)
  SHAKE_REVERSALS: 3,    // confident reversals needed…
  SHAKE_WINDOW_MS: 1400  // …within this window
};

// the on-screen edge zones: faint chevron pills that fill as the dwell charges
function styleZone(el, p) {
  if (!el) return;
  el.style.opacity = String(0.45 + 0.55 * p);
  el.style.transform = `translateY(-50%) scale(${1 + 0.18 * p})`;
  el.style.background = `rgba(255, 233, 241, ${0.45 + 0.4 * p})`;
  el.style.color = p > 0 ? '#d14a75' : '';
}

function setZoneUI(zone, p) {
  styleZone(dom.zonePrev, zone === -1 ? p : 0);
  styleZone(dom.zoneNext, zone === 1 ? p : 0);
}

function updateHandZones() {
  const show = handIsDriving() && !hand.pointerHold;
  if (dom.zonePrev) dom.zonePrev.hidden = !show;
  if (dom.zoneNext) dom.zoneNext.hidden = !show;
  if (!show) setZoneUI(0, 0);
}

const gest = {
  presentAt: 0, lockedUntil: 0, cooldownUntil: 0, gripped: false,
  prevX: 0, prevT: 0, hasPrev: false,
  zone: 0, zoneArmed: false, zoneFireAt: 0,
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
  gest.zone = 0;
  gest.zoneArmed = false;
  setZoneUI(0, 0);
}

function fireShake() {
  if (engine) engine.reset();
  showToast('reset');
  lastActivity = performance.now();
  gest.cooldownUntil = lastActivity + G.COOLDOWN_MS;
}

// edge click: hover a zone with an open hand, close your fist to press it.
// Entering a zone always starts un-armed, so a fist carried into the zone
// (e.g. dragging a squeeze outward) can never fire — only open-then-close does.
function updateZoneClick(d, now, armed) {
  let zone = gest.zone;
  if (zone === 0) {
    if (d.x <= G.EDGE_IN) zone = -1;
    else if (d.x >= 1 - G.EDGE_IN) zone = 1;
  } else if (zone === -1 && d.x > G.EDGE_OUT) {
    zone = 0;
  } else if (zone === 1 && d.x < 1 - G.EDGE_OUT) {
    zone = 0;
  }
  if (zone !== gest.zone) { gest.zone = zone; gest.zoneArmed = false; }
  if (!zone) { setZoneUI(0, 0); return; }
  if (!armed) { gest.zoneArmed = false; setZoneUI(zone, 0); return; }
  if (d.closure <= G.CLICK_REARM) gest.zoneArmed = true;
  if (gest.zoneArmed && d.closure >= G.GRAB && now - gest.zoneFireAt >= G.CLICK_DEBOUNCE_MS) {
    gest.zoneArmed = false;
    gest.zoneFireAt = now;
    stepObject(zone); // toasts the new object's name
    lastActivity = now;
  }
  // armed hover glows, a fresh click flashes full-bright
  const p = now - gest.zoneFireAt < G.CLICK_FLASH_MS ? 1 : gest.zoneArmed ? 0.55 : 0.15;
  setZoneUI(zone, p);
}

function feedGesture(d) {
  const now = performance.now();
  if (!d || !d.present) { gestReset(); return; }
  if (!gest.presentAt) gest.presentAt = now;

  let vx = 0, dtMs = 0;
  if (gest.hasPrev) {
    dtMs = Math.min(now - gest.prevT, 100); // a stream gap is not a real interval
    const dt = dtMs / 1000;
    vx = dt > 0 ? (d.x - gest.prevX) / dt : 0;
  }
  gest.prevX = d.x; gest.prevT = now; gest.hasPrev = true;

  // grip hysteresis mirrors the engine: once closure crosses GRAB the engine
  // may be dragging until it falls below RELEASE
  if (d.closure >= G.GRAB) gest.gripped = true;
  else if (d.closure < G.RELEASE) gest.gripped = false;

  // the zone click runs before the grip gate — closing the hand IS the click,
  // and the zone's own arming (open-then-close inside the zone) keeps squeezes
  // that wander to an edge from firing it
  updateZoneClick(d, now, !state.panelOpen && now - gest.presentAt >= G.ARM_DELAY_MS);

  // …but the shake path is gesture-dead for the whole grip span plus a lockout
  if (gest.gripped) {
    gest.lockedUntil = now + G.GRIP_LOCKOUT_MS;
    gestDisarm();
    return;
  }

  const open = d.closure <= G.OPEN_MAX;
  const armed = !state.panelOpen && now - gest.presentAt >= G.ARM_DELAY_MS &&
    now >= gest.lockedUntil && now >= gest.cooldownUntil;

  // shake: not open enough right now just pauses recognition — a noisy closure
  // blip must not cost a full lockout
  if (!open || !armed) {
    gestDisarm();
    return;
  }

  if (gest.dir === 0) {
    if (Math.abs(vx) >= G.SPEED_START) {
      gest.dir = vx > 0 ? 1 : -1;
      gest.startX = d.x; gest.startT = now;
      gest.extremeX = d.x;
      gest.slowSince = 0;
    }
    return;
  }

  // stroke in progress
  if ((d.x - gest.extremeX) * gest.dir > 0) gest.extremeX = d.x;

  if ((gest.extremeX - d.x) * gest.dir > G.REVERSE_EPS) {
    // turned around — a shake half-wave
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
    gest.extremeX = d.x;
    gest.slowSince = 0;
    return;
  }

  // motion died down: quietly close the stroke so stale extremes can't linger
  if (Math.abs(vx) < G.SPEED_STOP) {
    if (!gest.slowSince) gest.slowSince = now;
    if (now - gest.slowSince >= G.STOP_MS) { gest.dir = 0; gest.slowSince = 0; }
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
  applySpin();
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

function pickBackground(id) {
  const bg = BACKGROUNDS.find((b) => b.id === id);
  if (!bg || !engine) return;
  state.bgId = id;
  engine.setBackground(id);
  document.body.classList.toggle('bg-dark', !!bg.dark);
  renderBackgrounds();
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

// some objects opt out of the idle spin entirely (spin: false in the registry);
// the toggle stays the user's global preference and the object gates it
function applySpin() {
  const en = entry();
  if (engine) engine.setAutoRotate(state.spinOn && !(en && en.spin === false));
}

function setSpinOn(on) {
  state.spinOn = on;
  applySpin();
  dom.spinToggle.classList.toggle('on', on);
  dom.spinToggle.setAttribute('aria-checked', String(on));
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

function renderBackgrounds() {
  dom.bgRow.innerHTML = '';
  BACKGROUNDS.forEach((bg) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (bg.id === state.bgId ? ' active' : '');
    b.title = bg.name;
    b.setAttribute('aria-label', `background ${bg.name}`);
    b.style.background = bg.css;
    b.addEventListener('click', () => pickBackground(bg.id));
    dom.bgRow.appendChild(b);
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
  if (en.geometry === 'wrap' || en.geometry === 'floe') {
    const note = document.createElement('div');
    note.className = 'tune-label';
    note.style.padding = '2px 0 8px';
    note.textContent = en.geometry === 'wrap'
      ? 'bubble wrap just pops — nothing to tune'
      : 'the ice just cracks, pane by pane — nothing to tune';
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
  dom.handHint.hidden = !(hand.mod && hand.enabled);
  updateHandZones();
}

function renderAll() {
  renderDots();
  renderObjGrid();
  renderLooks();
  renderBackgrounds();
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
}

// gentle idle wobble: if the toy sits untouched for a while, give it a scripted squish
function idleTick() {
  if (!state.gestured || !engine || state.panelOpen || document.hidden) return;
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

// ---------- welcome ----------
function wireWelcome() {
  const welcome = $('welcome');
  const playBtn = $('play-btn');
  if (!welcome || !playBtn) return;
  const resquish = (el) => {
    el.classList.remove('squished');
    void el.offsetWidth; // restart the animation on rapid re-taps
    el.classList.add('squished');
  };
  const enter = () => {
    welcome.classList.add('leaving');
    welcome.addEventListener('transitionend', () => { welcome.style.display = 'none'; }, { once: true });
  };
  // a bfcache restore (back/forward) revives the old DOM with the intro gone —
  // put it back so every entry to the page starts on the intro
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    welcome.style.display = '';
    welcome.classList.remove('leaving');
  });
  for (const letter of welcome.querySelectorAll('.bl')) {
    letter.addEventListener('pointerdown', () => resquish(letter));
  }
  playBtn.addEventListener('click', () => {
    resquish(playBtn);
    // play defaults to hand input — wanted covers the race where probeHand()
    // hasn't resolved yet; a denied camera just leaves mouse/touch driving
    hand.wanted = true;
    if (hand.mod && !hand.api) startHand();
    setTimeout(enter, 240);
  });
  const howtoBtn = $('howto-btn');
  const howto = $('howto');
  if (howtoBtn && howto) {
    howtoBtn.addEventListener('click', () => {
      resquish(howtoBtn);
      const open = howto.classList.toggle('open');
      howtoBtn.classList.toggle('open', open);
      howtoBtn.setAttribute('aria-expanded', String(open));
    });
  }
}

function boot() {
  wireWelcome();
  window.addEventListener('keydown', onKey);
  try {
    engine = createEngine(dom.mount, {
      onFrame: () => {},
      onPop: () => {},
      onState: () => {}
    });
    engine.setBackdrop('void');
    setSpinOn(state.spinOn);
    dom.overlayBoot.style.display = 'none';

    // the engine pauses itself while the tab is hidden; on return, treat it as
    // fresh activity so the idle wobble doesn't fire the moment the tab shows
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) lastActivity = performance.now();
    });

    window.addEventListener('pointerdown', onFirstGesture, { capture: true });
    dom.mount.addEventListener('pointerdown', () => { lastActivity = performance.now(); });
    dom.mount.addEventListener('pointermove', () => { lastActivity = performance.now(); });
    setInterval(idleTick, 2500);

    dom.prevBtn.addEventListener('click', () => stepObject(-1));
    dom.nextBtn.addEventListener('click', () => stepObject(1));
    if (dom.zonePrev) dom.zonePrev.addEventListener('click', () => stepObject(-1));
    if (dom.zoneNext) dom.zoneNext.addEventListener('click', () => stepObject(1));
    dom.settingsBtn.addEventListener('click', () => setPanel(!state.panelOpen));
    dom.panelClose.addEventListener('click', () => setPanel(false));
    dom.scrim.addEventListener('click', () => setPanel(false));
    dom.soundToggle.addEventListener('click', () => setAudioOn(!state.audioOn));
    dom.spinToggle.addEventListener('click', () => setSpinOn(!state.spinOn));
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
