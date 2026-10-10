import Phaser from 'phaser';
import { display } from '../systems/Display';
import { bus } from '../systems/EventBus';
import { input } from '../systems/Input';
import { perf } from '../systems/Performance';
import { settings } from '../systems/Settings';
import { haptic } from '../systems/Haptics';
import { G } from '../state';
import { UI, DEBUG_ALLOWED } from '../config';
import { Joystick } from '../ui/Joystick';
import { Hotbar } from '../ui/Hotbar';
import { MoneyDisplay, Clock, EnergyBar } from '../ui/HUD';
import { Toast } from '../ui/Toast';
import { uiState } from '../ui/state';
import { uiTex, txt } from '../ui/widgets';
import { DebugPanel } from '../ui/DebugPanel';
import { Dialog, Summary, Pickups } from '../ui/Dialogs';
import { GameMenu, SettingsPanel } from '../ui/Menus';
import { topModal, anyModal } from '../ui/Modal';
import { InventoryPanel } from '../ui/InventoryPanel';
import { ShipPanel, ChestPanel, ShopPanel, CraftPanel, ElevatorPanel } from '../ui/Panels';

interface SecBtn { id: string; icon: string; bg: Phaser.GameObjects.Image; ic: Phaser.GameObjects.Image; x: number; y: number; r: number; visible: boolean; }

/** Cena de interface sobreposta (câmera com zoom = dpr; coordenadas em px CSS). */
export class UIScene extends Phaser.Scene {
  private joy!: Joystick;
  private hotbar!: Hotbar;
  private money!: MoneyDisplay;
  private clock!: Clock;
  private energy!: EnergyBar;
  private toast!: Toast;
  private debug!: DebugPanel;
  private dialog!: Dialog;
  private summary!: Summary;
  private menu!: GameMenu;
  private settingsPanel!: SettingsPanel;
  private inventory!: InventoryPanel;
  private ship!: ShipPanel;
  private chest!: ChestPanel;
  private shop!: ShopPanel;
  private craft!: CraftPanel;
  private elevator!: ElevatorPanel;
  private pickups!: Pickups;
  private actBg!: Phaser.GameObjects.Image;
  private actIcon!: Phaser.GameObjects.Image;
  private act = { x: 0, y: 0, r: 40 };
  private actPointer = -1;
  private actIconKey = '';
  private sec: SecBtn[] = [];
  private secPointer = -1;
  private secDown: SecBtn | null = null;
  private hbPointer = -1;
  private hbStart = { x: 0, y: 0, t: 0, idx: -1, moved: false, long: false };
  private modalPointer = -1;
  private clockTaps: number[] = [];
  private joyZoneTop = 0;
  private fpsText!: Phaser.GameObjects.BitmapText;
  private exhaustC!: Phaser.GameObjects.Container;
  private exhaustT!: Phaser.GameObjects.BitmapText;
  private exhaustLast = -2;
  private hudItems: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('UI'); }

  create(): void {
    this.input.addPointer(3);
    this.joy = new Joystick(this);
    this.money = new MoneyDisplay(this);
    this.clock = new Clock(this);
    this.energy = new EnergyBar(this);
    this.hotbar = new Hotbar(this);
    this.toast = new Toast(this);
    this.debug = new DebugPanel(this);
    this.pickups = new Pickups(this);
    this.dialog = new Dialog(this);
    this.summary = new Summary(this);
    this.inventory = new InventoryPanel(this);
    this.ship = new ShipPanel(this);
    this.chest = new ChestPanel(this);
    this.shop = new ShopPanel(this);
    this.craft = new CraftPanel(this);
    this.elevator = new ElevatorPanel(this);
    this.settingsPanel = new SettingsPanel(this, () => { this.joy.applySize(); this.layout(); });
    this.menu = new GameMenu(this, () => this.settingsPanel.present(), () => this.toTitle(), () => this.reloadWorld());
    this.actBg = this.add.image(0, 0, 'atlas', 'ui_btn_round').setScale(UI).setDepth(10);
    this.actIcon = this.add.image(0, 0, 'atlas', 'icon_hand').setScale(UI * 1.5).setDepth(11);
    const defs: [string, string][] = [['inv', 'icon_bag'], ['craft', 'icon_hammer'], ['map', 'icon_map'], ['menu', 'icon_menu']];
    for (const [id, ic] of defs) {
      const bg = this.add.image(0, 0, uiTex(this, 'btn', 22, 22)).setScale(UI).setDepth(10);
      const im = this.add.image(0, 0, 'atlas', ic).setScale(UI).setDepth(11);
      this.sec.push({ id, icon: ic, bg, ic: im, x: 0, y: 0, r: 22, visible: true });
    }
    this.fpsText = txt(this, 0, 0, '', 'light', 1.5).setDepth(60).setVisible(false);
    // aviso de exaustão com cronômetro
    const exBg = this.add.image(0, 0, uiTex(this, 'wood', 64, 16)).setOrigin(0, 0).setScale(UI);
    this.exhaustT = txt(this, 64, 8, '', 'light').setOrigin(0.5, 0);
    this.exhaustC = this.add.container(0, 0, [exBg, this.exhaustT]).setDepth(15).setVisible(false);
    this.hudItems = [this.money.c, this.clock.c, this.energy.c, this.hotbar.c, this.actBg, this.actIcon, ...this.sec.flatMap((s) => [s.bg, s.ic])];

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('gameout', () => this.releaseAll());

    bus.on('resize', this.layout, this);
    bus.on('toast', (m, k) => this.toast.push(m, k), this);
    bus.on('inventory', () => this.hotbar.refresh(), this);
    bus.on('hotbar', () => this.hotbar.refresh(), this);
    bus.on('time', () => this.clock.refresh(), this);
    bus.on('day', () => this.clock.refresh(), this);
    bus.on('pickup', (id, q) => this.pickups.push(id, q), this);
    bus.on('dialog', (r) => { this.releaseAll(); this.dialog.ask(r); }, this);
    bus.on('menu', (m) => this.openMenu(m), this);
    this.events.once('shutdown', () => {
      for (const ev of ['resize', 'toast', 'inventory', 'hotbar', 'time', 'day', 'pickup', 'dialog', 'menu'] as const) bus.off(ev, undefined, this);
    });
    this.layout();
  }

  /** Mostra o resumo do dia (chamado pelo mundo ao dormir). */
  showSummary(s: import('../systems/DayCycle').DaySummary, done: () => void): void {
    this.releaseAll();
    this.summary.present(s, done);
  }

  setHudVisible(v: boolean): void { for (const o of this.hudItems) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(v); }

  /** Posiciona tudo conforme tamanho da tela e áreas seguras. */
  layout(): void {
    const cam = this.cameras.main;
    cam.setSize(display.gameW, display.gameH);
    cam.setZoom(display.dpr);
    cam.setOrigin(0, 0);
    cam.setScroll(0, 0);
    const W = display.cssW, H = display.cssH, s = display.safe;
    const pad = 8;
    const top = s.top + pad;
    this.money.c.setPosition(s.left + pad, top);
    this.clock.c.setPosition(W - s.right - pad - this.clock.w, top);
    this.hotbar.layout(W, H - s.bottom - pad, s.left, s.right);
    const left = settings.leftHanded;
    const ax = left ? s.left + pad + 44 : W - s.right - pad - 44;
    const ay = this.hotbar.top - 14 - 40;
    this.act.x = ax; this.act.y = ay;
    this.actBg.setPosition(ax, ay);
    this.actIcon.setPosition(ax, ay);
    const R = 92;
    const angs = [90, 122, 154, 186];
    let k = 0;
    for (const b of this.sec) {
      const a = (angs[k++] * Math.PI) / 180;
      b.x = Math.round(ax + (left ? -1 : 1) * Math.cos(a) * R);
      b.y = Math.round(ay - Math.sin(a) * R);
      b.bg.setPosition(b.x, b.y); b.ic.setPosition(b.x, b.y);
    }
    const ex = left ? s.left + pad : W - s.right - pad - this.energy.w;
    const ey = ay - R - 30 - this.energy.h;
    this.energy.c.setPosition(ex, Math.max(top + this.clock.h + 12, ey));
    this.toast.layout(W / 2, top + this.clock.h + 10, Math.min(W - 32, 340));
    this.joyZoneTop = H * 0.65 - 40;
    this.fpsText.setPosition(s.left + pad, top + this.money.h + 48);
    this.debug.layout(s.left + pad, top + this.money.h + 26, W);
    this.pickups.layout(s.left + pad, this.hotbar.top - 8);
    this.exhaustC.setPosition(s.left + pad, top + this.money.h + 8);
  }

  private css(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: p.x / display.dpr, y: p.y / display.dpr };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const { x, y } = this.css(p);
    input.lastActive = performance.now();
    if (this.debug.visible && this.debug.handle(x, y)) return;
    const m = topModal();
    if (m) { this.modalPointer = p.id; m.down(x, y); return; }
    // botão de ação
    const dx = x - this.act.x, dy = y - this.act.y;
    if (dx * dx + dy * dy <= (this.act.r + 10) * (this.act.r + 10)) {
      this.actPointer = p.id;
      input.actionHeld = true; input.actionPressed = true; input.actionHoldT = 0;
      this.actBg.setFrame('ui_btn_round_p'); this.actIcon.y = this.act.y + 3;
      haptic.tap();
      return;
    }
    for (const b of this.sec) {
      if (!b.visible) continue;
      if (Math.abs(x - b.x) <= b.r + 4 && Math.abs(y - b.y) <= b.r + 4) {
        this.secPointer = p.id; this.secDown = b;
        b.bg.setTexture(uiTex(this, 'btnP', 22, 22)); b.ic.y = b.y + 2;
        return;
      }
    }
    const hi = this.hotbar.hit(x, y);
    if (hi >= 0) {
      this.hbPointer = p.id;
      this.hbStart = { x, y, t: performance.now(), idx: hi, moved: false, long: false };
      this.selectSlot(hi);
      return;
    }
    const cc = this.clock.c;
    if (x >= cc.x && x <= cc.x + this.clock.w && y >= cc.y && y <= cc.y + this.clock.h) {
      const now = performance.now();
      this.clockTaps = this.clockTaps.filter((t) => now - t < 2500);
      this.clockTaps.push(now);
      if (this.clockTaps.length >= 5 && DEBUG_ALLOWED) { this.clockTaps = []; this.debug.toggle(); }
      return;
    }
    if (!this.joy.active && x < display.cssW / 2 && y >= this.joyZoneTop && y < this.hotbar.top - 2) {
      this.joy.start(p.id, x, y);
      return;
    }
    const world = this.scene.get('World');
    if (world && world.sys.isActive()) {
      const wp = world.cameras.main.getWorldPoint(p.x, p.y);
      input.tapX = wp.x; input.tapY = wp.y; input.tapPending = true;
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.isDown) return;
    const { x, y } = this.css(p);
    if (p.id === this.modalPointer) { topModal()?.move(x, y); return; }
    if (p.id === this.joy.pointerId) { this.joy.move(x, y); return; }
    if (p.id === this.hbPointer) {
      const h = this.hbStart;
      if (Math.abs(x - h.x) > 10 || Math.abs(y - h.y) > 10) h.moved = true;
      const i = this.hotbar.hit(x, y);
      if (i >= 0 && i !== G.player.sel) this.selectSlot(i);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const { x, y } = this.css(p);
    if (p.id === this.modalPointer) { this.modalPointer = -1; topModal()?.up(x, y); return; }
    if (p.id === this.joy.pointerId) { this.joy.end(); return; }
    if (p.id === this.actPointer) {
      this.actPointer = -1;
      input.actionHeld = false; input.actionReleased = true;
      this.actBg.setFrame('ui_btn_round'); this.actIcon.y = this.act.y;
      return;
    }
    if (p.id === this.secPointer && this.secDown) {
      const b = this.secDown;
      b.bg.setTexture(uiTex(this, 'btn', 22, 22)); b.ic.y = b.y;
      this.secPointer = -1; this.secDown = null;
      if (Math.abs(x - b.x) <= b.r + 8 && Math.abs(y - b.y) <= b.r + 8) this.openMenu(b.id);
      return;
    }
    if (p.id === this.hbPointer) { this.hbPointer = -1; }
  }

  releaseAll(): void {
    if (this.joy.active) this.joy.end();
    if (this.actPointer >= 0) { this.actPointer = -1; input.actionHeld = false; input.actionReleased = true; this.actBg.setFrame('ui_btn_round'); this.actIcon.y = this.act.y; }
  }

  private selectSlot(i: number): void {
    if (G.player.sel === i) return;
    G.player.sel = i;
    this.hotbar.refresh();
    this.hotbar.bounce(i);
    bus.emit('hotbar', i);
  }

  openMenu(id: string): void {
    this.releaseAll();
    if (id.startsWith('chest:')) {
      const w = this.scene.get('World') as unknown as { loc: import('../world/Location').Location; view: import('../world/LocationView').LocationView };
      const anchor = Number(id.slice(6));
      const obj = w.loc.objs.get(anchor);
      if (!obj) return;
      w.view.setChestOpen(anchor, true);
      this.chest.onClose = () => w.view.setChestOpen(anchor, false);
      this.chest.present(obj, () => { w.loc.remove(anchor); w.view.refreshObj(anchor); });
      return;
    }
    switch (id) {
      case 'inv': this.inventory.present(); break;
      case 'craft': this.craft.present(); break;
      case 'ship': this.ship.present(); break;
      case 'shop': this.shop.present(); break;
      case 'elevator': this.elevator.present((f) => {
        const w = this.scene.get('World') as unknown as { goTo: (l: string, x: number, y: number, d: 0 | 1 | 2 | 3) => void };
        if (f === 0) w.goTo('mine', 15 * 16 + 8, 6 * 16 + 13, 0); else w.goTo(`mine:${f}`, -1, -1, 0);
      }); break;
      case 'map': bus.emit('toast', `Fazenda ${G.player.farm} — o mapa chega com a vila.`, 'info'); break;
      case 'menu': this.menu.present(); break;
      case 'settings': this.settingsPanel.present(); break;
    }
  }

  private toTitle(): void {
    this.scene.stop('World');
    this.scene.start('Title', { hasSave: true });
  }

  /** Após importar um save: recarrega o mundo. */
  private reloadWorld(): void {
    const w = this.scene.get('World');
    w.scene.restart();
    this.money.update(10);
    this.hotbar.refresh();
    this.clock.refresh();
  }

  update(_t: number, delta: number): void {
    perf.frame(delta);
    const dt = Math.min(delta, 100) / 1000;
    this.money.update(dt);
    this.energy.update();
    this.pickups.update(dt);
    this.shop.update();
    this.craft.update();
    if (uiState.actionIcon !== this.actIconKey) {
      this.actIconKey = uiState.actionIcon;
      this.actIcon.setFrame(this.actIconKey);
      const big = this.actIconKey.startsWith('icon_');
      this.actIcon.setScale(UI * (big ? 1.5 : 1.75));
    }
    this.actIcon.setAlpha(uiState.actionEnabled ? 1 : 0.5);
    if (input.actionHeld) input.actionHoldT += dt;
    if (this.hbPointer >= 0 && !this.hbStart.moved && !this.hbStart.long && performance.now() - this.hbStart.t > 500) {
      this.hbStart.long = true;
      this.openMenu('inv');
    }
    perf.setIdle(!anyModal() && !input.actionHeld && !this.joy.active && performance.now() - input.lastActive > 10000);
    const ex = uiState.exhaust;
    if (ex < 0) { if (this.exhaustC.visible) this.exhaustC.setVisible(false); this.exhaustLast = -2; }
    else {
      const sec = Math.ceil(ex);
      if (sec !== this.exhaustLast) {
        this.exhaustLast = sec;
        this.exhaustT.setText(`Exausto ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
        this.exhaustC.setVisible(true);
      }
      this.exhaustC.alpha = sec <= 30 ? 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 200)) : 1;
    }
    const showFps = settings.showFps || this.debug.visible;
    this.fpsText.setVisible(showFps);
    if (showFps) this.fpsText.setText(`${Math.round(perf.fps)} fps`);
    if (this.debug.visible) this.debug.update();
  }
}
