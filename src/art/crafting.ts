import { PixelCanvas, rgb, outlineOf, type Color } from './pixel';
import { P } from './palette';
import type { AtlasBuilder } from './atlas';

function done(pc: PixelCanvas): void { pc.outline((c) => outlineOf(c)); }

/** Irrigadores: 0 básico (bronze/ferro), 1 qualidade (ouro), 2 avançado (diamante). */
function sprinkler(pc: PixelCanvas, tier: number): void {
  const body: [Color, Color, Color] = tier === 0 ? [P.copper0, P.copper2, P.copper3] : tier === 1 ? [P.goldT0, P.goldT1, P.goldT3] : [rgb('#3a2a6a'), rgb('#7a5ac8'), rgb('#c8b0ff')];
  pc.ellipse(8, 12, 6, 3, P.steel1);
  pc.ellipse(8, 11, 5, 2.5, P.steel2);
  pc.rect(6, 4, 4, 8, body[1]); pc.vline(6, 4, 11, body[2]); pc.vline(9, 4, 11, body[0]);
  pc.rect(4, 3, 8, 2, body[1]); pc.hline(4, 11, 3, body[2]);
  if (tier >= 1) { pc.set(3, 4, body[1]); pc.set(12, 4, body[1]); }
  if (tier === 2) { pc.set(8, 1, rgb('#b8f0ff')); pc.set(7, 2, rgb('#b8f0ff')); pc.set(8, 2, P.white); }
  pc.set(7, 6, P.water3); pc.set(8, 7, P.water2);
  done(pc);
}

function scarecrow(pc: PixelCanvas): void {
  pc.rect(7, 12, 2, 18, P.wood2); pc.vline(7, 12, 29, P.wood3);
  pc.rect(1, 14, 14, 2, P.wood1); // braços
  // camisa
  pc.rect(4, 13, 8, 9, rgb('#3a6ab8')); pc.rect(4, 13, 2, 9, rgb('#5a8ad8')); pc.rect(10, 13, 2, 9, rgb('#24448a'));
  pc.set(6, 16, rgb('#e0b040')); pc.set(9, 18, rgb('#e0b040')); // remendos
  for (const x of [1, 2, 13, 14]) pc.set(x, 16, rgb('#e8c870'));
  // cabeça de saco com chapéu de palha
  pc.ellipse(8, 9, 4, 4, rgb('#d8b878'));
  pc.set(6, 8, P.text); pc.set(10, 8, P.text); pc.hline(6, 10, 11, P.text);
  pc.ellipse(8, 5, 7, 2, rgb('#e8c870')); pc.rect(5, 1, 6, 4, rgb('#e8c870')); pc.hline(5, 10, 4, P.red);
  done(pc);
}

/** Cerca com conexões (máscara 4 bits: 1 N, 2 L, 4 S, 8 O). */
function fence(pc: PixelCanvas, mask: number): void {
  const post = () => { pc.rect(6, 4, 4, 11, P.wood2); pc.vline(6, 4, 14, P.wood3); pc.vline(9, 4, 14, P.wood1); pc.hline(6, 9, 4, P.wood4); };
  if (mask & 1) { pc.rect(7, 0, 2, 5, P.wood2); pc.vline(7, 0, 4, P.wood3); }
  if (mask & 8) { pc.rect(0, 6, 6, 2, P.wood3); pc.rect(0, 10, 6, 2, P.wood2); }
  if (mask & 2) { pc.rect(10, 6, 6, 2, P.wood3); pc.rect(10, 10, 6, 2, P.wood2); }
  post();
  done(pc);
}

function wheelbarrow(pc: PixelCanvas, full: boolean): void {
  pc.rect(2, 6, 12, 6, P.wood2); pc.hline(2, 13, 6, P.wood4); pc.hline(2, 13, 11, P.wood1);
  pc.line(13, 8, 16, 5, P.wood1);
  pc.circle(4, 13, 2.5, P.steel0); pc.set(4, 13, P.steel2);
  pc.vline(11, 12, 14, P.wood1);
  if (full) { pc.ellipse(6, 5, 3, 2.2, P.stone3); pc.ellipse(10, 5, 3, 2, P.stone2); pc.ellipse(8, 3.5, 2.5, 2, P.stone4); }
  done(pc);
}

function bait(pc: PixelCanvas): void {
  pc.ellipse(8, 10, 5, 4, rgb('#8a5a3a'));
  for (const [x, y] of [[6, 9], [9, 8], [10, 11], [7, 12]]) pc.set(x, y, rgb('#c8906a'));
  pc.line(4, 6, 7, 4, rgb('#d07a8a')); pc.line(7, 4, 10, 5, rgb('#d07a8a')); pc.set(10, 5, rgb('#a04a5a'));
  done(pc);
}

function pathIcon(pc: PixelCanvas): void {
  for (const [x, y, w, h] of [[2, 3, 5, 4], [8, 2, 6, 4], [3, 8, 6, 4], [10, 7, 4, 5], [5, 13, 6, 2]]) {
    pc.rect(x, y, w, h, P.stone2); pc.hline(x, x + w - 1, y, P.stone4); pc.hline(x, x + w - 1, y + h - 1, P.stone1);
  }
  done(pc);
}

function lantern(pc: PixelCanvas): void {
  pc.rect(7, 12, 2, 18, P.steel0); pc.rect(5, 28, 6, 3, P.steel1);
  pc.rect(4, 2, 8, 10, P.steel0); pc.rect(5, 3, 6, 8, rgb('#ffe9a0')); pc.rect(6, 4, 2, 3, P.white);
  pc.rect(3, 1, 10, 2, P.iron1); pc.rect(6, 0, 4, 1, P.iron2);
  done(pc);
}

/** Gota d'água do jato dos irrigadores. */
function spray(pc: PixelCanvas): void { pc.set(1, 0, P.foam); pc.rect(0, 1, 3, 2, P.waterHi); pc.set(1, 3, P.water3); }

export function addCrafting(ab: AtlasBuilder): void {
  for (let t = 0; t < 3; t++) {
    ab.add(`sprinkler_${t}`, 16, 16, (pc) => sprinkler(pc, t));
  }
  ab.add('scarecrow', 16, 32, scarecrow);
  ab.add('item_scarecrow', 16, 16, (pc) => { const t = new PixelCanvas(16, 32); scarecrow(t); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, t.get(x, y * 2)); });
  for (let m = 0; m < 16; m++) ab.add(`fencem_${m}`, 16, 16, (pc) => fence(pc, m));
  ab.add('item_fence', 16, 16, (pc) => fence(pc, 10));
  ab.add('wheelbarrow', 16, 16, (pc) => wheelbarrow(pc, false));
  ab.add('wheelbarrow_full', 16, 16, (pc) => wheelbarrow(pc, true));
  ab.add('item_wheelbarrow', 16, 16, (pc) => wheelbarrow(pc, false));
  ab.add('item_bait', 16, 16, bait);
  ab.add('item_path', 16, 16, pathIcon);
  ab.add('lantern', 16, 32, lantern);
  ab.add('item_lantern', 16, 16, (pc) => { const t = new PixelCanvas(16, 32); lantern(t); pc.blit(t, 0, 0, false, 0, 0, 16, 16); });
  ab.add('spray', 3, 4, spray);
  for (let t = 0; t < 3; t++) ab.add(`item_sprinkler_${t}`, 16, 16, (pc) => sprinkler(pc, t));
}
