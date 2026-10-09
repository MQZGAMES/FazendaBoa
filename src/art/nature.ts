import { PixelCanvas, rgb, mix, outlineOf, withAlpha, type Color } from './pixel';
import { P, FOLIAGE, type FoliagePal } from './palette';
import { Rng, hash2 } from './rng';
import type { AtlasBuilder } from './atlas';

const BARK = [rgb('#2e1a0e'), rgb('#4e2f18'), rgb('#6e4425'), rgb('#8e5c34'), rgb('#ad7a4a')];

interface Puff { x: number; y: number; r: number; }

/** Copa em "bolhas" com luz do canto superior esquerdo e sombra entre camadas. */
function canopy(pc: PixelCanvas, puffs: Puff[], f: FoliagePal, seed: number, snow = false): void {
  const owner = new Int16Array(pc.w * pc.h).fill(-1);
  const sorted = puffs.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y);
  for (const { p, i } of sorted) {
    for (let y = Math.floor(p.y - p.r); y <= Math.ceil(p.y + p.r); y++) for (let x = Math.floor(p.x - p.r); x <= Math.ceil(p.x + p.r); x++) {
      if (!pc.inb(x, y)) continue;
      const nx = (x + 0.5 - p.x) / p.r, ny = (y + 0.5 - p.y) / p.r;
      const d2 = nx * nx + ny * ny;
      // borda levemente irregular
      const wob = (hash2(x, y, seed) - 0.5) * 0.18;
      if (d2 > 1 + wob) continue;
      const light = -(nx * 0.55 + ny * 0.85) + (hash2(x >> 1, y >> 1, seed + 3) - 0.5) * 0.35;
      let c: Color;
      if (light > 0.62) c = f.f4; else if (light > 0.18) c = f.f3; else if (light > -0.4) c = f.f2; else c = f.f1;
      // aro inferior de cada bolha escurece o que está atrás (profundidade)
      if (d2 > 0.78 && ny > 0.25) c = f.f1;
      pc.set(x, y, c);
      owner[y * pc.w + x] = i;
    }
  }
  // traços de folhas
  const rng = new Rng(seed);
  for (let k = 0; k < (pc.w * pc.h) / 22; k++) {
    const x = rng.int(0, pc.w - 1), y = rng.int(0, pc.h - 1);
    const c = pc.get(x, y);
    if (!c || owner[y * pc.w + x] < 0) continue;
    if (c === f.f3 || c === f.f4) { pc.paint(x + 1, y + 1, f.f2 === c ? f.f1 : c === f.f4 ? f.f3 : f.f2); pc.paint(x, y, c === f.f3 ? f.f4 : c); }
    else if (c === f.f2) { pc.paint(x, y, f.f1); pc.paint(x - 1, y - 1, f.f3); }
  }
  if (snow) {
    for (let y = 1; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
      if (pc.get(x, y) && !pc.get(x, y - 1) && hash2(x, y, 9) < 0.92) { pc.set(x, y, P.white); pc.paint(x, y + 1, rgb('#e2ebf6')); }
    }
  }
}

function trunk(pc: PixelCanvas, cx: number, top: number, bottom: number, w: number, roots: boolean): void {
  for (let y = top; y <= bottom; y++) {
    let hw = w / 2;
    if (roots && y > bottom - 5) hw += (y - (bottom - 5)) * 0.9;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const t = (x + 0.5 - (cx - hw)) / (hw * 2);
      let c = t < 0.25 ? BARK[3] : t < 0.6 ? BARK[2] : BARK[1];
      if ((x * 7 + Math.floor(y / 3)) % 5 === 0 && t > 0.2 && t < 0.85) c = BARK[1];
      if (hash2(x, y, 4) < 0.05) c = BARK[4];
      pc.set(x, y, c);
    }
  }
}

/** Árvores 48x80: 0 carvalho, 1 bordo, 2 pinheiro. */
function drawTree(pc: PixelCanvas, type: number, season: number): void {
  const cx = 24;
  if (type === 2) {
    trunk(pc, cx, 56, 77, 6, true);
    const f: FoliagePal = season === 3
      ? { f0: rgb('#123222'), f1: rgb('#1c4a30'), f2: rgb('#28603c'), f3: rgb('#3a7a4c'), f4: rgb('#5a9a64') }
      : season === 2 ? { f0: rgb('#122e1c'), f1: rgb('#1d4528'), f2: rgb('#2b5e33'), f3: rgb('#3e7a3e'), f4: rgb('#62985a') }
        : { f0: rgb('#0f2e1e'), f1: rgb('#18452a'), f2: rgb('#245e34'), f3: rgb('#347c40'), f4: rgb('#58a052') };
    const tiers = [{ y: 8, h: 18, w: 14 }, { y: 18, h: 20, w: 19 }, { y: 30, h: 22, w: 23 }, { y: 43, h: 20, w: 23 }];
    for (const t of tiers) {
      for (let j = 0; j < t.h; j++) {
        const hw = (j / t.h) * t.w * 0.95 + 1;
        const yy = t.y + j;
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          const edge = (x - (cx - hw)) / (hw * 2);
          const jag = j > t.h - 4 && ((x + j) % 4 === 0);
          if (jag) continue;
          let c = edge < 0.3 ? f.f3 : edge < 0.62 ? f.f2 : f.f1;
          if (j > t.h - 3) c = f.f1;
          if (hash2(x, yy, 12) < 0.08 && edge < 0.5) c = f.f4;
          if (hash2(x, yy, 13) < 0.08 && edge > 0.5) c = f.f0;
          pc.set(x, yy, c);
        }
      }
    }
    if (season === 3) {
      for (let y = 1; y < pc.h - 25; y++) for (let x = 0; x < pc.w; x++) {
        if (pc.get(x, y) && pc.get(x, y) !== BARK[1] && !pc.get(x, y - 1)) { pc.set(x, y, P.white); pc.paint(x, y + 1, rgb('#dfe8f4')); }
      }
    }
    pc.outline((c) => outlineOf(c));
    return;
  }
  trunk(pc, cx, 44, 77, 9, true);
  // galhos saindo do tronco
  pc.line(cx - 2, 50, cx - 8, 44, BARK[2]); pc.line(cx + 2, 49, cx + 9, 43, BARK[1]);
  let f = FOLIAGE[season];
  if (type === 1 && season === 2) f = { f0: rgb('#4a0e10'), f1: rgb('#7a1a18'), f2: rgb('#b02e22'), f3: rgb('#dc4e2e'), f4: rgb('#f58a4a') };
  if (type === 1 && season === 0) f = { f0: rgb('#1d4228'), f1: rgb('#2f6a33'), f2: rgb('#4a9640'), f3: rgb('#72b84e'), f4: rgb('#a8dc70') };
  const puffs: Puff[] = type === 0
    ? [{ x: 24, y: 14, r: 11 }, { x: 13, y: 24, r: 10 }, { x: 35, y: 24, r: 10 }, { x: 24, y: 26, r: 12 }, { x: 15, y: 38, r: 10 }, { x: 33, y: 38, r: 10 }, { x: 24, y: 42, r: 10 }]
    : [{ x: 24, y: 13, r: 12 }, { x: 12, y: 22, r: 10 }, { x: 36, y: 22, r: 10 }, { x: 24, y: 25, r: 13 }, { x: 11, y: 35, r: 9 }, { x: 37, y: 35, r: 9 }, { x: 24, y: 40, r: 12 }];
  canopy(pc, puffs, f, 50 + type * 10 + season, season === 3);
  if (season === 1 && type === 0) { // frutinhas/flores no verão
    const rng = new Rng(9);
    for (let k = 0; k < 6; k++) { const x = rng.int(10, 38), y = rng.int(8, 44); if (pc.get(x, y)) { pc.set(x, y, rgb('#f6e27a')); } }
  }
  if (season === 0) {
    const rng = new Rng(19 + type);
    for (let k = 0; k < 9; k++) { const x = rng.int(8, 40), y = rng.int(6, 46); if (pc.get(x, y) && pc.get(x + 1, y)) { pc.set(x, y, type === 1 ? P.flowerW : P.flowerP); } }
  }
  pc.outline((c) => outlineOf(c));
}

function drawStump(pc: PixelCanvas, big: boolean): void {
  const cx = pc.w / 2, base = pc.h - 3;
  const w = big ? 22 : 12, h = big ? 10 : 7;
  trunk(pc, cx, base - h, base, w, true);
  // topo com anéis
  const ry = big ? 4 : 3;
  pc.ellipse(cx, base - h, w / 2, ry, rgb('#d9a868'));
  pc.ellipse(cx, base - h, w / 2 - 2, ry - 1, rgb('#c48e52'));
  pc.ellipse(cx, base - h, w / 2 - 4 > 1 ? w / 2 - 4 : 1.5, Math.max(1, ry - 2), rgb('#d9a868'));
  pc.set(Math.floor(cx), base - h, rgb('#8a5a2c'));
  pc.outline((c) => outlineOf(c));
}

function drawSapling(pc: PixelCanvas, stage: number, season: number): void {
  const f = FOLIAGE[season === 3 ? 0 : season];
  const cx = pc.w / 2, base = pc.h - 2;
  if (stage === 0) {
    pc.vline(cx, base - 4, base, BARK[2]);
    pc.set(cx - 1, base - 4, f.f3); pc.set(cx - 2, base - 5, f.f3); pc.set(cx + 1, base - 5, f.f2); pc.set(cx + 2, base - 6, f.f3);
  } else if (stage === 1) {
    pc.vline(cx, base - 10, base, BARK[2]);
    canopy(pc, [{ x: cx, y: base - 12, r: 5 }, { x: cx - 3, y: base - 8, r: 4 }, { x: cx + 3, y: base - 8, r: 4 }], f, 71 + season);
  } else {
    trunk(pc, cx, base - 16, base, 4, false);
    canopy(pc, [{ x: cx, y: base - 26, r: 8 }, { x: cx - 6, y: base - 19, r: 7 }, { x: cx + 6, y: base - 19, r: 7 }, { x: cx, y: base - 17, r: 7 }], FOLIAGE[season], 81 + season, season === 3);
  }
  pc.outline((c) => outlineOf(c));
}

/* ---------- Pedras ---------- */
export const ORE_COLORS: Record<string, [Color, Color]> = {
  copper: [rgb('#c8642a'), rgb('#f2a060')],
  iron: [rgb('#b8a49a'), rgb('#f2e6dc')],
  gold: [rgb('#d89a14'), rgb('#ffe066')],
  coal: [rgb('#1c1a20'), rgb('#3c3a44')],
};
export const GEM_COLORS: Record<string, [Color, Color, Color]> = {
  quartz: [rgb('#a8b8c8'), rgb('#dce8f4'), rgb('#ffffff')],
  amethyst: [rgb('#6a2a9a'), rgb('#a85ad8'), rgb('#e0b0ff')],
  topaz: [rgb('#b8780a'), rgb('#f2b42a'), rgb('#fff09a')],
  emerald: [rgb('#0e6a3a'), rgb('#22b062'), rgb('#9af0b8')],
  ruby: [rgb('#8a0a1e'), rgb('#e02a40'), rgb('#ff9aa8')],
  diamond: [rgb('#5ab0d8'), rgb('#b8f0ff'), rgb('#ffffff')],
};

function rockBody(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, seed: number, dark = false): void {
  const s = dark ? [rgb('#2a2630'), rgb('#433e4c'), rgb('#5e5868'), rgb('#7c7686')] : [P.stone1, P.stone2, P.stone3, P.stone4];
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    const wob = (hash2(x >> 1, y >> 1, seed) - 0.5) * 0.25;
    const d = nx * nx + ny * ny;
    if (d > 1 + wob) continue;
    const l = -(nx * 0.6 + ny * 0.8) + (hash2(x, y, seed + 1) - 0.5) * 0.3;
    pc.set(x, y, l > 0.55 ? s[3] : l > 0.05 ? s[2] : l > -0.5 ? s[1] : s[0]);
  }
  // rachaduras
  const rng = new Rng(seed);
  const x0 = Math.round(cx + rng.range(-rx * 0.3, rx * 0.3)), y0 = Math.round(cy - ry * 0.2);
  pc.paint(x0, y0, s[0]); pc.paint(x0 + 1, y0 + 1, s[0]); pc.paint(x0 + 1, y0 + 2, s[0]);
}

function drawRock(pc: PixelCanvas, kind: string, v: number): void {
  const cx = pc.w / 2, cy = pc.h - 6.5;
  const mine = kind !== 'stone';
  rockBody(pc, cx, cy, 6.5 + (v % 2) * 0.5, 5 + (v % 2), 200 + v * 3 + kind.length, mine && kind !== 'stone');
  const rng = new Rng(300 + v + kind.length * 7);
  if (ORE_COLORS[kind]) {
    const [a, b] = ORE_COLORS[kind];
    for (let k = 0; k < 6; k++) {
      const x = Math.round(cx + rng.range(-4.5, 4.5)), y = Math.round(cy + rng.range(-3.5, 3));
      if (!pc.get(x, y)) continue;
      pc.set(x, y, a); pc.paint(x + 1, y, a); pc.paint(x, y - 1, b);
    }
  } else if (GEM_COLORS[kind]) {
    const [a, b, c] = GEM_COLORS[kind];
    const spots = [[-3, -1], [2, -2], [0, 2]];
    for (const [dx, dy] of spots) {
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      pc.set(x, y - 1, b); pc.set(x, y, a); pc.set(x + 1, y, b); pc.set(x, y + 1, a); pc.set(x - 1, y, a); pc.set(x, y - 2, c);
    }
  }
  pc.outline((c) => outlineOf(c));
}

function drawBoulder(pc: PixelCanvas): void {
  rockBody(pc, 16, 19, 13, 10.5, 777);
  rockBody(pc, 11, 14, 6, 5, 778);
  pc.outline((c) => outlineOf(c));
}

/* ---------- Mato, galhos, grama alta, flores ---------- */
function drawWeed(pc: PixelCanvas, v: number, season: number): void {
  const pals: Color[][] = [
    [rgb('#1e4a24'), rgb('#2f7a34'), rgb('#4ea644'), rgb('#86d062')],
    [rgb('#1a4020'), rgb('#2a6a2e'), rgb('#44923c'), rgb('#76bc52')],
    [rgb('#4a2a10'), rgb('#86501a'), rgb('#c07a28'), rgb('#e8b04a')],
    [rgb('#4a4a5a'), rgb('#7a7486'), rgb('#a8a2b0'), rgb('#e6e6f0')],
  ];
  const c = pals[season];
  const cx = 8, base = 14;
  const rng = new Rng(500 + v * 11 + season);
  const leaves = 5 + v;
  for (let k = 0; k < leaves; k++) {
    const ang = -Math.PI / 2 + (k / (leaves - 1) - 0.5) * 2.4 + rng.range(-0.15, 0.15);
    const len = rng.range(5, 8);
    const ex = cx + Math.cos(ang) * len, ey = base + Math.sin(ang) * len;
    // folha: linha grossa com nervura
    const steps = Math.ceil(len * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = cx + (ex - cx) * t, y = base + (ey - base) * t;
      const wdt = Math.sin(t * Math.PI) * 1.6;
      for (let o = -wdt; o <= wdt; o += 0.5) {
        const px = Math.round(x + Math.cos(ang + Math.PI / 2) * o), py = Math.round(y + Math.sin(ang + Math.PI / 2) * o);
        pc.set(px, py, o < -0.4 ? c[3] : o > 0.6 ? c[1] : c[2]);
      }
    }
  }
  pc.outline((col) => outlineOf(col));
}

function drawTwig(pc: PixelCanvas, v: number): void {
  const a = v === 0 ? [2, 11, 13, 7] : [3, 7, 13, 12];
  pc.line(a[0], a[1], a[2], a[3], BARK[2]);
  pc.line(a[0], a[1] + 1, a[2], a[3] + 1, BARK[1]);
  const mx = Math.round((a[0] + a[2]) / 2), my = Math.round((a[1] + a[3]) / 2);
  pc.line(mx, my, mx + 2, my - 3, BARK[3]);
  pc.set(a[2], a[3] - 1, rgb('#62ad48'));
  pc.outline((c) => outlineOf(c));
}

function drawTallGrass(pc: PixelCanvas, v: number, season: number): void {
  const pals: Color[][] = [
    [rgb('#2c6a30'), rgb('#4a9a3c'), rgb('#7cc456')], [rgb('#245c2a'), rgb('#3c8434'), rgb('#68b048')],
    [rgb('#6a5a1e'), rgb('#9a8430'), rgb('#cdb44e')], [rgb('#6a7898'), rgb('#a8b4cc'), rgb('#e6edf6')],
  ];
  const c = pals[season];
  const rng = new Rng(600 + v * 5);
  for (let k = 0; k < 9; k++) {
    const x0 = 3 + rng.int(0, 10), h = rng.int(6, 11), lean = rng.range(-2.5, 2.5);
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const x = Math.round(x0 + lean * t * t), y = 15 - i;
      pc.set(x, y, t > 0.7 ? c[2] : t > 0.3 ? c[1] : c[0]);
    }
  }
  pc.outline((col) => withAlpha(outlineOf(col), 255));
}

function drawFlowers(pc: PixelCanvas, v: number): void {
  const cols = [P.flowerY, P.flowerP, P.flowerB, P.flowerW, P.flowerR];
  const rng = new Rng(700 + v);
  for (let k = 0; k < 4; k++) {
    const x = rng.int(3, 12), y = rng.int(5, 13);
    pc.line(x, y + 1, x, Math.min(15, y + 3), rgb('#2f7a34'));
    const c = cols[(v + k) % cols.length];
    pc.set(x - 1, y, c); pc.set(x + 1, y, c); pc.set(x, y - 1, c); pc.set(x, y + 1, mix(c, P.black, 0.25)); pc.set(x, y, P.flowerY === c ? rgb('#c8641e') : P.flowerY);
  }
  pc.outline((c) => outlineOf(c));
}

function drawBush(pc: PixelCanvas, season: number): void {
  canopy(pc, [{ x: 16, y: 11, r: 9 }, { x: 8, y: 18, r: 7.5 }, { x: 24, y: 18, r: 7.5 }, { x: 16, y: 20, r: 9 }], FOLIAGE[season], 900 + season, season === 3);
  if (season === 1) {
    const rng = new Rng(4);
    for (let k = 0; k < 6; k++) { const x = rng.int(6, 26), y = rng.int(6, 24); if (pc.get(x, y)) { pc.set(x, y, rgb('#4a5ad8')); pc.paint(x + 1, y, rgb('#2a3a9a')); } }
  }
  pc.outline((c) => outlineOf(c));
}

/** Sombras elípticas suaves. */
function drawShadow(pc: PixelCanvas): void {
  const cx = pc.w / 2, cy = pc.h / 2;
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
    const nx = (x + 0.5 - cx) / (pc.w / 2), ny = (y + 0.5 - cy) / (pc.h / 2);
    const d = nx * nx + ny * ny;
    if (d <= 1) pc.set(x, y, rgb('#1a0e14', d < 0.55 ? 90 : 60));
  }
}

export const TREE_TYPES = ['oak', 'maple', 'pine'] as const;
export const ROCK_KINDS = ['stone', 'copper', 'iron', 'gold', 'coal', 'quartz', 'amethyst', 'topaz', 'emerald', 'ruby', 'diamond'] as const;

export function addNature(ab: AtlasBuilder): void {
  for (let t = 0; t < 3; t++) for (let s = 0; s < 4; s++) ab.add(`tree_${TREE_TYPES[t]}_${s}`, 48, 80, (pc) => drawTree(pc, t, s));
  ab.add('stump_tree', 24, 20, (pc) => drawStump(pc, false));
  ab.add('stump_big', 32, 26, (pc) => drawStump(pc, true));
  for (let s = 0; s < 4; s++) {
    ab.add(`sapling0_${s}`, 16, 16, (pc) => drawSapling(pc, 0, s));
    ab.add(`sapling1_${s}`, 16, 24, (pc) => drawSapling(pc, 1, s));
    ab.add(`sapling2_${s}`, 32, 44, (pc) => drawSapling(pc, 2, s));
  }
  for (const k of ROCK_KINDS) for (let v = 0; v < 2; v++) ab.add(`rock_${k}_${v}`, 16, 16, (pc) => drawRock(pc, k, v));
  ab.add('boulder', 32, 32, drawBoulder);
  for (let s = 0; s < 4; s++) for (let v = 0; v < 3; v++) ab.add(`weed_${s}_${v}`, 16, 16, (pc) => drawWeed(pc, v, s));
  for (let v = 0; v < 2; v++) ab.add(`twig_${v}`, 16, 16, (pc) => drawTwig(pc, v));
  for (let s = 0; s < 4; s++) for (let v = 0; v < 2; v++) ab.add(`tallgrass_${s}_${v}`, 16, 16, (pc) => drawTallGrass(pc, v, s));
  for (let v = 0; v < 3; v++) ab.add(`flowers_${v}`, 16, 16, (pc) => drawFlowers(pc, v));
  for (let s = 0; s < 4; s++) ab.add(`bush_${s}`, 32, 30, (pc) => drawBush(pc, s));
  ab.add('shadow_s', 12, 5, drawShadow);
  ab.add('shadow_m', 22, 7, drawShadow);
  ab.add('shadow_l', 34, 10, drawShadow);
}
