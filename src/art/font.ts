import Phaser from 'phaser';
import { PixelCanvas, rgb, type Color } from './pixel';
import { bufferToCanvas } from './atlas';

/**
 * Fonte pixel art proporcional desenhada em código (com acentos do português).
 * Linhas: 0-2 acento de maiúsculas, 3-9 corpo (7), 10-11 descendentes.
 * Cada glifo começa na linha 3; '/' separa linhas.
 */
const G: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###', J: '..###/...#./...#./...#./#..#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.###./#...#/#..../.###./....#/#...#/.###.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  a: '..../..../.##./...#/.###/#..#/.###', b: '#.../#.../###./#..#/#..#/#..#/###.',
  c: '..../..../.##./#..#/#.../#..#/.##.', d: '...#/...#/.###/#..#/#..#/#..#/.###',
  e: '..../..../.##./#..#/####/#.../.###', f: '..##/.#../###./.#../.#../.#../.#..',
  g: '..../..../.###/#..#/#..#/#..#/.###/...#/.##.', h: '#.../#.../###./#..#/#..#/#..#/#..#',
  i: '#/./#/#/#/#/#', j: '.#/../.#/.#/.#/.#/.#/.#/#.', k: '#.../#.../#..#/#.#./##../#.#./#..#',
  l: '#./#./#./#./#./#./.#', m: '...../...../####./#.#.#/#.#.#/#.#.#/#.#.#',
  n: '..../..../###./#..#/#..#/#..#/#..#', o: '..../..../.##./#..#/#..#/#..#/.##.',
  p: '..../..../###./#..#/#..#/#..#/###./#.../#...', q: '..../..../.###/#..#/#..#/#..#/.###/...#/...#',
  r: '.../.../#.#/##./#../#../#..', s: '..../..../.###/#.../.##./...#/###.',
  t: '.#./.#./###/.#./.#./.#./..#', u: '..../..../#..#/#..#/#..#/#..#/.###',
  v: '...../...../#...#/#...#/.#.#./.#.#./..#..', w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
  x: '..../..../#..#/#..#/.##./#..#/#..#', y: '..../..../#..#/#..#/#..#/#..#/.###/...#/.##.',
  z: '..../..../####/...#/.##./#.../####', 'ı': '../../#./#./#./#./#.',
  '0': '.##./#..#/#.##/##.#/#..#/#..#/.##.', '1': '.#./##./.#./.#./.#./.#./###',
  '2': '.##./#..#/...#/..#./.#../#.../####', '3': '###./...#/...#/.##./...#/...#/###.',
  '4': '#..#/#..#/#..#/####/...#/...#/...#', '5': '####/#.../###./...#/...#/#..#/.##.',
  '6': '.##./#.../#.../###./#..#/#..#/.##.', '7': '####/...#/..#./..#./.#../.#../.#..',
  '8': '.##./#..#/#..#/.##./#..#/#..#/.##.', '9': '.##./#..#/#..#/.###/...#/...#/.##.',
  '.': './././././././#', ',': './././././././#/#', ':': '././#/./././#', ';': '././#/./././#/#',
  '!': '#/#/#/#/#/./#', '?': '.##./#..#/...#/..#./.#../..../.#..', '-': '.../.../.../###/.../.../...',
  '+': '.../.../.#./###/.#./.../...', '/': '...#/...#/..#./..#./.#../#.../#...',
  '(': '.#/#./#./#./#./#./.#', ')': '#./.#/.#/.#/.#/.#/#.', "'": '#/#/./././././.',
  '"': '#.#/#.#/.../.../.../.../...', '%': '...../##..#/##.#./..#../.#.##/#..##/.....',
  '=': '..../..../####/..../####/..../....', '_': '..../..../..../..../..../..../####',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....', '<': '.../..#/.#./#../.#./..#/...',
  '>': '.../#../.#./..#/.#./#../...', '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....',
  '[': '##/#./#./#./#./#./##', ']': '##/.#/.#/.#/.#/.#/##', '&': '.##../#..#./.##../.#.#./#..#./#..#./.##.#',
  '♥': '...../.#.#./#####/#####/.###./..#../.....', '★': '..#../..#../#####/.###./.#.#./#...#/.....',
  '°': '.#./#.#/.#./.../.../.../...', '—': '...../...../...../#####/...../...../.....', '–': '..../..../..../####/..../..../....', '…': '...../...../...../...../...../...../#.#.#',
};

/** Acentos: [padrão, linhas]. */
const ACC: Record<string, string[]> = {
  acute: ['.#', '#.'], grave: ['#.', '.#'], circ: ['.#.', '#.#'], tilde: ['.#.#', '#.#.'], uml: ['#.#', '...'],
};
const ACCENTED: Record<string, [string, string]> = {
  'á': ['a', 'acute'], 'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ã': ['a', 'tilde'], 'é': ['e', 'acute'], 'ê': ['e', 'circ'],
  'í': ['ı', 'acute'], 'ó': ['o', 'acute'], 'ô': ['o', 'circ'], 'õ': ['o', 'tilde'], 'ú': ['u', 'acute'], 'ü': ['u', 'uml'],
  'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'], 'É': ['E', 'acute'], 'Ê': ['E', 'circ'],
  'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'],
};

const CELL_H = 13;
export const FONT_LINE_H = 13;

interface Glyph { rows: string[]; w: number; }

function glyphFor(ch: string): Glyph | null {
  if (ch === 'ç' || ch === 'Ç') {
    const base = glyphFor(ch === 'ç' ? 'c' : 'C')!;
    const rows = base.rows.slice();
    while (rows.length < 12) rows.push('.'.repeat(base.w));
    const mid = Math.floor(base.w / 2);
    rows[10] = '.'.repeat(mid) + '#' + '.'.repeat(base.w - mid - 1);
    rows[11] = '.'.repeat(Math.max(0, mid - 1)) + '#' + '.'.repeat(base.w - Math.max(0, mid - 1) - 1);
    return { rows, w: base.w };
  }
  const acc = ACCENTED[ch];
  if (acc) {
    const base = glyphFor(acc[0])!;
    const rows = base.rows.slice();
    const pat = ACC[acc[1]];
    const upper = acc[0] === acc[0].toUpperCase() && acc[0] !== 'ı';
    const pw = pat[0].length;
    const ox = Math.floor((base.w - pw) / 2 + (pw === 2 && base.w % 2 === 1 ? 0.5 : 0));
    for (let j = 0; j < pat.length; j++) {
      const y = (upper ? 0 : 2) + j; // maiúsculas: linhas 0-1; minúsculas: 2-3
      const r = rows[y].split('');
      for (let i = 0; i < pw; i++) if (pat[j][i] === '#') {
        const x = ox + i;
        if (x >= 0 && x < r.length) r[x] = '#';
      }
      rows[y] = r.join('');
    }
    return { rows, w: base.w };
  }
  const src = G[ch];
  if (src === undefined) return null;
  const body = src.split('/');
  const w = Math.max(...body.map((r) => r.length));
  const rows: string[] = [];
  for (let y = 0; y < 12; y++) {
    const b = y - 3;
    rows.push(b >= 0 && b < body.length ? body[b].padEnd(w, '.') : '.'.repeat(w));
  }
  return { rows, w };
}

export interface FontStyle { key: string; fill: Color; shadow: Color | null; }

const CHARS = (() => {
  let s = '';
  for (let c = 32; c < 127; c++) s += String.fromCharCode(c);
  return s + 'ıáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÇ♥★°…—–';
})();

/** Gera as texturas e registra as BitmapFonts no cache do Phaser. */
export function buildFonts(game: Phaser.Game, styles: FontStyle[]): void {
  const glyphs: { code: number; g: Glyph }[] = [];
  for (const ch of CHARS) {
    if (ch === ' ') continue;
    let g = glyphFor(ch) ?? glyphFor(ch.toUpperCase()) ?? glyphFor(ch.toLowerCase());
    if (!g) continue;
    // 'ç' e 'Ç' estendem 12 linhas
    if (g.rows.length < 12) { g = { rows: g.rows.concat(Array(12 - g.rows.length).fill('.'.repeat(g.w))), w: g.w }; }
    glyphs.push({ code: ch.codePointAt(0)!, g });
  }
  // Layout das células
  const TW = 256;
  let x = 0, y = 0;
  const pos: { x: number; y: number }[] = [];
  for (const { g } of glyphs) {
    const cw = g.w + 1;
    if (x + cw + 1 > TW) { x = 0; y += CELL_H + 1; }
    pos.push({ x, y });
    x += cw + 1;
  }
  const TH = Math.ceil((y + CELL_H + 1) / 8) * 8;
  for (const st of styles) {
    if (game.cache.bitmapFont.exists(st.key) && game.textures.exists('font_' + st.key)) continue;
    const pc = new PixelCanvas(TW, TH);
    glyphs.forEach(({ g }, i) => {
      const p = pos[i];
      if (st.shadow) for (let j = 0; j < 12; j++) for (let k = 0; k < g.w; k++) if (g.rows[j][k] === '#') {
        pc.set(p.x + k + 1, p.y + j + 1, st.shadow);
        pc.set(p.x + k, p.y + j + 1, st.shadow);
      }
      for (let j = 0; j < 12; j++) for (let k = 0; k < g.w; k++) if (g.rows[j][k] === '#') pc.set(p.x + k, p.y + j, st.fill);
    });
    const canvas = bufferToCanvas(pc.data, TW, TH);
    const texKey = 'font_' + st.key;
    if (game.textures.exists(texKey)) game.textures.remove(texKey);
    const tex = game.textures.addCanvas(texKey, canvas)!;
    const chars: Record<number, Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData> = {};
    glyphs.forEach(({ code, g }, i) => {
      const p = pos[i];
      const gw = g.w + 1, gh = CELL_H;
      const u0 = p.x / TW, v0 = p.y / TH, u1 = (p.x + gw) / TW, v1 = (p.y + gh) / TH;
      chars[code] = {
        x: p.x, y: p.y, width: gw, height: gh, centerX: Math.floor(gw / 2), centerY: Math.floor(gh / 2),
        xOffset: 0, yOffset: 0, xAdvance: g.w + 1, data: {}, kerning: {}, u0, v0, u1, v1,
      } as Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData;
      const fr = tex.add('c' + code, 0, p.x, p.y, gw, gh);
      fr?.setUVs(gw, gh, u0, v0, u1, v1);
    });
    // espaço
    chars[32] = { x: 0, y: 0, width: 0, height: 0, centerX: 0, centerY: 0, xOffset: 0, yOffset: 0, xAdvance: 3, data: {}, kerning: {}, u0: 0, v0: 0, u1: 0, v1: 0 } as Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData;
    const data = { font: st.key, size: 12, lineHeight: FONT_LINE_H, retroFont: false, chars } as Phaser.Types.GameObjects.BitmapText.BitmapFontData;
    game.cache.bitmapFont.add(st.key, { data, texture: texKey, frame: null });
  }
}

/** Fonte minúscula de números (3x5 com contorno) para quantidades. */
const TINY: Record<string, string> = {
  '0': '###/#.#/#.#/#.#/###', '1': '.#./##./.#./.#./###', '2': '###/..#/###/#../###', '3': '###/..#/.##/..#/###',
  '4': '#.#/#.#/###/..#/..#', '5': '###/#../###/..#/###', '6': '###/#../###/#.#/###', '7': '###/..#/.#./.#./.#.',
  '8': '###/#.#/###/#.#/###', '9': '###/#.#/###/..#/###', 'x': '.../#.#/.#./#.#/...', '+': '.../.#./###/.#./...',
  '-': '.../.../###/.../...', 'g': '.../###/#.#/###/..#',
};

export function buildTinyFont(game: Phaser.Game): void {
  const keys = Object.keys(TINY);
  const CW = 5, CH = 7, TW = 128;
  const per = Math.floor(TW / (CW + 1));
  const TH = Math.ceil(keys.length / per) * (CH + 1) + 8;
  const pc = new PixelCanvas(TW, TH);
  const fill = rgb('#fff6dc'), out = rgb('#2b160a');
  keys.forEach((k, i) => {
    const ox = (i % per) * (CW + 1), oy = Math.floor(i / per) * (CH + 1);
    const rows = TINY[k].split('/');
    const tmp = new PixelCanvas(CW, CH);
    rows.forEach((r, j) => { for (let q = 0; q < 3; q++) if (r[q] === '#') tmp.set(1 + q, 1 + j, fill); });
    tmp.outline(() => out, true);
    pc.blit(tmp, ox, oy);
  });
  const canvas = bufferToCanvas(pc.data, TW, TH);
  if (game.textures.exists('font_tiny')) game.textures.remove('font_tiny');
  const tex = game.textures.addCanvas('font_tiny', canvas)!;
  const chars: Record<number, Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData> = {};
  keys.forEach((k, i) => {
    const ox = (i % per) * (CW + 1), oy = Math.floor(i / per) * (CH + 1);
    const u0 = ox / TW, v0 = oy / TH, u1 = (ox + CW) / TW, v1 = (oy + CH) / TH;
    chars[k.charCodeAt(0)] = { x: ox, y: oy, width: CW, height: CH, centerX: 2, centerY: 3, xOffset: 0, yOffset: 0, xAdvance: 4, data: {}, kerning: {}, u0, v0, u1, v1 } as Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData;
    tex.add('t' + k, 0, ox, oy, CW, CH)?.setUVs(CW, CH, u0, v0, u1, v1);
  });
  chars[32] = { x: 0, y: 0, width: 0, height: 0, centerX: 0, centerY: 0, xOffset: 0, yOffset: 0, xAdvance: 3, data: {}, kerning: {}, u0: 0, v0: 0, u1: 0, v1: 0 } as Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData;
  game.cache.bitmapFont.add('tiny', { data: { font: 'tiny', size: 7, lineHeight: 8, retroFont: false, chars } as Phaser.Types.GameObjects.BitmapText.BitmapFontData, texture: 'font_tiny', frame: null });
}
