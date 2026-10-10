/** Objetos do mundo (mato, pedras, árvores, construções…). Balanceamento aqui. */
export type ObjKind =
  | 'weed' | 'stone' | 'twig' | 'stump' | 'tree' | 'sapling' | 'boulder' | 'tallgrass' | 'flowers' | 'bush'
  | 'house' | 'bin' | 'fence' | 'mailbox' | 'ore'
  | 'bed' | 'tv' | 'table' | 'chair' | 'rug' | 'fireplace' | 'window' | 'plant' | 'lamp' | 'shelf'
  | 'shop' | 'smith' | 'manor' | 'fountain' | 'bench' | 'lamppost' | 'flowerbed' | 'sign' | 'chest'
  | 'ladder' | 'ladderup' | 'elevator' | 'crystal' | 'walltorch' | 'torch' | 'furnace' | 'bigrock' | 'rockpile' | 'minecart'
  | 'sprinkler' | 'scarecrow' | 'lantern' | 'wheelbarrow';

export type ToolKind = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'scythe' | 'rod' | 'bucket';

import type { ItemStack } from '../state';

/** Instância salva de um objeto (âncora = tile superior-esquerdo da base). */
export interface WObj {
  k: ObjKind;
  v: number;        // variante visual
  hp?: number;      // golpes restantes
  t?: number;       // tipo (árvore: 0 carvalho, 1 bordo, 2 pinheiro; minério: índice)
  g?: number;       // estágio de crescimento
  s?: 1;            // árvore virou toco
  a?: number;       // idade em dias (mudas)
  inv?: (ItemStack | null)[]; // conteúdo (baús)
  /** máquina trabalhando: produto, quantidade e minuto absoluto em que fica pronto */
  m?: { out: string; q: number; until: number };
}

export interface ObjDef {
  name: string;
  solid: boolean;
  /** largura x altura da base em tiles */
  size: [number, number];
  shadow?: 'shadow_s' | 'shadow_m' | 'shadow_l';
  sway?: boolean;
  tool?: ToolKind | 'any';
  hp?: number;
  /** deslocamento vertical do sprite (px) em relação à base */
  dy?: number;
  /** objeto baixo, desenhado sob personagens (depth fixo) */
  flat?: boolean;
  /** pode ficar sobre parede (janelas, quadros) */
  onWall?: boolean;
  /** porta: colunas (relativas à âncora) e linha da base onde fica, e o que abre */
  door?: { dx: number[]; dy: number; act: string };
  /** item que vira ao ser recolhido */
  item?: string;
  /** emite luz (raio em px) */
  light?: number;
  /** cor da luz (0xRRGGBB) */
  lightColor?: number;
}

export const OBJ: Record<ObjKind, ObjDef> = {
  weed: { name: 'Mato', solid: true, size: [1, 1], sway: true, tool: 'any', hp: 1 },
  stone: { name: 'Pedra', solid: true, size: [1, 1], tool: 'pickaxe', hp: 1 },
  twig: { name: 'Galho', solid: true, size: [1, 1], tool: 'axe', hp: 1 },
  stump: { name: 'Toco grande', solid: true, size: [2, 2], tool: 'axe', hp: 10, shadow: 'shadow_l' },
  tree: { name: 'Árvore', solid: true, size: [1, 1], tool: 'axe', hp: 10, shadow: 'shadow_l', sway: true },
  sapling: { name: 'Muda', solid: true, size: [1, 1], tool: 'axe', hp: 1 },
  boulder: { name: 'Pedregulho', solid: true, size: [2, 2], tool: 'pickaxe', hp: 8, shadow: 'shadow_l' },
  tallgrass: { name: 'Grama alta', solid: false, size: [1, 1], sway: true, tool: 'scythe', hp: 1 },
  flowers: { name: 'Flores', solid: false, size: [1, 1], sway: true, flat: true },
  bush: { name: 'Arbusto', solid: true, size: [2, 1], shadow: 'shadow_l' },
  house: { name: 'Casa', solid: true, size: [6, 3], door: { dx: [2, 3], dy: 2, act: 'door' } },
  bin: { name: 'Caixa de envio', solid: true, size: [2, 1] },
  fence: { name: 'Cerca', solid: true, size: [1, 1], item: 'fence' },
  mailbox: { name: 'Caixa de correio', solid: true, size: [1, 1] },
  ore: { name: 'Minério', solid: true, size: [1, 1], tool: 'pickaxe', hp: 3 },
  bed: { name: 'Cama', solid: true, size: [2, 2] },
  tv: { name: 'TV', solid: true, size: [1, 1] },
  table: { name: 'Mesa', solid: true, size: [2, 1] },
  chair: { name: 'Cadeira', solid: true, size: [1, 1] },
  rug: { name: 'Tapete', solid: false, size: [3, 2], flat: true },
  fireplace: { name: 'Lareira', solid: true, size: [2, 1], onWall: true },
  window: { name: 'Janela', solid: true, size: [1, 1], onWall: true },
  plant: { name: 'Vaso', solid: true, size: [1, 1] },
  lamp: { name: 'Luminária', solid: true, size: [1, 1] },
  shelf: { name: 'Estante', solid: true, size: [1, 1] },
  shop: { name: 'Loja', solid: true, size: [7, 3], door: { dx: [3, 4], dy: 2, act: 'shop' } },
  smith: { name: 'Ferreiro', solid: true, size: [6, 3], door: { dx: [3, 4], dy: 2, act: 'smith' } },
  manor: { name: 'Casarão', solid: true, size: [11, 4], door: { dx: [5], dy: 3, act: 'manor' } },
  fountain: { name: 'Fonte', solid: true, size: [3, 2] },
  bench: { name: 'Banco', solid: true, size: [2, 1] },
  lamppost: { name: 'Poste', solid: true, size: [1, 1] },
  flowerbed: { name: 'Canteiro', solid: true, size: [1, 1] },
  sign: { name: 'Placa', solid: true, size: [1, 1] },
  chest: { name: 'Baú', solid: true, size: [1, 1], item: 'chest' },
  ladder: { name: 'Escada (descer)', solid: true, size: [1, 1], flat: true },
  ladderup: { name: 'Escada (subir)', solid: true, size: [1, 1] },
  elevator: { name: 'Elevador', solid: true, size: [2, 1], light: 40, lightColor: 0xffd27a },
  crystal: { name: 'Cristal', solid: true, size: [1, 1], tool: 'pickaxe', hp: 2, light: 44 },
  walltorch: { name: 'Tocha', solid: true, size: [1, 1], onWall: true, light: 64, lightColor: 0xffa040 },
  torch: { name: 'Tocha', solid: true, size: [1, 1], item: 'torch', light: 64, lightColor: 0xffa040 },
  furnace: { name: 'Fornalha', solid: true, size: [1, 1], item: 'furnace' },
  bigrock: { name: 'Pedra grande', solid: true, size: [1, 1], tool: 'pickaxe', hp: 2 },
  rockpile: { name: 'Pilha de pedras', solid: true, size: [1, 1], tool: 'pickaxe', hp: 1 },
  minecart: { name: 'Carrinho de mina', solid: true, size: [2, 1] },
  sprinkler: { name: 'Irrigador', solid: true, size: [1, 1] },
  scarecrow: { name: 'Espantalho', solid: true, size: [1, 1], item: 'scarecrow' },
  lantern: { name: 'Lampião', solid: true, size: [1, 1], item: 'lantern', light: 96, lightColor: 0xffd27a },
  wheelbarrow: { name: 'Carrinho de mão', solid: true, size: [1, 1], item: 'wheelbarrow' },
};

/** Área dos irrigadores (seção 14): raio em tiles e se inclui diagonais. */
export const SPRINKLER_AREA: { r: number; diag: boolean }[] = [{ r: 1, diag: false }, { r: 1, diag: true }, { r: 2, diag: true }];
export const SPRINKLER_ITEMS = ['sprinkler_0', 'sprinkler_1', 'sprinkler_2'];
/** Espantalho protege num raio de 8 tiles; sem ele, corvo come no máx. 1 planta/dia. */
export const SCARECROW_RADIUS = 8;
export const CROW_CHANCE = 0.3;
/** Carrinho de mão guarda até 10 pedras grandes. */
export const WHEELBARROW_CAP = 10;
/** Caminho de pedra: +10% de velocidade. */
export const PATH_SPEED = 1.1;

/** Tempo de crescimento das mudas de árvore (dias). */
export const SAPLING_DAYS = 10;
/** Golpes por nível de ferramenta (seção 11 / 12). */
export const HITS_TREE = [10, 8, 6, 4];
export const HITS_BOULDER = [8, 6, 4, 2];
export const HITS_STUMP = [10, 8, 6, 4];
/** Energia por uso de ferramenta: base 2, -0.5 por nível. */
export function toolEnergy(tier: number, base = 2): number { return Math.max(0.5, base - tier * 0.5); }

export const TREE_NAMES = ['oak', 'maple', 'pine'] as const;
