// Procedural material bakery. Runs in a browser page (see README in this folder) and
// produces the tileable textures in src/assets/textures/. Nothing here ships to the
// site: the book only loads the resulting WebP files.
//
// Every texture is built the way the real thing is: a height field (fibres, pits,
// flutes pressing through the liner) lit by a lamp from the top left, multiplied
// by a colour layer. All noise is periodic, so the tiles have no seams.

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic value noise. `px`/`py` = lattice cells across the tile. */
function makeNoise(seed, px, py = px) {
  const r = rng(seed);
  const grid = new Float32Array(px * py).map(() => r());
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (u, v) => {
    const x = u * px, y = v * py;
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const at = (i, j) => grid[((j % py) + py) % py * px + ((i % px) + px) % px];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function fbm(seed, base, octaves, stretchY = 1) {
  const layers = Array.from(
    { length: octaves },
    (_, i) => makeNoise(seed + i * 101, base << i, Math.max(1, Math.round((base << i) * stretchY))),
  );
  return (u, v) => {
    let sum = 0, amp = 1, total = 0;
    for (const n of layers) {
      sum += n(u, v) * amp;
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  };
}

/** Thousands of real little curved strokes: this is what makes paper look like paper. */
function fibreLayer(size, seed, { count, length, width, angle, spread, alpha }) {
  const r = rng(seed);
  const c = new OffscreenCanvas(size, size);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  g.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size;
    const a = angle + (r() - 0.5) * spread;
    const len = length * (0.4 + r() * r() * 1.8);
    const bend = (r() - 0.5) * len * 0.5;
    const nx = Math.cos(a), ny = Math.sin(a);
    const shade = r() < 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${shade},${shade},${shade},${alpha * (0.3 + r() * 0.7)})`;
    g.lineWidth = width * (0.5 + r());
    for (const ox of [0, -size, size]) {
      for (const oy of [0, -size, size]) {
        const X = x + ox, Y = y + oy;
        if (X < -len || X > size + len || Y < -len || Y > size + len) continue;
        g.beginPath();
        g.moveTo(X, Y);
        g.quadraticCurveTo(X + nx * len / 2 - ny * bend, Y + ny * len / 2 + nx * bend, X + nx * len, Y + ny * len);
        g.stroke();
      }
    }
  }
  const d = g.getImageData(0, 0, size, size).data;
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255 - 0.5;
  return out;
}

/** Lambert + a little sheen from a lamp at the top left. */
function shade(height, w, h, strength) {
  const out = new Float32Array(w * h);
  const L = [-0.5, -0.6, 0.62];
  for (let y = 0; y < h; y++) {
    const up = ((y + h - 1) % h) * w, down = ((y + 1) % h) * w, row = y * w;
    for (let x = 0; x < w; x++) {
      const l = (x + w - 1) % w, r = (x + 1) % w;
      const dx = (height[row + r] - height[row + l]) * strength;
      const dy = (height[down + x] - height[up + x]) * strength;
      const m = Math.hypot(dx, dy, 1);
      const diff = (-dx * L[0] - dy * L[1] + L[2]) / m;
      out[row + x] = diff / L[2];
    }
  }
  return out;
}

function toCanvas(w, h, pixel) {
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const [R, G, B, A = 1] = pixel(x, y, x + y * w);
      img.data[i] = Math.min(255, Math.max(0, R * 255));
      img.data[i + 1] = Math.min(255, Math.max(0, G * 255));
      img.data[i + 2] = Math.min(255, Math.max(0, B * 255));
      img.data[i + 3] = A * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- Kraft liner: the brown face of a cardboard box ---------- */
export function kraft(size = 1024) {
  const coarse = fibreLayer(size, 11, {
    count: 34000,
    length: 22,
    width: 0.9,
    angle: Math.PI / 2,
    spread: 2.4,
    alpha: 0.11,
  });
  const fine = fibreLayer(size, 12, { count: 90000, length: 12, width: 0.8, angle: 0, spread: TAU, alpha: 0.16 });
  const blotch = fbm(5, 3, 5);
  const pulp = fbm(6, 128, 3);
  const wander = fbm(7, 4, 3);
  const FLUTES = 34;

  const height = new Float32Array(size * size);
  const flute = new Float32Array(size * size);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i++) {
      const u = x / size, v = y / size;
      // the corrugated sheet pressing through the liner, not perfectly straight
      const f = Math.sin((u + (wander(u, v) - 0.5) * 0.035) * FLUTES * TAU);
      flute[i] = f;
      height[i] = coarse[i] * 0.3 + fine[i] * 0.3 + (pulp(u, v) - 0.5) * 0.16 + f * 0.05;
    }
  }
  const light = shade(height, size, size, 1.5);
  const r = rng(99);
  const specks = new Map();
  for (let i = 0; i < 2600; i++) {
    const big = r() < 0.08;
    specks.set(Math.floor(r() * size) + Math.floor(r() * size) * size, big ? 0.55 : 0.78);
  }
  return toCanvas(size, size, (x, y, i) => {
    const u = x / size, v = y / size;
    const b = 0.8 + blotch(u, v) * 0.4;
    const band = 1 + flute[i] * 0.04; // soft stripes: the giveaway of corrugated board
    const fibreTint = coarse[i] * 0.36 + fine[i] * 0.2;
    const k = b * band * light[i] * (specks.get(i) ?? 1);
    return [(0.75 + fibreTint) * k, (0.6 + fibreTint * 0.92) * k, (0.43 + fibreTint * 0.72) * k];
  });
}

/* ---------- Neutral paper grain: multiplied on top of any colour ---------- */
export function grain(size = 768) {
  const fibres = fibreLayer(size, 21, { count: 52000, length: 15, width: 0.8, angle: 0, spread: TAU, alpha: 0.2 });
  const tooth = fbm(22, 64, 4);
  const cloud = fbm(23, 3, 4);
  const height = new Float32Array(size * size);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i++) {
      height[i] = fibres[i] * 0.35 + (tooth(x / size, y / size) - 0.5) * 0.28;
    }
  }
  const light = shade(height, size, size, 1.6);
  return toCanvas(size, size, (x, y, i) => {
    const v = (0.9 + cloud(x / size, y / size) * 0.1) * (0.935 + (light[i] - 1) * 0.5);
    return [v, v, v * 0.99];
  });
}

/* ---------- White drawing paper, lightly toned ---------- */
export function paper(size = 768) {
  const fibres = fibreLayer(size, 31, { count: 30000, length: 18, width: 0.7, angle: 0.3, spread: TAU, alpha: 0.12 });
  const tooth = fbm(32, 96, 3);
  const cloud = fbm(33, 3, 4);
  const height = new Float32Array(size * size);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i++) height[i] = fibres[i] * 0.5 + (tooth(x / size, y / size) - 0.5) * 0.25;
  }
  const light = shade(height, size, size, 1.5);
  return toCanvas(size, size, (x, y, i) => {
    const v = (0.96 + cloud(x / size, y / size) * 0.05) * (1 + (light[i] - 1) * 0.55);
    return [v, v * 0.975, v * 0.925];
  });
}

/* ---------- Matt black card with white-core scuffs: the night sky of each diorama ---------- */
export function night(size = 768) {
  const fibres = fibreLayer(size, 41, { count: 26000, length: 20, width: 0.9, angle: 0, spread: TAU, alpha: 0.2 });
  const cloud = fbm(42, 2, 5);
  const brush = fbm(43, 6, 4, 0.25);
  const height = new Float32Array(size * size);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i++) height[i] = fibres[i] * 0.3 + brush(x / size, y / size) * 0.5;
  }
  const light = shade(height, size, size, 1.6);
  return toCanvas(size, size, (x, y, i) => {
    const c = cloud(x / size, y / size);
    const k = (0.55 + c * 0.9) * (0.75 + (light[i] - 0.75) * 1.2) * (1 + fibres[i] * 0.55);
    return [0.085 * k, 0.1 * k, 0.21 * k];
  });
}

/* ---------- Side view of the cut edge: liner, wavy flute, liner ---------- */
export function edge(w = 256, h = 48) {
  const FLUTES = 4;
  const noise = fbm(51, 16, 4, 0.25);
  const fine = fbm(52, 64, 3, 0.25);
  return toCanvas(w, h, (x, y) => {
    const u = x / w, v = (y + 0.5) / h;
    const liner = 0.13;
    const n = fine(u, v) * 0.12;
    if (v < liner || v > 1 - liner) {
      const k = 0.92 + noise(u, v) * 0.2 + n - (v < liner ? 0 : 0.14);
      return [0.74 * k, 0.58 * k, 0.42 * k];
    }
    const inner = (v - liner) / (1 - liner * 2);
    const wave = 0.5 + 0.44 * Math.sin(u * FLUTES * TAU + (noise(u, 0.3) - 0.5) * 1.2);
    const d = Math.abs(inner - wave);
    const thick = 0.085;
    if (d < thick) {
      // the flute sheet itself, brighter where its slope faces the lamp
      const slope = Math.cos(u * FLUTES * TAU);
      const k = (0.86 + slope * 0.16 + n) * (1 - d / thick * 0.25);
      return [0.76 * k, 0.6 * k, 0.43 * k];
    }
    // the hollow tubes between flutes go dark towards the inside
    const depth = Math.min(1, d * 2.5);
    const k = 0.6 - depth * 0.3 + n * 0.5;
    return [0.42 * k, 0.29 * k, 0.17 * k];
  });
}

/* ---------- Peeled board: bare ribs, for the spine of the book ---------- */
export function ribs(w = 256, h = 256) {
  const FLUTES = 8;
  const fibres = fibreLayer(w, 61, {
    count: 9000,
    length: 16,
    width: 0.8,
    angle: Math.PI / 2,
    spread: 0.6,
    alpha: 0.22,
  });
  const tear = fbm(62, 6, 4, 2);
  const height = new Float32Array(w * h);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const u = x / w;
      const wave = Math.sin(u * FLUTES * TAU) * 0.5 + 0.5;
      height[i] = Math.pow(wave, 0.7) * 11 + fibres[i] * 0.7 + (tear(u, y / h) - 0.5) * 0.8;
    }
  }
  const light = shade(height, w, h, 1.1);
  return toCanvas(w, h, (x, _y, i) => {
    const wave = Math.sin(x / w * FLUTES * TAU) * 0.5 + 0.5;
    const k = (0.46 + 0.6 * Math.pow(wave, 0.8)) * light[i];
    return [0.74 * k, 0.55 * k, 0.36 * k];
  });
}

export const TEXTURES = {
  kraft: [kraft, 0.8],
  grain: [grain, 0.78],
  paper: [paper, 0.72],
  night: [night, 0.7],
  edge: [edge, 0.85],
  ribs: [ribs, 0.8],
};

export async function bake(name) {
  const [make, quality] = TEXTURES[name];
  const canvas = make();
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}
