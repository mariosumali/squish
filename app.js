// squish app shell — wires the DOM UI to the engine. No framework, no build step.
import { createEngine } from './engine.js';
import { createHandInput } from './hand.js';
import { SQUISHIES, SEED_INPUT } from './squishies.js';

const TAG_STYLE = {
  elastic: { bg: '#e3f5ec', fg: '#3f9a6e' },
  crack: { bg: '#ffedd9', fg: '#c97a2e' },
  dent: { bg: '#ece7fb', fg: '#7a62c9' },
  pop: { bg: '#ffe4ee', fg: '#d1568a' },
  burst: { bg: '#ddefff', fg: '#3b82c4' },
  shatter: { bg: '#e3f6f8', fg: '#4c98a6' }
};

const dom = {
  mount: document.getElementById('mount'),
  overlayBoot: document.getElementById('overlay-boot'),
  overlayError: document.getElementById('overlay-error'),
  errorMsg: document.getElementById('error-msg'),
  dot: document.getElementById('dot'),
  stateLabel: document.getElementById('state-label'),
  fps: document.getElementById('fps-value'),
  lat: document.getElementById('lat-value'),
  audioBtn: document.getElementById('audio-btn'),
  objectList: document.getElementById('object-list'),
  tuningSections: document.getElementById('tuning-sections'),
  defaultsBtn: document.getElementById('defaults-btn'),
  hint: document.getElementById('hint'),
  meterGroup: document.getElementById('meter-group'),
  meterFill: document.getElementById('meter-fill'),
  closureVal: document.getElementById('closure-val'),
  poppedGroup: document.getElementById('popped-group'),
  poppedVal: document.getElementById('popped-val'),
  looksList: document.getElementById('looks-list'),
  resetBtn: document.getElementById('reset-btn'),
  pulseRow: document.getElementById('pulse-row'),
  handBadge: document.getElementById('hand-badge'),
  handRow: document.getElementById('hand-row'),
  handRowBadge: document.getElementById('hand-row-badge'),
  mouseRow: document.getElementById('mouse-row'),
  mouseRowBadge: document.getElementById('mouse-row-badge'),
  camPreview: document.getElementById('cam-preview')
};

const state = {
  objId: 'gummy-bear',
  lookIdx: {},
  audioOn: true,
  p: {},
  input: { ...SEED_INPUT },
  mode: 'MOUSE',
  handStatus: 'idle'
};

for (const s of SQUISHIES) {
  state.p[s.id] = {
    deform: { ...s.deform },
    material: { ...s.looks[0] },
    audio: { ...s.audio },
    shell: s.shell ? { ...s.shell } : null,
    burst: s.burst ? { ...s.burst } : null,
    shatter: s.shatter ? { ...s.shatter } : null
  };
  state.lookIdx[s.id] = 0;
}

let engine = null;
let frameCount = 0;

function entry() {
  return SQUISHIES.find((o) => o.id === state.objId);
}

function onFrameStats(st) {
  dom.meterFill.style.transform = `scaleX(${st.closure})`;
  dom.closureVal.textContent = st.closure.toFixed(2);
  dom.dot.style.background = st.active ? '#ff6f9e' : '#e5daca';
  dom.stateLabel.textContent = state.mode === 'DEBUG' ? 'DEBUG' : st.active ? 'GRAB' : state.mode === 'HAND' ? 'HAND' : 'MOUSE';
  frameCount++;
  if (frameCount % 12 === 0) dom.fps.textContent = String(Math.round(st.fps));
  if (st.lat >= 0) dom.lat.textContent = `${Math.max(1, Math.round(st.lat))}MS`;
}

function onPop(count, total) {
  dom.poppedVal.textContent = `${String(count).padStart(2, '0')} / ${total}`;
}

function onEngineState(mode) {
  state.mode = mode;
}

function selectObject(id) {
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
  if (st.burst) for (const k of Object.keys(st.burst)) engine.setBurst(k, st.burst[k]);
  if (st.shatter) for (const k of Object.keys(st.shatter)) engine.setShatter(k, st.shatter[k]);
  state.objId = id;
  renderAll();
}

function pickLook(i) {
  const en = entry();
  const look = en.looks[i];
  state.p[en.id] = { ...state.p[en.id], material: { ...look } };
  engine.setLook(look);
  state.lookIdx[en.id] = i;
  renderAll();
}

function applyParam(group, key, val) {
  const en = entry();
  if (group === 'input') {
    engine.setInput(key, val);
    state.input[key] = val;
    renderTuning();
    return;
  }
  const st = state.p[en.id];
  st[group] = { ...st[group], [key]: val };
  if (group === 'deform') engine.setDeform(key, val);
  if (group === 'shell') engine.setShell(key, val);
  if (group === 'burst') engine.setBurst(key, val);
  if (group === 'shatter') engine.setShatter(key, val);
  if (group === 'material') engine.setMaterial(key, val);
  if (group === 'audio') engine.setAudioParam(key, val);
  renderTuning();
}

function fmt(v, step) {
  if (step >= 1) return String(Math.round(v));
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}

function sliderPointerDown(e, group, key, min, max, step) {
  e.preventDefault();
  const rect = e.currentTarget.getBoundingClientRect();
  const apply = (cx) => {
    let t = (cx - rect.left) / rect.width;
    t = Math.max(0, Math.min(1, t));
    let v = min + t * (max - min);
    v = Math.round(v / step) * step;
    v = Math.max(min, Math.min(max, v));
    applyParam(group, key, v);
  };
  apply(e.clientX);
  const move = (ev) => apply(ev.clientX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function doReset() {
  if (engine) engine.reset();
}

function doPulse() {
  if (engine) engine.pulse();
}

function doDefaults() {
  const en = entry();
  if (!en) return;
  const li = state.lookIdx[en.id] || 0;
  state.p[en.id] = {
    deform: { ...en.deform },
    material: { ...en.looks[li] },
    audio: { ...en.audio },
    shell: en.shell ? { ...en.shell } : null,
    burst: en.burst ? { ...en.burst } : null,
    shatter: en.shatter ? { ...en.shatter } : null
  };
  state.input = { ...SEED_INPUT };
  selectObject(en.id);
}

let hand = null;

function setHandUI(status) {
  state.handStatus = status;
  const live = status === 'live';
  const text = { idle: 'off', loading: 'loading', live: 'live', denied: 'denied', error: 'error' }[status] || status;
  dom.handBadge.textContent = text;
  dom.handBadge.style.background = live ? '#ffe9f1' : '#f5ede1';
  dom.handBadge.style.color = live ? '#d14a75' : '#b8ab9d';
  dom.handRowBadge.textContent = status === 'idle' ? 'v2' : text;
  dom.handRowBadge.className = live ? 'badge-active' : 'badge-muted';
  dom.handRow.classList.toggle('muted', !live);
  dom.mouseRowBadge.textContent = live ? 'off' : 'default';
  dom.mouseRowBadge.className = live ? 'badge-muted' : 'badge-active';
  dom.mouseRow.classList.toggle('muted', live);
  dom.camPreview.style.display = live ? 'block' : 'none';
}

function onHandStatus(s) {
  setHandUI(s);
  if (!engine) return;
  if (s === 'live') {
    if (hand.video.parentNode !== dom.camPreview) {
      dom.camPreview.innerHTML = '';
      dom.camPreview.appendChild(hand.video);
    }
    engine.setHandActive(true);
  } else {
    engine.setHandActive(false);
  }
}

function toggleHand() {
  if (state.handStatus === 'live' || state.handStatus === 'loading') {
    if (hand) hand.stop();
    return;
  }
  if (!hand) {
    hand = createHandInput({
      onUpdate: (h) => { if (engine) engine.setHandInput(h); },
      onStatus: onHandStatus
    });
  }
  hand.start();
}

function toggleAudio() {
  state.audioOn = !state.audioOn;
  if (engine) engine.setAudio(state.audioOn);
  dom.audioBtn.textContent = state.audioOn ? 'snd on' : 'snd off';
}

function renderObjectList() {
  dom.objectList.innerHTML = '';
  SQUISHIES.forEach((o, i) => {
    const active = o.id === state.objId;
    const tag = TAG_STYLE[o.failureMode] || TAG_STYLE.elastic;
    const row = document.createElement('div');
    row.className = 'obj-row' + (active ? ' active' : '');
    row.innerHTML = `
      <span class="bar"></span>
      <span class="idx">${String(i + 1).padStart(2, '0')}</span>
      <span class="name">${o.name}</span>
      <span class="tag" style="background:${tag.bg};color:${tag.fg};">${o.failureMode}</span>
    `;
    row.addEventListener('click', () => selectObject(o.id));
    dom.objectList.appendChild(row);
  });
}

function paramRow(group, key, label, min, max, step) {
  const en = entry();
  const src = group === 'input' ? state.input : state.p[en.id][group];
  const v = src[key];
  const row = document.createElement('div');
  row.className = 'param-row';
  row.innerHTML = `
    <div class="param-head">
      <span class="param-label">${label}</span>
      <span class="param-val">${fmt(v, step)}</span>
    </div>
    <div class="slider-track-wrap">
      <div class="slider-track">
        <div class="slider-fill" style="width:${(((v - min) / (max - min)) * 100).toFixed(1)}%;"></div>
      </div>
    </div>
  `;
  row.querySelector('.slider-track-wrap').addEventListener('pointerdown', (e) => sliderPointerDown(e, group, key, min, max, step));
  return row;
}

function renderTuning() {
  const en = entry();
  if (!en) return;
  const isWrap = en.geometry === 'wrap';
  dom.tuningSections.innerHTML = '';

  const mat = [
    ['material', 'transmission', 'TRANSMISSION', 0, 1, 0.01],
    ['material', 'thickness', 'THICKNESS', 0, 2, 0.01],
    ['material', 'ior', 'IOR', 1, 2.33, 0.01],
    ['material', 'clearcoat', 'CLEARCOAT', 0, 1, 0.01],
    ['material', 'roughness', 'ROUGHNESS', 0, 1, 0.01]
  ];

  let sections;
  if (isWrap) {
    sections = [
      { title: 'MATERIAL', rows: mat },
      { title: 'AUDIO', rows: [['audio', 'popHz', 'POP RESONANCE HZ', 400, 3200, 10]] }
    ];
  } else {
    sections = [
      { title: 'DEFORM', rows: [
        ['deform', 'falloffRadius', 'FALLOFF RADIUS', 0.1, 0.8, 0.01],
        ['deform', 'depth', 'DEPTH', 0.1, 0.9, 0.01],
        ['deform', 'stiffness', 'STIFFNESS', 2, 30, 0.1],
        ['deform', 'damping', 'DAMPING', 0.6, 0.99, 0.005],
        ['deform', 'bulge', 'BULGE', 0, 1.5, 0.01],
        ['deform', 'permanence', 'PERMANENCE', 0, 1, 0.01],
        ['deform', 'recovery', 'RECOVERY S', 0, 5, 0.1]
      ] },
      { title: 'INPUT', rows: [
        ['input', 'deadzone', 'CLOSURE DEADZONE', 0, 0.3, 0.005],
        ['input', 'saturation', 'CLOSURE SATURATION', 0.7, 1, 0.005]
      ] },
      { title: 'MATERIAL', rows: mat },
      { title: 'AUDIO', rows: [['audio', 'squishHz', 'SQUISH FILTER HZ', 200, 2400, 10]] }
    ];
    if (en.shell) {
      sections.splice(1, 0, { title: 'SHELL', rows: [
        ['shell', 'threshold', 'CRACK THRESHOLD', 0.2, 0.9, 0.01],
        ['shell', 'innerRough', 'INNER ROUGHNESS', 0, 0.5, 0.01],
        ['shell', 'freq', 'SHARD SCALE', 4, 16, 0.5]
      ] });
    }
    if (en.burst) {
      sections.splice(1, 0, { title: 'BURST', rows: [
        ['burst', 'threshold', 'BURST THRESHOLD', 0.2, 0.7, 0.01],
        ['burst', 'sprayCount', 'SPRAY COUNT', 20, 200, 5],
        ['burst', 'wobble', 'STRAIN WOBBLE', 0, 2, 0.05]
      ] });
    }
    if (en.shatter) {
      sections.splice(1, 0, { title: 'SHATTER', rows: [
        ['shatter', 'threshold', 'SHATTER THRESHOLD', 0.3, 0.95, 0.01],
        ['shatter', 'shardScale', 'SHARD SCALE', 0.5, 2, 0.05],
        ['shatter', 'tumble', 'TUMBLE', 0, 2, 0.05]
      ] });
    }
  }

  for (const sec of sections) {
    const wrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = sec.title;
    wrap.appendChild(title);
    for (const [group, key, label, min, max, step] of sec.rows) {
      wrap.appendChild(paramRow(group, key, label, min, max, step));
    }
    dom.tuningSections.appendChild(wrap);
  }
}

function renderLooks() {
  const en = entry();
  dom.looksList.innerHTML = '';
  if (!en) return;
  en.looks.forEach((lk, i) => {
    const active = (state.lookIdx[en.id] || 0) === i;
    const btn = document.createElement('button');
    btn.className = 'look-chip' + (active ? ' active' : '');
    btn.textContent = lk.name;
    btn.addEventListener('click', () => pickLook(i));
    dom.looksList.appendChild(btn);
  });
}

function renderHint() {
  const en = entry();
  const isWrap = en ? en.geometry === 'wrap' : false;
  dom.hint.textContent = isWrap
    ? 'click or drag across cells to pop'
    : en && en.burst
      ? 'press + drag — squeeze hard to burst it'
      : en && en.shatter
        ? 'press + drag — squeeze hard to shatter it'
        : en && en.shell
          ? 'press + drag — squish hard to crack the shell'
          : 'press + drag on the object to squish';
  dom.meterGroup.style.display = isWrap ? 'none' : 'flex';
  dom.poppedGroup.style.display = isWrap ? 'flex' : 'none';
}

function renderAll() {
  renderObjectList();
  renderTuning();
  renderLooks();
  renderHint();
}

function onKey(e) {
  const i = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].indexOf(e.key);
  if (i >= 0 && SQUISHIES[i]) selectObject(SQUISHIES[i].id);
  if (e.key === 'r' || e.key === 'R') doReset();
  if (e.key === 'p' || e.key === 'P') doPulse();
}

function boot() {
  window.addEventListener('keydown', onKey);
  try {
    engine = createEngine(dom.mount, {
      onFrame: onFrameStats,
      onPop,
      onState: onEngineState
    });
    engine.setBackdrop('void');
    engine.setAutoRotate(false);
    dom.overlayBoot.style.display = 'none';
    dom.audioBtn.addEventListener('click', toggleAudio);
    dom.defaultsBtn.addEventListener('click', doDefaults);
    dom.resetBtn.addEventListener('click', doReset);
    dom.pulseRow.addEventListener('click', doPulse);
    dom.handRow.addEventListener('click', toggleHand);
    selectObject('gummy-bear');
  } catch (e) {
    dom.overlayBoot.style.display = 'none';
    dom.overlayError.style.display = 'flex';
    dom.errorMsg.textContent = `renderer fault — ${String((e && e.message) || e)}`;
  }
}

boot();

// --- mobile drawers (toggles are display:none >= 860px, so this is inert on desktop) ---
const drawers = {
  sidebar: document.querySelector('.sidebar'),
  tuning: document.querySelector('.tuning-panel'),
  scrim: document.getElementById('drawer-scrim'),
  objectsBtn: document.getElementById('objects-toggle'),
  tuningBtn: document.getElementById('tuning-toggle')
};
const mobileMq = window.matchMedia('(max-width: 859px)');

function syncDrawers() {
  const objOpen = drawers.sidebar.classList.contains('open');
  const tuneOpen = drawers.tuning.classList.contains('open');
  drawers.objectsBtn.classList.toggle('active', objOpen);
  drawers.tuningBtn.classList.toggle('active', tuneOpen);
  drawers.scrim.classList.toggle('visible', objOpen || tuneOpen);
}

function closeDrawers() {
  drawers.sidebar.classList.remove('open');
  drawers.tuning.classList.remove('open');
  syncDrawers();
}

function toggleDrawer(which) {
  const el = which === 'objects' ? drawers.sidebar : drawers.tuning;
  const other = which === 'objects' ? drawers.tuning : drawers.sidebar;
  const open = !el.classList.contains('open');
  el.classList.toggle('open', open);
  if (open) other.classList.remove('open');
  syncDrawers();
}

drawers.objectsBtn.addEventListener('click', () => toggleDrawer('objects'));
drawers.tuningBtn.addEventListener('click', () => toggleDrawer('tuning'));
drawers.scrim.addEventListener('click', closeDrawers);
dom.objectList.addEventListener('click', () => { if (mobileMq.matches) closeDrawers(); });
if (mobileMq.addEventListener) mobileMq.addEventListener('change', (e) => { if (!e.matches) closeDrawers(); });
