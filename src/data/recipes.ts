/** Receitas de fabricação (seção 14). A Fase 5 adiciona o restante. */
export interface Recipe {
  id: string;           // item produzido
  qty: number;
  ing: Record<string, number>;
  /** nível de habilidade necessário: [habilidade, nível] */
  req?: ['farming' | 'mining' | 'foraging' | 'fishing' | 'ranching', number];
}

export const RECIPES: Recipe[] = [
  { id: 'chest', qty: 1, ing: { wood: 50 } },
  { id: 'fence', qty: 1, ing: { wood: 2 } },
  { id: 'path', qty: 1, ing: { stone: 1 } },
  { id: 'torch', qty: 1, ing: { wood: 1, sap: 1 } },
  { id: 'fertilizer', qty: 1, ing: { sap: 2 }, req: ['farming', 1] },
  { id: 'scarecrow', qty: 1, ing: { wood: 50, fiber: 20 }, req: ['farming', 1] },
  { id: 'bait', qty: 1, ing: { fiber: 1, sap: 1 } },
  { id: 'furnace', qty: 1, ing: { copper_ore: 20, stone: 25 }, req: ['mining', 1] },
  { id: 'sprinkler_0', qty: 1, ing: { copper_bar: 1, iron_bar: 1 }, req: ['farming', 2] },
  { id: 'wheelbarrow', qty: 1, ing: { wood: 30, iron_bar: 2 }, req: ['mining', 2] },
  { id: 'lantern', qty: 1, ing: { iron_bar: 1, coal: 1 }, req: ['mining', 3] },
  { id: 'sprinkler_1', qty: 1, ing: { iron_bar: 1, gold_bar: 1, quartz: 1 }, req: ['farming', 6] },
  { id: 'sprinkler_2', qty: 1, ing: { gold_bar: 2, diamond: 1 }, req: ['farming', 9] },
];
