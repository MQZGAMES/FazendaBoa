import { Location, T } from './Location';
import { Rng } from '../art/rng';
import { ISLAND_SEA, applyIslandBorder } from './genFarm';

export const TOWN_W = 48, TOWN_H = 46;
/** Chegada vinda da fazenda (topo da vila). */
export const TOWN_FROM_FARM = { x: 24 * 16 + 8, y: 3 * 16 + 13 };

/**
 * Vila ao sul da fazenda. As fachadas ficam voltadas para o sul (vista 3/4),
 * então cada construção fica ao norte de uma rua de paralelepípedos:
 * rua de cima (casarão e loja), praça com fonte, rua de baixo (ferreiro e casas).
 */
export function generateTown(seed: number): Location {
  const L = new Location('town', TOWN_W, TOWN_H);
  const rng = new Rng(seed + 991);
  const W = TOWN_W, H = TOWN_H;
  const setT = (x: number, y: number, t: number) => { if (L.inb(x, y)) L.terrain[L.idx(x, y)] = t; };
  const rect = (x0: number, y0: number, w: number, h: number, t = T.Stone) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(x, y, t); };
  rect(23, 0, 3, 15, T.Dirt);       // estrada da fazenda (terra)
  rect(6, 15, 37, 2);               // rua de cima
  for (let y = 17; y < 29; y++) for (let x = 14; x < 35; x++) {
    const dx = (x + 0.5 - 24.5) / 9, dy = (y + 0.5 - 22.5) / 5.6;
    if (dx * dx + dy * dy <= 1) setT(x, y, T.Stone);
  }
  rect(23, 17, 3, 15);              // praça → rua de baixo
  rect(6, 32, 37, 2);               // rua de baixo
  applyIslandBorder(L);

  // rua de cima: casarão (noroeste) e loja (nordeste)
  L.place(7, 11, { k: 'manor', v: 0, g: 0 });
  L.place(29, 12, { k: 'shop', v: 0 });
  // praça
  L.place(23, 21, { k: 'fountain', v: 0 });
  for (const [x, y] of [[18, 24], [29, 24]]) L.place(x, y, { k: 'bench', v: 0 });
  // rua de baixo: ferreiro e casas
  L.place(8, 29, { k: 'smith', v: 0 });
  L.place(31, 29, { k: 'house', v: 1 });
  L.place(37, 29, { k: 'house', v: 2 });
  for (const [x, y] of [[6, 14], [19, 14], [27, 14], [42, 14], [6, 31], [21, 31], [27, 31], [42, 31], [22, 9], [26, 9]]) L.place(x, y, { k: 'lamppost', v: 0 });
  for (const [x, y, v] of [[28, 14, 0], [36, 14, 1], [15, 31, 2], [16, 31, 0], [19, 18, 1], [29, 18, 2]]) L.place(x, y, { k: 'flowerbed', v });
  L.place(21, 5, { k: 'sign', v: 0 });

  // árvores na borda e vegetação
  const free = (x: number, y: number) => L.inb(x, y) && L.terrainAt(x, y) === T.Grass && !L.occ[L.idx(x, y)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < ISLAND_SEA || !free(x, y)) continue;
    if (edge <= ISLAND_SEA + 1) { if ((x + y) % 2 === 0 || rng.chance(0.4)) L.place(x, y, { k: 'tree', v: 0, t: rng.int(0, 2), hp: 10 }); continue; }
    const nearRoad = [[0, 1], [1, 0], [0, -1], [-1, 0], [0, 2]].some(([i, j]) => L.terrainAt(x + i, y + j) !== T.Grass);
    if (nearRoad) continue;
    const r = rng.next();
    if (r < 0.03) L.place(x, y, { k: 'tree', v: 0, t: rng.int(0, 2), hp: 10 });
    else if (r < 0.07) L.place(x, y, { k: 'flowers', v: rng.int(0, 2) });
    else if (r < 0.085) L.place(x, y, { k: 'bush', v: 0 });
  }
  L.exits.push({ x: 22, y: 0, w: 5, h: 1, to: 'farm', tx: 39 * 16 + 8, ty: 62 * 16 + 13, label: 'Fazenda' });
  L.refreshAllSolid();
  return L;
}
