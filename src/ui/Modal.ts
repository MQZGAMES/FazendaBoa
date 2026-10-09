import Phaser from 'phaser';
import { UI } from '../config';
import { display } from '../systems/Display';
import { perf } from '../systems/Performance';
import { uiState } from './state';
import { uiTex, txt, type PanelKind } from './widgets';

export interface MBtn { x: number; y: number; w: number; h: number; act: () => void; bg: Phaser.GameObjects.Image; kind: PanelKind; label?: Phaser.GameObjects.BitmapText; }

const openStack: Modal[] = [];
export function topModal(): Modal | null { return openStack.length ? openStack[openStack.length - 1] : null; }
export function anyModal(): boolean { return openStack.length > 0; }

/**
 * Painel modal que sobe de baixo para cima; fecha com toque fora ou deslizando para baixo.
 * Coordenadas em px CSS (câmera de UI com zoom = dpr).
 */
export class Modal {
  readonly c: Phaser.GameObjects.Container;
  protected dim: Phaser.GameObjects.Image;
  protected bg: Phaser.GameObjects.Image | null = null;
  protected btns: MBtn[] = [];
  open = false;
  /** retângulo do painel (px CSS) */
  px = 0; py = 0; pw = 0; ph = 0;
  closeOnOutside = true;
  private downBtn: MBtn | null = null;
  private dragY0 = -1;
  private dragging = false;
  onClose: (() => void) | null = null;

  constructor(protected scene: Phaser.Scene, depth = 30) {
    this.c = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    this.dim = scene.add.image(0, 0, 'atlas', 'px_k').setOrigin(0, 0).setAlpha(0.45);
    this.c.add(this.dim);
  }

  /** Limpa conteúdo (mantém o fundo escurecido). */
  protected clear(): void {
    for (const o of this.c.list.slice()) if (o !== this.dim) (o as Phaser.GameObjects.GameObject).destroy();
    this.btns = [];
    this.bg = null;
  }

  /** Cria o painel base com tamanho (px CSS) ancorado embaixo, acima da área segura. */
  protected frame(w: number, h: number, kind: PanelKind = 'parch', bottomGap = 70): void {
    const W = display.cssW, H = display.cssH;
    this.pw = Math.min(w, W - 16); this.ph = Math.min(h, H - display.safe.top - display.safe.bottom - 20);
    this.px = Math.round((W - this.pw) / 2);
    this.py = Math.round(Math.max(display.safe.top + 10, H - display.safe.bottom - bottomGap - this.ph));
    this.dim.setDisplaySize(W, H);
    this.bg = this.scene.add.image(this.px, this.py, uiTex(this.scene, kind, Math.round(this.pw / UI), Math.round(this.ph / UI))).setOrigin(0, 0).setScale(UI);
    this.c.add(this.bg);
  }

  protected button(x: number, y: number, w: number, h: number, label: string, act: () => void, kind: PanelKind = 'btn', font: 'dark' | 'light' = 'dark'): MBtn {
    const bg = this.scene.add.image(Math.round(x), Math.round(y), uiTex(this.scene, kind, Math.round(w / UI), Math.round(h / UI))).setOrigin(0, 0).setScale(UI);
    const t = txt(this.scene, x + w / 2, y + h / 2 - 8, label, font).setOrigin(0.5, 0);
    this.c.add([bg, t]);
    const b: MBtn = { x, y, w, h, act, bg, kind, label: t };
    this.btns.push(b);
    return b;
  }

  show(): void {
    if (!this.open) { openStack.push(this); }
    this.open = true;
    uiState.panelOpen = true;
    perf.setMenuOpen(true);
    this.c.setVisible(true).setAlpha(1);
    this.c.y = display.cssH * 0.25;
    this.dim.y = -this.c.y;
    this.scene.tweens.add({
      targets: this.c, y: 0, duration: 180, ease: 'Cubic.easeOut',
      onUpdate: () => { this.dim.y = -this.c.y; },
    });
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    const i = openStack.indexOf(this);
    if (i >= 0) openStack.splice(i, 1);
    if (!openStack.length) { uiState.panelOpen = false; perf.setMenuOpen(false); }
    this.scene.tweens.add({
      targets: this.c, alpha: 0, duration: 120,
      onComplete: () => { this.c.setVisible(false); this.c.alpha = 1; },
    });
    const cb = this.onClose; this.onClose = null;
    cb?.();
  }

  private btnAt(x: number, y: number): MBtn | null {
    for (let i = this.btns.length - 1; i >= 0; i--) {
      const b = this.btns[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  down(x: number, y: number): void {
    this.downBtn = this.btnAt(x, y);
    if (this.downBtn) {
      const b = this.downBtn;
      if (b.kind === 'btn') b.bg.setTexture(uiTex(this.scene, 'btnP', Math.round(b.w / UI), Math.round(b.h / UI)));
      if (b.label) b.label.y += 2;
    }
    this.dragY0 = y; this.dragging = false;
    this.onDown(x, y);
  }

  move(x: number, y: number): void {
    if (this.dragY0 >= 0 && y - this.dragY0 > 12 && !this.downBtn) this.dragging = true;
    if (this.dragging) { this.c.y = Math.max(0, y - this.dragY0); this.dim.y = -this.c.y; }
    this.onMove(x, y);
  }

  up(x: number, y: number): void {
    const b = this.downBtn;
    this.downBtn = null;
    if (b) {
      if (b.kind === 'btn') b.bg.setTexture(uiTex(this.scene, 'btn', Math.round(b.w / UI), Math.round(b.h / UI)));
      if (b.label) b.label.y -= 2;
      if (this.btnAt(x, y) === b) b.act();
      return;
    }
    if (this.dragging) {
      this.dragging = false;
      if (this.c.y > 60 && this.closeOnOutside) this.hide();
      else this.scene.tweens.add({ targets: this.c, y: 0, duration: 120, onUpdate: () => { this.dim.y = -this.c.y; } });
      return;
    }
    const inside = x >= this.px && x <= this.px + this.pw && y >= this.py && y <= this.py + this.ph;
    if (!inside && this.closeOnOutside && Math.abs(y - this.dragY0) < 10) { this.hide(); return; }
    this.onTap(x, y);
  }

  /* ganchos para subclasses */
  protected onDown(_x: number, _y: number): void { /* */ }
  protected onMove(_x: number, _y: number): void { /* */ }
  protected onTap(_x: number, _y: number): void { /* */ }
}
