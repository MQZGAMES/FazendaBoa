import { Location, T } from './Location';
import { Rng, fbm, valueNoise } from '../art/rng';
import type { WObj } from '../data/objects';

export const FARM_W = 80, FARM_H = 65;
/** Casa: âncora da base 6x3 e porta. */
export const HOUSE_POS = { x: 36, y: 8 };
export const HOUSE_DOOR = { x: 38, y: 10 };
export const FARM_SPAWN = { x: 39 * 16, y: 12 * 16 + 8 };
export const BIN_POS = { x: 43, y: 10 };

/** Largura do mar ao redor da ilha (tiles). */
export const ISLAND_SEA = 3;

/** A fazenda é uma ilha: bordas sem saída terminam em água (caminhos de saída viram pontes de terra). */
export function applyIslandBorder(L: Location): void {
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const edge = Math.min(x, y, L.w - 1 - x, L.h - 1 - y);
    if (edge >= ISLAND_SEA) continue;
    const i = L.idx(x, y);
    if (L.terrain[i] === T.Dirt) continue;
    const hit = L.objAt(x, y);
    if (hit) L.remove(hit.i);
    L.crops.delete(i);
    L.soil[i] = 0;
    L.terrain[i] = T.Water;
  }
  L.refreshAllSolid();
}

/** Gera a fazenda inicial cheia de mato, pedras, galhos e tocos, com rio a leste. */
export function generateFarm(seed: number): Location {
  const L = new Location('farm', FARM_W, FARM_H);
  const rng = new Rng(seed);
  const W = FARM_W, H = FARM_H;
  const reserved = new Uint8Array(W * H); // caminhos e áreas livres
  const setT = (x: number, y: number, t: number) => { if (L.inb(x, y)) L.terrain[L.idx(x, y)] = t; };
  const reserve = (x: number, y: number) => { if (L.inb(x, y)) reserved[L.idx(x, y)] = 1; };

  // Rio a leste (de norte a sul), sinuoso
  const riverC = (y: number) => 69 + Math.sin(y / 9 + seed) * 3 + Math.sin(y / 4.1) * 0.8;
  for (let y = 0; y < H; y++) {
    const c = riverC(y);
    for (let x = Math.floor(c - 1.6); x <= Math.ceil(c + 2.2); x++) setT(x, y, T.Water);
  }
  // Lago a sudoeste
  for (let y = 44; y < 58; y++) for (let x = 6; x < 24; x++) {
    const dx = (x - 14.5) / 7, dy = (y - 50.5) / 4.6;
    if (dx * dx + dy * dy + (valueNoise(x / 3, y / 3, seed + 5) - 0.5) * 0.5 < 1) setT(x, y, T.Water);
  }

  // Caminhos de terra
  const path = (pts: [number, number][], wdt: number) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) {
        const t = steps ? s / steps : 0;
        const cx = Math.round(x0 + (x1 - x0) * t + (Math.sin(s * 0.7 + k) > 0.6 ? 1 : 0) * 0), cy = Math.round(y0 + (y1 - y0) * t);
        for (let j = 0; j < wdt; j++) for (let i = 0; i < wdt; i++) {
          const xx = cx + i - Math.floor(wdt / 2), yy = cy + j - Math.floor(wdt / 2);
          if (L.terrainAt(xx, yy) !== T.Water) setT(xx, yy, T.Dirt);
          reserve(xx, yy);
          reserve(xx - 1, yy); reserve(xx + 1, yy); reserve(xx, yy - 1); reserve(xx, yy + 1);
        }
      }
    }
  };
  path([[39, 11], [39, 20], [39, 40], [39, 64]], 3);      // casa → vila (sul)
  path([[39, 22], [20, 22], [10, 31], [0, 31]], 2);         // → floresta (oeste)
  path([[33, 9], [26, 7], [24, 3], [24, 0]], 2);             // → mina (norte)
  applyIslandBorder(L);
  // terreiro em frente à casa
  for (let y = 11; y < 15; y++) for (let x = 35; x < 44; x++) { if ((x === 35 || x === 43) && (y === 14)) continue; setT(x, y, T.Dirt); }

  // Área livre ao redor da casa
  for (let y = 4; y < 22; y++) for (let x = 30; x < 50; x++) reserve(x, y);

  // Construções fixas
  L.place(HOUSE_POS.x, HOUSE_POS.y, { k: 'house', v: 0 });
  L.place(BIN_POS.x, BIN_POS.y, { k: 'bin', v: 0 });
  L.place(35, 10, { k: 'mailbox', v: 0 });

  // Saídas
  L.exits.push({ x: 37, y: H - 1, w: 5, h: 1, to: 'town', tx: 0, ty: 0, label: 'Vila' });
  L.exits.push({ x: 0, y: 29, w: 1, h: 5, to: 'forest', tx: 0, ty: 0, label: 'Floresta' });
  L.exits.push({ x: 22, y: 0, w: 5, h: 1, to: 'mine', tx: 0, ty: 0, label: 'Mina' });

  const free = (x: number, y: number) => L.inb(x, y) && !reserved[L.idx(x, y)] && L.terrainAt(x, y) === T.Grass && !L.occ[L.idx(x, y)];
  const nearWater = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (L.terrainAt(x + i, y + j) === T.Water) return true;
    return false;
  };
  const treeType = () => { const r = rng.next(); return r < 0.45 ? 0 : r < 0.75 ? 1 : 2; };
  const tree = (x: number, y: number) => { if (free(x, y) && !nearWater(x, y)) L.place(x, y, { k: 'tree', v: 0, t: treeType(), hp: 10 }); };

  // Borda de floresta densa
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < ISLAND_SEA || edge > ISLAND_SEA + 2) continue;
    if (L.exitAt(x, y)) continue;
    if ((x + y * 2) % 3 === 0 || rng.chance(0.35)) tree(x, y);
  }
  // Bosques e entulho
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (!free(x, y)) continue;
    const forest = fbm(x / 14, y / 14, seed + 11, 3);
    const dHouse = Math.hypot(x - 39, (y - 12) * 1.2);
    const far = Math.min(1, Math.max(0, (dHouse - 8) / 20));
    if (forest > 0.62 && rng.chance(0.3)) { tree(x, y); continue; }
    if (nearWater(x, y)) { if (rng.chance(0.12)) L.place(x, y, { k: 'tallgrass', v: rng.int(0, 1) }); continue; }
    const r = rng.next();
    const dens = 0.12 + far * 0.3;
    if (r < dens * 0.45) L.place(x, y, { k: 'weed', v: rng.int(0, 2), hp: 1 });
    else if (r < dens * 0.7) L.place(x, y, { k: 'stone', v: rng.int(0, 1), hp: 1 });
    else if (r < dens * 0.85) L.place(x, y, { k: 'twig', v: rng.int(0, 1), hp: 1 });
    else if (r < dens) {
      const g = fbm(x / 6, y / 6, seed + 3, 2);
      if (g > 0.5) L.place(x, y, { k: 'tallgrass', v: rng.int(0, 1) });
      else L.place(x, y, { k: 'flowers', v: rng.int(0, 2) });
    } else if (r < dens + 0.004 * far) {
      if (free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) L.place(x, y, { k: 'stump', v: 0, hp: 10 } as WObj);
    } else if (r < dens + 0.007 * far) {
      if (free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) L.place(x, y, { k: 'boulder', v: 0, hp: 8 });
    } else if (r < dens + 0.012 * far) {
      if (free(x + 1, y)) L.place(x, y, { k: 'bush', v: 0 });
    }
  }
  // Grama alta em manchas
  for (let k = 0; k < 18; k++) {
    const cx = rng.int(6, W - 8), cy = rng.int(6, H - 8);
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      if (i * i + j * j > 9 || !rng.chance(0.6)) continue;
      if (free(cx + i, cy + j)) L.place(cx + i, cy + j, { k: 'tallgrass', v: rng.int(0, 1) });
    }
  }
  L.refreshAllSolid();
  return L;
}
