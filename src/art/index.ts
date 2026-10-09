import Phaser from 'phaser';
import { AtlasBuilder, registerAtlas, canvasToBlob, blobToImage, freeCanvas, pixelCanvasToCanvas, type FrameRect } from './atlas';
import { addNature } from './nature';
import { addIcons } from './icons';
import { addBuildings } from './buildings';
import { addCrops } from './crops';
import { addFurniture } from './furniture';
import { addPlayer, type Appearance } from './character';
import { buildTerrain, waterTextures, type TerrainIndex } from './terrain';
import { buildFonts, buildTinyFont } from './font';
import { P } from './palette';
import { idbGet, idbSet } from '../systems/idb';
import { ART_VERSION } from '../config';

export let TERRAIN: TerrainIndex;

interface CachedAtlas { blob: Blob; frames: FrameRect[]; extra?: unknown; }

/** Adiciona aqui novas categorias de sprites (um arquivo por categoria). */
function mainAtlas(): AtlasBuilder {
  const ab = new AtlasBuilder('atlas', 2048);
  addNature(ab);
  addBuildings(ab);
  addIcons(ab);
  addCrops(ab);
  addFurniture(ab);
  return ab;
}

/** No desenvolvimento sempre regenera (para ver mudanças na arte). */
const USE_CACHE = !import.meta.env.DEV;

async function loadCached(textures: Phaser.Textures.TextureManager, key: string): Promise<CachedAtlas | null> {
  if (!USE_CACHE) return null;
  try {
    const c = await idbGet<CachedAtlas>(`art:${ART_VERSION}:${key}`);
    if (!c || !(c.blob instanceof Blob)) return null;
    const img = await blobToImage(c.blob);
    if (!img) return null;
    registerAtlas(textures, key, img, c.frames);
    return c;
  } catch { return null; }
}

async function storeAndRegister(textures: Phaser.Textures.TextureManager, key: string, canvas: HTMLCanvasElement, frames: FrameRect[], extra?: unknown): Promise<void> {
  const blob = await canvasToBlob(canvas);
  if (blob) {
    void idbSet(`art:${ART_VERSION}:${key}`, { blob, frames, extra } satisfies CachedAtlas);
    const img = await blobToImage(blob);
    if (img) { registerAtlas(textures, key, img, frames); freeCanvas(canvas); return; }
  }
  registerAtlas(textures, key, canvas, frames);
}

/**
 * Gera (ou carrega do cache IndexedDB) todos os sprites procedurais.
 * O trabalho é distribuído em vários frames para manter a barra de progresso fluida.
 */
export async function generateArt(game: Phaser.Game, look: Appearance, onProgress: (f: number, label: string) => void): Promise<void> {
  const tx = game.textures;
  buildFonts(game, [
    { key: 'light', fill: P.textLight, shadow: P.uiOut },
    { key: 'dark', fill: P.text, shadow: null },
    { key: 'gold', fill: P.gold2, shadow: P.uiOut },
  ]);
  buildTinyFont(game);
  onProgress(0.05, 'Afiando ferramentas…');

  // Atlas principal
  if (!(await loadCached(tx, 'atlas'))) {
    const ab = mainAtlas();
    const res = await ab.build((f) => onProgress(0.05 + f * 0.6, 'Plantando árvores…'));
    await storeAndRegister(tx, 'atlas', res.canvas, res.frames);
  }
  onProgress(0.7, 'Arando a terra…');

  // Tileset do terreno
  const cachedTiles = await loadCached(tx, 'tiles');
  if (cachedTiles && cachedTiles.extra) {
    TERRAIN = cachedTiles.extra as TerrainIndex;
  } else {
    await new Promise((r) => setTimeout(r, 0));
    const t = buildTerrain();
    TERRAIN = t.index;
    await storeAndRegister(tx, 'tiles', t.canvas, [], t.index);
  }
  onProgress(0.85, 'Enchendo o rio…');

  // Água (texturas para TileSprite)
  const w = waterTextures();
  for (const [k, pc] of [['water', w.base], ['water_hi', w.hi]] as const) {
    if (tx.exists(k)) tx.remove(k);
    tx.addCanvas(k, pixelCanvasToCanvas(pc));
  }
  await buildPlayerAtlas(game, look);
  onProgress(1, 'Pronto!');
}

/** Atlas do jogador (separado para trocar aparência sem regenerar o resto). */
export async function buildPlayerAtlas(game: Phaser.Game, look: Appearance): Promise<void> {
  const ab = new AtlasBuilder('player', 512);
  addPlayer(ab, look);
  const res = await ab.build(() => undefined, 1000);
  registerAtlas(game.textures, 'player', res.canvas, res.frames);
}
