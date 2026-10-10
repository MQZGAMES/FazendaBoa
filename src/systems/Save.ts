import { G, setGame, newGameState, type GameState } from '../state';
import { Location, type Crop } from '../world/Location';
import { staticTemplate, LOCATIONS } from '../world/locations';
import { applyIslandBorder } from '../world/genFarm';
import { idbGet, idbSet } from './idb';
import type { WObj } from '../data/objects';
import { GAME_VERSION } from '../config';

/** Versão do esquema do save; adicione migrações em MIGRATIONS. */
export const SAVE_SCHEMA = 3;
const KEY = 'save:main';
const BACKUP = 'save:backup';

interface LocSave { id: string; w: number; h: number; terrain: string; soil: string; objs: [number, WObj][]; crops?: [number, Crop][]; extra?: Record<string, unknown>; }
export interface SaveFile {
  schema: number;
  version: string;
  savedAt: number;
  seed: number;
  player: GameState['player'];
  time: GameState['time'];
  weather: GameState['weather'];
  flags: GameState['flags'];
  locs: LocSave[];
  animals: GameState['animals'];
}

/* ---------- codificação ---------- */
function b64(u8: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode(...u8.subarray(i, i + CH));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function serialize(st: GameState = G): SaveFile {
  const locs: LocSave[] = [];
  for (const L of st.locs.values()) {
    if (L.id.startsWith('mine:')) continue;
    locs.push({ id: L.id, w: L.w, h: L.h, terrain: b64(L.terrain), soil: b64(L.soil), objs: [...L.objs.entries()], crops: [...L.crops.entries()], extra: L.extra });
  }
  return {
    schema: SAVE_SCHEMA, version: GAME_VERSION, savedAt: Date.now(), seed: st.seed,
    player: st.player, time: st.time, weather: st.weather, flags: st.flags, locs, animals: st.animals,
  };
}

/** Migrações de esquema: MIGRATIONS[n] converte do esquema n para n+1. */
const MIGRATIONS: Record<number, (s: SaveFile) => SaveFile> = {
  // 1 → 2: a fazenda virou ilha (mar nas bordas sem saída)
  1: (s) => ({ ...s, schema: 2, flags: { ...s.flags, needIsland: 1 } }),
  // 2 → 3: animais
  2: (s) => ({ ...s, schema: 3, animals: [] }),
};

export function validate(raw: unknown): SaveFile | null {
  if (!raw || typeof raw !== 'object') return null;
  let s = raw as SaveFile;
  if (typeof s.schema !== 'number' || !s.player || !s.time || !Array.isArray(s.locs)) return null;
  if (s.schema > SAVE_SCHEMA) return null;
  while (s.schema < SAVE_SCHEMA) {
    const m = MIGRATIONS[s.schema];
    if (!m) return null;
    s = m(s);
  }
  if (typeof s.player.money !== 'number' || !Array.isArray(s.player.inv)) return null;
  return s;
}

export function deserialize(s: SaveFile): GameState {
  const st = newGameState(s.seed);
  // mescla com o padrão para tolerar campos novos
  st.player = { ...st.player, ...s.player, tools: { ...st.player.tools, ...s.player.tools }, xp: { ...st.player.xp, ...s.player.xp } };
  st.time = { ...st.time, ...s.time };
  st.weather = { ...st.weather, ...s.weather };
  st.flags = { ...s.flags };
  st.animals = Array.isArray(s.animals) ? s.animals : [];
  for (const ls of s.locs) {
    const ver = LOCATIONS[ls.id]?.version;
    if (ver && (ls.extra?.ver ?? 0) !== ver) continue; // layout mudou: será recriado
    const tpl = staticTemplate(ls.id, s.seed);
    const L = new Location(ls.id, ls.w, ls.h);
    L.exits = tpl.exits;
    L.outdoor = tpl.outdoor;
    L.terrain = unb64(ls.terrain);
    L.soil = unb64(ls.soil);
    if (L.terrain.length !== ls.w * ls.h) continue;
    for (const [i, o] of ls.objs) {
      L.objs.set(i, o);
    }
    for (const [i, c] of ls.crops ?? []) L.crops.set(i, c);
    L.rebuildOcc();
    L.extra = ls.extra ?? {};
    if (ls.id === 'farm' && st.flags.needIsland) { applyIslandBorder(L); delete st.flags.needIsland; }
    st.locs.set(ls.id, L);
  }
  return st;
}

export async function saveGame(): Promise<boolean> {
  try {
    const data = serialize();
    const prev = await idbGet<SaveFile>(KEY);
    if (prev) await idbSet(BACKUP, prev);
    return await idbSet(KEY, data);
  } catch (e) {
    console.warn('falha ao salvar', e);
    return false;
  }
}

/** Carrega o save (ou null se não houver). Já ativa o estado. */
export async function loadGame(): Promise<GameState | null> {
  for (const k of [KEY, BACKUP]) {
    try {
      const raw = await idbGet<SaveFile>(k);
      const s = validate(raw);
      if (!s) continue;
      const st = deserialize(s);
      setGame(st);
      return st;
    } catch (e) { console.warn('save inválido', k, e); }
  }
  return null;
}

export async function hasSave(): Promise<boolean> { return !!validate(await idbGet(KEY)); }

/* ---------- Exportar / importar ---------- */
async function compress(text: string): Promise<string> {
  const CS = (globalThis as { CompressionStream?: new (f: string) => GenericTransformStream }).CompressionStream;
  if (!CS) return 'FB0:' + b64(new TextEncoder().encode(text));
  const stream = new Blob([text]).stream().pipeThrough(new CS('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return 'FB1:' + b64(buf);
}
async function decompress(code: string): Promise<string> {
  code = code.trim().replace(/\s+/g, '');
  if (code.startsWith('FB0:')) return new TextDecoder().decode(unb64(code.slice(4)));
  if (code.startsWith('FB1:')) {
    const DS = (globalThis as { DecompressionStream?: new (f: string) => GenericTransformStream }).DecompressionStream;
    if (!DS) throw new Error('Navegador sem suporte a descompressão');
    const stream = new Blob([unb64(code.slice(4)) as BlobPart]).stream().pipeThrough(new DS('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    return await new Response(stream).text();
  }
  return code; // talvez JSON puro
}

export async function exportCode(): Promise<string> { return compress(JSON.stringify(serialize())); }
export function exportJson(): string { return JSON.stringify(serialize()); }

/** Importa código ou JSON. Faz backup do save atual antes. */
export async function importSave(text: string): Promise<boolean> {
  try {
    const json = text.trim().startsWith('{') ? text : await decompress(text);
    const s = validate(JSON.parse(json));
    if (!s) return false;
    const cur = await idbGet<SaveFile>(KEY);
    if (cur) await idbSet(BACKUP, cur);
    await idbSet(KEY, s);
    setGame(deserialize(s));
    return true;
  } catch (e) {
    console.warn('importação falhou', e);
    return false;
  }
}

export function downloadFile(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
