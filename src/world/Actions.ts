import Phaser from 'phaser';
import { G } from '../state';
import { TILE } from '../config';
import { OBJ, HITS_TREE, HITS_BOULDER, HITS_STUMP, toolEnergy, type ToolKind, type WObj } from '../data/objects';
import { ITEMS, TREE_SEEDS, TREE_SEED_OF, itemIcon } from '../data/items';
import { CROP_BY_SEED, CROP_BY_ID } from '../data/crops';
import { T, type Location } from './Location';
import type { LocationView } from './LocationView';
import type { Player } from '../entities/Player';
import type { Particles } from '../systems/Particles';
import type { Drops } from './Drops';
import { canTill, till, water, plant, harvest, cropReady, isTilled, isWet, seedFits, fertilizer } from '../systems/Farming';
import { SHOP_OPEN, SHOP_CLOSE, SHOP_CLOSED_WEEKDAY } from '../data/shops';
import { MINE_ROCKS, PICK_POWER, LADDER_BASE, LADDER_STEP, MINE_FLOORS, ROCKPILE_STONE, SMELT } from '../data/mine';
import { SPRINKLER_AREA, SPRINKLER_ITEMS, SCARECROW_RADIUS, WHEELBARROW_CAP } from '../data/objects';
import { machineReady, smeltableOre, loadFurnace, minutesLeft } from '../systems/Machines';
import { addItem } from '../systems/Inventory';
import { selected, slotOf, takeFromSlot } from '../systems/Inventory';
import { settings } from '../systems/Settings';
import { bus } from '../systems/EventBus';
import { haptic } from '../systems/Haptics';
import { addXp } from '../systems/Skills';
import { WEATHER_NAMES } from '../systems/DayCycle';
import { uiState } from '../ui/state';

export interface WorldHost {
  loc: Location;
  view: LocationView;
  player: Player;
  parts: Particles;
  drops: Drops;
  sc: Phaser.Scene;
  shake(ms: number, px: number): void;
  goTo(loc: string, x: number, y: number, dir: 0 | 1 | 2 | 3): void;
  sleepPrompt(): void;
}

type Kind = 'none' | 'harvest' | 'interact' | 'till' | 'water' | 'refill' | 'plant' | 'hit' | 'clear' | 'eat' | 'plantTree' | 'place' | 'fertilize' | 'collect' | 'load' | 'lift' | 'drop' | 'stack' | 'path' | 'unpath' | 'empty';
const PRIO: Record<Kind, number> = { none: 0, eat: 0.5, till: 1, water: 1, refill: 1, plant: 1.2, hit: 1, clear: 1, plantTree: 1, place: 1, fertilize: 1.3, interact: 2, load: 2, lift: 2, drop: 2, stack: 2, collect: 3, path: 1, unpath: 1, empty: 2, harvest: 5 };

interface Act { kind: Kind; tx: number; ty: number; icon: string; tool: ToolKind | null; slot: number; what: string; prio: number; }
const mk = (): Act => ({ kind: 'none', tx: 0, ty: 0, icon: 'icon_hand', tool: null, slot: -1, what: '', prio: 0 });

export const CAN_CAP = [40, 55, 70, 85];
/** Segundos (tempo real) até dormir à força quando a energia zera. */
export const EXHAUST_SECONDS = 300;

export function startExhaustion(): void {
  if (G.flags.exhaust === undefined) {
    G.flags.exhaust = EXHAUST_SECONDS;
    bus.emit('toast', 'Você está exausto! Vai desmaiar em 5 minutos — coma algo ou vá dormir.', 'warn');
  }
}

/** Ação contextual: escolhe o alvo (auto-mira raio 1) e executa com a ferramenta certa. */
export class Actions {
  readonly cur: Act = mk();
  private lastTx = -999;
  private lastTy = -999;
  private lastKind: Kind = 'none';
  private facing = { x: 0, y: 0 };

  constructor(private h: WorldHost) {}

  /** Avalia a ação no tile à frente. Prioridade: colher > coletar > máquina > interagir > ferramenta. */
  evaluate(): Act {
    const p = this.h.player;
    const f = p.facingTile(this.facing);
    const best = this.cur;
    // alvo é sempre o tile à frente do personagem (na direção em que olha)
    this.evalTile(f.x, f.y, true, best);
    if (best.kind === 'none') {
      const s = selected();
      const d = s ? ITEMS[s.id] : null;
      if (d?.edible) { best.kind = 'eat'; best.icon = d.icon; best.prio = PRIO.eat; best.slot = G.player.sel; }
    }
    return best;
  }

  private set(a: Act, kind: Kind, x: number, y: number, icon: string, tool: ToolKind | null, slot = -1, what = ''): void {
    a.kind = kind; a.tx = x; a.ty = y; a.icon = icon; a.tool = tool; a.slot = slot; a.what = what; a.prio = PRIO[kind];
  }

  /** A ferramenta pode ser usada? (troca automática ou selecionada). Retorna o slot ou -1. */
  private toolSlot(t: ToolKind): number {
    const s = selected();
    if (s && ITEMS[s.id]?.tool === t) return G.player.sel;
    if (!settings.autoTool) return -1;
    return slotOf(t);
  }

  private toolIcon(t: ToolKind): string { return `tool_${t}_${G.player.tools[t] ?? 0}`; }

  private evalTile(x: number, y: number, facing: boolean, a: Act): void {
    a.kind = 'none'; a.prio = 0; a.icon = 'icon_hand'; a.tool = null; a.slot = -1;
    const L = this.h.loc;
    if (!L.inb(x, y)) return;
    const i = L.idx(x, y);
    if (G.flags.carry) {
      if (!facing) return;
      const h2 = L.objAt(x, y);
      if (h2 && (h2.o.k === 'bigrock' || h2.o.k === 'rockpile' || (h2.o.k === 'wheelbarrow' && (h2.o.g ?? 0) < WHEELBARROW_CAP))) { this.set(a, 'stack', x, y, h2.o.k === 'wheelbarrow' ? 'wheelbarrow_full' : 'rockpile_1', null); return; }
      const tt = L.terrain[i];
      if (!h2 && !L.crops.has(i) && (tt === T.Grass || tt === T.Dirt || tt === T.Cave || tt === T.Stone || tt === T.Floor)) this.set(a, 'drop', x, y, 'bigrock', null);
      return;
    }
    const crop = L.crops.get(i);
    if (crop && cropReady(crop)) { this.set(a, 'harvest', x, y, 'icon_hand', null); return; }
    const hit = L.objAt(x, y);
    if (hit) {
      const o = hit.o;
      const odef = OBJ[o.k];
      if (odef.door) {
        const ax = hit.i % L.w, ay = Math.floor(hit.i / L.w);
        if (y - ay === odef.door.dy && odef.door.dx.includes(x - ax)) this.set(a, 'interact', x, y, 'icon_door', null, -1, odef.door.act);
        return;
      }
      switch (o.k) {
        case 'bin': this.set(a, 'interact', x, y, 'icon_box', null, -1, 'bin'); return;
        case 'mailbox': this.set(a, 'interact', x, y, 'icon_talk', null, -1, 'mail'); return;
        case 'bed': this.set(a, 'interact', x, y, 'icon_bed', null, -1, 'bed'); return;
        case 'tv': this.set(a, 'interact', x, y, 'icon_talk', null, -1, 'tv'); return;
        case 'sign': this.set(a, 'interact', x, y, 'icon_talk', null, -1, 'sign'); return;
        case 'chest': this.set(a, 'interact', x, y, 'icon_box', null, -1, 'chest:' + hit.i); return;
        case 'ladder': this.set(a, 'interact', x, y, 'icon_door', null, -1, 'down'); return;
        case 'ladderup': this.set(a, 'interact', x, y, 'icon_door', null, -1, 'up'); return;
        case 'elevator': this.set(a, 'interact', x, y, 'icon_gear', null, -1, 'elevator'); return;
        case 'minecart': this.set(a, 'interact', x, y, 'icon_talk', null, -1, 'minecart'); return;
        case 'furnace': {
          if (machineReady(o)) { this.set(a, 'collect', x, y, itemIcon(o.m!.out), null, -1, String(hit.i)); return; }
          if (!o.m) {
            const ore = smeltableOre(selected()?.id);
            if (ore) { this.set(a, 'load', x, y, 'icon_gear', null, -1, String(hit.i) + ':' + ore); return; }
          }
          if (!facing) return;
          const sl = selected();
          if (!o.m && sl && ITEMS[sl.id]?.cat === 'tool') { this.set(a, 'hit', x, y, this.toolIcon(ITEMS[sl.id].tool!), ITEMS[sl.id].tool!, G.player.sel); return; }
          this.set(a, 'interact', x, y, 'icon_gear', null, -1, 'furnace:' + hit.i); return;
        }
        case 'wheelbarrow':
          if ((o.g ?? 0) > 0) { this.set(a, 'empty', x, y, 'item_stone', null, -1, String(hit.i)); return; }
          break;
        case 'bigrock': {
          if (!facing) return;
          const sl = selected();
          if (sl && ITEMS[sl.id]?.tool === 'pickaxe') { this.set(a, 'hit', x, y, this.toolIcon('pickaxe'), 'pickaxe', G.player.sel); return; }
          this.set(a, 'lift', x, y, 'icon_lift', null, -1, String(hit.i)); return;
        }
        case 'torch': {
          if (!facing) return;
          const sl = selected();
          const tool = sl && ITEMS[sl.id]?.tool ? ITEMS[sl.id].tool! : 'axe';
          const slot = sl && ITEMS[sl.id]?.tool ? G.player.sel : this.toolSlot('axe');
          if (slot >= 0) this.set(a, 'hit', x, y, this.toolIcon(tool), tool, slot);
          return;
        }
      }
      if (!facing) return;
      const def = OBJ[o.k];
      let tool: ToolKind | null = null;
      if (o.k === 'weed' || o.k === 'tallgrass' || o.k === 'flowers') tool = 'scythe';
      else if (def.tool === 'axe' || def.tool === 'pickaxe' || def.tool === 'scythe') tool = def.tool;
      else if (def.item) { const sl = selected(); tool = sl && ITEMS[sl.id]?.tool ? ITEMS[sl.id].tool! : 'axe'; }
      if (!tool) return;
      let slot = this.toolSlot(tool);
      // mato: qualquer ferramenta selecionada serve
      if (slot < 0 && o.k === 'weed') { const s = selected(); if (s && ITEMS[s.id]?.cat === 'tool') { slot = G.player.sel; tool = ITEMS[s.id].tool!; } }
      if (slot < 0) return;
      this.set(a, 'hit', x, y, this.toolIcon(tool), tool, slot);
      return;
    }
    if (!facing) return;
    const s = selected();
    const sd = s ? ITEMS[s.id] : null;
    if (crop) {
      if (crop.dead) { const sl = this.toolSlot('scythe'); if (sl >= 0) this.set(a, 'clear', x, y, this.toolIcon('scythe'), 'scythe', sl); return; }
      if (!isWet(L, i)) { const sl = this.toolSlot('can'); if (sl >= 0) this.set(a, 'water', x, y, this.toolIcon('can'), 'can', sl); }
      return;
    }
    if (isTilled(L, i)) {
      if (s?.id === 'fertilizer' && fertilizer(L, i) === 0) { this.set(a, 'fertilize', x, y, sd!.icon, null, G.player.sel); return; }
      // plantar: semente selecionada ou (troca automática) a primeira semente que cresce agora
      if (sd?.cat === 'seed' && CROP_BY_SEED[s!.id]) { this.set(a, 'plant', x, y, sd.icon, null, G.player.sel); return; }
      if (settings.autoTool && !(sd?.cat === 'tool' && sd.tool === 'can' && !isWet(L, i))) {
        const slot = G.player.inv.findIndex((st) => !!st && !!CROP_BY_SEED[st.id] && seedFits(L, CROP_BY_SEED[st.id]));
        if (slot >= 0) { this.set(a, 'plant', x, y, ITEMS[G.player.inv[slot]!.id].icon, null, slot); return; }
      }
      if (!isWet(L, i)) { const sl = this.toolSlot('can'); if (sl >= 0) this.set(a, 'water', x, y, this.toolIcon('can'), 'can', sl); }
      return;
    }
    const t = L.terrain[i];
    if (t === T.Water) {
      const sl = this.toolSlot('can');
      const cap = CAN_CAP[G.player.tools.can] ?? 40;
      if (sl >= 0 && (G.player.water < cap || (sd?.tool === 'can'))) this.set(a, 'refill', x, y, this.toolIcon('can'), 'can', sl);
      return;
    }
    if (s?.id === 'path' && (t === T.Grass || t === T.Dirt) && !L.occ[i] && !L.crops.has(i) && !isTilled(L, i) && L.outdoor) {
      this.set(a, 'path', x, y, 'item_path', null, G.player.sel); return;
    }
    if (t === T.Stone && L.id === 'farm' && sd?.tool === 'pickaxe' && !L.occ[i]) { this.set(a, 'unpath', x, y, this.toolIcon('pickaxe'), 'pickaxe', G.player.sel); return; }
    if (sd?.place && (t === T.Grass || t === T.Dirt || t === T.Floor || t === T.Stone || t === T.Cave) && !L.occ[i] && !L.crops.has(i) && !(sd.place === 'sprinkler' ? false : isTilled(L, i))) {
      this.set(a, 'place', x, y, sd.icon, null, G.player.sel); return;
    }
    if (sd && TREE_SEEDS[s!.id] !== undefined && (t === T.Grass || t === T.Dirt) && L.outdoor && !L.occ[i]) {
      this.set(a, 'plantTree', x, y, sd.icon, null, G.player.sel); return;
    }
    if (canTill(L, x, y)) { const sl = this.toolSlot('hoe'); if (sl >= 0) this.set(a, 'till', x, y, this.toolIcon('hoe'), 'hoe', sl); }
  }

  /** Executa a ação atual. `repeat` = segurando o botão. */
  run(repeat: boolean): void {
    const a = this.cur;
    const p = this.h.player;
    if (p.busy || a.kind === 'none') return;
    if (repeat) {
      const sameTile = a.tx === this.lastTx && a.ty === this.lastTy;
      if (sameTile && !(a.kind === 'hit' && this.lastKind === 'hit')) return;
      if (a.kind === 'interact' || a.kind === 'eat') return;
    }
    this.lastTx = a.tx; this.lastTy = a.ty; this.lastKind = a.kind;
    this.faceTile(a.tx, a.ty);
    if (a.tool && a.slot >= 0 && G.player.sel !== a.slot) { G.player.sel = a.slot; bus.emit('hotbar', a.slot); }
    switch (a.kind) {
      case 'harvest': return this.doHarvest(a.tx, a.ty);
      case 'interact': return this.doInteract(a.what, a.tx, a.ty);
      case 'plant': return this.doPlant(a.tx, a.ty, a.slot);
      case 'plantTree': return this.doPlantTree(a.tx, a.ty, a.slot);
      case 'eat': return this.doEat(a.slot);
      case 'collect': return this.doCollect(Number(a.what));
      case 'load': { const [anc, ore] = a.what.split(':'); return this.doLoad(Number(anc), ore); }
      case 'lift': return this.doLift(Number(a.what));
      case 'drop': return this.doDrop(a.tx, a.ty);
      case 'stack': return this.doStack(a.tx, a.ty);
      case 'path': return this.doPath(a.tx, a.ty, a.slot);
      case 'empty': return this.doEmpty(Number(a.what));
      case 'place': return this.doPlace(a.tx, a.ty, a.slot);
      case 'fertilize': return this.doFertilize(a.tx, a.ty, a.slot);
      default: return this.doTool(a);
    }
  }

  private faceTile(x: number, y: number): void {
    const p = this.h.player;
    const dx = x - p.tx, dy = y - p.ty;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) > Math.abs(dy)) p.face(dx < 0 ? 2 : 3); else p.face(dy < 0 ? 1 : 0);
  }

  /** Gasta energia. Exausto (0) ainda age, mas inicia a contagem para dormir à força. */
  private spend(t: ToolKind): boolean {
    const pl = G.player;
    if (pl.energy <= 0) { startExhaustion(); return true; }
    pl.energy = Math.max(0, pl.energy - toolEnergy(pl.tools[t] ?? 0));
    if (pl.energy <= 0) startExhaustion();
    return true;
  }

  private center(x: number, y: number): [number, number] { return [x * TILE + 8, y * TILE + 8]; }

  private doTool(a: Act): void {
    const t = a.tool!;
    const L = this.h.loc, V = this.h.view, P = this.h.parts;
    const tier = G.player.tools[t] ?? 0;
    const x = a.tx, y = a.ty;
    const [cx, cy] = this.center(x, y);
    if (t === 'can') {
      if (a.kind === 'refill') {
        this.h.player.startAct('water', this.toolIcon('can'), () => {
          G.player.water = CAN_CAP[tier] ?? 40;
          P.burst('drop', cx, cy, 10, { up: 70, speed: 25, life: 0.5 });
          bus.emit('hotbar', G.player.sel);
          bus.emit('toast', 'Regador cheio!', 'info');
        });
        return;
      }
      if (G.player.water <= 0) { bus.emit('toast', 'O regador está vazio. Encha na água.', 'warn'); return; }
      if (!this.spend('can')) return;
      this.h.player.startAct('water', this.toolIcon('can'), () => {
        if (water(L, x, y)) V.refreshSoil(x, y);
        G.player.water--;
        P.burst('drop', cx, cy - 2, 8, { up: 30, speed: 18, life: 0.45 });
        bus.emit('hotbar', G.player.sel);
      });
      return;
    }
    if (!this.spend(t)) return;
    this.h.player.startAct('swing', this.toolIcon(t), () => {
      if (a.kind === 'till') {
        if (canTill(L, x, y)) { till(L, x, y); V.refreshSoil(x, y); }
        P.burst('chip_dirt', cx, cy + 4, 7, { up: 45, speed: 26, life: 0.5 });
        return;
      }
      if (a.kind === 'unpath') {
        if (L.terrain[L.idx(x, y)] === T.Stone) {
          L.terrain[L.idx(x, y)] = T.Grass; V.refreshTerrain(x, y);
          this.h.drops.spawn('stone', 1, 0, cx, cy);
          P.burst('chip_stone', cx, cy, 6, { up: 40 });
        }
        return;
      }
      if (a.kind === 'clear') {
        const i = L.idx(x, y);
        L.crops.delete(i); V.refreshCrop(i);
        P.burst('chip_leaf', cx, cy, 6, { up: 40 });
        return;
      }
      this.hitObject(x, y, t, tier);
    });
  }

  private hitObject(x: number, y: number, t: ToolKind, tier: number): void {
    const L = this.h.loc, V = this.h.view, P = this.h.parts, D = this.h.drops;
    const hit = L.objAt(x, y);
    if (!hit) return;
    const { i: anchor, o } = hit;
    const ax = anchor % L.w, ay = Math.floor(anchor / L.w);
    const [w, h] = OBJ[o.k].size;
    const cx = (ax + w / 2) * TILE, cy = (ay + h) * TILE - 6;
    const remove = () => { L.remove(anchor); V.refreshObj(anchor); };
    switch (o.k) {
      case 'weed':
        remove(); P.burst('chip_leaf', cx, cy, 8, { up: 50 });
        if (Math.random() < 0.5) D.spawn('fiber', 1, 0, cx, cy);
        if (Math.random() < 0.03) D.spawn(Math.random() < 0.5 ? 'seed_parsnip' : 'seed_potato', 1, 0, cx, cy);
        addXp('foraging', 1);
        return;
      case 'tallgrass': case 'flowers':
        remove(); P.burst('chip_leaf', cx, cy, 6, { up: 40 });
        if (o.k === 'tallgrass' && Math.random() < 0.3) D.spawn('fiber', 1, 0, cx, cy);
        return;
      case 'twig':
        remove(); P.burst('chip_wood', cx, cy, 8, { up: 50 }); D.spawn('wood', 1 + (Math.random() < 0.3 ? 1 : 0), 0, cx, cy); addXp('foraging', 1);
        return;
      case 'stone':
        if (t !== 'pickaxe') return this.wrongTool('Picareta');
        remove(); P.burst('chip_stone', cx, cy, 9, { up: 55 }); D.spawn('stone', 1 + (Math.random() < 0.3 ? 1 : 0), 0, cx, cy); addXp('mining', 1);
        return;
      case 'ore': case 'crystal': {
        if (t !== 'pickaxe') return this.wrongTool('Picareta');
        const def = o.k === 'ore' ? MINE_ROCKS[o.t ?? 0] : null;
        o.hp = (o.hp ?? 1) - PICK_POWER[tier];
        P.burst('chip_stone', cx, cy - 2, 5, { up: 50 });
        if (o.hp > 0.001) { this.wobble(anchor); return; }
        remove();
        P.burst('chip_stone', cx, cy - 2, 10, { up: 60, speed: 34 });
        if (def) {
          const q = def.qty[0] + Math.floor(Math.random() * (def.qty[1] - def.qty[0] + 1));
          D.spawn(def.drop, q, 0, cx, cy);
          if (def.drop !== 'stone' && def.drop !== 'coal' && !def.drop.endsWith('_ore')) { P.burst('spark', cx, cy - 6, 5, { up: 50, grav: 40, life: 0.8 }); haptic.rare(); }
          addXp('mining', def.drop === 'stone' ? 1 : def.drop.endsWith('_ore') ? 4 : 6);
        } else {
          D.spawn(Math.random() < 0.15 ? ['quartz', 'amethyst', 'emerald'][o.v % 3] : 'quartz', 1, 0, cx, cy);
          P.burst('spark', cx, cy - 6, 6, { up: 50, grav: 40, life: 0.8 });
        }
        this.mineLadderChance(ax, ay);
        return;
      }
      case 'bigrock':
        if (t !== 'pickaxe') return this.wrongTool('Picareta');
        o.hp = (o.hp ?? 2) - PICK_POWER[tier];
        P.burst('chip_stone', cx, cy, 6, { up: 55 });
        if (o.hp > 0.001) { this.wobble(anchor); return; }
        remove(); D.spawn('stone', 3, 0, cx, cy); addXp('mining', 2); this.mineLadderChance(ax, ay);
        return;
      case 'rockpile': {
        if (t !== 'pickaxe') return this.wrongTool('Picareta');
        const n = (o.g ?? 1) * ROCKPILE_STONE;
        remove(); this.h.shake(80, 2);
        P.burst('chip_stone', cx, cy - 4, 14, { up: 70, speed: 40 });
        D.spawn('stone', n, 0, cx, cy, 20);
        addXp('mining', o.g ?? 1);
        return;
      }
      case 'torch': case 'furnace': case 'sprinkler': case 'scarecrow': case 'lantern': case 'fence': case 'wheelbarrow': {
        if (o.m) { bus.emit('toast', 'A máquina está em uso.', 'warn'); return; }
        if (o.k === 'wheelbarrow' && (o.g ?? 0) > 0) { bus.emit('toast', 'Esvazie o carrinho antes.', 'warn'); return; }
        remove();
        D.spawn(o.k === 'sprinkler' ? SPRINKLER_ITEMS[o.t ?? 0] : OBJ[o.k].item ?? o.k, 1, 0, cx, cy);
        if (o.k === 'fence') this.updateFences(ax, ay);
        P.burst('chip_wood', cx, cy, 5, { up: 40 });
        return;
      }
      case 'sapling':
        remove(); P.burst('chip_leaf', cx, cy, 6, { up: 40 }); D.spawn(TREE_SEED_OF[o.t ?? 0], 1, 0, cx, cy);
        return;
      case 'boulder': {
        if (t !== 'pickaxe') return this.wrongTool('Picareta');
        o.hp = (o.hp ?? 8) - 8 / HITS_BOULDER[tier];
        P.burst('chip_stone', cx, cy - 6, 6, { up: 60 });
        if (o.hp <= 0.001) { remove(); this.h.shake(80, 2); P.burst('chip_stone', cx, cy - 8, 16, { up: 80, speed: 40 }); D.spawn('stone', 15, 0, cx, cy); addXp('mining', 12); haptic.harvest(); }
        else this.wobble(anchor);
        return;
      }
      case 'stump': {
        if (t !== 'axe') return this.wrongTool('Machado');
        o.hp = (o.hp ?? 10) - 10 / HITS_STUMP[tier];
        P.burst('chip_wood', cx, cy - 6, 6, { up: 60 });
        if (o.hp <= 0.001) { remove(); this.h.shake(80, 2); P.burst('chip_wood', cx, cy - 8, 14, { up: 80, speed: 40 }); D.spawn('wood', 10, 0, cx, cy); addXp('foraging', 10); }
        else this.wobble(anchor);
        return;
      }
      case 'tree': {
        if (t !== 'axe') return this.wrongTool('Machado');
        if (o.s) {
          o.hp = (o.hp ?? 4) - 4 / Math.max(1, HITS_TREE[tier] / 2.5);
          P.burst('chip_wood', cx, cy - 4, 6, { up: 55 });
          if (o.hp <= 0.001) { remove(); D.spawn('wood', 2 + Math.floor(Math.random() * 3), 0, cx, cy); addXp('foraging', 4); }
          else this.wobble(anchor);
          return;
        }
        o.hp = (o.hp ?? 10) - 10 / HITS_TREE[tier];
        P.burst('chip_wood', cx, cy - 10, 6, { up: 60 });
        P.burst('chip_leaf', cx, cy - 50, 4, { up: 10, grav: 60, life: 1.2, speed: 20 });
        if (o.hp <= 0.001) this.fellTree(anchor, o, cx, cy);
        else this.wobble(anchor);
        return;
      }
    }
  }

  private wrongTool(name: string): void { bus.emit('toast', `Precisa da ${name}.`, 'warn'); }

  /** Árvore cai na direção oposta ao jogador e vira toco. */
  private fellTree(anchor: number, o: WObj, cx: number, cy: number): void {
    const V = this.h.view, L = this.h.loc, D = this.h.drops, P = this.h.parts;
    const spr = V.spriteOf(anchor);
    const dirSign = this.h.player.x < cx ? 1 : -1;
    if (spr) {
      const fall = this.h.sc.add.image(spr.x, spr.y, 'atlas', spr.frame.name).setOrigin(0.5, 1).setDepth(spr.depth + 0.5);
      this.h.sc.tweens.add({
        targets: fall, angle: 90 * dirSign, duration: 750, ease: 'Cubic.easeIn',
        onComplete: () => {
          this.h.shake(80, 2);
          P.burst('chip_leaf', cx + dirSign * 40, cy - 6, 16, { up: 50, speed: 40, life: 0.9 });
          this.h.sc.tweens.add({ targets: fall, alpha: 0, duration: 250, onComplete: () => fall.destroy() });
          const dx = cx + dirSign * 36;
          D.spawn('wood', 8 + Math.floor(Math.random() * 5), 0, dx, cy, 22);
          D.spawn('sap', 1 + Math.floor(Math.random() * 2), 0, dx, cy, 18);
          if (Math.random() < 0.5) D.spawn(TREE_SEED_OF[o.t ?? 0], 1, 0, dx, cy, 18);
        },
      });
    }
    o.s = 1; o.hp = 4; L.rev++;
    V.refreshObj(anchor);
    addXp('foraging', 12);
    haptic.harvest();
  }

  private wobble(anchor: number): void {
    const spr = this.h.view.spriteOf(anchor);
    if (!spr) return;
    const x0 = spr.x;
    this.h.sc.tweens.add({ targets: spr, x: x0 + 1.5, duration: 40, yoyo: true, repeat: 1, onComplete: () => { spr.x = x0; } });
  }

  private doHarvest(x: number, y: number): void {
    const L = this.h.loc, V = this.h.view;
    this.h.player.startAct('harvest', null, () => {
      const r = harvest(L, x, y);
      const i = L.idx(x, y);
      V.refreshCrop(i);
      if (!r) return;
      const [cx, cy] = this.center(x, y);
      this.h.drops.spawn(r.id, r.q, r.ql, cx, cy, 6);
      this.h.parts.burst('chip_leaf', cx, cy, 6, { up: 40 });
      addXp('farming', Math.max(3, Math.round((CROP_BY_ID[r.id]?.sell ?? 30) / 10)));
      haptic.harvest();
    });
  }

  private doPlant(x: number, y: number, slot: number): void {
    const st = G.player.inv[slot];
    if (!st) return;
    const def = CROP_BY_SEED[st.id];
    if (!def) return;
    const L = this.h.loc;
    if (!seedFits(L, def)) { bus.emit('toast', `${ITEMS[st.id].name} não crescem nesta estação.`, 'warn'); return; }
    if (plant(L, x, y, st.id)) {
      takeFromSlot(slot, 1);
      this.h.view.refreshCrop(L.idx(x, y));
      const [cx, cy] = this.center(x, y);
      this.h.parts.burst('chip_dirt', cx, cy + 3, 4, { up: 25, speed: 12 });
      this.lastKind = 'plant';
    }
  }

  private doPlantTree(x: number, y: number, slot: number): void {
    const st = G.player.inv[slot];
    if (!st) return;
    const type = TREE_SEEDS[st.id];
    if (type === undefined) return;
    if (this.h.loc.place(x, y, { k: 'sapling', v: 0, t: type, g: 0, a: 0 })) {
      takeFromSlot(slot, 1);
      this.h.view.refreshObj(this.h.loc.idx(x, y));
    }
  }

  /** Escada aparece ao quebrar pedras aleatórias (chance cresce a cada pedra). */
  private mineLadderChance(x: number, y: number): void {
    const L = this.h.loc;
    if (!L.id.startsWith('mine:') || L.extra.ladder) return;
    const broken = ((L.extra.broken as number) ?? 0) + 1;
    L.extra.broken = broken;
    let rocks = 0;
    for (const o of L.objs.values()) if (o.k === 'ore' || o.k === 'bigrock') rocks++;
    if (Math.random() < LADDER_BASE + broken * LADDER_STEP || rocks <= 3) {
      if (L.place(x, y, { k: 'ladder', v: 0 })) {
        L.extra.ladder = 1;
        this.h.view.refreshObj(L.idx(x, y));
        const [cx, cy] = this.center(x, y);
        this.h.parts.burst('spark', cx, cy, 8, { up: 40, grav: 30, life: 0.9 });
        bus.emit('toast', 'Uma escada apareceu!', 'good');
        haptic.rare();
      }
    }
  }

  /** Atualiza a máscara de conexão das cercas ao redor de (x,y). */
  private updateFences(x: number, y: number): void {
    const L = this.h.loc;
    const isF = (xx: number, yy: number) => L.objAt(xx, yy)?.o.k === 'fence';
    for (const [dx, dy] of [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      const h = L.objAt(xx, yy);
      if (!h || h.o.k !== 'fence') continue;
      h.o.v = (isF(xx, yy - 1) ? 1 : 0) | (isF(xx + 1, yy) ? 2 : 0) | (isF(xx, yy + 1) ? 4 : 0) | (isF(xx - 1, yy) ? 8 : 0);
      this.h.view.refreshObj(h.i);
    }
  }

  private doPath(x: number, y: number, slot: number): void {
    const L = this.h.loc;
    L.terrain[L.idx(x, y)] = T.Stone;
    this.h.view.refreshTerrain(x, y);
    takeFromSlot(slot, 1);
    const [cx, cy] = this.center(x, y);
    this.h.parts.burst('chip_stone', cx, cy + 3, 4, { up: 25, speed: 12 });
  }

  /** Esvazia o carrinho de mão: cada pedra grande vira pedras na mochila. */
  private doEmpty(anchor: number): void {
    const o = this.h.loc.objs.get(anchor);
    if (!o) return;
    const n = (o.g ?? 0) * ROCKPILE_STONE;
    const left = addItem('stone', n);
    if (left >= n) { bus.emit('toast', 'Mochila cheia!', 'warn'); return; }
    bus.emit('pickup', 'stone', n - left);
    o.g = Math.ceil(left / ROCKPILE_STONE);
    this.h.loc.rev++;
    this.h.view.refreshObj(anchor);
  }

  /** Área de efeito para prévia (irrigador/espantalho selecionado). */
  previewArea(): { x: number; y: number; r: number; diag: boolean; circle: boolean } | null {
    const a = this.cur;
    if (a.kind !== 'place') return null;
    const s = selected();
    if (!s) return null;
    const ti = SPRINKLER_ITEMS.indexOf(s.id);
    if (ti >= 0) return { x: a.tx, y: a.ty, r: SPRINKLER_AREA[ti].r, diag: SPRINKLER_AREA[ti].diag, circle: false };
    if (s.id === 'scarecrow') return { x: a.tx, y: a.ty, r: SCARECROW_RADIUS, diag: true, circle: true };
    return null;
  }

  private doCollect(anchor: number): void {
    const L = this.h.loc;
    const o = L.objs.get(anchor);
    if (!o?.m) return;
    if (addItem(o.m.out, o.m.q) > 0) { bus.emit('toast', 'Mochila cheia!', 'warn'); return; }
    bus.emit('pickup', o.m.out, o.m.q);
    addXp('mining', 3);
    delete o.m;
    const spr = this.h.view.spriteOf(anchor);
    if (spr) this.h.sc.tweens.add({ targets: spr, scaleY: 0.85, scaleX: 1.12, duration: 70, yoyo: true });
    this.h.view.refreshObj(anchor);
    haptic.harvest();
  }

  private doLoad(anchor: number, ore: string): void {
    const L = this.h.loc;
    const o = L.objs.get(anchor);
    if (!o || !loadFurnace(o, ore)) return;
    this.h.view.refreshObj(anchor);
    bus.emit('toast', `Fundindo ${ITEMS[ore]?.name ?? ore}… pronto em ${SMELT.minutes} min.`, 'info');
    const spr = this.h.view.spriteOf(anchor);
    if (spr) this.h.parts.burst('chip_dirt', spr.x, spr.y - 20, 6, { up: 30, tint: 0xff9040, grav: 20 });
  }

  private doLift(anchor: number): void {
    const L = this.h.loc;
    if (!L.objs.get(anchor)) return;
    L.remove(anchor); this.h.view.refreshObj(anchor);
    G.flags.carry = 1;
    this.h.player.carrying = true;
    haptic.tap();
  }

  private doDrop(x: number, y: number): void {
    const L = this.h.loc;
    if (!L.place(x, y, { k: 'bigrock', v: 0, hp: 2 })) return;
    this.h.view.refreshObj(L.idx(x, y));
    delete G.flags.carry;
    this.h.player.carrying = false;
    const [cx, cy] = this.center(x, y);
    this.h.parts.burst('chip_dirt', cx, cy + 4, 6, { up: 30 });
  }

  private doStack(x: number, y: number): void {
    const L = this.h.loc;
    const hit = L.objAt(x, y);
    if (!hit) return;
    if (hit.o.k === 'wheelbarrow') { hit.o.g = (hit.o.g ?? 0) + 1; L.rev++; }
    else if (hit.o.k === 'bigrock') { L.objs.set(hit.i, { k: 'rockpile', v: 0, g: 2 }); L.rev++; }
    else if (hit.o.k === 'rockpile') { hit.o.g = (hit.o.g ?? 1) + 1; L.rev++; }
    else return;
    this.h.view.refreshObj(hit.i);
    delete G.flags.carry;
    this.h.player.carrying = false;
    const [cx, cy] = this.center(x, y);
    this.h.parts.burst('chip_stone', cx, cy, 6, { up: 35 });
    if (hit.o.k === 'wheelbarrow') bus.emit('toast', `Carrinho de mão: ${hit.o.g}/${WHEELBARROW_CAP} pedras.`, 'info');
    else bus.emit('toast', `Pilha de pedras: ${hit.o.k === 'rockpile' ? hit.o.g : 2} pedras grandes.`, 'info');
  }

  private doPlace(x: number, y: number, slot: number): void {
    const st = G.player.inv[slot];
    const kind = st ? ITEMS[st.id]?.place : undefined;
    if (!st || !kind) return;
    const o: WObj = kind === 'chest' ? { k: 'chest', v: 0, inv: new Array(36).fill(null) }
      : kind === 'sprinkler' ? { k: 'sprinkler', v: 0, t: SPRINKLER_ITEMS.indexOf(st.id) }
      : kind === 'wheelbarrow' ? { k: 'wheelbarrow', v: 0, g: 0 } : { k: kind, v: 0 };
    if (this.h.loc.place(x, y, o)) {
      takeFromSlot(slot, 1);
      this.h.view.refreshObj(this.h.loc.idx(x, y));
      if (kind === 'fence') this.updateFences(x, y);
      const [cx, cy] = this.center(x, y);
      this.h.parts.burst('chip_dirt', cx, cy + 4, 5, { up: 30, speed: 14 });
      haptic.tap();
    }
  }

  private doFertilize(x: number, y: number, slot: number): void {
    const L = this.h.loc, i = L.idx(x, y);
    L.soil[i] = (L.soil[i] & ~0b1100) | (1 << 2);
    takeFromSlot(slot, 1);
    const [cx, cy] = this.center(x, y);
    this.h.parts.burst('chip_dirt', cx, cy, 6, { up: 35, speed: 16, tint: 0xe0c070 });
    bus.emit('toast', 'Solo fertilizado: colheitas de melhor qualidade!', 'good');
  }

  private doEat(slot: number): void {
    const st = G.player.inv[slot];
    if (!st) return;
    const d = ITEMS[st.id];
    if (!d?.edible) return;
    const gain = Math.round(d.edible * (1 + (st.ql ?? 0) * 0.4));
    bus.emit('dialog', {
      title: 'Comer?', icon: itemIcon(st.id), text: `${d.name}\n+${gain} de energia`,
      buttons: [{ label: 'Comer', act: () => {
        const cur = G.player.inv[slot];
        if (!cur || cur.id !== st.id) return;
        takeFromSlot(slot, 1);
        G.player.energy = Math.min(G.player.maxEnergy, G.player.energy + gain);
        delete G.flags.exhaust;
        bus.emit('toast', `+${gain} de energia`, 'good');
      } }, { label: 'Não' }],
    });
  }

  private doInteract(what: string, x: number, y: number): void {
    void x; void y;
    if (what.startsWith('chest:')) { bus.emit('menu', what); return; }
    if (what.startsWith('furnace:')) {
      const o = this.h.loc.objs.get(Number(what.slice(8)));
      if (o?.m) bus.emit('toast', `Fundindo… pronto em ${minutesLeft(o)} min.`, 'info');
      else bus.emit('dialog', { title: 'Fornalha', icon: 'furnace', text: 'Fornalha: 5 minérios + 1 carvão = 1 barra em 30 minutos.\nTenha os minérios e o carvão na mochila e toque na fornalha.' });
      return;
    }
    switch (what) {
      case 'door':
        if (this.h.loc.id === 'farm') this.h.goTo('house', 6 * 16, 8 * 16 + 12, 1);
        else bus.emit('dialog', { title: 'Casa', icon: 'icon_door', text: 'Ninguém atende. Os moradores devem estar fora.' });
        return;
      case 'bed': this.h.sleepPrompt(); return;
      case 'mail': bus.emit('toast', 'Nenhuma carta hoje.', 'info'); return;
      case 'tv': {
        const w = G.weather.tomorrow;
        bus.emit('dialog', { title: 'Previsão do tempo', icon: `wx_${w}`, text: `Amanhã: ${WEATHER_NAMES[w]}.\n${w === 'rain' || w === 'storm' ? 'A chuva vai regar suas plantações!' : 'Não esqueça de regar as plantações.'}` });
        return;
      }
      case 'bin': bus.emit('menu', 'ship'); return;
      case 'down': {
        const n = (this.h.loc.extra.floor as number) ?? 0;
        if (n >= MINE_FLOORS) { bus.emit('toast', 'Este é o fundo da mina.', 'info'); return; }
        G.flags.mineDeepest = Math.max(G.flags.mineDeepest ?? 0, n + 1);
        this.h.goTo(`mine:${n + 1}`, -1, -1, 0);
        return;
      }
      case 'up': {
        const n = (this.h.loc.extra.floor as number) ?? 1;
        if (n <= 1) this.h.goTo('mine', 9 * 16 + 8, 7 * 16 + 13, 0);
        else this.h.goTo(`mine:${n - 1}`, -1, -1, 0);
        return;
      }
      case 'elevator': bus.emit('menu', 'elevator'); return;
      case 'minecart': bus.emit('dialog', { title: 'Carrinho de mina', icon: 'minecart', text: 'Os trilhos estão quebrados. Talvez o Casarão da Vila ajude a consertá-los.' }); return;
      case 'shop': {
        const m = G.time.min, wd = (G.time.day - 1) % 7;
        if (wd === SHOP_CLOSED_WEEKDAY) bus.emit('dialog', { title: 'Loja', icon: 'icon_door', text: 'Fechado às quartas-feiras.\nVolte amanhã!' });
        else if (m < SHOP_OPEN || m >= SHOP_CLOSE) bus.emit('dialog', { title: 'Loja', icon: 'icon_door', text: 'A loja abre das 9:00 às 17:00.' });
        else bus.emit('menu', 'shop');
        return;
      }
      case 'smith': bus.emit('dialog', { title: 'Ferreiro', icon: 'tool_pickaxe_1', text: 'O ferreiro está acendendo a forja.\nTraga barras de metal quando a mina abrir para melhorar suas ferramentas.' }); return;
      case 'manor': bus.emit('dialog', { title: 'Casarão da Vila', icon: 'icon_door', text: 'Um casarão abandonado, cheio de poeira e trepadeiras.\nDizem que quem o restaurar trará a vila de volta à vida...' }); return;
      case 'sign': bus.emit('dialog', { title: 'Placa', text: 'Bem-vindo à Vila!\nLoja: 9h–17h (fecha às quartas)\nFerreiro e Casarão na praça.' }); return;
    }
  }

  /** Toque direto no mundo: interage com o tile tocado se estiver perto. */
  tapAt(wx: number, wy: number): boolean {
    const p = this.h.player;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (Math.abs(tx - p.tx) > 1 || Math.abs(ty - p.ty) > 1 || uiState.panelOpen) return false;
    this.evalTile(tx, ty, true, this.cur);
    if (this.cur.kind === 'none') return false;
    this.run(false);
    return true;
  }
}
