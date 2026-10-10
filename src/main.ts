import Phaser from 'phaser';
import { display, measureDisplay } from './systems/Display';
import { bus } from './systems/EventBus';
import { perf } from './systems/Performance';
import { saveGame } from './systems/Save';
import { G } from './state';
import { input } from './systems/Input';
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

window.addEventListener('pagehide', () => { if (game.scene.isActive('World')) void saveGame(); });

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

declare global { interface Window { __game?: Phaser.Game; __snap?: (name: string, steps?: number, crop?: [number, number, number, number]) => Promise<string>; __sheet?: (name: string, frames: string[], tex?: string, scale?: number) => Promise<string>; __G?: () => typeof G; __input?: typeof input; } }
if (import.meta.env.DEV) {
  window.__game = game;
  window.__G = () => G;
  window.__input = input;
  /** Avança N quadros manualmente e envia uma captura para .snaps/<name>.png (pane oculto não renderiza). */
  window.__snap = (name: string, steps = 2, crop?: [number, number, number, number]) => new Promise((resolve) => {
    let t = performance.now();
    for (let i = 0; i < steps; i++) { t += 16.7; game.step(t, 16.7); }
    game.renderer.snapshot((img) => {
      let src = (img as HTMLImageElement).src;
      if (crop) {
        const c = document.createElement('canvas'); c.width = crop[2]; c.height = crop[3];
        c.getContext('2d')!.drawImage(img as HTMLImageElement, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
        src = c.toDataURL();
      }
      void fetch('/__snap?name=' + name, { method: 'POST', body: src }).then(() => resolve('ok'));
    });
    game.step(t + 16.7, 16.7);
  });
  /** Desenha frames do atlas ampliados lado a lado e salva em .snaps/<name>.png. */
  window.__sheet = (name: string, frames: string[], tex = 'player', scale = 6) => {
    const t = game.textures.get(tex);
    const src = t.getSourceImage() as HTMLImageElement;
    const fs = frames.map((f) => t.get(f));
    const cols = Math.min(10, fs.length);
    const fw = Math.max(...fs.map((f) => f.cutWidth)), fh = Math.max(...fs.map((f) => f.cutHeight));
    const c = document.createElement('canvas');
    c.width = cols * (fw + 2) * scale; c.height = Math.ceil(fs.length / cols) * (fh + 2) * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#5aa846'; ctx.fillRect(0, 0, c.width, c.height);
    fs.forEach((f, i) => ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, (i % cols) * (fw + 2) * scale, Math.floor(i / cols) * (fh + 2) * scale, f.cutWidth * scale, f.cutHeight * scale));
    return fetch('/__snap?name=' + name, { method: 'POST', body: c.toDataURL() }).then(() => 'ok');
  };
}
