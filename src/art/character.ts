import { PixelCanvas, rgb, mix, outlineOf, type Color } from './pixel';
import { P, SKINS, HAIRS, CLOTHES } from './palette';
import type { AtlasBuilder } from './atlas';

/**
 * Personagem 16x32 montado em camadas (pernas, tronco, braços, cabeça, cabelo)
 * num "mapa de papéis" (letras), depois sombreado e contornado automaticamente.
 * A troca de cores (pele, cabelo, roupa) é só troca de paleta dos papéis.
 */
export interface Appearance { skin: number; hairStyle: number; hairColor: number; shirt: number; pants: number; }
export const DEFAULT_LOOK: Appearance = { skin: 1, hairStyle: 0, hairColor: 0, shirt: 0, pants: 1 };
export const HAIR_STYLE_NAMES = ['Curto', 'Longo', 'Rabo', 'Espetado', 'Coque', 'Raspado'];

type Grid = string[][]; // [y][x] papel ou '.'
const W = 16, H = 32;
const newGrid = (): Grid => Array.from({ length: H }, () => Array(W).fill('.'));
function put(g: Grid, x: number, y: number, r: string): void { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = r; }
function stamp(g: Grid, rows: readonly string[], y0: number, dy = 0, flip = false): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      put(g, flip ? W - 1 - i : i, y0 + j + dy, ch);
    }
  });
}

/* ---------- Cabeças (linhas 4..14) ---------- */
const HEAD_D = [
  '....ssssssss....',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssssssssss...',
  '...ssessssess...',
  '...ssessssess...',
  '...srssssssrs...',
  '....ssssssss....',
  '.....SSSSSS.....',
];
const HEAD_S = [
  '.....ssssss.....',
  '....ssssssss....',
  '....sssssssss...',
  '....sssssssss...',
  '....sssssssss...',
  '....sssssssss...',
  '....ssSsssses...',
  '....ssSssssess..',
  '....sssssssrs...',
  '.....sssssss....',
  '......SSSS......',
];

/* ---------- Cabelos: [frente, lado], começando na linha 0 ---------- */
const HAIR: [string[], string[]][] = [
  [ // curto
    ['', '', '', '.....hhhhhh.....', '...hhKKhhhhhh...', '..hhKKhhhhhhhh..', '..hKhhhhhhhhhh..', '..hhhhhhhhhhhH..', '..hhhhhhhhhhhH..', '..hhH.hhh.HhhH..', '..hH........Hh..', '..H..........H..'],
    ['', '', '', '.....hhhhhh.....', '....hhhKKhhh....', '...hhhKhhhhhh...', '...hhhhhhhhhhh..', '...hhhhhhhhhhH..', '...hhhhhhhhhH.H.', '...hhhhH........', '...hhH..........', '...hH...........'],
  ],
  [ // longo
    ['', '', '', '.....hhhhhh.....', '...hhKKhhhhhh...', '..hhKKhhhhhhhh..', '..hKhhhhhhhhhh..', '..hhhhhhhhhhhH..', '..hhhhhhhhhhhH..', '..hhhh....hhhH..', '..hhH......Hhh..', '..hh........hh..', '..hh........hh..', '..hH........Hh..', '..hH........Hh..', '..HH........HH..', '...H........H...'],
    ['', '', '', '.....hhhhhh.....', '....hhhKKhhh....', '...hhhKhhhhhh...', '...hhhhhhhhhhh..', '...hhhhhhhhhhH..', '...hhhhhhhhhH...', '..hhhhhhH.......', '..hhhhh.........', '..hhhhH.........', '..hhhhH.........', '..hhhH..........', '..hhhH..........', '...HH...........'],
  ],
  [ // rabo de cavalo
    ['', '', '', '.....hhhhhh.....', '...hhKKhhhhhh...', '..hhKKhhhhhhhh..', '..hKhhhhhhhhhh..', '..hhhhhhhhhhhH..', '..hhhhhhhhhhhH..', '..hhh..hh..hhH..', '..hH........Hh..', '...H........H...'],
    ['', '', '', '.....hhhhhh.....', '....hhhKKhhh....', '...hhhKhhhhhh...', '..hhhhhhhhhhhh..', '.hhhhhhhhhhhhH..', '.hhhhhhhhhhhH...', '.hhhhhhH........', '.hhhhH..........', '.hhH............', '.hhH............', '.hhH............', '..hH............', '..H.............'],
  ],
  [ // espetado
    ['', '....h..h..h.....', '...hh.hh.hh.h...', '...hhhhhhhhhh...', '..hhKKhhhhhhhh..', '..hKKhhhhhhhhh..', '..hhhhhhhhhhhH..', '..hhhhhhhhhhhH..', '..hh.hh.hh.hhH..', '..H..........H..'],
    ['', '.....h..h.......', '...hhh.hh.hh....', '..hhhhhhhhhhh...', '..hhhKKhhhhhh...', '..hhKhhhhhhhhh..', '..hhhhhhhhhhhhh.', '..hhhhhhhhhhhH..', '..hhhhhhhhH.H...', '..hhhhH.........', '...hhH..........'],
  ],
  [ // coque
    ['......hhhh......', '.....hKhhhh.....', '.....hhhhhH.....', '....hhhhhhhh....', '...hhKKhhhhhh...', '..hhKhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhH..', '..hhhh....hhhH..', '..hH........Hh..', '..h..........h..'],
    ['...hhhh.........', '..hKhhhh........', '..hhhhhH........', '...hhhhhhhh.....', '....hhhKKhhh....', '...hhhKhhhhhh...', '...hhhhhhhhhhh..', '...hhhhhhhhhhH..', '...hhhhhhhhhH...', '...hhhhH........', '...hhH..........'],
  ],
  [ // raspado
    ['', '', '', '.....hhhhhh.....', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hH........Hh..', '..H..........H..'],
    ['', '', '', '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhhh..', '...hhhhhH.......', '...hhhH.........', '...hhH..........'],
  ],
];

/* ---------- Tronco (sem braços), linhas 15..20 ---------- */
const TORSO_D = ['....cccccccc....', '....cccccccc....', '....cccccccc....', '....cccccccc....', '....cccccccc....', '....pppppppp....'];
const TORSO_S = ['.....cccccc.....', '.....cccccc.....', '.....cccccc.....', '.....cccccc.....', '.....cccccc.....', '.....pppppp.....'];

export type Dir = 'd' | 'u' | 's';
export interface Pose {
  bob: number;           // deslocamento vertical do corpo (cabeça+tronco+braços)
  liftL: number; liftR: number; // levantar pé (frente/costas)
  stride: number;        // passada (lado): + perna da frente adiante
  handL: [number, number]; handR: [number, number]; // mão relativa à posição de repouso
  armsUp?: boolean;      // segurando algo acima da cabeça
  head?: number;         // deslocamento extra da cabeça (respiração)
  crouch?: number;       // agachar (colher)
}
const pose = (o: Partial<Pose>): Pose => ({ bob: 0, liftL: 0, liftR: 0, stride: 0, handL: [0, 0], handR: [0, 0], ...o });

function thickLine(g: Grid, x0: number, y0: number, x1: number, y1: number, r: string, wdt: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (let k = 0; k < wdt; k++) put(g, Math.round(x + k - (wdt - 1) / 2), Math.round(y), r);
  }
}

function drawLegsFront(g: Grid, liftL: number, liftR: number, back: boolean, crouch: number): void {
  const leg = (x0: number, lift: number, toeDir: number) => {
    for (let y = 21; y <= 30; y++) {
      const yy = y - lift + (y > 22 ? 0 : 0);
      if (y >= 28 + crouch) {
        // bota
        for (let x = x0; x < x0 + 3; x++) put(g, x, yy, 'b');
        if (y === 30) put(g, toeDir < 0 ? x0 - 1 : x0 + 3, yy, 'b');
      } else if (y >= 21 + crouch) {
        for (let x = x0; x < x0 + 3; x++) put(g, x, yy, 'p');
      }
    }
  };
  // quadril
  for (let y = 21; y <= 22; y++) for (let x = 4; x <= 11; x++) put(g, x, y + crouch, 'p');
  leg(5, liftL, back ? 1 : -1);
  leg(8, liftR, back ? -1 : 1);
  for (let y = 23; y <= 27; y++) { if (g[y][7] === 'p') g[y][7] = 'P'; }
}

function drawLegsSide(g: Grid, stride: number, lift: number, crouch: number): void {
  for (let y = 21; y <= 22; y++) for (let x = 5; x <= 10; x++) put(g, x, y + crouch, 'p');
  const leg = (s: number, role: string, boot: string, lf: number) => {
    const hipX = 7, footX = 7 + s;
    for (let y = 23 + crouch; y <= 27; y++) {
      const t = (y - 22) / 8;
      const x = Math.round(hipX + (footX - hipX) * t);
      for (let k = 0; k < 3; k++) put(g, x + k - 0 + 0, y - (y > 25 ? lf : 0), role);
    }
    for (let y = 28; y <= 30; y++) {
      const x = footX;
      for (let k = 0; k < 3; k++) put(g, x + k, y - lf, boot);
      if (y >= 29) put(g, x + 3, y - lf, boot);
    }
  };
  leg(-stride, 'P', 'B', stride === 0 ? 0 : 0); // perna de trás (mais escura)
  leg(stride, 'p', 'b', lift);
}

function compose(dir: Dir, ps: Pose, style: number, extra?: (g: Grid) => void): Grid {
  const g = newGrid();
  const crouch = ps.crouch ?? 0;
  const by = ps.bob + crouch;
  // pernas
  if (dir === 's') drawLegsSide(g, ps.stride, ps.liftL, crouch); else drawLegsFront(g, ps.liftL, ps.liftR, dir === 'u', crouch);
  // braço de trás (lado)
  if (dir === 's') {
    const [hx, hy] = ps.handL;
    thickLine(g, 7, 16 + by, 6 + hx, 19 + by + hy, 'A', 2);
    put(g, 6 + hx, 20 + by + hy, 'S');
  }
  // tronco
  stamp(g, dir === 's' ? TORSO_S : TORSO_D, 15, by);
  // braços
  if (dir !== 's') {
    if (ps.armsUp) {
      thickLine(g, 3, 16 + by, 2, 4 + by, 'a', 1); thickLine(g, 12, 16 + by, 13, 4 + by, 'a', 1);
      put(g, 3, 2 + by, 's'); put(g, 3, 3 + by, 's'); put(g, 12, 2 + by, 's'); put(g, 12, 3 + by, 's');
    } else {
      const [lx, ly] = ps.handL, [rx, ry] = ps.handR;
      thickLine(g, 3, 15 + by, 3 + lx, 18 + by + ly, 'a', 1);
      put(g, 3 + lx, 19 + by + ly, 's'); put(g, 3 + lx, 20 + by + ly, 'S');
      thickLine(g, 12, 15 + by, 12 + rx, 18 + by + ry, 'a', 1);
      put(g, 12 + rx, 19 + by + ry, 's'); put(g, 12 + rx, 20 + by + ry, 'S');
    }
  }
  // cabeça
  const hy = by + (ps.head ?? 0);
  if (dir === 's') stamp(g, HEAD_S, 4, hy);
  else {
    stamp(g, HEAD_D, 4, hy);
    if (dir === 'u') {
      // costas: cabeça coberta de cabelo (exceto nuca)
      for (let y = 4; y <= 12; y++) for (let x = 0; x < W; x++) {
        const yy = y + hy;
        if (yy >= 0 && yy < H && 'sSer'.includes(g[yy][x])) g[yy][x] = 'h';
      }
      for (let x = 0; x < W; x++) { const yy = 13 + hy; if (yy < H && g[yy][x] === 's') g[yy][x] = 'S'; }
    }
  }
  // cabelo
  const [hf, hs] = HAIR[style] ?? HAIR[0];
  stamp(g, dir === 's' ? hs : hf, 0, hy);
  if (dir === 'u') {
    // rabo de cavalo / coque visíveis de costas
    if (style === 2) for (let y = 12; y <= 17; y++) for (let x = 6; x <= 9; x++) put(g, x, y + hy, y > 15 ? 'H' : 'h');
    if (style === 1) for (let y = 12; y <= 17; y++) for (let x = 3; x <= 12; x++) put(g, x, y + hy, y === 17 ? 'H' : 'h');
  }
  // braço da frente (lado) por cima
  if (dir === 's') {
    if (ps.armsUp) {
      // braço erguido fica atrás da cabeça; mãos aparecem acima dela
      put(g, 9, 2 + by, 's'); put(g, 10, 2 + by, 's'); put(g, 9, 3 + by, 'S'); put(g, 10, 3 + by, 's');
    } else {
      const [hx, hy2] = ps.handR;
      thickLine(g, 8, 16 + by, 8 + hx, 19 + by + hy2, 'a', 2);
      put(g, 8 + hx, 20 + by + hy2, 's'); put(g, 9 + hx, 20 + by + hy2, 's');
    }
  }
  if (extra) extra(g);
  return g;
}

/** Sombreamento automático por material + cor + contorno colorido. */
function render(g: Grid, look: Appearance): PixelCanvas {
  const skin = SKINS[look.skin % SKINS.length], hair = HAIRS[look.hairColor % HAIRS.length];
  const shirt = CLOTHES[look.shirt % CLOTHES.length], pants = CLOTHES[look.pants % CLOTHES.length];
  const mat = (r: string) => (r === 'h' || r === 'H' || r === 'K') ? 'h' : (r === 'c' || r === 'C' || r === 'k') ? 'c' : (r === 'a' || r === 'A') ? 'a' : (r === 'p' || r === 'P') ? 'p' : (r === 's' || r === 'S' || r === 'e' || r === 'r') ? 's' : r;
  // sombra automática: borda direita/inferior de cada material escurece; superior-esquerda clareia
  const out = g.map((row) => row.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = g[y][x];
    if (r === '.') continue;
    const m = mat(r);
    const right = x < W - 1 ? mat(g[y][x + 1]) : '.';
    const down = y < H - 1 ? mat(g[y + 1][x]) : '.';
    const left = x > 0 ? mat(g[y][x - 1]) : '.';
    const up = y > 0 ? mat(g[y - 1][x]) : '.';
    if (r === 'c') {
      // camisa: sombra só contra o vazio/outros materiais (não contra o braço)
      const rr = g[y][x + 1] ?? '.', dd = g[y + 1]?.[x] ?? '.';
      const edgeR = right !== m && right !== 'a', edgeD = down !== m && down !== 'a' && down !== 'p';
      if (edgeR || edgeD || rr === '.' || dd === '.') out[y][x] = 'C';
      else if (left === '.' || up === '.') out[y][x] = 'k';
    } else if (r === 'a') {
      if (right !== 'a') out[y][x] = 'A';
    } else if (r === 'h') {
      if (right === '.' || down === '.') out[y][x] = 'H';
      else if ((left === '.' || up === '.') && (x + y) % 2 === 0) out[y][x] = 'K';
    } else if (r === 'p') {
      if (right !== m) out[y][x] = 'P';
    } else if (r === 'b') {
      if (up !== 'b') out[y][x] = 'n';
    }
  }
  const pal: Record<string, Color> = {
    s: skin[1], S: skin[0], L: skin[2], e: rgb('#2a1622'), r: mix(skin[1], rgb('#e8506a'), 0.35),
    h: hair[1], H: hair[0], K: hair[2],
    c: shirt[1], C: shirt[0], k: shirt[2], a: shirt[1], A: shirt[0],
    p: pants[1], P: pants[0], q: pants[2],
    b: rgb('#5e3a1c'), B: rgb('#3e2410'), n: rgb('#7e5230'),
    t: P.steel2, T: P.steel1, w: P.wood3, W: P.wood1,
  };
  const pc = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = pal[out[y][x]];
    if (c !== undefined) pc.set(x, y, c);
  }
  pc.outline((c) => outlineOf(c));
  return pc;
}

/* ---------- Animações ---------- */
export const WALK_FRAMES = 6;
const WALK_FRONT: Pose[] = [
  pose({}), pose({ liftL: 1, bob: -1, handL: [0, -1], handR: [0, 1] }), pose({ liftL: 2, bob: -1, handL: [0, -1], handR: [0, 1] }),
  pose({}), pose({ liftR: 1, bob: -1, handL: [0, 1], handR: [0, -1] }), pose({ liftR: 2, bob: -1, handL: [0, 1], handR: [0, -1] }),
];
const WALK_SIDE: Pose[] = [
  pose({ stride: 2, handR: [-2, 0], handL: [2, 0] }), pose({ stride: 1, bob: -1, handR: [-1, 0], handL: [1, 0] }), pose({ stride: 0, bob: -1, liftL: 1 }),
  pose({ stride: -2, handR: [2, 0], handL: [-2, 0] }), pose({ stride: -1, bob: -1, handR: [1, 0], handL: [-1, 0] }), pose({ stride: 0, bob: -1, liftL: 1 }),
];
const IDLE: Pose[] = [pose({}), pose({ head: 0, bob: 1, liftL: 0 })];

export const PLAYER_ANIMS = {
  idle: 2,
  walk: WALK_FRAMES,
  carry: WALK_FRAMES,
} as const;
export type PlayerAnim = keyof typeof PLAYER_ANIMS;

/** Nome do frame no atlas. */
export function playerFrame(dir: Dir, anim: PlayerAnim, i: number): string { return `pl_${dir}_${anim}_${i}`; }

function idleFix(p: Pose): Pose {
  // na respiração o corpo desce 1px mas as pernas ficam; compensa bob nas pernas
  return p;
}

/** Adiciona todos os frames do jogador ao atlas com a aparência dada. */
export function addPlayer(ab: AtlasBuilder, look: Appearance): void {
  const dirs: Dir[] = ['d', 'u', 's'];
  for (const d of dirs) {
    IDLE.forEach((p, i) => ab.add(playerFrame(d, 'idle', i), W, H, (pc) => pc.blit(render(compose(d, idleFix(p), look.hairStyle), look), 0, 0)));
    const walk = d === 's' ? WALK_SIDE : WALK_FRONT;
    walk.forEach((p, i) => ab.add(playerFrame(d, 'walk', i), W, H, (pc) => pc.blit(render(compose(d, p, look.hairStyle), look), 0, 0)));
    walk.forEach((p, i) => ab.add(playerFrame(d, 'carry', i), W, H, (pc) => pc.blit(render(compose(d, { ...p, armsUp: true }, look.hairStyle), look), 0, 0)));
  }
}

/** Renderiza um frame isolado (para a tela de criação de personagem). */
export function renderPlayerPreview(look: Appearance, dir: Dir = 'd'): PixelCanvas {
  return render(compose(dir, pose({}), look.hairStyle), look);
}
