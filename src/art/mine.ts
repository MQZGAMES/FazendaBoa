import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P } from './palette';
import { ORE_COLORS, GEM_COLORS } from './nature';
import type { AtlasBuilder } from './atlas';

function done(pc: PixelCanvas): void { pc.outline((c) => outlineOf(c)); }
type Pal3 = [Color, Color, Color];

function shaded(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, c: [Color, Color, Color, Color]): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const l = -(nx * 0.6 + ny * 0.8);
    pc.set(x, y, l > 0.5 ? c[3] : l > 0 ? c[2] : l > -0.5 ? c[1] : c[0]);
  }
}

/* ---------- Ícones de itens ---------- */
function oreIcon(pc: PixelCanvas, kind: string): void {
  shaded(pc, 8, 9, 6, 5, [P.stone0, P.stone1, P.stone2, P.stone3]);
  const [a, b] = ORE_COLORS[kind];
  for (const [x, y] of [[5, 8], [9, 7], [7, 11], [11, 10], [8, 9]]) { pc.set(x, y, a); pc.set(x + 1, y, b); pc.set(x, y + 1, a); }
  done(pc);
}
function barIcon(pc: PixelCanvas, c: [Color, Color, Color, Color]): void {
  // lingote em perspectiva
  for (let y = 0; y < 6; y++) pc.hline(3 + Math.max(0, 2 - y), 12 - Math.max(0, 2 - y), 5 + y, y < 2 ? c[3] : c[2]);
  pc.rect(2, 11, 12, 3, c[1]); pc.hline(2, 13, 13, c[0]);
  pc.hline(4, 11, 5, c[3]); pc.set(5, 7, P.white);
  done(pc);
}
function coalIcon(pc: PixelCanvas): void {
  shaded(pc, 8, 9, 6, 5, [rgb('#0e0c12'), rgb('#1c1a22'), rgb('#2e2c36'), rgb('#4a4856')]);
  pc.set(6, 7, rgb('#6a6876')); pc.set(10, 9, rgb('#3a3844'));
  done(pc);
}
function gemIcon(pc: PixelCanvas, kind: string): void {
  const [a, b, c] = GEM_COLORS[kind];
  // gema facetada (losango com facetas)
  for (let y = 0; y < 12; y++) {
    const w = y < 4 ? 3 + y : 6 - Math.round((y - 4) * 0.75);
    for (let x = 8 - w; x <= 7 + w; x++) {
      let col = x < 8 ? b : a;
      if (y < 4) col = x < 8 ? c : b;
      if (x === 8 - w || x === 7 + w) col = a;
      pc.set(x, 2 + y, col);
    }
  }
  pc.hline(5, 10, 5, c); pc.set(6, 3, P.white); pc.set(7, 4, P.white);
  done(pc);
}

/* ---------- Objetos da mina ---------- */
function ladderDown(pc: PixelCanvas): void {
  pc.ellipse(8, 9, 7.5, 6, rgb('#0a0608'));
  pc.ellipse(8, 8, 6, 4.5, rgb('#020103'));
  for (const x of [5, 10]) pc.vline(x, 4, 12, P.wood2);
  for (let y = 5; y <= 11; y += 3) pc.hline(5, 10, y, P.wood3);
}
function ladderUp(pc: PixelCanvas): void {
  for (const x of [4, 11]) { pc.vline(x, 2, 30, P.wood2); pc.vline(x + 1, 2, 30, P.wood1); }
  for (let y = 5; y < 30; y += 5) pc.hline(4, 12, y, P.wood3);
  done(pc);
}
function elevator(pc: PixelCanvas): void {
  pc.rect(1, 2, 30, 36, P.steel1); pc.rect(3, 6, 26, 32, rgb('#1a161e'));
  for (let x = 4; x < 29; x += 3) pc.vline(x, 6, 37, P.steel2);
  pc.hline(1, 30, 2, P.steel3); pc.rect(1, 0, 30, 4, P.steel0); pc.rect(12, 0, 8, 3, P.gold1);
  pc.rect(26, 18, 3, 5, P.red); pc.set(27, 19, rgb('#ff9a8a'));
  done(pc);
}
function crystal(pc: PixelCanvas, c: Pal3): void {
  const shard = (x: number, h: number, w: number) => {
    for (let y = 0; y < h; y++) {
      const ww = Math.max(1, Math.round(w * (1 - y / h)));
      for (let i = 0; i < ww; i++) pc.set(x + i - Math.floor(ww / 2), 19 - y, i < ww / 2 ? c[1] : c[0]);
    }
    pc.set(x, 19 - h + 1, c[2]);
  };
  shard(8, 15, 4); shard(4, 9, 3); shard(12, 11, 3);
  pc.set(7, 8, c[2]); pc.set(7, 9, c[2]);
  done(pc);
}
function wallTorch(pc: PixelCanvas): void {
  pc.rect(6, 7, 4, 7, P.wood1); pc.hline(5, 10, 7, P.steel1);
  pc.ellipse(8, 4.5, 3, 3.5, rgb('#f2802a')); pc.ellipse(8, 5, 1.6, 2.2, rgb('#ffe066')); pc.set(8, 0, rgb('#f2802a'));
  done(pc);
}
function standTorch(pc: PixelCanvas): void {
  pc.rect(7, 9, 2, 14, P.wood2); pc.vline(7, 9, 22, P.wood3); pc.rect(6, 7, 4, 3, P.wood1);
  pc.ellipse(8, 4.5, 3, 3.5, rgb('#f2802a')); pc.ellipse(8, 5, 1.6, 2.2, rgb('#ffe066')); pc.set(8, 0, rgb('#f2802a'));
  done(pc);
}
function furnace(pc: PixelCanvas, on: boolean): void {
  for (let y = 6; y < 30; y++) for (let x = 2; x < 14; x++) {
    const row = Math.floor(y / 3), off = (row % 2) * 2;
    pc.set(x, y, (y % 3 === 2 || (x + off) % 4 === 0) ? P.stone1 : y % 3 === 0 ? P.stone3 : P.stone2);
  }
  pc.rect(5, 2, 6, 5, P.stone2); pc.hline(5, 10, 2, P.stone3);
  pc.rect(4, 17, 8, 8, rgb('#1a0e0a'));
  if (on) { pc.ellipse(8, 22, 3.5, 3, rgb('#f2602a')); pc.ellipse(8, 22.5, 2, 1.6, rgb('#ffd04a')); }
  pc.hline(4, 11, 17, P.stone3);
  done(pc);
}
function bigRock(pc: PixelCanvas): void {
  shaded(pc, 8, 9.5, 7, 5.5, [rgb('#5a5458'), rgb('#7e7880'), rgb('#a29ca4'), rgb('#c8c2c8')]);
  pc.line(6, 8, 8, 10, rgb('#5a5458')); pc.set(11, 11, rgb('#5a5458'));
  done(pc);
}
function rockPile(pc: PixelCanvas, n: number): void {
  const c: [Color, Color, Color, Color] = [rgb('#5a5458'), rgb('#7e7880'), rgb('#a29ca4'), rgb('#c8c2c8')];
  const spots: [number, number, number][] = [[8, 12, 5], [4, 12, 3.5], [12, 12, 3.5], [8, 8, 4], [5, 8, 3], [11, 8, 3]];
  for (let i = 0; i < Math.min(spots.length, 2 + n * 2); i++) { const [x, y, r] = spots[i]; shaded(pc, x, y, r, r * 0.8, c); }
  done(pc);
}
function bubble(pc: PixelCanvas): void {
  pc.rect(1, 1, 16, 14, P.white); pc.set(1, 1, 0); pc.set(16, 1, 0); pc.set(1, 14, 0); pc.set(16, 14, 0);
  pc.set(7, 15, P.white); pc.set(8, 15, P.white); pc.set(8, 16, P.white);
  pc.outline(() => P.uiOut);
}
function minecart(pc: PixelCanvas): void {
  pc.rect(2, 6, 20, 10, P.steel1); pc.hline(2, 21, 6, P.steel3); pc.rect(4, 8, 16, 6, P.steel0);
  pc.ellipse(7, 7, 3, 2, P.stone2); pc.ellipse(13, 7, 3, 2.5, P.stone3); pc.set(16, 6, ORE_COLORS.copper[1]);
  pc.circle(6, 17, 2.5, P.steel0); pc.circle(18, 17, 2.5, P.steel0);
  done(pc);
}
function caveEntrance(pc: PixelCanvas): void {
  // arco de rocha com boca escura e vigas de madeira
  for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
    const nx = (x - 32) / 32, ny = (y - 48) / 46;
    if (nx * nx + ny * ny > 1) continue;
    const l = -(nx * 0.6 + ny * 0.8);
    pc.set(x, y, l > 0.7 ? rgb('#8a7e84') : l > 0.3 ? rgb('#6e6268') : rgb('#4e444a'));
  }
  pc.ellipse(32, 48, 15, 22, rgb('#0a0608'));
  pc.rect(16, 24, 4, 24, P.wood1); pc.rect(44, 24, 4, 24, P.wood1); pc.rect(14, 22, 36, 4, P.wood2); pc.hline(14, 49, 22, P.wood3);
  done(pc);
}

/** Ícones dos minerais (nomes e preços ficam em data/mine.ts). */
const MINERAL_ICONS: Record<string, (pc: PixelCanvas) => void> = {
  copper_ore: (pc) => oreIcon(pc, 'copper'), iron_ore: (pc) => oreIcon(pc, 'iron'), gold_ore: (pc) => oreIcon(pc, 'gold'),
  coal: coalIcon,
  copper_bar: (pc) => barIcon(pc, [P.copper0, P.copper1, P.copper2, P.copper3]),
  iron_bar: (pc) => barIcon(pc, [P.iron0, P.iron1, P.iron2, P.iron3]),
  gold_bar: (pc) => barIcon(pc, [P.goldT0, P.goldT1, P.goldT2, P.goldT3]),
  quartz: (pc) => gemIcon(pc, 'quartz'), amethyst: (pc) => gemIcon(pc, 'amethyst'), topaz: (pc) => gemIcon(pc, 'topaz'),
  emerald: (pc) => gemIcon(pc, 'emerald'), ruby: (pc) => gemIcon(pc, 'ruby'), diamond: (pc) => gemIcon(pc, 'diamond'),
};

export function addMine(ab: AtlasBuilder): void {
  for (const [id, fn] of Object.entries(MINERAL_ICONS)) ab.add(`item_${id}`, 16, 16, fn);
  ab.add('ladder_down', 16, 16, ladderDown);
  ab.add('ladder_up', 16, 32, ladderUp);
  ab.add('elevator', 32, 40, elevator);
  const cc: Pal3[] = [[rgb('#2a6ab8'), rgb('#6ab8f0'), rgb('#e0f6ff')], [rgb('#6a2a9a'), rgb('#a85ad8'), rgb('#f0d0ff')], [rgb('#1e7a4a'), rgb('#4ad08a'), rgb('#d0ffe6')]];
  cc.forEach((c, i) => ab.add(`crystal_${i}`, 16, 20, (pc) => crystal(pc, c)));
  ab.add('walltorch', 16, 16, wallTorch);
  ab.add('torch', 16, 24, standTorch);
  ab.add('item_torch', 16, 16, (pc) => { const t = new PixelCanvas(16, 24); standTorch(t); pc.blit(t, 0, -4, false, 0, 0, 16, 20); });
  ab.add('furnace', 16, 32, (pc) => furnace(pc, false));
  ab.add('furnace_on', 16, 32, (pc) => furnace(pc, true));
  ab.add('item_furnace', 16, 16, (pc) => { const t = new PixelCanvas(16, 32); furnace(t, true); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(x, y, t.get(x, y * 2 > 31 ? 31 : y * 2)); });
  ab.add('bigrock', 16, 16, bigRock);
  for (let n = 0; n < 3; n++) ab.add(`rockpile_${n}`, 16, 16, (pc) => rockPile(pc, n));
  ab.add('bubble', 18, 18, bubble);
  ab.add('minecart', 24, 20, minecart);
  ab.add('cave', 64, 48, caveEntrance);
  void mix;
}
