/** Animais e construções da fazenda (seções 16–17). Balanceamento aqui. */
export type AnimalKind = 'chicken' | 'cow';
export type BuildingKind = 'coop' | 'barn';

export interface AnimalDef {
  kind: AnimalKind;
  name: string;
  price: number;
  home: BuildingKind;
  product: string;      // produto normal
  bigProduct: string;   // produto grande (afeição alta)
  /** precisa de ferramenta para coletar (vaca: balde) */
  tool?: 'bucket';
  /** tamanho do sprite (px) */
  size: number;
}

export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  chicken: { kind: 'chicken', name: 'Galinha', price: 800, home: 'coop', product: 'egg', bigProduct: 'big_egg', size: 16 },
  cow: { kind: 'cow', name: 'Vaca', price: 1500, home: 'barn', product: 'milk', bigProduct: 'big_milk', tool: 'bucket', size: 32 },
};

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  price: number;
  wood: number;
  stone: number;
  /** capacidade por nível (normal, grande) */
  capacity: [number, number];
  upgrade: { price: number; wood: number; stone: number };
  /** tamanho da base no mapa da fazenda */
  size: [number, number];
  /** interior (tiles) */
  inside: [number, number];
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  coop: { kind: 'coop', name: 'Galinheiro', price: 4000, wood: 300, stone: 100, capacity: [4, 8], upgrade: { price: 8000, wood: 400, stone: 150 }, size: [5, 3], inside: [10, 9] },
  barn: { kind: 'barn', name: 'Celeiro', price: 6000, wood: 350, stone: 150, capacity: [4, 8], upgrade: { price: 12000, wood: 450, stone: 200 }, size: [7, 4], inside: [12, 10] },
};

/** Afeição 0–1000 (5 corações = 200 cada). */
export const HEART_PTS = 200;
export const MAX_AFFECTION = 1000;
export const PET_GAIN = 15;
export const FED_GAIN = 5;
export const NOT_PETTED_LOSS = 10;
export const HUNGRY_LOSS = 20;
/** Afeição para chance de produto grande e de qualidade. */
export const BIG_PRODUCT_AT = 700;

/** Horários: saem às 9:00 (sol/nublado, fora do inverno) e voltam às 18:00. */
export const OUT_TIME = 9 * 60;
export const IN_TIME = 18 * 60;

export const HAY_PRICE = 50;

export const CHICKEN_NAMES = ['Pipoca', 'Penélope', 'Cocó', 'Galega', 'Pintada', 'Farofa', 'Paçoca', 'Canjica', 'Bolinha', 'Clarinha'];
export const COW_NAMES = ['Mimosa', 'Malhada', 'Estrela', 'Florzinha', 'Margarida', 'Pandora', 'Bonita', 'Chocolate', 'Nata', 'Cajuína'];
