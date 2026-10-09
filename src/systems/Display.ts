import { MAX_DPR, TILE, TARGET_TILES_WIDE } from '../config';

/** Métricas de tela compartilhadas (px CSS e px do jogo). */
export const display = {
  cssW: 390,
  cssH: 844,
  dpr: 1,
  gameW: 390,
  gameH: 844,
  /** zoom do mundo em px do jogo por px de arte (inteiro) */
  zoom: 3,
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
};

export function measureDisplay(container: HTMLElement): void {
  const w = Math.max(200, container.clientWidth);
  const h = Math.max(200, container.clientHeight);
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  display.cssW = w;
  display.cssH = h;
  display.dpr = dpr;
  display.gameW = Math.round(w * dpr);
  display.gameH = Math.round(h * dpr);
  display.zoom = Math.max(2, Math.round(display.gameW / (TILE * TARGET_TILES_WIDE)));
  const probe = document.getElementById('safe-probe');
  if (probe) {
    const cs = getComputedStyle(probe);
    display.safe.top = parseFloat(cs.paddingTop) || 0;
    display.safe.right = parseFloat(cs.paddingRight) || 0;
    display.safe.bottom = parseFloat(cs.paddingBottom) || 0;
    display.safe.left = parseFloat(cs.paddingLeft) || 0;
  }
}
