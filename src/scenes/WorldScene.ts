import Phaser from 'phaser';
import { display } from '../systems/Display';
import { bus } from '../systems/EventBus';
import { input, consumeEdges } from '../systems/Input';
import { time } from '../systems/Time';
import { G } from '../state';
import { TILE, MAX_DT } from '../config';
import { Player } from '../entities/Player';
import { LocationView } from '../world/LocationView';
import { getLocation } from '../world/locations';
import { FARM_SPAWN } from '../world/genFarm';
import type { Location } from '../world/Location';
import { uiState } from '../ui/state';
import { saveGame } from '../systems/Save';

/** Cena do mundo: mapa atual, jogador, câmera e interação. */
export class WorldScene extends Phaser.Scene {
  loc!: Location;
  view!: LocationView;
  player!: Player;
  private camX = 0;
  private camY = 0;
  private lookX = 0;
  private lookY = 0;
  private corners: Phaser.GameObjects.Image[] = [];
  private target = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private colGfx: Phaser.GameObjects.Graphics | null = null;
  private exitCooldown = 0;
  private t = 0;

  constructor() { super('World'); }

  create(): void {
    this.loc = getLocation(G.player.loc);
    this.view = new LocationView(this, this.loc, G.time.season);
    if (G.flags.newGame) { G.player.x = FARM_SPAWN.x; G.player.y = FARM_SPAWN.y; G.player.dir = 0; delete G.flags.newGame; }
    if (G.player.x <= 0) { G.player.x = FARM_SPAWN.x; G.player.y = FARM_SPAWN.y; }
    this.player = new Player(this, G.player.x, G.player.y, G.player.dir);
    for (let i = 0; i < 4; i++) this.corners.push(this.add.image(0, 0, 'atlas', 'target_corner').setOrigin(0, 0).setDepth(9000).setAlpha(0.9));
    this.setupCamera(true);
    this.setupKeyboard();
    bus.on('resize', this.onResize, this);
    bus.on('day', this.onDayChanged, this);
    bus.on('debug', this.onDebugDay, this);
    this.events.once('shutdown', () => {
      bus.off('resize', this.onResize, this); bus.off('day', this.onDayChanged, this); bus.off('debug', this.onDebugDay, this);
      this.view.destroy();
    });
    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.cameras.main.fadeIn(250, 0, 0, 0);
    bus.emit('time');
  }

  private setupCamera(snap: boolean): void {
    const cam = this.cameras.main;
    cam.setSize(display.gameW, display.gameH);
    cam.setZoom(display.zoom);
    cam.setRoundPixels(true);
    const mw = this.loc.w * TILE, mh = this.loc.h * TILE;
    const vw = display.gameW / display.zoom, vh = display.gameH / display.zoom;
    // mapas menores que a tela ficam centralizados
    const bx = mw < vw ? (mw - vw) / 2 : 0, by = mh < vh ? (mh - vh) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mw, vw), Math.max(mh, vh));
    if (snap) {
      this.camX = this.player.x; this.camY = this.player.y - 12 + vh * 0.05;
      cam.centerOn(this.camX, this.camY);
    }
  }

  private onResize(): void { this.setupCamera(false); }

  private onDayChanged(): void { this.view.setSeason(G.time.season); }
  private onDebugDay(): void { time.nextDay(); bus.emit('day'); bus.emit('toast', 'Dia avançado (debug)', 'info'); }

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    const nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
    nums.forEach((k, i) => this.keys[k].on('down', () => { G.player.sel = i; bus.emit('hotbar', i); }));
    const act = (down: boolean) => {
      input.lastActive = performance.now();
      if (down && !input.actionHeld) { input.actionHeld = true; input.actionPressed = true; input.actionHoldT = 0; }
      if (!down && input.actionHeld) { input.actionHeld = false; input.actionReleased = true; }
    };
    for (const k of ['E', 'SPACE']) { this.keys[k].on('down', () => act(true)); this.keys[k].on('up', () => act(false)); }
  }

  private keyboardMove(): void {
    const k = this.keys;
    if (!k) return;
    let x = 0, y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    if (x !== 0 || y !== 0) {
      const l = Math.sqrt(x * x + y * y);
      const m = k.SHIFT.isDown ? 0.45 : 1;
      input.mx = (x / l) * m; input.my = (y / l) * m; input.mag = m;
      input.lastActive = performance.now();
      this.kbMoving = true;
    } else if (this.kbMoving) {
      input.mx = 0; input.my = 0; input.mag = 0; this.kbMoving = false;
    }
  }
  private kbMoving = false;

  update(_t: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_DT);
    this.t += dt;
    input.locked = uiState.panelOpen;
    this.keyboardMove();
    time.update(uiState.panelOpen ? 0 : dt);
    this.player.update(dt, this.loc);
    G.player.x = this.player.x; G.player.y = this.player.y; G.player.dir = this.player.dir;
    this.updateCamera(dt);
    const view = this.cameras.main.worldView;
    const wind = 0.8 + Math.sin(this.t * 0.35) * 0.5;
    this.view.update(dt, view, this.player.x, this.player.y, wind);
    this.updateTarget();
    this.checkExits(dt);
    this.drawCollision();
    input.tapPending = false;
    consumeEdges();
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const vh = cam.height / cam.zoom;
    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    const moving = this.player.moving;
    const lx = moving ? input.mx * 18 : 0, ly = moving ? input.my * 12 : 0;
    this.lookX += (lx - this.lookX) * k * 0.5;
    this.lookY += (ly - this.lookY) * k * 0.5;
    const tx = this.player.x + this.lookX;
    const ty = this.player.y - 12 + vh * 0.05 + this.lookY;
    // pequena zona morta
    const dx = tx - this.camX, dy = ty - this.camY;
    if (Math.abs(dx) > 0.5) this.camX += dx * k;
    if (Math.abs(dy) > 0.5) this.camY += dy * k;
    cam.centerOn(this.camX, this.camY);
  }

  private updateTarget(): void {
    const t = this.player.facingTile(this.target);
    const pulse = Math.sin(this.t * 6) > 0 ? 1 : 0;
    const x0 = t.x * TILE - pulse, y0 = t.y * TILE - pulse, x1 = (t.x + 1) * TILE + pulse, y1 = (t.y + 1) * TILE + pulse;
    const c = this.corners;
    c[0].setPosition(x0, y0).setFlip(false, false).setOrigin(0, 0);
    c[1].setPosition(x1, y0).setFlip(true, false).setOrigin(1, 0);
    c[2].setPosition(x0, y1).setFlip(false, true).setOrigin(0, 1);
    c[3].setPosition(x1, y1).setFlip(true, true).setOrigin(1, 1);
    const hit = this.loc.objAt(t.x, t.y);
    let icon = 'icon_hand';
    if (hit) {
      if (hit.o.k === 'house') icon = 'icon_door';
      else if (hit.o.k === 'bin') icon = 'icon_box';
    }
    uiState.actionIcon = icon;
    if (input.actionPressed) this.onAction(t.x, t.y);
  }

  private onAction(tx: number, ty: number): void {
    const hit = this.loc.objAt(tx, ty);
    if (!hit) return;
    if (hit.o.k === 'house') bus.emit('toast', 'Sua casa! O interior chega na próxima fase.', 'info');
    else if (hit.o.k === 'bin') bus.emit('toast', 'Caixa de envio: em breve você poderá vender aqui.', 'info');
    else if (hit.o.k === 'mailbox') bus.emit('toast', 'Nenhuma carta hoje.', 'info');
  }

  private checkExits(dt: number): void {
    this.exitCooldown -= dt;
    const e = this.loc.exitAt(this.player.tx, this.player.ty);
    if (!e || this.exitCooldown > 0) return;
    this.exitCooldown = 2.5;
    bus.emit('toast', `${e.label}: caminho ainda em obras!`, 'warn');
  }

  private drawCollision(): void {
    if (!uiState.showCollision) { if (this.colGfx) { this.colGfx.destroy(); this.colGfx = null; } return; }
    if (!this.colGfx) this.colGfx = this.add.graphics().setDepth(9500);
    const g = this.colGfx;
    g.clear();
    const v = this.cameras.main.worldView;
    const x0 = Math.max(0, Math.floor(v.x / TILE)), x1 = Math.min(this.loc.w - 1, Math.ceil(v.right / TILE));
    const y0 = Math.max(0, Math.floor(v.y / TILE)), y1 = Math.min(this.loc.h - 1, Math.ceil(v.bottom / TILE));
    g.fillStyle(0xff2020, 0.3);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.loc.isSolid(x, y)) g.fillRect(x * TILE, y * TILE, TILE, TILE);
    g.lineStyle(1, 0x00ffff, 1).strokeRect(this.player.x - 4.5, this.player.y - 4, 9, 4);
  }

  /** Salva ao sair do app. */
  saveNow(): void { void saveGame(); }
}
