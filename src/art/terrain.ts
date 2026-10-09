import { PixelCanvas, rgb, withAlpha, mix, type Color } from './pixel';
import { P, GRASS, type GrassPal } from './palette';
import { Rng, hash2, valueNoise } from './rng';
import { bufferToCanvas } from './atlas';

/* ---------- Autotile de 47 (bitmask 8 vizinhos, reduzido) ---------- */
export const AN = 1, ANE = 2, AE = 4, ASE = 8, AS = 16, ASW = 32, AW = 64, ANW = 128;

export function reduceMask(m: number): number {
  if (!(m & AN) || !(m & AE)) m &= ~ANE;
  if (!(m & AS) || !(m & AE)) m &= ~ASE;
  if (!(m & AS) || !(m & AW)) m &= ~ASW;
  if (!(m & AN) || !(m & AW)) m &= ~ANW;
  return m;
}
/** Lista das 47 máscaras canônicas e tabela máscara(0..255) → índice 0..46. */
export const AUTO_MASKS: number[] = [];
export const MASK_TO_AUTO = new Uint8Array(256);
(() => {
  const seen = new Map<number, number>();
  for (let m = 0; m < 256; m++) {
    const r = reduceMask(m);
    if (!seen.has(r)) { seen.set(r, AUTO_MASKS.length); AUTO_MASKS.push(r); }
  }
  for (let m = 0; m < 256; m++) MASK_TO_AUTO[m] = seen.get(reduceMask(m))!;
})();

/** Ondulação periódica (período 16) para bordas orgânicas que casam entre tiles. */
const JIT = [0, 1, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 1, 0, 0, 0];

type Dir = 0 | 1 | 2 | 3; // borda mais próxima: 0 cima, 1 baixo, 2 esquerda, 3 direita
type Styler = (d: number, x: number, y: number, dir: Dir, jit: number) => Color;

interface Field { d: Uint8Array; dir: Uint8Array; jit: Uint8Array; }
const fieldCache = new Map<number, Field>();

/** Campo de distância (até a borda da região) para uma máscara e raio de canto; calculado uma vez. */
function distField(mask: number, round: number): Field {
  const key = mask * 16 + round;
  const hit = fieldCache.get(key);
  if (hit) return hit;
  const G = 48;
  const grid = new Uint8Array(G * G);
  const cell = (cx: number, cy: number, on: boolean) => {
    if (!on) return;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) grid[(cy * 16 + y) * G + cx * 16 + x] = 1;
  };
  cell(1, 1, true);
  cell(1, 0, !!(mask & AN)); cell(2, 0, !!(mask & ANE)); cell(2, 1, !!(mask & AE)); cell(2, 2, !!(mask & ASE));
  cell(1, 2, !!(mask & AS)); cell(0, 2, !!(mask & ASW)); cell(0, 1, !!(mask & AW)); cell(0, 0, !!(mask & ANW));
  const r = round;
  const corner = (ox: number, oy: number, sx: number, sy: number) => {
    for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
      const dx = r - i - 0.5, dy = r - j - 0.5;
      if (dx * dx + dy * dy > r * r) grid[(oy + sy * j) * G + ox + sx * i] = 0;
    }
  };
  if (r > 0) {
    if (!(mask & AN) && !(mask & AW)) corner(16, 16, 1, 1);
    if (!(mask & AN) && !(mask & AE)) corner(31, 16, -1, 1);
    if (!(mask & AS) && !(mask & AW)) corner(16, 31, 1, -1);
    if (!(mask & AS) && !(mask & AE)) corner(31, 31, -1, -1);
  }
  const f: Field = { d: new Uint8Array(256), dir: new Uint8Array(256), jit: new Uint8Array(256) };
  const R = 8;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const gx = 16 + x, gy = 16 + y, k = y * 16 + x;
    if (!grid[gy * G + gx]) { f.d[k] = 0; continue; }
    let best = 99, bdx = 0, bdy = 0;
    for (let j = -R; j <= R; j++) {
      const yy = gy + j;
      if (yy < 0 || yy >= G || Math.abs(j) >= best) continue;
      for (let i = -R; i <= R; i++) {
        const xx = gx + i;
        if (xx < 0 || xx >= G || grid[yy * G + xx]) continue;
        const dd = Math.sqrt(i * i + j * j);
        if (dd < best) { best = dd; bdx = i; bdy = j; }
      }
    }
    f.d[k] = best >= 99 ? 99 : Math.floor(best + 0.25);
    let dir: Dir;
    if (Math.abs(bdy) >= Math.abs(bdx)) dir = bdy < 0 ? 0 : 1; else dir = bdx < 0 ? 2 : 3;
    f.dir[k] = dir;
    f.jit[k] = dir <= 1 ? JIT[x & 15] : JIT[(y + 5) & 15];
  }
  fieldCache.set(key, f);
  return f;
}

/** Gera um tile autotile para a máscara dada usando o campo de distância até a borda. */
function autoTile(mask: number, round: number, style: Styler): PixelCanvas {
  const f = distField(mask, round);
  const pc = new PixelCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const k = y * 16 + x;
    pc.set(x, y, style(f.d[k], x, y, f.dir[k] as Dir, f.jit[k]));
  }
  return pc;
}

/* ---------- Estilos de cada terreno ---------- */
function grassPixel(g: GrassPal, x: number, y: number, seed: number): Color {
  const h = hash2(x, y, seed);
  return h < 0.035 ? g.g1 : h > 0.975 ? g.g3 : g.g2;
}

function dirtInterior(x: number, y: number, seed: number, winter: boolean): Color {
  const h = hash2(x, y, seed);
  let c = h < 0.08 ? P.dirt1 : h > 0.94 ? P.dirt3 : P.dirt2;
  if (winter && hash2(x, y, seed + 9) < 0.18) c = mix(c, rgb('#e8eef8'), 0.6);
  return c;
}

const dirtStyle = (g: GrassPal, season: number): Styler => (d, x, y, dir, jit) => {
  const fringe = 2 + jit;
  if (d <= fringe - 1) return d === fringe - 1 && dir === 0 ? g.g3 : grassPixel(g, x, y, 7);
  if (d === fringe) return g.g0;
  if (d === fringe + 1 && (dir === 0 || dir === 2)) return P.dirt0;
  if (d === fringe + 2 && dir === 0) return P.dirt1;
  return dirtInterior(x, y, 31, season === 3);
};

const WSHADOW = withAlpha(rgb('#0c2348'), 120);
const WSHADOW2 = withAlpha(rgb('#0c2348'), 60);
const FOAM = withAlpha(P.foam, 190);
const waterStyle = (g: GrassPal, season: number): Styler => (d, x, y, dir, jit) => {
  const land = 1 + jit;
  if (d === 0) return grassPixel(g, x, y, 7);
  if (d <= land) return grassPixel(g, x, y, 7);
  if (d === land + 1) return g.g0;
  if (dir === 0) {
    if (d === land + 2) return season === 3 ? rgb('#9aa6c0') : P.dirt2;
    if (d === land + 3) return season === 3 ? rgb('#6e7a98') : P.dirt1;
    if (d === land + 4) return P.dirt0;
    if (d === land + 5) return ((x + Math.floor(y / 2)) % 5 === 0) ? WSHADOW : FOAM;
    if (d === land + 6) return WSHADOW;
    if (d === land + 7) return WSHADOW2;
    return 0;
  }
  if (d === land + 2) return P.dirt0;
  if (d === land + 3) return ((dir <= 1 ? x : y) % 6 === 0) ? WSHADOW : FOAM;
  if (d === land + 4) return WSHADOW2;
  return 0;
};

const soilStyle = (wet: boolean): Styler => {
  const c0 = wet ? P.wet0 : P.soil0, c1 = wet ? P.wet1 : P.soil1, c2 = wet ? P.wet2 : P.soil2, c3 = wet ? P.wet3 : P.soil3;
  return (d, x, y, dir) => {
    if (d === 0) return 0;
    if (d === 1) return c0;
    if (d === 2) return dir === 0 || dir === 2 ? c3 : c1;
    const row = y % 4;
    if (row === 3) return c1;
    if (row === 0) return hash2(x, y, wet ? 3 : 4) < 0.15 ? c2 : c3;
    const h = hash2(x, y, wet ? 5 : 6);
    if (wet && h > 0.96) return rgb('#6f5a52');
    return h < 0.06 ? c1 : c2;
  };
};

/* ---------- Grama ---------- */
function grassTile(g: GrassPal, variant: number, season: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, grassPixel(g, x, y, 100 + variant));
  const rng = new Rng(1000 + variant * 77 + season * 13);
  const winter = season === 3;
  // manchas suaves de tom (não tocam a borda para não criar costuras)
  const blobs = 1 + (variant % 2);
  for (let b = 0; b < blobs; b++) {
    const cx = rng.int(4, 11), cy = rng.int(4, 11), r = rng.range(2, 3.2);
    const c = rng.chance(0.5) ? g.g3 : g.g1;
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.3);
      if (d < r && hash2(x, y, variant + 50) < 0.55) pc.set(x, y, c);
    }
  }
  const tufts = winter ? 2 : 5 + (variant % 4);
  for (let t = 0; t < tufts; t++) {
    const x = rng.int(1, 14), y = rng.int(3, 14);
    if (winter) {
      pc.set(x, y, g.g1); pc.set(x + 1, y, g.g1); pc.set(x, y - 1, g.g4);
      continue;
    }
    // tufo em "v": base escura, pontas claras
    pc.set(x, y, g.g0); pc.set(x - 1, y - 1, g.g1); pc.set(x + 1, y - 1, g.g1);
    pc.set(x - 1, y - 2, g.g3); pc.set(x + 1, y - 2, g.g4);
    if (rng.chance(0.5)) { pc.set(x, y - 1, g.g1); pc.set(x, y - 2, g.g3); pc.set(x, y - 3, g.g4); }
  }
  const specks = 3 + (variant % 4);
  for (let s = 0; s < specks; s++) pc.set(rng.int(0, 15), rng.int(0, 15), rng.chance(0.5) ? g.g4 : g.g1);
  if (!winter && variant >= 9) {
    const n = variant === 11 ? 2 : 1;
    const petals = season === 2 ? [P.flowerY, rgb('#e07a2a')] : [P.flowerW, P.flowerP, P.flowerB, P.flowerY];
    for (let k = 0; k < n; k++) {
      const x = rng.int(3, 12), y = rng.int(3, 12);
      const pcol = rng.pick(petals);
      pc.set(x, y + 1, g.g0);
      pc.set(x - 1, y, pcol); pc.set(x + 1, y, pcol); pc.set(x, y - 1, pcol); pc.set(x, y + 1, mix(pcol, g.g1, 0.5));
      pc.set(x, y, season === 2 ? rgb('#7a3a12') : P.flowerY);
    }
  }
  if (variant === 8) { // pedrinhas
    const x = rng.int(3, 12), y = rng.int(3, 12);
    pc.set(x, y, P.stone3); pc.set(x + 1, y, P.stone2); pc.set(x, y + 1, P.stone1); pc.set(x + 1, y + 1, P.stone1);
  }
  return pc;
}

/* ---------- Pisos de interiores ---------- */
function woodFloor(v: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  const cols = [P.wood2, P.wood3, rgb('#a8692f')];
  for (let row = 0; row < 4; row++) {
    const base = cols[(row + v) % 3];
    for (let y = row * 4; y < row * 4 + 4; y++) for (let x = 0; x < 16; x++) {
      let c = base;
      if (y === row * 4 + 3) c = P.wood1;
      else if (y === row * 4) c = mix(base, P.wood4, 0.35);
      else if (hash2(x, y, 40 + v) < 0.1) c = mix(base, P.wood1, 0.4);
      pc.set(x, y, c);
    }
    const seam = (row * 7 + v * 5 + 3) & 15;
    for (let y = row * 4; y < row * 4 + 3; y++) pc.set(seam, y, P.wood1);
  }
  return pc;
}

function wallTile(kind: 'top' | 'mid' | 'base'): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  const wp0 = rgb('#7a5a8a'), wp1 = rgb('#9a7aa8'), wp2 = rgb('#b89cc2');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c: Color;
    if (kind === 'base') {
      c = y < 2 ? P.wood4 : y < 3 ? P.wood3 : y > 13 ? P.wood0 : (x % 8 === 0 ? P.wood1 : P.wood2);
    } else {
      c = (x % 8 === 3) ? wp0 : ((x + y) % 8 === 0 ? wp2 : wp1);
      if (kind === 'top' && y < 3) c = y === 2 ? P.wood1 : P.wood3;
    }
    pc.set(x, y, c);
  }
  return pc;
}

/* ---------- Montagem do tileset ---------- */
export interface TerrainIndex {
  /** [estação][variante] */
  grass: number[][];
  /** base do conjunto de 47 por estação */
  dirt: number[];
  water: number[];
  soil: number;
  soilWet: number;
  floor: number[];
  wallTop: number; wallMid: number; wallBase: number;
  black: number;
}
export const GRASS_VARIANTS = 12;

/** Peso das variantes de grama (comuns aparecem mais). */
export const GRASS_WEIGHTS = [10, 10, 10, 8, 8, 6, 6, 5, 2, 2, 1, 1];

export interface TerrainBuild { canvas: HTMLCanvasElement; index: TerrainIndex; }

export function buildTerrain(): TerrainBuild {
  const tiles: PixelCanvas[] = [];
  const push = (pc: PixelCanvas) => { tiles.push(pc); return tiles.length - 1; };
  const index: TerrainIndex = { grass: [], dirt: [], water: [], soil: 0, soilWet: 0, floor: [], wallTop: 0, wallMid: 0, wallBase: 0, black: 0 };
  for (let s = 0; s < 4; s++) {
    const g = GRASS[s];
    index.grass.push([]);
    for (let v = 0; v < GRASS_VARIANTS; v++) index.grass[s].push(push(grassTile(g, v, s)));
    index.dirt.push(tiles.length);
    for (const m of AUTO_MASKS) push(autoTile(m, 4, dirtStyle(g, s)));
    index.water.push(tiles.length);
    for (const m of AUTO_MASKS) push(autoTile(m, 5, waterStyle(g, s)));
  }
  index.soil = tiles.length;
  for (const m of AUTO_MASKS) push(autoTile(m, 3, soilStyle(false)));
  index.soilWet = tiles.length;
  for (const m of AUTO_MASKS) push(autoTile(m, 3, soilStyle(true)));
  for (let v = 0; v < 3; v++) index.floor.push(push(woodFloor(v)));
  index.wallTop = push(wallTile('top'));
  index.wallMid = push(wallTile('mid'));
  index.wallBase = push(wallTile('base'));
  const blk = new PixelCanvas(16, 16); blk.fill(rgb('#120a08'));
  index.black = push(blk);

  // Tileset com extrusão de 1px (margin 1, spacing 2) contra costuras.
  const cols = 28, stride = 18;
  const rows = Math.ceil(tiles.length / cols);
  const W = 1 + cols * stride, H = 1 + rows * stride;
  const W2 = W, H2 = H;
  const page = new PixelCanvas(W2, H2);
  tiles.forEach((t, i) => {
    const ox = 1 + (i % cols) * stride, oy = 1 + Math.floor(i / cols) * stride;
    for (let y = -1; y <= 16; y++) for (let x = -1; x <= 16; x++) {
      const sx = Math.min(15, Math.max(0, x)), sy = Math.min(15, Math.max(0, y));
      page.data[(oy + y) * W2 + ox + x] = t.data[sy * 16 + sx];
    }
  });
  return { canvas: bufferToCanvas(page.data, W2, H2), index };
}
export const TILESET_COLS = 28;

/* ---------- Texturas de água (TileSprite) ---------- */
export function waterTextures(): { base: PixelCanvas; hi: PixelCanvas } {
  const S = 64;
  const base = new PixelCanvas(S, S), hi = new PixelCanvas(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // ruído periódico (64px) esticado na horizontal: ondas suaves sem costura
    const n = valueNoise(x / 16, y / 8, 91, 4, 8);
    const n2 = valueNoise(x / 8, y / 4, 92, 8, 16);
    const v = n * 0.65 + n2 * 0.35;
    base.set(x, y, v > 0.64 ? P.water3 : v > 0.4 ? P.water2 : P.water1);
  }
  // listras de brilho (camada de cima, se move em outra direção)
  const rng = new Rng(77);
  for (let k = 0; k < 14; k++) {
    const x = rng.int(0, S - 1), y = rng.int(0, S - 1), len = rng.int(2, 5);
    for (let i = 0; i < len; i++) hi.set((x + i) % S, y, withAlpha(P.waterHi, i === 0 || i === len - 1 ? 110 : 180));
    if (rng.chance(0.4)) hi.set((x + 1) % S, (y + 1) % S, withAlpha(P.foam, 120));
  }
  return { base, hi };
}
