import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P } from './palette';
import { shingleRoof, planks, windowAt, stoneBase } from './buildings';
import type { AtlasBuilder } from './atlas';

function done(pc: PixelCanvas): void { pc.outline((c) => outlineOf(c)); }

type Pose = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'eat0' | 'eat1' | 'sleep';
export const ANIMAL_POSES: Pose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'eat0', 'eat1', 'sleep'];

/* ---------- Galinha (16x16, de lado olhando para a direita) ---------- */
function chicken(pc: PixelCanvas, pose: Pose, brown: boolean): void {
  const b = brown ? [rgb('#7a4a22'), rgb('#a8682e'), rgb('#d08e48')] : [rgb('#c8c0b8'), rgb('#f0ece4'), rgb('#ffffff')];
  const sleep = pose === 'sleep';
  const bob = pose === 'walk1' || pose === 'walk3' ? -1 : 0;
  const by = (sleep ? 2 : 0) + bob;
  // pernas
  if (!sleep) {
    const step = pose === 'walk0' ? 1 : pose === 'walk2' ? -1 : 0;
    pc.vline(6 + step, 12, 14, P.copper2); pc.vline(9 - step, 12, 14, P.copper2);
    pc.set(7 + step, 14, P.copper2); pc.set(10 - step, 14, P.copper2);
  }
  // corpo
  pc.ellipse(7, 9.5 + by, 5, 3.8, b[1]);
  for (let y = 5; y < 15; y++) for (let x = 1; x < 13; x++) if (pc.get(x, y) === b[1] && (y > 10 + by || x < 4)) pc.set(x, y, b[0]);
  // rabo
  pc.set(2, 6 + by, b[1]); pc.set(1, 5 + by, b[2]); pc.set(2, 5 + by, b[1]); pc.set(3, 6 + by, b[1]);
  // asa
  pc.line(5, 9 + by, 9, 9 + by, b[0]); pc.line(5, 10 + by, 8, 10 + by, b[0]);
  // cabeça
  const eat = pose === 'eat0' || pose === 'eat1';
  const hx = eat ? 12 : 11, hy = eat ? (pose === 'eat1' ? 11 : 9) + by : 5 + by + (pose === 'idle1' ? 1 : 0);
  pc.ellipse(hx + 0.5, hy + 0.5, 2.2, 2.2, b[1]);
  pc.set(hx, hy - 2, P.red); pc.set(hx + 1, hy - 2, P.red); pc.set(hx - 1, hy - 1, P.red);
  pc.set(hx + 3, hy + 1, P.gold2); pc.set(hx + 3, hy, P.gold1);
  pc.set(hx + 1, hy + 2, P.red);
  if (sleep) pc.hline(hx, hx + 1, hy, P.text); else pc.set(hx + 1, hy, P.text);
  done(pc);
}

/* ---------- Vaca (32x32, de lado olhando para a direita) ---------- */
function cow(pc: PixelCanvas, pose: Pose, brown: boolean): void {
  const w0 = rgb('#c8c0bc'), w1 = rgb('#f2eeea'), w2 = rgb('#ffffff');
  const spot = brown ? rgb('#7a4a2a') : rgb('#2a2228'), spot2 = brown ? rgb('#a86a3a') : rgb('#4a3e46');
  const sleep = pose === 'sleep';
  const bob = pose === 'walk1' || pose === 'walk3' ? -1 : 0;
  const by = (sleep ? 5 : 0) + bob;
  // pernas
  if (!sleep) {
    const s = pose === 'walk0' ? 1 : pose === 'walk2' ? -1 : 0;
    const legs: [number, number][] = [[9 + s, 0], [13 - s, 1], [21 + s, 0], [25 - s, 1]];
    for (const [x, back] of legs) {
      pc.rect(x, 22, 3, 6, back ? w0 : w1);
      pc.rect(x, 27, 3, 2, rgb('#3a2a22'));
    }
  }
  // corpo
  for (let y = 11; y <= 23; y++) for (let x = 6; x <= 27; x++) {
    const nx = (x + 0.5 - 16.5) / 11, ny = (y + 0.5 - 17) / 6.5;
    if (nx * nx * nx * nx + ny * ny * ny * ny > 1) continue;
    const l = -(nx * 0.4 + ny * 0.9);
    pc.set(x, y + by, l > 0.45 ? w2 : l > -0.4 ? w1 : w0);
  }
  // manchas
  for (const [cx, cy, r] of [[12, 15, 3], [20, 19, 2.6], [23, 14, 2], [9, 20, 1.8]] as [number, number, number][]) {
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      if (x * x + y * y * 1.3 > r * r) continue;
      const px = cx + x, py = cy + y + by;
      if (pc.get(px, py)) pc.set(px, py, y < 0 ? spot2 : spot);
    }
  }
  // úbere
  if (!sleep) { pc.rect(17, 22 + by, 5, 2, rgb('#f0a0b0')); pc.set(18, 24 + by, rgb('#e07a90')); pc.set(20, 24 + by, rgb('#e07a90')); }
  // rabo
  pc.line(6, 13 + by, 4, 19 + by, w0); pc.set(4, 20 + by, spot);
  // cabeça
  const eat = pose === 'eat0' || pose === 'eat1';
  const hx = 25, hy = (eat ? (pose === 'eat1' ? 20 : 18) : 9 + (pose === 'idle1' ? 1 : 0)) + by;
  pc.rect(hx, hy, 6, 7, w1); pc.vline(hx, hy, hy + 6, w0); pc.hline(hx + 1, hx + 5, hy, w2);
  pc.rect(hx + 2, hy + 5, 5, 3, rgb('#f0a0b0')); pc.set(hx + 3, hy + 6, rgb('#a85a6a')); pc.set(hx + 5, hy + 6, rgb('#a85a6a'));
  pc.set(hx - 1, hy + 1, spot); pc.set(hx - 2, hy + 1, spot); // orelha
  pc.set(hx + 1, hy - 1, rgb('#e8dcc8')); pc.set(hx + 4, hy - 1, rgb('#e8dcc8')); // chifres
  if (sleep) pc.hline(hx + 3, hx + 4, hy + 2, P.text); else { pc.set(hx + 4, hy + 2, P.text); pc.set(hx + 4, hy + 3, P.text); }
  if (!eat) for (let x = 0; x < 3; x++) pc.set(hx + 1 + x, hy + 4, spot2);
  done(pc);
}

/* ---------- Produtos e itens ---------- */
function egg(pc: PixelCanvas, big: boolean, brown: boolean): void {
  const c = brown ? [rgb('#a8683a'), rgb('#d8a070'), rgb('#f0c898')] : [rgb('#d8d0c4'), rgb('#f6f2ea'), rgb('#ffffff')];
  const r = big ? 5.5 : 4.5;
  for (let y = -8; y <= 8; y++) for (let x = -7; x <= 7; x++) {
    const ny = y / (r * 1.25), nx = x / (r * (1 - (y < 0 ? -y * 0.03 : 0)));
    if (nx * nx + ny * ny > 1) continue;
    const l = -(nx * 0.6 + ny * 0.8);
    pc.set(8 + x, 9 + y, l > 0.5 ? c[2] : l > -0.3 ? c[1] : c[0]);
  }
  done(pc);
}
function milk(pc: PixelCanvas, big: boolean): void {
  const h = big ? 11 : 9;
  pc.rect(4, 15 - h, 8, h, P.white); pc.vline(4, 15 - h, 14, rgb('#e6eef6')); pc.vline(11, 15 - h, 14, rgb('#c8d4e2'));
  pc.rect(6, 12 - h, 4, 3, P.white); pc.rect(6, 11 - h, 4, 1, rgb('#4a90d8'));
  pc.rect(5, 15 - Math.floor(h * 0.55), 6, 3, rgb('#4a90d8')); pc.set(7, 16 - Math.floor(h * 0.55), P.white);
  if (big) pc.set(10, 6, P.gold2);
  done(pc);
}
function hay(pc: PixelCanvas): void {
  const c = [rgb('#a8862a'), rgb('#d8b84a'), rgb('#f0d878')];
  for (let k = 0; k < 14; k++) { const x = 2 + (k * 5) % 12, y = 4 + (k * 3) % 8; pc.line(x, y, x + 4, y + 6, c[k % 3]); }
  pc.hline(4, 12, 9, rgb('#8a5a2a')); pc.hline(4, 12, 10, rgb('#8a5a2a'));
  done(pc);
}
function trough(pc: PixelCanvas, full: boolean): void {
  pc.rect(1, 6, 14, 8, P.wood2); pc.hline(1, 14, 6, P.wood4); pc.rect(2, 7, 12, 3, P.wood0);
  if (full) for (let x = 2; x < 14; x++) { pc.set(x, 7 - (x % 3 === 0 ? 1 : 0), rgb('#d8b84a')); pc.set(x, 8, rgb('#a8862a')); }
  pc.rect(2, 14, 2, 2, P.wood1); pc.rect(12, 14, 2, 2, P.wood1);
  done(pc);
}
function heart(pc: PixelCanvas, full: boolean): void {
  const rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') pc.set(x + 1, y + 1, full ? (y === 0 || (y === 1 && x < 3) ? rgb('#ff9aa8') : P.red) : rgb('#5a3a3a')); });
  pc.outline(() => P.uiOut);
}

/* ---------- Construções ---------- */
function coop(pc: PixelCanvas, big: boolean): void {
  const W = 80;
  planks(pc, 6, 40, 68, 30, [P.wall0, P.wall1, P.wall2, P.wall3]);
  stoneBase(pc, 4, 70, 72, 6);
  shingleRoof(pc, 0, 6, W, 36, 10, [rgb('#3a2a1a'), rgb('#5a3e24'), rgb('#7a5530'), rgb('#9a7040')]);
  pc.rect(0, 40, W, 2, rgb('#3a2a1a'));
  // porta pequena com rampa
  pc.rect(32, 52, 16, 18, P.wood0); pc.rect(34, 54, 12, 16, rgb('#2a1a10'));
  for (let i = 0; i < 6; i++) pc.hline(30 - i, 49 + i, 70 + i, i % 2 ? P.wood2 : P.wood3);
  windowAt(pc, 12, 48, 12, 10, false);
  windowAt(pc, 56, 48, 12, 10, false);
  if (big) { pc.rect(28, 28, 24, 10, P.wood3); pc.rect(30, 30, 20, 6, P.parch2); pc.set(38, 32, P.gold2); pc.set(41, 32, P.gold2); }
  else { pc.rect(34, 30, 12, 8, P.wood3); pc.rect(36, 32, 8, 4, P.parch2); }
  // galinha pintada na placa
  pc.set(39, 33, P.red); pc.set(40, 34, P.white);
  done(pc);
}
function barn(pc: PixelCanvas, big: boolean): void {
  const W = 112;
  const red = [rgb('#5a1a14'), rgb('#8a2a20'), rgb('#b03a2a'), rgb('#cc5a40')] as [Color, Color, Color, Color];
  planks(pc, 8, 46, 96, 52, red);
  stoneBase(pc, 6, 98, 100, 8);
  shingleRoof(pc, 0, 8, W, 40, 14, [rgb('#2a2a34'), rgb('#3a3a48'), rgb('#4e4e60'), rgb('#6a6a7e')]);
  pc.rect(0, 46, W, 2, rgb('#2a2a34'));
  // portão grande com X branco
  pc.rect(40, 62, 32, 36, P.white); pc.rect(42, 64, 28, 34, red[1]);
  pc.line(42, 64, 69, 97, P.white); pc.line(69, 64, 42, 97, P.white); pc.vline(56, 64, 97, P.white);
  // janela do sótão
  pc.rect(48, 22, 16, 14, P.white); pc.rect(50, 24, 12, 10, rgb('#2a1a10')); pc.line(50, 24, 61, 33, P.white);
  windowAt(pc, 16, 64, 14, 12, false);
  windowAt(pc, 82, 64, 14, 12, false);
  if (big) { pc.rect(4, 40, 104, 3, P.white); }
  done(pc);
}
function construction(pc: PixelCanvas): void {
  const w = pc.w, h = pc.h;
  // estrutura de madeira e tábuas empilhadas
  for (let x = 4; x < w - 4; x += 12) pc.rect(x, 8, 3, h - 12, P.wood2);
  pc.rect(2, 8, w - 4, 3, P.wood3); pc.rect(2, Math.floor(h / 2), w - 4, 3, P.wood2);
  pc.line(4, h - 6, w - 6, 10, P.wood1);
  for (let i = 0; i < 4; i++) pc.rect(w - 30, h - 6 - i * 3, 22, 3, i % 2 ? P.wood3 : P.wood2);
  pc.ellipse(14, h - 6, 8, 4, P.stone2); pc.ellipse(14, h - 8, 5, 3, P.stone3);
  // placa "em obras"
  pc.rect(Math.floor(w / 2) - 10, h - 20, 20, 10, P.yellow); for (let x = 0; x < 20; x += 4) pc.rect(Math.floor(w / 2) - 10 + x, h - 20, 2, 10, P.text);
  done(pc);
}

export function addAnimals(ab: AtlasBuilder): void {
  for (const v of [0, 1]) for (const p of ANIMAL_POSES) {
    ab.add(`chicken${v}_s_${p}`, 16, 16, (pc) => chicken(pc, p, v === 1));
    ab.add(`chicken${v}_l_${p}`, 16, 16, (pc) => { const t = new PixelCanvas(16, 16); chicken(t, p, v === 1); pc.blit(t, 0, 0, true); });
    ab.add(`cow${v}_s_${p}`, 32, 32, (pc) => cow(pc, p, v === 1));
    ab.add(`cow${v}_l_${p}`, 32, 32, (pc) => { const t = new PixelCanvas(32, 32); cow(t, p, v === 1); pc.blit(t, 0, 0, true); });
  }
  ab.add('item_egg', 16, 16, (pc) => egg(pc, false, false));
  ab.add('item_big_egg', 16, 16, (pc) => egg(pc, true, false));
  ab.add('item_egg_brown', 16, 16, (pc) => egg(pc, false, true));
  ab.add('item_milk', 16, 16, (pc) => milk(pc, false));
  ab.add('item_big_milk', 16, 16, (pc) => milk(pc, true));
  ab.add('item_hay', 16, 16, hay);
  ab.add('trough', 16, 16, (pc) => trough(pc, false));
  ab.add('trough_full', 16, 16, (pc) => trough(pc, true));
  ab.add('heart_full', 9, 8, (pc) => heart(pc, true));
  ab.add('heart_empty', 9, 8, (pc) => heart(pc, false));
  ab.add('coop', 80, 78, (pc) => coop(pc, false));
  ab.add('coop_big', 80, 78, (pc) => coop(pc, true));
  ab.add('barn', 112, 108, (pc) => barn(pc, false));
  ab.add('barn_big', 112, 108, (pc) => barn(pc, true));
  ab.add('build_coop', 80, 52, construction);
  ab.add('build_barn', 112, 68, construction);
  ab.add('icon_coop', 16, 16, (pc) => { const t = new PixelCanvas(80, 78); coop(t, false); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, t.get(x * 5, y * 5)); });
  ab.add('icon_barn', 16, 16, (pc) => { const t = new PixelCanvas(112, 108); barn(t, false); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, t.get(x * 7, y * 7)); });
  void mix;
}
