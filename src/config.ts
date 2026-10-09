/** Constantes globais do jogo. Balanceamento fica em data/. */
export const TILE = 16;
/** Telas 3x renderizam em 2x (diferença invisível em pixel art). */
export const MAX_DPR = 2;
/** Quantos tiles queremos ver na largura em retrato. */
export const TARGET_TILES_WIDE = 9;
/** Escala da arte da interface (px de arte → px CSS). */
export const UI = 2;
export const GAME_VERSION = '0.1.0';
declare const __ART_HASH__: string;
/** Versão dos sprites procedurais = hash do código de arte (muda → regenera o cache). */
export const ART_VERSION = __ART_HASH__;
/** Debug: sempre no dev; em produção só com ?debug na URL. */
export const DEBUG_ALLOWED = import.meta.env.DEV || /[?&]debug/.test(location.search);
/** Clamp do delta (s) para não teletransportar após engasgos. */
export const MAX_DT = 0.05;
