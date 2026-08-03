// content registry — data only, zero logic (PRD §5.3 / §6)
export const SEED_INPUT = { deadzone: 0.08, saturation: 0.92 };

export const SQUISHIES = [
  {
    id: 'gummy-bear', name: 'GUMMY BEAR', geometry: 'bear', failureMode: 'elastic',
    deform: { falloffRadius: 0.34, depth: 0.50, stiffness: 10, damping: 0.82, bulge: 0.50, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 900, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RASPBERRY', color: '#e8285f', sss: '#ff7fa8', transmission: 0.60, thickness: 0.55, ior: 1.40, clearcoat: 0.35, roughness: 0.22, sheen: 0.30 },
      { name: 'LIME',      color: '#86d92e', sss: '#d9ff8f', transmission: 0.58, thickness: 0.50, ior: 1.38, clearcoat: 0.30, roughness: 0.26, sheen: 0.25 },
      { name: 'COLA',      color: '#c96a1c', sss: '#ffb066', transmission: 0.66, thickness: 0.62, ior: 1.42, clearcoat: 0.40, roughness: 0.20, sheen: 0.20 }
    ]
  },
  {
    id: 'wax-blob', name: 'BUTTER BAR', geometry: 'butter', failureMode: 'crack',
    deform: { falloffRadius: 0.30, depth: 0.40, stiffness: 9, damping: 0.90, bulge: 0.30, permanence: 0.35, recovery: 0.0 },
    shell: { threshold: 0.50, innerRough: 0.22, freq: 11 },
    audio: { squishHz: 480, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'DARK CHOC',  color: '#4a2c17', inner: '#ffd94a', sss: '#7a4a24', transmission: 0.05, thickness: 0.50, ior: 1.45, clearcoat: 0.12, roughness: 0.44, sheen: 0.05 },
      { name: 'MILK CHOC',  color: '#7a4a24', inner: '#ffd94a', sss: '#a06a3a', transmission: 0.06, thickness: 0.50, ior: 1.45, clearcoat: 0.15, roughness: 0.40, sheen: 0.05 },
      { name: 'WHITE CHOC', color: '#e8d9b8', inner: '#ffc93c', sss: '#fff0d0', transmission: 0.10, thickness: 0.50, ior: 1.44, clearcoat: 0.15, roughness: 0.38, sheen: 0.08 }
    ]
  },
  {
    id: 'jelly-cube', name: 'JELLY CUBE', geometry: 'cube', failureMode: 'elastic',
    deform: { falloffRadius: 0.45, depth: 0.55, stiffness: 6, damping: 0.74, bulge: 0.85, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 700, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'BERRY',   color: '#7a3bf0', sss: '#b78bff', transmission: 0.85, thickness: 0.50, ior: 1.33, clearcoat: 0.50, roughness: 0.08, sheen: 0.10 },
      { name: 'KIWI',    color: '#55d63a', sss: '#b2ff8f', transmission: 0.82, thickness: 0.45, ior: 1.33, clearcoat: 0.45, roughness: 0.10, sheen: 0.10 },
      { name: 'GLACIER', color: '#29c8dd', sss: '#9defff', transmission: 0.90, thickness: 0.55, ior: 1.33, clearcoat: 0.55, roughness: 0.05, sheen: 0.05 }
    ]
  },
  {
    id: 'memory-foam', name: 'MEMORY FOAM', geometry: 'cube', failureMode: 'elastic',
    deform: { falloffRadius: 0.50, depth: 0.55, stiffness: 4, damping: 0.97, bulge: 0.20, permanence: 0.0, recovery: 2.6 },
    audio: { squishHz: 380, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'ULTRAVIOLET', color: '#7b5cff', sss: '#b3a0ff', transmission: 0.04, thickness: 0.30, ior: 1.30, clearcoat: 0.02, roughness: 0.72, sheen: 0.50 },
      { name: 'CORAL',       color: '#ff6a5e', sss: '#ffa89e', transmission: 0.04, thickness: 0.30, ior: 1.30, clearcoat: 0.02, roughness: 0.72, sheen: 0.50 },
      { name: 'SLATE',       color: '#7f8899', sss: '#b9c2d0', transmission: 0.04, thickness: 0.30, ior: 1.30, clearcoat: 0.02, roughness: 0.75, sheen: 0.45 }
    ]
  },
  {
    id: 'dough-ball', name: 'DOUGH', geometry: 'dough', failureMode: 'dent',
    deform: { falloffRadius: 0.42, depth: 0.50, stiffness: 7, damping: 0.93, bulge: 0.55, permanence: 0.95, recovery: 0.0 },
    audio: { squishHz: 300, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'BRIOCHE', color: '#dfa64f', sss: '#ffd9a0', transmission: 0.10, thickness: 0.50, ior: 1.40, clearcoat: 0.05, roughness: 0.55, sheen: 0.20 },
      { name: 'MATCHA',  color: '#9db54a', sss: '#d6e89a', transmission: 0.10, thickness: 0.50, ior: 1.40, clearcoat: 0.05, roughness: 0.55, sheen: 0.20 },
      { name: 'COCOA',   color: '#9c5f2e', sss: '#d19a63', transmission: 0.08, thickness: 0.45, ior: 1.40, clearcoat: 0.05, roughness: 0.58, sheen: 0.18 }
    ]
  },
  {
    id: 'peach', name: 'PEACH', geometry: 'peach', failureMode: 'elastic',
    deform: { falloffRadius: 0.40, depth: 0.45, stiffness: 8, damping: 0.86, bulge: 0.60, permanence: 0.15, recovery: 0.0 },
    audio: { squishHz: 520, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RIPE',   color: '#ffffff', sss: '#ffb37a', transmission: 0.22, thickness: 0.65, ior: 1.36, clearcoat: 0.05, roughness: 0.52, sheen: 0.55 },
      { name: 'GOLDEN', color: '#ffe3ae', sss: '#ffd9a0', transmission: 0.22, thickness: 0.65, ior: 1.36, clearcoat: 0.05, roughness: 0.52, sheen: 0.55 },
      { name: 'DUSK',   color: '#e8b9c9', sss: '#ff9a8a', transmission: 0.20, thickness: 0.60, ior: 1.36, clearcoat: 0.05, roughness: 0.55, sheen: 0.55 }
    ]
  },
  {
    id: 'banana', name: 'BANANA', geometry: 'banana', failureMode: 'dent',
    deform: { falloffRadius: 0.28, depth: 0.32, stiffness: 9, damping: 0.90, bulge: 0.30, permanence: 0.50, recovery: 0.0 },
    audio: { squishHz: 460, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RIPE',     color: '#ffffff', sss: '#ffe9a0', transmission: 0.10, thickness: 0.40, ior: 1.38, clearcoat: 0.08, roughness: 0.50, sheen: 0.20 },
      { name: 'GREEN',    color: '#cfe8a8', sss: '#d9f0b0', transmission: 0.10, thickness: 0.40, ior: 1.38, clearcoat: 0.10, roughness: 0.45, sheen: 0.20 },
      { name: 'OVERRIPE', color: '#d9c193', sss: '#e0c9a0', transmission: 0.08, thickness: 0.40, ior: 1.38, clearcoat: 0.05, roughness: 0.58, sheen: 0.15 }
    ]
  },
  {
    id: 'tomato', name: 'TOMATO', geometry: 'tomato', failureMode: 'elastic',
    deform: { falloffRadius: 0.50, depth: 0.50, stiffness: 5, damping: 0.72, bulge: 1.10, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 640, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RIPE',     color: '#ffffff', sss: '#ff6a3a', transmission: 0.35, thickness: 0.85, ior: 1.35, clearcoat: 0.65, roughness: 0.14, sheen: 0.05 },
      { name: 'HEIRLOOM', color: '#ffd9a0', sss: '#ff9a4a', transmission: 0.35, thickness: 0.85, ior: 1.35, clearcoat: 0.60, roughness: 0.16, sheen: 0.05 },
      { name: 'UNRIPE',   color: '#cfe0a8', sss: '#b9d97a', transmission: 0.30, thickness: 0.75, ior: 1.35, clearcoat: 0.55, roughness: 0.18, sheen: 0.05 }
    ]
  },
  {
    id: 'avocado', name: 'AVOCADO', geometry: 'avocado', failureMode: 'crack',
    deform: { falloffRadius: 0.32, depth: 0.40, stiffness: 9, damping: 0.90, bulge: 0.25, permanence: 0.25, recovery: 0.0 },
    shell: { threshold: 0.50, innerRough: 0.30, freq: 13 },
    audio: { squishHz: 420, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'HASS',    color: '#ffffff', inner: '#c8dd6a', sss: '#6b8a3a', transmission: 0.03, thickness: 0.40, ior: 1.40, clearcoat: 0.10, roughness: 0.72, sheen: 0.10 },
      { name: 'EMERALD', color: '#d9ffd9', inner: '#d2e87a', sss: '#7aa04a', transmission: 0.03, thickness: 0.40, ior: 1.40, clearcoat: 0.12, roughness: 0.68, sheen: 0.10 },
      { name: 'STONE',   color: '#cfc9bd', inner: '#b9cc5a', sss: '#8a8a6a', transmission: 0.03, thickness: 0.40, ior: 1.40, clearcoat: 0.08, roughness: 0.75, sheen: 0.10 }
    ]
  },
  {
    id: 'marshmallow', name: 'MARSHMALLOW', geometry: 'mallow', failureMode: 'elastic',
    deform: { falloffRadius: 0.45, depth: 0.55, stiffness: 5, damping: 0.96, bulge: 0.35, permanence: 0.0, recovery: 1.3 },
    audio: { squishHz: 340, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'VANILLA',    color: '#f5f0e8', sss: '#fff5e0', transmission: 0.15, thickness: 0.60, ior: 1.30, clearcoat: 0.0, roughness: 0.82, sheen: 0.60 },
      { name: 'STRAWBERRY', color: '#ffc9d6', sss: '#ffdde6', transmission: 0.15, thickness: 0.60, ior: 1.30, clearcoat: 0.0, roughness: 0.82, sheen: 0.60 },
      { name: 'TOASTED',    color: '#dfb684', sss: '#e8c9a0', transmission: 0.12, thickness: 0.55, ior: 1.32, clearcoat: 0.0, roughness: 0.85, sheen: 0.50 }
    ]
  },
  {
    id: 'bubble-wrap', name: 'BUBBLE WRAP', geometry: 'wrap', failureMode: 'pop',
    deform: { falloffRadius: 0.30, depth: 0.30, stiffness: 12, damping: 0.85, bulge: 0.30, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 0, popHz: 1400 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'BUBBLEGUM', color: '#ff7ab8', sss: '#ffc2dd', transmission: 0.70, thickness: 0.25, ior: 1.42, clearcoat: 0.50, roughness: 0.18, sheen: 0.10 },
      { name: 'ACID',      color: '#b8e02a', sss: '#e6ff8f', transmission: 0.75, thickness: 0.20, ior: 1.42, clearcoat: 0.55, roughness: 0.15, sheen: 0.08 },
      { name: 'CLEAR',     color: '#dfe9ee', sss: '#ffffff', transmission: 0.95, thickness: 0.12, ior: 1.42, clearcoat: 0.50, roughness: 0.06, sheen: 0.05 }
    ]
  }
];
