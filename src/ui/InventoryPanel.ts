import Phaser from 'phaser';
import { UI } from '../config';
import { display } from '../systems/Display';
import { Modal } from './Modal';
import { txt, uiTex } from './widgets';
import { G, type ItemStack } from '../state';
import { ITEMS, MAX_STACK, itemIcon, type ItemCat } from '../data/items';
import { QUALITY_NAMES, QUALITY_MULT } from '../data/crops';
import { bus } from '../systems/EventBus';
import { haptic } from '../systems/Haptics';

const COLS = 6;
const CAT_ORDER: ItemCat[] = ['tool', 'seed', 'crop', 'food', 'artisan', 'animal', 'fish', 'mineral', 'resource', 'craft'];

interface SlotView { bg: Phaser.GameObjects.Image; ic: Phaser.GameObjects.Image; ct: Phaser.GameObjects.BitmapText; st: Phaser.GameObjects.Image; x: number; y: number; }

/**
 * Mochila: grade de slots (os 8 primeiros são a hotbar), informações do item,
 * arrastar e soltar ou tocar-e-tocar para trocar, botão Organizar.
 */
export class InventoryPanel extends Modal {
  private views: SlotView[] = [];
  private size = 40;
  private art = 20;
  private gx = 0;
  private gy = 0;
  private sel = -1;
  private dragFrom = -1;
  private itemDrag = false;
  private press = { x: 0, y: 0 };
  private ghost: Phaser.GameObjects.Image | null = null;
  private infoName!: Phaser.GameObjects.BitmapText;
  private infoDesc!: Phaser.GameObjects.BitmapText;
  private infoIcon!: Phaser.GameObjects.Image;
  private keyNorm = '';
  private keySel = '';
  private gap = 4;

  constructor(scene: Phaser.Scene) { super(scene); }

  present(): void {
    this.clear();
    this.sel = -1;
    const inv = G.player.inv;
    const rows = Math.ceil(inv.length / COLS);
    const W = Math.min(390, display.cssW - 12);
    this.art = Math.max(20, Math.min(26, Math.floor((W - 36 - (COLS - 1) * this.gap) / COLS / UI)));
    this.size = this.art * UI;
    const gridW = COLS * this.size + (COLS - 1) * this.gap;
    const h = 58 + rows * (this.size + this.gap) + 110 + 66;
    this.frame(W, h, 'parch', 70);
    this.c.add(txt(this.scene, this.px + 18, this.py + 16, 'Mochila', 'dark'));
    this.c.add(this.scene.add.image(this.px + W - 24, this.py + 24, 'atlas', 'icon_coin_big').setScale(UI));
    this.c.add(txt(this.scene, this.px + W - 40, this.py + 16, `${G.player.money}g`, 'dark').setOrigin(1, 0));
    this.gx = Math.round(this.px + (W - gridW) / 2);
    this.gy = this.py + 50;
    this.keyNorm = uiTex(this.scene, 'slot', this.art, this.art);
    this.keySel = uiTex(this.scene, 'slotSel', this.art, this.art);
    this.views = [];
    for (let i = 0; i < inv.length; i++) {
      const x = this.gx + (i % COLS) * (this.size + this.gap), y = this.gy + Math.floor(i / COLS) * (this.size + this.gap);
      const bg = this.scene.add.image(x, y, this.keyNorm).setOrigin(0, 0).setScale(UI);
      const ic = this.scene.add.image(x + this.size / 2, y + this.size / 2, 'atlas', 'px').setScale(UI).setVisible(false);
      const ct = this.scene.add.bitmapText(x + this.size - 3, y + this.size - 3, 'tiny', '').setOrigin(1, 1).setScale(UI);
      const st = this.scene.add.image(x + 9, y + this.size - 9, 'atlas', 'star_1').setScale(UI * 0.75).setVisible(false);
      this.c.add([bg, ic, ct, st]);
      if (i < 8) this.c.add(this.scene.add.bitmapText(x + 4, y + 3, 'tiny', String(i + 1)).setScale(UI * 0.75).setAlpha(0.55));
      this.views.push({ bg, ic, ct, st, x, y });
    }
    // separador da hotbar
    const iy = this.gy + rows * (this.size + this.gap) + 6;
    this.infoIcon = this.scene.add.image(this.px + 36, iy + 26, 'atlas', 'px').setScale(UI * 1.4).setVisible(false);
    this.infoName = txt(this.scene, this.px + 64, iy + 6, '', 'dark');
    this.infoDesc = txt(this.scene, this.px + 64, iy + 32, '', 'dark', 1.5).setMaxWidth((W - 84) / 1.5);
    this.c.add([this.infoIcon, this.infoName, this.infoDesc]);
    this.showInfo(-1);
    const by = this.py + h - 62;
    this.button(this.px + 16, by, (W - 44) / 2, 48, 'Organizar', () => this.sort());
    this.button(this.px + W / 2 + 6, by, (W - 44) / 2, 48, 'Fechar', () => this.hide());
    this.refresh();
    this.show();
  }

  private refresh(): void {
    const inv = G.player.inv;
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      const s = inv[i];
      v.bg.setTexture(i === this.sel ? this.keySel : this.keyNorm);
      if (s) {
        const d = ITEMS[s.id];
        v.ic.setFrame(itemIcon(s.id, d?.tool ? G.player.tools[d.tool] : 0)).setVisible(!(this.itemDrag && i === this.dragFrom));
        v.ct.setText(s.q > 1 ? String(s.q) : '');
        v.st.setVisible(!!s.ql);
        if (s.ql) v.st.setFrame(`star_${s.ql}`);
      } else { v.ic.setVisible(false); v.ct.setText(''); v.st.setVisible(false); }
    }
    bus.emit('inventory');
  }

  private showInfo(i: number): void {
    const s = i >= 0 ? G.player.inv[i] : null;
    if (!s) {
      this.infoIcon.setVisible(false);
      this.infoName.setText('Toque num item para ver');
      this.infoDesc.setText('Arraste para mover. Toque em um item e depois em outro slot para trocar. Os 8 primeiros slots são a hotbar.');
      return;
    }
    const d = ITEMS[s.id];
    this.infoIcon.setFrame(itemIcon(s.id, d?.tool ? G.player.tools[d.tool] : 0)).setVisible(true);
    const ql = s.ql ? ` (${QUALITY_NAMES[s.ql]})` : '';
    this.infoName.setText((d?.name ?? s.id) + ql);
    const parts: string[] = [];
    if (d?.desc) parts.push(d.desc);
    if (d && d.price > 0) parts.push(`Vende por ${Math.floor(d.price * (QUALITY_MULT[s.ql ?? 0] ?? 1))}g cada.`);
    if (d?.edible) parts.push(`Comer: +${Math.round(d.edible * (1 + (s.ql ?? 0) * 0.4))} de energia.`);
    if (d?.tool) parts.push(`Nível: ${['Básico', 'Bronze', 'Ferro', 'Ouro'][G.player.tools[d.tool] ?? 0]}.`);
    this.infoDesc.setText(parts.join(' '));
  }

  private slotAt(x: number, y: number): number {
    const cx = Math.floor((x - this.gx) / (this.size + this.gap)), cy = Math.floor((y - this.gy) / (this.size + this.gap));
    if (cx < 0 || cx >= COLS || cy < 0) return -1;
    const i = cy * COLS + cx;
    if (i >= this.views.length) return -1;
    const v = this.views[i];
    return x >= v.x && x <= v.x + this.size && y >= v.y && y <= v.y + this.size ? i : -1;
  }

  /** Move/troca/empilha o conteúdo de a em b. */
  private moveSlot(a: number, b: number): void {
    if (a === b || a < 0 || b < 0) return;
    const inv = G.player.inv;
    const A = inv[a], B = inv[b];
    if (A && B && A.id === B.id && (A.ql ?? 0) === (B.ql ?? 0) && ITEMS[A.id]?.cat !== 'tool' && B.q < MAX_STACK) {
      const add = Math.min(A.q, MAX_STACK - B.q);
      B.q += add; A.q -= add;
      if (A.q <= 0) inv[a] = null;
    } else { inv[a] = B; inv[b] = A; }
    haptic.tap();
  }

  protected onDown(x: number, y: number): void {
    const i = this.slotAt(x, y);
    this.press = { x, y };
    this.dragFrom = -1; this.itemDrag = false;
    if (i >= 0) {
      if (G.player.inv[i]) this.dragFrom = i;
      this.lockSwipe = true;
    }
  }

  protected onMove(x: number, y: number): void {
    if (this.dragFrom < 0) return;
    if (!this.itemDrag && Math.hypot(x - this.press.x, y - this.press.y) > 8) {
      this.itemDrag = true;
      const s = G.player.inv[this.dragFrom];
      if (!s) return;
      this.ghost = this.scene.add.image(x, y, 'atlas', itemIcon(s.id, ITEMS[s.id]?.tool ? G.player.tools[ITEMS[s.id].tool!] : 0)).setScale(UI * 1.3).setDepth(60).setAlpha(0.9);
      this.refresh();
    }
    if (this.ghost) this.ghost.setPosition(x, y - 18);
  }

  protected onDragEnd(x: number, y: number): void {
    const target = this.slotAt(x, y);
    if (this.itemDrag) {
      this.ghost?.destroy(); this.ghost = null;
      this.itemDrag = false;
      if (target >= 0) { this.moveSlot(this.dragFrom, target); this.sel = target; }
      this.dragFrom = -1;
      this.refresh();
      this.showInfo(this.sel);
      return;
    }
    this.dragFrom = -1;
    if (target < 0) return;
    // toque-toque: seleciona e depois toca no destino
    if (this.sel >= 0 && this.sel !== target && G.player.inv[this.sel]) { this.moveSlot(this.sel, target); this.sel = -1; this.refresh(); this.showInfo(target); return; }
    this.sel = this.sel === target ? -1 : target;
    this.refresh();
    this.showInfo(this.sel);
  }

  /** Organiza por categoria e nome, juntando pilhas (a hotbar mantém as ferramentas na frente). */
  private sort(): void {
    const inv = G.player.inv;
    const items = inv.filter((s): s is ItemStack => !!s).map((s) => ({ ...s }));
    const merged: ItemStack[] = [];
    for (const s of items) {
      const m = merged.find((x) => x.id === s.id && (x.ql ?? 0) === (s.ql ?? 0) && ITEMS[s.id]?.cat !== 'tool' && x.q < MAX_STACK);
      if (m) { const add = Math.min(s.q, MAX_STACK - m.q); m.q += add; s.q -= add; if (s.q > 0) merged.push(s); }
      else merged.push(s);
    }
    const rank = (s: ItemStack) => CAT_ORDER.indexOf(ITEMS[s.id]?.cat ?? 'craft');
    merged.sort((a, b) => rank(a) - rank(b) || (ITEMS[a.id]?.name ?? '').localeCompare(ITEMS[b.id]?.name ?? '') || (b.ql ?? 0) - (a.ql ?? 0));
    for (let i = 0; i < inv.length; i++) inv[i] = merged[i] ?? null;
    this.sel = -1;
    this.refresh();
    this.showInfo(-1);
  }

  hide(): void {
    this.ghost?.destroy(); this.ghost = null;
    super.hide();
  }
}
