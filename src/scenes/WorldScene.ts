import Phaser from 'phaser';
import { display } from '../systems/Display';
import { bus } from '../systems/EventBus';
import { input, consumeEdges } from '../systems/Input';
import { time, dayFrac } from '../systems/Time';
import { G, DAY_START } from '../state';
import { TILE, MAX_DT } from '../config';
import { Player } from '../entities/Player';
import { LocationView } from '../world/LocationView';
import { getLocation, locationExists } from '../world/locations';

/** Portas que abrem ao empurrar. */
const OBJ_DOOR_ACTS = new Set(['door', 'shop', 'smith', 'manor']);
import { FARM_SPAWN } from '../world/genFarm';
import { HOUSE_WAKE } from '../world/genHouse';
import type { Location } from '../world/Location';
import { uiState } from '../ui/state';
import { saveGame } from '../systems/Save';
import { Particles } from '../systems/Particles';
import { Drops } from '../world/Drops';
import { Actions, type WorldHost } from '../world/Actions';
import { endDay } from '../systems/DayCycle';
import type { UIScene } from './UIScene';
import { perf } from '../systems/Performance';
import { Lighting } from '../systems/Lighting';

/** Cores de "color grading" por hora (multiplicativo). */
const GRADE: [number, number, number, number][] = [
  // [hora, r, g, b]
  [6, 1.0, 0.82, 0.86], [7.5, 1, 1, 1], [16.5, 1, 1, 1], [18, 1.0, 0.86, 0.66], [19.5, 0.62, 0.6, 0.82], [21, 0.36, 0.42, 0.72], [26, 0.3, 0.36, 0.66],
];

/** Cena do mundo: mapa atual, jogador, câmera, ações e ciclo do dia. */
export class WorldScene extends Phaser.Scene implements WorldHost {
  loc!: Location;
  view!: LocationView;
  player!: Player;
  parts!: Particles;
  drops!: Drops;
  private actions!: Actions;
  private camX = 0;
  private camY = 0;
  private lookX = 0;
  private lookY = 0;
  private corners: Phaser.GameObjects.Image[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private colGfx: Phaser.GameObjects.Graphics | null = null;
  private exitCooldown = 0;
  private t = 0;
  private transitioning = false;
  private grade!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Image;
  private rain: Phaser.GameObjects.TileSprite | null = null;
  private lightningT = 4;
  private kbMoving = false;
  private doorPush = 0;
  private gradeColor = 0xffffff;
  private lighting!: Lighting;

  constructor() { super('World'); }

  get sc(): Phaser.Scene { return this; }

  create(): void {
    this.transitioning = false;
    this.loc = getLocation(G.player.loc);
    this.view = new LocationView(this, this.loc, G.time.season);
    if (G.flags.newGame) { G.player.loc = 'farm'; G.player.x = FARM_SPAWN.x; G.player.y = FARM_SPAWN.y; G.player.dir = 0; delete G.flags.newGame; this.loc = getLocation('farm'); }
    const sp = this.loc.extra.spawn as [number, number] | undefined;
    if (sp && G.player.x < 0) { G.player.x = sp[0]; G.player.y = sp[1]; }
    if (sp && this.loc.isSolid(Math.floor(G.player.x / TILE), Math.floor((G.player.y - 2) / TILE))) { G.player.x = sp[0]; G.player.y = sp[1]; }
    if (G.player.x <= 0 || G.player.x >= this.loc.w * TILE || G.player.y >= this.loc.h * TILE) {
      if (this.loc.id === 'house') { G.player.x = HOUSE_WAKE.x; G.player.y = HOUSE_WAKE.y; } else { G.player.x = FARM_SPAWN.x; G.player.y = FARM_SPAWN.y; }
    }
    this.player = new Player(this, G.player.x, G.player.y, G.player.dir);
    this.player.carrying = !!G.flags.carry;
    this.lighting = new Lighting(this);
    const floor = this.loc.extra.floor as number | undefined;
    this.lighting.darkness = floor === undefined ? 0 : floor === 0 ? 0.5 : Math.min(0.93, 0.8 + floor * 0.003);
    if (floor) this.time.delayedCall(350, () => bus.emit('toast', `Mina — andar ${floor}`, 'info'));
    this.parts = new Particles(this);
    this.drops = new Drops(this);
    this.drops.restore(this.loc);
    this.actions = new Actions(this);
    for (let i = 0; i < 4; i++) this.corners.push(this.add.image(0, 0, 'atlas', 'target_corner').setOrigin(0, 0).setDepth(9000).setAlpha(0.9));
    this.grade = this.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDepth(9800).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    this.flash = this.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDepth(9850).setAlpha(0);
    this.setupWeather();
    this.setupCamera(true);
    this.setupKeyboard();
    time.onLate = () => this.passOut();
    bus.on('resize', this.onResize, this);
    bus.on('day', this.onDayChanged, this);
    bus.on('debug', this.onDebugDay, this);
    this.events.once('shutdown', () => {
      bus.off('resize', this.onResize, this); bus.off('day', this.onDayChanged, this); bus.off('debug', this.onDebugDay, this);
      this.drops.persist(this.loc);
      this.view.destroy();
      this.lighting.destroy();
      this.corners = [];
      this.rain = null;
    });
    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    else (this.scene.get('UI') as UIScene).setHudVisible(true);
    this.cameras.main.fadeIn(280, 0, 0, 0);
    bus.emit('time');
    bus.emit('inventory');
    if (G.flags.justWoke) {
      delete G.flags.justWoke;
      const days = G.flags.daysPlayed ?? 0;
      if (days > 0 && days - (G.flags.lastExport ?? 0) >= 7) {
        G.flags.lastExport = days;
        this.time.delayedCall(1200, () => bus.emit('toast', 'Dica: exporte seu save de vez em quando (Menu → Exportar save).', 'info'));
      }
      const w = G.weather.today;
      if (w === 'rain' || w === 'storm') this.time.delayedCall(700, () => bus.emit('toast', 'Está chovendo: as plantações já foram regadas!', 'info'));
    }
  }

  private setupWeather(): void {
    const w = G.weather.today;
    if (!this.loc.outdoor || (w !== 'rain' && w !== 'storm' && w !== 'snow')) return;
    this.rain = this.add.tileSprite(0, 0, 64, 64, 'atlas', w === 'snow' ? 'snow' : 'rain').setOrigin(0, 0).setDepth(9700).setAlpha(w === 'snow' ? 0.9 : 0.75);
  }

  private setupCamera(snap: boolean): void {
    const cam = this.cameras.main;
    cam.setSize(display.gameW, display.gameH);
    cam.setZoom(display.zoom);
    cam.setRoundPixels(true);
    const mw = this.loc.w * TILE, mh = this.loc.h * TILE;
    const vw = display.gameW / display.zoom, vh = display.gameH / display.zoom;
    const bx = mw < vw ? (mw - vw) / 2 : 0, by = mh < vh ? (mh - vh) / 2 - vh * 0.1 : 0;
    cam.setBounds(bx, by, Math.max(mw, vw), Math.max(mh, vh) + (mh < vh ? vh * 0.1 : 0));
    cam.setBackgroundColor(this.loc.outdoor ? 0x000000 : 0x120a08);
    if (snap) {
      this.camX = this.player.x; this.camY = this.player.y - 12 + vh * 0.05;
      cam.centerOn(this.camX, this.camY);
    }
  }

  private onResize(): void { this.setupCamera(false); }

  private onDayChanged(): void {
    this.view.setSeason(G.time.season);
    this.view.rebuildAll();
  }
  private onDebugDay(): void { this.sleep(false); }

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE,ESC,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    const nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
    nums.forEach((k, i) => this.keys[k].on('down', () => { G.player.sel = i; bus.emit('hotbar', i); }));
    const act = (down: boolean) => {
      input.lastActive = performance.now();
      if (down && !input.actionHeld) { input.actionHeld = true; input.actionPressed = true; input.actionHoldT = 0; }
      if (!down && input.actionHeld) { input.actionHeld = false; input.actionReleased = true; }
    };
    for (const k of ['E', 'SPACE']) { this.keys[k].on('down', () => act(true)); this.keys[k].on('up', () => act(false)); }
    this.keys.ESC.on('down', () => bus.emit('menu', 'menu'));
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

  update(_t: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_DT);
    this.t += dt;
    input.locked = uiState.panelOpen || this.transitioning;
    this.keyboardMove();
    if (!uiState.panelOpen && !this.transitioning) {
      time.update(dt);
      // exaustão: contagem regressiva (tempo real) até dormir à força
      if (G.flags.exhaust !== undefined) {
        G.flags.exhaust -= dt;
        if (G.player.energy > 0) delete G.flags.exhaust;
        else if (G.flags.exhaust <= 0) {
          delete G.flags.exhaust;
          bus.emit('toast', 'Você desmaiou de cansaço...', 'warn');
          this.sleep(true, false);
        }
      }
    }
    uiState.exhaust = G.flags.exhaust ?? -1;
    const p = this.player;
    p.tired = G.player.energy < G.player.maxEnergy * 0.15;
    p.update(dt, this.loc);
    if (!this.transitioning) { G.player.x = p.x; G.player.y = p.y; G.player.dir = p.dir; }
    this.updateCamera(dt);
    const view = this.cameras.main.worldView;
    const wind = 0.8 + Math.sin(this.t * 0.35) * 0.5 + (G.weather.today === 'storm' ? 1.2 : 0);
    this.view.update(dt, view, p.x, p.y, wind);
    this.parts.update(dt);
    this.drops.update(dt, p.x, p.y);
    if (!input.locked) this.updateActions();
    this.checkExits(dt);
    this.updateAtmosphere(dt, view);
    if (this.lighting.darkness > 0) {
      this.lighting.begin();
      this.lighting.add(p.x, p.y - 10, this.loc.id === 'mine' ? 90 : 78, 0xfff0c0, 0);
      this.view.collectLights(this.lighting);
      this.lighting.render(view, dt);
    }
    this.drawCollision();
    input.tapPending = false;
    consumeEdges();
  }

  private updateActions(): void {
    const a = this.actions.evaluate();
    uiState.actionIcon = a.icon;
    uiState.actionEnabled = a.kind !== 'none';
    // contorno do tile-alvo
    const show = a.kind !== 'none';
    const pulse = Math.sin(this.t * 6) > 0 ? 1 : 0;
    const x0 = a.tx * TILE - pulse, y0 = a.ty * TILE - pulse, x1 = (a.tx + 1) * TILE + pulse, y1 = (a.ty + 1) * TILE + pulse;
    const c = this.corners;
    for (const k of c) k.setVisible(show);
    if (show) {
      c[0].setPosition(x0, y0).setFlip(false, false).setOrigin(0, 0);
      c[1].setPosition(x1, y0).setFlip(true, false).setOrigin(1, 0);
      c[2].setPosition(x0, y1).setFlip(false, true).setOrigin(0, 1);
      c[3].setPosition(x1, y1).setFlip(true, true).setOrigin(1, 1);
    }
    if (input.tapPending && this.actions.tapAt(input.tapX, input.tapY)) return;
    if (input.actionPressed) this.actions.run(false);
    else if (input.actionHeld && !this.player.busy && input.actionHoldT > 0.12) this.actions.run(true);
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
    const dx = tx - this.camX, dy = ty - this.camY;
    if (Math.abs(dx) > 0.5) this.camX += dx * k;
    if (Math.abs(dy) > 0.5) this.camY += dy * k;
    cam.centerOn(this.camX, this.camY);
  }

  /** Cor por horário, chuva e relâmpagos. */
  private updateAtmosphere(dt: number, v: Phaser.Geom.Rectangle): void {
    const hour = G.time.min / 60;
    let r = 1, g = 1, b = 1;
    for (let i = 0; i < GRADE.length - 1; i++) {
      const [h0, r0, g0, b0] = GRADE[i], [h1, r1, g1, b1] = GRADE[i + 1];
      if (hour >= h0 && hour <= h1) { const t = (hour - h0) / (h1 - h0); r = r0 + (r1 - r0) * t; g = g0 + (g1 - g0) * t; b = b0 + (b1 - b0) * t; break; }
      if (hour > GRADE[GRADE.length - 1][0]) { r = GRADE[GRADE.length - 1][1]; g = GRADE[GRADE.length - 1][2]; b = GRADE[GRADE.length - 1][3]; }
    }
    if (!this.loc.outdoor) { r = 0.75 + r * 0.25; g = 0.72 + g * 0.28; b = 0.68 + b * 0.32; }
    const w = G.weather.today;
    if (this.loc.outdoor && (w === 'rain' || w === 'storm')) { r *= 0.72; g *= 0.78; b *= 0.88; }
    else if (this.loc.outdoor && w === 'cloud') { r *= 0.9; g *= 0.92; b *= 0.96; }
    const col = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    const needs = col !== 0xffffff;
    this.grade.setVisible(needs);
    if (needs) {
      this.grade.setPosition(v.x - 2, v.y - 2).setDisplaySize(v.width + 4, v.height + 4);
      if (col !== this.gradeColor) { this.gradeColor = col; this.grade.setTint(col); }
    }
    if (this.rain) {
      this.rain.setPosition(v.x - 2, v.y - 2).setSize(v.width + 4, v.height + 4);
      if (w === 'snow') this.rain.setTilePosition(v.x - this.t * 6 + Math.sin(this.t) * 6, v.y - this.t * 18);
      else this.rain.setTilePosition(v.x + this.t * 60, v.y - this.t * 260);
      this.rain.setVisible(perf.level > 0 || w !== 'snow');
    }
    if (w === 'storm' && this.loc.outdoor) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 6 + Math.random() * 10;
        this.flash.setPosition(v.x, v.y).setDisplaySize(v.width, v.height).setAlpha(0.7);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
      }
    }
    void dayFrac;
  }

  private checkExits(dt: number): void {
    this.exitCooldown -= dt;
    if (this.transitioning) return;
    const p = this.player;
    // empurrar uma porta (andando em direção a ela) também entra
    if (p.dir === 1 && input.my < -0.3 && !p.busy) {
      const a = this.actions.evaluate();
      if (a.kind === 'interact' && OBJ_DOOR_ACTS.has(a.what)) {
        this.doorPush += dt;
        if (this.doorPush > 0.25) { this.doorPush = 0; this.actions.run(false); return; }
      } else this.doorPush = 0;
    } else this.doorPush = 0;
    const e = this.loc.exitAt(p.tx, p.ty);
    if (!e || this.exitCooldown > 0) return;
    if (locationExists(e.to)) { this.goTo(e.to, e.tx, e.ty, p.dir); return; }
    this.exitCooldown = 2.5;
    bus.emit('toast', `${e.label}: caminho ainda em obras!`, 'warn');
  }

  /** Troca de mapa com fade curto. */
  goTo(loc: string, x: number, y: number, dir: 0 | 1 | 2 | 3): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      G.player.loc = loc; G.player.x = x; G.player.y = y; G.player.dir = dir;
      this.scene.restart();
    });
  }

  shake(ms: number, px: number): void {
    this.cameras.main.shake(ms, px / (this.cameras.main.width / this.cameras.main.zoom));
  }

  sleepPrompt(): void {
    const late = G.time.min >= 24 * 60;
    bus.emit('dialog', {
      title: 'Cama', icon: 'icon_bed', text: late ? 'Já é tarde! Dormir agora?' : 'Ir dormir e terminar o dia?',
      buttons: [{ label: 'Dormir', act: () => this.sleep(false) }, { label: 'Ainda não' }],
    });
  }

  private passOut(): void {
    bus.emit('toast', 'Você está exausto... e desmaiou!', 'warn');
    this.sleep(true);
  }

  /** Dorme: escurece, resumo de vendas, salva e avança o dia. */
  sleep(passOut: boolean, penalize = true): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const ui = this.scene.get('UI') as UIScene;
    ui.releaseAll();
    this.cameras.main.fadeOut(passOut ? 900 : 500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      ui.setHudVisible(false);
      this.drops.persist(this.loc);
      const sum = endDay(passOut, penalize);
      G.player.loc = 'house'; G.player.x = HOUSE_WAKE.x; G.player.y = HOUSE_WAKE.y; G.player.dir = 0;
      G.time.min = DAY_START;
      G.flags.justWoke = 1;
      void saveGame();
      ui.showSummary(sum, () => this.scene.restart());
    });
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
}
