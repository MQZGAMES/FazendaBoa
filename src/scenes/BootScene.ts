import Phaser from 'phaser';
import { generateArt } from '../art';
import { buildFonts } from '../art/font';
import { P } from '../art/palette';
import { toHex } from '../art/pixel';
import { display } from '../systems/Display';
import { G } from '../state';
import { loadSettings } from '../systems/Settings';
import { loadGame } from '../systems/Save';

/** Gera os sprites procedurais (ou carrega do cache) com barra de progresso. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    loadSettings();
    const msg = document.getElementById('boot-msg');
    if (msg) msg.remove();
    const cam = this.cameras.main;
    cam.setZoom(display.dpr).setOrigin(0, 0).setBackgroundColor(toHex(P.uiOut));
    buildFonts(this.game, [{ key: 'light', fill: P.textLight, shadow: P.uiOut }]);
    const W = display.cssW, H = display.cssH;
    const title = this.add.bitmapText(W / 2, H * 0.4, 'light', 'Fazenda Boa').setOrigin(0.5).setScale(4);
    const label = this.add.bitmapText(W / 2, H * 0.4 + 70, 'light', 'Preparando a fazenda…').setOrigin(0.5).setScale(2);
    const bw = Math.min(260, W - 60), bx = (W - bw) / 2, by = H * 0.4 + 40;
    const g = this.add.graphics();
    const draw = (f: number) => {
      g.clear();
      g.fillStyle(toHex(P.uiWood0)).fillRect(bx - 3, by - 3, bw + 6, 18);
      g.fillStyle(0x1a0e06).fillRect(bx, by, bw, 12);
      g.fillStyle(toHex(P.green)).fillRect(bx, by, Math.round(bw * f), 12);
      g.fillStyle(toHex(P.gold3), 0.5).fillRect(bx, by, Math.round(bw * f), 3);
    };
    draw(0);
    title.setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300 });
    void (async () => {
      const loaded = await loadGame();
      await generateArt(this.game, (loaded ?? G).player.look, (f, l) => { draw(f); label.setText(l); });
      if (/[?&]play/.test(location.search)) { if (!loaded) G.flags.newGame = 1; this.scene.start('World'); }
      else this.scene.start('Title', { hasSave: !!loaded });
    })();
  }
}
