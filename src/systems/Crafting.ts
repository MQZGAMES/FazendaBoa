import { G, type ItemStack } from '../state';
import type { Location } from '../world/Location';
import { countItem, removeItem } from './Inventory';

/** Referência ao mapa atual e posição do jogador (para contar baús próximos). */
let worldRef: { loc: Location; tx: number; ty: number } | null = null;
export function setWorldRef(loc: Location, tx: number, ty: number): void {
  if (!worldRef) worldRef = { loc, tx, ty };
  else { worldRef.loc = loc; worldRef.tx = tx; worldRef.ty = ty; }
}

/** Raio (tiles) em que baús contam como ingredientes na fabricação. */
export const CHEST_RADIUS = 8;

/** Inventários de baús perto do jogador. */
export function nearbyChests(): (ItemStack | null)[][] {
  if (!worldRef) return [];
  const { loc, tx, ty } = worldRef;
  const out: (ItemStack | null)[][] = [];
  for (const [i, o] of loc.objs) {
    if (o.k !== 'chest' || !o.inv) continue;
    const x = i % loc.w, y = Math.floor(i / loc.w);
    if (Math.abs(x - tx) <= CHEST_RADIUS && Math.abs(y - ty) <= CHEST_RADIUS) out.push(o.inv);
  }
  return out;
}

/** Quantidade disponível: mochila + baús próximos. */
export function countAvailable(id: string): number {
  let n = countItem(id);
  for (const inv of nearbyChests()) n += countItem(id, inv);
  return n;
}

/** Consome da mochila primeiro e depois dos baús próximos. */
export function consume(id: string, q: number): boolean {
  if (countAvailable(id) < q) return false;
  let left = q;
  const fromInv = Math.min(left, countItem(id));
  if (fromInv > 0) { removeItem(id, fromInv); left -= fromInv; }
  for (const inv of nearbyChests()) {
    if (left <= 0) break;
    const take = Math.min(left, countItem(id, inv));
    if (take > 0) { removeItem(id, take, inv); left -= take; }
  }
  return left <= 0;
}

void G;
