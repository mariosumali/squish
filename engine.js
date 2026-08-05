// SQUISH engine — scene, shader deformer, input, audio. No UI in here.
import * as THREE from './vendor/three.module.min.js';

const HEADER = `
uniform float uActive;
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
vec3 sqP = position;
vec3 objectNormal = vec3(normal);
if (uActive > 0.5) {
  sqP = sqDisp(position);
  vec3 sqUpv = abs(normal.y) > 0.94 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 sqT = normalize(cross(normal, sqUpv));
  vec3 sqB = cross(normal, sqT);
  vec3 sqPa = sqDisp(position + sqT * 0.02);
  vec3 sqPb = sqDisp(position + sqB * 0.02);
  objectNormal = normalize(cross(sqPa - sqP, sqPb - sqP));
}
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
  geo.userData.norm = { s, ty: baseY - b2.min.y }; // build-space -> final-space y map
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
function buildFloe(en) {
  // jittered-grid voronoi over a long sheet rectangle — the tessellation is
  // exact and the panes sit flush, so at rest the sheet reads as one unbroken
  // slab of ice. Interior edges are subdivided into jagged fracture lines;
  // both neighbours pull the SAME cached polyline, so the jags still mesh
  // perfectly and only show once a section breaks out.
  const W = 1.6, D = 0.8, T = 0.05;
  const cfg = en.panes || {};
  const cols = cfg.cols || 8, rows = cfg.rows || 4;
  const sites = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    sites.push({
      x: ((c + 0.5) / cols - 0.5) * W + (hashN(c * 7.3, r * 3.1, 5.2) - 0.5) * (W / cols) * 0.62,
      z: ((r + 0.5) / rows - 0.5) * D + (hashN(c * 2.9, r * 8.7, 1.7) - 0.5) * (D / rows) * 0.62
    });
  }
  const Qz = (v) => Math.round(v * 1e5); // quantize endpoints for edge identity
  const sameBorder = (a, b) => (
    (Math.abs(a[0] - W / 2) < 1e-4 && Math.abs(b[0] - W / 2) < 1e-4) ||
    (Math.abs(a[0] + W / 2) < 1e-4 && Math.abs(b[0] + W / 2) < 1e-4) ||
    (Math.abs(a[1] - D / 2) < 1e-4 && Math.abs(b[1] - D / 2) < 1e-4) ||
    (Math.abs(a[1] + D / 2) < 1e-4 && Math.abs(b[1] + D / 2) < 1e-4)
  );
  const edgeCache = new Map();
  const jagEdge = (a, b) => {
    const ka = Qz(a[0]) + ',' + Qz(a[1]), kb = Qz(b[0]) + ',' + Qz(b[1]);
    const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    let pl = edgeCache.get(key);
    if (!pl) {
      const p = ka < kb ? a : b, q = ka < kb ? b : a;
      pl = [p];
      const ex = q[0] - p[0], ez = q[1] - p[1];
      const len = Math.hypot(ex, ez);
      // the sheet's outer rim stays a clean straight cut — only interior
      // fracture lines get the zigzag
      if (len > 1e-6 && !sameBorder(a, b)) {
        const segs = Math.max(2, Math.round(len / 0.06));
        const px = -ez / len, pz = ex / len;
        for (let s = 1; s < segs; s++) {
          const t = s / segs;
          const amp = (hashN(Qz(p[0]) * 0.0137 + s * 7.1, Qz(p[1]) * 0.0113, Qz(q[0]) * 0.0171 + s * 3.7) - 0.5) * 0.032;
          pl.push([p[0] + ex * t + px * amp, p[1] + ez * t + pz * amp]);
        }
      }
      pl.push(q);
      edgeCache.set(key, pl);
    }
    const st = pl[0];
    return (Qz(st[0]) === Qz(a[0]) && Qz(st[1]) === Qz(a[1])) ? pl : pl.slice().reverse();
  };
  const panes = [];
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    let poly = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]];
    // clip the sheet against the perpendicular bisector of every other site
    for (let j = 0; j < sites.length && poly.length > 2; j++) {
      if (j === i) continue;
      const o = sites[j];
      const mx = (s.x + o.x) / 2, mz = (s.z + o.z) / 2, nx = o.x - s.x, nz = o.z - s.z;
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length];
        const da = (a[0] - mx) * nx + (a[1] - mz) * nz, db = (b[0] - mx) * nx + (b[1] - mz) * nz;
        if (da <= 0) out.push(a);
        if ((da < 0) !== (db < 0)) {
          const t = da / (da - db);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      poly = out;
    }
    if (poly.length < 3) continue;
    // stitch the jagged shared edges into this pane's outline
    const ring = [];
    for (let k = 0; k < poly.length; k++) {
      const pl = jagEdge(poly[k], poly[(k + 1) % poly.length]);
      for (let m = 0; m < pl.length - 1; m++) ring.push(pl[m]);
    }
    let cx = 0, cz = 0;
    for (const p of ring) { cx += p[0]; cz += p[1]; }
    cx /= ring.length; cz /= ring.length;
    const pts = ring.map(([x, z]) => [x - cx, z - cz]);
    // extrude to a prism, non-indexed so the fracture edges shade crisp; the
    // side walls carry pure-white vertex color — invisible while the sheet is
    // whole, a frosted broken edge once a neighbour snaps out
    const n = pts.length, yT = T / 2, yB = -T / 2, C = [0, 0];
    const vp = [], vc = [];
    const put = (p, y, br) => { vp.push(p[0], y, p[1]); vc.push(br, br, Math.min(1, br + 0.03)); };
    for (let k = 0; k < n; k++) { // top fan around the centroid (+y; the ring winds CW seen from above, and stays star-shaped despite the jags)
      put(C, yT, 0.97); put(pts[(k + 1) % n], yT, 0.97); put(pts[k], yT, 0.97);
    }
    for (let k = 0; k < n; k++) { // bottom fan (−y)
      put(C, yB, 0.85); put(pts[k], yB, 0.85); put(pts[(k + 1) % n], yB, 0.85);
    }
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % n];
      put(a, yT, 1); put(b, yT, 1); put(b, yB, 1);
      put(a, yT, 1); put(b, yB, 1); put(a, yB, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vp), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vc), 3));
    geo.computeVertexNormals();
    panes.push({ geo, cx, cz });
  }
  return { panes, W, D, T };
}
const waxTmpC = new THREE.Color();
function paintWax(geo) {
  // repaint every vertex from the current palette; a vertex's layer is how far
  // it has been carved in from its pristine surface position (dip-candle style)
  const pos = geo.attributes.position, col = geo.attributes.color;
  if (!col || !geo.userData.waxLayer) return;
  const pr = geo.userData.pristine ? geo.userData.pristine.pos : null;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let dep = 0;
    if (pr) {
      const dx = x - pr[i * 3], dy = y - pr[i * 3 + 1], dz = z - pr[i * 3 + 2];
      dep = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    geo.userData.waxLayer(x, y, z, dep, waxTmpC);
    col.setXYZ(i, waxTmpC.r, waxTmpC.g, waxTmpC.b);
  }
  col.needsUpdate = true;
}
function buildPeanut(en) {
  // a squat two-lobed peanut, dipped in wax: the layers are concentric shells,
  // so color = depth carved from the original surface, not a position band
  const layerDepth = (en.carve && en.carve.layerDepth) || 0.07;
  const sdf = (p) => smin(
    sdEll(p, 0, 0.235, 0, 0.285, 0.30, 0.285),
    sdEll(p, 0, -0.225, 0, 0.335, 0.345, 0.335),
    0.16
  );
  const bump = (x, y, z) => vnoise(x * 9, y * 9, z * 9) * 0.010 + vnoise(x * 21, y * 21, z * 21) * 0.004;
  const geo = sdfGeo(sdf, 0.98, null, bump);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const layers = (en.looks[0] && en.looks[0].layers) || ['#d9a05c', '#f2e2c2', '#c97c3a', '#6b4226'];
  geo.userData.waxPalette = layers.map((h) => new THREE.Color(h));
  geo.userData.waxLayer = (x, y, z, depth, c) => {
    const pal = geo.userData.waxPalette;
    // wavy hand-dipped boundaries, plus a shadow ring right where a layer
    // breaks to the next — reads as the flaked edge of the cracked shell
    const t = (depth + vnoise(x * 9, y * 9, z * 9) * 0.016) / layerDepth;
    let idx = Math.floor(t);
    idx = Math.max(0, Math.min(pal.length - 1, idx));
    c.copy(pal[idx]);
    c.multiplyScalar(1 - 0.18 * ss(0.75, 0.98, t - idx));
  };
  geo.userData.biteColor = (x, y, z, c, depth) => {
    geo.userData.waxLayer(x, y, z, depth || 0, c);
  };
  paintWax(geo);
  return geo;
}
function sdRBox(p, bx, by, bz, r) {
  const qx = Math.abs(p.x) - bx, qy = Math.abs(p.y) - by, qz = Math.abs(p.z) - bz;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}
function buildSugar() {
  const sdf = (p) => sdRBox(p, 0.32, 0.30, 0.32, 0.10);
  const colorFn = (x, y, z, c) => {
    // sparse crystal glints over an ever-so-off-white grain
    const n = vnoise(x * 34, y * 34, z * 34);
    const s = 0.90 + 0.10 * ss(0.25, 0.75, n);
    c.setRGB(s, s, s * 0.99);
  };
  const bump = (x, y, z) => vnoise(x * 21, y * 21, z * 21) * 0.014 + vnoise(x * 47, y * 47, z * 47) * 0.007;
  return sdfGeo(sdf, 0.86, colorFn, bump);
}
function buildSnowglobe() {
  const sdf = (p) => {
    const d = sdSph(p, 0, 0.10, 0, 0.40);
    const flare = 1 + 0.22 * ss(-0.20, -0.44, p.y);
    const dxz = Math.hypot(p.x, p.z) - 0.30 * flare;
    const dy = Math.abs(p.y + 0.33) - 0.13;
    const base = Math.min(Math.max(dxz, dy), 0) + Math.hypot(Math.max(dxz, 0), Math.max(dy, 0)) - 0.03;
    return smin(d, base, 0.05);
  };
  const wood = CC('#5a3a26'), trim = CC('#c9a45a'), snow = CC('#ffffff');
  const colorFn = (x, y, z, c) => {
    if (y < -0.185) { c.copy(wood).lerp(trim, 1 - ss(0.015, 0.05, Math.abs(y + 0.20))); return; }
    c.setRGB(0.88, 0.94, 1.0);
    const drift = 1 - ss(-0.20, -0.09, y);
    const fleck = ss(0.55, 0.8, vnoise(x * 26, y * 26, z * 26)) * 0.85;
    c.lerp(snow, Math.max(drift, fleck));
  };
  return sdfGeo(sdf, 1.0, colorFn, null);
}
function buildCheese() {
  // rounded box tapered into a wedge — box topology keeps the creases clean;
  // holes are dimples pushed in along the normal, not SDF subtractions
  const holes = [
    [0.05, 0.15, -0.05, 0.09], [-0.14, 0.15, -0.30, 0.11], [0.10, 0.15, 0.26, 0.06],
    [-0.32, 0.00, -0.10, 0.09], [0.34, -0.04, -0.26, 0.08], [0.0, -0.02, -0.47, 0.10],
    [0.20, -0.15, 0.05, 0.07],
    // mouse nibbles scalloped around the nose tip
    [0.03, 0.13, 0.51, 0.06], [-0.05, 0.04, 0.53, 0.055], [0.05, -0.06, 0.52, 0.05], [-0.02, -0.13, 0.50, 0.045]
  ];
  const geo = new THREE.BoxGeometry(0.9, 0.30, 0.95, 48, 20, 48);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const r = 0.05, hx = 0.45 - r, hy = 0.15 - r, hz = 0.475 - r;
  const cols = new Float32Array(pos.count * 3);
  const shade = CC('#8a6a3a'), tmpC = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const qx = Math.max(-hx, Math.min(hx, x)), qy = Math.max(-hy, Math.min(hy, y)), qz = Math.max(-hz, Math.min(hz, z));
    let nx = x - qx, ny = y - qy, nz = z - qz;
    let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl < 1e-6) { nx = nor.getX(i); ny = nor.getY(i); nz = nor.getZ(i); nl = 1; }
    nx /= nl; ny /= nl; nz /= nl;
    let px = qx + nx * r, py = qy + ny * r, pz = qz + nz * r;
    px *= 0.16 + 0.84 * ss(0.55, -0.5, pz); // taper toward the nose
    let dim = 0, hd = 1e9;
    for (const h of holes) {
      const d = Math.hypot(px - h[0], py - h[1], pz - h[2]);
      dim = Math.max(dim, h[3] - d);
      hd = Math.min(hd, d - h[3]);
    }
    pos.setXYZ(i, px - nx * dim * 0.7, py - ny * dim * 0.7, pz - nz * dim * 0.7);
    tmpC.setRGB(1, 1, 1);
    tmpC.lerp(shade, 0.35 * (1 - ss(0.0, 0.06, hd)));
    tmpC.lerp(shade, 0.20 * (1 - ss(-0.47, -0.42, pz)));
    cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  normalizeGeo(geo, 0.42, -0.585);
  return geo;
}
function buildBao() {
  const sdf = (p) => {
    let d = sdEll(p, 0, -0.06, 0, 0.50, 0.40, 0.50);
    // pleats spiral up the dome and gather under the topknot
    const th = Math.atan2(p.z, p.x);
    const up = ss(-0.15, 0.30, p.y);
    d += 0.024 * up * Math.abs(Math.sin(th * 7 + p.y * 2.5));
    d = smin(d, sdSph(p, 0, 0.325, 0, 0.075), 0.06);
    return d;
  };
  const crease = CC('#cbb99e'), skirt = CC('#e2d6c2');
  const colorFn = (x, y, z, c) => {
    const th = Math.atan2(z, x);
    const up = ss(-0.15, 0.30, y);
    c.setRGB(1, 1, 1).lerp(crease, 0.32 * up * Math.abs(Math.sin(th * 7 + y * 2.5)));
    c.lerp(skirt, 1 - ss(-0.42, -0.24, y));
  };
  return sdfGeo(sdf, 0.78, colorFn, null);
}
function buildBrulee() {
  const rr = 0.07;
  const sdf = (p) => {
    const dxz = Math.hypot(p.x, p.z) - 0.42 + rr;
    const dy = Math.abs(p.y) - 0.16 + rr;
    return Math.min(Math.max(dxz, dy), 0) + Math.hypot(Math.max(dxz, 0), Math.max(dy, 0)) - rr;
  };
  // torched sugar: uneven blistered top over pale custard sides
  const bump = (x, y, z) => (vnoise(x * 14, 3.3, z * 14) * 0.02 + vnoise(x * 31, 7.7, z * 31) * 0.008) * ss(0.04, 0.14, y);
  const car = CC('#c97a1e'), dark = CC('#7a3c0a'), cust = CC('#f5d78a');
  const colorFn = (x, y, z, c) => {
    const n = vnoise(x * 9, 0, z * 9) + 0.5 * vnoise(x * 21, 3, z * 21);
    c.copy(car).lerp(dark, ss(0.15, 0.75, n) * 0.8);
    c.lerp(cust, 1 - ss(0.02, 0.10, y));
  };
  return sdfGeo(sdf, 0.52, colorFn, bump);
}
function buildCandyApple() {
  const sdf = (p) => {
    let d = sdEll(p, 0, -0.06, 0, 0.40, 0.37, 0.40);
    const dd = Math.hypot(p.x, p.y - 0.28, p.z);
    d += 0.05 * Math.exp(-dd * dd / 0.01);
    d = smin(d, sdCap(p, 0, 0.24, 0, 0, 0.52, 0, 0.035), 0.03);
    return d;
  };
  const stick = CC('#8a6a3a');
  const colorFn = (x, y, z, c) => {
    c.setRGB(1, 1, 1).lerp(stick, ss(0.30, 0.36, y));
  };
  return sdfGeo(sdf, 0.92, colorFn, null);
}
function buildEgg() {
  const sdf = (p) => {
    const w = 1 - 0.18 * ss(-0.1, 0.42, p.y); // tapers toward the top like a real egg
    return sdEll(p, 0, 0, 0, 0.34 * w, 0.45, 0.34 * w);
  };
  return sdfGeo(sdf, 0.92, null, null);
}
function buildBurger() {
  const sdf = (p) => {
    const th = Math.atan2(p.z, p.x);
    let d = sdEll(p, 0, -0.30, 0, 0.46, 0.13, 0.46);                       // heel bun
    d = smin(d, sdEll(p, 0, -0.16, 0, 0.485, 0.095, 0.485), 0.03);         // patty
    const sq = 1 + 0.10 * Math.abs(Math.cos(th * 2));                      // squarish cheese, corners drooping
    d = smin(d, sdEll(p, 0, -0.075, 0, 0.50 * sq, 0.038, 0.50 * sq), 0.035);
    const ru = 1 + 0.07 * Math.cos(th * 9);                                // ruffled lettuce
    d = smin(d, sdEll(p, 0, -0.005, 0, 0.52 * ru, 0.042, 0.52 * ru), 0.03);
    d = smin(d, sdEll(p, 0, 0.055, 0, 0.44, 0.045, 0.44), 0.03);           // tomato
    d = smin(d, sdEll(p, 0, 0.19, 0, 0.47, 0.24, 0.47), 0.045);            // crown bun
    return d;
  };
  const bun = CC('#e8a95a'), crown = CC('#c9803a'), crumb = CC('#f2dfae'), patty = CC('#6b4226'),
    pattyIn = CC('#8a5c38'), cheese = CC('#ffc82e'), lettuce = CC('#7ab648'), tomato = CC('#e04a2e'),
    seed = CC('#f7ecd2');
  const colorFn = (x, y, z, c) => {
    const yy = y + 0.012 * vnoise(x * 9, y * 9, z * 9);
    if (yy < -0.225) c.copy(bun);
    else if (yy < -0.115) c.copy(patty);
    else if (yy < -0.042) c.copy(cheese);
    else if (yy < 0.028) c.copy(lettuce);
    else if (yy < 0.092) c.copy(tomato);
    else {
      c.copy(bun).lerp(crown, ss(0.12, 0.38, y));
      const n = vnoise(x * 30, y * 30, z * 30) + 0.5 * vnoise(x * 61, y * 61, z * 61);
      c.lerp(seed, ss(0.72, 0.86, n) * ss(0.12, 0.22, y));
    }
  };
  const geo = sdfGeo(sdf, 0.95, colorFn, null);
  // interior palette for chomp craters — the engine recolors bitten vertices
  geo.userData.biteColor = (x, y, z, c) => {
    const n = geo.userData.norm;
    const yr = (y - n.ty) / n.s;
    if (yr < -0.225) c.copy(crumb);
    else if (yr < -0.115) c.copy(pattyIn);
    else if (yr < -0.042) c.copy(cheese);
    else if (yr < 0.028) c.copy(lettuce);
    else if (yr < 0.092) c.copy(tomato);
    else c.copy(crumb);
  };
  return geo;
}
function buildKeycaps() {
  // two keycaps on a plinth — box topology like the cheese so the top faces
  // carry enough vertices to render the printed legends as vertex colors
  const legend = (text, font, w) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, 128);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = font;
    g.fillText(text, w / 2, 68);
    const d = g.getImageData(0, 0, w, 128).data;
    return (u, v) => {
      const px = Math.round(Math.max(0, Math.min(1, u)) * (w - 1));
      const py = Math.round(Math.max(0, Math.min(1, v)) * 127);
      return d[(py * w + px) * 4] / 255;
    };
  };
  // near-black legend — the overhead env panels blow upward faces out so hard
  // that anything lighter tone-maps to white along with the key top
  const ink = CC('#181215'), tmpC = new THREE.Color();
  const part = (bx, by, bz, r, sx, sy, sz, o) => {
    const geo = new THREE.BoxGeometry(bx, by, bz, sx, sy, sz);
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const hx = bx / 2 - r, hy = by / 2 - r, hz = bz / 2 - r;
    const cols = new Float32Array(pos.count * 3);
    const body = CC(o.color), wall = CC(o.color).multiplyScalar(0.90);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const qx = Math.max(-hx, Math.min(hx, x)), qy = Math.max(-hy, Math.min(hy, y)), qz = Math.max(-hz, Math.min(hz, z));
      let nx = x - qx, ny = y - qy, nz = z - qz;
      let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-6) { nx = nor.getX(i); ny = nor.getY(i); nz = nor.getZ(i); nl = 1; }
      nx /= nl; ny /= nl; nz /= nl;
      const px = qx + nx * r, py = qy + ny * r, pz = qz + nz * r;
      tmpC.copy(body).lerp(wall, ss(0.6, 0.1, ny)); // side walls a shade deeper
      if (o.mask && py > by / 2 - 1e-4) {
        tmpC.lerp(ink, o.mask(0.5 + (px / hx) * 0.5, 0.5 + (pz / hz) * 0.5));
      }
      // keycap taper: wider at the bottom like a real key
      const tpr = 1 - (o.taper || 0) * ((py + by / 2) / by);
      pos.setXYZ(i, px * tpr + o.x, py + o.y, pz * tpr);
      cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo;
  };
  // separate geometries — the keycaps are rigid bodies that travel on press,
  // so each needs its own mesh instead of one merged soft mesh
  const base = part(1.55, 0.30, 0.92, 0.09, 20, 4, 14, { x: 0, y: 0, color: '#f2eaec', taper: 0.06 });
  const mars = part(0.85, 0.40, 0.62, 0.06, 46, 6, 30, { x: -0.28, y: 0.32, color: '#bfacb3', taper: 0.24, mask: legend('MARS', '900 82px "Helvetica Neue", Arial, sans-serif', 256) });
  const jen = part(0.48, 0.36, 0.52, 0.055, 32, 6, 28, { x: 0.44, y: 0.30, color: '#bfacb3', taper: 0.24, mask: legend('JEN', '900 62px "Helvetica Neue", Arial, sans-serif', 128) });
  // one shared normalize so the assembly stays aligned across the three parts
  const bb = new THREE.Box3();
  for (const g of [base, mars, jen]) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  const s = 0.55 / (bb.max.y - bb.min.y);
  const tx = -(bb.max.x + bb.min.x) / 2 * s, ty = -0.585 - bb.min.y * s, tz = -(bb.max.z + bb.min.z) / 2 * s;
  for (const g of [base, mars, jen]) {
    g.scale(s, s, s);
    g.translate(tx, ty, tz);
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }
  return { base, keys: [mars, jen], travel: 0.09 * s };
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
    // this is called every frame — once the bed has been parked at silence,
    // stop scheduling automation events until it's audible again
    const idle = g < 0.001;
    if (idle && A._sqIdle) return;
    A._sqIdle = idle;
    const f = A.squishHz * (0.3 + closure * 1.5 + Math.min(1.4, v * 0.08));
    const t = A.ctx.currentTime;
    A.sqGain.gain.setTargetAtTime(idle ? 0 : g, t, 0.025);
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
  A.crackle = () => {
    // one ice pane giving way: sharp snap, short body, a couple of glassy pings
    if (!A.ctx) return;
    A.burst(3600, 0.9, 0.8, 0.014, 0, 'highpass');
    A.burst(1900 + Math.random() * 500, 4, 0.5, 0.03, 0.004);
    A.thump(150, 65, 0.28, 0.06, 0.002);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      A.ping(2200 + Math.random() * 2200, 0.16, 0.07 + Math.random() * 0.07, 0.014 + i * 0.016);
    }
  };
  A.waxSnap = () => {
    // a chunk of wax breaking off: dull low body + snap, then soft crumbly ticks
    if (!A.ctx) return;
    A.burst(700 + Math.random() * 250, 1.3, 0.8, 0.05, 0, 'lowpass');
    A.burst(2400, 1.5, 0.28, 0.02, 0, 'highpass');
    A.thump(120, 55, 0.4, 0.08, 0);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      A.burst(1500 + Math.random() * 900, 4, 0.2, 0.016, 0.022 + i * 0.018);
    }
  };
  A.keyClick = (down) => {
    // mechanical key switch: sharp tick + resonant click body, with a soft
    // bottom-out thock on the downstroke and a lighter clack on release
    if (!A.ctx) return;
    if (down) {
      A.burst(3800, 1.2, 0.65, 0.012, 0, 'highpass');
      A.burst(1500 + Math.random() * 250, 6, 0.5, 0.03, 0.003);
      A.thump(185, 95, 0.28, 0.05, 0.002);
    } else {
      A.burst(4300, 1.2, 0.32, 0.01, 0, 'highpass');
      A.burst(1900 + Math.random() * 250, 6, 0.22, 0.02, 0.002);
    }
  };
  A.chomp = () => {
    // big wet bite: soft low body + jaw thump, then a few crunchy tears
    if (!A.ctx) return;
    A.burst(650 + Math.random() * 300, 1.4, 0.9, 0.07 + Math.random() * 0.02, 0, 'lowpass');
    A.burst(1700 + Math.random() * 400, 2.4, 0.5, 0.045, 0.012);
    A.thump(105 + Math.random() * 30, 48, 0.55, 0.09, 0);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const when = 0.03 + i * (0.018 + Math.random() * 0.02);
      A.burst(2100 + Math.random() * 1800, 5, 0.28 * (1 - i / n) + 0.1, 0.018 + Math.random() * 0.012, when);
    }
  };
  A.setOn = (on) => { A.on = on; if (A.ctx) A.master.gain.setTargetAtTime(on ? 0.6 : 0, A.ctx.currentTime, 0.02); };
  return A;
}

// ---------- backdrops ----------
// Each entry paints a 1024px canvas that gets swapped onto the backdrop plane.
// The plane extends far past the frustum, so only the central ~350px band is
// ever on screen — features are sized to read at that scale.
export const BACKGROUNDS = [
  { id: 'cream',        name: 'cream',          edge: 0xf7f3ec, css: 'radial-gradient(circle at 50% 45%, #fffefb, #f3ecdf)' },
  { id: 'crinkle',      name: 'crinkled paper', edge: 0xf2efe8, css: 'linear-gradient(135deg, #f8f6f1 30%, #e7e2d8 50%, #f3f0ea 70%)' },
  { id: 'lined',        name: 'lined paper',    edge: 0xfbfaf3, css: 'repeating-linear-gradient(180deg, #fcfbf5 0 6px, #b3cbe8 6px 7px)' },
  { id: 'linen',        name: 'linen',          edge: 0xebe5d8, css: 'repeating-linear-gradient(90deg, rgba(158,143,118,0.16) 0 1px, transparent 1px 4px), #ece6d9' },
  { id: 'concrete',     name: 'concrete',       edge: 0xb5b2ac, css: 'radial-gradient(circle at 35% 35%, #bcb9b3, #aeaba5)' },
  { id: 'crinkle-dark', name: 'dark crinkle',   edge: 0x312e2a, dark: true, css: 'linear-gradient(135deg, #3a3733 30%, #26241f 50%, #343128 70%)' },
  { id: 'slate',        name: 'slate',          edge: 0x2c2f34, dark: true, css: 'radial-gradient(circle at 50% 40%, #4b5058, #2c2f34)' }
];

function bgGrain(g, S, dark, light, n) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? dark : light;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random(), 1 + Math.random());
  }
}

// crumpled paper: blurred facets give the soft tonal patchwork, then short
// crease polylines drawn twice — offset shadow plus highlight — catch the folds
// (ctx.filter is a no-op on browsers without support; the look just gets crisper)
function bgCrumple(g, S, facetHi, facetLo, creaseHi, creaseLo) {
  g.save();
  g.filter = 'blur(9px)';
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 70 + Math.random() * 200;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 2 * r, y + (Math.random() - 0.5) * 2 * r);
    g.lineTo(x + (Math.random() - 0.5) * 2 * r, y + (Math.random() - 0.5) * 2 * r);
    g.closePath();
    g.fillStyle = Math.random() < 0.5 ? facetHi : facetLo;
    g.fill();
  }
  g.restore();
  g.save();
  g.filter = 'blur(1px)';
  g.lineJoin = 'round';
  for (let i = 0; i < 60; i++) {
    let x = Math.random() * S, y = Math.random() * S, a = Math.random() * Math.PI * 2;
    const pts = [[x, y]];
    const segs = 2 + (Math.random() * 3 | 0);
    for (let s = 0; s < segs; s++) {
      a += (Math.random() - 0.5) * 2.2;
      x += Math.cos(a) * (50 + Math.random() * 140);
      y += Math.sin(a) * (50 + Math.random() * 140);
      pts.push([x, y]);
    }
    const trace = (dx, dy) => {
      g.beginPath();
      for (let j = 0; j < pts.length; j++) {
        if (j) g.lineTo(pts[j][0] + dx, pts[j][1] + dy); else g.moveTo(pts[j][0] + dx, pts[j][1] + dy);
      }
      g.stroke();
    };
    g.strokeStyle = creaseLo; g.lineWidth = 1.4; trace(1.6, 2);
    g.strokeStyle = creaseHi; g.lineWidth = 1.2; trace(-0.5, -0.8);
  }
  g.restore();
}

const BG_DRAW = {
  cream(g, S) { // the original faint sweep, kept as the default
    const gr = g.createRadialGradient(S * 0.5, S * 0.46, S * 0.06, S * 0.5, S * 0.46, S * 0.49);
    gr.addColorStop(0, '#fffefb'); gr.addColorStop(0.55, '#f8f2e9'); gr.addColorStop(1, '#f3ecdf');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  },
  crinkle(g, S) {
    g.fillStyle = '#f5f3ee'; g.fillRect(0, 0, S, S);
    bgCrumple(g, S, 'rgba(255,255,255,0.07)', 'rgba(148,138,122,0.055)', 'rgba(255,255,255,0.45)', 'rgba(122,112,96,0.11)');
    bgGrain(g, S, 'rgba(120,110,95,0.04)', 'rgba(255,255,255,0.05)', 2600);
  },
  lined(g, S) {
    g.fillStyle = '#fcfbf5'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(112,150,205,0.40)'; g.lineWidth = 2;
    for (let y = 22; y < S; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    g.strokeStyle = 'rgba(226,108,116,0.42)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(S * 0.29, 0); g.lineTo(S * 0.29, S); g.stroke();
    bgGrain(g, S, 'rgba(150,140,120,0.035)', 'rgba(255,255,255,0.05)', 1600);
  },
  linen(g, S) {
    g.fillStyle = '#ece6d9'; g.fillRect(0, 0, S, S);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(158,143,118,0.075)';
    for (let y = 0; y < S; y += 4) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(S, y + 0.5); g.stroke(); }
    g.strokeStyle = 'rgba(158,143,118,0.06)';
    for (let x = 0; x < S; x += 4) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, S); g.stroke(); }
    // slubs — the short thick threads that make weave read as cloth
    g.strokeStyle = 'rgba(148,133,108,0.12)'; g.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * S, y = Math.random() * S, len = 20 + Math.random() * 60, horiz = Math.random() < 0.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (horiz ? len : 0), y + (horiz ? 0 : len)); g.stroke();
    }
  },
  concrete(g, S) {
    g.fillStyle = '#b7b4ae'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 90 + Math.random() * 260;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = Math.random() < 0.5 ? '255,255,255' : '70,68,64';
      gr.addColorStop(0, `rgba(${c},0.05)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    bgGrain(g, S, 'rgba(60,58,54,0.09)', 'rgba(255,255,255,0.07)', 5200);
    g.strokeStyle = 'rgba(80,78,74,0.10)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let x = Math.random() * S, y = Math.random() * S;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 160; y += (Math.random() - 0.3) * 130; g.lineTo(x, y); }
      g.stroke();
    }
  },
  'crinkle-dark'(g, S) {
    g.fillStyle = '#33302c'; g.fillRect(0, 0, S, S);
    bgCrumple(g, S, 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.07)', 'rgba(255,255,255,0.055)', 'rgba(0,0,0,0.16)');
    bgGrain(g, S, 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.03)', 2600);
  },
  slate(g, S) {
    const gr = g.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.42, S * 0.55);
    gr.addColorStop(0, '#4b5058'); gr.addColorStop(1, '#2c2f34');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    bgGrain(g, S, 'rgba(0,0,0,0.07)', 'rgba(255,255,255,0.03)', 2000);
  }
};

// ---------- engine ----------
export function createEngine(mount, opts) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const MAX_PR = Math.min(window.devicePixelRatio || 1, 2);
  let pixelRatio = MAX_PR;
  renderer.setPixelRatio(pixelRatio);
  // the transmission pass re-renders the whole scene; at 0.5 it uses a quarter
  // of the pixels, and the loss hides under the looks' roughness blur
  renderer.transmissionResolutionScale = 0.5;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;display:block;touch-action:none;';
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f3ec);
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
  camera.position.set(0, 0.42, 3.6);
  camera.lookAt(0, -0.15, 0); // aim slightly below the object center so it sits centered in frame

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
  // backdrop plane behind the object — doubles as the "something to transmit"
  // for transmissive looks. Textures are built lazily and cached per kind.
  const bgTextures = {};
  function bgTexture(id) {
    if (!bgTextures[id]) {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      BG_DRAW[id](c.getContext('2d'), 1024);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      bgTextures[id] = t;
    }
    return bgTextures[id];
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: bgTexture('cream') }));
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
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    // soft glow halo, kept tight so it reads as a dot rather than a bloom
    const glow = g.createRadialGradient(64, 64, 0, 64, 64, 44);
    glow.addColorStop(0, 'rgba(255,111,158,0.55)');
    glow.addColorStop(0.45, 'rgba(255,111,158,0.22)');
    glow.addColorStop(1, 'rgba(255,111,158,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,111,158,0.95)';
    g.beginPath(); g.arc(64, 64, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(64, 64, 7, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  })();
  const cursor = new THREE.Sprite(new THREE.SpriteMaterial({ map: curTex, transparent: true, opacity: 0.95, depthTest: false }));
  cursor.scale.setScalar(0.11); cursor.renderOrder = 99; cursor.visible = false; scene.add(cursor);

  // shared deform uniforms
  const U = {
    uActive: { value: 0 },
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
  const _im = new THREE.Matrix4(); // scratch for instance matrix writes
  let entry = null, group = null, softMesh = null, isWrap = false;
  let wrapState = [], wrapIMs = null, poppedCount = 0, wrapMats = null;
  let isKeys = false, keyState = [], keysMat = null, pressedKey = -1;
  let isFloe = false, floePanes = [], floeMats = null, floeBroken = 0, hoverPane = null;
  const _wp = new THREE.Vector3(); // scratch for pane world positions
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
      // two instanced meshes (intact / popped) instead of 54 individual meshes:
      // 3 draw calls total, membership expressed by collapsing the hidden twin
      const domeGeo = new THREE.SphereGeometry(0.072, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const state = [];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) {
        state.push({ x: (c - 4) * 0.152, z: (r - 2.5) * 0.152, popped: false, s: 1, t: 1, hover: 1, hv: 1 });
      }
      const intactIM = new THREE.InstancedMesh(domeGeo, intact, state.length);
      const poppedIM = new THREE.InstancedMesh(domeGeo, popped, state.length);
      intactIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      poppedIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      intactIM.frustumCulled = false; poppedIM.frustumCulled = false;
      state.forEach((ud, i) => {
        _im.makeScale(1, 1, 1).setPosition(ud.x, 0.0225, ud.z);
        intactIM.setMatrixAt(i, _im);
        _im.makeScale(1e-4, 1e-4, 1e-4).setPosition(ud.x, 0.0225, ud.z);
        poppedIM.setMatrixAt(i, _im);
      });
      g.add(intactIM); g.add(poppedIM);
      g.rotation.x = 1.12;
      g.position.y = 0.06;
      g.userData = { ims: { intact: intactIM, popped: poppedIM, targets: [intactIM, poppedIM] }, state, mats: { intact, popped, base: base.material } };
    } else if (en.geometry === 'floe') {
      const look = en.looks[0];
      const kit = buildFloe(en);
      const ice = physMat(look);
      ice.vertexColors = true;
      const panes = kit.panes.map((p) => {
        const m = new THREE.Mesh(p.geo, ice);
        m.position.set(p.cx, 0, p.cz);
        m.userData = { broken: false, lift: 0, liftT: 0, y0: 0 };
        g.add(m);
        return m;
      });
      g.rotation.x = 1.08;
      g.position.y = 0.02;
      g.userData = { panes, mats: { ice } };
    } else if (en.geometry === 'keys') {
      // rigid keycaps — no soft-body shader; each key mesh travels on its own
      const kit = buildKeycaps();
      const mat = physMat(en.looks[0]);
      mat.vertexColors = true;
      // tame the overhead env panels, which otherwise blow the top faces out
      // and erase the printed legends
      mat.envMapIntensity = 0.55;
      g.add(new THREE.Mesh(kit.base, mat));
      const keyMeshes = kit.keys.map((kg) => { const m = new THREE.Mesh(kg, mat); g.add(m); return m; });
      g.rotation.x = 0.16; // tip the key tops toward the camera
      g.userData = { keyMeshes, travel: kit.travel, mat };
    } else {
      const B = { bear: buildBear, blob: () => buildBlob(7.1, 0.20, 0.86, 0.92), dough: () => buildBlob(21.7, 0.10, 0.78, 0.84), butter: buildButter, cube: buildJelly, peach: buildPeach, banana: buildBanana, tomato: buildTomato, avocado: buildAvocado, mallow: buildMallow, balloon: buildBalloon, ice: buildIce, sugar: buildSugar, globe: buildSnowglobe, cheese: buildCheese, bao: buildBao, burger: buildBurger, brulee: buildBrulee, apple: buildCandyApple, egg: buildEgg, peanut: () => buildPeanut(en) };
      const geo = (B[en.geometry] || buildJelly)();
      const mat = patch(physMat(en.looks[0]));
      // carve objects: vertex colors carry the layer palette, so the material stays white
      if (en.carve) mat.color.set('#ffffff');
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
  const chompCfg = { threshold: 0.55, radius: 0.34, bites: 5 };
  const carveCfg = { threshold: 0.52, radius: 0.24, soft: 0.6, maxDepth: 0.2 };
  let failGone = false, failArm = 0, strain = 0, respawnT = 0;
  // effects run as small pools so rapid-fire failures (pane swipes) can overlap
  const sprays = [];      // [{ pts, geo, mat, vel[], life }]
  const shardBursts = []; // [{ group, pieces:[{mesh, vel, ang}], mat, life, fade }]
  function endSqueeze() {
    dragging = false; pulse = null;
    spring.c = 0; spring.v = 0; spring.target = 0; spring.active = false;
    U.uClosure.value = 0;
    cursor.visible = false;
    if (opts.onState) opts.onState('MOUSE');
  }
  function spawnSpray(o) {
    o = o || {};
    if (sprays.length > 5) {
      const old = sprays.shift();
      scene.remove(old.pts); old.geo.dispose(); old.mat.dispose();
    }
    const look = currentLook || (entry && entry.looks[0]) || { color: '#35b6e8', sss: '#9fe6ff' };
    const n = Math.max(8, Math.round(o.count || burstCfg.sprayCount));
    const speed = o.speed || 1;
    const posArr = new Float32Array(n * 3), colArr = new Float32Array(n * 3);
    const vel = [];
    const c1 = new THREE.Color(o.c1 || look.color), c2 = new THREE.Color(o.c2 || look.sss || look.color), tc = new THREE.Color();
    const cx = o.at ? o.at.x : grabWorld.x * 0.5, cy = o.at ? o.at.y : grabWorld.y * 0.5 - 0.05, cz = o.at ? o.at.z : grabWorld.z * 0.5;
    for (let i = 0; i < n; i++) {
      posArr[i * 3] = cx + (Math.random() - 0.5) * 0.3;
      posArr[i * 3 + 1] = cy + (Math.random() - 0.5) * 0.3;
      posArr[i * 3 + 2] = cz + (Math.random() - 0.5) * 0.3;
      tc.copy(c1).lerp(c2, Math.random());
      colArr[i * 3] = tc.r; colArr[i * 3 + 1] = tc.g; colArr[i * 3 + 2] = tc.b;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sp = (0.7 + Math.random() * 1.6) * speed;
      vel.push(new THREE.Vector3(Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + 0.6 * speed, Math.sin(ph) * Math.sin(th) * sp));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat = new THREE.PointsMaterial({ size: o.size || 0.05, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    sprays.push({ pts, geo, mat, vel, life: 0.8 });
  }
  // ---------- chomp failure (edible objects eaten bite by bite) ----------
  const biteTmpC = new THREE.Color();
  function carveBite(mesh, c, dir, r, soft, maxDepth) {
    // soft < 1 takes a shallower scoop (repeat presses still deepen it, since
    // each press raycasts the current surface); maxDepth pins every vertex
    // within that distance of its pristine position so carving can't tunnel
    const kSoft = soft || 1;
    const geo = mesh.geometry;
    const pos = geo.attributes.position, col = geo.attributes.color;
    if (!geo.userData.pristine) geo.userData.pristine = { pos: pos.array.slice(), col: col ? col.array.slice() : null };
    const paint = col && geo.userData.biteColor;
    const pr = geo.userData.pristine.pos;
    // ball center pulled back toward the viewer so every vertex inside projects
    // radially AWAY from it — displacement is bounded by (r - d) and fades to
    // zero at the rim, so the scoop stays shallow and triangles never tear
    const cx = c.x - dir.x * r * 0.45, cy = c.y - dir.y * r * 0.45, cz = c.z - dir.z * r * 0.45;
    const r2 = r * r;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i) - cx, vy = pos.getY(i) - cy, vz = pos.getZ(i) - cz;
      const q2 = vx * vx + vy * vy + vz * vz;
      if (q2 >= r2) continue;
      const s = r / Math.max(Math.sqrt(q2), 1e-4);
      let px = cx + vx * s, py = cy + vy * s, pz = cz + vz * s;
      if (kSoft < 1) {
        const ox = cx + vx, oy = cy + vy, oz = cz + vz;
        px = ox + (px - ox) * kSoft; py = oy + (py - oy) * kSoft; pz = oz + (pz - oz) * kSoft;
      }
      if (maxDepth) {
        const ddx = px - pr[i * 3], ddy = py - pr[i * 3 + 1], ddz = pz - pr[i * 3 + 2];
        const dl = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
        if (dl > maxDepth) {
          const k = maxDepth / dl;
          px = pr[i * 3] + ddx * k; py = pr[i * 3 + 1] + ddy * k; pz = pr[i * 3 + 2] + ddz * k;
        }
      }
      pos.setXYZ(i, px, py, pz);
      if (paint) {
        const ddx = px - pr[i * 3], ddy = py - pr[i * 3 + 1], ddz = pz - pr[i * 3 + 2];
        geo.userData.biteColor(px, py, pz, biteTmpC, Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz));
        col.setXYZ(i, biteTmpC.r, biteTmpC.g, biteTmpC.b);
      }
    }
    pos.needsUpdate = true;
    if (col) col.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  function restoreChomp() {
    if (!softMesh) return;
    const geo = softMesh.geometry, pr = geo.userData.pristine;
    if (!pr) return;
    geo.attributes.position.array.set(pr.pos);
    geo.attributes.position.needsUpdate = true;
    if (pr.col) { geo.attributes.color.array.set(pr.col); geo.attributes.color.needsUpdate = true; }
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    if (group) group.userData.chomps = 0;
  }
  function doChomp() {
    if (!softMesh) return;
    carveBite(softMesh, grabLocal, dirLocal, chompCfg.radius);
    group.userData.chomps = (group.userData.chomps || 0) + 1;
    audio.chomp();
    spawnSpray({ count: 16, c1: '#e8a95a', c2: '#f2dfae', speed: 0.65, size: 0.04 });
    if (group.userData.chomps >= chompCfg.bites) {
      // last bite: the rest disappears in a shower of crumbs
      spawnSpray({ count: 60, c1: '#e8a95a', c2: '#f2dfae', speed: 0.9, size: 0.045 });
      group.visible = false;
      failGone = true; respawnT = 1.2;
    }
    endSqueeze();
  }
  // ---------- carve failure (layered wax — flakes stay gone, object never dies) ----------
  function doCarve() {
    if (!softMesh) return;
    carveBite(softMesh, grabLocal, dirLocal, carveCfg.radius, carveCfg.soft, carveCfg.maxDepth);
    audio.waxSnap();
    const geo = softMesh.geometry, gd = geo.userData;
    if (gd.waxLayer && gd.pristine) {
      // chips fly in the color of the layer just exposed: sample the carve
      // depth at the crater floor (nearest vertex to the press point)
      const pos = geo.attributes.position, pr = gd.pristine.pos;
      let best = 1e9, bi = 0;
      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - grabLocal.x, dy = pos.getY(i) - grabLocal.y, dz = pos.getZ(i) - grabLocal.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < best) { best = d2; bi = i; }
      }
      const ddx = pos.getX(bi) - pr[bi * 3], ddy = pos.getY(bi) - pr[bi * 3 + 1], ddz = pos.getZ(bi) - pr[bi * 3 + 2];
      const dep = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      const c1 = new THREE.Color(), c2 = new THREE.Color();
      gd.waxLayer(grabLocal.x, grabLocal.y, grabLocal.z, dep, c1);
      c2.copy(c1).multiplyScalar(0.75);
      spawnSpray({ count: 13, c1, c2, speed: 0.55, size: 0.04 });
    }
    endSqueeze();
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
    pushShardBurst({ group: g, pieces, mat, life: 1.0, fade: 0.45 });
  }
  function pushShardBurst(sb) {
    if (shardBursts.length > 5) {
      const old = shardBursts.shift();
      holder.remove(old.group);
      for (const pc of old.pieces) pc.mesh.geometry.dispose();
      old.mat.dispose();
    }
    shardBursts.push(sb);
  }
  // ---------- pane failure (the ice sheet — sections crack out one by one) ----------
  function spawnIceChips(wp) {
    // a handful of flat chips that snap up out of the hole, then drop and fade;
    // the burst group stays world-aligned so gravity reads right on the tilted sheet
    const look = currentLook || (entry && entry.looks[0]) || { color: '#e8f2f7', sss: '#ffffff' };
    const mat = physMat(look);
    mat.transparent = true;
    const g = new THREE.Group();
    const pieces = [];
    for (let i = 0; i < 10; i++) {
      // first few pieces are big flat plates — the section itself breaking up
      const big = i < 3;
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry((big ? 0.055 : 0.03) + Math.random() * 0.03, 0), mat);
      m.scale.set(0.8 + Math.random() * 0.8, big ? 0.3 : 0.4, 0.8 + Math.random() * 0.8);
      m.position.set(wp.x + (Math.random() - 0.5) * 0.12, wp.y + (Math.random() - 0.5) * 0.06, wp.z + (Math.random() - 0.5) * 0.12);
      m.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 0.55, (Math.random() - 0.5) * 0.9 + 0.15);
      pieces.push({ mesh: m, vel, ang: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10) });
      g.add(m);
    }
    holder.add(g);
    pushShardBurst({ group: g, pieces, mat, life: 0.85, fade: 0.32 });
  }
  function crackPane(mesh) {
    const ud = mesh.userData;
    if (ud.broken) return;
    // the section snaps out and tumbles away as shards
    ud.broken = true; ud.liftT = 0; ud.lift = 0;
    mesh.visible = false;
    if (hoverPane === mesh) hoverPane = null;
    floeBroken++;
    mesh.getWorldPosition(_wp);
    spawnIceChips(_wp);
    spawnSpray({ count: 9, c1: '#eaf6ff', c2: (currentLook && currentLook.color) || '#cfe8f2', speed: 0.5, size: 0.032, at: _wp });
    audio.crackle();
    if (opts.onPop) opts.onPop(floeBroken, floePanes.length);
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
    if (entry && entry.chomp) restoreChomp();
    if (group) group.visible = true;
  }
  function clearFX() {
    // fully-eaten object left behind while switching away: bring it back whole
    if (failGone && entry && entry.chomp) restoreChomp();
    for (const s of sprays) { scene.remove(s.pts); s.geo.dispose(); s.mat.dispose(); }
    sprays.length = 0;
    for (const sb of shardBursts) {
      holder.remove(sb.group);
      for (const pc of sb.pieces) pc.mesh.geometry.dispose();
      sb.mat.dispose();
    }
    shardBursts.length = 0;
    if (failGone && group) group.visible = true;
    failGone = false; failArm = 0; strain = 0; respawnT = 0;
  }

  // pointer
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dragging = false, downX = 0, downY = 0, lastInputTs = 0, hoverId = -1;
  const inv = new THREE.Matrix4();
  // external hand input — when active, mouse pointer events are ignored and
  // setHandInput() drives the same grab pipeline with normalized coords
  let handActive = false;
  const handEvt = { clientX: 0, clientY: 0, timeStamp: 0 };
  // latest hover position, raycast at most once per rendered frame
  let hoverPending = false;
  const hoverEvt = { clientX: 0, clientY: 0 };

  function toNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    return r;
  }
  function raycastObj(e) {
    toNDC(e);
    ray.setFromCamera(ndc, camera);
    if (failGone) return null;
    if (isWrap) return wrapIMs ? ray.intersectObjects(wrapIMs.targets, false)[0] || null : null;
    if (isFloe) {
      // broken panes are invisible but still raycastable — skip them by hand
      const alive = [];
      for (const m of floePanes) if (!m.userData.broken) alive.push(m);
      return alive.length ? ray.intersectObjects(alive, false)[0] || null : null;
    }
    if (isKeys) return group ? ray.intersectObjects(group.userData.keyMeshes, false)[0] || null : null;
    return softMesh ? ray.intersectObject(softMesh, false)[0] || null : null;
  }
  // keycaps: a press targets one whole key — rigid travel, not a soft squeeze
  function pressKeyMesh(mesh) {
    const i = keyState.findIndex((k) => k.mesh === mesh);
    if (i < 0 || i === pressedKey) return;
    if (pressedKey >= 0) keyState[pressedKey].t = 0;
    pressedKey = i;
    keyState[i].t = 1;
  }
  function releaseKeys() {
    if (pressedKey >= 0) keyState[pressedKey].t = 0;
    pressedKey = -1;
  }
  function popDome(i) {
    const ud = wrapState[i];
    if (!ud || ud.popped) return;
    ud.popped = true; ud.t = -0.42;
    poppedCount++;
    audio.pop();
    if (opts.onPop) opts.onPop(poppedCount, wrapState.length);
  }
  function onDown(e) {
    audio.ensure();
    lastInputTs = e.timeStamp;
    const hit = raycastObj(e);
    if (!hit) return;
    canvas.setPointerCapture && (() => { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} })();
    if (isWrap) { popDome(hit.instanceId); dragging = true; return; }
    if (isFloe) { crackPane(hit.object); dragging = true; return; }
    if (isKeys) { pressKeyMesh(hit.object); dragging = true; return; }
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
      // per-event on purpose: a fast swipe must pop every dome it crosses
      const hit = raycastObj(e);
      if (hit) popDome(hit.instanceId);
      return;
    }
    if (dragging && isFloe) {
      // same deal: a swipe cracks every pane it crosses
      const hit = raycastObj(e);
      if (hit) crackPane(hit.object);
      return;
    }
    if (dragging && isKeys) {
      // slide across the board: leaving a key releases it, entering the next presses it
      const hit = raycastObj(e);
      if (hit) pressKeyMesh(hit.object); else releaseKeys();
      return;
    }
    if (dragging && !pulse) {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      const raw = Math.sqrt(dx * dx + dy * dy) / (canvas.clientHeight * 0.30);
      const t = Math.max(0, Math.min(1, (raw - input.deadzone) / (input.saturation - input.deadzone)));
      spring.target = t;
      return;
    }
    // hover: pointermove can fire faster than the display refreshes, and the
    // raycast walks the full soft mesh — coalesce to one raycast per frame
    hoverEvt.clientX = e.clientX; hoverEvt.clientY = e.clientY;
    hoverPending = true;
  }
  function updateHover() {
    if (!hoverPending) return;
    hoverPending = false;
    const hit = raycastObj(hoverEvt);
    if (isWrap) {
      const id = hit && hit.instanceId != null ? hit.instanceId : -1;
      if (hoverId >= 0 && hoverId !== id && wrapState[hoverId]) wrapState[hoverId].hv = 1;
      hoverId = id;
      if (hoverId >= 0 && wrapState[hoverId] && !wrapState[hoverId].popped) wrapState[hoverId].hv = 1.14;
      cursor.visible = false;
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    } else if (isFloe) {
      // the pane under the cursor floats up a touch, like loose ice
      const m = hit && !hit.object.userData.broken ? hit.object : null;
      if (hoverPane && hoverPane !== m) hoverPane.userData.liftT = 0;
      hoverPane = m;
      if (hoverPane) hoverPane.userData.liftT = 1;
      cursor.visible = false;
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    } else if (isKeys) {
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
    if (isKeys) releaseKeys();
    if (!isWrap && !isKeys && !isFloe) settle(); else spring.target = 0;
    spring.active = false;
  }
  canvas.addEventListener('pointerdown', (e) => { if (!handActive) onDown(e); });
  canvas.addEventListener('pointermove', (e) => { if (!handActive) onMove(e); });
  canvas.addEventListener('pointerup', () => { if (!handActive) release(); });
  canvas.addEventListener('pointercancel', () => { if (!handActive) release(); });
  canvas.addEventListener('pointerleave', () => { if (!handActive && !dragging) { cursor.visible = false; hoverPending = false; } });

  // stats
  let fpsE = 60, frames = 0, fpsT = 0;

  // adaptive resolution: transmission renders the scene twice, so retina pixel
  // cost is the main GPU load — trade backing-store resolution for frame rate.
  // Down fast (1s below 45fps), up slow (3s above 56fps) so it doesn't oscillate.
  let prLow = 0, prHigh = 0;
  function adaptQuality() {
    if (fpsE < 45 && pixelRatio > 1) {
      prHigh = 0;
      if (++prLow >= 2) { prLow = 0; pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); }
    } else if (fpsE > 56 && pixelRatio < MAX_PR) {
      prLow = 0;
      if (++prHigh >= 6) { prHigh = 0; pixelRatio = Math.min(MAX_PR, pixelRatio + 0.25); renderer.setPixelRatio(pixelRatio); }
    } else { prLow = 0; prHigh = 0; }
  }

  const clock = new THREE.Clock();
  let raf = 0, disposed = false, paused = false;

  function tick() {
    if (disposed || paused) return;
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
    // chomp: a hard squeeze takes a real bite out of the mesh, one per squeeze
    if (dragging && entry && entry.chomp && !failGone && spring.c > chompCfg.threshold) doChomp();
    // carve: same one-per-squeeze bite, but the wax keeps its wounds and never dies
    if (dragging && entry && entry.carve && !failGone && spring.c > carveCfg.threshold) doCarve();
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
    if (sqDirty) {
      // compact in place — this runs every frame while a dent recovers, so no filter() churn
      let w = 0;
      for (let i = 0; i < dents.length; i++) if (dents[i].amt > 0.006) dents[w++] = dents[i];
      dents.length = w;
      syncDents();
    }
    audio.squish(dt > 0 ? (spring.c - prevC) / dt : 0, Math.max(0, Math.min(1, spring.c)));
    updateHover();
    // cursor pushes in with closure while grabbed
    if (dragging && !isWrap && !isKeys) {
      cursor.visible = true;
      cursor.position.copy(grabWorld).addScaledVector(dirWorld, spring.c * deform.depth * 0.8);
    }
    // keycap travel: stiff, slightly underdamped spring — the key snaps down,
    // clicks at actuation, bottoms out, and pops back up with a tiny overshoot
    if (isKeys && keyState.length) {
      const kw = 46, kz = 0.6, kn = 2, kh = dt / kn;
      for (const k of keyState) {
        for (let s = 0; s < kn; s++) {
          const a = kw * kw * (k.t - k.p) - 2 * kz * kw * k.v;
          k.v += a * kh; k.p += k.v * kh;
        }
        k.p = Math.max(-0.08, Math.min(1.06, k.p));
        if (!k.clicked && k.t === 1 && k.p > 0.55) { k.clicked = true; audio.keyClick(true); }
        else if (k.clicked && k.t === 0 && k.p < 0.4) { k.clicked = false; audio.keyClick(false); }
        k.mesh.position.y = -k.p * group.userData.travel;
      }
    }
    // domes settle: animate scales, write instance matrices (hidden twin collapses)
    if (isWrap && wrapIMs) {
      const HIDE = 1e-4;
      for (let i = 0; i < wrapState.length; i++) {
        const ud = wrapState[i];
        ud.s += (ud.t - ud.s) * Math.min(1, dt * 13);
        ud.hover += (ud.hv - ud.hover) * Math.min(1, dt * 18);
        const sxz = ud.hover, sy = ud.s * ud.hover;
        _im.makeScale(ud.popped ? HIDE : sxz, ud.popped ? HIDE : sy, ud.popped ? HIDE : sxz).setPosition(ud.x, 0.0225, ud.z);
        wrapIMs.intact.setMatrixAt(i, _im);
        _im.makeScale(ud.popped ? sxz : HIDE, ud.popped ? sy : HIDE, ud.popped ? sxz : HIDE).setPosition(ud.x, 0.0225, ud.z);
        wrapIMs.popped.setMatrixAt(i, _im);
      }
      wrapIMs.intact.instanceMatrix.needsUpdate = true;
      wrapIMs.popped.instanceMatrix.needsUpdate = true;
    }
    // hovered ice pane floats up a touch and settles back
    if (isFloe && floePanes.length) {
      for (const m of floePanes) {
        const ud = m.userData;
        if (ud.broken) continue;
        ud.lift += (ud.liftT - ud.lift) * Math.min(1, dt * 16);
        m.position.y = ud.y0 + ud.lift * 0.022;
      }
    }
    // spray particles: gravity + floor damp, fade out over life
    for (let si = sprays.length - 1; si >= 0; si--) {
      const s = sprays[si];
      s.life -= dt;
      const sp = s.geo.attributes.position;
      for (let i = 0; i < s.vel.length; i++) {
        const v = s.vel[i];
        v.y -= 3.6 * dt;
        sp.setXYZ(i, sp.getX(i) + v.x * dt, sp.getY(i) + v.y * dt, sp.getZ(i) + v.z * dt);
        if (sp.getY(i) < -0.6) { sp.setY(i, -0.6); v.y *= -0.25; v.x *= 0.72; v.z *= 0.72; }
      }
      sp.needsUpdate = true;
      s.mat.opacity = Math.max(0, Math.min(1, s.life / 0.35));
      if (s.life <= 0) { scene.remove(s.pts); s.geo.dispose(); s.mat.dispose(); sprays.splice(si, 1); }
    }
    // shard pieces: fall, tumble, fade
    for (let bi = shardBursts.length - 1; bi >= 0; bi--) {
      const sb = shardBursts[bi];
      sb.life -= dt;
      for (const pc of sb.pieces) {
        pc.vel.y -= 4.4 * dt;
        pc.mesh.position.addScaledVector(pc.vel, dt);
        if (pc.mesh.position.y < -0.53) { pc.mesh.position.y = -0.53; pc.vel.y *= -0.3; pc.vel.x *= 0.75; pc.vel.z *= 0.75; }
        pc.mesh.rotation.x += pc.ang.x * dt; pc.mesh.rotation.y += pc.ang.y * dt; pc.mesh.rotation.z += pc.ang.z * dt;
      }
      sb.mat.opacity = Math.max(0, Math.min(1, sb.life / sb.fade));
      if (sb.life <= 0) {
        holder.remove(sb.group);
        for (const pc of sb.pieces) pc.mesh.geometry.dispose();
        sb.mat.dispose();
        shardBursts.splice(bi, 1);
      }
    }
    if (failGone) {
      respawnT -= dt;
      if (respawnT <= 0) respawnFresh();
    }
    if (autoRotate && !dragging) rotDrift += dt * 0.22;
    if (group) group.rotation.y = baseRotY + rotDrift;
    // idle shader fast path: with no squeeze, dents, or cracks the vertex shader
    // skips all three displacement evaluations and keeps the rest normals
    U.uActive.value = (Math.abs(U.uClosure.value) > 0.001 || dents.length > 0 || cracks.length > 0 || dragging || pulse) ? 1 : 0;
    renderer.render(scene, camera);
    // stats out
    frames++; fpsT += dt;
    if (fpsT >= 0.5) { fpsE = frames / fpsT; frames = 0; fpsT = 0; adaptQuality(); }
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

  // hidden tab: halt the render loop and silence audio; showing again resumes
  function setPaused(p) {
    if (paused === p || disposed) return;
    paused = p;
    if (p) {
      cancelAnimationFrame(raf);
      release();
      if (audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend();
    } else {
      clock.getDelta(); // swallow the hidden span so the first dt back is sane
      if (audio.ctx && audio.on) audio.ctx.resume();
      tick();
    }
  }
  const onVisibility = () => setPaused(document.hidden);
  document.addEventListener('visibilitychange', onVisibility);

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
      isKeys = en.geometry === 'keys';
      isFloe = en.geometry === 'floe';
      keyState = []; keysMat = null; pressedKey = -1;
      floePanes = []; floeMats = null; floeBroken = 0; hoverPane = null;
      if (isWrap) {
        wrapState = group.userData.state; wrapIMs = group.userData.ims; wrapMats = group.userData.mats;
        poppedCount = wrapState.filter(d => d.popped).length;
        softMesh = null;
        shadow.scale.setScalar(1.15);
      } else if (isFloe) {
        softMesh = null; wrapState = []; wrapIMs = null; wrapMats = null;
        floePanes = group.userData.panes; floeMats = group.userData.mats;
        floeBroken = floePanes.filter((m) => m.userData.broken).length;
        shadow.scale.setScalar(1.15);
      } else if (isKeys) {
        softMesh = null; wrapState = []; wrapIMs = null; wrapMats = null;
        keysMat = group.userData.mat;
        keyState = group.userData.keyMeshes.map((m) => ({ mesh: m, p: -m.position.y / group.userData.travel, v: 0, t: 0, clicked: false }));
        shadow.scale.setScalar(1.12);
      } else {
        softMesh = group.userData.mesh; wrapState = []; wrapIMs = null; wrapMats = null;
        shadow.scale.setScalar(1);
      }
      baseRotY = ({ bear: 0.45, cube: 0.6, butter: 0.5, peach: 0.55, banana: 0.12, tomato: 0.4, avocado: 0.3, mallow: 0.3, balloon: 0.2, ice: 0.55, sugar: 0.6, globe: 0.15, cheese: 0.55, bao: 0.2, burger: 0.35, brulee: 0.3, apple: 0.2, egg: 0.25, keys: 0.45, peanut: 0.35 })[en.geometry] || 0;
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
      chompCfg.threshold = (en.chomp && en.chomp.threshold) || 0.55;
      chompCfg.radius = (en.chomp && en.chomp.radius) || 0.34;
      chompCfg.bites = (en.chomp && en.chomp.bites) || 5;
      carveCfg.threshold = (en.carve && en.carve.threshold) || 0.52;
      carveCfg.radius = (en.carve && en.carve.radius) || 0.24;
      carveCfg.soft = (en.carve && en.carve.soft) || 0.6;
      carveCfg.maxDepth = (en.carve && en.carve.maxDepth) || 0.2;
      U.uGrab.value.set(0, 99, 0);
      cursor.visible = false;
      if (opts.onPop && isWrap) opts.onPop(poppedCount, wrapState.length);
      if (opts.onPop && isFloe) opts.onPop(floeBroken, floePanes.length);
    },
    prebuild(en) {
      // warm the geometry cache during idle time so switching objects never
      // pays the SDF raymarch on the interaction path (see app.js)
      if (!built[en.id]) built[en.id] = buildObject(en);
    },
    setLook(look) {
      if (!group) return;
      currentLook = look;
      if (isWrap) {
        applyLook(wrapMats.intact, look);
        applyLook(wrapMats.base, look); wrapMats.base.transmission = Math.min(1, look.transmission * 0.85);
        applyLook(wrapMats.popped, look);
        wrapMats.popped.color.multiplyScalar(0.4); wrapMats.popped.roughness = Math.min(1, look.roughness + 0.3); wrapMats.popped.transmission = look.transmission * 0.4;
      } else if (isFloe) {
        applyLook(floeMats.ice, look);
      } else if (isKeys) applyLook(keysMat, look);
      else {
        applyLook(softMesh.material, look);
        if (entry && entry.carve && look.layers && softMesh.geometry.userData.waxLayer) {
          // layer colors live in the vertices; the material stays white so the
          // look's swatch color doesn't double-tint them
          softMesh.material.color.set('#ffffff');
          softMesh.geometry.userData.waxPalette = look.layers.map((h) => new THREE.Color(h));
          paintWax(softMesh.geometry);
        }
      }
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
      const mats = isWrap ? [wrapMats.intact, wrapMats.base] : isKeys ? [keysMat] : softMesh ? [softMesh.material] : [];
      for (const m of mats) m[k] = v;
    },
    setShell(k, v) {
      if (k === 'threshold') shellThreshold = v;
      if (k === 'innerRough') U.uInnerRough.value = v;
      if (k === 'freq') U.uCrackFreq.value = v;
    },
    setBurst(k, v) { burstCfg[k] = v; },
    setShatter(k, v) { shatterCfg[k] = v; },
    setChomp(k, v) { chompCfg[k] = v; },
    setCarve(k, v) { carveCfg[k] = v; },
    setAudioParam(k, v) { if (k === 'squishHz') audio.squishHz = v; else audio.popHz = v; },
    setAudio(on) { audio.ensure(); audio.setOn(on); },
    reset() {
      clearFX();
      dents = []; syncDents(); cracks = []; syncCracks(); spring.c = 0; spring.v = 0; spring.target = 0;
      if (entry) delete stash[entry.id];
      if (entry && (entry.chomp || entry.carve)) {
        restoreChomp();
        // pristine colors may predate a look switch — repaint from the current palette
        if (entry.carve && softMesh) paintWax(softMesh.geometry);
      }
      if (isWrap) { for (const ud of wrapState) { ud.popped = false; ud.t = 1; } poppedCount = 0; if (opts.onPop) opts.onPop(0, wrapState.length); }
      if (isFloe) {
        for (const m of floePanes) {
          const ud = m.userData;
          ud.broken = false; ud.liftT = 0; ud.lift = 0;
          m.visible = true;
          m.position.y = ud.y0;
        }
        floeBroken = 0;
        if (opts.onPop) opts.onPop(0, floePanes.length);
      }
      if (isKeys) releaseKeys();
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
      // deliberate-grip gate (not the mouse deadzone): an open palm just steers
      // the cursor; squeezing starts only past HAND_GRAB, with hysteresis so a
      // held grip doesn't flutter at the threshold
      const HAND_GRAB = 0.35, HAND_RELEASE = 0.18, HAND_FULL = 0.85;
      const t = Math.max(0, Math.min(1, (h.closure - HAND_GRAB) / (HAND_FULL - HAND_GRAB)));
      if (dragging) {
        if (h.closure < HAND_RELEASE) { release(); return; }
        if (isWrap) { const hit = raycastObj(handEvt); if (hit) popDome(hit.instanceId); return; }
        if (isFloe) { const hit = raycastObj(handEvt); if (hit) crackPane(hit.object); return; }
        if (isKeys) { const hit = raycastObj(handEvt); if (hit) pressKeyMesh(hit.object); else releaseKeys(); return; }
        // the squeeze follows the hand: re-raycast and glide the grab point
        const hit = raycastObj(handEvt);
        if (hit) {
          grabWorld.lerp(hit.point, 0.35);
          inv.copy(group.matrixWorld).invert();
          grabLocal.copy(grabWorld).applyMatrix4(inv);
          dirLocal.copy(ray.ray.direction).transformDirection(inv).normalize();
          dirWorld.copy(ray.ray.direction);
          U.uGrab.value.copy(grabLocal);
          U.uDir.value.copy(dirLocal);
        }
        if (!pulse) spring.target = t;
        return;
      }
      // gripped past the gate: try to engage (onDown raycasts + starts the grab / pops a dome)
      if (h.closure >= HAND_GRAB) onDown(handEvt);
      if (!dragging && !isWrap) {
        // hover: cursor tracks the hand — on the surface when over it, floating at object depth otherwise
        const hit = raycastObj(handEvt);
        if (isFloe) {
          const m = hit && !hit.object.userData.broken ? hit.object : null;
          if (hoverPane && hoverPane !== m) hoverPane.userData.liftT = 0;
          hoverPane = m;
          if (hoverPane) hoverPane.userData.liftT = 1;
        }
        if (hit) cursor.position.copy(hit.point).addScaledVector(hit.face ? hit.face.normal : new THREE.Vector3(0, 0, 1), 0.02);
        else ray.ray.at(camera.position.length(), cursor.position);
        cursor.visible = true;
      }
    },
    setBackdrop(kind) { grid.visible = kind === 'grid'; },
    setBackground(id) {
      if (!BG_DRAW[id]) return;
      glow.material.map = bgTexture(id);
      glow.material.needsUpdate = true;
      const def = BACKGROUNDS.find((b) => b.id === id);
      if (def) scene.background.set(def.edge);
    },
    setAutoRotate(b) { autoRotate = b; if (!b) rotDrift = 0; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      canvas.remove();
      renderer.dispose();
    }
  };
  window.__SQ = { scene, camera, renderer, holder, U };
  return E;
}
