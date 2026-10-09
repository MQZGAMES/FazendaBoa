import { rgb, type Color } from './pixel';

/** Paleta central (~48 cores base + variações sazonais). */
export const P = {
  // Grama (escuro → claro)
  grass0: rgb('#24502e'), grass1: rgb('#36723a'), grass2: rgb('#4f9442'), grass3: rgb('#6cb24c'), grass4: rgb('#94cf5e'),
  // Terra
  dirt0: rgb('#5e3d26'), dirt1: rgb('#83583a'), dirt2: rgb('#a67a4f'), dirt3: rgb('#c49a66'), dirt4: rgb('#d9b682'),
  soil0: rgb('#3e2516'), soil1: rgb('#5a3721'), soil2: rgb('#76492b'), soil3: rgb('#8f5c37'),
  wet0: rgb('#24140c'), wet1: rgb('#352015'), wet2: rgb('#47291a'), wet3: rgb('#5b3824'),
  // Madeira
  wood0: rgb('#3b1f10'), wood1: rgb('#6a3a1c'), wood2: rgb('#94582a'), wood3: rgb('#bf7d3c'), wood4: rgb('#e0a65b'),
  // Pedra
  stone0: rgb('#3a3540'), stone1: rgb('#5d5763'), stone2: rgb('#837d86'), stone3: rgb('#aaa4a6'), stone4: rgb('#d4cfc8'),
  // Água
  water0: rgb('#1c3f7a'), water1: rgb('#245aa0'), water2: rgb('#2f76c2'), water3: rgb('#4a97dc'), waterHi: rgb('#8cc8f2'), foam: rgb('#e4f4ff'),
  // Areia
  sand0: rgb('#b88d55'), sand1: rgb('#d6b071'), sand2: rgb('#ecd294'),
  // Folhagem / plantas
  leaf0: rgb('#1d4228'), leaf1: rgb('#2c6233'), leaf2: rgb('#418a3c'), leaf3: rgb('#62ad48'), leaf4: rgb('#8fcc5c'),
  // Flores
  flowerY: rgb('#ffd447'), flowerW: rgb('#fbf3e4'), flowerP: rgb('#f08fb4'), flowerB: rgb('#7fa6f0'), flowerR: rgb('#e5534b'),
  // Telhado / construções
  roof0: rgb('#4a1c1c'), roof1: rgb('#7a2b26'), roof2: rgb('#a53f2f'), roof3: rgb('#cc5e3c'),
  wall0: rgb('#5a3a22'), wall1: rgb('#8b5e37'), wall2: rgb('#b8854f'), wall3: rgb('#d9ab6c'),
  glass0: rgb('#2b4d6e'), glass1: rgb('#4f86b3'), glass2: rgb('#a8d8f0'), glowWin: rgb('#ffd27a'),
  // UI
  uiOut: rgb('#2b160a'), uiWood0: rgb('#5e3014'), uiWood1: rgb('#8e4f22'), uiWood2: rgb('#c27a37'), uiWood3: rgb('#e8a85a'),
  parch0: rgb('#c99a5b'), parch1: rgb('#e7c27f'), parch2: rgb('#f6dea5'), parch3: rgb('#fff1cc'),
  gold0: rgb('#9a5a12'), gold1: rgb('#d99a1e'), gold2: rgb('#ffcf40'), gold3: rgb('#fff09a'),
  text: rgb('#3b2312'), textLight: rgb('#fff3d6'),
  red: rgb('#d8443a'), redDark: rgb('#8a2020'), green: rgb('#5cbf45'), greenDark: rgb('#2e7a2a'), yellow: rgb('#f2d23c'), blue: rgb('#4a90d8'),
  white: rgb('#ffffff'), black: rgb('#120a08'), shadow: rgb('#000000', 70),
  // Metais / ferramentas
  steel0: rgb('#3d4049'), steel1: rgb('#6b707c'), steel2: rgb('#a0a6b0'), steel3: rgb('#d8dde2'),
  copper0: rgb('#5a2a14'), copper1: rgb('#9a4e26'), copper2: rgb('#d0783c'), copper3: rgb('#f2a868'),
  iron0: rgb('#3a3e4a'), iron1: rgb('#7d8696'), iron2: rgb('#bcc6d2'), iron3: rgb('#f0f4f8'),
  goldT0: rgb('#7a4a08'), goldT1: rgb('#c88a14'), goldT2: rgb('#f4c234'), goldT3: rgb('#fff08a'),
};

export type Season = 0 | 1 | 2 | 3; // primavera, verão, outono, inverno
export const SEASON_NAMES = ['Primavera', 'Verão', 'Outono', 'Inverno'] as const;

export interface GrassPal { g0: Color; g1: Color; g2: Color; g3: Color; g4: Color; }
/** Grama por estação. */
export const GRASS: readonly GrassPal[] = [
  { g0: rgb('#24502e'), g1: rgb('#36723a'), g2: rgb('#4f9442'), g3: rgb('#6cb24c'), g4: rgb('#94cf5e') },
  { g0: rgb('#1f4628'), g1: rgb('#2f6633'), g2: rgb('#43863a'), g3: rgb('#5ea342'), g4: rgb('#86c050') },
  { g0: rgb('#4a4220'), g1: rgb('#6d6428'), g2: rgb('#8f8434'), g3: rgb('#b0a043'), g4: rgb('#cfbb5c') },
  { g0: rgb('#7f8fae'), g1: rgb('#a8b6cf'), g2: rgb('#cbd6e6'), g3: rgb('#e4ecf5'), g4: rgb('#f8fbff') },
];

export interface FoliagePal { f0: Color; f1: Color; f2: Color; f3: Color; f4: Color; }
/** Copa das árvores/arbustos por estação (inverno = galhos nus com neve). */
export const FOLIAGE: readonly FoliagePal[] = [
  { f0: rgb('#1d4228'), f1: rgb('#2c6233'), f2: rgb('#418a3c'), f3: rgb('#62ad48'), f4: rgb('#9ad466') },
  { f0: rgb('#163a22'), f1: rgb('#22562c'), f2: rgb('#337a35'), f3: rgb('#4e9a3e'), f4: rgb('#7dbd52') },
  { f0: rgb('#5a2210'), f1: rgb('#8e3a16'), f2: rgb('#c4601e'), f3: rgb('#e59032'), f4: rgb('#f6c45a') },
  { f0: rgb('#5c6a86'), f1: rgb('#8e9cb8'), f2: rgb('#bcc8dc'), f3: rgb('#e2e9f3'), f4: rgb('#ffffff') },
];

/** Tons de pele (escuro, médio, claro) para criação de personagem. */
export const SKINS: readonly [Color, Color, Color][] = [
  [rgb('#b8705a'), rgb('#e09c78'), rgb('#f8c9a0')],
  [rgb('#a0583e'), rgb('#cc8458'), rgb('#eab286')],
  [rgb('#7a4128'), rgb('#a8643c'), rgb('#cf8c5c')],
  [rgb('#5a2c18'), rgb('#7e4426'), rgb('#a6643a')],
  [rgb('#3e1e10'), rgb('#5c3018'), rgb('#7e4626')],
];

/** Cores de cabelo (sombra, base, luz). */
export const HAIRS: readonly [Color, Color, Color][] = [
  [rgb('#3a1c0e'), rgb('#6a3418'), rgb('#9a5a2c')],
  [rgb('#1a1214'), rgb('#33262a'), rgb('#54444a')],
  [rgb('#8a5a14'), rgb('#d8a032'), rgb('#f6d47a')],
  [rgb('#6a1e10'), rgb('#b0401c'), rgb('#e0703a')],
  [rgb('#6a6670'), rgb('#aaa6b0'), rgb('#e6e2ea')],
  [rgb('#3a1650'), rgb('#6e3290'), rgb('#a668c8')],
  [rgb('#14385a'), rgb('#2e6a9a'), rgb('#62a2d2')],
  [rgb('#6a1a3c'), rgb('#b8406e'), rgb('#ec84a8')],
];

/** Cores de roupa (sombra, base, luz). */
export const CLOTHES: readonly [Color, Color, Color][] = [
  [rgb('#7a1e1e'), rgb('#c0392e'), rgb('#e86a52')],
  [rgb('#1e3e7a'), rgb('#2e64b8'), rgb('#5a92e0')],
  [rgb('#1e5a2a'), rgb('#33883e'), rgb('#62b85a')],
  [rgb('#7a5a12'), rgb('#c89a26'), rgb('#f0cc5a')],
  [rgb('#4a2a6a'), rgb('#7a46a6'), rgb('#a878d2')],
  [rgb('#2a2a34'), rgb('#4a4a5a'), rgb('#76768a')],
  [rgb('#5a3218'), rgb('#8e5a30'), rgb('#bf8a52')],
  [rgb('#1e5a5a'), rgb('#2e8a8a'), rgb('#5ac2b8')],
  [rgb('#8a8a8e'), rgb('#cfcfd2'), rgb('#f6f6f6')],
  [rgb('#8a2a5a'), rgb('#c84a86'), rgb('#f07ab0')],
];
