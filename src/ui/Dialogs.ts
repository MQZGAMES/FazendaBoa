import Phaser from 'phaser';
import { UI } from '../config';
import { display } from '../systems/Display';
import { Modal } from './Modal';
import { txt } from './widgets';
import type { DialogReq } from '../systems/EventBus';
import type { DaySummary } from '../systems/DayCycle';
import { G } from '../state';
import { ITEMS, itemIcon } from '../data/items';
import { QUALITY_NAMES } from '../data/crops';
import { SEASON_NAMES } from '../art/palette';
import { WEEKDAYS_FULL, weekday } from '../systems/Time';

/** Caixa de diálogo com título, ícone, texto e botões. */
export class Dialog extends Modal {
  constructor(scene: Phaser.Scene) { super(scene, 32); }

  ask(req: DialogReq): void {
    this.clear();
    const W = Math.min(340, display.cssW - 24);
    const inner = W - 40;
    const t = txt(this.scene, 0, 0, req.text, 'dark').setMaxWidth(inner / UI);
    const titleH = req.title ? 30 : 0;
    const btns = req.buttons ?? [{ label: 'OK' }];
    const h = 24 + titleH + t.height + 20 + 50 + 10;
    this.frame(W, h, 'parch', 90);
    let y = this.py + 16;
    if (req.title) {
      const tt = txt(this.scene, this.px + W / 2, y, req.title, 'dark').setOrigin(0.5, 0);
      this.c.add(tt);
      if (req.icon) this.c.add(this.scene.add.image(this.px + 30, y + 8, 'atlas', req.icon).setScale(UI));
      y += titleH;
    }
    t.setPosition(this.px + 20, y);
    this.c.add(t);
    const by = this.py + h - 62;
    const bw = Math.min(140, (W - 30 - (btns.length - 1) * 10) / btns.length);
    const total = btns.length * bw + (btns.length - 1) * 10;
    btns.forEach((b, k) => {
      this.button(this.px + (W - total) / 2 + k * (bw + 10), by, bw, 48, b.label, () => { this.hide(); b.act?.(); });
    });
    this.show();
  }
}

/** Resumo ao dormir: dia seguinte, vendas, avisos. Toque para continuar. */
export class Summary extends Modal {
  private done: (() => void) | null = null;
  constructor(scene: Phaser.Scene) { super(scene, 45); this.closeOnOutside = false; }

  present(s: DaySummary, done: () => void): void {
    this.done = done;
    this.clear();
    this.dim.setAlpha(1);
    const W = Math.min(360, display.cssW - 20);
    const lines = s.shipped.slice(0, 8);
    const h = 150 + lines.length * 34 + (s.passedOut ? 50 : 0) + (s.died ? 30 : 0) + (s.crow ? 30 : 0) + s.notes.length * 30 + 60;
    this.frame(W, h, 'parch', Math.max(40, (display.cssH - h) / 2));
    const t = G.time;
    let y = this.py + 18;
    this.c.add(txt(this.scene, this.px + W / 2, y, `${WEEKDAYS_FULL[weekday()]}, ${t.day} de ${SEASON_NAMES[t.season]}`, 'dark').setOrigin(0.5, 0));
    y += 28;
    this.c.add(txt(this.scene, this.px + W / 2, y, `Ano ${t.year}`, 'dark', 1.5).setOrigin(0.5, 0));
    y += 30;
    if (s.passedOut) {
      this.c.add(txt(this.scene, this.px + 20, y, `Você desmaiou de cansaço...\nPerdeu ${s.penalty}g.`, 'dark').setMaxWidth((W - 40) / UI));
      y += 50;
    }
    if (lines.length) {
      this.c.add(txt(this.scene, this.px + 20, y, 'Vendas de ontem:', 'dark'));
      y += 30;
      for (const l of lines) {
        this.c.add(this.scene.add.image(this.px + 34, y + 10, 'atlas', itemIcon(l.id)).setScale(UI));
        if (l.ql) this.c.add(this.scene.add.image(this.px + 44, y + 18, 'atlas', `star_${l.ql}`).setScale(UI * 0.7));
        const nm = `${l.q}x ${ITEMS[l.id]?.name ?? l.id}${l.ql ? ' (' + QUALITY_NAMES[l.ql] + ')' : ''}`;
        this.c.add(txt(this.scene, this.px + 56, y + 2, nm, 'dark', 1.5));
        this.c.add(txt(this.scene, this.px + W - 20, y + 2, `${l.total}g`, 'dark', 1.5).setOrigin(1, 0));
        y += 34;
      }
      if (s.shipped.length > lines.length) { this.c.add(txt(this.scene, this.px + 56, y, `+ ${s.shipped.length - lines.length} outros`, 'dark', 1.5)); y += 24; }
      this.c.add(txt(this.scene, this.px + W - 20, y + 4, `Total: ${s.total}g`, 'dark').setOrigin(1, 0));
      y += 34;
    } else {
      this.c.add(txt(this.scene, this.px + 20, y, 'Nada foi vendido ontem.', 'dark', 1.5));
      y += 30;
    }
    for (const n of s.notes) { this.c.add(txt(this.scene, this.px + 20, y, n, 'dark', 1.5).setMaxWidth((W - 40) / 1.5)); y += 30; }
    if (s.crow) { this.c.add(txt(this.scene, this.px + 20, y, 'Um corvo comeu uma plantação! Use espantalhos.', 'dark', 1.5).setMaxWidth((W - 40) / 1.5)); y += 30; }
    if (s.died) { this.c.add(txt(this.scene, this.px + 20, y, `${s.died} plantas morreram (fora da estação).`, 'dark', 1.5).setMaxWidth((W - 40) / 1.5)); y += 30; }
    this.button(this.px + W / 2 - 80, this.py + h - 62, 160, 48, 'Continuar', () => this.finish());
    this.show();
  }

  private finish(): void {
    this.hide();
    this.dim.setAlpha(0.45);
    const d = this.done; this.done = null;
    d?.();
  }
}

/** Notificações de itens coletados (canto inferior esquerdo, acima da hotbar). */
export class Pickups {
  private rows: { c: Phaser.GameObjects.Container; id: string; q: number; t: number; text: Phaser.GameObjects.BitmapText }[] = [];
  private x = 10;
  private bottom = 600;

  constructor(private scene: Phaser.Scene) {}

  layout(x: number, bottom: number): void { this.x = x; this.bottom = bottom; }

  push(id: string, q: number): void {
    const ex = this.rows.find((r) => r.id === id);
    if (ex) { ex.q += q; ex.t = 0; ex.text.setText(`+${ex.q} ${ITEMS[id]?.name ?? id}`); ex.c.setAlpha(1); this.scene.tweens.add({ targets: ex.c, scale: 1.08, duration: 60, yoyo: true }); return; }
    const c = this.scene.add.container(this.x, 0).setDepth(20);
    const label = `+${q} ${ITEMS[id]?.name ?? id}`;
    const text = txt(this.scene, 40, 9, label, 'light', 1.5);
    const w = Math.max(80, text.width + 52);
    const bg = this.scene.add.image(0, 0, 'atlas', 'px_k').setOrigin(0, 0).setDisplaySize(w, 32).setAlpha(0.55);
    const ic = this.scene.add.image(18, 16, 'atlas', itemIcon(id)).setScale(UI * 0.9);
    c.add([bg, ic, text]);
    this.rows.unshift({ c, id, q, t: 0, text });
    if (this.rows.length > 4) { const r = this.rows.pop()!; r.c.destroy(); }
    this.reflow();
    c.x = this.x - 30; c.alpha = 0;
    this.scene.tweens.add({ targets: c, x: this.x, alpha: 1, duration: 140 });
  }

  private reflow(): void {
    this.rows.forEach((r, i) => { r.c.y = this.bottom - 36 - i * 36; });
  }

  update(dt: number): void {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      const r = this.rows[i];
      r.t += dt;
      if (r.t > 2.6) r.c.alpha = Math.max(0, 1 - (r.t - 2.6) / 0.4);
      if (r.t > 3) { r.c.destroy(); this.rows.splice(i, 1); this.reflow(); }
    }
  }
}
