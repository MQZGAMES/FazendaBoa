/** Objetos do mundo (mato, pedras, árvores, construções…). Balanceamento aqui. */
export type ObjKind =
  | 'weed' | 'stone' | 'twig' | 'stump' | 'tree' | 'sapling' | 'boulder' | 'tallgrass' | 'flowers' | 'bush'
  | 'house' | 'bin' | 'fence' | 'mailbox' | 'ore'
  | 'bed' | 'tv' | 'table' | 'chair' | 'rug' | 'fireplace' | 'window' | 'plant' | 'lamp' | 'shelf';

export type ToolKind = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'scythe' | 'rod' | 'bucket';

/** Instância salva de um objeto (âncora = tile superior-esquerdo da base). */
export interface WObj {
  k: ObjKind;
  v: number;        // variante visual
  hp?: number;      // golpes restantes
  t?: number;       // tipo (árvore: 0 carvalho, 1 bordo, 2 pinheiro; minério: índice)
  g?: number;       // estágio de crescimento
  s?: 1;            // árvore virou toco
  a?: number;       // idade em dias (mudas)
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
  house: { name: 'Casa', solid: true, size: [6, 3] },
  bin: { name: 'Caixa de envio', solid: true, size: [2, 1] },
  fence: { name: 'Cerca', solid: true, size: [1, 1] },
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
};

/** Tempo de crescimento das mudas de árvore (dias). */
export const SAPLING_DAYS = 10;
/** Golpes por nível de ferramenta (seção 11 / 12). */
export const HITS_TREE = [10, 8, 6, 4];
export const HITS_BOULDER = [8, 6, 4, 2];
export const HITS_STUMP = [10, 8, 6, 4];
/** Energia por uso de ferramenta: base 2, -0.5 por nível. */
export function toolEnergy(tier: number, base = 2): number { return Math.max(0.5, base - tier * 0.5); }

export const TREE_NAMES = ['oak', 'maple', 'pine'] as const;
