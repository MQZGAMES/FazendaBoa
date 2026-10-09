import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P } from './palette';
import { Rng } from './rng';
import { CROPS, CROP_STAGES, type CropDef } from '../data/crops';
import type { AtlasBuilder } from './atlas';

type Pal3 = [Color, Color, Color];
const LEAF: Pal3 = [rgb('#2a6a2e'), rgb('#45963c'), rgb('#78c456')];
const STEM = rgb('#3a7a30');

function pal(h: [string, string, string]): Pal3 { return [rgb(h[0]), rgb(h[1]), rgb(h[2])]; }

/** Folha pontuda a partir de (x,y) num ângulo. */
function leaf(pc: PixelCanvas, x: number, y: number, ang: number, len: number, wid: number, c: Pal3): void {
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x + Math.cos(ang) * len * t, cy = y + Math.sin(ang) * len * t;
    const w = Math.sin(Math.min(1, t * 1.3) * Math.PI) * wid;
    for (let o = -w; o <= w; o += 0.5) {
      const px = Math.round(cx + Math.cos(ang + Math.PI / 2) * o), py = Math.round(cy + Math.sin(ang + Math.PI / 2) * o);
      pc.set(px, py, o < -w * 0.3 ? c[2] : o > w * 0.4 ? c[0] : c[1]);
    }
  }
}

function blob(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, c: Pal3): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const l = -(nx * 0.6 + ny * 0.8);
    pc.set(x, y, l > 0.45 ? c[2] : l > -0.35 ? c[1] : c[0]);
  }
}

const BASE = 29; // linha do solo no frame 16x32

function seeds(pc: PixelCanvas): void {
  const c = rgb('#d8b878'), d = rgb('#8a6a3a');
  for (const [x, y] of [[5, BASE - 1], [8, BASE - 2], [11, BASE - 1], [7, BASE]]) { pc.set(x, y, c); pc.set(x + 1, y, d); }
}

function sprout(pc: PixelCanvas, h: number, n: number, leafC: Pal3): void {
  pc.vline(8, BASE - h, BASE, STEM);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const y = BASE - h + Math.floor(i / 2) * 2;
    leaf(pc, 8, y, side < 0 ? -Math.PI * 0.85 : -Math.PI * 0.15, 2 + h * 0.35, 1 + h * 0.08, leafC);
  }
}

function drawPlant(pc: PixelCanvas, def: CropDef, stage: number): void {
  const prod = pal(def.color);
  const lf = def.leaf ? pal(def.leaf) : LEAF;
  if (stage === 0) { seeds(pc); pc.outline((c) => outlineOf(c)); return; }
  if (stage === 1) { sprout(pc, 2, 2, lf); pc.outline((c) => outlineOf(c)); return; }
  if (stage === 2) { sprout(pc, 4, 3, lf); pc.outline((c) => outlineOf(c)); return; }
  const ready = stage === CROP_STAGES - 1;
  const big = stage >= 4;
  const rng = new Rng(def.id.length * 31 + stage);
  switch (def.look) {
    case 'root': {
      const n = big ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2;
        leaf(pc, 8, BASE - 1, a, big ? 9 : 6, 1.6, lf);
      }
      if (ready) {
        blob(pc, 8, BASE - 1, def.id === 'potato' ? 4 : 3.5, 2.5, prod);
        if (def.id === 'potato') { pc.set(6, BASE, prod[0]); pc.set(10, BASE - 1, prod[0]); }
      }
      break;
    }
    case 'bush': {
      pc.vline(8, BASE - 9, BASE, STEM);
      const puffs: [number, number, number][] = big
        ? [[8, BASE - 10, 5], [4, BASE - 6, 4], [12, BASE - 6, 4], [8, BASE - 4, 4.5]]
        : [[8, BASE - 7, 4], [5, BASE - 4, 3], [11, BASE - 4, 3]];
      for (const [x, y, r] of puffs) blob(pc, x, y, r, r * 0.9, lf);
      for (let k = 0; k < 10; k++) { const x = rng.int(3, 13), y = rng.int(BASE - 13, BASE - 2); if (pc.get(x, y)) pc.set(x, y, lf[0]); }
      if (ready) {
        const spots: [number, number][] = [[4, BASE - 7], [10, BASE - 9], [12, BASE - 4], [6, BASE - 3], [9, BASE - 5]];
        for (const [x, y] of spots) {
          if (def.id === 'eggplant') { pc.rect(x, y, 2, 4, prod[1]); pc.set(x, y + 3, prod[0]); pc.set(x, y, prod[2]); pc.set(x, y - 1, lf[0]); }
          else if (def.id === 'blueberry') { pc.set(x, y, prod[1]); pc.set(x + 1, y, prod[0]); pc.set(x, y + 1, prod[0]); pc.set(x + 1, y - 1, prod[2]); }
          else { pc.rect(x, y, 2, 2, prod[1]); pc.set(x, y, prod[2]); pc.set(x + 1, y + 1, prod[0]); }
        }
      }
      break;
    }
    case 'tall': {
      const h = big ? 22 : 14;
      if (def.id === 'tomato') { pc.vline(4, BASE - h + 2, BASE, P.wood2); pc.vline(12, BASE - h + 2, BASE, P.wood2); }
      pc.vline(8, BASE - h, BASE, STEM); pc.vline(9, BASE - h + 2, BASE, mix(STEM, P.black, 0.2));
      for (let i = 0; i < (big ? 7 : 4); i++) {
        const y = BASE - 3 - i * 3;
        const side = i % 2 === 0 ? -1 : 1;
        leaf(pc, 8.5, y, side < 0 ? -Math.PI * 0.85 + 0.2 : -Math.PI * 0.15 - 0.2, def.id === 'corn' ? 7 : 5, def.id === 'corn' ? 1.2 : 1.8, lf);
      }
      if (ready) {
        if (def.id === 'corn') {
          for (const [x, y] of [[10, BASE - 14], [5, BASE - 10]] as [number, number][]) {
            pc.rect(x, y, 2, 5, prod[1]); pc.set(x, y, prod[2]); pc.vline(x + 1, y + 1, y + 4, prod[0]);
            pc.set(x - 1, y + 3, lf[1]); pc.set(x + 2, y + 4, lf[1]);
          }
          pc.set(8, BASE - h - 1, prod[2]); pc.set(7, BASE - h, prod[1]); pc.set(9, BASE - h, prod[1]);
        } else {
          for (const [x, y] of [[5, BASE - 15], [10, BASE - 11], [5, BASE - 7], [11, BASE - 18]] as [number, number][]) blob(pc, x, y, 1.8, 1.8, prod);
        }
      }
      break;
    }
    case 'vine': {
      // treliça
      pc.vline(3, BASE - 22, BASE, P.wood2); pc.vline(13, BASE - 22, BASE, P.wood2);
      pc.hline(3, 13, BASE - 20, P.wood3); pc.hline(3, 13, BASE - 12, P.wood3);
      const h = big ? 20 : 12;
      for (let i = 0; i < h; i += 3) {
        blob(pc, 6 + (i % 6 === 0 ? 0 : 4), BASE - 2 - i, 3, 2.5, lf);
      }
      if (ready) {
        for (const [x, y] of [[6, BASE - 15], [10, BASE - 9], [5, BASE - 6]] as [number, number][]) {
          for (const [dx, dy] of [[0, 0], [2, 0], [1, 1], [-1, 1], [1, 2], [0, 3], [2, 2]]) { pc.set(x + dx, y + dy, prod[1]); }
          pc.set(x, y, prod[2]); pc.set(x + 1, y + 2, prod[0]); pc.set(x + 1, y - 1, STEM);
        }
      }
      break;
    }
    case 'ground': {
      const n = big ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        leaf(pc, 8, BASE - 3, a, big ? 7 : 5, 2.2, lf);
      }
      if (ready) {
        if (def.id === 'cauliflower') {
          blob(pc, 8, BASE - 5, 5, 4, prod);
          for (let k = 0; k < 8; k++) pc.paint(rng.int(4, 12), rng.int(BASE - 8, BASE - 2), prod[0]);
        } else if (def.id === 'melon') {
          blob(pc, 8, BASE - 4, 6, 4.5, prod);
          for (let x = 4; x <= 12; x += 3) pc.line(x, BASE - 8, x + 1, BASE - 1, prod[0]);
          pc.paint(5, BASE - 7, prod[2]);
        } else {
          blob(pc, 8, BASE - 4, 6.5, 5, prod);
          for (const x of [5, 8, 11]) pc.line(x, BASE - 8, x, BASE, prod[0]);
          pc.rect(7, BASE - 10, 2, 2, rgb('#5a3a1a'));
        }
      }
      break;
    }
    case 'flower': break;
  }
  pc.outline((c) => outlineOf(c));
}

function drawDead(pc: PixelCanvas): void {
  const c: Pal3 = [rgb('#5a3a1a'), rgb('#8a6a3a'), rgb('#b8945a')];
  pc.vline(8, BASE - 7, BASE, c[0]);
  leaf(pc, 8, BASE - 5, -Math.PI * 0.9, 5, 1.2, c);
  leaf(pc, 8, BASE - 3, -Math.PI * 0.1, 5, 1.2, c);
  leaf(pc, 8, BASE - 7, Math.PI * 0.2, 3, 1, c);
  pc.outline((c2) => outlineOf(c2));
}

/* ---------- Ícones do produto ---------- */
function produceIcon(pc: PixelCanvas, def: CropDef): void {
  const p = pal(def.color);
  switch (def.id) {
    case 'parsnip': {
      const body: [number, number, number][] = [[7, 6, 3], [7, 7, 3.5], [7, 8, 3.5], [7, 9, 3], [7, 10, 2.5], [7, 11, 2], [8, 12, 1.5], [8, 13, 1]];
      for (const [cx, y, r] of body) for (let x = Math.floor(cx - r); x <= cx + r; x++) pc.set(x, y, x < cx - 1 ? p[2] : x > cx + 1 ? p[0] : p[1]);
      pc.line(7, 5, 5, 1, LEAF[1]); pc.line(8, 5, 9, 1, LEAF[2]); pc.line(8, 5, 11, 2, LEAF[1]);
      break;
    }
    case 'potato': blob(pc, 8, 9, 6, 4.5, p); pc.set(6, 8, p[0]); pc.set(10, 10, p[0]); pc.set(9, 7, p[0]); break;
    case 'cauliflower':
      leaf(pc, 8, 12, Math.PI * 0.85, 6, 2, LEAF); leaf(pc, 8, 12, Math.PI * 0.15, 6, 2, LEAF);
      blob(pc, 8, 8, 5.5, 4.5, p); pc.set(6, 7, p[0]); pc.set(9, 9, p[0]); pc.set(11, 7, p[0]);
      break;
    case 'strawberry':
      for (let y = 5; y < 15; y++) { const w = y < 8 ? 5 : 5 - (y - 8) * 0.75; for (let x = Math.round(8 - w); x <= Math.round(8 + w - 1); x++) pc.set(x, y, x < 7 ? p[2] : x > 10 ? p[0] : p[1]); }
      for (const [x, y] of [[5, 7], [8, 8], [11, 7], [7, 11], [9, 10]]) pc.set(x, y, P.flowerY);
      pc.rect(6, 3, 5, 2, LEAF[1]); pc.set(8, 2, LEAF[0]);
      break;
    case 'tomato':
      blob(pc, 8, 9, 6, 5, p); pc.rect(6, 3, 5, 2, LEAF[1]); pc.set(8, 2, LEAF[0]); pc.set(5, 6, p[2]);
      break;
    case 'blueberry':
      blob(pc, 5, 10, 3, 3, p); blob(pc, 11, 10, 3, 3, p); blob(pc, 8, 6, 3, 3, p);
      pc.set(5, 9, p[0]); pc.set(11, 9, p[0]); pc.set(8, 5, p[0]);
      break;
    case 'melon':
      blob(pc, 8, 9, 6.5, 5.5, p);
      for (let x = 3; x <= 13; x += 3) pc.line(x, 5, x + 1, 13, p[0]);
      pc.set(5, 6, p[2]); pc.set(6, 5, p[2]);
      break;
    case 'corn':
      pc.rect(6, 2, 4, 11, p[1]); pc.vline(9, 3, 12, p[0]); pc.vline(6, 2, 12, p[2]);
      for (let y = 3; y < 12; y += 2) pc.hline(6, 9, y, p[0]);
      leaf(pc, 7, 14, -Math.PI * 0.62, 9, 1.6, LEAF); leaf(pc, 9, 14, -Math.PI * 0.38, 9, 1.6, LEAF);
      break;
    case 'pumpkin':
      blob(pc, 8, 9, 7, 5.5, p);
      for (const x of [5, 8, 11]) pc.vline(x, 5, 13, p[0]);
      pc.rect(7, 2, 2, 3, rgb('#5a3a1a'));
      break;
    case 'eggplant':
      for (let y = 4; y < 15; y++) { const w = 2 + Math.sin(((y - 4) / 11) * Math.PI) * 2.5; for (let x = Math.round(8 - w); x <= Math.round(8 + w); x++) pc.set(x, y, x < 7 ? p[2] : x > 9 ? p[0] : p[1]); }
      pc.rect(6, 2, 5, 3, LEAF[1]); pc.set(8, 1, LEAF[0]);
      break;
    case 'grape':
      for (const [x, y] of [[5, 5], [8, 5], [11, 5], [6, 8], [9, 8], [12, 8], [7, 11], [10, 11], [8, 14]]) blob(pc, x, y, 1.8, 1.8, p);
      pc.line(8, 1, 8, 4, STEM); leaf(pc, 9, 2, -0.3, 4, 1.4, LEAF);
      break;
  }
  pc.outline((c) => outlineOf(c));
}

function seedIcon(pc: PixelCanvas, def: CropDef): void {
  const p = pal(def.color);
  pc.rect(3, 2, 10, 13, P.parch2);
  pc.hline(3, 12, 2, P.parch3); pc.vline(3, 2, 14, P.parch3); pc.vline(12, 3, 14, P.parch0); pc.hline(4, 12, 14, P.parch0);
  pc.hline(3, 12, 4, P.parch1);
  blob(pc, 8, 9.5, 3, 3, p);
  pc.set(8, 6, LEAF[1]); pc.set(9, 5, LEAF[2]);
  pc.outline((c) => outlineOf(c));
}

function star(pc: PixelCanvas, c: Pal3): void {
  const pts: [number, number][] = [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [3, 3], [0, 4], [4, 4]];
  for (const [x, y] of pts) pc.set(x + 1, y + 1, c[1]);
  pc.set(3, 2, c[2]);
  pc.outline(() => c[0]);
}

export function addCrops(ab: AtlasBuilder): void {
  for (const def of CROPS) {
    for (let s = 0; s < CROP_STAGES; s++) ab.add(`crop_${def.id}_${s}`, 16, 32, (pc) => drawPlant(pc, def, s));
    ab.add(`item_${def.id}`, 16, 16, (pc) => produceIcon(pc, def));
    ab.add(`item_${def.seed}`, 16, 16, (pc) => seedIcon(pc, def));
  }
  ab.add('crop_dead', 16, 32, drawDead);
  ab.add('star_1', 7, 7, (pc) => star(pc, [rgb('#4a4a5a'), rgb('#c8d0dc'), rgb('#ffffff')]));
  ab.add('star_2', 7, 7, (pc) => star(pc, [rgb('#7a4a08'), rgb('#ffcf40'), rgb('#fff6b0')]));
}
