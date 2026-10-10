import { G } from '../state';
import type { WObj } from '../data/objects';
import { SMELT, SMELT_RECIPES } from '../data/mine';
import { countItem, removeItem } from './Inventory';

/** Minutos absolutos de jogo (dias contínuos), para máquinas que atravessam a noite. */
export function absMin(): number {
  const t = G.time;
  const days = ((t.year - 1) * 4 + t.season) * 28 + (t.day - 1);
  return days * 1440 + t.min;
}

export function machineReady(o: WObj): boolean { return !!o.m && absMin() >= o.m.until; }
export function machineWorking(o: WObj): boolean { return !!o.m && absMin() < o.m.until; }
export function minutesLeft(o: WObj): number { return o.m ? Math.max(0, o.m.until - absMin()) : 0; }

export function startMachine(o: WObj, out: string, q: number, minutes: number): void {
  o.m = { out, q, until: absMin() + minutes };
}

/** Minério que pode ser fundido agora (prefere o selecionado). */
export function smeltableOre(preferred?: string): string | null {
  if (countItem('coal') < SMELT.coal) return null;
  if (preferred && SMELT_RECIPES[preferred] && countItem(preferred) >= SMELT.ore) return preferred;
  for (const ore of Object.keys(SMELT_RECIPES)) if (countItem(ore) >= SMELT.ore) return ore;
  return null;
}

/** Carrega a fornalha: consome 5 minérios + 1 carvão. */
export function loadFurnace(o: WObj, ore: string): boolean {
  if (o.m || !SMELT_RECIPES[ore] || countItem(ore) < SMELT.ore || countItem('coal') < SMELT.coal) return false;
  removeItem(ore, SMELT.ore);
  removeItem('coal', SMELT.coal);
  startMachine(o, SMELT_RECIPES[ore], 1, SMELT.minutes);
  return true;
}
