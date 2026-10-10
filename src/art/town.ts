import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P } from './palette';
import { hash2 } from './rng';
import { shingleRoof, planks, windowAt, stoneBase } from './buildings';
import type { AtlasBuilder } from './atlas';

function done(pc: PixelCanvas): void { pc.outline((c) => outlineOf(c)); }

/** Parede de reboco com enxaimel (vigas de madeira). */
function plaster(pc: PixelCanvas, x0: number, y0: number, w: number, h: number): void {
  const c0 = rgb('#d8c8a8'), c1 = rgb('#ece0c4'), c2 = rgb('#c4b08c');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = hash2(x0 + i, y0 + j, 77);
    pc.set(x0 + i, y0 + j, n < 0.08 ? c2 : n > 0.93 ? c1 : c0);
  }
  for (let i = 0; i < w; i += 16) pc.rect(x0 + i, y0, 3, h, P.wood1);
  pc.rect(x0, y0, w, 3, P.wood1); pc.rect(x0, y0 + h - 3, w, 3, P.wood1);
}

function door(pc: PixelCanvas, x: number, y: number, w: number, h: number, col: Color = P.wood2): void {
  pc.rect(x - 2, y - 2, w + 4, h + 2, P.wood0);
  pc.rect(x, y, w, h, col);
  for (let i = 0; i < w; i += 4) pc.vline(x + i, y, y + h - 1, mix(col, P.black, 0.25));
  pc.vline(x + 1, y, y + h - 1, mix(col, P.white, 0.2));
  pc.rect(x + w - 4, y + Math.floor(h / 2), 2, 2, P.gold2);
}

/** Loja geral (112x104): toldo listrado, vitrine e placa com pacote de sementes. */
function drawShop(pc: PixelCanvas): void {
  const W = 112;
  plaster(pc, 6, 48, 100, 46);
  stoneBase(pc, 4, 94, 104, 8);
  shingleRoof(pc, 0, 10, W, 40, 14, [rgb('#1e4a2a'), rgb('#2c6a38'), rgb('#3e8a48'), rgb('#62ac62')]);
  pc.rect(0, 48, W, 2, rgb('#1e4a2a'));
  // toldo listrado
  for (let x = 4; x < W - 4; x++) for (let y = 52; y < 60; y++) {
    const stripe = Math.floor((x - 4) / 8) % 2 === 0;
    let c = stripe ? P.red : P.white;
    if (y === 59) c = stripe ? P.redDark : rgb('#d8d0c8');
    pc.set(x, y, c);
  }
  for (let x = 4; x < W - 4; x += 8) { pc.set(x + 3, 60, P.red); pc.set(x + 4, 60, P.red); }
  // vitrine com produtos
  pc.rect(12, 64, 36, 22, P.wood1); pc.rect(14, 66, 32, 18, P.glass1); pc.rect(14, 66, 10, 6, P.glass2);
  const goods = [P.flowerR, P.flowerY, rgb('#e8822a'), P.green, rgb('#5e2272')];
  for (let i = 0; i < 6; i++) { pc.rect(16 + i * 5, 78, 4, 5, goods[i % 5]); pc.set(16 + i * 5, 78, P.white); }
  pc.rect(12, 86, 36, 3, P.wood3);
  windowAt(pc, 80, 66, 18, 14, true);
  door(pc, 56, 66, 16, 28);
  // placa
  pc.rect(40, 30, 32, 16, P.wood3); pc.rect(42, 32, 28, 12, P.parch2); pc.hline(40, 71, 30, P.wood4);
  pc.rect(51, 34, 10, 9, P.parch1); pc.ellipse(56, 39, 2.5, 2.5, P.green); pc.set(56, 35, P.leaf3);
  pc.vline(44, 26, 30, P.wood1); pc.vline(67, 26, 30, P.wood1);
  done(pc);
}

/** Ferreiro (96x100): pedra, telhado de ardósia, forja acesa e bigorna. */
function drawSmith(pc: PixelCanvas): void {
  const W = 96;
  for (let j = 0; j < 46; j++) for (let i = 0; i < 84; i++) {
    const row = Math.floor(j / 5), off = (row % 2) * 6;
    let c = P.stone2;
    if (j % 5 === 4 || (i + off) % 12 === 0) c = P.stone1; else if (j % 5 === 0) c = P.stone3;
    if (hash2(i, j, 5) < 0.04) c = P.stone4;
    pc.set(6 + i, 48 + j, c);
  }
  stoneBase(pc, 4, 94, 88, 6);
  // chaminé com brasa
  stoneBase(pc, 70, 0, 12, 24); pc.rect(69, 0, 14, 3, P.stone3);
  shingleRoof(pc, 0, 12, W, 38, 12, [rgb('#22242e'), rgb('#363a48'), rgb('#4a5062'), rgb('#6a7086')]);
  pc.rect(0, 48, W, 2, rgb('#22242e'));
  // forja aberta
  pc.rect(12, 62, 26, 22, rgb('#1a0e0a')); pc.ellipse(25, 78, 9, 5, rgb('#e8602a')); pc.ellipse(25, 79, 5, 3, rgb('#ffcf40'));
  pc.rect(10, 60, 30, 3, P.wood1); pc.vline(10, 60, 84, P.wood1); pc.vline(39, 60, 84, P.wood1);
  door(pc, 56, 66, 16, 28, P.wood1);
  // placa com bigorna
  pc.rect(48, 52, 26, 10, P.wood3); pc.rect(50, 54, 22, 6, P.parch2);
  pc.rect(55, 55, 12, 2, P.steel1); pc.rect(58, 57, 6, 2, P.steel1); pc.rect(56, 54, 4, 1, P.steel2);
  done(pc);
}

/** Casarão (176x124). stage 0 = em ruínas; cada sala restaurada melhora (até 6). */
function drawManor(pc: PixelCanvas, stage: number): void {
  const W = 176;
  const ruin = Math.max(0, 6 - stage) / 6; // 1 = totalmente arruinado
  const wall: [Color, Color, Color, Color] = ruin > 0.5
    ? [rgb('#3e3428'), rgb('#5a4a38'), rgb('#76624a'), rgb('#8e7a5e')]
    : [P.wall0, P.wall1, P.wall2, P.wall3];
  planks(pc, 8, 52, 160, 62, wall);
  stoneBase(pc, 4, 114, 168, 8);
  // telhado (telhas faltando quando arruinado)
  const roof: [Color, Color, Color, Color] = ruin > 0.5 ? [rgb('#2a2228'), rgb('#3e3238'), rgb('#54444a'), rgb('#6a585c')] : [rgb('#3a1650'), rgb('#55226e'), rgb('#6e348e'), rgb('#9256b0')];
  shingleRoof(pc, 0, 8, W, 46, 16, roof);
  if (ruin > 0) for (let k = 0; k < Math.round(ruin * 14); k++) {
    const x = 20 + ((k * 37) % 136), y = 14 + ((k * 13) % 30);
    pc.rect(x, y, 6, 3, rgb('#1a1214'));
    pc.hline(x, x + 5, y + 3, roof[1]);
  }
  pc.rect(0, 52, W, 2, roof[0]);
  // torre central
  pc.rect(72, 0, 32, 14, wall[2]); pc.rect(76, 4, 8, 8, ruin > 0.5 ? P.wood0 : P.glass1); pc.rect(92, 4, 8, 8, ruin > 0.5 ? P.wood0 : P.glass1);
  // janelas (tábuas pregadas quando arruinado)
  const wins = [[20, 64], [48, 64], [112, 64], [140, 64], [20, 90], [140, 90]];
  wins.forEach(([x, y], i) => {
    if (ruin > (i + 1) / 7) {
      pc.rect(x - 1, y - 1, 18, 16, P.wood0); pc.rect(x, y, 16, 14, rgb('#1a1214'));
      pc.line(x - 2, y + 2, x + 17, y + 9, P.wood2); pc.line(x - 2, y + 10, x + 17, y + 4, P.wood3);
    } else windowAt(pc, x, y, 16, 14, i < 4);
  });
  door(pc, 78, 82, 20, 32, ruin > 0.5 ? rgb('#5a4430') : P.wood2);
  pc.rect(74, 78, 28, 4, P.stone3);
  // trepadeiras
  if (ruin > 0) for (let k = 0; k < Math.round(ruin * 40); k++) {
    const x = 8 + ((k * 53) % 160), y = 52 + ((k * 29) % 60);
    pc.set(x, y, P.leaf2); pc.set(x + 1, y + 1, P.leaf1); pc.set(x, y + 2, P.leaf3);
  }
  done(pc);
}

function drawFountain(pc: PixelCanvas): void {
  pc.ellipse(24, 30, 23, 12, P.stone2);
  pc.ellipse(24, 28, 22, 10.5, P.stone3);
  pc.ellipse(24, 29, 18, 7.5, P.water2);
  pc.ellipse(22, 27, 12, 4, P.water3);
  pc.rect(21, 8, 6, 20, P.stone2); pc.vline(21, 8, 27, P.stone3); pc.vline(26, 8, 27, P.stone1);
  pc.ellipse(24, 9, 8, 3, P.stone3);
  // jato d'água
  for (let i = 0; i < 6; i++) { pc.set(24 - i, 6 - Math.round(Math.sin(i / 6 * Math.PI) * 4) + 2, P.waterHi); pc.set(24 + i, 6 - Math.round(Math.sin(i / 6 * Math.PI) * 4) + 2, P.waterHi); }
  pc.set(24, 2, P.foam); pc.set(24, 3, P.waterHi);
  done(pc);
}

function drawBench(pc: PixelCanvas): void {
  pc.rect(1, 3, 30, 3, P.wood3); pc.rect(1, 7, 30, 3, P.wood2); pc.rect(1, 11, 30, 3, P.wood3);
  pc.rect(3, 14, 2, 4, P.steel1); pc.rect(27, 14, 2, 4, P.steel1); pc.rect(3, 2, 2, 12, P.steel1); pc.rect(27, 2, 2, 12, P.steel1);
  done(pc);
}

function drawLamp(pc: PixelCanvas): void {
  pc.rect(7, 10, 2, 22, P.steel0); pc.rect(5, 29, 6, 3, P.steel1);
  pc.rect(4, 3, 8, 8, P.steel0); pc.rect(5, 4, 6, 6, rgb('#ffe9a0')); pc.rect(6, 5, 2, 2, P.white);
  pc.rect(3, 2, 10, 2, P.steel1); pc.set(7, 1, P.steel1); pc.set(8, 1, P.steel1);
  done(pc);
}

function drawFlowerbed(pc: PixelCanvas, v: number): void {
  pc.rect(0, 9, 16, 7, P.wood2); pc.hline(0, 15, 9, P.wood3); pc.rect(1, 10, 14, 2, P.soil1);
  const cols = [[P.flowerR, P.flowerY], [P.flowerP, P.flowerW], [P.flowerB, P.flowerY]][v % 3];
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 3, y = 4 + (i % 2) * 2;
    pc.vline(x, y + 1, 9, P.leaf2); pc.set(x - 1, y + 3, P.leaf3);
    const c = cols[i % 2]; pc.set(x, y, c); pc.set(x - 1, y, c); pc.set(x + 1, y, c); pc.set(x, y - 1, c); pc.set(x, y + 1, mix(c, P.black, 0.2));
  }
  done(pc);
}

function drawSign(pc: PixelCanvas): void {
  pc.rect(7, 8, 2, 8, P.wood1);
  pc.rect(1, 1, 14, 9, P.wood3); pc.hline(1, 14, 1, P.wood4); pc.hline(3, 12, 4, P.wood1); pc.hline(3, 10, 7, P.wood1);
  done(pc);
}

/** Baú (16x20), fechado e aberto. */
export function drawChest(pc: PixelCanvas, open: boolean): void {
  const y0 = 6;
  pc.rect(1, y0 + 4, 14, 9, P.wood2); pc.hline(1, 14, y0 + 12, P.wood1);
  for (let x = 1; x < 15; x += 4) pc.vline(x, y0 + 5, y0 + 11, P.wood1);
  pc.vline(3, y0 + 4, y0 + 12, P.steel1); pc.vline(12, y0 + 4, y0 + 12, P.steel1);
  if (open) {
    pc.rect(1, y0 - 4, 14, 6, P.wood3); pc.hline(1, 14, y0 - 4, P.wood4); pc.rect(2, y0 + 2, 12, 2, P.wood0);
    pc.vline(3, y0 - 4, y0 + 1, P.steel1); pc.vline(12, y0 - 4, y0 + 1, P.steel1);
  } else {
    pc.rect(1, y0, 14, 5, P.wood3); pc.hline(1, 14, y0, P.wood4); pc.hline(1, 14, y0 + 4, P.wood1);
    pc.vline(3, y0, y0 + 4, P.steel2); pc.vline(12, y0, y0 + 4, P.steel2);
    pc.rect(7, y0 + 3, 2, 3, P.gold2);
  }
  done(pc);
}

export function addTown(ab: AtlasBuilder): void {
  ab.add('shop', 112, 104, drawShop);
  ab.add('smith', 96, 100, drawSmith);
  for (let s = 0; s <= 6; s++) ab.add(`manor_${s}`, 176, 124, (pc) => drawManor(pc, s));
  ab.add('fountain', 48, 44, drawFountain);
  ab.add('bench', 32, 18, drawBench);
  ab.add('lamppost', 16, 32, drawLamp);
  for (let v = 0; v < 3; v++) ab.add(`flowerbed_${v}`, 16, 16, (pc) => drawFlowerbed(pc, v));
  ab.add('sign', 16, 16, drawSign);
  ab.add('chest', 16, 20, (pc) => drawChest(pc, false));
  ab.add('chest_open', 16, 20, (pc) => drawChest(pc, true));
  ab.add('item_chest', 16, 16, (pc) => { const t = new PixelCanvas(16, 20); drawChest(t, false); pc.blit(t, 0, -3); });
  ab.add('item_fertilizer', 16, 16, (pc) => {
    pc.rect(3, 3, 10, 12, rgb('#c8a060')); pc.hline(3, 12, 3, rgb('#e2c080')); pc.vline(12, 4, 14, rgb('#8a6a3a'));
    pc.rect(5, 6, 6, 5, P.parch2); pc.set(7, 8, P.green); pc.set(8, 7, P.green); pc.set(8, 9, P.leaf2);
    pc.hline(4, 11, 2, rgb('#8a6a3a'));
    done(pc);
  });
  ab.add('item_backpack', 16, 16, (pc) => {
    pc.ellipse(8, 9, 6, 6, P.wood3); pc.rect(3, 4, 10, 6, P.wood3);
    pc.rect(5, 8, 6, 4, P.wood2); pc.hline(5, 10, 8, P.wood4); pc.rect(7, 9, 2, 2, P.gold2);
    pc.line(5, 3, 6, 1, P.wood1); pc.line(10, 3, 9, 1, P.wood1); pc.hline(6, 9, 1, P.wood1);
    done(pc);
  });
}
