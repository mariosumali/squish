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

const START_OBJECT = 'jelly-cube'; // the wobbliest hello

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
    v.style.cssText = 'position:fixed;left:14px;bottom:14px;width:96px;height:72px;object-fit:cover;border-radius:12px;transform:scaleX(-1);opacity:0.85;z-index:30;pointer-events:none;box-shadow:0 4px 16px rgba(120,90,60,0.18);background:#000;';
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
      onUpdate: (d) => { if (handIsDriving() && !hand.pointerHold && d) safeSetHand(d); },
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
  } catch (e) {
    dom.overlayBoot.style.display = 'none';
    dom.overlayError.style.display = 'flex';
    dom.errorMsg.textContent = `renderer fault — ${String((e && e.message) || e)}`;
  }
}

boot();
