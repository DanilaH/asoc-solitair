import Phaser from 'phaser';
import { installSceneTextSharpness } from '@danilah/mini-games-kit/phaser';
import { cardCaption, categoryCaption } from './captions';
import { applyBoard, isLocked, packet, sourceCards } from '../domain/engine';
import type { BoardCommand, Command, Deal, GameEvent, Location, Save } from '../domain/types';
import { WIDTH, boardFrame, cardMetrics, dragTarget, dropTarget, layout } from './layout';
import { UI_ART, artUrl, cardArtwork } from './art';
import type { Pose, Target } from './layout';

interface CardView { node: Phaser.GameObjects.Container; face: Phaser.GameObjects.Container; back: Phaser.GameObjects.Container; badge: Phaser.GameObjects.Text; content: Phaser.GameObjects.Container; caption?: Phaser.GameObjects.Text; strip?: Phaser.GameObjects.Text | Phaser.GameObjects.Image; stripText?: string; stripScale?: number; backArt: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Graphics }
interface Options {
  deal: Deal; getSave(): Save; command(command: Command): void; sound(name: string): void;
  praise(text: string): void; jokerMode?(active: boolean): void; inspect(id: string): void; ready(scene: BoardScene): void;
  inputRoot?(): HTMLElement; boardBounds?(): { x: number; y: number; width: number; height: number };
  readerZone?(): DOMRect; peek?(id: string | null): void;
}
interface BoardPointer { id: number; x: number; y: number; primaryDown: boolean; isDown: boolean }
const inside = (x: number, y: number, target: { x: number; y: number; width: number; height: number }) =>
  Math.abs(x - target.x) <= target.width / 2 && Math.abs(y - target.y) <= target.height / 2;
const same = (a: Location, b: Location) => a.kind === b.kind && a.index === b.index;

/** The model is already committed before any visual transition begins. */
export class BoardScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container;
  private slots!: Phaser.GameObjects.Graphics;
  private foundationArt!: Phaser.GameObjects.Graphics;
  private foundationTitles: Phaser.GameObjects.Text[] = [];
  private focus!: Phaser.GameObjects.Graphics;
  private stockArt!: Phaser.GameObjects.Image;
  private stockLayers: Phaser.GameObjects.Image[] = [];
  private stockBusyUntil = 0;
  private stockCount!: Phaser.GameObjects.Text;
  private stockLabel!: Phaser.GameObjects.Text;
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
  private keyFlights: Phaser.GameObjects.Image[] = [];
  private completionRibbon!: Phaser.GameObjects.Image;
  private selected: Location | null = null;
  private press: { pointerId: number; toggle: boolean; from: Location | null; x: number; y: number; moved: boolean; stock: boolean; target: Target | null; poses: Pose[]; inspectId?: string; liftedAt?: number; jokerColumn?: number } | null = null;
  private dragPointer: BoardPointer | undefined;
  private unit = 1;
  private frameKey = '';
  private frameIdentity() { const b = this.options.boardBounds?.() ?? { x: 0, y: 0, width: this.scale.width, height: this.scale.height }; return [this.scale.width, this.scale.height, this.scale.zoom, b.x, b.y, b.width, b.height].join(':'); }
  private enabled = true;
  private initial = true;
  private hintObjects: Phaser.GameObjects.GameObject[] = [];
  private hintTweens: Phaser.Tweens.Tween[] = [];
  private inspectMode = false;
  private backStyle = '';
  private particles: Phaser.GameObjects.Image[] = [];
  private cues: Phaser.GameObjects.Graphics[] = [];
  private dragCount!: Phaser.GameObjects.Text;
  private presentedDealId: string | undefined;
  public constructor(private readonly options: Options) { super('board'); }
  private get cardW() { return cardMetrics(this.options.deal).width; }
  private get cardH() { return cardMetrics(this.options.deal).height; }
  public setDeal(deal: Deal) { this.enabled = false; this.presentedDealId = undefined; this.options.deal = deal; this.scene.restart(); this.game.loop.wake(); }
  public preload(): void {
    if (!this.textures.exists('tutorial-hand')) this.load.image('tutorial-hand', 'art/ui/tutorial-hand.webp');
    for (const name of UI_ART) if (!this.textures.exists('art-' + name)) this.load.image('art-' + name, artUrl(name));
    for (const card of Object.values(this.options.deal.cards)) { const image = cardArtwork(card, this.options.deal); if (image && !this.textures.exists(image)) this.load.image(image, image); }
  }
  public create(): void {
    this.jokerSelecting = false; this.options.jokerMode?.(false); this.selected = null; this.press = null; this.dragPointer = undefined; this.initial = true; this.inspectMode = false; this.particles = []; this.departing.clear(); this.hintObjects = []; this.hintTweens = []; this.stockBusyUntil = 0;
    installSceneTextSharpness(this);
    this.world = this.add.container(0, 0);
    this.cues = [];
    this.dragCount = this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '20px', fontStyle: 'bold', color: '#4d4269', backgroundColor: '#fff0c9', padding: { x: 6, y: 3 } }).setDepth(750).setVisible(false);
    this.world.add(this.dragCount);
    this.slots = this.add.graphics(); this.stockArt = this.add.image(0, 0, 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH); this.focus = this.add.graphics().setDepth(450);
    this.stockLayers = Array.from({ length: 5 }, () => this.add.image(0, 0, 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH).setTint(0xe4e1e7));
    this.stockCount = this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(38);
    this.stockLabel = this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '17px', color: '#b0d7bf' }).setOrigin(.5).setDepth(38);
    this.completionRing = this.add.circle(0, 0, 40).setStrokeStyle(7, 0xffdd70).setDepth(505).setVisible(false);
    this.world.add([this.slots, ...this.stockLayers, this.stockArt, this.focus, this.stockCount, this.stockLabel, this.completionRing]);
    this.foundationArt = this.add.graphics().setDepth(200);
    this.foundationTitles = this.options.getSave().attempt.board.foundations.map(() => this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '18px', fontStyle: 'bold', color: '#886347' }).setOrigin(.5).setDepth(201));
    this.world.add([this.foundationArt, ...this.foundationTitles]);
    const gold = this.add.image(0, 0, 'art-card-category').setDisplaySize(this.cardW, this.cardH);
    this.jokerArt = this.add.container(0, 0, [gold, this.label(0, -this.cardH / 2 + 12, 'ДЖОКЕР', 16, '#705328'), this.add.image(0, 5, 'art-joker').setDisplaySize(78, 78)]).setVisible(false);
    this.jokerBadge = this.add.container(0, 0, [this.add.circle(0, 0, 11, 0xf1cc73).setStrokeStyle(1, 0xffecc0), this.add.text(0, 0, '✦', { fontFamily: 'Nunito, Arial', fontSize: '15px', color: '#715321' }).setOrigin(.5)]).setDepth(425).setVisible(false);
    const lock = this.add.image(0, 0, 'art-card-back-diamonds').setDisplaySize(this.cardW, this.cardH).setTint(0x9198b9);
    this.lockCount = this.label(0, 36, '0 / 3', 21, '#ffe6a1');
    this.lockArt = this.add.container(0, 0, [lock, this.add.image(0, -8, 'art-lock').setDisplaySize(66, 66), this.label(0, -this.cardH / 2 + 12, 'ТРИ КЛЮЧА', 11, '#fff0cf'), this.lockCount]).setVisible(false).setDepth(420);
    this.world.add([this.jokerArt, this.jokerBadge, this.lockArt]);
    this.keyFlights = Array.from({ length: 3 }, () => { const key = this.add.image(0, 0, 'art-key').setDisplaySize(40, 40).setDepth(590).setVisible(false); this.world.add(key); return key; });
    for (const card of Object.values(this.options.deal.cards)) this.views.set(card.id, this.makeCard(card.id));
    for (let i = 0; i < 24; i++) { const dot = this.add.image(0, 0, 'art-spark').setDisplaySize(i % 3 ? 15 : 10, i % 3 ? 15 : 10).setDepth(510).setVisible(false); this.world.add(dot); this.particles.push(dot); }
    this.completionRibbon = this.add.image(0, 0, 'art-ribbon').setDisplaySize(this.cardW * .94, 38).setDepth(530).setVisible(false); this.world.add(this.completionRibbon);
    // Capture one native pointer from the board. Movement and release belong to
    // the viewport, including header/dock and the old canvas edges.
    const input = this.options.inputRoot?.() ?? this.game.canvas, controller = new AbortController();
    const pointer = (event: PointerEvent): BoardPointer => ({ id: event.pointerId, x: event.clientX / this.scale.zoom, y: event.clientY / this.scale.zoom, primaryDown: event.isPrimary && event.button === 0, isDown: event.buttons !== 0 });
    const localPointer = (event: PointerEvent) => {
      const p = pointer(event), rect = this.game.canvas.getBoundingClientRect();
      p.x -= rect.left / this.scale.zoom; p.y -= rect.top / this.scale.zoom; return p;
    };
    input.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !this.enabled) return;
      event.preventDefault(); this.game.loop.wake(); this.down(localPointer(event));
      if (this.press) input.setPointerCapture(event.pointerId);
    }, { signal: controller.signal });
    window.addEventListener('pointermove', event => { if (this.press?.pointerId !== event.pointerId) return; event.preventDefault(); this.game.loop.wake(); this.move(localPointer(event)); }, { signal: controller.signal, passive: false });
    window.addEventListener('pointerup', event => { if (this.press?.pointerId !== event.pointerId) return; this.game.loop.wake(); this.up(localPointer(event)); }, { signal: controller.signal });
    const cancel = (event: PointerEvent) => { if (this.press?.pointerId === event.pointerId) this.cancel(); };
    window.addEventListener('pointercancel', cancel, { signal: controller.signal });
    input.addEventListener('lostpointercapture', cancel, { signal: controller.signal });
    const resize = () => { if (this.frameKey === this.frameIdentity()) return; this.clearHint(); this.clearFeedback(); this.cancel(); this.sync([], false); };
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => { controller.abort(); this.options.peek?.(null); this.presentedDealId = undefined; this.scale.off('resize', resize); this.clearHint(); this.views.clear(); this.input.removeAllListeners(); });
    this.presentedDealId = this.options.deal.id;
    this.sync([], true);
    this.options.ready(this);
  }
  private label(x: number, y: number, text: string, size: number, color: string, maxHeight = Infinity) {
    const label = this.add.text(x, y, cardCaption(text, this.cardW < 125 && text.length > 10), { fontFamily: 'Nunito, Arial', fontSize: `${size * Math.min(1, this.cardW / 125)}px`, fontStyle: 'bold', color, align: 'center', wordWrap: { width: this.cardW - 18 } }).setOrigin(.5, 0);
    label.setScale(Math.min(1, (this.cardW - 18) / Math.max(1, label.width), maxHeight / Math.max(1, label.height)));
    return label;
  }
  private makeCard(id: string): CardView {
    const card = this.options.deal.cards[id];
    const node = this.add.container(0, 0).setVisible(false);
    const face = this.add.container(0, 0), back = this.add.container(0, 0);
    const shadow = this.add.graphics().fillStyle(0x082c3c, .22).fillRoundedRect(-this.cardW / 2 + 3, -this.cardH / 2 + 5, this.cardW - 6, this.cardH - 1, 14);
    const g = this.add.image(0, 0, card.leader ? 'art-card-category' : 'art-card-face').setDisplaySize(this.cardW, this.cardH);
    const content = this.add.container(0, 0); face.add([g, content]);
    let caption: Phaser.GameObjects.Text | undefined, strip: Phaser.GameObjects.Text | Phaser.GameObjects.Image | undefined;
    const image = cardArtwork(card, this.options.deal);
    if (card.leader) {
      if (card.ordered) content.add(this.label(0, -this.cardH / 2 + 11, 'ПО ПОРЯДКУ', 11, '#b2916e'));
      else {
        const x = -this.cardW / 2 + 12, y = -this.cardH / 2 + 12;
        const crown = this.add.graphics(); content.add(crown);
        crown.fillStyle(0xd0a16b).beginPath().moveTo(x, y).lineTo(x + 5, y + 7).lineTo(x + 9, y - 2).lineTo(x + 13, y + 7).lineTo(x + 18, y).lineTo(x + 16, y + 15).lineTo(x + 2, y + 15).closePath().fillPath();
      }
      caption = this.add.text(0, 0, categoryCaption(card.text), { fontFamily: 'Nunito, Arial', fontSize: '24px', fontStyle: 'bold', color: '#294d5d', align: 'center' }).setOrigin(.5);
      caption.setScale(Math.max(.74, Math.min(1, (this.cardW - 18) / caption.width))); content.add(caption);
      strip = this.add.text(0, -this.cardH / 2 + 9, categoryCaption(card.text), { fontFamily: 'Nunito, Arial', fontSize: '16px', color: '#8c7257', fontStyle: 'bold' }).setOrigin(.5, 0);
      strip.setScale(Math.min(1, (this.cardW - 18) / strip.width)); face.add(strip); strip.setVisible(false);
    } else if (image) {
      content.add(this.add.image(0, 0, image).setDisplaySize(Math.min(104, this.cardW - 22), Math.min(104, this.cardW - 22)));
      strip = this.add.image(0, -this.cardH / 2 + 11, image).setDisplaySize(18, 18); face.add(strip); strip.setVisible(false);
    } else {
      caption = this.label(0, 0, card.text, card.text.length > 11 ? 23 : 26, '#294d5d', this.cardH - 72); caption.setOrigin(.5); content.add(caption);
      strip = this.add.text(0, -this.cardH / 2 + 7, card.text.length > 12 ? card.text.slice(0, 11) + '…' : card.text, { fontFamily: 'Nunito, Arial', fontSize: '16px', fontStyle: 'bold', color: '#79909c' }).setOrigin(.5, 0);
      strip.setScale(Math.min(1, (this.cardW - 14) / strip.width)); face.add(strip); strip.setVisible(false);
    }
    if (card.keyId) {
      const key = this.add.image(this.cardW / 2 - 23, -this.cardH / 2 + 23, 'art-key').setDisplaySize(30, 30);
      content.add(key);
    }
    const badge = this.label(0, card.leader && !card.ordered ? -this.cardH / 2 + 13 : this.cardH / 2 - 30, '', 17, card.leader ? '#a17e5d' : '#a9815f'); content.add(badge);
    const b = this.add.image(0, 0, 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH);
    this.paintBack(b);
    back.add(b); node.add([shadow, face, back]); this.world.add(node);
    return { node, face, back, badge, content, caption, strip, stripText: strip instanceof Phaser.GameObjects.Text ? strip.text : undefined, stripScale: strip?.scaleX, backArt: b, shadow };
  }
  private paintBack(b: Phaser.GameObjects.Image) {
    const diamonds = this.options.getSave().settings.cardBack === 'diamonds';
    b.setTexture(diamonds ? 'art-card-back-diamonds' : 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH);
  }
  public sync(events: GameEvent[] = [], entering = false, command?: BoardCommand): void {
    if (!this.world || this.presentedDealId !== this.options.getSave().attempt.dealId) return;
    const save = this.options.getSave(), board = save.attempt.board;
    const previous = this.metrics;
    const drawUnder = command?.type === 'draw' && !save.settings.reducedMotion ? board.waste.at(-2) : undefined;
    const bounds = this.options.boardBounds?.() ?? { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    this.frameKey = this.frameIdentity();
    const frame = boardFrame(bounds.width, bounds.height, save.settings.deckPosition, this.options.deal);
    this.unit = frame.unit; this.world.setScale(this.unit).setPosition(bounds.x + frame.offsetX, bounds.y);
    this.metrics = layout(board, this.options.deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
    if (this.backStyle !== (save.settings.cardBack ?? 'classic')) { this.backStyle = save.settings.cardBack ?? 'classic'; for (const view of this.views.values()) this.paintBack(view.backArt); }
    const duration = save.settings.reducedMotion ? 0 : 215;
    if (events.some(e => e.type === 'undo' || e.type === 'restart')) {
      for (const key of this.keyFlights) { this.tweens.killTweensOf(key); key.setVisible(false); }
      this.departing.clear();
      this.options.praise('');
      this.clearFeedback();
    }
    this.slots.clear();
    for (const target of this.metrics.targets) {
      const { x, y } = target;
      const empty = target.location.kind === 'foundation' ? !board.foundations[target.location.index].length : !board.tableau[target.location.index].length;
      if (!empty) continue;
      const w = this.cardW - 4, h = this.cardH - 4, left = x - w / 2, top = y - h / 2;
      // A recessed card silhouette; only genuine empty destinations retain it.
      this.slots.fillStyle(0x083c48, .5).fillRoundedRect(left, top + 3, w, h, 17);
      this.slots.fillStyle(0x2d7a80, .7).fillRoundedRect(left, top, w, h - 3, 17);
      this.slots.lineStyle(2, 0xa6d4ca, .58).strokeRoundedRect(left + 1, top + 1, w - 2, h - 4, 16);
      this.slots.lineStyle(1, 0x124c59, .65).strokeRoundedRect(left + 6, top + 6, w - 12, h - 14, 12);
    }
    this.jokerArt.setVisible(Boolean(this.metrics.joker));
    this.jokerBadge.setVisible(Boolean(this.metrics.joker));
    if (this.metrics.joker) this.jokerBadge.setPosition(this.metrics.joker.x + this.cardW / 2 - 12, this.metrics.joker.y - this.cardH / 2 + 12);
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
    this.stockArt.setPosition(stock.x, stock.y); this.paintBack(this.stockArt);
    this.stockArt.setVisible(deckActive && Boolean(board.stock.length));
    const thickness = stock.thickness;
    this.stockLayers.forEach((layer, i) => {
      this.paintBack(layer);
      layer.setDepth(2 + i).setVisible(board.stock.length > i + 1).setPosition(stock.x, stock.y + thickness * (this.stockLayers.length - i) / this.stockLayers.length);
    });
    this.stockArt.setDepth(8);
    if (deckActive && !board.stock.length) this.slots.fillStyle(0xd2e8db, .08).fillCircle(stock.x, stock.y, 35);
    this.stockCount.setPosition(board.stock.length ? stock.x + this.cardW / 2 - 17 : stock.x, board.stock.length ? stock.y - this.cardH / 2 + 20 : stock.y).setFontSize(board.stock.length ? 20 : 42).setText(board.stock.length ? String(board.stock.length) : board.waste.length ? '↻' : '');
    this.stockLabel.setText('');
    this.foundationArt.clear();
    board.foundations.forEach((ids, i) => {
      const target = this.metrics.targets.find(t => t.location.kind === 'foundation' && t.location.index === i)!;
      const leader = ids.map(id => this.options.deal.cards[id]).find(card => card.leader), title = this.foundationTitles[i];
      title.setVisible(Boolean(leader)); if (!leader) return;
      const { x, y } = target, total = Object.values(this.options.deal.cards).filter(card => card.category === leader.category && !card.leader).length, count = ids.length - 1;
      this.foundationArt.fillStyle(0xedbb8d).fillRoundedRect(x - this.cardW / 2 + 5, y - this.cardH / 2 - 26, this.cardW - 10, 29, 7);
      title.setText(categoryCaption(leader.text)).setPosition(x, y - this.cardH / 2 - 12).setScale(1);
      title.setScale(Math.min(1, (this.cardW - 18) / Math.max(1, title.width)));
      for (let dot = 0; dot < total; dot++) {
        const px = x + (dot - (total - 1) / 2) * Math.min(11, (this.cardW - 30) / Math.max(1, total));
        this.foundationArt.fillStyle(dot < count ? 0x218e95 : 0xe7ece4).fillCircle(px, y + this.cardH / 2 - 22, 3.6).lineStyle(1, 0x7b9ca5).strokeCircle(px, y + this.cardH / 2 - 22, 3.6);
      }
    });
    const foundationTops = board.foundations.filter(ids => ids.length).map(ids => ids.filter(id => !this.options.deal.cards[id].leader).at(-1) ?? ids.at(-1)!);
    const visible = new Set(this.metrics.poses.filter(p => !board.foundations.some(ids => ids.includes(p.id)) || foundationTops.includes(p.id)).map(p => p.id));
    const completed = events.find(e => e.type === 'complete');
    const recycled = command?.type === 'recycle' && previous && !save.settings.reducedMotion;
    if (command?.type === 'draw' || command?.type === 'recycle') this.stockBusyUntil = performance.now() + (save.settings.reducedMotion ? 0 : command.type === 'draw' ? 280 : 370);
    for (const [id, view] of this.views) {
      if (visible.has(id)) continue;
      // An unrelated save/sync must not cut short the collection animation.
      // Undo may restore these same nodes and will take ownership below.
      if (this.departing.has(id)) continue;
      this.tweens.killTweensOf(view.node);
      if (recycled && board.stock.includes(id)) {
        const old = previous.poses.find(p => p.id === id) ?? previous.waste;
        const index = board.stock.length - 1 - board.stock.indexOf(id), delay = index * Math.min(16, 120 / Math.max(1, board.stock.length - 1));
        view.node.setPosition(old.x, old.y).setDepth(100 + index).setScale(1).setAngle(0).setAlpha(1).setVisible(true);
        view.face.setVisible(true); view.back.setVisible(false); view.content.setVisible(true); view.strip?.setVisible(false);
        this.tweens.add({ targets: view.node, x: stock.x, y: stock.y, duration: 240, delay, ease: 'Sine.easeInOut',
          onUpdate: tween => { const t = tween.progress; view.node.setScale(Math.max(.045, Math.abs(1 - t * 2)), 1); view.face.setVisible(t < .5); view.back.setVisible(t >= .5); },
          onComplete: () => view.node.setVisible(false).setScale(1) });
      } else if (completed?.cards?.includes(id) && (view.node.visible || this.options.deal.cards[id].leader)) {
        const to = command?.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, command.to)) : undefined;
        this.departing.add(id);
        const leader = this.options.deal.cards[id].leader;
        if (leader) {
          const total = completed.cards!.filter(c => !this.options.deal.cards[c].leader).length;
          view.face.setVisible(true); view.back.setVisible(false); view.content.setVisible(true); view.caption?.setVisible(true); view.strip?.setVisible(false);
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
      if (!visible.has(pose.id)) continue;
      const view = this.views.get(pose.id)!;
      view.shadow.setPosition(0, 0).setScale(1);
      this.departing.delete(pose.id);
      this.tweens.killTweensOf(view.node);
      const wasFace = view.face.visible;
      view.face.setVisible(pose.faceUp); view.back.setVisible(!pose.faceUp);
      const def = this.options.deal.cards[pose.id];
      const group = board.tableau.findIndex(col => col.includes(pose.id));
      const groupIds = group >= 0 ? packet(board, group, this.options.deal) : board.foundations.find(col => col.includes(pose.id)) ?? [];
      const total = Object.values(this.options.deal.cards).filter(c => c.category === def.category && !c.leader).length;
      view.badge.setText(def.leader ? `${groupIds.filter(id => !this.options.deal.cards[id].leader).length} / ${total}` : def.rank ? `${def.rank} / ${total}` : groupIds.length > 1 ? `×${groupIds.length}` : '');
      const foundation = board.foundations.some(ids => ids.includes(pose.id));
      if (foundation) {
        view.badge.setText(def.ordered || def.rank ? view.badge.text : '');
        view.badge.setY(-this.cardH / 2 + 13);
      } else view.badge.setY(def.leader && !def.ordered ? -this.cardH / 2 + 13 : this.cardH / 2 - 30);
      const column = group >= 0 ? board.tableau[group] : [], nextId = column[column.indexOf(pose.id) + 1];
      const next = group >= 0 && nextId ? this.metrics.poses.find(p => p.id === nextId) : undefined;
      const support = this.metrics.joker;
      const supportBelow = support && support.x === pose.x && support.depth > pose.depth && (!next || support.depth < next.depth);
      const rearWaste = board.waste.includes(pose.id) && board.waste.at(-1) !== pose.id;
      const band = rearWaste ? 22 : group < 0 ? this.cardH : Math.min(next ? next.y - pose.y : this.cardH, supportBelow ? support!.y - pose.y : this.cardH);
      const coveredCaption = band < this.cardH - 1;
      if (view.strip instanceof Phaser.GameObjects.Text) {
        view.strip.setFontSize(16).setText(rearWaste ? def.leader ? categoryCaption(def.text) : def.text : view.stripText!).setOrigin(.5, rearWaste ? .5 : 0);
        if (rearWaste) {
          view.strip.setScale(Math.min(1, (this.cardH - 24) / Math.max(1, view.strip.width), 18 / Math.max(1, view.strip.height)));
          view.strip.setAngle(save.settings.deckSide === 'left' ? -90 : 90).setPosition((save.settings.deckSide === 'left' ? -1 : 1) * (this.cardW / 2 - 11), 0);
        } else view.strip.setAngle(0).setPosition(0, -this.cardH / 2 + 7).setScale(view.stripScale ?? 1);
      } else if (view.strip) view.strip.setPosition(rearWaste ? (save.settings.deckSide === 'left' ? -1 : 1) * (this.cardW / 2 - 11) : 0, rearWaste ? 0 : -this.cardH / 2 + 11);
      const waitingForCover = pose.id === drawUnder;
      view.content.setVisible(!coveredCaption || waitingForCover); view.caption?.setVisible(!coveredCaption || waitingForCover);
      view.strip?.setVisible(coveredCaption && !waitingForCover && pose.faceUp && band >= view.strip.height * view.strip.scaleY + (rearWaste ? 3 : 10));
      const fresh = entering && this.initial;
      if (fresh) view.node.setPosition(stock.x, stock.y).setAlpha(0).setAngle(-9).setScale(.82);
      view.node.setVisible(true).setDepth(pose.depth);
      const drawn = events.some(e => e.type === 'draw' && e.cards?.includes(pose.id));
      if (drawn && !save.settings.reducedMotion) {
        const from = previous?.stock ?? stock;
        view.node.setPosition(from.x, from.y).setScale(1).setAlpha(1).setAngle(0).setDepth(120);
        view.face.setVisible(false); view.back.setVisible(true);
        this.tweens.add({ targets: view.node, x: pose.x, y: pose.y, duration: 270, ease: 'Sine.easeInOut',
          onUpdate: tween => { const t = tween.progress; view.node.setScale(Math.max(.045, Math.abs(1 - t * 2)), 1); view.face.setVisible(t >= .5); view.back.setVisible(t < .5); },
          onComplete: () => {
            view.node.setScale(1).setDepth(pose.depth); this.world.sort('depth');
            // The card beneath keeps its face until the arriving card covers it.
            if(drawUnder && this.options.getSave().attempt.board.waste.at(-1)===pose.id && !this.press?.poses.some(p=>p.id===drawUnder)) {
              const under=this.views.get(drawUnder);under?.content.setVisible(false);under?.caption?.setVisible(false);under?.strip?.setVisible(true);
            }
          } });
        continue;
      }
      if (!entering && pose.faceUp && !wasFace) {
        view.node.setScale(.05, 1);
        this.options.sound('flip');
      }
      const moving = events.some(e => e.type === 'transfer' && e.cards?.includes(pose.id)) || events.some(e => e.type === 'draw' && e.cards?.includes(pose.id));
      const animationOn = new URLSearchParams(location.search).get(moving ? 'fxCards' : 'fxLayout') !== '0';
      const covered = board.joker?.column === group && board.tableau[group].indexOf(pose.id) < board.joker.boundary;
      const moveDuration = entering && !fresh || !animationOn ? 0 : moving && command?.type === 'transfer' && duration ? 170 : duration;
      // Zero-duration layout is synchronous: the first ready frame must already own its hit positions.
      if (!moveDuration) view.node.setPosition(pose.x, pose.y).setScale(1).setAlpha(covered ? .5 : 1).setAngle(0);
      else this.tweens.add({ targets: view.node, x: pose.x, y: pose.y, scaleX: 1, scaleY: 1, alpha: covered ? .5 : 1, angle: 0,
        duration: moveDuration, delay: fresh ? Math.min(400, pose.depth * 6) : 0, ease: 'Cubic.easeOut', onComplete: () => {
          if (moving && !this.press && view.node.visible && !save.settings.reducedMotion) this.tweens.add({ targets: view.node, scaleX: 1.02, scaleY: 1.02, duration: 65, yoyo: true });
        } });
    }
    this.initial = false;
    this.world.sort('depth');
    this.drawFocus();
    if (completed) this.celebrate(command);
    else if (command?.type === 'transfer' && events.some(e => e.type === 'transfer')) {
      const target = this.metrics.targets.find(t => same(t.location, command.to));
      if (target) this.cue(target.x, target.y, 0xffd990);
    }
    if (previous && events.some(e => e.type === 'undo')) for (const pose of this.metrics.poses.filter(p => p.faceUp && visible.has(p.id) && !previous.poses.some(old => old.id === p.id && old.x === p.x && old.y === p.y && old.faceUp === p.faceUp)).slice(-3)) this.cue(pose.x, pose.y, 0xc3b3ec);
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
      // The accent stays local to the completed slot, leaving nearby words readable.
      this.completionRing.setPosition(x, y).setScale(.3).setAlpha(.65).setVisible(true);
      this.tweens.add({ targets: this.completionRing, scaleX: .95, scaleY: 1.1, alpha: 0, delay: 130, duration: 340, onComplete: () => this.completionRing.setVisible(false) });
      this.tweens.killTweensOf(this.completionRibbon);
      this.completionRibbon.setPosition(x, y + this.cardH * .22).setDisplaySize(this.cardW * .86, 38).setAlpha(0).setVisible(true);
      this.tweens.add({ targets: this.completionRibbon, y: y + this.cardH * .14, alpha: .95, delay: 140, duration: 100, yoyo: true, hold: 110, onComplete: () => this.completionRibbon.setVisible(false) });
    }
    if (!reduced && new URLSearchParams(location.search).get('fxParticles') !== '0') for (let i = 0; i < 10; i++) {
      const dot = this.particles.find(p => !p.visible); if (!dot) break;
      const angle = i * Math.PI * 2 / 10, radius = this.cardW * .4;
      dot.setPosition(x + Math.cos(angle) * radius * .55, y + Math.sin(angle) * 40).setAlpha(1).setDisplaySize(12 + i % 3 * 3, 12 + i % 3 * 3).setRotation(angle).setVisible(true);
      this.tweens.add({ targets: dot, x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * 64,
        scaleX: dot.scaleX * .3, scaleY: dot.scaleY * .3, angle: i % 2 ? 65 : -65, alpha: 0, delay: 170, duration: 360 + i % 3 * 45, ease: 'Cubic.easeOut', onComplete: () => dot.setVisible(false) });
    }
  }
  /** Decorative work has no domain ownership and must not outlive its screen. */
  public clearFeedback(): void {
    this.cues.forEach(c => { this.tweens.killTweensOf(c); c.destroy(); }); this.cues = [];
    for (const object of [this.completionRing, this.completionRibbon, ...this.particles, ...this.keyFlights]) {
      if (!object) continue;
      this.tweens.killTweensOf(object); object.setVisible(false);
    }
  }
  private showPraise(text: string) { this.options.praise(text); }
  private point(pointer: BoardPointer) { return { x: (pointer.x - this.world.x) / this.unit, y: (pointer.y - this.world.y) / this.unit }; }
  private get cssUnit() { return this.unit * this.scale.zoom; }
  private cue(x: number, y: number, color: number, shake = false) {
    while (this.cues.length >= 4) { const old = this.cues.shift()!; this.tweens.killTweensOf(old); old.destroy(); }
    const cue = this.add.graphics().lineStyle(4, color, .95).strokeRoundedRect(-this.cardW / 2 + 2, -this.cardH / 2 + 2, this.cardW - 4, this.cardH - 4, 13).setPosition(x, y).setDepth(690);
    this.world.add(cue); this.world.sort('depth'); this.cues.push(cue);
    if (shake && !this.options.getSave().settings.reducedMotion) this.tweens.add({ targets: cue, x: x + 5, duration: 45, yoyo: true, repeat: 2 });
    this.tweens.add({ targets: cue, alpha: 0, delay: 160, duration: 220, onComplete: () => { this.cues = this.cues.filter(c => c !== cue); cue.destroy(); } });
    this.game.loop.wake();
  }
  public reject(command?: BoardCommand, point?: { x: number; y: number }) {
    const target = command?.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, command.to)) : point;
    if (target) this.cue(target.x, target.y, 0xe9a08a, true);
  }
  private hitSource(x: number, y: number): Location | null {
    const board = this.options.getSave().attempt.board;
    for (const pose of [...this.metrics.poses].sort((a, b) => b.depth - a.depth)) {
      const view = this.views.get(pose.id)!;
      if (!view.node.visible || !pose.faceUp || !inside(x, y, { x: view.node.x, y: view.node.y, width: this.cardW, height: this.cardH })) continue;
      if (board.waste.at(-1) === pose.id) return { kind: 'waste', index: 0 };
      const index = board.tableau.findIndex(col => packet(board, board.tableau.indexOf(col), this.options.deal).includes(pose.id));
      if (index >= 0) return { kind: 'tableau', index };
      return null;
    }
    return null;
  }
  private hitTarget(x: number, y: number, forgiving = false): Target | null {
    return dropTarget(this.metrics.targets, x, y, forgiving ? 12 / this.cssUnit : 0);
  }
  private get stockTarget() { const stock = this.metrics.stock; return { x: stock.x, y: stock.y + stock.thickness / 2, width: this.cardW, height: this.cardH + stock.thickness }; }
  private hitCard(x: number, y: number): Pose | undefined {
    return [...this.metrics.poses].sort((a, b) => b.depth - a.depth).find(p => this.views.get(p.id)!.node.visible && p.faceUp && inside(x, y, { x: this.views.get(p.id)!.node.x, y: this.views.get(p.id)!.node.y, width: this.cardW, height: this.cardH }));
  }
  private down(pointer: BoardPointer) {
    if (!this.enabled || !pointer.primaryDown || this.press) return;
    const { x, y } = this.point(pointer), board = this.options.getSave().attempt.board;
    this.options.peek?.(null);
    const source = this.hitSource(x, y);
    if (this.jokerSelecting) {
      const target = this.hitTarget(x, y);
      this.press = { pointerId: pointer.id, toggle: false, from: null, x, y, moved: false, stock: false, target: null, poses: [], jokerColumn: target?.location.kind === 'tableau' ? target.location.index : -1 }; return;
    }
    if (this.inspectMode) {
      const pose = this.hitCard(x, y);
      if (pose) this.options.inspect(pose.id);
      return;
    }
    if (board.phase !== 'playing') return;
    this.clearHint();
    const target = this.hitTarget(x, y);
    const chosenTarget = this.selected && target && !same(this.selected, target.location) ? target : null;
    const from = chosenTarget ? this.selected : source;
    const card = this.hitCard(x, y);
    const stock = Boolean(board.stock.length || board.waste.length) && !chosenTarget && inside(x, y, this.stockTarget);
    if (stock && performance.now() < this.stockBusyUntil) return;
    const ids = from ? sourceCards(board, from, this.options.deal) : card ? [card.id] : [];
    this.press = { pointerId: pointer.id, toggle: Boolean(source && this.selected && same(source, this.selected)), from, x, y, moved: false, stock, inspectId: card?.id,
      target: chosenTarget, poses: this.metrics.poses.filter(p => ids.includes(p.id)).map(p => ({ ...p, x: this.views.get(p.id)!.node.x, y: this.views.get(p.id)!.node.y })) };
    if (source && !chosenTarget) { this.selected = source; this.options.sound('lift'); this.drawFocus(); }
  }
  private currentDrop(x: number, y: number): Target | null {
    const from = this.press?.from, front = this.press?.poses.at(-1), node = front && this.views.get(front.id)!.node;
    if (!from || !node) return null;
    return dragTarget(this.metrics.targets.filter(t => !same(from, t.location)), { x, y }, { x: node.x, y: node.y, width: this.cardW, height: this.cardH }, 12 / this.cssUnit,
      target => typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from, to: target.location }, this.options.deal) !== 'string');
  }
  private overReader(x: number, y: number, fingerOnly = false): boolean {
    const rect = this.options.readerZone?.(); if (!rect || !this.press?.inspectId) return false;
    const front = this.press.poses.at(-1), node = front && this.views.get(front.id)!.node;
    const hit = (p: { x: number; y: number }) => inside((p.x * this.unit + this.world.x) * this.scale.zoom, (p.y * this.unit + this.world.y) * this.scale.zoom, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height });
    return hit({ x, y }) || Boolean(!fingerOnly && node && hit(node));
  }
  private move(pointer: BoardPointer) {
    if (!this.enabled || !this.press?.poses.length || this.press.pointerId !== pointer.id || this.press.target || !pointer.isDown) return;
    const { x, y } = this.point(pointer), press = this.press;
    if (Math.hypot(x - press.x, y - press.y) > 11) press.moved = true;
    if (!press.moved) return;
    this.dragPointer = pointer; press.liftedAt ??= performance.now();
    const progress = this.options.getSave().settings.reducedMotion ? 1 : 1 - (1 - Math.min(1, (performance.now() - press.liftedAt) / 80)) ** 3;
    const lift = 68 / this.cssUnit * progress;
    const minY = Math.min(...press.poses.map(p => p.y)), maxY = Math.max(...press.poses.map(p => p.y));
    const dx = Phaser.Math.Clamp(x - press.x, (6 / this.scale.zoom - this.world.x) / this.unit + this.cardW / 2 - press.poses[0].x, (this.scale.width - 6 / this.scale.zoom - this.world.x) / this.unit - this.cardW / 2 - press.poses[0].x);
    const dy = Phaser.Math.Clamp(y - press.y - lift, (6 / this.scale.zoom - this.world.y) / this.unit + this.cardH / 2 - minY, (this.scale.height - 6 / this.scale.zoom - this.world.y) / this.unit - this.cardH / 2 - maxY);
    press.poses.forEach((pose, i) => {
      const view = this.views.get(pose.id)!;
      this.tweens.killTweensOf(view.node);
      if (!press.from) { view.content.setVisible(true); view.caption?.setVisible(true); view.strip?.setVisible(false); }
      view.shadow.setPosition(0, 4 * progress).setScale(1 + .03 * progress);
      view.node.setPosition(pose.x + dx, pose.y + dy).setScale(1 + .035 * progress).setDepth(800 + i);
    });
    const front = press.poses.at(-1);
    this.dragCount.setVisible(press.poses.length > 1);
    if (front) this.dragCount.setDepth(850).setText(`×${press.poses.length}`).setFontSize(Math.max(20, 12 / this.cssUnit)).setPosition(front.x + dx - this.cardW / 2 + 7, front.y + dy - this.cardH / 2 + 4);
    this.world.sort('depth');
    const hover = this.currentDrop(x, y), valid = hover && press.from && typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from: press.from, to: hover.location }, this.options.deal) !== 'string';
    this.options.peek?.(this.overReader(x, y, true) || this.overReader(x, y) && !valid ? press.inspectId! : null);
    this.drawFocus(hover);
  }
  private up(pointer: BoardPointer) {
    if (this.press && this.press.pointerId !== pointer.id) return;
    const press = this.press;
    const point = this.point(pointer);
    const drop = press?.moved ? this.currentDrop(point.x, point.y) : null;
    const valid = drop && press?.from && typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from: press.from, to: drop.location }, this.options.deal) !== 'string';
    const reader = Boolean(press?.moved && (this.overReader(point.x, point.y, true) || this.overReader(point.x, point.y) && !valid));
    this.press = null;
    this.dragPointer = undefined;
    this.dragCount.setVisible(false);
    if (!this.enabled || !press) return;
    const { x, y } = this.point(pointer);
    if (reader && press.inspectId) { this.selected = null; this.sync(); this.options.peek?.(press.inspectId); return; }
    if (press.jokerColumn !== undefined) {
      const target = this.hitTarget(x, y);
      if (Math.hypot(x - press.x, y - press.y) < 11 && target?.location.kind === 'tableau' && target.location.index === press.jokerColumn) {
        this.jokerSelecting = false; this.options.jokerMode?.(false); this.options.command({ type: 'place-joker', column: press.jokerColumn });
      } else this.cancel();
      return;
    }
    if (press.stock) {
      if (inside(x, y, this.stockTarget) && Math.hypot(x - press.x, y - press.y) < 11) {
        this.selected = null; this.options.command({ type: this.options.getSave().attempt.board.stock.length ? 'draw' : 'recycle' });
      }
      return;
    }
    const target = press.target ?? drop;
    if (press.from && target && !same(press.from, target.location)) {
      this.selected = null; this.options.command({ type: 'transfer', from: press.from, to: target.location });
    } else if (press.moved || !press.from || press.toggle) { this.cancel(); if (press.moved && press.from) this.reject(undefined, { x, y }); }
    else this.drawFocus();
  }
  private focusBox(x: number, y: number, width: number, height: number) {
    const left = Math.max(2, x - width / 2), right = Math.min(WIDTH - 2, x + width / 2);
    const top = Math.max(2, y - height / 2), bottom = Math.min(this.scale.height / this.unit - 2, y + height / 2);
    this.focus.strokeRoundedRect(left, top, right - left, bottom - top, 14);
  }
  private drawFocus(hover?: Target | null) {
    if (!this.focus) return;
    this.focus.clear();
    if (this.jokerSelecting) for (const t of this.metrics.targets.filter(t => t.location.kind === 'tableau' && this.options.getSave().attempt.board.tableau[t.location.index].length && !isLocked(this.options.getSave().attempt.board, t.location.index, this.options.deal))) {
      this.focus.lineStyle(3, 0xffdf7b, .9); this.focusBox(t.x, t.y, this.cardW + 6, this.cardH + 6);
    }
    if (this.selected && !this.press?.moved) {
      const nodes = sourceCards(this.options.getSave().attempt.board, this.selected, this.options.deal).map(id => this.views.get(id)!.node);
      if (nodes.length) {
        const top = Math.min(...nodes.map(n => n.y)) - this.cardH / 2, bottom = Math.max(...nodes.map(n => n.y)) + this.cardH / 2;
        this.focus.lineStyle(3, 0xffe5a3, .95); this.focusBox(nodes[0].x, (top + bottom) / 2, this.cardW + 4, bottom - top + 4);
      }
    }
    if (hover && this.selected) {
      const valid = typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from: this.selected, to: hover.location }, this.options.deal) !== 'string';
      this.focus.lineStyle(4, valid ? 0xffdf7b : 0xd5aa8d, .95); this.focusBox(hover.x, hover.y, this.cardW + 10, this.cardH + 10);
    }
  }
  public setJoker(active: boolean): void { this.cancel(); this.jokerSelecting = active; this.options.jokerMode?.(active); this.drawFocus(); this.game.loop.wake(); }
  public cancel(): void { this.jokerSelecting = false; this.options.jokerMode?.(false); this.options.peek?.(null); this.press = null; this.dragPointer = undefined; this.selected = null; this.dragCount?.setVisible(false); if (this.world) this.sync([], false); }
  public back(): boolean { if (!this.jokerSelecting && !this.press && !this.selected && !this.hintObjects.length) return false; this.clearHint(); this.cancel(); return true; }
  public setEnabled(value: boolean): void { this.enabled = value; if (!value) { this.clearHint(); this.options.peek?.(null); if (this.press || this.selected || this.jokerSelecting) this.cancel(); } }
  public setInspect(value: boolean): void { this.inspectMode = value; this.clearHint(); this.cancel(); }
  public clearHint(): void { this.hintTweens.forEach(t => t.stop()); this.hintTweens = []; this.hintObjects.forEach(o => o.destroy()); this.hintObjects = []; }
  public hint(action: BoardCommand): void {
    this.clearHint();
    const source = action.type === 'transfer' ? sourceCards(this.options.getSave().attempt.board, action.from, this.options.deal) : [];
    const from = action.type === 'transfer' ? this.metrics.poses.find(p => p.id === source.at(-1)) : this.metrics.stock;
    const target = action.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, action.to)) : this.metrics.stock;
    if (!from || !target) return;
    const rings = this.add.graphics().lineStyle(4, 0xffe39c, .95).setDepth(699);
    for (const p of [from, target]) rings.strokeRoundedRect(p.x - this.cardW / 2 + 2, p.y - this.cardH / 2 + 2, this.cardW - 4, this.cardH - 4, 13);
    let ghost: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
    if (action.type === 'transfer') {
      const copy = this.makeCard(source.at(-1)!);
      copy.face.setVisible(true); copy.back.setVisible(false);
      copy.badge.setText(source.length > 1 ? `×${source.length}` : this.views.get(source.at(-1)!)!.badge.text);
      ghost = copy.node;
    } else {
      ghost = this.add.image(0, 0, this.options.getSave().settings.cardBack === 'diamonds' ? 'art-card-back-diamonds' : 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH);
      this.world.add(ghost);
    }
    ghost.setPosition(from.x, from.y).setVisible(true).setAlpha(.62).setDepth(700);
    this.world.add(rings); this.world.sort('depth'); this.hintObjects.push(rings, ghost);
    if (!this.options.getSave().settings.reducedMotion) this.hintTweens.push(this.tweens.add({ targets: ghost, x: target.x, y: target.y + (action.type === 'transfer' ? 0 : 10), alpha: .35, duration: 850, hold: 200, repeat: 1,
      onRepeat: () => ghost.setPosition(from.x, from.y).setAlpha(.62), onComplete: () => this.clearHint() }));
    this.game.loop.wake();
  }
  /** One action at a time, following the real board; cosmetic and non-blocking. */
  public teach(action: BoardCommand): void {
    this.clearHint();
    if (!this.enabled || this.press || this.selected || this.inspectMode) return;
    const source = action.type === 'transfer' ? sourceCards(this.options.getSave().attempt.board, action.from, this.options.deal) : [];
    const from = action.type === 'transfer' ? this.metrics.poses.find(p => p.id === source.at(-1)) : this.metrics.stock;
    const target = action.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, action.to)) : this.metrics.stock;
    if (!from || !target) return;
    const focus = this.add.graphics().lineStyle(4, 0xffe39c, .95).setDepth(698);
    for (const p of [from, target]) focus.strokeRoundedRect(p.x - this.cardW / 2 + 3, p.y - this.cardH / 2 + 3, this.cardW - 6, this.cardH - 6, 13);
    const handH = Math.max(70, 32 / this.unit);
    const hand = this.add.image(from.x, from.y, 'tutorial-hand').setOrigin(.43, .06).setDisplaySize(handH * .66, handH).setDepth(701);
    this.world.add([focus, hand]); this.world.sort('depth'); this.hintObjects.push(focus, hand);
    if (this.options.getSave().settings.reducedMotion) { this.game.loop.wake(); return; }
    const tap = action.type !== 'transfer';
    this.hintTweens.push(this.tweens.add({ targets: hand, x: target.x, y: target.y + (tap ? 12 : 0),
      duration: tap ? 450 : 1000, delay: 280, hold: 300, repeatDelay: 450, repeat: -1, ease: 'Sine.easeInOut',
      onRepeat: () => hand.setPosition(from.x, from.y) }));
    this.game.loop.wake();
  }
  public hasMotion(): boolean { return this.tweens.getTweens().length > 0 || Boolean(this.press?.moved); }
  public update(): void { if (this.press?.moved && this.dragPointer) this.move(this.dragPointer); }
  public geometry() { return this.metrics; }
}
