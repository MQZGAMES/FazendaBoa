import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P } from './palette';
import { hash2 } from './rng';
import type { AtlasBuilder } from './atlas';

/** Telhado de telhas em fileiras desencontradas, luz vindo do alto-esquerda. */
function shingleRoof(pc: PixelCanvas, x0: number, y0: number, w: number, h: number, inset: number, cols: [Color, Color, Color, Color]): void {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const ins = Math.round(inset * (1 - t));
    const row = Math.floor(j / 4);
    for (let i = ins; i < w - ins; i++) {
      const x = x0 + i, y = y0 + j;
      const rowY = j % 4;
      const off = (row % 2) * 3;
      let c = cols[2];
      if (rowY === 3) c = cols[0];
      else if (rowY === 0) c = cols[3];
      else if ((i + off) % 6 === 0) c = cols[1];
      if (i - ins < 2) c = mix(c, cols[3], 0.4);
      if (i > w - ins - 3) c = mix(c, cols[0], 0.5);
      if (hash2(x, y, 31) < 0.04) c = cols[1];
      pc.set(x, y, c);
    }
  }
}

function planks(pc: PixelCanvas, x0: number, y0: number, w: number, h: number, base: [Color, Color, Color, Color]): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j;
    let c = base[2];
    if (j % 5 === 4) c = base[0];
    else if (j % 5 === 0) c = base[3];
    if (((i + (Math.floor(j / 5) % 2) * 9) % 18) === 0 && j % 5 !== 4) c = base[1];
    if (hash2(x, y, 17) < 0.05) c = base[1];
    pc.set(x, y, c);
  }
}

function windowAt(pc: PixelCanvas, x: number, y: number, w: number, h: number, flowers: boolean): void {
  pc.rect(x - 1, y - 1, w + 2, h + 2, P.wood0);
  pc.rect(x, y, w, h, P.wood3);
  pc.rect(x + 1, y + 1, w - 2, h - 2, P.glass1);
  for (let j = 0; j < h - 2; j++) for (let i = 0; i < w - 2; i++) {
    if (i + j < 4) pc.set(x + 1 + i, y + 1 + j, P.glass2);
    else if (i + j > w + h - 8) pc.set(x + 1 + i, y + 1 + j, P.glass0);
  }
  pc.vline(x + Math.floor(w / 2), y + 1, y + h - 2, P.wood3);
  pc.hline(x + 1, x + w - 2, y + Math.floor(h / 2), P.wood3);
  if (flowers) {
    pc.rect(x - 1, y + h + 1, w + 2, 3, P.wood1); pc.hline(x - 1, x + w, y + h + 1, P.wood3);
    for (let i = 0; i < w; i += 2) {
      const c = [P.flowerR, P.flowerY, P.flowerP, P.flowerW][(i / 2) % 4];
      pc.set(x + i, y + h, c); pc.set(x + i + 1, y + h, P.leaf3); pc.set(x + i, y + h - 1, P.leaf2);
    }
  }
}

function stoneBase(pc: PixelCanvas, x0: number, y0: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const row = Math.floor(j / 3), off = (row % 2) * 4;
    let c = P.stone2;
    if (j % 3 === 2) c = P.stone1;
    else if ((i + off) % 8 === 0) c = P.stone1;
    else if (j % 3 === 0) c = P.stone3;
    pc.set(x0 + i, y0 + j, c);
  }
}

/** Casa da fazenda (96x96): 6 tiles de largura. */
function drawHouse(pc: PixelCanvas): void {
  const W = 96;
  // parede
  planks(pc, 8, 46, 80, 40, [P.wall0, P.wall1, P.wall2, P.wall3]);
  // sombra do beiral
  pc.rect(8, 46, 80, 3, P.wall0);
  // colunas dos cantos
  for (const x of [7, 86]) { pc.rect(x, 46, 3, 40, P.wood1); pc.vline(x, 46, 85, P.wood2); }
  stoneBase(pc, 6, 86, 84, 8);
  // chaminé (atrás do telhado)
  stoneBase(pc, 66, 2, 10, 20);
  pc.rect(65, 1, 12, 3, P.stone3); pc.hline(65, 76, 1, P.stone4);
  // telhado
  const roof: [Color, Color, Color, Color] = [P.roof0, P.roof1, P.roof2, P.roof3];
  shingleRoof(pc, 0, 12, W, 36, 12, roof);
  // cumeeira e beiral
  pc.hline(12, W - 13, 12, mix(P.roof3, P.white, 0.25));
  pc.rect(0, 47, W, 2, P.roof0); pc.hline(0, W - 1, 46, P.roof1);
  // porta
  const dx = 40;
  pc.rect(dx - 2, 58, 20, 28, P.wood0);
  pc.rect(dx, 60, 16, 26, P.wood2);
  for (let i = 0; i < 16; i += 4) pc.vline(dx + i, 60, 85, P.wood1);
  pc.vline(dx + 1, 60, 85, P.wood3);
  pc.rect(dx + 4, 63, 8, 6, P.glass1); pc.rect(dx + 4, 63, 3, 2, P.glass2);
  pc.rect(dx + 12, 73, 2, 2, P.gold2);
  // degrau
  pc.rect(dx - 3, 86, 22, 4, P.stone3); pc.hline(dx - 3, dx + 18, 86, P.stone4); pc.hline(dx - 3, dx + 18, 89, P.stone1);
  // janelas
  windowAt(pc, 16, 58, 16, 13, true);
  windowAt(pc, 64, 58, 16, 13, true);
  // lampião ao lado da porta
  pc.rect(dx + 20, 62, 3, 4, P.gold1); pc.set(dx + 21, 61, P.wood0);
  pc.outline((c) => outlineOf(c));
}

/** Janelas acesas da casa (sobreposição noturna). */
function drawHouseGlow(pc: PixelCanvas): void {
  const glow = (x: number, y: number, w: number, h: number) => {
    pc.rect(x + 1, y + 1, w - 2, h - 2, P.glowWin);
    pc.vline(x + Math.floor(w / 2), y + 1, y + h - 2, rgb('#e8a040'));
    pc.hline(x + 1, x + w - 2, y + Math.floor(h / 2), rgb('#e8a040'));
  };
  glow(16, 58, 16, 13); glow(64, 58, 16, 13); glow(44, 63, 8, 6);
  pc.rect(61, 62, 3, 4, rgb('#fff0a0'));
}

/** Caixa de envio (32x26), fechada e aberta. */
function drawBin(pc: PixelCanvas, open: boolean): void {
  const y0 = 8;
  planks(pc, 2, y0 + 4, 28, 13, [P.wood0, P.wood1, P.wood2, P.wood3]);
  pc.rect(2, y0 + 16, 28, 2, P.wood1);
  for (const x of [2, 15, 28]) pc.rect(x, y0 + 4, 2, 14, P.wood1);
  if (open) {
    pc.rect(3, y0 - 6, 26, 9, P.wood3); pc.hline(3, 28, y0 - 6, P.wood4); pc.rect(4, y0 + 3, 24, 2, P.wood0);
  } else {
    pc.rect(1, y0, 30, 5, P.wood3); pc.hline(1, 30, y0, P.wood4); pc.hline(1, 30, y0 + 4, P.wood1);
    pc.rect(14, y0 + 1, 4, 3, P.steel2);
  }
  pc.outline((c) => outlineOf(c));
}

/** Cerca de madeira (para bordas e decoração). */
function drawFence(pc: PixelCanvas, conn: number): void {
  // poste
  pc.rect(6, 3, 4, 12, P.wood2); pc.vline(6, 3, 14, P.wood3); pc.vline(9, 3, 14, P.wood1); pc.hline(6, 9, 3, P.wood4);
  if (conn & 1) { pc.rect(0, 6, 6, 2, P.wood3); pc.rect(0, 10, 6, 2, P.wood2); }
  if (conn & 2) { pc.rect(10, 6, 6, 2, P.wood3); pc.rect(10, 10, 6, 2, P.wood2); }
  pc.outline((c) => outlineOf(c));
}

/** Placa / caixa de correio. */
function drawMailbox(pc: PixelCanvas): void {
  pc.rect(7, 8, 2, 8, P.wood1);
  pc.rect(3, 2, 10, 7, P.blue); pc.hline(3, 12, 2, rgb('#8ab8f0')); pc.rect(11, 0, 1, 4, P.red); pc.rect(12, 0, 2, 2, P.red);
  pc.outline((c) => outlineOf(c));
}

export function addBuildings(ab: AtlasBuilder): void {
  ab.add('house', 96, 96, drawHouse);
  ab.add('house_glow', 96, 96, drawHouseGlow);
  ab.add('bin', 32, 26, (pc) => drawBin(pc, false));
  ab.add('bin_open', 32, 26, (pc) => drawBin(pc, true));
  for (let c = 0; c < 4; c++) ab.add(`fence_${c}`, 16, 16, (pc) => drawFence(pc, c));
  ab.add('mailbox', 16, 16, drawMailbox);
}
