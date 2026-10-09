import Phaser from 'phaser';
import { G } from '../state';
import { UI } from '../config';
import { uiTex } from './widgets';
import { itemIcon, ITEMS } from '../data/items';

export const HOTBAR_SLOTS = 8;

/** 8 slots na base da tela; toque seleciona, arrastar troca, toque longo abre o inventário. */
export class Hotbar {
  readonly c: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Image[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private counts: Phaser.GameObjects.BitmapText[] = [];
  private bars: Phaser.GameObjects.Image[] = [];
  x = 0; y = 0; size = 40; gap = 2;
  private art = 20;
  private keySlot = '';
  private keySel = '';

  constructor(private scene: Phaser.Scene) {
    this.c = scene.add.container(0, 0).setDepth(10);
  }

  /** Recria os slots no tamanho certo para a largura da tela. */
  layout(cssW: number, bottom: number, safeL: number, safeR: number): void {
    const avail = cssW - safeL - safeR - 12;
    this.art = Math.max(18, Math.min(24, Math.floor((avail - (HOTBAR_SLOTS - 1) * 2) / HOTBAR_SLOTS / UI)));
    this.size = this.art * UI;
    this.gap = 2;
    const total = HOTBAR_SLOTS * this.size + (HOTBAR_SLOTS - 1) * this.gap;
    this.x = Math.round(safeL + (cssW - safeL - safeR - total) / 2);
    this.y = Math.round(bottom - this.size);
    this.c.removeAll(true);
    this.slots = []; this.icons = []; this.counts = []; this.bars = [];
    const kNorm = uiTex(this.scene, 'slot', this.art, this.art);
    this.keySlot = kNorm;
    this.keySel = uiTex(this.scene, 'slotSel', this.art, this.art);
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = this.x + i * (this.size + this.gap);
      const s = this.scene.add.image(sx, this.y, kNorm).setOrigin(0, 0).setScale(UI);
      const ic = this.scene.add.image(sx + this.size / 2, this.y + this.size / 2, 'atlas', 'px').setScale(UI).setVisible(false);
      const ct = this.scene.add.bitmapText(sx + this.size - 3, this.y + this.size - 3, 'tiny', '').setOrigin(1, 1).setScale(UI);
      const bar = this.scene.add.image(sx + 4, this.y + this.size - 6, 'atlas', 'px_b').setOrigin(0, 0).setVisible(false);
      this.slots.push(s); this.icons.push(ic); this.counts.push(ct); this.bars.push(bar);
      this.c.add([s, ic, ct, bar]);
    }
    this.refresh();
  }

  get top(): number { return this.y; }
  get width(): number { return HOTBAR_SLOTS * this.size + (HOTBAR_SLOTS - 1) * this.gap; }

  refresh(): void {
    const p = G.player;
    for (let i = 0; i < this.slots.length; i++) {
      const st = p.inv[i] ?? null;
      this.slots[i].setTexture(i === p.sel ? this.keySel : this.keySlot);
      if (st) {
        const d = ITEMS[st.id];
        const tier = d?.tool ? p.tools[d.tool] : 0;
        this.icons[i].setFrame(itemIcon(st.id, tier)).setVisible(true);
        this.counts[i].setText(st.q > 1 ? String(st.q) : '');
        // barra de água do regador
        if (d?.tool === 'can') {
          const cap = [40, 55, 70, 85][p.tools.can] ?? 40;
          const f = Math.max(0, Math.min(1, p.water / cap));
          this.bars[i].setVisible(true).setDisplaySize(Math.max(1, (this.size - 8) * f), 3);
        } else this.bars[i].setVisible(false);
      } else {
        this.icons[i].setVisible(false);
        this.counts[i].setText('');
        this.bars[i].setVisible(false);
      }
    }
  }

  /** Índice do slot sob (x,y) em px CSS, ou -1. */
  hit(x: number, y: number): number {
    if (y < this.y - 6 || y > this.y + this.size + 8) return -1;
    const i = Math.floor((x - this.x + this.gap / 2) / (this.size + this.gap));
    return i >= 0 && i < HOTBAR_SLOTS ? i : -1;
  }

  /** Pequeno "pulo" no ícone selecionado. */
  bounce(i: number): void {
    const ic = this.icons[i];
    if (!ic) return;
    this.scene.tweens.add({ targets: ic, scale: UI * 1.25, duration: 70, yoyo: true });
  }
}
