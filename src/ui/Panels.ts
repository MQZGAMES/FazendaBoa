import Phaser from 'phaser';
import { UI } from '../config';
import { display } from '../systems/Display';
import { Modal } from './Modal';
import { txt, uiTex } from './widgets';
import { G, type ItemStack } from '../state';
import { ITEMS, MAX_STACK, itemIcon } from '../data/items';
import { QUALITY_MULT } from '../data/crops';
import { GENERAL_STORE, BACKPACK_SIZES, type ShopItem } from '../data/shops';
import { RECIPES, type Recipe } from '../data/recipes';
import { addItem, countItem, removeItem, canAdd } from '../systems/Inventory';
import { shippingBin, itemValue } from '../systems/DayCycle';
import { skillLevel } from '../systems/Skills';
import { bus } from '../systems/EventBus';
import { haptic } from '../systems/Haptics';
import type { WObj } from '../data/objects';

/* ---------- Grade de inventário reutilizável ---------- */
interface SV { bg: Phaser.GameObjects.Image; ic: Phaser.GameObjects.Image; ct: Phaser.GameObjects.BitmapText; st: Phaser.GameObjects.Image; x: number; y: number; }

export class InvGrid {
  views: SV[] = [];
  size = 40;
  art = 20;
  gap = 4;
  constructor(private scene: Phaser.Scene, c: Phaser.GameObjects.Container, public inv: (ItemStack | null)[], readonly x: number, readonly y: number, readonly cols: number, maxW: number, maxSize = 26) {
    this.art = Math.max(16, Math.min(maxSize, Math.floor((maxW - (cols - 1) * this.gap) / cols / UI)));
    this.size = this.art * UI;
    const key = uiTex(scene, 'slot', this.art, this.art);
    for (let i = 0; i < inv.length; i++) {
      const sx = x + (i % cols) * (this.size + this.gap), sy = y + Math.floor(i / cols) * (this.size + this.gap);
      const bg = scene.add.image(sx, sy, key).setOrigin(0, 0).setScale(UI);
      const ic = scene.add.image(sx + this.size / 2, sy + this.size / 2, 'atlas', 'px').setScale(UI * Math.min(1, this.art / 20)).setVisible(false);
      const ct = scene.add.bitmapText(sx + this.size - 3, sy + this.size - 3, 'tiny', '').setOrigin(1, 1).setScale(UI);
      const st = scene.add.image(sx + 8, sy + this.size - 8, 'atlas', 'star_1').setScale(UI * 0.7).setVisible(false);
      c.add([bg, ic, ct, st]);
      this.views.push({ bg, ic, ct, st, x: sx, y: sy });
    }
    this.refresh();
  }
  get height(): number { return Math.ceil(this.inv.length / this.cols) * (this.size + this.gap) - this.gap; }
  get width(): number { return this.cols * (this.size + this.gap) - this.gap; }
  refresh(sel = -1, dim?: (s: ItemStack) => boolean): void {
    const kN = uiTex(this.scene, 'slot', this.art, this.art), kS = uiTex(this.scene, 'slotSel', this.art, this.art);
    this.views.forEach((v, i) => {
      const s = this.inv[i];
      v.bg.setTexture(i === sel ? kS : kN);
      if (s) {
        const d = ITEMS[s.id];
        v.ic.setFrame(itemIcon(s.id, d?.tool ? G.player.tools[d.tool] : 0)).setVisible(true).setAlpha(dim && dim(s) ? 0.35 : 1);
        v.ct.setText(s.q > 1 ? String(s.q) : '');
        v.st.setVisible(!!s.ql); if (s.ql) v.st.setFrame(`star_${s.ql}`);
      } else { v.ic.setVisible(false); v.ct.setText(''); v.st.setVisible(false); }
    });
  }
  slotAt(px: number, py: number): number {
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      if (px >= v.x && px <= v.x + this.size && py >= v.y && py <= v.y + this.size) return i;
    }
    return -1;
  }
}

/** Move uma pilha inteira de um inventário para outro (empilhando). Retorna quanto sobrou. */
function transfer(from: (ItemStack | null)[], i: number, to: (ItemStack | null)[]): number {
  const s = from[i];
  if (!s) return 0;
  const left = addItem(s.id, s.q, s.ql ?? 0, to);
  if (left <= 0) from[i] = null; else s.q = left;
  return left;
}

/* ---------- Caixa de envio ---------- */
export class ShipPanel extends Modal {
  private grid!: InvGrid;
  private last!: Phaser.GameObjects.BitmapText;
  private lastIc!: Phaser.GameObjects.Image;
  private total!: Phaser.GameObjects.BitmapText;
  private history: { id: string; q: number; ql?: number }[] = [];

  present(): void {
    this.clear();
    this.history = [];
    const W = Math.min(390, display.cssW - 12);
    const rows = Math.ceil(G.player.inv.length / 6);
    const slot = Math.min(52, Math.floor((W - 36) / 6));
    const h = 150 + rows * (slot + 4) + 70;
    this.frame(W, h, 'parch', 70);
    this.c.add(txt(this.scene, this.px + 18, this.py + 16, 'Caixa de envio', 'dark'));
    this.c.add(txt(this.scene, this.px + 18, this.py + 44, 'Toque num item para vender. O dinheiro chega ao amanhecer.', 'dark', 1.5).setMaxWidth((W - 36) / 1.5));
    this.lastIc = this.scene.add.image(this.px + 36, this.py + 96, 'atlas', 'px').setScale(UI * 1.3).setVisible(false);
    this.last = txt(this.scene, this.px + 64, this.py + 84, '', 'dark', 1.5);
    this.total = txt(this.scene, this.px + W - 18, this.py + 84, '', 'dark').setOrigin(1, 0);
    this.c.add([this.lastIc, this.last, this.total]);
    this.grid = new InvGrid(this.scene, this.c, G.player.inv, this.px + 18, this.py + 128, 6, W - 36);
    const by = this.py + h - 62;
    this.button(this.px + 16, by, (W - 44) / 2, 48, 'Desfazer', () => this.undo());
    this.button(this.px + W / 2 + 6, by, (W - 44) / 2, 48, 'Fechar', () => this.hide());
    this.update();
    this.show();
  }

  private sellable(s: ItemStack): boolean { const d = ITEMS[s.id]; return !!d && d.cat !== 'tool' && d.price > 0; }

  private update(): void {
    const bin = shippingBin();
    const sum = bin.reduce((t, b) => t + itemValue(b.id, b.ql ?? 0) * b.q, 0);
    const lastB = bin[bin.length - 1];
    if (lastB) { this.lastIc.setFrame(itemIcon(lastB.id)).setVisible(true); this.last.setText(`${lastB.q}x ${ITEMS[lastB.id]?.name ?? lastB.id}`); }
    else { this.lastIc.setVisible(false); this.last.setText('Caixa vazia'); }
    this.total.setText(`${sum}g`);
    this.grid.refresh(-1, (s) => !this.sellable(s));
    bus.emit('inventory');
  }

  protected onTap(x: number, y: number): void {
    const i = this.grid.slotAt(x, y);
    if (i < 0) return;
    const s = G.player.inv[i];
    if (!s) return;
    if (!this.sellable(s)) { bus.emit('toast', 'Isso não pode ser vendido.', 'warn'); return; }
    shippingBin().push({ id: s.id, q: s.q, ql: s.ql });
    this.history.push({ id: s.id, q: s.q, ql: s.ql });
    G.player.inv[i] = null;
    haptic.tap();
    this.scene.tweens.add({ targets: this.lastIc, scale: UI * 1.6, duration: 80, yoyo: true });
    this.update();
  }

  private undo(): void {
    const h = this.history.pop();
    if (!h) return;
    const bin = shippingBin();
    const k = bin.findIndex((b) => b.id === h.id && b.q === h.q && (b.ql ?? 0) === (h.ql ?? 0));
    if (k < 0) return;
    const left = addItem(h.id, h.q, h.ql ?? 0);
    if (left >= h.q) { bus.emit('toast', 'Mochila cheia!', 'warn'); this.history.push(h); return; }
    if (left > 0) bin[k].q = left; else bin.splice(k, 1);
    this.update();
  }
}

/* ---------- Baú ---------- */
export class ChestPanel extends Modal {
  private cg!: InvGrid;
  private pg!: InvGrid;
  private obj: WObj | null = null;
  private onPickup: (() => void) | null = null;

  present(obj: WObj, onPickup: () => void): void {
    this.clear();
    this.obj = obj;
    this.onPickup = onPickup;
    if (!obj.inv) obj.inv = new Array(36).fill(null);
    const W = Math.min(390, display.cssW - 12);
    const pRows = Math.ceil(G.player.inv.length / 6), cRows = 6;
    const availH = display.cssH - display.safe.top - display.safe.bottom - 210;
    const slotArt = Math.max(16, Math.min(24, Math.floor(availH / (pRows + cRows) / UI) - 2));
    const slot = slotArt * UI;
    const h = 60 + (cRows + pRows) * (slot + 4) + 30 + 66;
    this.frame(W, h, 'parch', 60);
    this.c.add(txt(this.scene, this.px + 18, this.py + 16, 'Baú', 'dark'));
    this.c.add(txt(this.scene, this.px + W - 18, this.py + 20, 'toque para mover', 'dark', 1.5).setOrigin(1, 0));
    const gw = 6 * (slot + 4) - 4;
    const gx = this.px + Math.round((W - gw) / 2);
    this.cg = new InvGrid(this.scene, this.c, obj.inv, gx, this.py + 48, 6, gw, slotArt);
    const py = this.py + 48 + this.cg.height + 26;
    this.c.add(txt(this.scene, gx, py - 20, 'Mochila', 'dark', 1.5));
    this.pg = new InvGrid(this.scene, this.c, G.player.inv, gx, py, 6, gw, slotArt);
    const by = this.py + h - 60;
    const bw = (W - 48) / 3;
    this.button(this.px + 12, by, bw, 46, 'Guardar iguais', () => this.stackSame());
    this.button(this.px + 18 + bw, by, bw, 46, 'Recolher', () => this.pickup());
    this.button(this.px + 24 + bw * 2, by, bw, 46, 'Fechar', () => this.hide());
    this.show();
  }

  private refreshAll(): void { this.cg.refresh(); this.pg.refresh(); bus.emit('inventory'); }

  protected onTap(x: number, y: number): void {
    const inv = this.obj?.inv;
    if (!inv) return;
    let i = this.cg.slotAt(x, y);
    if (i >= 0 && inv[i]) {
      if (transfer(inv, i, G.player.inv) > 0) bus.emit('toast', 'Mochila cheia!', 'warn');
      haptic.tap(); this.refreshAll(); return;
    }
    i = this.pg.slotAt(x, y);
    if (i >= 0 && G.player.inv[i]) {
      if (transfer(G.player.inv, i, inv) > 0) bus.emit('toast', 'Baú cheio!', 'warn');
      haptic.tap(); this.refreshAll();
    }
  }

  /** Move para o baú tudo que já existe nele. */
  private stackSame(): void {
    const inv = this.obj?.inv;
    if (!inv) return;
    const ids = new Set(inv.filter((s): s is ItemStack => !!s).map((s) => s.id));
    let moved = 0;
    G.player.inv.forEach((s, i) => { if (s && ids.has(s.id) && ITEMS[s.id]?.cat !== 'tool') { const q = s.q; moved += q - transfer(G.player.inv, i, inv); } });
    bus.emit('toast', moved ? `${moved} itens guardados.` : 'Nenhum item igual na mochila.', moved ? 'good' : 'info');
    this.refreshAll();
  }

  private pickup(): void {
    if (this.obj?.inv?.some((s) => !!s)) { bus.emit('toast', 'Esvazie o baú antes de recolher.', 'warn'); return; }
    if (addItem('chest', 1) > 0) { bus.emit('toast', 'Mochila cheia!', 'warn'); return; }
    this.hide();
    this.onPickup?.();
  }
}

/* ---------- Lista rolável (loja e fabricação) ---------- */
abstract class ListPanel<T> extends Modal {
  protected list!: Phaser.GameObjects.Container;
  protected items: T[] = [];
  protected sel = -1;
  protected rowH = 58;
  protected lx = 0; protected ly = 0; protected lw = 0; protected lh = 0;
  private scrollY = 0;
  private dragStart = -1;
  private dragScroll = 0;
  private moved = false;
  private maskG: Phaser.GameObjects.Graphics | null = null;

  protected buildList(x: number, y: number, w: number, h: number): void {
    this.lx = x; this.ly = y; this.lw = w; this.lh = h;
    this.list = this.scene.add.container(0, 0);
    this.c.add(this.list);
    this.maskG?.destroy();
    this.maskG = this.scene.make.graphics({}, false);
    this.maskG.fillStyle(0xffffff).fillRect(x, y, w, h);
    this.list.setMask(this.maskG.createGeometryMask());
    this.scrollY = 0;
    this.renderRows();
  }

  protected abstract rowContent(item: T, x: number, y: number, w: number, selected: boolean): Phaser.GameObjects.GameObject[];
  protected abstract onSelect(i: number): void;

  protected renderRows(): void {
    this.list.removeAll(true);
    this.items.forEach((it, i) => {
      const y = this.ly + i * this.rowH;
      const bg = this.scene.add.image(this.lx, y, uiTex(this.scene, i === this.sel ? 'slotSel' : 'slot', Math.round(this.lw / UI), Math.round((this.rowH - 4) / UI))).setOrigin(0, 0).setScale(UI);
      this.list.add([bg, ...this.rowContent(it, this.lx, y, this.lw, i === this.sel)]);
    });
    this.applyScroll();
  }

  private applyScroll(): void {
    const max = Math.max(0, this.items.length * this.rowH - this.lh);
    this.scrollY = Math.max(0, Math.min(max, this.scrollY));
    this.list.y = -this.scrollY;
    // o mask acompanha o container pai (painel) ao abrir/arrastar
    if (this.maskG) this.maskG.y = this.c.y;
  }

  protected inList(x: number, y: number): boolean { return x >= this.lx && x <= this.lx + this.lw && y >= this.ly && y <= this.ly + this.lh; }

  protected onDown(x: number, y: number): void {
    if (this.inList(x, y)) { this.lockSwipe = true; this.dragStart = y; this.dragScroll = this.scrollY; this.moved = false; }
  }
  protected onMove(_x: number, y: number): void {
    if (this.dragStart < 0) return;
    if (Math.abs(y - this.dragStart) > 6) this.moved = true;
    this.scrollY = this.dragScroll - (y - this.dragStart);
    this.applyScroll();
  }
  protected onDragEnd(x: number, y: number): void {
    const wasMoved = this.moved;
    this.dragStart = -1;
    if (wasMoved || !this.inList(x, y)) return;
    const i = Math.floor((y - this.ly + this.scrollY) / this.rowH);
    if (i >= 0 && i < this.items.length) { this.sel = i; this.onSelect(i); this.renderRows(); }
  }
  update(): void { if (this.open && this.maskG) this.maskG.y = this.c.y; }
  hide(): void { super.hide(); }
}

/* ---------- Loja ---------- */
export class ShopPanel extends ListPanel<ShopItem> {
  private qty = 1;
  private qtyT!: Phaser.GameObjects.BitmapText;
  private moneyT!: Phaser.GameObjects.BitmapText;
  private infoT!: Phaser.GameObjects.BitmapText;
  private buyB: ReturnType<Modal['button']> | null = null;

  present(): void {
    this.clear();
    this.items = GENERAL_STORE.filter((s) => {
      if (s.upgrade === 'backpack24') return G.player.inv.length < BACKPACK_SIZES[1];
      if (s.upgrade === 'backpack36') return G.player.inv.length === BACKPACK_SIZES[1];
      return !s.seasons || s.seasons.includes(G.time.season);
    });
    this.sel = this.items.length ? 0 : -1;
    this.qty = 1;
    const W = Math.min(390, display.cssW - 12);
    const bottom = 176;
    const H = Math.min(display.cssH - display.safe.top - display.safe.bottom - 40, 48 + this.items.length * this.rowH + bottom + 6);
    this.frame(W, H, 'parch', 20);
    this.c.add(txt(this.scene, this.px + 18, this.py + 16, 'Loja da Vila', 'dark'));
    this.moneyT = txt(this.scene, this.px + W - 18, this.py + 16, '', 'dark').setOrigin(1, 0);
    this.c.add(this.moneyT);
    this.buildList(this.px + 14, this.py + 48, W - 28, H - 48 - bottom);
    const by = this.py + H - bottom + 6;
    this.infoT = txt(this.scene, this.px + 18, by, '', 'dark', 1.5).setMaxWidth((W - 36) / 1.5);
    this.c.add(this.infoT);
    const qy = by + 56;
    this.button(this.px + 16, qy, 48, 44, '-', () => this.setQty(this.qty - 1));
    this.qtyT = txt(this.scene, this.px + 98, qy + 12, '1', 'dark').setOrigin(0.5, 0);
    this.c.add(this.qtyT);
    this.button(this.px + 132, qy, 48, 44, '+', () => this.setQty(this.qty + 1));
    this.button(this.px + 186, qy, 52, 44, 'x5', () => this.setQty(this.qty + 5));
    this.button(this.px + 16, this.py + H - 58, (W - 44) / 2, 46, 'Fechar', () => this.hide());
    this.buyB = this.button(this.px + W / 2 + 6, this.py + H - 58, (W - 44) / 2, 46, 'Comprar', () => this.buy());
    this.refreshInfo();
    this.show();
  }

  private nameOf(s: ShopItem): string { return s.name ?? ITEMS[s.id]?.name ?? s.id; }

  protected rowContent(s: ShopItem, x: number, y: number, w: number): Phaser.GameObjects.GameObject[] {
    const ic = this.scene.add.image(x + 26, y + 26, 'atlas', itemIcon(s.id)).setScale(UI);
    const nm = txt(this.scene, x + 52, y + 10, this.nameOf(s), 'dark', 1.5);
    const pr = txt(this.scene, x + w - 12, y + 10, `${s.price}g`, 'dark', 1.5).setOrigin(1, 0);
    const owned = s.upgrade ? '' : `tem ${countItem(s.id)}`;
    const ow = txt(this.scene, x + 52, y + 30, owned, 'dark', 1.2).setAlpha(0.7);
    if (s.price > G.player.money) pr.setAlpha(0.45);
    return [ic, nm, pr, ow];
  }

  protected onSelect(): void { this.qty = 1; this.refreshInfo(); }

  private setQty(q: number): void {
    const s = this.items[this.sel];
    if (!s) return;
    this.qty = s.upgrade ? 1 : Math.max(1, Math.min(999, q));
    this.refreshInfo();
  }

  private refreshInfo(): void {
    this.moneyT.setText(`${G.player.money}g`);
    const s = this.items[this.sel];
    if (!s) { this.infoT.setText('Nada à venda nesta estação.'); return; }
    const d = ITEMS[s.id];
    this.qtyT.setText(String(this.qty));
    this.infoT.setText(`${this.nameOf(s)}: ${s.desc ?? d?.desc ?? ''}`);
    if (this.buyB?.label) this.buyB.label.setText(`Comprar ${s.price * this.qty}g`);
  }

  private buy(): void {
    const s = this.items[this.sel];
    if (!s) return;
    const cost = s.price * this.qty;
    if (cost > G.player.money) { bus.emit('toast', 'Dinheiro insuficiente.', 'warn'); return; }
    if (s.upgrade) {
      const target = s.upgrade === 'backpack24' ? BACKPACK_SIZES[1] : BACKPACK_SIZES[2];
      while (G.player.inv.length < target) G.player.inv.push(null);
      G.player.money -= cost;
      bus.emit('toast', `Mochila ampliada para ${target} slots!`, 'good');
      haptic.upgrade();
      this.present();
      bus.emit('inventory');
      return;
    }
    const left = addItem(s.id, this.qty);
    const bought = this.qty - left;
    if (bought <= 0) { bus.emit('toast', 'Mochila cheia!', 'warn'); return; }
    G.player.money -= s.price * bought;
    bus.emit('toast', `Comprou ${bought}x ${this.nameOf(s)}.`, 'good');
    haptic.tap();
    this.renderRows();
    this.refreshInfo();
  }
}

/* ---------- Fabricação ---------- */
export class CraftPanel extends ListPanel<Recipe> {
  private infoT!: Phaser.GameObjects.BitmapText;
  private makeB: ReturnType<Modal['button']> | null = null;

  private unlocked(r: Recipe): boolean { return !r.req || skillLevel(r.req[0]) >= r.req[1]; }
  private canMake(r: Recipe): boolean { return Object.entries(r.ing).every(([id, n]) => countItem(id) >= n); }

  present(): void {
    this.clear();
    this.items = RECIPES.filter((r) => this.unlocked(r));
    this.sel = this.items.length ? 0 : -1;
    const W = Math.min(390, display.cssW - 12);
    this.rowH = 64;
    const bottom = 120;
    const H = Math.min(display.cssH - display.safe.top - display.safe.bottom - 40, 48 + Math.max(2, this.items.length) * this.rowH + bottom + 6);
    this.frame(W, H, 'parch', 40);
    this.c.add(txt(this.scene, this.px + 18, this.py + 16, 'Fabricar', 'dark'));
    this.buildList(this.px + 14, this.py + 48, W - 28, H - 48 - bottom);
    this.infoT = txt(this.scene, this.px + 18, this.py + H - bottom + 8, '', 'dark', 1.5).setMaxWidth((W - 36) / 1.5);
    this.c.add(this.infoT);
    this.button(this.px + 16, this.py + H - 58, (W - 44) / 2, 46, 'Fechar', () => this.hide());
    this.makeB = this.button(this.px + W / 2 + 6, this.py + H - 58, (W - 44) / 2, 46, 'Fabricar', () => this.make());
    this.refreshInfo();
    this.show();
  }

  protected rowContent(r: Recipe, x: number, y: number, w: number): Phaser.GameObjects.GameObject[] {
    const ok = this.canMake(r);
    const out: Phaser.GameObjects.GameObject[] = [];
    out.push(this.scene.add.image(x + 26, y + 30, 'atlas', itemIcon(r.id)).setScale(UI).setAlpha(ok ? 1 : 0.5));
    out.push(txt(this.scene, x + 52, y + 8, `${ITEMS[r.id]?.name ?? r.id}${r.qty > 1 ? ' x' + r.qty : ''}`, 'dark', 1.5));
    let ix = x + 52;
    for (const [id, n] of Object.entries(r.ing)) {
      const have = countItem(id);
      out.push(this.scene.add.image(ix + 8, y + 42, 'atlas', itemIcon(id)).setScale(UI * 0.7));
      const t = txt(this.scene, ix + 20, y + 34, `${have}/${n}`, have >= n ? 'dark' : 'light', 1.2);
      if (have < n) t.setTint(0xd8443a);
      out.push(t);
      ix += 74;
      if (ix > x + w - 60) break;
    }
    return out;
  }

  protected onSelect(): void { this.refreshInfo(); }

  private refreshInfo(): void {
    const r = this.items[this.sel];
    if (!r) { this.infoT.setText('Nenhuma receita disponível.'); return; }
    const d = ITEMS[r.id];
    this.infoT.setText(`${d?.name ?? r.id}: ${d?.desc ?? ''}`);
    this.makeB?.bg.setAlpha(this.canMake(r) ? 1 : 0.6);
  }

  private make(): void {
    const r = this.items[this.sel];
    if (!r) return;
    if (!this.canMake(r)) { bus.emit('toast', 'Faltam ingredientes.', 'warn'); return; }
    if (!canAdd(r.id)) { bus.emit('toast', 'Mochila cheia!', 'warn'); return; }
    for (const [id, n] of Object.entries(r.ing)) removeItem(id, n);
    addItem(r.id, r.qty);
    bus.emit('toast', `Fabricou ${ITEMS[r.id]?.name ?? r.id}!`, 'good');
    haptic.tap();
    this.renderRows();
    this.refreshInfo();
  }
}

export { transfer, MAX_STACK, QUALITY_MULT };
