import Phaser from 'phaser';
import { installSceneTextSharpness } from '@danilah/mini-games-kit/phaser';
import { cardCaption } from './captions';
import { applyBoard, isLocked, packet, sourceCards } from '../domain/engine';
import type { BoardCommand, Command, Deal, GameEvent, Location, Save } from '../domain/types';
import { boardFrame, cardMetrics, layout } from './layout';
import type { Pose, Target } from './layout';

interface CardView { node: Phaser.GameObjects.Container; face: Phaser.GameObjects.Container; back: Phaser.GameObjects.Container; badge: Phaser.GameObjects.Text; backArt: Phaser.GameObjects.Graphics }
interface Options {
  deal: Deal; getSave(): Save; command(command: Command): void; sound(name: string): void;
  jokerMode?(active: boolean): void; inspect(id: string): void; ready(scene: BoardScene): void;
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
  private rewardBanner!: Phaser.GameObjects.Container;
  private completionRing!: Phaser.GameObjects.Arc;
  private departing = new Set<string>();
  private praiseIndex = 0;
  private views = new Map<string, CardView>();
  private metrics!: ReturnType<typeof layout>;
  private jokerSelecting = false;
  private jokerArt!: Phaser.GameObjects.Container;
  private jokerBadge!: Phaser.GameObjects.Container;
  private lockArt!: Phaser.GameObjects.Container;
  private lockCount!: Phaser.GameObjects.Text;
  private keyFlights: Phaser.GameObjects.Text[] = [];
  private selected: Location | null = null;
  private press: { pointerId: number; toggle: boolean; from: Location | null; x: number; y: number; moved: boolean; stock: boolean; target: Target | null; poses: Pose[]; jokerColumn?: number } | null = null;
  private unit = 1;
  private enabled = true;
  private initial = true;
  private hintObjects: Phaser.GameObjects.GameObject[] = [];
  private hintTweens: Phaser.Tweens.Tween[] = [];
  private inspectMode = false;
  private backStyle = '';
  private particles: Phaser.GameObjects.Shape[] = [];
  private presentedDealId: string | undefined;
  public constructor(private readonly options: Options) { super('board'); }
  private get cardW() { return cardMetrics(this.options.deal).width; }
  private get cardH() { return cardMetrics(this.options.deal).height; }
  public setDeal(deal: Deal) { this.enabled = false; this.presentedDealId = undefined; this.options.deal = deal; this.scene.restart(); this.game.loop.wake(); }
  public preload(): void {
    if (!this.textures.exists('reward-emblem')) this.load.image('reward-emblem', 'art/ui/reward-emblem.webp');
    for (const card of Object.values(this.options.deal.cards)) if (card.image && !this.textures.exists(card.id)) this.load.image(card.id, card.image);
  }
  public create(): void {
    this.jokerSelecting = false; this.options.jokerMode?.(false); this.selected = null; this.press = null; this.initial = true; this.inspectMode = false; this.particles = []; this.departing.clear(); this.hintObjects = []; this.hintTweens = [];
    installSceneTextSharpness(this);
    this.world = this.add.container(0, 0);
    this.slots = this.add.graphics(); this.stockArt = this.add.graphics(); this.focus = this.add.graphics().setDepth(450);
    this.stockCount = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(38);
    this.stockLabel = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '17px', color: '#b0d7bf' }).setOrigin(.5).setDepth(38);
    this.praise = this.add.text(32, 0, '', { fontFamily: 'Trebuchet MS, Arial', fontSize: '38px', fontStyle: 'bold', color: '#fff5b5', stroke: '#174c54', strokeThickness: 7, shadow: { offsetY: 3, color: '#063b45', blur: 0, fill: true, stroke: true } }).setOrigin(.5);
    const emblem = this.add.image(-122, 0, 'reward-emblem').setDisplaySize(88, 82);
    this.rewardBanner = this.add.container(270, 245, [emblem, this.praise]).setDepth(600).setAlpha(0);
    this.completionRing = this.add.circle(0, 0, 40).setStrokeStyle(7, 0xffdd70).setDepth(505).setVisible(false);
    this.world.add([this.slots, this.stockArt, this.focus, this.stockCount, this.stockLabel, this.rewardBanner, this.completionRing]);
    const gold = this.add.graphics().fillStyle(0xe7be63).fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 13).lineStyle(2, 0xffe6a1).strokeRoundedRect(-this.cardW / 2 + 4, -this.cardH / 2 + 4, this.cardW - 8, this.cardH - 8, 10);
    this.jokerArt = this.add.container(0, 0, [gold, this.label(0, -this.cardH / 2 + 12, 'ДЖОКЕР', 16, '#705328'), this.label(0, -15, '✦', 38, '#fff0bc')]).setVisible(false);
    this.jokerBadge = this.add.container(0, 0, [this.add.circle(0, 0, 11, 0xf1cc73).setStrokeStyle(1, 0xffecc0), this.add.text(0, 0, '✦', { fontFamily: 'Arial', fontSize: '15px', color: '#715321' }).setOrigin(.5)]).setDepth(425).setVisible(false);
    const lock = this.add.graphics().fillStyle(0x143f36, .96).fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 13).lineStyle(3, 0xd9bd7e).strokeRoundedRect(-this.cardW / 2 + 3, -this.cardH / 2 + 3, this.cardW - 6, this.cardH - 6, 11);
    lock.lineStyle(5, 0xf3d58e).strokeRoundedRect(-16, -35, 32, 35, 15).fillStyle(0xf3d58e).fillRoundedRect(-23, -12, 46, 35, 7).fillStyle(0x5c633d).fillCircle(0, 0, 4).fillRect(-2, 0, 4, 10);
    this.lockCount = this.label(0, 36, '0 / 3', 21, '#ffe6a1');
    this.lockArt = this.add.container(0, 0, [lock, this.label(0, -this.cardH / 2 + 12, 'ТРИ КЛЮЧА', 11, '#ffe6a1'), this.lockCount]).setVisible(false).setDepth(420);
    this.world.add([this.jokerArt, this.jokerBadge, this.lockArt]);
    this.keyFlights = Array.from({ length: 3 }, () => { const key = this.add.text(0, 0, '⚿', { fontFamily: 'Arial', fontSize: '34px', color: '#ffe09a' }).setOrigin(.5).setDepth(590).setVisible(false); this.world.add(key); return key; });
    for (const card of Object.values(this.options.deal.cards)) this.views.set(card.id, this.makeCard(card.id));
    for (let i = 0; i < 36; i++) { const dot = (i % 3 ? this.add.star(0, 0, 4, 3, 9, i % 2 ? 0xffdd70 : 0xe6fbff) : this.add.circle(0, 0, 4, 0x82dfe9)).setDepth(510).setVisible(false); this.world.add(dot); this.particles.push(dot); }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.down(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.move(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.up(pointer));
    this.input.on('pointerupoutside', () => { if (this.press) this.cancel(); });
    const resize = () => { this.cancel(); this.sync([], false); };
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => { this.presentedDealId = undefined; this.scale.off('resize', resize); this.clearHint(); this.views.clear(); this.input.removeAllListeners(); });
    this.presentedDealId = this.options.deal.id;
    this.sync([], true);
    this.options.ready(this);
  }
  private label(x: number, y: number, text: string, size: number, color: string, maxHeight = Infinity) {
    const label = this.add.text(x, y, cardCaption(text, this.cardW < 125), { fontFamily: 'Arial', fontSize: `${size * Math.min(1, this.cardW / 125)}px`, fontStyle: 'bold', color, align: 'center', wordWrap: { width: this.cardW - 18 } }).setOrigin(.5, 0);
    label.setScale(Math.min(1, (this.cardW - 18) / Math.max(1, label.width), maxHeight / Math.max(1, label.height)));
    return label;
  }
  private makeCard(id: string): CardView {
    const card = this.options.deal.cards[id];
    const node = this.add.container(0, 0).setVisible(false);
    const face = this.add.container(0, 0), back = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x062c43, .32).fillRoundedRect(-this.cardW / 2, -this.cardH / 2 + 6, this.cardW, this.cardH, 14);
    g.fillStyle(card.leader ? 0xf1bb50 : 0x69bede).fillRoundedRect(-this.cardW / 2, -this.cardH / 2 + 2, this.cardW, this.cardH, 14);
    g.fillStyle(card.leader ? 0xffedb5 : 0xfffcf1).fillRoundedRect(-this.cardW / 2 + 2, -this.cardH / 2, this.cardW - 4, this.cardH - 4, 13);
    g.lineStyle(2, card.leader ? 0xffd16b : 0xb6e9f4).strokeRoundedRect(-this.cardW / 2 + 5, -this.cardH / 2 + 3, this.cardW - 10, this.cardH - 10, 10);
    if (card.leader) g.fillStyle(0xffce64).fillRoundedRect(-this.cardW / 2 + 7, -this.cardH / 2 + 7, this.cardW - 14, 27, 7);
    face.add(g);
    if (card.leader) {
      face.add(this.label(0, -this.cardH / 2 + 11, card.ordered ? 'ПО ПОРЯДКУ' : 'КАТЕГОРИЯ', 11, '#835415'));
      const titleY = -this.cardH / 2 + 41, countY = this.cardH / 2 - 32;
      face.add(this.label(0, titleY, card.text, card.text.length > 10 ? 20 : 24, '#40516a', countY - titleY - 10));
    } else if (card.image) {
      face.add(this.add.image(0, 0, id).setDisplaySize(Math.min(104, this.cardW - 20), Math.min(104, this.cardW - 20)));
    } else {
      face.add(this.label(0, -this.cardH / 2 + 19, card.text, card.text.length > 11 ? 19 : 23, '#36556f'));
      face.add(this.label(0, 20, '✦', 24, '#a9d5df'));
    }
    if (card.keyId) {
      const key = this.add.graphics().lineStyle(3, 0xb18b36).strokeCircle(this.cardW / 2 - 17, -this.cardH / 2 + 17, 5).lineBetween(this.cardW / 2 - 20, -this.cardH / 2 + 21, this.cardW / 2 - 31, -this.cardH / 2 + 32).lineBetween(this.cardW / 2 - 28, -this.cardH / 2 + 29, this.cardW / 2 - 24, -this.cardH / 2 + 33);
      face.add(key);
    }
    const badge = this.label(0, this.cardH / 2 - 32, '', 20, card.leader ? '#92611c' : '#40859c'); face.add(badge);
    const b = this.add.graphics();
    this.paintBack(b);
    back.add(b); node.add([face, back]); this.world.add(node);
    return { node, face, back, badge, backArt: b };
  }
  private paintBack(b: Phaser.GameObjects.Graphics) {
    const diamonds = this.options.getSave().settings.cardBack === 'diamonds';
    b.clear().fillStyle(0x003e2d, .25).fillRoundedRect(-this.cardW / 2, -this.cardH / 2 + 5, this.cardW, this.cardH, 13);
    b.fillStyle(0xf5edda).fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 13);
    b.fillStyle(diamonds ? 0x79617d : 0x579ac5).fillRoundedRect(-this.cardW / 2 + 5, -this.cardH / 2 + 5, this.cardW - 10, this.cardH - 10, 9);
    b.lineStyle(1.2, 0xa6cbdc, .5);
    for (let y = -60; y <= 60; y += 26) for (let x = -this.cardW / 2 + 23; x <= this.cardW / 2 - 17; x += 26) { if (diamonds) b.beginPath().moveTo(x, y - 8).lineTo(x + 6, y).lineTo(x, y + 8).lineTo(x - 6, y).closePath().strokePath(); else b.strokeCircle(x, y, 7); }
    b.lineStyle(2, 0xcce0e7, .65).strokeRoundedRect(-this.cardW / 2 + 12, -this.cardH / 2 + 12, this.cardW - 24, this.cardH - 24, 5);
  }
  public sync(events: GameEvent[] = [], entering = false, command?: BoardCommand): void {
    if (!this.world || this.presentedDealId !== this.options.getSave().attempt.dealId) return;
    const save = this.options.getSave(), board = save.attempt.board;
    const frame = boardFrame(this.scale.width, this.scale.height, save.settings.deckPosition, this.options.deal);
    this.unit = frame.unit; this.world.setScale(this.unit).setX(frame.offsetX);
    this.metrics = layout(board, this.options.deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
    if (this.backStyle !== (save.settings.cardBack ?? 'classic')) { this.backStyle = save.settings.cardBack ?? 'classic'; for (const view of this.views.values()) this.paintBack(view.backArt); }
    const duration = save.settings.reducedMotion ? 0 : 215;
    if (events.some(e => e.type === 'undo' || e.type === 'restart')) {
      for (const key of this.keyFlights) { this.tweens.killTweensOf(key); key.setVisible(false); }
      this.departing.clear();
      this.tweens.killTweensOf(this.rewardBanner); this.rewardBanner.setAlpha(0);
      this.tweens.killTweensOf(this.completionRing); this.completionRing.setVisible(false);
    }
    this.slots.clear().lineStyle(2, 0x7ab594, .35).fillStyle(0x023f2d, .25);
    for (const target of this.metrics.targets) {
      const { x, y } = target;
      this.slots.fillRoundedRect(x - this.cardW / 2, y - this.cardH / 2, this.cardW, this.cardH, 13);
      this.slots.strokeRoundedRect(x - this.cardW / 2, y - this.cardH / 2, this.cardW, this.cardH, 13);
      if (target.location.kind === 'foundation') {
        this.slots.lineStyle(2, 0x8bb895, .35).strokeCircle(x, y, 22);
        this.slots.lineStyle(2, 0x8bb895, .35).lineBetween(x - 8, y, x + 8, y).lineBetween(x, y - 8, x, y + 8);
      }
    }
    this.jokerArt.setVisible(Boolean(this.metrics.joker));
    this.jokerBadge.setVisible(Boolean(this.metrics.joker));
    if (this.metrics.joker) this.jokerBadge.setPosition(this.metrics.joker.x + this.cardW / 2 + 6, this.metrics.joker.y - this.cardH / 2 + 12);
    if (this.metrics.joker) this.jokerArt.setPosition(this.metrics.joker.x, this.metrics.joker.y).setDepth(this.metrics.joker.depth);
    const lockTarget = this.options.deal.lock && this.metrics.targets.find(t => t.location.kind === 'tableau' && t.location.index === this.options.deal.lock!.column);
    this.lockArt.setVisible(Boolean(lockTarget && isLocked(board, this.options.deal.lock!.column, this.options.deal)));
    if (lockTarget) { this.lockArt.setPosition(lockTarget.x, lockTarget.y); this.lockCount.setText(`${board.keys?.length ?? 0} / 3`); }
    for (const event of events.filter(e => e.type === 'key')) {
      const from = this.metrics.poses.find(p => event.cards?.includes(p.id)), flight = this.keyFlights.find(k => !k.visible);
      if (from && flight && lockTarget && !save.settings.reducedMotion) {
        flight.setPosition(from.x, from.y).setVisible(true).setAlpha(1);
        this.tweens.add({ targets: flight, x: lockTarget.x, y: lockTarget.y, alpha: .2, duration: 650, ease: 'Sine.easeInOut', onComplete: () => flight.setVisible(false) });
      }
    }
    if (events.some(e => e.type === 'unlock')) {
      this.showPraise('Замок открыт!');
    }
    const { stock } = this.metrics;
    const deckActive = Boolean(board.stock.length || board.waste.length);
    this.stockArt.setVisible(deckActive); this.stockCount.setVisible(deckActive); this.stockLabel.setVisible(deckActive);
    this.stockArt.clear().fillStyle(board.stock.length ? save.settings.cardBack === 'diamonds' ? 0x79617d : 0x61a8d2 : 0x164f3d).fillRoundedRect(stock.x - this.cardW / 2, stock.y - this.cardH / 2, this.cardW, this.cardH, 13);
    this.stockArt.lineStyle(3, board.stock.length ? 0xd9e6db : 0x669b7d).strokeRoundedRect(stock.x - this.cardW / 2 + 4, stock.y - this.cardH / 2 + 4, this.cardW - 8, this.cardH - 8, 10);
    if (board.stock.length) {
      this.stockArt.lineStyle(1.5, 0xc1e0e9, .45);
      for (let y = -52; y <= 52; y += 26) for (let x = -this.cardW / 2 + 27; x <= this.cardW / 2 - 20; x += 26) { if (save.settings.cardBack === 'diamonds') this.stockArt.beginPath().moveTo(stock.x + x, stock.y + y - 8).lineTo(stock.x + x + 6, stock.y + y).lineTo(stock.x + x, stock.y + y + 8).lineTo(stock.x + x - 6, stock.y + y).closePath().strokePath(); else this.stockArt.strokeCircle(stock.x + x, stock.y + y, 7); }
    }
    this.stockCount.setPosition(stock.x, stock.y).setText(board.stock.length ? String(board.stock.length) : board.waste.length ? '↻' : '·');
    this.stockLabel.setPosition(stock.x, stock.y - this.cardH / 2 - 13).setText(board.stock.length ? 'Колода' : board.waste.length ? 'Повторить' : 'Колода пуста');
    const visible = new Set(this.metrics.poses.map(p => p.id));
    const completed = events.find(e => e.type === 'complete');
    for (const [id, view] of this.views) {
      if (visible.has(id)) continue;
      // An unrelated save/sync must not cut short the collection animation.
      // Undo may restore these same nodes and will take ownership below.
      if (this.departing.has(id)) continue;
      this.tweens.killTweensOf(view.node);
      if (completed?.cards?.includes(id)) {
        const to = command?.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, command.to)) : undefined;
        this.departing.add(id);
        const leader = this.options.deal.cards[id].leader;
        if (leader) {
          const total = completed.cards!.filter(c => !this.options.deal.cards[c].leader).length;
          view.badge.setText(`${total} / ${total}`);
        }
        view.node.setVisible(true).setDepth(leader ? 524 : 520);
        this.tweens.add({ targets: view.node, x: to?.x ?? view.node.x, y: to?.y ?? view.node.y,
          scaleX: 1.06, scaleY: 1.06, angle: 0, alpha: 1, duration: save.settings.reducedMotion ? 0 : 160, ease: 'Cubic.easeOut', onComplete: () => {
            this.tweens.add({ targets: view.node, scaleX: .35, scaleY: .35, alpha: 0, delay: save.settings.reducedMotion ? 0 : 140,
              duration: save.settings.reducedMotion ? 0 : 210, ease: 'Back.easeIn', onComplete: () => { view.node.setVisible(false); this.departing.delete(id); } });
          } });
      } else view.node.setVisible(false);
    }
    for (const pose of this.metrics.poses) {
      const view = this.views.get(pose.id)!;
      this.departing.delete(pose.id);
      this.tweens.killTweensOf(view.node);
      const wasFace = view.face.visible;
      view.face.setVisible(pose.faceUp); view.back.setVisible(!pose.faceUp);
      const def = this.options.deal.cards[pose.id];
      const group = board.tableau.findIndex(col => col.includes(pose.id));
      const groupIds = group >= 0 ? packet(board, group, this.options.deal) : board.foundations.find(col => col.includes(pose.id)) ?? [];
      const total = Object.values(this.options.deal.cards).filter(c => c.category === def.category && !c.leader).length;
      view.badge.setText(def.leader ? `${groupIds.filter(id => !this.options.deal.cards[id].leader).length} / ${total}` : def.rank ? `${def.rank} / ${total}` : groupIds.length > 1 ? `×${groupIds.length}` : '');
      const fresh = entering && this.initial;
      if (fresh) view.node.setPosition(stock.x, stock.y).setAlpha(0).setAngle(-9).setScale(.82);
      view.node.setVisible(true).setDepth(pose.depth);
      if (!entering && pose.faceUp && !wasFace) {
        view.node.setScale(.05, 1);
        this.options.sound('flip');
      }
      const moving = events.some(e => e.type === 'transfer' && e.cards?.includes(pose.id)) || events.some(e => e.type === 'draw' && e.cards?.includes(pose.id));
      const animationOn = new URLSearchParams(location.search).get(moving ? 'fxCards' : 'fxLayout') !== '0';
      const covered = board.joker?.column === group && board.tableau[group].indexOf(pose.id) < board.joker.boundary;
      const moveDuration = entering && !fresh || !animationOn ? 0 : duration;
      // Zero-duration layout is synchronous: the first ready frame must already own its hit positions.
      if (!moveDuration) view.node.setPosition(pose.x, pose.y).setScale(1).setAlpha(covered ? .5 : 1).setAngle(0);
      else this.tweens.add({ targets: view.node, x: pose.x, y: pose.y, scaleX: 1, scaleY: 1, alpha: covered ? .5 : 1, angle: 0,
        duration: moveDuration, delay: fresh ? Math.min(400, pose.depth * 6) : 0, ease: 'Cubic.easeOut' });
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
    this.showPraise(['Отлично!', 'Есть связь!', 'Так держать!', 'Блестяще!'][this.praiseIndex++ % 4]);
    this.tweens.killTweensOf(this.completionRing);
    if (!reduced && new URLSearchParams(location.search).get('fxParticles') !== '0') {
      this.completionRing.setPosition(x, y).setScale(.4).setAlpha(.9).setVisible(true);
      this.tweens.add({ targets: this.completionRing, scaleX: 1.85, scaleY: 1.85, alpha: 0, delay: 160, duration: 440, onComplete: () => this.completionRing.setVisible(false) });
    }
    if (!reduced && new URLSearchParams(location.search).get('fxParticles') !== '0') for (let i = 0; i < 14; i++) {
      const dot = this.particles.find(p => !p.visible); if (!dot) break;
      const angle = i * Math.PI * 2 / 14;
      dot.setPosition(x, y).setAlpha(1).setScale(.45).setRotation(angle).setVisible(true);
      this.tweens.add({ targets: dot, x: x + Math.cos(angle) * (60 + i % 3 * 18), y: y + Math.sin(angle) * 65,
        scaleX: 1, scaleY: 1, angle: i % 2 ? 90 : -90, alpha: 0, delay: 170, duration: 540 + i % 3 * 50, ease: 'Cubic.easeOut', onComplete: () => dot.setVisible(false) });
    }
  }
  private showPraise(text: string) {
    this.tweens.killTweensOf(this.rewardBanner);
    this.praise.setText(text);
    this.praise.setScale(Math.min(1, 290 / this.praise.width));
    this.rewardBanner.setPosition(285, 245).setAlpha(1).setScale(.78);
    const reduced = this.options.getSave().settings.reducedMotion;
    this.tweens.add({ targets: this.rewardBanner, scaleX: 1, scaleY: 1, duration: reduced ? 0 : 230, ease: 'Back.easeOut', onComplete: () => {
      this.tweens.add({ targets: this.rewardBanner, alpha: 0, y: reduced ? 245 : 230, delay: reduced ? 180 : 380, duration: reduced ? 120 : 220 });
    } });
  }
  private point(pointer: Phaser.Input.Pointer) { return { x: (pointer.x - this.world.x) / this.unit, y: pointer.y / this.unit }; }
  private hitSource(x: number, y: number): Location | null {
    const board = this.options.getSave().attempt.board;
    for (const pose of [...this.metrics.poses].sort((a, b) => b.depth - a.depth)) {
      const view = this.views.get(pose.id)!;
      if (!pose.faceUp || !inside(x, y, { x: view.node.x, y: view.node.y, width: this.cardW, height: this.cardH })) continue;
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
    if (this.jokerSelecting) {
      const target = this.hitTarget(x, y);
      this.press = { pointerId: pointer.id, toggle: false, from: null, x, y, moved: false, stock: false, target: null, poses: [], jokerColumn: target?.location.kind === 'tableau' ? target.location.index : -1 }; return;
    }
    if (this.inspectMode) {
      const pose = [...this.metrics.poses].sort((a, b) => b.depth - a.depth).find(p => p.faceUp && inside(x, y, { x: this.views.get(p.id)!.node.x, y: this.views.get(p.id)!.node.y, width: this.cardW, height: this.cardH }));
      if (pose) this.options.inspect(pose.id);
      return;
    }
    if (board.phase !== 'playing') return;
    this.clearHint();
    const target = this.hitTarget(x, y);
    const chosenTarget = this.selected && target && !same(this.selected, target.location) ? target : null;
    const from = chosenTarget ? this.selected : source;
    const ids = from ? sourceCards(board, from, this.options.deal) : [];
    this.press = { pointerId: pointer.id, toggle: Boolean(source && this.selected && same(source, this.selected)), from, x, y, moved: false, stock: Boolean(board.stock.length || board.waste.length) && !chosenTarget && inside(x, y, { ...this.metrics.stock, width: this.cardW, height: this.cardH }),
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
    if (press.jokerColumn !== undefined) {
      const target = this.hitTarget(x, y);
      if (Math.hypot(x - press.x, y - press.y) < 11 && target?.location.kind === 'tableau' && target.location.index === press.jokerColumn) {
        this.jokerSelecting = false; this.options.jokerMode?.(false); this.options.command({ type: 'place-joker', column: press.jokerColumn });
      } else this.cancel();
      return;
    }
    if (press.stock) {
      if (inside(x, y, { ...this.metrics.stock, width: this.cardW, height: this.cardH }) && Math.hypot(x - press.x, y - press.y) < 11) {
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
    if (this.jokerSelecting) for (const t of this.metrics.targets.filter(t => t.location.kind === 'tableau' && this.options.getSave().attempt.board.tableau[t.location.index].length && !isLocked(this.options.getSave().attempt.board, t.location.index, this.options.deal))) this.focus.lineStyle(3, 0xffdf7b, .9).strokeRoundedRect(t.x - this.cardW / 2 - 3, t.y - this.cardH / 2 - 3, this.cardW + 6, this.cardH + 6, 14);
    if (this.selected) for (const id of sourceCards(this.options.getSave().attempt.board, this.selected, this.options.deal)) {
      const view = this.views.get(id)!;
      this.focus.lineStyle(3, 0xffe5a3, .95).strokeRoundedRect(view.node.x - this.cardW / 2 - 2, view.node.y - this.cardH / 2 - 2, this.cardW + 4, this.cardH + 4, 14);
    }
    if (hover && this.selected) {
      const valid = typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from: this.selected, to: hover.location }, this.options.deal) !== 'string';
      this.focus.lineStyle(4, valid ? 0xffdf7b : 0xd5aa8d, .95).strokeRoundedRect(hover.x - this.cardW / 2 - 5, hover.y - this.cardH / 2 - 5, this.cardW + 10, this.cardH + 10, 15);
    }
  }
  public setJoker(active: boolean): void { this.cancel(); this.jokerSelecting = active; this.options.jokerMode?.(active); this.drawFocus(); this.game.loop.wake(); }
  public cancel(): void { this.jokerSelecting = false; this.options.jokerMode?.(false); this.press = null; this.selected = null; if (this.world) this.sync([], false); }
  public back(): boolean { if (!this.jokerSelecting && !this.press && !this.selected && !this.hintObjects.length) return false; this.clearHint(); this.cancel(); return true; }
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
      .fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 13).strokeRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 13)
      .setPosition(from.x, from.y).setDepth(700);
    this.world.add(ghost); this.world.sort('depth'); this.hintObjects.push(ghost);
    this.hintTweens.push(this.tweens.add({ targets: ghost, x: target.x, y: target.y, alpha: .25, duration: 750, hold: 180, repeat: 1,
      onRepeat: () => ghost.setPosition(from.x, from.y).setAlpha(1), onComplete: () => this.clearHint() }));
  }
  public hasMotion(): boolean { return this.tweens.getTweens().length > 0 || Boolean(this.press?.moved); }
  public geometry() { return this.metrics; }
}
