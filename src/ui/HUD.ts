import Phaser from 'phaser';
import { G } from '../state';
import { UI } from '../config';
import { panelImg, txt, icon } from './widgets';
import { WEEKDAYS, weekday, fmtTime } from '../systems/Time';

/** Dinheiro no topo esquerdo, com contador animado. */
export class MoneyDisplay {
  readonly c: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.BitmapText;
  private shown = 0;
  private last = -1;
  readonly w = 128;
  readonly h = 36;

  constructor(scene: Phaser.Scene) {
    this.c = scene.add.container(0, 0).setDepth(10);
    const bg = panelImg(scene, 0, 0, this.w, this.h, 'wood');
    const coin = icon(scene, 18, this.h / 2, 'icon_coin_big', UI);
    this.text = txt(scene, this.w - 10, 8, '0', 'gold').setOrigin(1, 0);
    this.c.add([bg, coin, this.text]);
    this.shown = G.player.money;
  }

  update(dt: number): void {
    const target = G.player.money;
    if (this.shown !== target) {
      const diff = target - this.shown;
      const step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 8));
      this.shown = Math.abs(diff) <= step ? target : this.shown + Math.sign(diff) * step;
    }
    const v = Math.round(this.shown);
    if (v !== this.last) { this.last = v; this.text.setText(String(v)); }
  }
}

/** Painel estilo relógio: dia, data, estação, clima, hora e ponteiro solar. */
export class Clock {
  readonly c: Phaser.GameObjects.Container;
  private day: Phaser.GameObjects.BitmapText;
  private timeT: Phaser.GameObjects.BitmapText;
  private wx: Phaser.GameObjects.Image;
  private season: Phaser.GameObjects.Image;
  private hand: Phaser.GameObjects.Image;
  readonly w = 76 * UI;
  readonly h = 40 * UI;
  private lastKey = '';

  constructor(scene: Phaser.Scene) {
    this.c = scene.add.container(0, 0).setDepth(10);
    const bg = scene.add.image(0, 0, 'atlas', 'ui_clock').setOrigin(0, 0).setScale(UI);
    const dial = scene.add.image(4 * UI, 9 * UI, 'atlas', 'ui_dial').setOrigin(0, 0).setScale(UI);
    this.hand = scene.add.image((4 + 11) * UI, (9 + 11) * UI, 'atlas', 'px_d').setOrigin(0.5, 1).setScale(UI * 0.25, UI * 2.5);
    const hub = scene.add.image((4 + 11) * UI, (9 + 11) * UI, 'atlas', 'px_d').setScale(UI * 0.5);
    this.day = txt(scene, 30 * UI, 3 * UI, '', 'dark');
    this.wx = scene.add.image(31 * UI, 16 * UI, 'atlas', 'wx_sun').setOrigin(0, 0).setScale(UI);
    this.season = scene.add.image(48 * UI, 16 * UI, 'atlas', 'wx_s0').setOrigin(0, 0).setScale(UI);
    this.timeT = txt(scene, 30 * UI, 27 * UI, '', 'dark');
    this.c.add([bg, dial, this.hand, hub, this.day, this.wx, this.season, this.timeT]);
    this.refresh();
  }

  refresh(): void {
    const t = G.time;
    const key = `${t.day}|${t.season}|${Math.floor(t.min / 10)}|${G.weather.today}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.day.setText(`${WEEKDAYS[weekday()]} ${t.day}`);
    this.timeT.setText(fmtTime());
    this.wx.setFrame(`wx_${G.weather.today}`);
    this.season.setFrame(`wx_s${t.season}`);
    // 6:00 → esquerda (-90°), 16:00 → topo, 2:00 → direita (+90°)
    this.hand.angle = -90 + ((t.min - 360) / 1200) * 180;
  }
}

/** Barra vertical de energia (verde → amarelo → vermelho). */
export class EnergyBar {
  readonly c: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Image;
  readonly w = 12 * UI;
  readonly h = 74 * UI;
  private innerH = 60 * UI;
  private last = -1;

  constructor(scene: Phaser.Scene) {
    this.c = scene.add.container(0, 0).setDepth(10);
    const fr = scene.add.image(0, 0, 'atlas', 'ui_energy').setOrigin(0, 0).setScale(UI);
    this.fill = scene.add.image(3 * UI, 63 * UI, 'atlas', 'px_g').setOrigin(0, 1);
    this.c.add([fr, this.fill]);
  }

  update(): void {
    const p = G.player;
    const f = Math.max(0, Math.min(1, p.energy / p.maxEnergy));
    const q = Math.round(f * 120);
    if (q === this.last) return;
    this.last = q;
    const h = Math.max(f > 0 ? 1 : 0, Math.round(f * this.innerH));
    this.fill.setFrame(f > 0.5 ? 'px_g' : f > 0.25 ? 'px_y' : 'px_r');
    this.fill.setDisplaySize(6 * UI, h);
  }
}
