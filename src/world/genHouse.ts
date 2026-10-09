import { Location, T } from './Location';

export const HOUSE_W = 12, HOUSE_H = 10;
/** Onde o jogador aparece ao entrar e ao acordar. */
export const HOUSE_ENTRY = { x: 6 * 16, y: 8 * 16 + 12 };
export const HOUSE_WAKE = { x: 3 * 16 + 8, y: 5 * 16 + 4 };
export const BED_POS = { x: 1, y: 3 };

/** Interior da casa: paredes, piso de madeira, cama, TV e móveis. */
export function generateHouse(): Location {
  const L = new Location('house', HOUSE_W, HOUSE_H);
  L.outdoor = false;
  for (let y = 0; y < HOUSE_H; y++) for (let x = 0; x < HOUSE_W; x++) L.terrain[L.idx(x, y)] = y < 3 ? T.Wall : T.Floor;
  L.place(2, 1, { k: 'window', v: 0 });
  L.place(9, 1, { k: 'window', v: 0 });
  L.place(5, 2, { k: 'fireplace', v: 0 });
  L.place(BED_POS.x, BED_POS.y, { k: 'bed', v: 0 });
  L.place(3, 3, { k: 'lamp', v: 0 });
  L.place(9, 3, { k: 'tv', v: 0 });
  L.place(10, 3, { k: 'shelf', v: 0 });
  L.place(4, 5, { k: 'rug', v: 0 });
  L.place(8, 6, { k: 'table', v: 0 });
  L.place(7, 6, { k: 'chair', v: 0 });
  L.place(10, 8, { k: 'plant', v: 0 });
  L.place(1, 8, { k: 'plant', v: 0 });
  L.exits.push({ x: 5, y: 9, w: 2, h: 1, to: 'farm', tx: 39 * 16, ty: 11 * 16 + 10, label: 'Fazenda' });
  L.refreshAllSolid();
  return L;
}
