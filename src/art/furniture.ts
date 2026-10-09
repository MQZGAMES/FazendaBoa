import { PixelCanvas, rgb, outlineOf } from './pixel';
import { P } from './palette';
import type { AtlasBuilder } from './atlas';

function done(pc: PixelCanvas): void { pc.outline((c) => outlineOf(c)); }

function bed(pc: PixelCanvas): void {
  // cabeceira
  pc.rect(1, 2, 30, 12, P.wood2); pc.hline(1, 30, 2, P.wood4); pc.rect(1, 3, 30, 1, P.wood3);
  for (const x of [1, 29]) pc.rect(x, 0, 2, 14, P.wood1);
  pc.rect(3, 5, 26, 7, P.wood1);
  // colchão e lençol
  pc.rect(2, 12, 28, 22, rgb('#f2ecdc'));
  pc.rect(4, 13, 11, 6, P.white); pc.rect(17, 13, 11, 6, P.white); pc.hline(4, 14, 18, rgb('#d8d0c0')); pc.hline(17, 27, 18, rgb('#d8d0c0'));
  // cobertor xadrez
  const b0 = rgb('#3a6ab8'), b1 = rgb('#5a8ad8'), b2 = rgb('#8ab4f0');
  for (let y = 20; y < 34; y++) for (let x = 2; x < 30; x++) {
    const ch = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
    pc.set(x, y, y === 20 ? b2 : ch ? b1 : b0);
  }
  pc.hline(2, 29, 33, rgb('#24448a'));
  pc.rect(1, 34, 30, 3, P.wood1); pc.hline(1, 30, 34, P.wood3);
  done(pc);
}

function tv(pc: PixelCanvas): void {
  // móvel
  pc.rect(1, 14, 14, 11, P.wood2); pc.hline(1, 14, 14, P.wood4); pc.rect(3, 17, 10, 3, P.wood1); pc.rect(3, 21, 10, 3, P.wood1);
  // aparelho
  pc.rect(2, 2, 12, 12, rgb('#4a4450')); pc.hline(2, 13, 2, rgb('#6a6474'));
  pc.rect(3, 4, 8, 8, rgb('#1e2a2e')); pc.rect(4, 5, 3, 2, rgb('#3a5a5e'));
  pc.set(12, 5, P.red); pc.set(12, 8, P.steel2); pc.set(12, 10, P.steel2);
  pc.line(5, 1, 3, -1, P.steel1); pc.line(9, 1, 11, -1, P.steel1);
  done(pc);
}

function table(pc: PixelCanvas): void {
  pc.rect(1, 2, 30, 12, P.wood3); pc.hline(1, 30, 2, P.wood4); pc.hline(1, 30, 13, P.wood1);
  for (let x = 1; x < 31; x += 6) pc.vline(x, 3, 12, P.wood2);
  pc.rect(2, 14, 3, 7, P.wood1); pc.rect(27, 14, 3, 7, P.wood1);
  // vaso com flores
  pc.rect(13, -2 + 2, 6, 5, rgb('#d8d8e8')); pc.set(14, 0, P.flowerR); pc.set(16, -1 + 1, P.flowerY); pc.set(18, 0, P.flowerP);
  done(pc);
}

function chair(pc: PixelCanvas): void {
  pc.rect(3, 1, 10, 10, P.wood2); pc.hline(3, 12, 1, P.wood4); pc.rect(5, 3, 6, 6, P.wood1);
  pc.rect(2, 11, 12, 3, P.wood3); pc.rect(3, 14, 2, 6, P.wood1); pc.rect(11, 14, 2, 6, P.wood1);
  done(pc);
}

function rug(pc: PixelCanvas): void {
  const c0 = rgb('#7a2a2a'), c1 = rgb('#a84a3a'), c2 = rgb('#d8a85a');
  pc.ellipse(24, 16, 23.5, 15.5, c0);
  pc.ellipse(24, 16, 20, 12, c1);
  pc.ellipse(24, 16, 15, 8, c2);
  pc.ellipse(24, 16, 11, 5, c1);
  pc.ellipse(24, 16, 5, 2.5, c2);
}

function fireplace(pc: PixelCanvas): void {
  // pedra
  for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) {
    const row = Math.floor(y / 4), off = (row % 2) * 4;
    let c = P.stone2;
    if (y % 4 === 3 || (x + off) % 8 === 0) c = P.stone1; else if (y % 4 === 0) c = P.stone3;
    pc.set(x, y, c);
  }
  pc.rect(0, 12, 32, 3, P.wood2); pc.hline(0, 31, 12, P.wood4);
  // boca
  pc.rect(7, 20, 18, 20, rgb('#1a0e0a'));
  pc.ellipse(16, 20, 9, 4, rgb('#1a0e0a'));
  // lenha e fogo
  pc.rect(9, 35, 14, 3, P.wood1);
  pc.ellipse(16, 31, 5, 5, rgb('#f2802a')); pc.ellipse(16, 32, 3, 3, rgb('#ffd04a')); pc.set(16, 26, rgb('#f2802a')); pc.set(13, 28, rgb('#f2802a'));
  done(pc);
}

function windowW(pc: PixelCanvas): void {
  pc.rect(1, 1, 14, 13, P.wood2);
  pc.rect(2, 2, 12, 11, rgb('#8ad0f0'));
  pc.rect(2, 2, 4, 3, rgb('#d8f2ff'));
  pc.vline(8, 2, 12, P.wood2); pc.hline(2, 13, 7, P.wood2);
  pc.rect(0, 13, 16, 2, P.wood3);
  // cortinas
  pc.rect(1, 1, 2, 12, rgb('#c84a5a')); pc.rect(13, 1, 2, 12, rgb('#c84a5a'));
  done(pc);
}

function plant(pc: PixelCanvas): void {
  pc.rect(4, 17, 8, 8, rgb('#b8603a')); pc.hline(3, 12, 17, rgb('#d8804a')); pc.rect(4, 18, 8, 1, rgb('#8a4022'));
  const lf = [rgb('#2a6a2e'), rgb('#45963c'), rgb('#78c456')];
  for (const [x, y, r] of [[8, 8, 4], [5, 12, 3.5], [11, 12, 3.5], [8, 14, 3]] as [number, number, number][]) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) pc.set(Math.round(x + i), Math.round(y + j), i + j < -1 ? lf[2] : i + j > 2 ? lf[0] : lf[1]);
  }
  done(pc);
}

function lamp(pc: PixelCanvas): void {
  pc.rect(6, 26, 4, 3, P.wood1); pc.vline(7, 10, 25, P.wood2); pc.vline(8, 10, 25, P.wood1);
  for (let y = 2; y < 11; y++) { const w = 2 + (y - 2) * 0.6; pc.hline(Math.round(8 - w), Math.round(7 + w), y, y < 4 ? rgb('#fff2b8') : rgb('#f2d88a')); }
  done(pc);
}

function shelf(pc: PixelCanvas): void {
  pc.rect(1, 1, 14, 30, P.wood1); pc.rect(2, 2, 12, 28, P.wood0);
  const books = [P.red, P.blue, P.green, rgb('#d8a83a'), rgb('#7a46a6')];
  for (let s = 0; s < 3; s++) {
    const y = 3 + s * 9;
    pc.hline(2, 13, y + 7, P.wood3);
    for (let i = 0; i < 5; i++) pc.rect(3 + i * 2, y + 1 + (i % 2), 2, 6 - (i % 2), books[(i + s) % 5]);
  }
  done(pc);
}

export function addFurniture(ab: AtlasBuilder): void {
  ab.add('bed', 32, 38, bed);
  ab.add('tv', 16, 26, tv);
  ab.add('table', 32, 22, table);
  ab.add('chair', 16, 21, chair);
  ab.add('rug', 48, 32, rug);
  ab.add('fireplace', 32, 40, fireplace);
  ab.add('window', 16, 16, windowW);
  ab.add('plant', 16, 26, plant);
  ab.add('lamp', 16, 30, lamp);
  ab.add('shelf', 16, 32, shelf);
}
