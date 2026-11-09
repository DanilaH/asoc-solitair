import Phaser from 'phaser';
import { installSceneTextSharpness } from '@danilah/mini-games-kit/phaser';
import { applyBoard, packet, sourceCards } from '../domain/engine';
import type { BoardCommand, Deal, GameEvent, Location, Save } from '../domain/types';
import { CARD_H, CARD_W, layout, WIDTH } from './layout';
import type { Pose, Target } from './layout';

interface CardView { node: Phaser.GameObjects.Container; face: Phaser.GameObjects.Container; back: Phaser.GameObjects.Container; badge: Phaser.GameObjects.Text }
interface Options {
  deal: Deal; getSave(): Save; command(command: BoardCommand): void; sound(name: string): void;
  inspect(id: string): void; ready(scene: BoardScene): void;
}
const inside = (x: number, y: number, target: { x: number; y: number; width: number; height: number }) =>
  Math.abs(x - target.x) <= target.width / 2 && Math.abs(y - target.y) <= target.height / 2;
const same = (a: Location, b: Location) => a.kind === b.kind && a.index === b.index;

/** The model is already committed before any visual transition begins. */
export class BoardScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container;
  private slots!: Phaser.GameObjects.Graphics;
  private focus!: Phaser.GameObjects.Graphics;
  private stockArt!: Phaser.GameObjects.Graphics;
  private stockCount!: Phaser.GameObjects.Text;
  private stockLabel!: Phaser.GameObjects.Text;
  private praise!: Phaser.GameObjects.Text;
  private views = new Map<string, CardView>();
  private metrics!: ReturnType<typeof layout>;
  private selected: Location | null = null;
  private press: { pointerId: number; toggle: boolean; from: Location | null; x: number; y: number; moved: boolean; stock: boolean; target: Target | null; poses: Pose[] } | null = null;
  private unit = 1;
  private enabled = true;
  private initial = true;
  private hintObjects: Phaser.GameObjects.GameObject[] = [];
  private hintTweens: Phaser.Tweens.Tween[] = [];
  private inspectMode = false;
  private particles: Phaser.GameObjects.Arc[] = [];
  public constructor(private readonly options: Options) { super('board'); }
  public preload(): void {
    for (const card of Object.values(this.options.deal.cards)) if (card.image) this.load.image(card.id, card.image);
  }
  public create(): void {
    installSceneTextSharpness(this);
    this.world = this.add.container(0, 0);
    this.slots = this.add.graphics(); this.stockArt = this.add.graphics(); this.focus = this.add.graphics().setDepth(450);
    this.stockCount = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(38);
    this.stockLabel = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '17px', color: '#b0d7bf' }).setOrigin(.5).setDepth(38);
    this.praise = this.add.text(270, 235, '', { fontFamily: 'Georgia', fontSize: '36px', fontStyle: 'bold', color: '#ffe89b', stroke: '#2e6245', strokeThickness: 4 }).setOrigin(.5).setDepth(600).setAlpha(0);
    this.world.add([this.slots, this.stockArt, this.focus, this.stockCount, this.stockLabel, this.praise]);
    for (const card of Object.values(this.options.deal.cards)) this.views.set(card.id, this.makeCard(card.id));
    for (let i = 0; i < 36; i++) { const dot = this.add.circle(0, 0, 3 + i % 3, i % 2 ? 0xffdc79 : 0x99e5bd).setDepth(510).setVisible(false); this.world.add(dot); this.particles.push(dot); }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.down(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.move(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.up(pointer));
    this.input.on('pointerupoutside', () => this.cancel());
    const resize = () => { this.cancel(); this.sync([], false); };
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => { this.scale.off('resize', resize); this.clearHint(); this.views.clear(); });
    this.sync([], true);
    this.options.ready(this);
  }
  private label(x: number, y: number, text: string, size: number, color: string) {
    const label = this.add.text(x, y, text, { fontFamily: 'Arial', fontSize: `${size}px`, fontStyle: 'bold', color, align: 'center', wordWrap: { width: CARD_W - 18 } }).setOrigin(.5, 0);
    label.setScale(Math.min(1, (CARD_W - 18) / Math.max(1, label.width)));
    return label;
  }
  private makeCard(id: string): CardView {
    const card = this.options.deal.cards[id];
    const node = this.add.container(0, 0).setVisible(false);
    const face = this.add.container(0, 0), back = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x003e2d, .28).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 5, CARD_W, CARD_H, 13);
    g.fillStyle(0xfaf5e8).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 13);
    g.lineStyle(card.leader ? 3 : 1.5, card.leader ? 0xe5bf6c : 0xd6d7be).strokeRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 3, CARD_W - 6, CARD_H - 6, 11);
    if (card.leader) g.fillStyle(0xf2dfae).fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 6, CARD_W - 12, 28, 7);
    face.add(g);
    if (card.leader) {
      face.add(this.label(0, -72, 'КАТЕГОРИЯ', 11, '#8a6934'));
      face.add(this.label(0, -23, card.text, card.text.length > 10 ? 20 : 24, '#3d4e3c'));
    } else if (card.image) {
      face.add(this.add.image(0, 0, id).setDisplaySize(104, 104));
    } else {
      face.add(this.label(0, -64, card.text, card.text.length > 11 ? 19 : 23, '#374d43'));
      face.add(this.label(0, 20, '✦', 28, '#d6d6ba'));
    }
    const badge = this.label(0, 44, '', 20, '#8e7138'); face.add(badge);
    const b = this.add.graphics();
    b.fillStyle(0x003e2d, .25).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 5, CARD_W, CARD_H, 13);
    b.fillStyle(0xf5edda).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 13);
    b.fillStyle(0x579ac5).fillRoundedRect(-CARD_W / 2 + 5, -CARD_H / 2 + 5, CARD_W - 10, CARD_H - 10, 9);
    b.lineStyle(1.2, 0xa6cbdc, .5);
    for (let y = -60; y <= 60; y += 26) for (let x = -46; x <= 46; x += 26) b.strokeCircle(x, y, 7);
    b.lineStyle(2, 0xcce0e7, .65).strokeRoundedRect(-CARD_W / 2 + 12, -CARD_H / 2 + 12, CARD_W - 24, CARD_H - 24, 5);
    back.add(b); node.add([face, back]); this.world.add(node);
    return { node, face, back, badge };
  }
  public sync(events: GameEvent[] = [], entering = false, command?: BoardCommand): void {
    if (!this.world) return;
    const save = this.options.getSave(), board = save.attempt.board;
    this.unit = this.scale.width / WIDTH; this.world.setScale(this.unit);
    this.metrics = layout(board, this.options.deal, this.scale.height / this.unit);
    const duration = save.settings.reducedMotion ? 0 : 215;
    this.slots.clear().lineStyle(2, 0x7ab594, .35).fillStyle(0x023f2d, .25);
    for (const target of this.metrics.targets) {
      const { x, y } = target;
      this.slots.fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 13);
      this.slots.strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 13);
      if (target.location.kind === 'foundation') {
        this.slots.lineStyle(2, 0x8bb895, .35).strokeCircle(x, y, 22);
        this.slots.lineStyle(2, 0x8bb895, .35).lineBetween(x - 8, y, x + 8, y).lineBetween(x, y - 8, x, y + 8);
      }
    }
    const { stock } = this.metrics;
    this.stockArt.clear().fillStyle(board.stock.length ? 0x61a8d2 : 0x164f3d).fillRoundedRect(stock.x - CARD_W / 2, stock.y - CARD_H / 2, CARD_W, CARD_H, 13);
    this.stockArt.lineStyle(3, board.stock.length ? 0xd9e6db : 0x669b7d).strokeRoundedRect(stock.x - CARD_W / 2 + 4, stock.y - CARD_H / 2 + 4, CARD_W - 8, CARD_H - 8, 10);
    if (board.stock.length) {
      this.stockArt.lineStyle(1.5, 0xc1e0e9, .45);
      for (let y = -52; y <= 52; y += 26) for (let x = -40; x <= 40; x += 26) this.stockArt.strokeCircle(stock.x + x, stock.y + y, 7);
    }
    this.stockCount.setPosition(stock.x, stock.y).setText(board.stock.length ? String(board.stock.length) : '↻');
    this.stockLabel.setPosition(stock.x, stock.y + CARD_H / 2 + 16).setText(board.stock.length ? 'Колода' : 'Повторить');
    const visible = new Set(this.metrics.poses.map(p => p.id));
    const completed = events.find(e => e.type === 'complete');
    for (const [id, view] of this.views) {
      if (visible.has(id)) continue;
      this.tweens.killTweensOf(view.node);
      if (completed?.cards?.includes(id)) {
        const to = command?.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, command.to)) : undefined;
        view.node.setVisible(true).setDepth(60);
        this.tweens.add({ targets: view.node, x: to?.x ?? view.node.x, y: to?.y ?? view.node.y,
          scaleX: .65, scaleY: .65, alpha: 0, duration: save.settings.reducedMotion ? 0 : 380, ease: 'Back.easeIn', onComplete: () => view.node.setVisible(false) });
      } else view.node.setVisible(false);
    }
    for (const pose of this.metrics.poses) {
      const view = this.views.get(pose.id)!;
      this.tweens.killTweensOf(view.node);
      const wasFace = view.face.visible;
      view.face.setVisible(pose.faceUp); view.back.setVisible(!pose.faceUp);
      const def = this.options.deal.cards[pose.id];
      const group = board.tableau.findIndex(col => col.includes(pose.id));
      const groupIds = group >= 0 ? packet(board, group, this.options.deal) : board.foundations.find(col => col.includes(pose.id)) ?? [];
      const total = Object.values(this.options.deal.cards).filter(c => c.category === def.category && !c.leader).length;
      view.badge.setText(def.leader ? `${groupIds.filter(id => !this.options.deal.cards[id].leader).length} / ${total}` : groupIds.length > 1 ? `×${groupIds.length}` : '');
      const fresh = entering && this.initial;
      if (fresh) view.node.setPosition(stock.x, stock.y).setAlpha(0).setAngle(-9).setScale(.82);
      view.node.setVisible(true).setDepth(pose.depth);
      if (!entering && pose.faceUp && !wasFace) {
        view.node.setScale(.05, 1);
        this.options.sound('flip');
      }
      const moving = events.some(e => e.type === 'transfer' && e.cards?.includes(pose.id)) || events.some(e => e.type === 'draw' && e.cards?.includes(pose.id));
      const animationOn = new URLSearchParams(location.search).get(moving ? 'fxCards' : 'fxLayout') !== '0';
      this.tweens.add({ targets: view.node, x: pose.x, y: pose.y, scaleX: 1, scaleY: 1, alpha: 1, angle: 0,
        duration: entering && !fresh || !animationOn ? 0 : duration, delay: fresh && duration ? Math.min(400, pose.depth * 6) : 0, ease: 'Cubic.easeOut' });
    }
    this.initial = false;
    this.world.sort('depth');
    this.drawFocus();
    if (completed) this.celebrate(command);
    // A completed touch may arrive after the pointerdown frame already slept.
    // Starting visual work must own its wake, independently of a future input.
    if (this.enabled && this.game.isRunning) this.game.loop.wake();
  }
  private celebrate(command?: BoardCommand) {
    const target = command?.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, command.to)) : undefined;
    const x = target?.x ?? 270, y = target?.y ?? 109;
    const reduced = this.options.getSave().settings.reducedMotion;
    this.tweens.killTweensOf(this.praise);
    this.praise.setText(['Отлично!', 'Есть связь!', 'Всё сошлось!'][this.options.getSave().attempt.board.collected.length % 3]).setPosition(250, 230).setAlpha(1).setScale(.85);
    this.tweens.add({ targets: this.praise, scaleX: 1, scaleY: 1, y: 210, alpha: 0, duration: reduced ? 250 : 850, ease: 'Sine.easeOut' });
    if (!reduced && new URLSearchParams(location.search).get('fxParticles') !== '0') for (let i = 0; i < 14; i++) {
      const dot = this.particles.find(p => !p.visible); if (!dot) break;
      const angle = i * Math.PI * 2 / 14;
      dot.setPosition(x, y).setAlpha(1).setVisible(true);
      this.tweens.add({ targets: dot, x: x + Math.cos(angle) * (60 + i % 3 * 18), y: y + Math.sin(angle) * 65,
        alpha: 0, duration: 500 + i % 3 * 50, ease: 'Cubic.easeOut', onComplete: () => dot.setVisible(false) });
    }
  }
  private point(pointer: Phaser.Input.Pointer) { return { x: pointer.x / this.unit, y: pointer.y / this.unit }; }
  private hitSource(x: number, y: number): Location | null {
    const board = this.options.getSave().attempt.board;
    for (const pose of [...this.metrics.poses].sort((a, b) => b.depth - a.depth)) {
      const view = this.views.get(pose.id)!;
      if (!pose.faceUp || !inside(x, y, { x: view.node.x, y: view.node.y, width: CARD_W, height: CARD_H })) continue;
      if (board.waste.at(-1) === pose.id) return { kind: 'waste', index: 0 };
      const index = board.tableau.findIndex(col => packet(board, board.tableau.indexOf(col), this.options.deal).includes(pose.id));
      if (index >= 0) return { kind: 'tableau', index };
      return null;
    }
    return null;
  }
  private hitTarget(x: number, y: number): Target | null {
    return this.metrics.targets.find(t => inside(x, y, t)) ?? null;
  }
  private down(pointer: Phaser.Input.Pointer) {
    if (!this.enabled || !pointer.primaryDown || this.press) return;
    const { x, y } = this.point(pointer), board = this.options.getSave().attempt.board;
    const source = this.hitSource(x, y);
    if (this.inspectMode) {
      if (source) this.options.inspect(sourceCards(board, source, this.options.deal).at(-1)!);
      return;
    }
    if (board.phase !== 'playing') return;
    this.clearHint();
    const target = this.hitTarget(x, y);
    const chosenTarget = this.selected && target && !same(this.selected, target.location) ? target : null;
    const from = chosenTarget ? this.selected : source;
    const ids = from ? sourceCards(board, from, this.options.deal) : [];
    this.press = { pointerId: pointer.id, toggle: Boolean(source && this.selected && same(source, this.selected)), from, x, y, moved: false, stock: !chosenTarget && inside(x, y, { ...this.metrics.stock, width: CARD_W, height: CARD_H }),
      target: chosenTarget, poses: this.metrics.poses.filter(p => ids.includes(p.id)).map(p => ({ ...p, x: this.views.get(p.id)!.node.x, y: this.views.get(p.id)!.node.y })) };
    if (source && !chosenTarget) { this.selected = source; this.options.sound('lift'); this.drawFocus(); }
  }
  private move(pointer: Phaser.Input.Pointer) {
    if (!this.enabled || !this.press?.from || this.press.pointerId !== pointer.id || this.press.target || !pointer.isDown) return;
    const { x, y } = this.point(pointer), press = this.press;
    if (Math.hypot(x - press.x, y - press.y) > 11) press.moved = true;
    if (!press.moved) return;
    press.poses.forEach((pose, i) => {
      const view = this.views.get(pose.id)!;
      this.tweens.killTweensOf(view.node);
      view.node.setPosition(pose.x + x - press.x, pose.y + y - press.y - 10).setScale(1.035).setDepth(480 + i);
    });
    this.world.sort('depth');
    this.drawFocus(this.hitTarget(x, y));
  }
  private up(pointer: Phaser.Input.Pointer) {
    if (this.press && this.press.pointerId !== pointer.id) return;
    const press = this.press; this.press = null;
    if (!this.enabled || !press) return;
    const { x, y } = this.point(pointer);
    if (press.stock) {
      if (inside(x, y, { ...this.metrics.stock, width: CARD_W, height: CARD_H }) && Math.hypot(x - press.x, y - press.y) < 11) {
        this.selected = null; this.options.command({ type: this.options.getSave().attempt.board.stock.length ? 'draw' : 'recycle' });
      }
      return;
    }
    const target = press.target ?? (press.moved ? this.hitTarget(x, y) : null);
    if (press.from && target && !same(press.from, target.location)) {
      this.selected = null; this.options.command({ type: 'transfer', from: press.from, to: target.location });
    } else if (press.moved || !press.from || press.toggle) this.cancel();
    else this.drawFocus();
  }
  private drawFocus(hover?: Target | null) {
    if (!this.focus) return;
    this.focus.clear();
    if (this.selected) for (const id of sourceCards(this.options.getSave().attempt.board, this.selected, this.options.deal)) {
      const view = this.views.get(id)!;
      this.focus.lineStyle(3, 0xffe5a3, .95).strokeRoundedRect(view.node.x - CARD_W / 2 - 2, view.node.y - CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 14);
    }
    if (hover && this.selected) {
      const valid = typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from: this.selected, to: hover.location }, this.options.deal) !== 'string';
      this.focus.lineStyle(4, valid ? 0xffdf7b : 0xd5aa8d, .95).strokeRoundedRect(hover.x - CARD_W / 2 - 5, hover.y - CARD_H / 2 - 5, CARD_W + 10, CARD_H + 10, 15);
    }
  }
  public cancel(): void { this.press = null; this.selected = null; if (this.world) this.sync([], false); }
  public back(): boolean { if (!this.press && !this.selected && !this.hintObjects.length) return false; this.clearHint(); this.cancel(); return true; }
  public setEnabled(value: boolean): void { this.enabled = value; if (!value) { this.clearHint(); this.cancel(); } }
  public setInspect(value: boolean): void { this.inspectMode = value; this.cancel(); }
  public clearHint(): void { this.hintTweens.forEach(t => t.stop()); this.hintTweens = []; this.hintObjects.forEach(o => o.destroy()); this.hintObjects = []; }
  public hint(action: BoardCommand): void {
    this.clearHint();
    const source = action.type === 'transfer' ? sourceCards(this.options.getSave().attempt.board, action.from, this.options.deal) : [];
    const from = action.type === 'transfer' ? this.metrics.poses.find(p => p.id === source.at(-1)) : this.metrics.stock;
    const target = action.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, action.to)) : this.metrics.stock;
    if (!from || !target) return;
    const ghost = this.add.graphics().fillStyle(0xffe39c, .3).lineStyle(4, 0xffe6a2, .9)
      .fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 13).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 13)
      .setPosition(from.x, from.y).setDepth(700);
    this.world.add(ghost); this.world.sort('depth'); this.hintObjects.push(ghost);
    this.hintTweens.push(this.tweens.add({ targets: ghost, x: target.x, y: target.y, alpha: .25, duration: 750, hold: 180, repeat: 1,
      onRepeat: () => ghost.setPosition(from.x, from.y).setAlpha(1), onComplete: () => this.clearHint() }));
  }
  public hasMotion(): boolean { return this.tweens.getTweens().length > 0 || Boolean(this.press?.moved); }
  public geometry() { return this.metrics; }
}
