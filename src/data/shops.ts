import { CROPS } from './crops';
import { ANIMALS, BUILDINGS, HAY_PRICE } from './animals';

/** Item à venda. `upgrade` = melhoria especial (ex.: mochila) em vez de item. */
export type ShopTab = 'seeds' | 'items' | 'animals' | 'build';
export const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: 'seeds', label: 'Sementes' }, { id: 'items', label: 'Itens' }, { id: 'animals', label: 'Animais' }, { id: 'build', label: 'Obras' },
];

export interface ShopItem {
  tab: ShopTab;
  id: string;
  price: number;
  /** estações em que aparece (vazio = sempre) */
  seasons?: number[];
  upgrade?: 'backpack24' | 'backpack36' | 'coop' | 'barn' | 'coop_up' | 'barn_up';
  /** animal à venda */
  animal?: 'chicken' | 'cow';
  /** materiais exigidos (construções) */
  mats?: Record<string, number>;
  icon?: string;
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
  ...CROPS.map((c) => ({ tab: 'seeds' as ShopTab, id: c.seed, price: c.seedPrice, seasons: c.seasons })),
  { tab: 'seeds', id: 'acorn', price: 120 },
  { tab: 'seeds', id: 'maple_seed', price: 80 },
  { tab: 'seeds', id: 'pinecone', price: 80 },
  { tab: 'items', id: 'fertilizer', price: 100 },
  { tab: 'items', id: 'hay', price: HAY_PRICE },
  { tab: 'items', id: 'bucket', price: 1000, desc: 'Balde para tirar leite das vacas.' },
  { tab: 'items', id: 'backpack', price: 2000, upgrade: 'backpack24', name: 'Mochila grande', desc: 'Aumenta a mochila para 24 slots.' },
  { tab: 'items', id: 'backpack', price: 10000, upgrade: 'backpack36', name: 'Mochila de luxo', desc: 'Aumenta a mochila para 36 slots.' },
  { tab: 'animals', id: 'chicken', animal: 'chicken', price: ANIMALS.chicken.price, name: 'Galinha', icon: 'chicken0_s_idle0', desc: 'Bota um ovo por dia se alimentada. Precisa de galinheiro.' },
  { tab: 'animals', id: 'cow', animal: 'cow', price: ANIMALS.cow.price, name: 'Vaca', icon: 'cow0_s_idle0', desc: 'Dá leite todo dia (use o balde). Precisa de celeiro.' },
  { tab: 'build', id: 'coop', upgrade: 'coop', price: BUILDINGS.coop.price, mats: { wood: BUILDINGS.coop.wood, stone: BUILDINGS.coop.stone }, name: 'Galinheiro', icon: 'icon_coop', desc: 'Casa para 4 galinhas. Você escolhe o local na fazenda.' },
  { tab: 'build', id: 'barn', upgrade: 'barn', price: BUILDINGS.barn.price, mats: { wood: BUILDINGS.barn.wood, stone: BUILDINGS.barn.stone }, name: 'Celeiro', icon: 'icon_barn', desc: 'Casa para 4 vacas. Você escolhe o local na fazenda.' },
  { tab: 'build', id: 'coop_up', upgrade: 'coop_up', price: BUILDINGS.coop.upgrade.price, mats: { wood: BUILDINGS.coop.upgrade.wood, stone: BUILDINGS.coop.upgrade.stone }, name: 'Galinheiro grande', icon: 'icon_coop', desc: 'Amplia o galinheiro para 8 galinhas.' },
  { tab: 'build', id: 'barn_up', upgrade: 'barn_up', price: BUILDINGS.barn.upgrade.price, mats: { wood: BUILDINGS.barn.upgrade.wood, stone: BUILDINGS.barn.upgrade.stone }, name: 'Celeiro grande', icon: 'icon_barn', desc: 'Amplia o celeiro para 8 vacas.' },
];
