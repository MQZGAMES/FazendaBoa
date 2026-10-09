import type { ToolKind } from './objects';

export type ItemCat = 'tool' | 'seed' | 'crop' | 'resource' | 'food' | 'artisan' | 'fish' | 'mineral' | 'craft' | 'animal';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCat;
  /** preço de venda base (g) */
  price: number;
  /** frame do ícone no atlas */
  icon: string;
  /** energia recuperada ao comer */
  edible?: number;
  tool?: ToolKind;
  desc?: string;
}

export const MAX_STACK = 999;

const tool = (id: ToolKind, name: string, desc: string): ItemDef => ({ id, name, cat: 'tool', price: 0, icon: `tool_${id}_0`, tool: id, desc });

export const ITEMS: Record<string, ItemDef> = {
  hoe: tool('hoe', 'Enxada', 'Ara a terra para plantar.'),
  can: tool('can', 'Regador', 'Rega as plantações. Encha na água.'),
  axe: tool('axe', 'Machado', 'Corta galhos, árvores e tocos.'),
  pickaxe: tool('pickaxe', 'Picareta', 'Quebra pedras e minérios.'),
  scythe: tool('scythe', 'Foice', 'Corta mato e grama alta; colhe.'),
  rod: tool('rod', 'Vara de pesca', 'Segure para lançar.'),
  bucket: tool('bucket', 'Balde', 'Para tirar leite das vacas.'),
  seed_parsnip: { id: 'seed_parsnip', name: 'Sementes de pastinaca', cat: 'seed', price: 10, icon: 'item_seed_parsnip', desc: 'Primavera. Cresce em 4 dias.' },
  parsnip: { id: 'parsnip', name: 'Pastinaca', cat: 'crop', price: 35, icon: 'item_parsnip', edible: 25, desc: 'Uma raiz da primavera.' },
  wood: { id: 'wood', name: 'Madeira', cat: 'resource', price: 2, icon: 'item_wood', desc: 'Material de construção.' },
  stone: { id: 'stone', name: 'Pedra', cat: 'resource', price: 2, icon: 'item_stone', desc: 'Material de construção.' },
  fiber: { id: 'fiber', name: 'Fibra', cat: 'resource', price: 1, icon: 'item_fiber', desc: 'Fibras vegetais.' },
  sap: { id: 'sap', name: 'Seiva', cat: 'resource', price: 2, icon: 'item_sap', desc: 'Líquido pegajoso das árvores.' },
};

export function itemIcon(id: string, toolTier = 0): string {
  const d = ITEMS[id];
  if (!d) return 'icon_box';
  if (d.cat === 'tool') return `tool_${d.tool}_${toolTier}`;
  return d.icon;
}
