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
import { canTill, till, water, plant, harvest, cropReady, isTilled, isWet, seedFits } from '../systems/Farming';
import { selected, slotOf, takeFromSlot } from '../systems/Inventory';
import { settings } from '../systems/Settings';
import { bus } from '../systems/EventBus';
import { haptic } from '../systems/Haptics';
import { addXp } from '../systems/Skills';
import { HOUSE_DOOR, BIN_POS } from './genFarm';
import { shippingBin, WEATHER_NAMES } from '../systems/DayCycle';
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

type Kind = 'none' | 'harvest' | 'interact' | 'till' | 'water' | 'refill' | 'plant' | 'hit' | 'clear' | 'eat' | 'plantTree';
const PRIO: Record<Kind, number> = { none: 0, eat: 0.5, till: 1, water: 1, refill: 1, plant: 1.2, hit: 1, clear: 1, plantTree: 1, interact: 2, harvest: 5 };

interface Act { kind: Kind; tx: number; ty: number; icon: string; tool: ToolKind | null; slot: number; what: string; prio: number; }
const mk = (): Act => ({ kind: 'none', tx: 0, ty: 0, icon: 'icon_hand', tool: null, slot: -1, what: '', prio: 0 });

export const CAN_CAP = [40, 55, 70, 85];

/** Ação contextual: escolhe o alvo (auto-mira raio 1) e executa com a ferramenta certa. */
export class Actions {
  readonly cur: Act = mk();
  private tmp: Act = mk();
  private lastTx = -999;
  private lastTy = -999;
  private lastKind: Kind = 'none';
  private facing = { x: 0, y: 0 };

  constructor(private h: WorldHost) {}

  /** Avalia a melhor ação. Prioridade: colher > coletar > máquina > interagir > ferramenta. */
  evaluate(): Act {
    const p = this.h.player;
    const f = p.facingTile(this.facing);
    const best = this.cur;
    this.evalTile(f.x, f.y, true, best);
    // auto-mira: vizinhos só para colher/interagir
    if (best.prio < PRIO.interact) {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const x = p.tx + i, y = p.ty + j;
        if (x === f.x && y === f.y) continue;
        this.evalTile(x, y, false, this.tmp);
        if (this.tmp.prio > best.prio) Object.assign(best, this.tmp);
      }
    }
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
    const crop = L.crops.get(i);
    if (crop && cropReady(crop)) { this.set(a, 'harvest', x, y, 'icon_hand', null); return; }
    const hit = L.objAt(x, y);
    if (hit) {
      const o = hit.o;
      switch (o.k) {
        case 'house': {
          const dx = x - HOUSE_DOOR.x;
          if (y === HOUSE_DOOR.y && dx >= 0 && dx <= 1) this.set(a, 'interact', x, y, 'icon_door', null, -1, 'door');
          return;
        }
        case 'bin': this.set(a, 'interact', x, y, 'icon_box', null, -1, 'bin'); return;
        case 'mailbox': this.set(a, 'interact', x, y, 'icon_talk', null, -1, 'mail'); return;
        case 'bed': this.set(a, 'interact', x, y, 'icon_bed', null, -1, 'bed'); return;
        case 'tv': this.set(a, 'interact', x, y, 'icon_talk', null, -1, 'tv'); return;
      }
      if (!facing) return;
      const def = OBJ[o.k];
      let tool: ToolKind | null = null;
      if (o.k === 'weed' || o.k === 'tallgrass' || o.k === 'flowers') tool = 'scythe';
      else if (def.tool === 'axe' || def.tool === 'pickaxe' || def.tool === 'scythe') tool = def.tool;
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
      default: return this.doTool(a);
    }
  }

  private faceTile(x: number, y: number): void {
    const p = this.h.player;
    const dx = x - p.tx, dy = y - p.ty;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) > Math.abs(dy)) p.face(dx < 0 ? 2 : 3); else p.face(dy < 0 ? 1 : 0);
  }

  private spend(t: ToolKind): boolean {
    const pl = G.player;
    if (pl.energy <= 0) { bus.emit('toast', 'Você está exausto demais... vá dormir.', 'warn'); return false; }
    pl.energy = Math.max(0, pl.energy - toolEnergy(pl.tools[t] ?? 0));
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
        bus.emit('toast', `+${gain} de energia`, 'good');
      } }, { label: 'Não' }],
    });
  }

  private doInteract(what: string, x: number, y: number): void {
    void x; void y;
    switch (what) {
      case 'door': this.h.goTo('house', 6 * 16, 8 * 16 + 12, 1); return;
      case 'bed': this.h.sleepPrompt(); return;
      case 'mail': bus.emit('toast', 'Nenhuma carta hoje.', 'info'); return;
      case 'tv': {
        const w = G.weather.tomorrow;
        bus.emit('dialog', { title: 'Previsão do tempo', icon: `wx_${w}`, text: `Amanhã: ${WEATHER_NAMES[w]}.\n${w === 'rain' || w === 'storm' ? 'A chuva vai regar suas plantações!' : 'Não esqueça de regar as plantações.'}` });
        return;
      }
      case 'bin': return this.ship();
    }
  }

  /** Caixa de envio: coloca a pilha selecionada para vender ao amanhecer. */
  private ship(): void {
    const st = selected();
    if (!st || ITEMS[st.id]?.cat === 'tool') {
      const bin = shippingBin();
      const n = bin.reduce((s, b) => s + b.q, 0);
      bus.emit('toast', n ? `Caixa de envio: ${n} itens para vender amanhã.` : 'Selecione um item na hotbar para vender.', 'info');
      return;
    }
    const d = ITEMS[st.id];
    if (!d || d.price <= 0) { bus.emit('toast', 'Isso não pode ser vendido.', 'warn'); return; }
    shippingBin().push({ id: st.id, q: st.q, ql: st.ql });
    G.player.inv[G.player.sel] = null;
    bus.emit('inventory');
    bus.emit('toast', `${st.q}x ${d.name} na caixa de envio.`, 'good');
    this.h.view.flashBin(BIN_POS.x, BIN_POS.y);
    haptic.tap();
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
