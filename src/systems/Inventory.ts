import { G, type ItemStack } from '../state';
import { ITEMS, MAX_STACK } from '../data/items';
import { bus } from './EventBus';

/** Ferramentas não empilham. */
function stackable(id: string): boolean { return ITEMS[id]?.cat !== 'tool'; }

/** Adiciona ao inventário; retorna a quantidade que não coube. */
export function addItem(id: string, q = 1, ql = 0, inv: (ItemStack | null)[] = G.player.inv): number {
  let left = q;
  if (stackable(id)) {
    for (let i = 0; i < inv.length && left > 0; i++) {
      const s = inv[i];
      if (s && s.id === id && (s.ql ?? 0) === ql && s.q < MAX_STACK) {
        const add = Math.min(left, MAX_STACK - s.q);
        s.q += add; left -= add;
      }
    }
  }
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (!inv[i]) {
      const add = stackable(id) ? Math.min(left, MAX_STACK) : 1;
      inv[i] = ql ? { id, q: add, ql } : { id, q: add };
      left -= add;
    }
  }
  if (left !== q && inv === G.player.inv) bus.emit('inventory');
  return left;
}

export function canAdd(id: string, ql = 0, inv: (ItemStack | null)[] = G.player.inv): boolean {
  for (const s of inv) {
    if (!s) return true;
    if (stackable(id) && s.id === id && (s.ql ?? 0) === ql && s.q < MAX_STACK) return true;
  }
  return false;
}

export function countItem(id: string, inv: (ItemStack | null)[] = G.player.inv): number {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.q;
  return n;
}

/** Remove q unidades (qualquer qualidade, menor qualidade primeiro). */
export function removeItem(id: string, q = 1, inv: (ItemStack | null)[] = G.player.inv): boolean {
  if (countItem(id, inv) < q) return false;
  let left = q;
  for (let ql = 0; ql <= 2 && left > 0; ql++) {
    for (let i = 0; i < inv.length && left > 0; i++) {
      const s = inv[i];
      if (!s || s.id !== id || (s.ql ?? 0) !== ql) continue;
      const take = Math.min(left, s.q);
      s.q -= take; left -= take;
      if (s.q <= 0) inv[i] = null;
    }
  }
  if (inv === G.player.inv) bus.emit('inventory');
  return true;
}

/** Remove do slot específico. */
export function takeFromSlot(i: number, q = 1): void {
  const s = G.player.inv[i];
  if (!s) return;
  s.q -= q;
  if (s.q <= 0) G.player.inv[i] = null;
  bus.emit('inventory');
}

export function selected(): ItemStack | null { return G.player.inv[G.player.sel] ?? null; }

/** Índice do primeiro slot com o item. */
export function slotOf(id: string): number {
  return G.player.inv.findIndex((s) => s?.id === id);
}
