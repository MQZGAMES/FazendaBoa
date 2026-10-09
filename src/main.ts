import Phaser from 'phaser';
import { display, measureDisplay } from './systems/Display';
import { bus } from './systems/EventBus';
import { perf } from './systems/Performance';
import { saveGame } from './systems/Save';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

const container = document.getElementById('game')!;
measureDisplay(container);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: container,
  backgroundColor: '#1a110a',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, width: display.gameW, height: display.gameH, zoom: 1 / display.dpr },
  input: { activePointers: 4, touch: { capture: true }, mouse: { preventDefaultWheel: true } },
  fps: { target: 60, limit: 60, smoothStep: true },
  render: { powerPreference: 'high-performance', antialias: false, antialiasGL: false, batchSize: 4096, clearBeforeRender: true },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, TitleScene, WorldScene, UIScene],
});
perf.attach(game);

/** Redimensiona mantendo DPR ≤ 2 e zoom inteiro do mundo. */
function resize(): void {
  measureDisplay(container);
  game.scale.zoom = 1 / display.dpr;
  game.scale.resize(display.gameW, display.gameH);
  bus.emit('resize');
}
let resizeTimer = 0;
const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(resize, 80); };
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

/** Pausa completamente com a aba oculta e salva o jogo. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.scene.isActive('World')) void saveGame();
    game.loop.sleep();
  } else {
    game.loop.wake();
  }
});

// Reduz o risco de o navegador apagar o save
if (navigator.storage && navigator.storage.persist) void navigator.storage.persist().catch(() => undefined);

// Service worker (cache offline) só no build de produção
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}

// Bloqueia gestos do navegador (zoom de pinça, duplo toque, menu de contexto)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

declare global { interface Window { __game?: Phaser.Game; } }
if (import.meta.env.DEV) window.__game = game;
