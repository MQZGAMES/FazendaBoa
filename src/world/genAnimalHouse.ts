import { Location, T } from './Location';
import { BUILDINGS, type BuildingKind } from '../data/animals';
import { OBJ } from '../data/objects';

/** Interior do galinheiro/celeiro: paredes, piso de madeira, cochos e porta para a fazenda. */
export function generateAnimalHouse(kind: BuildingKind, anchor: number, farmW: number, level: number): Location {
  const def = BUILDINGS[kind];
  const [W, H] = def.inside;
  const L = new Location(`${kind}:${anchor}`, W, H);
  L.outdoor = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L.terrain[L.idx(x, y)] = y < 2 ? T.Wall : T.Floor;
  const cap = def.capacity[level ? 1 : 0];
  for (let i = 0; i < cap; i++) L.place(1 + i, 2, { k: 'trough', v: 0, g: 0 });
  L.place(W - 2, 1, { k: 'window', v: 0 });
  // porta: volta para a frente da porta da construção na fazenda
  const ax = anchor % farmW, ay = Math.floor(anchor / farmW);
  const door = OBJ[kind].door!;
  const fx = ax + door.dx[0], fy = ay + door.dy + 1;
  const ex = Math.floor(W / 2) - 1;
  L.exits.push({ x: ex, y: H - 1, w: 2, h: 1, to: 'farm', tx: fx * 16 + 8, ty: fy * 16 + 13, label: 'Fazenda' });
  L.extra.kind = kind;
  L.extra.home = anchor;
  L.extra.spawn = [(ex + 1) * 16, (H - 2) * 16 + 13];
  L.refreshAllSolid();
  return L;
}

/** Garante a quantidade de cochos ao ampliar a construção. */
export function ensureTroughs(L: Location, kind: BuildingKind, level: number): void {
  const cap = BUILDINGS[kind].capacity[level ? 1 : 0];
  for (let i = 0; i < cap; i++) if (!L.objAt(1 + i, 2)) L.place(1 + i, 2, { k: 'trough', v: 0, g: 0 });
}
