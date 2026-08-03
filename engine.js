// SQUISH engine — scene, shader deformer, input, audio. No UI in here.
import * as THREE from 'https://unpkg.com/three@0.184.0/build/three.module.js';

const HEADER = `
uniform vec3 uGrab; uniform vec3 uDir;
uniform float uClosure; uniform float uFalloff; uniform float uDepth; uniform float uBulge;
uniform int uDentCount;
uniform vec3 uDentPos[8]; uniform vec3 uDentDir[8]; uniform float uDentAmt[8];
uniform float uShell;
uniform int uCrackCount; uniform vec3 uCrackPos[6]; uniform float uCrackR[6];
uniform float uCrackFreq; uniform float uCrackGap; uniform float uCrackSink;
varying float vCrackM; varying vec3 vRestP;
float sqCrackM(vec3 p){
  float m = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= uCrackCount) break;
    float cd = distance(p, uCrackPos[i]) / max(uCrackR[i], 1e-3);
    m = max(m, 1.0 - cd);
  }
  return m;
}
vec3 sqVHash3(vec3 q){ q = vec3(dot(q, vec3(127.1,311.7,74.7)), dot(q, vec3(269.5,183.3,246.1)), dot(q, vec3(113.5,271.9,124.6))); return fract(sin(q)*43758.5453); }
vec2 sqVVoro(vec3 p){
  vec3 ip = floor(p); vec3 fp = fract(p);
  float f1 = 8.0; float f2 = 8.0; float id = 0.0;
  for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) for (int z=-1;z<=1;z++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 o = sqVHash3(ip + g);
    float d = length(g + o - fp);
    if (d < f1) { f2 = f1; f1 = d; id = o.y; } else if (d < f2) { f2 = d; }
  }
  return vec2(f2 - f1, id);
}
float sqFall(float r){ float x = clamp(r / max(uFalloff, 1e-3), 0.0, 1.0); return 1.0 - x*x*(3.0 - 2.0*x); }
vec3 sqPush(vec3 p, vec3 c, vec3 d, float amt){
  float f = sqFall(distance(p, c));
  vec3 q = d * (f * amt);
  vec3 rad = p - c; rad -= d * dot(rad, d);
  float rl = max(length(rad), 1e-4);
  q += (rad / rl) * (f * (1.0 - f) * 4.0) * amt * uBulge * 0.38;
  return q;
}
vec3 sqDisp(vec3 p){
  vec3 q = p + sqPush(p, uGrab, uDir, uClosure * uDepth);
  for (int i = 0; i < 8; i++){
    if (i >= uDentCount) break;
    q += sqPush(p, uDentPos[i], uDentDir[i], uDentAmt[i]);
  }
  if (uShell > 0.5) {
    float cm = sqCrackM(p);
    if (cm > 0.05) {
      vec2 v = sqVVoro(p * uCrackFreq);
      float eg = uCrackGap * (0.35 + 0.95 * cm);
      float gap = 1.0 - smoothstep(eg, eg + 0.03, v.x);
      float w = smoothstep(0.06, 0.4, cm);
      q += normal * (((v.y - 0.5) * 0.028 * (1.0 - gap) - uCrackSink * gap) * w);
    }
  }
  return q;
}`;

const NORMAL_CHUNK = `
vec3 sqP = sqDisp(position);
vec3 sqUpv = abs(normal.y) > 0.94 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
vec3 sqT = normalize(cross(normal, sqUpv));
vec3 sqB = cross(normal, sqT);
vec3 sqPa = sqDisp(position + sqT * 0.02);
vec3 sqPb = sqDisp(position + sqB * 0.02);
vec3 objectNormal = normalize(cross(sqPa - sqP, sqPb - sqP));
vRestP = position;
vCrackM = sqCrackM(position);`;

const FRAG_HEADER = `
uniform vec3 uInnerColor; uniform float uInnerRough; uniform float uShell;
uniform float uCrackFreq; uniform float uCrackGap;
varying float vCrackM; varying vec3 vRestP;
vec3 sqFHash3(vec3 q){ q = vec3(dot(q, vec3(127.1,311.7,74.7)), dot(q, vec3(269.5,183.3,246.1)), dot(q, vec3(113.5,271.9,124.6))); return fract(sin(q)*43758.5453); }
vec2 sqFVoro(vec3 p){
  vec3 ip = floor(p); vec3 fp = fract(p);
  float f1 = 8.0; float f2 = 8.0;
  for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) for (int z=-1;z<=1;z++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 o = sqFHash3(ip + g);
    float d = length(g + o - fp);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return vec2(f2 - f1, f1);
}`;
const COLOR_CHUNK = `
float sqShow = 0.0;
if (uShell > 0.5 && vCrackM > 0.02) {
  vec2 sv = sqFVoro(vRestP * uCrackFreq);
  float sqw = smoothstep(0.06, 0.4, vCrackM);
  float sqeg = uCrackGap * (0.35 + 0.95 * vCrackM);
  float sqgap = (1.0 - smoothstep(sqeg, sqeg + 0.02, sv.x)) * sqw;
  sqShow = sqgap;
  diffuseColor.rgb = mix(diffuseColor.rgb, uInnerColor, sqgap);
  float sqwall = smoothstep(sqeg, sqeg + 0.08, sv.x) - smoothstep(sqeg + 0.08, sqeg + 0.2, sv.x);
  diffuseColor.rgb *= (1.0 - sqwall * sqw * 0.5);
}`;
const ROUGH_CHUNK = `
if (uShell > 0.5) roughnessFactor = mix(roughnessFactor, uInnerRough, sqShow);`;

// ---------- procedural geometry ----------
function hashN(x, y, z) { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let a = 0;
  const c = (dx, dy, dz) => hashN(xi + dx, yi + dy, zi + dz);
  const lerp = (p, q, t) => p + (q - p) * t;
  a = lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
  return a * 2 - 1;
}
function fbm(x, y, z) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { a += amp * vnoise(x * f, y * f, z * f); amp *= 0.5; f *= 2.02; }
  return a;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
function sdSph(p, cx, cy, cz, r) { const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz; return Math.sqrt(dx * dx + dy * dy + dz * dz) - r; }
function sdEll(p, cx, cy, cz, rx, ry, rz) {
  const dx = (p.x - cx) / rx, dy = (p.y - cy) / ry, dz = (p.z - cz) / rz;
  const k0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ex = (p.x - cx) / (rx * rx), ey = (p.y - cy) / (ry * ry), ez = (p.z - cz) / (rz * rz);
  const k1 = Math.sqrt(ex * ex + ey * ey + ez * ez);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
function sdCap(p, ax, ay, az, bx, by, bz, r) {
  const pax = p.x - ax, pay = p.y - ay, paz = p.z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = Math.max(0, Math.min(1, h));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}
function bearSDF(p) {
  let d = sdEll(p, 0, -0.16, 0, 0.36, 0.44, 0.30);
  d = smin(d, sdSph(p, 0, 0.40, 0.03, 0.27), 0.10);
  d = smin(d, sdSph(p, 0, 0.33, 0.25, 0.115), 0.06);
  d = smin(d, sdSph(p, -0.19, 0.63, 0.0, 0.105), 0.05);
  d = smin(d, sdSph(p, 0.19, 0.63, 0.0, 0.105), 0.05);
  d = smin(d, sdCap(p, -0.30, 0.10, 0.10, -0.44, -0.10, 0.20, 0.10), 0.09);
  d = smin(d, sdCap(p, 0.30, 0.10, 0.10, 0.44, -0.10, 0.20, 0.10), 0.09);
  d = smin(d, sdCap(p, -0.17, -0.46, 0.04, -0.24, -0.64, 0.16, 0.125), 0.09);
  d = smin(d, sdCap(p, 0.17, -0.46, 0.04, 0.24, -0.64, 0.16, 0.125), 0.09);
  d = smin(d, sdEll(p, 0, -0.12, 0.21, 0.24, 0.30, 0.15), 0.12);
  return d;
}
function normalizeGeo(geo, targetH, baseY) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const h = bb.max.y - bb.min.y;
  const s = targetH / h;
  geo.scale(s, s, s);
  geo.computeBoundingBox();
  const b2 = geo.boundingBox;
  geo.translate(-(b2.max.x + b2.min.x) / 2, baseY - b2.min.y, -(b2.max.z + b2.min.z) / 2);
  geo.computeBoundingSphere();
}
function buildBear() {
  const geo = new THREE.SphereGeometry(1, 128, 88);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const P = { x: 0, y: 0, z: 0 }, e = 0.004;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const ux = dx / l, uy = dy / l, uz = dz / l;
    let hi = 1.5, lo = -1, t = 1.5, found = false;
    for (let s = 0; s < 44; s++) {
      t = 1.5 - s * 0.036;
      P.x = ux * t; P.y = uy * t; P.z = uz * t;
      if (bearSDF(P) < 0) { lo = t; hi = t + 0.036; found = true; break; }
    }
    if (!found) lo = 0.02;
    for (let s = 0; s < 12; s++) {
      const m = (hi + lo) / 2;
      P.x = ux * m; P.y = uy * m; P.z = uz * m;
      if (bearSDF(P) < 0) lo = m; else hi = m;
    }
    const st = (hi + lo) / 2;
    const px = ux * st, py = uy * st, pz = uz * st;
    pos.setXYZ(i, px, py, pz);
    P.x = px + e; P.y = py; P.z = pz; const gx = bearSDF(P);
    P.x = px - e; const gx2 = bearSDF(P);
    P.x = px; P.y = py + e; const gy = bearSDF(P);
    P.y = py - e; const gy2 = bearSDF(P);
    P.y = py; P.z = pz + e; const gz = bearSDF(P);
    P.z = pz - e; const gz2 = bearSDF(P);
    const nx = gx - gx2, ny = gy - gy2, nz = gz - gz2;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nor.setXYZ(i, nx / nl, ny / nl, nz / nl);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  normalizeGeo(geo, 1.16, -0.585);
  return geo;
}
function buildBlob(seed, amt, squash, targetH) {
  const geo = new THREE.SphereGeometry(0.52, 112, 84);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const l = Math.sqrt(x * x + y * y + z * z) || 1;
    const ux = x / l, uy = y / l, uz = z / l;
    let r = 0.52 * (1 + amt * fbm(ux * 2.3 + seed, uy * 2.3, uz * 2.3) + 0.13 * (0.5 - uy));
    pos.setXYZ(i, ux * r, uy * r * squash, uz * r);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  normalizeGeo(geo, targetH, -0.585);
  return geo;
}
function buildJelly() {
  return roundedBoxGeo(1, 1, 1, 0.17, 44, [0.94, 0.76, 0.94], 0.76);
}
function buildButter() {
  return roundedBoxGeo(1.15, 0.42, 0.52, 0.07, 40, [1, 1, 1], 0.45);
}
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function sdfGeo(sdf, targetH, colorFn, bumpFn) {
  const geo = new THREE.SphereGeometry(1, 112, 80);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const cols = colorFn ? new Float32Array(pos.count * 3) : null;
  const P = { x: 0, y: 0, z: 0 }, e = 0.004, tmpC = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);
    const l = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / l, uy = dy / l, uz = dz / l;
    let hi = 1.25, lo = -1, found = false;
    for (let s = 0; s < 42; s++) {
      const t = 1.25 - s * 0.03;
      P.x = ux * t; P.y = uy * t; P.z = uz * t;
      if (sdf(P) < 0) { lo = t; hi = t + 0.03; found = true; break; }
    }
    if (!found) lo = 0.02;
    for (let s = 0; s < 12; s++) {
      const m = (hi + lo) / 2;
      P.x = ux * m; P.y = uy * m; P.z = uz * m;
      if (sdf(P) < 0) lo = m; else hi = m;
    }
    const st = (hi + lo) / 2;
    let px = ux * st, py = uy * st, pz = uz * st;
    P.x = px + e; P.y = py; P.z = pz; const g1 = sdf(P);
    P.x = px - e; const g2 = sdf(P);
    P.x = px; P.y = py + e; const g3 = sdf(P);
    P.y = py - e; const g4 = sdf(P);
    P.y = py; P.z = pz + e; const g5 = sdf(P);
    P.z = pz - e; const g6 = sdf(P);
    const nx = g1 - g2, ny = g3 - g4, nz = g5 - g6;
    const nl = Math.hypot(nx, ny, nz) || 1;
    if (bumpFn) { const b = bumpFn(px, py, pz); px += ux * b; py += uy * b; pz += uz * b; }
    pos.setXYZ(i, px, py, pz);
    nor.setXYZ(i, nx / nl, ny / nl, nz / nl);
    if (cols) { colorFn(px, py, pz, tmpC); cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b; }
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  if (cols) geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (bumpFn) geo.computeVertexNormals();
  normalizeGeo(geo, targetH, -0.585);
  return geo;
}
const CC = (h) => new THREE.Color(h);
function buildPeach() {
  const sdf = (p) => {
    let d = sdEll(p, 0, 0, 0, 0.5, 0.47, 0.5);
    d += (1 - ss(0, 0.14, Math.abs(p.x))) * ss(-0.15, 0.3, p.z) * 0.032;
    const dd = Math.hypot(p.x, p.y - 0.5, p.z);
    d += 0.06 * Math.exp(-dd * dd / 0.012);
    return d;
  };
  const base = CC('#ffc25e'), blush = CC('#ff4a34'), crease = CC('#e07a3a'), stem = CC('#7a6228');
  const colorFn = (x, y, z, c) => {
    const dp = (x * 0.66 + y * 0.15 + z * 0.73) / 0.5;
    c.copy(base).lerp(blush, ss(-0.15, 0.8, dp + 0.3 * vnoise(x * 3.1, y * 3.1, z * 3.1)));
    c.lerp(crease, (1 - ss(0, 0.13, Math.abs(x))) * ss(-0.15, 0.3, z) * 0.5);
    c.lerp(stem, 1 - ss(0.06, 0.18, Math.hypot(x, y - 0.47, z)));
  };
  return sdfGeo(sdf, 0.95, colorFn, null);
}
function buildBanana() {
  const ha = 0.95, R = 0.5;
  const sdf = (p) => {
    let phi = Math.atan2(p.x, p.y + R);
    phi = Math.max(-ha, Math.min(ha, phi));
    const ax = Math.sin(phi) * R, ay = -R + Math.cos(phi) * R;
    const t = Math.abs(phi) / ha;
    const rad = 0.15 * (1 - Math.pow(Math.max(0, (t - 0.6) / 0.4), 1.6) * 0.8);
    let d = Math.hypot(p.x - ax, p.y - ay, p.z) - rad;
    const ex = Math.sin(ha) * R, ey = -R + Math.cos(ha) * R;
    d = smin(d, sdCap(p, -ex, ey, 0, -ex - 0.07, ey - 0.09, 0, 0.04), 0.05);
    return d;
  };
  const base = CC('#ffe36b'), tip = CC('#6b4a1f'), spot = CC('#8a5a20'), ridge = CC('#e8c94f');
  const colorFn = (x, y, z, c) => {
    let phi = Math.max(-ha, Math.min(ha, Math.atan2(x, y + R)));
    const t = Math.abs(phi) / ha;
    c.copy(base).lerp(ridge, ss(0.05, 0.11, Math.abs(z)) * 0.5);
    const n = vnoise(x * 11, y * 11, z * 11) + 0.5 * vnoise(x * 23, y * 23, z * 23);
    c.lerp(spot, ss(0.5, 0.75, n) * (1 - ss(0.8, 0.95, t)) * 0.85);
    c.lerp(tip, ss(0.86, 0.97, t));
  };
  return sdfGeo(sdf, 0.8, colorFn, null);
}
function buildTomato() {
  const sdf = (p) => {
    const lobe = 1 + 0.032 * Math.cos(5 * Math.atan2(p.z, p.x)) * ss(0.45, -0.35, p.y);
    let d = sdEll(p, 0, 0, 0, 0.5 * lobe, 0.4, 0.5 * lobe);
    const dd = Math.hypot(p.x, p.y - 0.42, p.z);
    d += 0.07 * Math.exp(-dd * dd / 0.008);
    d = smin(d, sdCap(p, 0, 0.34, 0, 0, 0.48, 0, 0.038), 0.05);
    return d;
  };
  const base = CC('#e02918'), shoulder = CC('#ff8a3a'), green = CC('#55801e'), dgreen = CC('#39590f');
  const colorFn = (x, y, z, c) => {
    c.copy(base).lerp(shoulder, ss(0.08, 0.38, y) * 0.4);
    const gd = Math.hypot(x, y - 0.44, z);
    c.lerp(green, 1 - ss(0.09, 0.2, gd));
    c.lerp(dgreen, 1 - ss(0.04, 0.09, gd));
  };
  return sdfGeo(sdf, 0.8, colorFn, null);
}
function buildAvocado() {
  const sdf = (p) => {
    let d = smin(sdSph(p, 0, -0.16, 0, 0.40), sdSph(p, 0, 0.24, 0.02, 0.27), 0.22);
    d = smin(d, sdCap(p, 0, 0.46, 0.02, 0, 0.55, 0.02, 0.035), 0.03);
    return d;
  };
  const dark = CC('#1d2612'), light = CC('#4d6626'), base = CC('#33411f'), stem = CC('#8a6a3a');
  const colorFn = (x, y, z, c) => {
    const m = vnoise(x * 5.5, y * 5.5, z * 5.5) + 0.5 * vnoise(x * 13, y * 13, z * 13);
    c.copy(base).lerp(dark, ss(0.05, 0.6, m)).lerp(light, ss(-0.05, -0.7, m) * 0.7);
    c.lerp(stem, 1 - ss(0.05, 0.13, Math.hypot(x, y - 0.56, z)));
  };
  const bump = (x, y, z) => vnoise(x * 13, y * 13, z * 13) * 0.011 + vnoise(x * 27, y * 27, z * 27) * 0.0045;
  return sdfGeo(sdf, 1.02, colorFn, bump);
}
function buildMallow() {
  const rr = 0.09;
  const sdf = (p) => {
    const bulge = 1 + 0.045 * Math.cos(p.y * 4.5);
    const dxz = Math.hypot(p.x, p.z) - 0.33 * bulge + rr;
    const dy = Math.abs(p.y) - 0.26 + rr;
    return Math.min(Math.max(dxz, dy), 0) + Math.hypot(Math.max(dxz, 0), Math.max(dy, 0)) - rr;
  };
  return sdfGeo(sdf, 0.72, null, null);
}
function buildBalloon() {
  // slightly squashed sphere with a soft sag toward the base — a filled water balloon at rest
  const geo = new THREE.SphereGeometry(0.5, 96, 72);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const sag = 1 + 0.10 * ss(0.35, -0.4, y / 0.5);
    pos.setXYZ(i, x * sag, y * 0.82, z * sag);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  normalizeGeo(geo, 0.88, -0.585);
  return geo;
}
function buildIce() {
  return roundedBoxGeo(1, 1, 1, 0.12, 44, [1, 0.94, 1], 0.72);
}
function roundedBoxGeo(bx, by, bz, r, seg, scl, targetH) {
  const geo = new THREE.BoxGeometry(bx, by, bz, seg, seg, seg);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const hx = bx / 2 - r, hy = by / 2 - r, hz = bz / 2 - r;
  const sx = scl[0], sy = scl[1], sz = scl[2];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const qx = Math.max(-hx, Math.min(hx, x)), qy = Math.max(-hy, Math.min(hy, y)), qz = Math.max(-hz, Math.min(hz, z));
    let nx = x - qx, ny = y - qy, nz = z - qz;
    let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl < 1e-6) { nx = nor.getX(i); ny = nor.getY(i); nz = nor.getZ(i); nl = 1; }
    nx /= nl; ny /= nl; nz /= nl;
    pos.setXYZ(i, (qx + nx * r) * sx, (qy + ny * r) * sy, (qz + nz * r) * sz);
    let mx = nx / sx, my = ny / sy, mz = nz / sz;
    const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    nor.setXYZ(i, mx / ml, my / ml, mz / ml);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  normalizeGeo(geo, targetH, -0.585);
  return geo;
}

// ---------- audio ----------
function makeAudio() {
  const A = { ctx: null, on: true, master: null, squishHz: 900, popHz: 1400 };
  A.ensure = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = A.ctx = new Ctx();
    A.master = ctx.createGain(); A.master.gain.value = A.on ? 0.6 : 0;
    A.comp = ctx.createDynamicsCompressor();
    A.comp.threshold.value = -18; A.comp.knee.value = 12; A.comp.ratio.value = 4;
    A.master.connect(A.comp); A.comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;
    // squish bed: looped noise -> lowpass body -> peaking resonance -> gain
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    A.sqLP = ctx.createBiquadFilter(); A.sqLP.type = 'lowpass'; A.sqLP.Q.value = 1.2;
    A.sqPeak = ctx.createBiquadFilter(); A.sqPeak.type = 'peaking'; A.sqPeak.Q.value = 2.5; A.sqPeak.gain.value = 9;
    A.sqGain = ctx.createGain(); A.sqGain.gain.value = 0;
    src.connect(A.sqLP); A.sqLP.connect(A.sqPeak); A.sqPeak.connect(A.sqGain); A.sqGain.connect(A.master);
    src.start();
  };
  A.burst = (freq, q, gain, dur, when, type) => {
    const ctx = A.ctx, t = ctx.currentTime + (when || 0);
    const src = ctx.createBufferSource(); src.buffer = A.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  };
  A.thump = (f0, f1, gain, dur, when) => {
    const ctx = A.ctx, t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  A.squish = (vel, closure) => {
    if (!A.ctx) return;
    const v = Math.abs(vel);
    const g = Math.tanh(v * 0.09) * 0.8;
    const f = A.squishHz * (0.3 + closure * 1.5 + Math.min(1.4, v * 0.08));
    const t = A.ctx.currentTime;
    A.sqGain.gain.setTargetAtTime(g, t, 0.025);
    A.sqLP.frequency.setTargetAtTime(Math.min(6000, f), t, 0.03);
    A.sqPeak.frequency.setTargetAtTime(Math.min(8000, f * 1.7), t, 0.03);
  };
  A.pop = () => {
    if (!A.ctx) return;
    const f = A.popHz * (0.8 + Math.random() * 0.45);
    A.burst(3200, 1, 0.5, 0.012, 0, 'highpass');
    A.burst(f, 6 + Math.random() * 6, 0.95, 0.055 + Math.random() * 0.03, 0.004);
    A.thump(150 + Math.random() * 60, 55, 0.3, 0.07, 0.004);
  };
  A.crack = () => {
    if (!A.ctx) return;
    A.burst(2600, 0.8, 0.9, 0.018, 0, 'highpass');
    A.thump(130, 60, 0.45, 0.09, 0.002);
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const when = 0.012 + i * (0.014 + Math.random() * 0.02);
      A.burst(1200 + Math.random() * 1600, 3 + Math.random() * 3, 0.5 * (1 - i / n) + 0.15, 0.014 + Math.random() * 0.015, when);
    }
  };
  A.ping = (freq, gain, dur, when) => {
    const ctx = A.ctx, t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  A.splat = () => {
    // wet burst: low filtered-noise body + thump, then a spray of little droplet ticks
    if (!A.ctx) return;
    A.burst(340 + Math.random() * 160, 1.1, 0.95, 0.16 + Math.random() * 0.05, 0, 'lowpass');
    A.burst(950 + Math.random() * 500, 1.8, 0.55, 0.10, 0.008);
    A.thump(120 + Math.random() * 40, 42, 0.5, 0.12, 0.002);
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const when = 0.035 + i * (0.022 + Math.random() * 0.03);
      A.burst(1300 + Math.random() * 1300, 4, 0.22 * (1 - i / n) + 0.08, 0.018 + Math.random() * 0.02, when);
    }
  };
  A.shatter = () => {
    // hard brittle break: bright snap + body, then a cluster of resonant glassy pings
    if (!A.ctx) return;
    A.burst(3400, 0.7, 1.0, 0.02, 0, 'highpass');
    A.burst(2200, 2.2, 0.6, 0.05, 0.004);
    A.thump(170, 70, 0.35, 0.07, 0.002);
    const n = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const when = 0.012 + i * (0.012 + Math.random() * 0.016);
      A.ping(1800 + Math.random() * 2600, 0.30 * (1 - i / (n + 2)) + 0.08, 0.10 + Math.random() * 0.12, when);
    }
  };
  A.setOn = (on) => { A.on = on; if (A.ctx) A.master.gain.setTargetAtTime(on ? 0.6 : 0, A.ctx.currentTime, 0.02); };
  return A;
}

// ---------- engine ----------
export function createEngine(mount, opts) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;display:block;touch-action:none;';
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f3ec);
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
  camera.position.set(0, 0.42, 3.6);
  camera.lookAt(0, 0.1, 0);

  // environment (hand-rolled studio room, no addons)
  {
    const room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: 0x55504a, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, lum) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(lum) }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m);
    };
    panel(5, 3.2, -3.2, 4.2, 2.4, 8);
    panel(4, 4, 0.5, 2.2, -4.6, 9);
    panel(2.2, 5, 4.2, 0.8, 1.2, 6);
    panel(4, 2.2, 0, -3.6, 2.6, 2.2);
    panel(3, 2, 3.4, 3.8, -2.4, 5);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(room).texture;
    pmrem.dispose();
  }
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-2.4, 3.2, 2.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 0.9); rim.position.set(1.6, 1.4, -2.6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2.2, -0.5, 3); scene.add(fill);
  // faint greyscale sweep behind the object so transmission has something to transmit
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 236, 30, 256, 236, 250);
    gr.addColorStop(0, '#fffefb'); gr.addColorStop(0.55, '#f8f2e9'); gr.addColorStop(1, '#f3ecdf');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  })();
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: glowTex }));
  glow.position.set(0, 0.4, -5.5); scene.add(glow);

  // contact shadow
  const shTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 8, 128, 128, 124);
    gr.addColorStop(0, 'rgba(90,70,60,0.30)'); gr.addColorStop(1, 'rgba(90,70,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.62; scene.add(shadow);

  const grid = new THREE.GridHelper(9, 36, 0xe0d5c5, 0xece4d6);
  grid.position.y = -0.625; grid.visible = false; scene.add(grid);

  // cursor marker
  const curTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(95,86,76,0.95)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 20); g.moveTo(32, 44); g.lineTo(32, 60);
    g.moveTo(4, 32); g.lineTo(20, 32); g.moveTo(44, 32); g.lineTo(60, 32); g.stroke();
    g.fillStyle = 'rgba(95,86,76,0.95)'; g.fillRect(29, 29, 6, 6);
    return new THREE.CanvasTexture(c);
  })();
  const cursor = new THREE.Sprite(new THREE.SpriteMaterial({ map: curTex, transparent: true, opacity: 0.85, depthTest: false }));
  cursor.scale.setScalar(0.085); cursor.renderOrder = 99; cursor.visible = false; scene.add(cursor);

  // shared deform uniforms
  const U = {
    uGrab: { value: new THREE.Vector3(0, 99, 0) },
    uDir: { value: new THREE.Vector3(0, 0, -1) },
    uClosure: { value: 0 }, uFalloff: { value: 0.35 }, uDepth: { value: 0.5 }, uBulge: { value: 0.5 },
    uDentCount: { value: 0 },
    uDentPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
    uDentDir: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, -1)) },
    uDentAmt: { value: new Float32Array(8) },
    uCrackCount: { value: 0 },
    uCrackPos: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
    uCrackR: { value: new Float32Array(6) },
    uInnerColor: { value: new THREE.Color('#ffffff') },
    uInnerRough: { value: 0.08 },
    uShell: { value: 0 },
    uCrackFreq: { value: 8 },
    uCrackGap: { value: 0.12 },
    uCrackSink: { value: 0.035 }
  };
  function patch(mat) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = HEADER + '\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', NORMAL_CHUNK)
        .replace('#include <begin_vertex>', 'vec3 transformed = sqP;');
      sh.fragmentShader = FRAG_HEADER + '\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOR_CHUNK)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ROUGH_CHUNK);
    };
    mat.customProgramCacheKey = () => 'squish1';
    return mat;
  }
  function physMat(look) {
    return new THREE.MeshPhysicalMaterial({
      color: look.color, transmission: look.transmission, thickness: look.thickness,
      ior: look.ior, clearcoat: look.clearcoat, clearcoatRoughness: 0.25,
      roughness: look.roughness, metalness: 0,
      sheen: look.sheen, sheenColor: new THREE.Color(look.sss),
      attenuationColor: new THREE.Color(look.sss), attenuationDistance: 0.6,
      envMapIntensity: 1.35
    });
  }
  function applyLook(mat, look) {
    mat.color.set(look.color); mat.transmission = look.transmission; mat.thickness = look.thickness;
    mat.ior = look.ior; mat.clearcoat = look.clearcoat; mat.roughness = look.roughness;
    mat.sheen = look.sheen; mat.sheenColor.set(look.sss); mat.attenuationColor.set(look.sss);
    mat.needsUpdate = false;
  }

  // objects
  const built = {};
  const audio = makeAudio();
  let entry = null, group = null, softMesh = null, isWrap = false;
  let domes = [], poppedCount = 0, wrapMats = null;
  const holder = new THREE.Group(); scene.add(holder);
  let baseRotY = 0, autoRotate = false, rotDrift = 0;

  function buildObject(en) {
    const g = new THREE.Group();
    if (en.geometry === 'wrap') {
      const look = en.looks[0];
      const intact = physMat(look);
      const popped = physMat(look);
      popped.color.multiplyScalar(0.4); popped.roughness = Math.min(1, look.roughness + 0.3); popped.transmission *= 0.4;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 1.06), physMat(look));
      base.material.transmission = Math.min(1, look.transmission * 0.85);
      g.add(base);
      const domeGeo = new THREE.SphereGeometry(0.072, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const dm = [];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) {
        const d = new THREE.Mesh(domeGeo, intact);
        d.position.set((c - 4) * 0.152, 0.0225, (r - 2.5) * 0.152);
        d.userData = { popped: false, s: 1, t: 1, hover: 1, hv: 1 };
        g.add(d); dm.push(d);
      }
      g.rotation.x = 1.12;
      g.position.y = 0.06;
      g.userData = { domes: dm, mats: { intact, popped, base: base.material } };
    } else {
      const B = { bear: buildBear, blob: () => buildBlob(7.1, 0.20, 0.86, 0.92), dough: () => buildBlob(21.7, 0.10, 0.78, 0.84), butter: buildButter, cube: buildJelly, peach: buildPeach, banana: buildBanana, tomato: buildTomato, avocado: buildAvocado, mallow: buildMallow, balloon: buildBalloon, ice: buildIce };
      const geo = (B[en.geometry] || buildJelly)();
      const mat = patch(physMat(en.looks[0]));
      const m = new THREE.Mesh(geo, mat);
      if (geo.attributes.color) mat.vertexColors = true;
      g.add(m);
      if (en.geometry === 'butter') g.rotation.x = 0.14;
      g.userData = { mesh: m };
    }
    return g;
  }

  // spring state
  const spring = { c: 0, v: 0, target: 0, active: false };
  const input = { deadzone: 0.08, saturation: 0.92 };
  const deform = { falloffRadius: 0.35, depth: 0.5, stiffness: 10, damping: 0.82, bulge: 0.5, permanence: 0, recovery: 0 };
  let grabLocal = new THREE.Vector3(), grabWorld = new THREE.Vector3(), dirLocal = new THREE.Vector3(0, 0, -1), dirWorld = new THREE.Vector3();
  let dents = [];
  let cracks = [];
  let shellThreshold = 0.55;
  const stash = {};
  function syncCracks() {
    U.uCrackCount.value = cracks.length;
    cracks.forEach((c, i) => { U.uCrackPos.value[i].copy(c.pos); U.uCrackR.value[i] = c.r; });
  }
  function crackedNear(p) { return cracks.some(c => c.pos.distanceTo(p) < c.r * 0.75); }
  function doCrack() {
    cracks.push({ pos: grabLocal.clone(), r: deform.falloffRadius * (0.85 + 0.5 * spring.c) });
    if (cracks.length > 6) cracks.shift();
    syncCracks();
    pushDent(grabLocal, dirLocal, 0.12 * deform.depth, 0);
    audio.crack();
  }
  let pulse = null; // {t}

  function pushDent(pos, dir, amt, rate) {
    const maxA = deform.depth * 0.9;
    for (const d of dents) {
      if (d.pos.distanceTo(pos) < deform.falloffRadius * 0.55) {
        d.amt = Math.min(maxA, d.amt + amt * (1 - d.amt / maxA));
        d.pos.lerp(pos, 0.3);
        d.rate = rate;
        syncDents(); return;
      }
    }
    dents.push({ pos: pos.clone(), dir: dir.clone(), amt: Math.min(maxA, amt), rate: rate || 0 });
    if (dents.length > 8) dents.shift();
    syncDents();
  }
  function syncDents() {
    U.uDentCount.value = dents.length;
    dents.forEach((d, i) => { U.uDentPos.value[i].copy(d.pos); U.uDentDir.value[i].copy(d.dir); U.uDentAmt.value[i] = d.amt; });
  }

  // ---------- burst / shatter failure (liquid-filled + brittle objects) ----------
  let currentLook = null;
  const burstCfg = { threshold: 0.40, sprayCount: 90, wobble: 1.0 };
  const shatterCfg = { threshold: 0.72, shardScale: 1.0, tumble: 1.0 };
  let failGone = false, failArm = 0, strain = 0, respawnT = 0;
  let spray = null;   // { pts, geo, mat, vel[], life }
  let shards = null;  // { group, pieces:[{mesh, vel, ang}], mat, life }
  function endSqueeze() {
    dragging = false; pulse = null;
    spring.c = 0; spring.v = 0; spring.target = 0; spring.active = false;
    U.uClosure.value = 0;
    cursor.visible = false;
    if (opts.onState) opts.onState('MOUSE');
  }
  function spawnSpray() {
    const look = currentLook || (entry && entry.looks[0]) || { color: '#35b6e8', sss: '#9fe6ff' };
    const n = Math.max(8, Math.round(burstCfg.sprayCount));
    const posArr = new Float32Array(n * 3), colArr = new Float32Array(n * 3);
    const vel = [];
    const c1 = new THREE.Color(look.color), c2 = new THREE.Color(look.sss || look.color), tc = new THREE.Color();
    const cx = grabWorld.x * 0.5, cy = grabWorld.y * 0.5 - 0.05, cz = grabWorld.z * 0.5;
    for (let i = 0; i < n; i++) {
      posArr[i * 3] = cx + (Math.random() - 0.5) * 0.3;
      posArr[i * 3 + 1] = cy + (Math.random() - 0.5) * 0.3;
      posArr[i * 3 + 2] = cz + (Math.random() - 0.5) * 0.3;
      tc.copy(c1).lerp(c2, Math.random());
      colArr[i * 3] = tc.r; colArr[i * 3 + 1] = tc.g; colArr[i * 3 + 2] = tc.b;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sp = 0.7 + Math.random() * 1.6;
      vel.push(new THREE.Vector3(Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + 0.6, Math.sin(ph) * Math.sin(th) * sp));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    spray = { pts, geo, mat, vel, life: 0.8 };
  }
  function spawnShards() {
    if (!softMesh) return;
    const look = currentLook || entry.looks[0];
    const mat = physMat(look);
    mat.transparent = true;
    const posAttr = softMesh.geometry.attributes.position;
    const g = new THREE.Group();
    const pieces = [];
    const scl = shatterCfg.shardScale || 1;
    for (let i = 0; i < 26; i++) {
      const vi = Math.floor(Math.random() * posAttr.count);
      const p = new THREE.Vector3(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi)).multiplyScalar(0.82);
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry((0.05 + Math.random() * 0.08) * scl, 0), mat);
      m.scale.set(0.6 + Math.random() * 0.9, 0.6 + Math.random() * 0.9, 0.6 + Math.random() * 0.9);
      m.position.copy(p);
      m.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      const dir = p.clone(); dir.y += 0.15;
      const dl = Math.max(dir.length(), 0.15); dir.divideScalar(dl);
      const vel = dir.multiplyScalar(0.5 + Math.random() * 1.1);
      vel.y += 0.3 + Math.random() * 0.7;
      const tw = 7 * (shatterCfg.tumble || 0);
      pieces.push({ mesh: m, vel, ang: new THREE.Vector3((Math.random() - 0.5) * tw, (Math.random() - 0.5) * tw, (Math.random() - 0.5) * tw) });
      g.add(m);
    }
    g.position.copy(group.position); g.rotation.copy(group.rotation);
    holder.add(g);
    shards = { group: g, pieces, mat, life: 1.0 };
  }
  function doBurst() {
    spawnSpray();
    audio.splat();
    if (group) group.visible = false;
    failGone = true; respawnT = 1.2; failArm = 0; strain = 0;
    endSqueeze();
  }
  function doShatter() {
    spawnShards();
    audio.shatter();
    if (group) group.visible = false;
    failGone = true; respawnT = 1.2; failArm = 0; strain = 0;
    endSqueeze();
  }
  function respawnFresh() {
    failGone = false; failArm = 0; strain = 0; respawnT = 0;
    dents = []; syncDents(); cracks = []; syncCracks();
    if (entry) delete stash[entry.id];
    if (group) group.visible = true;
  }
  function clearFX() {
    if (spray) { scene.remove(spray.pts); spray.geo.dispose(); spray.mat.dispose(); spray = null; }
    if (shards) {
      holder.remove(shards.group);
      for (const pc of shards.pieces) pc.mesh.geometry.dispose();
      shards.mat.dispose(); shards = null;
    }
    if (failGone && group) group.visible = true;
    failGone = false; failArm = 0; strain = 0; respawnT = 0;
  }

  // pointer
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dragging = false, downX = 0, downY = 0, lastInputTs = 0, hoverDome = null;
  const inv = new THREE.Matrix4();
  // external hand input — when active, mouse pointer events are ignored and
  // setHandInput() drives the same grab pipeline with normalized coords
  let handActive = false;
  const handEvt = { clientX: 0, clientY: 0, timeStamp: 0 };

  function toNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    return r;
  }
  function raycastObj(e) {
    toNDC(e);
    ray.setFromCamera(ndc, camera);
    if (failGone) return null;
    if (isWrap) return ray.intersectObjects(domes, false)[0] || null;
    return softMesh ? ray.intersectObject(softMesh, false)[0] || null : null;
  }
  function popDome(d) {
    if (d.userData.popped) return;
    d.userData.popped = true; d.userData.t = -0.42;
    d.material = wrapMats.popped;
    poppedCount++;
    audio.pop();
    if (opts.onPop) opts.onPop(poppedCount, domes.length);
  }
  function onDown(e) {
    audio.ensure();
    lastInputTs = e.timeStamp;
    const hit = raycastObj(e);
    if (!hit) return;
    canvas.setPointerCapture && (() => { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} })();
    if (isWrap) { popDome(hit.object); dragging = true; return; }
    dragging = true;
    downX = e.clientX; downY = e.clientY;
    grabWorld.copy(hit.point);
    inv.copy(group.matrixWorld).invert();
    grabLocal.copy(hit.point).applyMatrix4(inv);
    dirLocal.copy(ray.ray.direction).transformDirection(inv).normalize();
    dirWorld.copy(ray.ray.direction);
    U.uGrab.value.copy(grabLocal);
    U.uDir.value.copy(dirLocal);
    spring.active = true;
    spring.target = 0.001;
  }
  function onMove(e) {
    lastInputTs = e.timeStamp;
    if (dragging && isWrap) {
      const hit = raycastObj(e);
      if (hit) popDome(hit.object);
      return;
    }
    if (dragging && !pulse) {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      const raw = Math.sqrt(dx * dx + dy * dy) / (canvas.clientHeight * 0.30);
      const t = Math.max(0, Math.min(1, (raw - input.deadzone) / (input.saturation - input.deadzone)));
      spring.target = t;
      return;
    }
    const hit = raycastObj(e);
    if (isWrap) {
      if (hoverDome && hoverDome !== (hit && hit.object)) hoverDome.userData.hv = 1;
      hoverDome = hit ? hit.object : null;
      if (hoverDome && !hoverDome.userData.popped) hoverDome.userData.hv = 1.14;
      cursor.visible = false;
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    } else if (hit && !dragging) {
      cursor.visible = true;
      cursor.position.copy(hit.point).addScaledVector(hit.face ? hit.face.normal : new THREE.Vector3(0, 0, 1), 0.02);
    } else if (!dragging) {
      cursor.visible = false;
    }
  }
  function settle() {
    if (spring.c > 0.1) {
      if (deform.permanence > 0) {
        const amt = spring.c * deform.depth * deform.permanence;
        pushDent(grabLocal, dirLocal, amt, 0);
        spring.c = spring.c * (1 - deform.permanence);
      } else if (deform.recovery > 0.05) {
        const amt = spring.c * deform.depth;
        pushDent(grabLocal, dirLocal, amt, amt / deform.recovery);
        spring.c = 0; spring.v = 0;
      }
    }
    spring.target = 0;
  }
  function release() {
    if (!dragging) return;
    dragging = false;
    if (!isWrap) settle(); else spring.target = 0;
    spring.active = false;
  }
  canvas.addEventListener('pointerdown', (e) => { if (!handActive) onDown(e); });
  canvas.addEventListener('pointermove', (e) => { if (!handActive) onMove(e); });
  canvas.addEventListener('pointerup', () => { if (!handActive) release(); });
  canvas.addEventListener('pointercancel', () => { if (!handActive) release(); });
  canvas.addEventListener('pointerleave', () => { if (!handActive && !dragging) cursor.visible = false; });

  // stats
  let fpsE = 60, frames = 0, fpsT = 0;

  const clock = new THREE.Clock();
  let raf = 0, disposed = false;

  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    let dt = Math.min(clock.getDelta(), 0.033); // clamp: tab refocus must not explode the spring
    // debug pulse curve: ramp in, hold w/ wobble, snap release
    if (pulse) {
      pulse.t += dt;
      const t = pulse.t;
      if (t < 0.55) spring.target = 0.88 * (t / 0.55) * (t / 0.55) * (3 - 2 * t / 0.55);
      else if (t < 1.0) spring.target = 0.88 + Math.sin(t * 22) * 0.025;
      else if (pulse.held !== true) {
        pulse.held = true;
        settle();
      }
      if (t > 2.2) { pulse = null; if (opts.onState) opts.onState(handActive ? 'HAND' : 'MOUSE'); }
    }
    // damped spring, substepped for stability at high stiffness
    const w = deform.stiffness * 3.2;
    const zeta = Math.max(0.05, (deform.damping - 0.5) * 2.2);
    const n = 4, h = dt / n;
    let prevC = spring.c;
    for (let i = 0; i < n; i++) {
      const a = w * w * (spring.target - spring.c) - 2 * zeta * w * spring.v;
      spring.v += a * h;
      spring.c += spring.v * h;
    }
    spring.c = Math.max(-0.3, Math.min(1.35, spring.c));
    U.uClosure.value = spring.c;
    if (dragging && entry && entry.shell && spring.c > shellThreshold && !crackedNear(grabLocal)) doCrack();
    // burst / shatter stress: sustained hard squeeze past threshold triggers failure
    if (entry && (entry.burst || entry.shatter) && !failGone) {
      const squeezing = dragging || !!pulse;
      if (entry.burst) {
        const metric = Math.max(0, spring.c) * deform.depth;
        if (squeezing && metric > burstCfg.threshold) failArm += dt;
        else failArm = Math.max(0, failArm - dt * 2);
        strain = Math.min(1, failArm / 0.16);
        if (failArm >= 0.16) doBurst();
      } else {
        if (squeezing && spring.c > shatterCfg.threshold) failArm += dt;
        else failArm = Math.max(0, failArm - dt * 3);
        strain = Math.min(1, failArm / 0.22);
        if (failArm >= 0.22) doShatter();
      }
      // liquid strain wobble while armed
      if (strain > 0 && entry.burst && !failGone) {
        U.uClosure.value = spring.c + Math.sin(performance.now() * 0.055) * 0.05 * strain * (burstCfg.wobble || 0);
      }
    }
    let sqDirty = false;
    for (const d of dents) if (d.rate > 0) { d.amt -= d.rate * dt; sqDirty = true; }
    if (sqDirty) { dents = dents.filter(d => d.amt > 0.006); syncDents(); }
    audio.squish(dt > 0 ? (spring.c - prevC) / dt : 0, Math.max(0, Math.min(1, spring.c)));
    // cursor pushes in with closure while grabbed
    if (dragging && !isWrap) {
      cursor.visible = true;
      cursor.position.copy(grabWorld).addScaledVector(dirWorld, spring.c * deform.depth * 0.8);
    }
    // domes settle
    if (isWrap) {
      for (const d of domes) {
        const ud = d.userData;
        ud.s += (ud.t - ud.s) * Math.min(1, dt * 13);
        ud.hover += (ud.hv - ud.hover) * Math.min(1, dt * 18);
        d.scale.set(ud.hover, ud.s * ud.hover, ud.hover);
      }
    }
    // spray particles: gravity + floor damp, fade out over life
    if (spray) {
      spray.life -= dt;
      const sp = spray.geo.attributes.position;
      for (let i = 0; i < spray.vel.length; i++) {
        const v = spray.vel[i];
        v.y -= 3.6 * dt;
        sp.setXYZ(i, sp.getX(i) + v.x * dt, sp.getY(i) + v.y * dt, sp.getZ(i) + v.z * dt);
        if (sp.getY(i) < -0.6) { sp.setY(i, -0.6); v.y *= -0.25; v.x *= 0.72; v.z *= 0.72; }
      }
      sp.needsUpdate = true;
      spray.mat.opacity = Math.max(0, Math.min(1, spray.life / 0.35));
      if (spray.life <= 0) { scene.remove(spray.pts); spray.geo.dispose(); spray.mat.dispose(); spray = null; }
    }
    // shard pieces: fall, tumble, fade
    if (shards) {
      shards.life -= dt;
      for (const pc of shards.pieces) {
        pc.vel.y -= 4.4 * dt;
        pc.mesh.position.addScaledVector(pc.vel, dt);
        if (pc.mesh.position.y < -0.53) { pc.mesh.position.y = -0.53; pc.vel.y *= -0.3; pc.vel.x *= 0.75; pc.vel.z *= 0.75; }
        pc.mesh.rotation.x += pc.ang.x * dt; pc.mesh.rotation.y += pc.ang.y * dt; pc.mesh.rotation.z += pc.ang.z * dt;
      }
      shards.mat.opacity = Math.max(0, Math.min(1, shards.life / 0.45));
      if (shards.life <= 0) {
        holder.remove(shards.group);
        for (const pc of shards.pieces) pc.mesh.geometry.dispose();
        shards.mat.dispose(); shards = null;
      }
    }
    if (failGone) {
      respawnT -= dt;
      if (respawnT <= 0) respawnFresh();
    }
    if (autoRotate && !dragging) rotDrift += dt * 0.22;
    if (group) group.rotation.y = baseRotY + rotDrift;
    renderer.render(scene, camera);
    // stats out
    frames++; fpsT += dt;
    if (fpsT >= 0.5) { fpsE = frames / fpsT; frames = 0; fpsT = 0; }
    if (opts.onFrame) {
      const now = performance.now();
      const lat = (now - lastInputTs < 80) ? now - lastInputTs : -1;
      opts.onFrame({ fps: fpsE, lat, closure: Math.max(0, Math.min(1, spring.c)), active: dragging || !!pulse });
    }
  }

  function resize() {
    const w = mount.clientWidth || 800, h = mount.clientHeight || 600;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = w / h;
    // portrait: widen vertical fov so the object stays fully in frame on phones
    camera.fov = camera.aspect < 1 ? Math.min(55, (2 * Math.atan(Math.tan((33 * Math.PI) / 360) / camera.aspect) * 360) / Math.PI) : 33;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();
  tick();

  // ---------- API ----------
  const E = {
    setObject(en) {
      clearFX();
      if (entry) stash[entry.id] = { dents, cracks };
      entry = en;
      if (group) holder.remove(group);
      if (!built[en.id]) built[en.id] = buildObject(en);
      group = built[en.id];
      holder.add(group);
      isWrap = en.geometry === 'wrap';
      if (isWrap) {
        domes = group.userData.domes; wrapMats = group.userData.mats;
        poppedCount = domes.filter(d => d.userData.popped).length;
        softMesh = null;
        shadow.scale.setScalar(1.15);
      } else {
        softMesh = group.userData.mesh; domes = []; wrapMats = null;
        shadow.scale.setScalar(1);
      }
      baseRotY = ({ bear: 0.45, cube: 0.6, butter: 0.5, peach: 0.55, banana: 0.12, tomato: 0.4, avocado: 0.3, mallow: 0.3, balloon: 0.2, ice: 0.55 })[en.geometry] || 0;
      rotDrift = 0;
      Object.assign(deform, en.deform);
      U.uFalloff.value = deform.falloffRadius; U.uDepth.value = deform.depth; U.uBulge.value = deform.bulge;
      audio.squishHz = en.audio.squishHz || 900; audio.popHz = en.audio.popHz || 1400;
      spring.c = 0; spring.v = 0; spring.target = 0; dragging = false; pulse = null;
      const st = stash[en.id];
      dents = st ? st.dents : [];
      cracks = st ? st.cracks : [];
      syncDents(); syncCracks();
      U.uShell.value = en.shell ? 1 : 0;
      shellThreshold = en.shell ? en.shell.threshold : 0.55;
      U.uInnerRough.value = en.shell ? en.shell.innerRough : 0.08;
      U.uCrackFreq.value = (en.shell && en.shell.freq) || 8;
      U.uInnerColor.value.set((en.looks[0] && en.looks[0].inner) || '#ffffff');
      currentLook = en.looks[0];
      burstCfg.threshold = (en.burst && en.burst.threshold) || 0.40;
      burstCfg.sprayCount = (en.burst && en.burst.sprayCount) || 90;
      burstCfg.wobble = (en.burst && en.burst.wobble != null) ? en.burst.wobble : 1.0;
      shatterCfg.threshold = (en.shatter && en.shatter.threshold) || 0.72;
      shatterCfg.shardScale = (en.shatter && en.shatter.shardScale) || 1.0;
      shatterCfg.tumble = (en.shatter && en.shatter.tumble != null) ? en.shatter.tumble : 1.0;
      U.uGrab.value.set(0, 99, 0);
      cursor.visible = false;
      if (opts.onPop && isWrap) opts.onPop(poppedCount, domes.length);
    },
    setLook(look) {
      if (!group) return;
      currentLook = look;
      if (isWrap) {
        applyLook(wrapMats.intact, look);
        applyLook(wrapMats.base, look); wrapMats.base.transmission = Math.min(1, look.transmission * 0.85);
        applyLook(wrapMats.popped, look);
        wrapMats.popped.color.multiplyScalar(0.4); wrapMats.popped.roughness = Math.min(1, look.roughness + 0.3); wrapMats.popped.transmission = look.transmission * 0.4;
      } else applyLook(softMesh.material, look);
      if (look.inner) U.uInnerColor.value.set(look.inner);
    },
    setDeform(k, v) {
      deform[k] = v;
      if (k === 'falloffRadius') U.uFalloff.value = v;
      if (k === 'depth') U.uDepth.value = v;
      if (k === 'bulge') U.uBulge.value = v;
    },
    setInput(k, v) { input[k] = v; },
    setMaterial(k, v) {
      const mats = isWrap ? [wrapMats.intact, wrapMats.base] : softMesh ? [softMesh.material] : [];
      for (const m of mats) m[k] = v;
    },
    setShell(k, v) {
      if (k === 'threshold') shellThreshold = v;
      if (k === 'innerRough') U.uInnerRough.value = v;
      if (k === 'freq') U.uCrackFreq.value = v;
    },
    setBurst(k, v) { burstCfg[k] = v; },
    setShatter(k, v) { shatterCfg[k] = v; },
    setAudioParam(k, v) { if (k === 'squishHz') audio.squishHz = v; else audio.popHz = v; },
    setAudio(on) { audio.ensure(); audio.setOn(on); },
    reset() {
      clearFX();
      dents = []; syncDents(); cracks = []; syncCracks(); spring.c = 0; spring.v = 0; spring.target = 0;
      if (entry) delete stash[entry.id];
      if (isWrap) { for (const d of domes) { d.userData.popped = false; d.userData.t = 1; d.material = wrapMats.intact; } poppedCount = 0; if (opts.onPop) opts.onPop(0, domes.length); }
    },
    pulse() {
      if (isWrap || !softMesh || pulse || failGone) return;
      // grab the front-center of the object
      ray.set(camera.position, new THREE.Vector3(0, 0.05, 0).sub(camera.position).normalize());
      const hit = ray.intersectObject(softMesh, false)[0];
      if (!hit) return;
      grabWorld.copy(hit.point);
      inv.copy(group.matrixWorld).invert();
      grabLocal.copy(hit.point).applyMatrix4(inv);
      dirLocal.copy(ray.ray.direction).transformDirection(inv).normalize();
      dirWorld.copy(ray.ray.direction);
      U.uGrab.value.copy(grabLocal); U.uDir.value.copy(dirLocal);
      pulse = { t: 0 };
      audio.ensure();
      if (opts.onState) opts.onState('DEBUG');
    },
    setHandActive(on) {
      handActive = !!on;
      if (!handActive) {
        if (dragging) release();
        cursor.visible = false;
      }
      if (opts.onState) opts.onState(handActive ? 'HAND' : 'MOUSE');
    },
    setHandInput(h) {
      if (!handActive) return;
      if (!h || !h.present) {
        if (dragging) release();
        cursor.visible = false;
        return;
      }
      const r = canvas.getBoundingClientRect();
      handEvt.clientX = r.left + h.x * r.width;
      handEvt.clientY = r.top + h.y * r.height;
      handEvt.timeStamp = performance.now();
      lastInputTs = handEvt.timeStamp;
      // same deadzone/saturation mapping the mouse drag distance goes through
      const t = Math.max(0, Math.min(1, (h.closure - input.deadzone) / (input.saturation - input.deadzone)));
      if (dragging) {
        // open hand lets go — slight hysteresis below the deadzone to avoid flutter
        if (h.closure < input.deadzone * 0.75) { release(); return; }
        if (isWrap) { const hit = raycastObj(handEvt); if (hit) popDome(hit.object); return; }
        if (!pulse) spring.target = t;
        return;
      }
      // closed past the deadzone: try to engage (onDown raycasts + starts the grab / pops a dome)
      if (t > 0) onDown(handEvt);
      if (!dragging && !isWrap) {
        // hover: cursor tracks the hand — on the surface when over it, floating at object depth otherwise
        const hit = raycastObj(handEvt);
        if (hit) cursor.position.copy(hit.point).addScaledVector(hit.face ? hit.face.normal : new THREE.Vector3(0, 0, 1), 0.02);
        else ray.ray.at(camera.position.length(), cursor.position);
        cursor.visible = true;
      }
    },
    setBackdrop(kind) { grid.visible = kind === 'grid'; },
    setAutoRotate(b) { autoRotate = b; if (!b) rotDrift = 0; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
      renderer.dispose();
    }
  };
  window.__SQ = { scene, camera, renderer, holder, U };
  return E;
}
