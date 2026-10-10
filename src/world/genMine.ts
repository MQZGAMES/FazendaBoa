import { Location, T } from './Location';
import { Rng } from '../art/rng';
import { MINE_ROCKS, ELEVATOR_EVERY, LAKE_FLOOR, MINE_FLOORS } from '../data/mine';

/** Sala de entrada da mina (ao norte da fazenda): escada para o andar 1, elevador e saída. */
export const MINE_ENTRY = { x: 10 * 16 + 8, y: 13 * 16 + 13 };

export function generateMineEntrance(): Location {
  const W = 20, H = 16;
  const L = new Location('mine', W, H);
  L.outdoor = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - 10) / 8.5, dy = (y + 0.5 - 8.5) / 6.5;
    L.terrain[L.idx(x, y)] = dx * dx + dy * dy <= 1 || (y >= 12 && x >= 8 && x <= 11) ? T.Cave : T.Rock;
  }
  L.place(9, 6, { k: 'ladder', v: 0 });
  L.place(13, 5, { k: 'elevator', v: 0 });
  L.place(5, 6, { k: 'minecart', v: 0 });
  L.place(6, 9, { k: 'crystal', v: 0 });
  L.place(14, 10, { k: 'crystal', v: 1 });
  for (const [x, y] of [[4, 4], [15, 3], [8, 2], [12, 2]]) L.place(x, y, { k: 'walltorch', v: 0 });
  L.exits.push({ x: 8, y: H - 1, w: 4, h: 1, to: 'farm', tx: 24 * 16 + 8, ty: 2 * 16 + 13, label: 'Fazenda' });
  L.extra.floor = 0;
  L.refreshAllSolid();
  return L;
}

/** Sorteia o tipo de rocha para o andar. */
function pickRock(n: number, rng: Rng): number {
  const opts = MINE_ROCKS.map((r, i) => ({ i, w: n >= r.floors[0] && n <= r.floors[1] ? r.weight : 0 }));
  let t = opts.reduce((a, o) => a + o.w, 0) * rng.next();
  for (const o of opts) { t -= o.w; if (t <= 0) return o.i; }
  return 0;
}

/**
 * Andar N (1..40), gerado a cada visita: caverna esculpida por "andarilhos",
 * suavizada por autômato celular, com rochas/minérios conforme a profundidade.
 */
export function generateMineFloor(n: number, seed: number): Location {
  const lake = n === LAKE_FLOOR;
  const W = lake ? 34 : 30, H = lake ? 30 : 26;
  const L = new Location(`mine:${n}`, W, H);
  L.outdoor = false;
  const rng = new Rng(seed * 31 + n * 977);
  const floor = new Uint8Array(W * H);
  const carve = (x: number, y: number) => { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const xx = x + i, yy = y + j; if (xx > 1 && yy > 1 && xx < W - 2 && yy < H - 2) floor[yy * W + xx] = 1; } };
  const ax = Math.floor(W / 2), ay = 4;
  for (let wk = 0; wk < 6; wk++) {
    let x = wk === 0 ? ax : rng.int(5, W - 6), y = wk === 0 ? ay : rng.int(5, H - 6);
    for (let s = 0; s < 240; s++) {
      carve(x, y);
      const d = rng.int(0, 3);
      x += d === 0 ? 1 : d === 1 ? -1 : 0; y += d === 2 ? 1 : d === 3 ? -1 : 0;
      x = Math.max(2, Math.min(W - 4, x)); y = Math.max(2, Math.min(H - 4, y));
    }
  }
  // liga o centro de cada andarilho ao ponto de chegada (garante conexão)
  for (let k = 0; k < 4; k++) {
    let x = ax, y = ay;
    const tx = rng.int(4, W - 5), ty = rng.int(6, H - 5);
    while (x !== tx || y !== ty) { carve(x, y); if (x !== tx && (rng.chance(0.5) || y === ty)) x += Math.sign(tx - x); else y += Math.sign(ty - y); }
  }
  // suavização
  for (let it = 0; it < 2; it++) {
    const next = floor.slice();
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      let c = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c += floor[(y + j) * W + x + i];
      next[y * W + x] = c >= 5 ? 1 : c <= 2 ? 0 : floor[y * W + x];
    }
    floor.set(next);
  }
  for (let j = -1; j <= 2; j++) for (let i = -2; i <= 2; i++) floor[(ay + j) * W + ax + i] = 1;
  for (let i = 0; i < W * H; i++) L.terrain[i] = floor[i] ? T.Cave : T.Rock;
  if (lake) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / 9, dy = (y + 0.5 - H / 2 - 2) / 6;
      const d = dx * dx + dy * dy;
      if (d <= 1) L.terrain[L.idx(x, y)] = T.Water;
      else if (d <= 1.9) L.terrain[L.idx(x, y)] = T.Cave;
    }
  }
  // chegada
  L.place(ax, ay - 1, { k: 'ladderup', v: 0 });
  if (n % ELEVATOR_EVERY === 0) L.place(ax + 2, ay - 1, { k: 'elevator', v: 0 });
  L.extra.floor = n;
  L.extra.broken = 0;
  L.extra.spawn = [ax * 16 + 8, (ay + 1) * 16 + 13];
  // rochas, cristais e pedras grandes
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = L.idx(x, y);
    if (L.terrain[i] !== T.Cave || L.occ[i]) continue;
    if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) continue;
    const r = rng.next();
    if (r < 0.38) {
      const k = pickRock(n, rng);
      L.place(x, y, { k: 'ore', v: rng.int(0, 1), t: k, hp: MINE_ROCKS[k].hp });
    } else if (r < 0.4) L.place(x, y, { k: 'crystal', v: rng.int(0, 2), hp: 2 });
    else if (r < 0.43) L.place(x, y, { k: 'bigrock', v: 0, hp: 2 });
  }
  // tochas nas paredes viradas para o piso
  let torches = 0;
  for (let tries = 0; tries < 400 && torches < 5; tries++) {
    const x = rng.int(2, W - 3), y = rng.int(2, H - 3);
    if (L.terrainAt(x, y) === T.Rock && L.terrainAt(x, y + 1) === T.Cave && L.place(x, y, { k: 'walltorch', v: 0 })) torches++;
  }
  if (n >= MINE_FLOORS) L.extra.ladder = 1; // último andar: sem escada para baixo
  L.refreshAllSolid();
  return L;
}
