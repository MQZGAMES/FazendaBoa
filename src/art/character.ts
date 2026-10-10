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

/* ---------- Corpo ---------- */
export type Dir = 'd' | 'u' | 's';
export interface Pose {
  bob: number;                  // deslocamento vertical do corpo (cabeça+tronco+braços)
  liftL: number; liftR: number; // levantar pé (frente/costas)
  stride: number;               // passada (lado): + perna da frente adiante
  swingL: number; swingR: number; // balanço dos braços (frente: -1 trás / +1 frente; lado: -2..2)
  armsUp?: boolean;             // segurando algo acima da cabeça
  hands?: [number, number];     // mãos juntas num ponto (ferramentas)
  head?: number;                // deslocamento extra da cabeça
  crouch?: number;              // agachar (colher)
}
const pose = (o: Partial<Pose>): Pose => ({ bob: 0, liftL: 0, liftR: 0, stride: 0, swingL: 0, swingR: 0, ...o });

/** Linha grossa com papel variando ao longo do comprimento (manga → pele). */
function limb(g: Grid, x0: number, y0: number, x1: number, y1: number, w: number, role: (t: number) => string): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    for (let k = 0; k < w; k++) put(g, x + k, y, role(t));
  }
}

function torsoFront(g: Grid, by: number, back: boolean): void {
  for (let y = 15; y <= 20; y++) for (let x = 5; x <= 10; x++) put(g, x, y + by, 'c');
  if (!back) {
    put(g, 7, 15 + by, 'N'); put(g, 8, 15 + by, 'N');      // pescoço
    put(g, 6, 15 + by, 'k'); put(g, 9, 15 + by, 'k');      // gola
    put(g, 7, 16 + by, 'k');
  }
  for (let x = 5; x <= 10; x++) put(g, x, 21 + by, 'w');    // cinto
  if (!back) { put(g, 7, 21 + by, 'g'); put(g, 8, 21 + by, 'g'); }
}

/** Braço de frente/costas: ombro colado ao tronco, antebraço afastado (o vão vira contorno). */
function armFront(g: Grid, side: 0 | 1, swing: number, by: number): void {
  const m = (x: number) => (side === 0 ? x : 15 - x);
  const e = swing > 0 ? 1 : swing < 0 ? -1 : 0;
  put(g, m(4), 15 + by, 'a');
  put(g, m(3), 16 + by, 'a'); put(g, m(4), 16 + by, 'a');
  put(g, m(2), 17 + by, 'a'); put(g, m(3), 17 + by, 'a');
  const hand = 20 + e;
  for (let y = 18; y <= hand; y++) { put(g, m(2), y + by, 's'); put(g, m(3), y + by, 's'); }
  put(g, m(2), hand + 1 + by, 'S');
}

function legsFront(g: Grid, liftL: number, liftR: number, crouch: number): void {
  for (let y = 22; y <= 23; y++) for (let x = 5; x <= 10; x++) put(g, x, y + crouch, 'p');
  const leg = (x0: number, lift: number, toe: number) => {
    const bootTop = 28 - lift;
    for (let y = 24 + crouch; y < bootTop; y++) for (let x = x0; x < x0 + 3; x++) put(g, x, y, 'p');
    for (let y = Math.max(bootTop, 24 + crouch); y <= 30 - lift; y++) for (let x = x0; x < x0 + 3; x++) put(g, x, y, 'b');
    put(g, toe, 30 - lift, 'b');
  };
  leg(5, liftL, 4);
  leg(8, liftR, 11);
  for (let y = 24 + crouch; y <= 27; y++) { if (g[y][7] === 'p') g[y][7] = 'P'; if (g[y][8] === 'p') g[y][8] = 'q'; }
}

function torsoSide(g: Grid, by: number): void {
  for (let y = 15; y <= 20; y++) for (let x = 6; x <= 10; x++) put(g, x, y + by, 'c');
  put(g, 10, 15 + by, 'k'); put(g, 9, 15 + by, 'N');
  for (let x = 6; x <= 10; x++) put(g, x, 21 + by, 'w');
}

function legsSide(g: Grid, stride: number, lift: number, crouch: number): void {
  for (let y = 22; y <= 23; y++) for (let x = 6; x <= 10; x++) put(g, x, y + crouch, 'p');
  const leg = (s: number, role: string, boot: string, lf: number) => {
    const hip = 7, foot = 7 + s;
    for (let y = 24 + crouch; y <= 27; y++) {
      const t = (y - 23) / 5;
      const x = Math.round(hip + (foot - hip) * t);
      for (let k = 0; k < 3; k++) put(g, x + k, y - (y >= 26 ? lf : 0), role);
    }
    for (let y = 28; y <= 30; y++) {
      for (let k = 0; k < 3; k++) put(g, foot + k, y - lf, boot);
      if (y >= 29) put(g, foot + 3, y - lf, boot);
    }
  };
  leg(-stride, 'P', 'B', 0);
  leg(stride, 'p', 'b', lift);
}

/** Braço de perfil: manga curta + antebraço de pele. near=false → atrás do corpo, mais escuro. */
function armSide(g: Grid, swing: number, by: number, near: boolean): void {
  const hx = 7 + swing * 2, hy = 21;
  limb(g, 7, 16 + by, hx, hy + by, 2, (t) => (t < 0.3 ? (near ? 'a' : 'A') : near ? 's' : 'S'));
  put(g, hx, hy + 1 + by, 'S');
}

function compose(dir: Dir, ps: Pose, style: number): Grid {
  const g = newGrid();
  const crouch = ps.crouch ?? 0;
  const by = ps.bob + crouch;
  const [hf, hs] = HAIR[style] ?? HAIR[0];
  const hy = by + (ps.head ?? 0);
  if (dir === 's') {
    if (!ps.hands && !ps.armsUp) armSide(g, -ps.swingR, by, false);
    legsSide(g, ps.stride, ps.liftL, crouch);
    torsoSide(g, by);
    if (ps.hands && ps.hands[1] < 12) {
      const [hx, hy2] = ps.hands;
      limb(g, 7, 16 + by, hx, hy2 + by, 2, (t) => (t < 0.3 ? 'a' : 's'));
    }
    if (ps.armsUp) { put(g, 9, 2 + by, 's'); put(g, 10, 2 + by, 's'); put(g, 9, 3 + by, 'S'); put(g, 10, 3 + by, 's'); }
    stamp(g, HEAD_S, 4, hy);
    stamp(g, hs, 0, hy);
    if (ps.hands && ps.hands[1] >= 12) {
      const [hx, hy2] = ps.hands;
      limb(g, 7, 16 + by, hx, hy2 + by, 2, (t) => (t < 0.3 ? 'a' : 's'));
      put(g, hx, hy2 + 1 + by, 'S');
    } else if (!ps.hands && !ps.armsUp) armSide(g, ps.swingR, by, true);
    return g;
  }
  const back = dir === 'u';
  legsFront(g, ps.liftL, ps.liftR, crouch);
  torsoFront(g, by, back);
  if (ps.hands) {
    const [hx, hy2] = ps.hands;
    limb(g, 3, 16 + by, hx - 2, hy2 + by, 2, (t) => (t < 0.3 ? 'a' : 's'));
    limb(g, 11, 16 + by, hx, hy2 + by, 2, (t) => (t < 0.3 ? 'a' : 's'));
    put(g, hx - 1, hy2 + 1 + by, 'S'); put(g, hx, hy2 + 1 + by, 'S');
  } else if (ps.armsUp) {
    limb(g, 2, 16 + by, 2, 3 + by, 2, (t) => (t > 0.85 ? 'a' : 's'));
    limb(g, 12, 16 + by, 12, 3 + by, 2, (t) => (t > 0.85 ? 'a' : 's'));
  } else {
    armFront(g, 0, back ? ps.swingR : ps.swingL, by);
    armFront(g, 1, back ? ps.swingL : ps.swingR, by);
  }
  stamp(g, HEAD_D, 4, hy);
  if (back) {
    // costas: cabeça coberta de cabelo (exceto nuca)
    for (let y = 4; y <= 12; y++) for (let x = 0; x < W; x++) {
      const yy = y + hy;
      if (yy >= 0 && yy < H && 'sSer'.includes(g[yy][x])) g[yy][x] = 'h';
    }
    for (let x = 0; x < W; x++) { const yy = 13 + hy; if (yy < H && g[yy][x] === 's') g[yy][x] = 'S'; }
  }
  stamp(g, hf, 0, hy);
  if (back) {
    if (style === 2) for (let y = 12; y <= 17; y++) for (let x = 6; x <= 9; x++) put(g, x, y + hy, y > 15 ? 'H' : 'h');
    if (style === 1) for (let y = 12; y <= 17; y++) for (let x = 3; x <= 12; x++) put(g, x, y + hy, y === 17 ? 'H' : 'h');
  }
  return g;
}

/** Sombreamento automático por material + cor + contorno colorido. */
function render(g: Grid, look: Appearance): PixelCanvas {
  const skin = SKINS[look.skin % SKINS.length], hair = HAIRS[look.hairColor % HAIRS.length];
  const shirt = CLOTHES[look.shirt % CLOTHES.length], pants = CLOTHES[look.pants % CLOTHES.length];
  const out = g.map((row) => row.slice());
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : '.');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = g[y][x];
    if (r === '.') continue;
    const right = at(x + 1, y), down = at(x, y + 1), left = at(x - 1, y), up = at(x, y - 1);
    if (r === 'c') {
      if (right === '.' || down === '.') out[y][x] = 'C';
      else if (left === '.' || up === '.' || up === 'N') out[y][x] = 'k';
    } else if (r === 'a') {
      if (right !== 'a') out[y][x] = 'A';
      else if (up === '.') out[y][x] = 'k';
    } else if (r === 's') {
      if (right === '.' && y > 14) out[y][x] = 'S';
    } else if (r === 'h') {
      if (right === '.' || down === '.') out[y][x] = 'H';
      else if ((left === '.' || up === '.') && (x + y) % 2 === 0) out[y][x] = 'K';
    } else if (r === 'p') {
      if (right === '.') out[y][x] = 'P';
      else if (left === '.') out[y][x] = 'q';
    } else if (r === 'b') {
      if (up !== 'b') out[y][x] = 'n';
    }
  }
  const pal: Record<string, Color> = {
    s: skin[1], S: skin[0], N: skin[0], L: skin[2], e: rgb('#2a1622'), r: mix(skin[1], rgb('#e8506a'), 0.35),
    h: hair[1], H: hair[0], K: hair[2],
    c: shirt[1], C: shirt[0], k: shirt[2], a: shirt[1], A: shirt[0],
    p: pants[1], P: pants[0], q: pants[2],
    b: rgb('#5e3a1c'), B: rgb('#3e2410'), n: rgb('#7e5230'),
    w: rgb('#4a2a14'), g: P.gold2,
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
  pose({}),
  pose({ liftL: 1, bob: -1, swingL: -1, swingR: 1 }), pose({ liftL: 2, bob: -1, swingL: -1, swingR: 1 }),
  pose({}),
  pose({ liftR: 1, bob: -1, swingL: 1, swingR: -1 }), pose({ liftR: 2, bob: -1, swingL: 1, swingR: -1 }),
];
const WALK_SIDE: Pose[] = [
  pose({ stride: 2, swingR: -2 }), pose({ stride: 1, bob: -1, swingR: -1 }), pose({ stride: 0, bob: -1, liftL: 1, swingR: 0 }),
  pose({ stride: -2, swingR: 2 }), pose({ stride: -1, bob: -1, swingR: 1 }), pose({ stride: 0, bob: -1, liftL: 1, swingR: 0 }),
];
const IDLE: Pose[] = [pose({}), pose({ bob: 1 })];

/** Poses de ferramenta por direção (mãos onde a ferramenta é desenhada). */
export const SWING_HANDS: Record<Dir, [number, number][]> = {
  d: [[8, 2], [8, 13], [8, 20], [8, 19]],
  u: [[8, 15], [8, 4], [8, 2], [8, 3]],
  s: [[5, 3], [10, 7], [12, 18], [12, 19]],
};
export const WATER_HANDS: Record<Dir, [number, number][]> = { d: [[8, 19], [8, 20]], u: [[8, 15], [8, 15]], s: [[12, 17], [12, 18]] };
export const HARVEST_HANDS: Record<Dir, [number, number][]> = { d: [[8, 21], [8, 23]], u: [[8, 17], [8, 17]], s: [[11, 21], [12, 23]] };

export const PLAYER_ANIMS = {
  idle: 2,
  walk: WALK_FRAMES,
  carry: WALK_FRAMES,
  swing: 4,
  water: 2,
  harvest: 2,
} as const;
export type PlayerAnim = keyof typeof PLAYER_ANIMS;

/** Direções dos quadros no atlas ('l' = lado espelhado, gerado à parte). */
export type FrameDir = Dir | 'l';
/** Nome do frame no atlas. */
export function playerFrame(dir: FrameDir, anim: PlayerAnim, i: number): string { return `pl_${dir}_${anim}_${i}`; }

/** Adiciona todos os frames do jogador ao atlas com a aparência dada. */
export function addPlayer(ab: AtlasBuilder, look: Appearance): void {
  const dirs: Dir[] = ['d', 'u', 's'];
  const add = (name: string, p: Pose, d: Dir) => {
    ab.add(name, W, H, (pc) => pc.blit(render(compose(d, p, look.hairStyle), look), 0, 0));
    // quadros virados para a esquerda: espelhados na geração (sem flip em tempo real)
    if (d === 's') ab.add(name.replace('pl_s_', 'pl_l_'), W, H, (pc) => pc.blit(render(compose(d, p, look.hairStyle), look), 0, 0, true));
  };
  for (const d of dirs) {
    IDLE.forEach((p, i) => add(playerFrame(d, 'idle', i), p, d));
    const walk = d === 's' ? WALK_SIDE : WALK_FRONT;
    walk.forEach((p, i) => add(playerFrame(d, 'walk', i), p, d));
    walk.forEach((p, i) => add(playerFrame(d, 'carry', i), { ...p, armsUp: true }, d));
    SWING_HANDS[d].forEach((h, i) => add(playerFrame(d, 'swing', i), pose({ hands: h, bob: i >= 2 ? 1 : 0, liftL: d === 's' && i === 0 ? 1 : 0 }), d));
    WATER_HANDS[d].forEach((h, i) => add(playerFrame(d, 'water', i), pose({ hands: h }), d));
    HARVEST_HANDS[d].forEach((h, i) => add(playerFrame(d, 'harvest', i), pose({ hands: h, crouch: i }), d));
  }
}

/** Renderiza um frame isolado (para a tela de criação de personagem). */
export function renderPlayerPreview(look: Appearance, dir: Dir = 'd'): PixelCanvas {
  return render(compose(dir, pose({}), look.hairStyle), look);
}
