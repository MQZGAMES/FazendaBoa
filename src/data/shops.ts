import { CROPS } from './crops';

/** Item à venda. `upgrade` = melhoria especial (ex.: mochila) em vez de item. */
export interface ShopItem {
  id: string;
  price: number;
  /** estações em que aparece (vazio = sempre) */
  seasons?: number[];
  upgrade?: 'backpack24' | 'backpack36';
  name?: string;
  desc?: string;
}

/** Horário da loja (seção 10): 9:00–17:00, fechada às quartas. */
export const SHOP_OPEN = 9 * 60;
export const SHOP_CLOSE = 17 * 60;
export const SHOP_CLOSED_WEEKDAY = 2; // quarta

/** Mochila: 12 → 24 (2.000g) → 36 (10.000g). */
export const BACKPACK_SIZES = [12, 24, 36];

export const GENERAL_STORE: ShopItem[] = [
  ...CROPS.map((c) => ({ id: c.seed, price: c.seedPrice, seasons: c.seasons })),
  { id: 'fertilizer', price: 100 },
  { id: 'acorn', price: 120 },
  { id: 'maple_seed', price: 80 },
  { id: 'pinecone', price: 80 },
  { id: 'backpack', price: 2000, upgrade: 'backpack24', name: 'Mochila grande', desc: 'Aumenta a mochila para 24 slots.' },
  { id: 'backpack', price: 10000, upgrade: 'backpack36', name: 'Mochila de luxo', desc: 'Aumenta a mochila para 36 slots.' },
];
