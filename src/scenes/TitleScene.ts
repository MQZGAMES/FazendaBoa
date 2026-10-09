import Phaser from 'phaser';
import { display } from '../systems/Display';
import { bus } from '../systems/EventBus';
import { perf } from '../systems/Performance';
import { settings } from '../systems/Settings';
import { G, setGame, newGameState } from '../state';
import { UI, GAME_VERSION } from '../config';
import { uiTex, txt } from '../ui/widgets';
import { P } from '../art/palette';
import { toHex } from '../art/pixel';

interface Btn { x: number; y: number; w: number; h: number; act: () => void; bg: Phaser.GameObjects.Image; }

/** Tela de título: continuar / novo jogo; mede o desempenho por 2 s para escolher a qualidade. */
export class TitleScene extends Phaser.Scene {
  private btns: Btn[] = [];
  private benchT = 0;
  private benchFrames = 0;
  private benchDone = false;
  private hasSave = false;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];

  constructor() { super('Title'); }

  init(data: { hasSave?: boolean }): void { this.hasSave = !!data.hasSave; }

  create(): void {
    this.cameras.main.setBackgroundColor(toHex(P.water3));
    this.build();
    bus.on('resize', this.build, this);
    this.events.once('shutdown', () => bus.off('resize', this.build, this));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const x = p.x / display.dpr, y = p.y / display.dpr;
      for (const b of this.btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        b.bg.setTexture(uiTex(this, 'btnP', b.w / UI, b.h / UI));
        this.time.delayedCall(90, b.act);
      }
    });
  }

  private build(): void {
    for (const o of this.objs) o.destroy();
    this.objs = []; this.btns = []; this.clouds = [];
    const cam = this.cameras.main;
    cam.setSize(display.gameW, display.gameH).setZoom(display.dpr).setOrigin(0, 0).setScroll(0, 0);
    const W = display.cssW, H = display.cssH;
    // céu em faixas
    const g = this.add.graphics();
    const sky = ['#7ec4ec', '#8fcdee', '#a4d8f0', '#bfe3f2', '#d8eef2'];
    sky.forEach((c, i) => { g.fillStyle(parseInt(c.slice(1), 16)).fillRect(0, (H * 0.62 * i) / sky.length, W, H * 0.62 / sky.length + 1); });
    // colinas
    g.fillStyle(toHex(P.grass1)).fillEllipse(W * 0.2, H * 0.66, W * 1.1, H * 0.22);
    g.fillStyle(toHex(P.grass2)).fillEllipse(W * 0.85, H * 0.68, W * 1.0, H * 0.2);
    g.fillStyle(toHex(P.grass3)).fillRect(0, H * 0.68, W, H * 0.32);
    this.objs.push(g);
    // nuvens
    for (let i = 0; i < 4; i++) {
      const c = this.add.image(W * (0.15 + i * 0.27), H * (0.12 + (i % 2) * 0.08), 'atlas', 'wx_cloud').setScale(UI * 2 + (i % 2)).setAlpha(0.95);
      this.clouds.push(c); this.objs.push(c);
    }
    // árvores e casa
    const house = this.add.image(W * 0.5, H * 0.74, 'atlas', 'house').setOrigin(0.5, 1).setScale(UI);
    this.objs.push(house);
    for (let i = 0; i < 7; i++) {
      const t = this.add.image(W * (i / 6), H * 0.69 + (i % 2) * 18, 'atlas', `tree_${['oak', 'maple', 'pine'][i % 3]}_0`).setOrigin(0.5, 1).setScale(UI);
      if (Math.abs(i / 6 - 0.5) < 0.2) t.setVisible(false);
      this.objs.push(t);
    }
    for (let i = 0; i < 9; i++) {
      const f = this.add.image(W * (0.05 + i * 0.11), H * 0.78 + (i % 3) * 10, 'atlas', `flowers_${i % 3}`).setScale(UI);
      this.objs.push(f);
    }
    // logotipo
    const logoY = H * 0.2;
    const shadow = this.add.bitmapText(W / 2 + 3, logoY + 3, 'light', 'Fazenda Boa').setOrigin(0.5).setScale(5).setTint(0x2b160a);
    const logo = this.add.bitmapText(W / 2, logoY, 'gold', 'Fazenda Boa').setOrigin(0.5).setScale(5);
    this.tweens.add({ targets: [logo, shadow], y: '-=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.objs.push(shadow, logo);
    // botões
    const bw = 220, bh = 52;
    let by = H * 0.8;
    const mk = (label: string, act: () => void) => {
      const x = Math.round((W - bw) / 2), y = Math.round(by);
      const bg = this.add.image(x, y, uiTex(this, 'btn', bw / UI, bh / UI)).setOrigin(0, 0).setScale(UI);
      const t = txt(this, W / 2, y + 14, label, 'dark').setOrigin(0.5, 0);
      this.objs.push(bg, t);
      this.btns.push({ x, y, w: bw, h: bh, act, bg });
      by += bh + 12;
    };
    if (this.hasSave) mk('Continuar', () => this.start(false));
    mk(this.hasSave ? 'Novo jogo' : 'Começar', () => this.start(true));
    const v = txt(this, W - 8, H - 8 - display.safe.bottom, 'v' + GAME_VERSION, 'light', 1.5).setOrigin(1, 1).setAlpha(0.8);
    this.objs.push(v);
  }

  private start(fresh: boolean): void {
    if (fresh) {
      const look = G.player.look;
      setGame(newGameState());
      G.player.look = look;
      G.flags.newGame = 1;
    }
    this.scene.start('World');
  }

  update(_t: number, delta: number): void {
    for (const c of this.clouds) { c.x += delta * 0.006; if (c.x > display.cssW + 60) c.x = -60; }
    if (!this.benchDone) {
      this.benchT += delta; this.benchFrames++;
      if (this.benchT >= 2000) {
        this.benchDone = true;
        const avg = (this.benchFrames * 1000) / this.benchT;
        if (settings.quality === null) perf.initialFromBenchmark(avg);
        else perf.setForced(settings.quality);
      }
    }
  }
}
