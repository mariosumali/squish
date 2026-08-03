// content registry — data only, zero logic (PRD §5.3 / §6)
export const SEED_INPUT = { deadzone: 0.05, saturation: 0.92 };

export const SQUISHIES = [
  {
    id: 'gummy-bear', name: 'GUMMY BEAR', geometry: 'bear', failureMode: 'elastic',
    deform: { falloffRadius: 0.36, depth: 0.56, stiffness: 13, damping: 0.76, bulge: 0.70, permanence: 0.0, recovery: 0.0 },
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
      { name: 'DARK CHOC',  color: '#4a2c17', inner: '#ffd94a', sss: '#7a4a24', transmission: 0.05, thickness: 0.50, ior: 1.45, clearcoat: 0.04, roughness: 0.58, sheen: 0.05 },
      { name: 'MILK CHOC',  color: '#7a4a24', inner: '#ffd94a', sss: '#a06a3a', transmission: 0.06, thickness: 0.50, ior: 1.45, clearcoat: 0.04, roughness: 0.55, sheen: 0.05 },
      { name: 'WHITE CHOC', color: '#e8d9b8', inner: '#ffc93c', sss: '#fff0d0', transmission: 0.10, thickness: 0.50, ior: 1.44, clearcoat: 0.05, roughness: 0.52, sheen: 0.08 }
    ]
  },
  {
    id: 'jelly-cube', name: 'JELLY CUBE', geometry: 'cube', failureMode: 'elastic',
    deform: { falloffRadius: 0.48, depth: 0.62, stiffness: 6, damping: 0.70, bulge: 1.10, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 700, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'BERRY',   color: '#7a3bf0', sss: '#b78bff', transmission: 0.85, thickness: 0.50, ior: 1.33, clearcoat: 0.50, roughness: 0.08, sheen: 0.10 },
      { name: 'KIWI',    color: '#55d63a', sss: '#b2ff8f', transmission: 0.82, thickness: 0.45, ior: 1.33, clearcoat: 0.45, roughness: 0.10, sheen: 0.10 },
      { name: 'GLACIER', color: '#29c8dd', sss: '#9defff', transmission: 0.90, thickness: 0.55, ior: 1.33, clearcoat: 0.55, roughness: 0.05, sheen: 0.05 }
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
    id: 'water-balloon', name: 'WATER BALLOON', geometry: 'balloon', failureMode: 'burst',
    deform: { falloffRadius: 0.50, depth: 0.55, stiffness: 5, damping: 0.68, bulge: 1.20, permanence: 0.0, recovery: 0.0 },
    burst: { threshold: 0.40, sprayCount: 90, wobble: 1.0 },
    audio: { squishHz: 620, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'AQUA',   color: '#35b6e8', sss: '#9fe6ff', transmission: 0.88, thickness: 0.70, ior: 1.35, clearcoat: 0.70, roughness: 0.06, sheen: 0.05 },
      { name: 'ROSE',   color: '#ff5f8a', sss: '#ffb0c8', transmission: 0.85, thickness: 0.65, ior: 1.35, clearcoat: 0.65, roughness: 0.08, sheen: 0.05 },
      { name: 'CITRUS', color: '#9fdc3a', sss: '#dcff9a', transmission: 0.85, thickness: 0.65, ior: 1.35, clearcoat: 0.65, roughness: 0.08, sheen: 0.05 }
    ]
  },
  {
    id: 'marshmallow', name: 'MARSHMALLOW', geometry: 'mallow', failureMode: 'elastic',
    deform: { falloffRadius: 0.45, depth: 0.60, stiffness: 5, damping: 0.96, bulge: 0.42, permanence: 0.0, recovery: 1.3 },
    audio: { squishHz: 340, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'VANILLA',    color: '#f5f0e8', sss: '#fff5e0', transmission: 0.15, thickness: 0.60, ior: 1.30, clearcoat: 0.0, roughness: 0.82, sheen: 0.60 },
      { name: 'STRAWBERRY', color: '#ffc9d6', sss: '#ffdde6', transmission: 0.15, thickness: 0.60, ior: 1.30, clearcoat: 0.0, roughness: 0.82, sheen: 0.60 },
      { name: 'TOASTED',    color: '#dfb684', sss: '#e8c9a0', transmission: 0.12, thickness: 0.55, ior: 1.32, clearcoat: 0.0, roughness: 0.85, sheen: 0.50 }
    ]
  },
  {
    id: 'candy-apple', name: 'CANDY APPLE', geometry: 'apple', failureMode: 'crack',
    deform: { falloffRadius: 0.28, depth: 0.30, stiffness: 14, damping: 0.88, bulge: 0.15, permanence: 0.20, recovery: 0.0 },
    shell: { threshold: 0.48, innerRough: 0.55, freq: 10 },
    audio: { squishHz: 820, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RUBY',    color: '#d21226', inner: '#f7f0d9', sss: '#ff5a4a', transmission: 0.30, thickness: 0.60, ior: 1.48, clearcoat: 0.90, roughness: 0.05, sheen: 0.05 },
      { name: 'CARAMEL', color: '#d98e2e', inner: '#f7f0d9', sss: '#ffc06a', transmission: 0.25, thickness: 0.55, ior: 1.46, clearcoat: 0.85, roughness: 0.08, sheen: 0.05 },
      { name: 'POISON',  color: '#7a2ea0', inner: '#e8ffd9', sss: '#c05aff', transmission: 0.28, thickness: 0.60, ior: 1.48, clearcoat: 0.90, roughness: 0.05, sheen: 0.05 }
    ]
  },
  {
    id: 'peach', name: 'PEACH', geometry: 'peach', failureMode: 'elastic',
    deform: { falloffRadius: 0.40, depth: 0.48, stiffness: 8, damping: 0.82, bulge: 0.72, permanence: 0.15, recovery: 0.0 },
    audio: { squishHz: 520, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RIPE',   color: '#ffffff', sss: '#ffb37a', transmission: 0.22, thickness: 0.65, ior: 1.36, clearcoat: 0.05, roughness: 0.52, sheen: 0.55 },
      { name: 'GOLDEN', color: '#ffe3ae', sss: '#ffd9a0', transmission: 0.22, thickness: 0.65, ior: 1.36, clearcoat: 0.05, roughness: 0.52, sheen: 0.55 },
      { name: 'DUSK',   color: '#e8b9c9', sss: '#ff9a8a', transmission: 0.20, thickness: 0.60, ior: 1.36, clearcoat: 0.05, roughness: 0.55, sheen: 0.55 }
    ]
  },
  {
    id: 'ice-cube', name: 'ICE CUBE', geometry: 'ice', failureMode: 'shatter',
    deform: { falloffRadius: 0.30, depth: 0.16, stiffness: 18, damping: 0.92, bulge: 0.05, permanence: 0.0, recovery: 0.0 },
    shatter: { threshold: 0.72, shardScale: 1.0, tumble: 1.0 },
    audio: { squishHz: 1500, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'CLEAR',   color: '#eef6fa', sss: '#ffffff', transmission: 0.97, thickness: 0.80, ior: 1.31, clearcoat: 0.60, roughness: 0.03, sheen: 0.00 },
      { name: 'FROSTED', color: '#dfeef2', sss: '#eaf8ff', transmission: 0.75, thickness: 0.70, ior: 1.31, clearcoat: 0.20, roughness: 0.35, sheen: 0.10 },
      { name: 'GLACIER', color: '#7fd0e8', sss: '#b8ecff', transmission: 0.92, thickness: 0.90, ior: 1.31, clearcoat: 0.50, roughness: 0.06, sheen: 0.05 }
    ]
  },
  {
    id: 'cheese-wedge', name: 'CHEESE WEDGE', geometry: 'cheese', failureMode: 'dent',
    deform: { falloffRadius: 0.36, depth: 0.50, stiffness: 8, damping: 0.93, bulge: 0.40, permanence: 0.85, recovery: 0.0 },
    audio: { squishHz: 360, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'SWISS',   color: '#ffd964', sss: '#ffeb9a', transmission: 0.06, thickness: 0.50, ior: 1.42, clearcoat: 0.15, roughness: 0.42, sheen: 0.12 },
      { name: 'CHEDDAR', color: '#ff9c2e', sss: '#ffc06a', transmission: 0.05, thickness: 0.50, ior: 1.42, clearcoat: 0.12, roughness: 0.45, sheen: 0.10 },
      { name: 'GOUDA',   color: '#e8b45c', sss: '#f5d494', transmission: 0.05, thickness: 0.50, ior: 1.42, clearcoat: 0.18, roughness: 0.50, sheen: 0.10 }
    ]
  },
  {
    id: 'tomato', name: 'TOMATO', geometry: 'tomato', failureMode: 'elastic',
    deform: { falloffRadius: 0.50, depth: 0.52, stiffness: 5, damping: 0.68, bulge: 1.20, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 640, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'RIPE',     color: '#ffffff', sss: '#ff6a3a', transmission: 0.35, thickness: 0.85, ior: 1.35, clearcoat: 0.65, roughness: 0.14, sheen: 0.05 },
      { name: 'HEIRLOOM', color: '#ffd9a0', sss: '#ff9a4a', transmission: 0.35, thickness: 0.85, ior: 1.35, clearcoat: 0.60, roughness: 0.16, sheen: 0.05 },
      { name: 'UNRIPE',   color: '#cfe0a8', sss: '#b9d97a', transmission: 0.30, thickness: 0.75, ior: 1.35, clearcoat: 0.55, roughness: 0.18, sheen: 0.05 }
    ]
  },
  {
    // brittle torched-sugar lid over soft custard
    id: 'creme-brulee', name: 'CRÈME BRÛLÉE', geometry: 'brulee', failureMode: 'crack',
    deform: { falloffRadius: 0.30, depth: 0.35, stiffness: 11, damping: 0.90, bulge: 0.20, permanence: 0.40, recovery: 0.0 },
    shell: { threshold: 0.42, innerRough: 0.35, freq: 12 },
    audio: { squishHz: 520, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'CLASSIC',    color: '#ffffff', inner: '#ffe9a8', sss: '#ffca6a', transmission: 0.08, thickness: 0.45, ior: 1.45, clearcoat: 0.60, roughness: 0.22, sheen: 0.10 },
      { name: 'DARK ROAST', color: '#d9b080', inner: '#ffe2a0', sss: '#e8a95a', transmission: 0.06, thickness: 0.45, ior: 1.45, clearcoat: 0.55, roughness: 0.26, sheen: 0.10 },
      { name: 'MATCHA',     color: '#d6e0b0', inner: '#e9f0c0', sss: '#b8cc8a', transmission: 0.08, thickness: 0.45, ior: 1.45, clearcoat: 0.55, roughness: 0.24, sheen: 0.10 }
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
    // squeeze too hard and the soup gets out
    id: 'xiaolongbao', name: 'XIAOLONGBAO', geometry: 'bao', failureMode: 'burst',
    deform: { falloffRadius: 0.46, depth: 0.58, stiffness: 5, damping: 0.78, bulge: 0.95, permanence: 0.0, recovery: 0.0 },
    burst: { threshold: 0.34, sprayCount: 120, wobble: 1.25 },
    audio: { squishHz: 430, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'STEAMED',  color: '#ffffff', sss: '#ffc27a', transmission: 0.30, thickness: 0.60, ior: 1.36, clearcoat: 0.05, roughness: 0.45, sheen: 0.50 },
      { name: 'CRAB ROE', color: '#ffe9c0', sss: '#ff9a3a', transmission: 0.28, thickness: 0.60, ior: 1.36, clearcoat: 0.05, roughness: 0.45, sheen: 0.50 },
      { name: 'MATCHA',   color: '#d9e8c0', sss: '#b8d98a', transmission: 0.28, thickness: 0.60, ior: 1.36, clearcoat: 0.05, roughness: 0.45, sheen: 0.50 }
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
    // sugar compresses way deeper than anything else, feels dense (no bulge),
    // and creeps back to shape over ~4s via the recovery mechanic
    id: 'sugar-cube', name: 'SUGAR SQUISHY', geometry: 'sugar', failureMode: 'elastic',
    deform: { falloffRadius: 0.55, depth: 0.78, stiffness: 3, damping: 0.985, bulge: 0.12, permanence: 0.0, recovery: 4.2 },
    audio: { squishHz: 250, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'WHITE',       color: '#f7f3ea', sss: '#fff8ec', transmission: 0.10, thickness: 0.40, ior: 1.35, clearcoat: 0.25, roughness: 0.55, sheen: 0.45 },
      { name: 'BROWN SUGAR', color: '#c98e4d', sss: '#e8b878', transmission: 0.08, thickness: 0.40, ior: 1.35, clearcoat: 0.22, roughness: 0.58, sheen: 0.40 },
      { name: 'CANDY FLOSS', color: '#f2a9c8', sss: '#ffd2e4', transmission: 0.10, thickness: 0.40, ior: 1.35, clearcoat: 0.25, roughness: 0.55, sheen: 0.48 }
    ]
  },
  {
    id: 'snowglobe', name: 'SNOWGLOBE', geometry: 'globe', failureMode: 'shatter',
    deform: { falloffRadius: 0.26, depth: 0.14, stiffness: 20, damping: 0.93, bulge: 0.04, permanence: 0.0, recovery: 0.0 },
    shatter: { threshold: 0.62, shardScale: 0.85, tumble: 1.2 },
    audio: { squishHz: 1700, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'CLASSIC',  color: '#ffffff', sss: '#dff2ff', transmission: 0.85, thickness: 0.70, ior: 1.45, clearcoat: 0.80, roughness: 0.06, sheen: 0.00 },
      { name: 'TWILIGHT', color: '#c8d2f5', sss: '#b0c0ff', transmission: 0.82, thickness: 0.70, ior: 1.45, clearcoat: 0.75, roughness: 0.08, sheen: 0.00 },
      { name: 'ROSE',     color: '#f5d5df', sss: '#ffc0d5', transmission: 0.82, thickness: 0.70, ior: 1.45, clearcoat: 0.75, roughness: 0.08, sheen: 0.00 }
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
    // squeeze hard to take a bite — five chomps and it's gone
    id: 'cheeseburger', name: 'CHEESEBURGER', geometry: 'burger', failureMode: 'chomp',
    deform: { falloffRadius: 0.55, depth: 0.62, stiffness: 6, damping: 0.90, bulge: 0.75, permanence: 0.15, recovery: 0.0 },
    chomp: { threshold: 0.55, radius: 0.34, bites: 5 },
    audio: { squishHz: 330, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'CLASSIC', color: '#ffffff', sss: '#ffb066', transmission: 0.04, thickness: 0.40, ior: 1.40, clearcoat: 0.08, roughness: 0.50, sheen: 0.20 },
      { name: 'TOASTED', color: '#ffe2bd', sss: '#ffca8a', transmission: 0.04, thickness: 0.40, ior: 1.40, clearcoat: 0.06, roughness: 0.56, sheen: 0.18 },
      { name: 'GLAZED',  color: '#ffffff', sss: '#ffb066', transmission: 0.06, thickness: 0.40, ior: 1.40, clearcoat: 0.55, roughness: 0.28, sheen: 0.15 }
    ]
  },
  {
    // two desk keys — MARS and JEN — rigid caps that click in and pop back
    // like a mechanical keyboard (no soft-body squish; see the keys mechanic)
    id: 'keycaps', name: 'KEYCAPS', geometry: 'keys', failureMode: 'elastic',
    deform: { falloffRadius: 0.30, depth: 0.34, stiffness: 16, damping: 0.86, bulge: 0.0, permanence: 0.0, recovery: 0.0 },
    audio: { squishHz: 0, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'BLUSH', color: '#f5b8c8', sss: '#ff8fae', transmission: 0.06, thickness: 0.50, ior: 1.45, clearcoat: 0.08, roughness: 0.50, sheen: 0.10 },
      { name: 'MINT',  color: '#b8e0c6', sss: '#8fdcae', transmission: 0.06, thickness: 0.50, ior: 1.45, clearcoat: 0.08, roughness: 0.50, sheen: 0.10 },
      { name: 'RETRO', color: '#f2ead9', sss: '#d9c9a8', transmission: 0.04, thickness: 0.45, ior: 1.45, clearcoat: 0.05, roughness: 0.55, sheen: 0.15 }
    ]
  },
  {
    id: 'choco-egg', name: 'CHOCO EGG', geometry: 'egg', failureMode: 'crack',
    deform: { falloffRadius: 0.30, depth: 0.32, stiffness: 10, damping: 0.90, bulge: 0.20, permanence: 0.30, recovery: 0.0 },
    shell: { threshold: 0.45, innerRough: 0.40, freq: 9 },
    audio: { squishHz: 500, popHz: 0 },
    license: { source: 'procedural', author: 'engine', spdx: 'CC0-1.0' },
    looks: [
      { name: 'MILK',      color: '#7a4a24', inner: '#f2e2c9', sss: '#a06a3a', transmission: 0.05, thickness: 0.50, ior: 1.45, clearcoat: 0.40, roughness: 0.30, sheen: 0.05 },
      { name: 'DARK',      color: '#4a2c17', inner: '#e8d9c0', sss: '#7a4a24', transmission: 0.04, thickness: 0.50, ior: 1.45, clearcoat: 0.45, roughness: 0.26, sheen: 0.05 },
      { name: 'RUBY CHOC', color: '#e8a0b0', inner: '#fff0e0', sss: '#ffc9d5', transmission: 0.06, thickness: 0.50, ior: 1.44, clearcoat: 0.42, roughness: 0.28, sheen: 0.08 }
    ]
  }
];
