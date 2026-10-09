import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P } from './palette';
import { hash2 } from './rng';
import type { AtlasBuilder } from './atlas';

/** Metais por nível de ferramenta: 0 básico, 1 bronze, 2 ferro, 3 ouro. */
export const TIER_METAL: [Color, Color, Color, Color][] = [
  [P.steel0, P.steel1, P.steel2, P.steel3],
  [P.copper0, P.copper1, P.copper2, P.copper3],
  [P.iron0, P.iron1, P.iron2, P.iron3],
  [P.goldT0, P.goldT1, P.goldT2, P.goldT3],
];

function handle(pc: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  pc.line(x0, y0, x1, y1, P.wood3);
  pc.line(x0 + 1, y0, x1 + 1, y1, P.wood1);
}

function finish(pc: PixelCanvas): void { pc.outline((c) => outlineOf(c)); }

export function drawTool(pc: PixelCanvas, tool: string, tier: number): void {
  const m = TIER_METAL[tier];
  switch (tool) {
    case 'hoe': {
      handle(pc, 2, 14, 9, 6);
      pc.rect(8, 2, 6, 3, m[2]); pc.hline(8, 13, 2, m[3]); pc.hline(8, 13, 4, m[1]);
      pc.rect(9, 5, 2, 2, m[1]); pc.set(13, 5, m[1]);
      break;
    }
    case 'axe': {
      handle(pc, 3, 14, 10, 3);
      pc.rect(5, 2, 5, 6, m[2]); pc.vline(4, 3, 6, m[3]); pc.vline(5, 2, 7, m[3]); pc.rect(9, 2, 2, 5, m[1]);
      pc.set(4, 2, m[2]); pc.set(4, 7, m[1]);
      break;
    }
    case 'pickaxe': {
      handle(pc, 3, 14, 9, 5);
      const arc: [number, number][] = [[2, 5], [3, 4], [4, 3], [5, 3], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 3], [12, 3], [13, 4], [14, 5]];
      for (const [x, y] of arc) { pc.set(x, y, m[2]); pc.set(x, y + 1, m[1]); }
      for (let i = 3; i < 9; i++) pc.set(arc[i][0], arc[i][1], m[3]);
      pc.rect(8, 4, 2, 2, m[0]);
      break;
    }
    case 'can': {
      pc.ellipse(7, 10, 5, 4.5, m[2]);
      pc.rect(3, 9, 9, 5, m[2]);
      for (let y = 6; y < 15; y++) for (let x = 2; x < 13; x++) if (pc.get(x, y)) {
        if (x <= 4 || y <= 7) pc.set(x, y, m[3]); else if (x >= 10 || y >= 13) pc.set(x, y, m[1]);
      }
      pc.line(11, 10, 14, 6, m[1]); pc.line(11, 11, 14, 7, m[2]); pc.set(14, 5, m[3]); pc.set(15, 5, m[2]);
      pc.line(4, 6, 5, 4, m[1]); pc.line(5, 4, 8, 4, m[1]); pc.line(8, 4, 9, 6, m[1]);
      pc.hline(4, 10, 11, mix(m[1], P.black, 0.2));
      break;
    }
    case 'scythe': {
      handle(pc, 4, 14, 8, 3);
      const blade: [number, number][] = [[8, 2], [9, 1], [10, 1], [11, 1], [12, 2], [13, 3], [14, 4], [14, 5], [13, 6]];
      for (const [x, y] of blade) { pc.set(x, y, m[2]); pc.set(x - 1, y + 1, m[3]); }
      break;
    }
    case 'rod': {
      pc.line(2, 14, 13, 2, tier === 3 ? m[2] : tier === 2 ? rgb('#5a8ad8') : P.wood3);
      pc.line(3, 14, 14, 2, tier === 3 ? m[1] : tier === 2 ? rgb('#2e5aa8') : P.wood1);
      pc.rect(4, 10, 3, 3, P.steel2); pc.set(4, 10, P.steel3);
      pc.vline(14, 3, 9, rgb('#e8f0f8'));
      pc.set(14, 10, P.red); pc.set(14, 11, P.white);
      break;
    }
    case 'bucket': {
      pc.rect(4, 7, 9, 7, m[2]); pc.vline(4, 7, 13, m[3]); pc.vline(12, 7, 13, m[1]); pc.hline(4, 12, 13, m[1]);
      pc.hline(3, 13, 7, m[3]); pc.line(4, 6, 8, 2, P.steel1); pc.line(8, 2, 12, 6, P.steel1);
      pc.hline(5, 11, 10, m[1]);
      break;
    }
  }
  finish(pc);
}

/* ---------- Itens ---------- */
type ItemDraw = (pc: PixelCanvas) => void;

function seedPacket(col: Color, col2: Color): ItemDraw {
  return (pc) => {
    pc.rect(3, 2, 10, 13, P.parch2);
    pc.hline(3, 12, 2, P.parch3); pc.vline(3, 2, 14, P.parch3); pc.vline(12, 3, 14, P.parch0); pc.hline(4, 12, 14, P.parch0);
    pc.hline(3, 12, 4, P.parch1); // dobra
    pc.ellipse(8, 9.5, 3, 3, col); pc.set(7, 8, col2); pc.set(9, 10, mix(col, P.black, 0.3));
    pc.set(8, 6, P.green); pc.set(9, 5, P.green);
    finish(pc);
  };
}

const ITEMS: Record<string, ItemDraw> = {
  seed_parsnip: seedPacket(rgb('#f2e2b0'), rgb('#fff8e0')),
  parsnip: (pc) => {
    // raiz cremosa com folhas
    const body: [number, number, number][] = [[7, 6, 3], [7, 7, 3.5], [7, 8, 3.5], [7, 9, 3], [7, 10, 2.5], [7, 11, 2], [8, 12, 1.5], [8, 13, 1]];
    for (const [cx, y, r] of body) for (let x = Math.floor(cx - r); x <= cx + r; x++) pc.set(x, y, x < cx - 1 ? rgb('#fff6d8') : x > cx + 1 ? rgb('#d8b878') : rgb('#f2e0a8'));
    pc.set(6, 9, rgb('#c8a060')); pc.set(8, 11, rgb('#c8a060'));
    pc.line(7, 5, 5, 1, P.leaf2); pc.line(8, 5, 9, 1, P.leaf3); pc.line(8, 5, 11, 2, P.leaf2); pc.set(6, 3, P.leaf3);
    finish(pc);
  },
  wood: (pc) => {
    const log = (x: number, y: number) => {
      pc.rect(x, y, 9, 4, P.wood2); pc.hline(x, x + 8, y, P.wood3); pc.hline(x, x + 8, y + 3, P.wood1);
      pc.ellipse(x + 9, y + 2, 1.6, 2, rgb('#e2b070')); pc.set(x + 9, y + 2, P.wood2);
    };
    log(2, 4); log(4, 8); log(1, 11);
    finish(pc);
  },
  stone: (pc) => {
    pc.ellipse(8, 9, 6, 4.5, P.stone2);
    for (let y = 4; y < 14; y++) for (let x = 2; x < 15; x++) if (pc.get(x, y)) {
      const l = -(x - 8) * 0.5 - (y - 9);
      pc.set(x, y, l > 2 ? P.stone4 : l > 0 ? P.stone3 : l > -2.5 ? P.stone2 : P.stone1);
    }
    pc.set(9, 9, P.stone1); pc.set(10, 10, P.stone1);
    finish(pc);
  },
  fiber: (pc) => {
    for (let k = 0; k < 5; k++) pc.line(3 + k * 2, 14, 5 + k, 2 + (k % 2) * 2, k % 2 ? P.leaf2 : P.leaf3);
    pc.hline(5, 10, 9, rgb('#c8a050'));
    finish(pc);
  },
  sap: (pc) => {
    pc.ellipse(8, 10, 4, 4, rgb('#c8780e'));
    pc.set(8, 5, rgb('#c8780e')); pc.rect(7, 6, 3, 2, rgb('#c8780e'));
    pc.set(6, 8, rgb('#ffd27a')); pc.set(6, 9, rgb('#f2b03a')); pc.set(10, 12, rgb('#8a4a08'));
    finish(pc);
  },
};

/* ---------- Ícones de interface ---------- */
function iconHand(pc: PixelCanvas): void {
  const s = rgb('#f0c08a'), S = rgb('#c8875a');
  pc.rect(4, 7, 8, 7, s);
  for (let i = 0; i < 4; i++) pc.rect(4 + i * 2, 3 + (i === 0 || i === 3 ? 1 : 0), 2, 5, s);
  pc.rect(1, 8, 3, 2, s); pc.rect(2, 7, 2, 2, s);
  for (let i = 0; i < 4; i++) pc.vline(5 + i * 2, 4, 7, S);
  pc.hline(4, 11, 13, S);
  finish(pc);
}
function iconTalk(pc: PixelCanvas): void {
  pc.ellipse(8, 7, 7, 5, P.white); pc.set(4, 12, P.white); pc.set(3, 13, P.white); pc.set(5, 11, P.white);
  for (let i = 0; i < 3; i++) pc.set(5 + i * 3, 7, P.text);
  finish(pc);
}
function iconBag(pc: PixelCanvas): void {
  pc.ellipse(8, 10, 6, 5, P.wood3); pc.rect(4, 5, 8, 4, P.wood3);
  for (let y = 3; y < 16; y++) for (let x = 1; x < 15; x++) if (pc.get(x, y)) { if (x > 10 || y > 13) pc.set(x, y, P.wood2); }
  pc.line(5, 4, 7, 2, P.wood1); pc.line(11, 4, 9, 2, P.wood1); pc.hline(5, 11, 5, P.wood1);
  pc.rect(7, 8, 2, 2, P.gold2);
  finish(pc);
}
function iconHammer(pc: PixelCanvas): void {
  handle(pc, 3, 14, 9, 7);
  pc.rect(5, 2, 9, 4, P.steel2); pc.hline(5, 13, 2, P.steel3); pc.hline(5, 13, 5, P.steel1);
  finish(pc);
}
function iconMap(pc: PixelCanvas): void {
  pc.rect(2, 3, 12, 10, P.parch2);
  pc.vline(6, 3, 12, P.parch0); pc.vline(10, 3, 12, P.parch0);
  pc.line(3, 10, 7, 6, P.red); pc.line(7, 6, 12, 8, P.red);
  pc.set(12, 8, P.redDark); pc.rect(3, 4, 2, 2, P.leaf2);
  finish(pc);
}
function iconMenu(pc: PixelCanvas): void {
  pc.circle(8, 8, 6, P.steel2);
  for (let a = 0; a < 8; a++) { const x = 8 + Math.cos(a * Math.PI / 4) * 6.5, y = 8 + Math.sin(a * Math.PI / 4) * 6.5; pc.rect(Math.round(x - 1), Math.round(y - 1), 2, 2, P.steel2); }
  pc.circle(8, 8, 2.5, P.steel0); pc.set(6, 5, P.steel3); pc.set(5, 6, P.steel3);
  finish(pc);
}
function iconHorseshoe(pc: PixelCanvas): void {
  for (let a = 0; a <= 20; a++) {
    const t = Math.PI * (a / 20);
    const x = 8 + Math.cos(t) * 5, y = 7 - Math.sin(t) * 5 + 3;
    pc.set(Math.round(x), Math.round(y), P.steel2); pc.set(Math.round(x), Math.round(y) + 1, P.steel1);
  }
  pc.vline(3, 10, 13, P.steel2); pc.vline(13, 10, 13, P.steel2);
  finish(pc);
}
function iconBed(pc: PixelCanvas): void {
  pc.rect(2, 8, 12, 4, P.blue); pc.rect(2, 6, 4, 3, P.white); pc.vline(1, 5, 13, P.wood2); pc.vline(14, 8, 13, P.wood2);
  pc.hline(2, 13, 12, P.wood1);
  finish(pc);
}
function iconBox(pc: PixelCanvas): void {
  pc.rect(2, 6, 12, 8, P.wood2); pc.rect(1, 4, 14, 3, P.wood3); pc.hline(2, 13, 9, P.wood1); pc.vline(8, 7, 13, P.wood1);
  pc.set(7, 5, P.gold2); pc.set(8, 5, P.gold2);
  finish(pc);
}
function iconGear(pc: PixelCanvas): void {
  pc.circle(8, 8, 5, P.gold1);
  for (let a = 0; a < 6; a++) { const x = 8 + Math.cos(a * Math.PI / 3) * 6, y = 8 + Math.sin(a * Math.PI / 3) * 6; pc.rect(Math.round(x - 1), Math.round(y - 1), 2, 2, P.gold1); }
  pc.circle(8, 8, 2, P.gold0); pc.set(6, 5, P.gold3);
  finish(pc);
}
function iconLift(pc: PixelCanvas): void {
  iconHand(pc);
  pc.ellipse(8, 2, 3, 1.6, P.stone2);
}
function iconDoor(pc: PixelCanvas): void {
  pc.rect(4, 2, 8, 13, P.wood2); pc.vline(4, 2, 14, P.wood3); pc.vline(11, 2, 14, P.wood1);
  pc.rect(6, 4, 4, 3, P.glass1); pc.set(10, 9, P.gold2);
  finish(pc);
}
function iconSaddle(pc: PixelCanvas): void {
  pc.ellipse(8, 9, 6, 3.5, P.wood2); pc.rect(4, 6, 3, 3, P.wood3); pc.vline(8, 11, 14, P.steel1);
  finish(pc);
}
function iconCoin(pc: PixelCanvas): void {
  pc.circle(pc.w / 2, pc.h / 2, pc.w / 2 - 0.5, P.gold2);
  pc.set(2, 2, P.gold3); pc.set(3, 2, P.gold3); pc.set(2, 3, P.gold3);
  pc.vline(Math.floor(pc.w / 2), 2, pc.h - 3, P.gold1);
  pc.outline(() => P.gold0);
}

/* ---------- Clima / estações (12x10) ---------- */
function wSun(pc: PixelCanvas): void {
  pc.circle(6, 5, 3, P.gold2); pc.set(5, 4, P.gold3);
  for (const [x, y] of [[6, 0], [6, 10], [0, 5], [11, 5], [2, 1], [10, 1], [2, 9], [10, 9]]) pc.set(x, y, P.gold1);
}
function wCloud(pc: PixelCanvas, dark = false): void {
  const c = dark ? rgb('#8a92a8') : P.white, s = dark ? rgb('#5a6278') : rgb('#c8d4e4');
  pc.circle(4, 6, 2.6, c); pc.circle(7, 4.5, 3, c); pc.circle(9, 6.5, 2.4, c); pc.rect(3, 6, 7, 3, c);
  pc.hline(3, 9, 8, s);
  pc.outline(() => dark ? rgb('#3a3e50') : rgb('#7a8aa0'));
}
function wRain(pc: PixelCanvas): void { wCloud(pc, true); pc.set(3, 9, P.blue); pc.set(6, 9, P.blue); pc.set(9, 9, P.blue); }
function wStorm(pc: PixelCanvas): void { wCloud(pc, true); pc.line(6, 6, 5, 9, P.yellow); pc.set(7, 7, P.yellow); }
function wSnow(pc: PixelCanvas): void {
  pc.line(6, 1, 6, 9, P.white); pc.line(2, 3, 10, 7, P.white); pc.line(2, 7, 10, 3, P.white);
  pc.outline(() => rgb('#6a8ab8'));
}
function sSpring(pc: PixelCanvas): void {
  for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) pc.circle(6 + dx, 5 + dy, 1.6, P.flowerP);
  pc.set(6, 5, P.flowerY); pc.outline(() => rgb('#8a2a5a'));
}
function sSummer(pc: PixelCanvas): void { wSun(pc); }
function sFall(pc: PixelCanvas): void {
  pc.ellipse(6, 5, 3.5, 4, rgb('#e07a2a')); pc.line(6, 2, 6, 9, rgb('#8a3a10')); pc.set(5, 3, rgb('#f6b04a'));
  pc.outline(() => rgb('#5a2208'));
}

/* ---------- Painéis de UI ---------- */
export function panel(pc: PixelCanvas, inner: Color, inner2: Color): void {
  const w = pc.w, h = pc.h;
  // moldura de madeira com cantos arredondados (1px)
  pc.rect(1, 0, w - 2, h, P.uiOut); pc.rect(0, 1, w, h - 2, P.uiOut);
  pc.rect(1, 1, w - 2, h - 2, P.uiWood2);
  pc.hline(2, w - 3, 1, P.uiWood3); pc.vline(1, 2, h - 3, P.uiWood3);
  pc.hline(2, w - 3, h - 2, P.uiWood0); pc.vline(w - 2, 2, h - 3, P.uiWood0);
  pc.rect(3, 3, w - 6, h - 6, P.uiWood1);
  pc.rect(4, 4, w - 8, h - 8, inner);
  pc.hline(4, w - 5, 4, inner2); pc.vline(4, 4, h - 5, inner2);
  // pregos nos cantos
  for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) pc.set(x, y, P.gold1);
}
export function slot(pc: PixelCanvas, sel: boolean): void {
  const w = pc.w, h = pc.h;
  pc.rect(0, 0, w, h, sel ? P.red : P.parch0);
  pc.rect(1, 1, w - 2, h - 2, sel ? P.gold2 : P.uiWood1);
  pc.rect(2, 2, w - 4, h - 4, P.parch1);
  pc.hline(2, w - 3, 2, P.parch0); pc.vline(2, 2, h - 3, P.parch0);
  if (sel) { pc.set(0, 0, 0); pc.set(w - 1, 0, 0); pc.set(0, h - 1, 0); pc.set(w - 1, h - 1, 0); }
}
function roundButton(pc: PixelCanvas, pressed: boolean): void {
  const r = pc.w / 2;
  pc.circle(r, r, r - 0.5, P.uiOut);
  pc.circle(r, r, r - 1.5, pressed ? P.uiWood1 : P.uiWood2);
  // aro claro superior-esquerdo
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
    const dx = x + 0.5 - r, dy = y + 0.5 - r;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < r - 1.5 && d > r - 4) {
      const l = -(dx + dy) / d;
      if (l > 0.5) pc.set(x, y, pressed ? P.uiWood2 : P.uiWood3); else if (l < -0.5) pc.set(x, y, P.uiWood0);
    }
  }
  pc.circle(r, r, r - 5, pressed ? P.parch0 : P.parch1);
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
    const dx = x + 0.5 - r, dy = y + 0.5 - r;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < r - 5 && d > r - 6.5 && dy < 0 && !pressed) pc.set(x, y, P.parch0);
    if (d < r - 5 && hash2(x, y, 3) < 0.04) pc.set(x, y, P.parch0);
  }
}
export function smallButton(pc: PixelCanvas, pressed: boolean): void {
  const w = pc.w, h = pc.h;
  pc.rect(1, 0, w - 2, h, P.uiOut); pc.rect(0, 1, w, h - 2, P.uiOut);
  pc.rect(1, 1, w - 2, h - 2, pressed ? P.uiWood1 : P.uiWood2);
  if (!pressed) { pc.hline(2, w - 3, 1, P.uiWood3); pc.vline(1, 2, h - 4, P.uiWood3); }
  pc.hline(1, w - 2, h - 2, P.uiWood0); pc.hline(1, w - 2, h - 3, pressed ? P.uiWood1 : P.uiWood1);
  pc.rect(3, 3, w - 6, h - 7, pressed ? P.parch0 : P.parch1);
}
function clockPanel(pc: PixelCanvas): void {
  panel(pc, P.parch2, P.parch3);
  // divisórias
  pc.hline(5, pc.w - 6, 15, P.parch0); pc.hline(5, pc.w - 6, 27, P.parch0);
}
function dial(pc: PixelCanvas): void {
  // semicírculo do ponteiro solar (dia em cima, noite embaixo)
  const r = pc.w / 2;
  pc.circle(r, r, r - 0.5, P.uiOut);
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
    const dx = x + 0.5 - r, dy = y + 0.5 - r;
    if (dx * dx + dy * dy < (r - 1.5) * (r - 1.5)) pc.set(x, y, dy < 0 ? rgb('#7ec4ec') : rgb('#2a2a6a'));
  }
  pc.circle(r - 3, r - 3, 1.6, P.gold2);
  pc.set(Math.round(r + 3), Math.round(r + 2), P.white); pc.set(Math.round(r - 2), Math.round(r + 4), P.white);
}
function energyFrame(pc: PixelCanvas): void {
  const w = pc.w, h = pc.h;
  pc.rect(1, 0, w - 2, h, P.uiOut); pc.rect(0, 1, w, h - 2, P.uiOut);
  pc.rect(1, 1, w - 2, h - 2, P.uiWood2);
  pc.vline(1, 1, h - 2, P.uiWood3); pc.vline(w - 2, 1, h - 2, P.uiWood0);
  pc.rect(3, 3, w - 6, h - 14, rgb('#2a160c'));
  // "E" embaixo
  const ex = Math.floor(w / 2) - 2, ey = h - 9;
  pc.rect(ex, ey, 1, 5, P.gold2); pc.hline(ex, ex + 3, ey, P.gold2); pc.hline(ex, ex + 2, ey + 2, P.gold2); pc.hline(ex, ex + 3, ey + 4, P.gold2);
}
function white(pc: PixelCanvas): void { pc.fill(P.white); }
function joyBase(pc: PixelCanvas): void {
  const r = pc.w / 2;
  pc.circle(r, r, r - 0.5, rgb('#fff3d6', 255));
  pc.circle(r, r, r - 2.5, rgb('#fff3d6', 0));
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) {
    const dx = x + 0.5 - r, dy = y + 0.5 - r, d = Math.sqrt(dx * dx + dy * dy);
    if (d < r - 2.5) pc.set(x, y, rgb('#fff3d6', 60));
  }
}
function joyKnob(pc: PixelCanvas): void {
  const r = pc.w / 2;
  pc.circle(r, r, r - 0.5, P.uiOut);
  pc.circle(r, r, r - 1.5, P.parch2);
  pc.circle(r - 1, r - 1, r - 4, P.parch3);
}
function targetCorner(pc: PixelCanvas): void {
  // canto do contorno do tile-alvo (5x5)
  pc.hline(0, 4, 0, P.white); pc.vline(0, 0, 4, P.white);
  pc.hline(1, 3, 1, rgb('#ffffff', 120)); pc.vline(1, 1, 3, rgb('#ffffff', 120));
}

export const TOOL_KEYS = ['hoe', 'can', 'axe', 'pickaxe', 'scythe', 'rod', 'bucket'] as const;
export const ITEM_ICON_KEYS = Object.keys(ITEMS);

export function addIcons(ab: AtlasBuilder): void {
  for (const t of TOOL_KEYS) for (let tier = 0; tier < 4; tier++) ab.add(`tool_${t}_${tier}`, 16, 16, (pc) => drawTool(pc, t, tier));
  for (const k of ITEM_ICON_KEYS) ab.add(`item_${k}`, 16, 16, ITEMS[k]);
  const ic: Record<string, (pc: PixelCanvas) => void> = {
    hand: iconHand, talk: iconTalk, bag: iconBag, hammer: iconHammer, map: iconMap, menu: iconMenu, horseshoe: iconHorseshoe,
    bed: iconBed, box: iconBox, gear: iconGear, lift: iconLift, door: iconDoor, saddle: iconSaddle,
  };
  for (const k of Object.keys(ic)) ab.add(`icon_${k}`, 16, 16, ic[k]);
  ab.add('icon_coin', 8, 8, iconCoin);
  ab.add('icon_coin_big', 12, 12, iconCoin);
  const w: Record<string, (pc: PixelCanvas) => void> = { sun: wSun, cloud: (pc) => wCloud(pc), rain: wRain, storm: wStorm, snow: wSnow, s0: sSpring, s1: sSummer, s2: sFall, s3: wSnow };
  for (const k of Object.keys(w)) ab.add(`wx_${k}`, 12, 11, w[k]);
  ab.add('ui_panel', 24, 24, (pc) => panel(pc, P.parch2, P.parch3));
  ab.add('ui_panel_wood', 24, 24, (pc) => panel(pc, P.uiWood1, P.uiWood2));
  ab.add('ui_slot', 22, 22, (pc) => slot(pc, false));
  ab.add('ui_slot_sel', 22, 22, (pc) => slot(pc, true));
  ab.add('ui_btn_round', 40, 40, (pc) => roundButton(pc, false));
  ab.add('ui_btn_round_p', 40, 40, (pc) => roundButton(pc, true));
  ab.add('ui_btn_small', 22, 22, (pc) => smallButton(pc, false));
  ab.add('ui_btn_small_p', 22, 22, (pc) => smallButton(pc, true));
  ab.add('ui_clock', 76, 40, clockPanel);
  ab.add('ui_dial', 22, 22, dial);
  ab.add('ui_energy', 12, 74, energyFrame);
  ab.add('px', 4, 4, white);
  const pxc: Record<string, Color> = { px_g: P.green, px_y: P.yellow, px_r: P.red, px_k: rgb('#120a08'), px_b: rgb('#4aa0e8'), px_p: P.parch1, px_d: P.uiWood0 };
  for (const k of Object.keys(pxc)) ab.add(k, 4, 4, (pc) => pc.fill(pxc[k]));
  ab.add('joy_base', 60, 60, joyBase);
  ab.add('joy_knob', 26, 26, joyKnob);
  ab.add('target_corner', 5, 5, targetCorner);
}
