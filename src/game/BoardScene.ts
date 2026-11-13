import Phaser from 'phaser';
import { installSceneTextSharpness } from '@danilah/mini-games-kit/phaser';
import { cardCaption, categoryCaption } from './captions';
import { applyBoard, isLocked, packet, sourceCards } from '../domain/engine';
import type { BoardCommand, Command, Deal, GameEvent, Location, Save } from '../domain/types';
import { boardFrame, cardMetrics, dragTarget, dropTarget, layout } from './layout';
import { UI_ART, artUrl, cardArtwork } from './art';
import type { Pose, Target } from './layout';

interface CardView { node: Phaser.GameObjects.Container; face: Phaser.GameObjects.Container; back: Phaser.GameObjects.Container; badge: Phaser.GameObjects.Text; content: Phaser.GameObjects.Container; caption?: Phaser.GameObjects.Text; strip?: Phaser.GameObjects.Text | Phaser.GameObjects.Image; stripText?: string; backArt: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Graphics; shade: Phaser.GameObjects.Graphics }
interface Options {
  deal: Deal; getSave(): Save; command(command: Command): void; sound(name: string): void;
  praise(text: string): void; jokerMode?(active: boolean): void; inspect(id: string): void; ready(scene: BoardScene): void;
  inputRoot?(): HTMLElement; boardBounds?(): { x: number; y: number; width: number; height: number };
  readerZone?(): DOMRect; peek?(id: string | null): void;
}
interface BoardPointer { id: number; x: number; y: number; primaryDown: boolean; isDown: boolean }
interface CardPress { pointerId: number; toggle: boolean; from: Location | null; x: number; y: number; moved: boolean; stock: boolean; target: Target | null; poses: Pose[]; inspectId?: string; liftedAt?: number; motion?: { x: number; at: number; tilt: number }; jokerColumn?: number }
interface FoundationSurface { view: CardView; frontId: string }
interface CoveredFace { frontId: string; strip: boolean }
interface CollectionView { node: Phaser.GameObjects.Container; targets: Phaser.GameObjects.GameObject[]; timers: Phaser.Time.TimerEvent[]; sparks: Phaser.GameObjects.Image[] }
interface ContactFeedback { kind: GameEvent['type']; play(): void }
interface KeyPresentation { timers: Phaser.Time.TimerEvent[]; revealed: string[]; revealDelay: number }
const inside = (x: number, y: number, target: { x: number; y: number; width: number; height: number }) =>
  Math.abs(x - target.x) <= target.width / 2 && Math.abs(y - target.y) <= target.height / 2;
const same = (a: Location, b: Location) => a.kind === b.kind && a.index === b.index;

/** The model is already committed before any visual transition begins. */
export class BoardScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container;
  private slots!: Phaser.GameObjects.Graphics;
  private slotViews = new Map<string, Phaser.GameObjects.Image>();
  private foundationArt!: Phaser.GameObjects.Graphics;
  private foundationTitles: Phaser.GameObjects.Text[] = [];
  private foundationFaces = new Map<number, string>();
  private foundationSurfaces = new Map<number, FoundationSurface>();
  private coveredFaces = new Map<string, CoveredFace>();
  private returningWells = new Map<number, { ids: string[]; y: number }>();
  private collectedIds = new Set<string>();
  private collectionOrigins = new Map<string, number>();
  private focus!: Phaser.GameObjects.Graphics;
  private stockArt!: Phaser.GameObjects.Image;
  private stockLayers: Phaser.GameObjects.Image[] = [];
  private stockBusyUntil = 0;
  private stockCount!: Phaser.GameObjects.Text;
  private stockLabel!: Phaser.GameObjects.Text;
  private collections = new Map<number, CollectionView>();
  private praiseIndex = 0;
  private views = new Map<string, CardView>();
  private metrics!: ReturnType<typeof layout>;
  private jokerSelecting = false;
  private jokerArt!: Phaser.GameObjects.Container;
  private jokerBadge!: Phaser.GameObjects.Container;
  private lockArt!: Phaser.GameObjects.Container;
  private lockIcon!: Phaser.GameObjects.Image;
  private lockCount!: Phaser.GameObjects.Text;
  private keyFlights: Phaser.GameObjects.Image[] = [];
  private keyPresentation: KeyPresentation | undefined;
  private presentationGeneration = 0;
  private selected: Location | null = null;
  private press: CardPress | null = null;
  private pendingReturn: CardPress | null = null;
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
  private cues: Phaser.GameObjects.Container[] = [];
  private hoverKey = '';
  private hoverSince = 0;
  private dragCount!: Phaser.GameObjects.Text;
  private presentedDealId: string | undefined;
  public constructor(private readonly options: Options) { super('board'); }
  private get cardW() { return cardMetrics(this.options.deal).width; }
  private get cardH() { return cardMetrics(this.options.deal).height; }
  public setDeal(deal: Deal) { this.enabled = false; this.presentedDealId = undefined; this.options.deal = deal; this.scene.restart(); this.game.loop.wake(); }
  /** Called only after the visible board has its final bounds, for a new attempt. */
  public presentDeal(): void { this.initial = true; this.sync([], true); }
  public preload(): void {
    if (!this.textures.exists('tutorial-hand')) this.load.image('tutorial-hand', 'art/ui/tutorial-hand.webp');
    for (const name of UI_ART) if (!this.textures.exists('art-' + name)) this.load.image('art-' + name, artUrl(name));
    for (const card of Object.values(this.options.deal.cards)) { const image = cardArtwork(card, this.options.deal); if (image && !this.textures.exists(image)) this.load.image(image, image); }
  }
  public create(): void {
    this.foundationFaces.clear(); this.foundationSurfaces.clear(); this.coveredFaces.clear();
    this.returningWells.clear();
    this.collectedIds.clear(); this.collectionOrigins.clear();
    this.pendingReturn = null;
    this.keyPresentation = undefined; this.presentationGeneration++;
    this.slotViews.clear();
    this.collections.clear();
    this.jokerSelecting = false; this.options.jokerMode?.(false); this.selected = null; this.press = null; this.dragPointer = undefined; this.initial = false; this.inspectMode = false; this.particles = []; this.hintObjects = []; this.hintTweens = []; this.stockBusyUntil = 0;
    installSceneTextSharpness(this);
    this.world = this.add.container(0, 0);
    this.cues = [];
    this.dragCount = this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '20px', fontStyle: 'bold', color: '#4d4269', backgroundColor: '#fff0c9', padding: { x: 6, y: 3 } }).setDepth(750).setVisible(false);
    this.world.add(this.dragCount);
    this.slots = this.add.graphics(); this.stockArt = this.add.image(0, 0, 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH); this.focus = this.add.graphics().setDepth(450);
    this.stockLayers = Array.from({ length: 5 }, () => this.add.image(0, 0, 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH).setTint(0xe4e1e7));
    this.stockCount = this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(38);
    this.stockLabel = this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '17px', color: '#b0d7bf' }).setOrigin(.5).setDepth(38);
    this.world.add([this.slots, ...this.stockLayers, this.stockArt, this.focus, this.stockCount, this.stockLabel]);
    for (const [kind, ids] of [['foundation', this.options.getSave().attempt.board.foundations], ['tableau', this.options.getSave().attempt.board.tableau]] as const) {
      ids.forEach((_, index) => {
        const view = this.add.image(0, 0, `art-slot-${kind}`).setVisible(false).setDepth(0);
        this.world.add(view); this.slotViews.set(`${kind}:${index}`, view);
      });
    }
    this.foundationArt = this.add.graphics().setDepth(200);
    this.foundationTitles = this.options.getSave().attempt.board.foundations.map(() => this.add.text(0, 0, '', { fontFamily: 'Nunito, Arial', fontSize: '18px', fontStyle: 'bold', color: '#886347' }).setOrigin(.5).setDepth(201));
    this.world.add([this.foundationArt, ...this.foundationTitles]);
    const gold = this.add.image(0, 0, 'art-card-category').setDisplaySize(this.cardW, this.cardH);
    this.jokerArt = this.add.container(0, 0, [gold, this.label(0, -this.cardH / 2 + 12, 'ДЖОКЕР', 16, '#705328'), this.add.image(0, 5, 'art-joker').setDisplaySize(78, 78)]).setVisible(false);
    this.jokerBadge = this.add.container(0, 0, [this.add.circle(0, 0, 11, 0xf1cc73).setStrokeStyle(1, 0xffecc0), this.add.text(0, 0, '✦', { fontFamily: 'Nunito, Arial', fontSize: '15px', color: '#715321' }).setOrigin(.5)]).setDepth(425).setVisible(false);
    const lock = this.add.image(0, 0, 'art-card-back-diamonds').setDisplaySize(this.cardW, this.cardH).setTint(0x9198b9);
    this.lockCount = this.label(0, 36, '0 / 3', 21, '#ffe6a1');
    this.lockIcon = this.add.image(0, -8, 'art-lock').setDisplaySize(66, 66);
    this.lockArt = this.add.container(0, 0, [lock, this.lockIcon, this.label(0, -this.cardH / 2 + 12, 'ТРИ КЛЮЧА', 11, '#fff0cf'), this.lockCount]).setVisible(false).setDepth(420);
    this.world.add([this.jokerArt, this.jokerBadge, this.lockArt]);
    this.keyFlights = Array.from({ length: 3 }, () => { const key = this.add.image(0, 0, 'art-key').setDisplaySize(40, 40).setDepth(590).setVisible(false); this.world.add(key); return key; });
    for (const card of Object.values(this.options.deal.cards)) this.views.set(card.id, this.makeCard(card.id));
    for (let i = 0; i < 12; i++) { const dot = this.add.image(0, 0, 'art-spark').setDisplaySize(13, 13).setTint(0xffe3a5).setDepth(640).setVisible(false); this.world.add(dot); this.particles.push(dot); }
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
    this.events.once('shutdown', () => { controller.abort(); this.options.peek?.(null); this.presentedDealId = undefined; this.scale.off('resize', resize); this.clearHint(); this.clearFeedback(); this.foundationFaces.clear(); this.views.clear(); this.input.removeAllListeners(); });
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
      strip = this.add.text(0, 0, categoryCaption(card.text), { fontFamily: 'Nunito, Arial', fontSize: '16px', color: '#8c7257', fontStyle: 'bold' }).setOrigin(.5);
      strip.setScale(Math.min(1, (this.cardW - 18) / strip.width)); face.add(strip); strip.setVisible(false);
    } else if (image) {
      content.add(this.add.image(0, 0, image).setDisplaySize(Math.min(104, this.cardW - 22), Math.min(104, this.cardW - 22)));
      strip = this.add.image(0, -this.cardH / 2 + 11, image).setDisplaySize(18, 18); face.add(strip); strip.setVisible(false);
    } else {
      caption = this.label(0, 0, card.text, card.text.length > 11 ? 23 : 26, '#294d5d', this.cardH - 72); caption.setOrigin(.5); content.add(caption);
      strip = this.add.text(0, 0, card.text.length > 12 ? card.text.slice(0, 11) + '…' : card.text, { fontFamily: 'Nunito, Arial', fontSize: '16px', fontStyle: 'bold', color: '#79909c' }).setOrigin(.5);
      strip.setScale(Math.min(1, (this.cardW - 14) / strip.width)); face.add(strip); strip.setVisible(false);
    }
    if (card.keyId) {
      const key = this.add.image(this.cardW / 2 - 23, -this.cardH / 2 + 23, 'art-key').setDisplaySize(30, 30);
      content.add(key);
    }
    const badge = this.label(0, card.leader && !card.ordered ? -this.cardH / 2 + 13 : this.cardH / 2 - 30, '', 17, card.leader ? '#a17e5d' : '#a9815f'); content.add(badge);
    const b = this.add.image(0, 0, 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH);
    this.paintBack(b);
    const shade = this.add.graphics().fillStyle(0x172c39).fillRoundedRect(-this.cardW / 2 + 3, -this.cardH / 2 + 3, this.cardW - 6, this.cardH - 6, 13).setAlpha(0);
    back.add(b); node.add([shadow, face, back, shade]); this.world.add(node);
    return { node, face, back, badge, content, caption, strip, stripText: strip instanceof Phaser.GameObjects.Text ? strip.text : undefined, backArt: b, shadow, shade };
  }
  private paintBack(b: Phaser.GameObjects.Image) {
    const diamonds = this.options.getSave().settings.cardBack === 'diamonds';
    b.setTexture(diamonds ? 'art-card-back-diamonds' : 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH);
  }
  /** Visual copies never participate in hit testing, persistence or commands. */
  private copyCard(id: string): CardView {
    const source = this.views.get(id)!, copy = this.makeCard(id);
    copy.node.setPosition(source.node.x, source.node.y).setScale(source.node.scaleX, source.node.scaleY).setAlpha(source.node.alpha).setAngle(source.node.angle).setVisible(true);
    copy.face.setVisible(source.face.visible); copy.back.setVisible(source.back.visible);
    copy.content.setVisible(source.content.visible); copy.caption?.setVisible(source.caption?.visible ?? true);
    copy.badge.setText(source.badge.text).setY(source.badge.y).setVisible(source.badge.visible);
    copy.shade.setAlpha(source.shade.alpha);
    copy.strip?.setVisible(source.strip?.visible ?? false);
    if (copy.strip && source.strip) copy.strip.setPosition(source.strip.x, source.strip.y).setScale(source.strip.scaleX, source.strip.scaleY).setAngle(source.strip.angle);
    if (copy.strip instanceof Phaser.GameObjects.Text && source.strip instanceof Phaser.GameObjects.Text) copy.strip.setText(source.strip.text);
    return copy;
  }
  private finishSurface(index: number) {
    const surface = this.foundationSurfaces.get(index); if (!surface) return;
    this.foundationSurfaces.delete(index);
    surface.view.node.destroy(true);
  }
  private settleSurfaces() {
    for (const [index, surface] of this.foundationSurfaces) {
      const front = this.views.get(surface.frontId), pose = this.metrics?.poses.find(p => p.id === surface.frontId);
      if (front && pose) { this.tweens.killTweensOf(front.node); front.node.setPosition(pose.x, pose.y).setScale(1).setAlpha(1); }
      this.finishSurface(index);
    }
  }
  private finishCovers(frontId: string) {
    for (const [id, pending] of this.coveredFaces) {
      if (pending.frontId !== frontId) continue;
      this.coveredFaces.delete(id);
      if (this.press?.poses.some(p => p.id === id)) continue;
      const view = this.views.get(id); if (!view) continue;
      view.content.setVisible(false); view.caption?.setVisible(false); view.strip?.setVisible(pending.strip);
    }
  }
  private drawSlots() {
    const board = this.options.getSave().attempt.board;
    this.slots.clear();
    this.slotViews.forEach(view => view.setVisible(false));
    for (const target of this.metrics.targets) {
      const upper = target.location.kind === 'foundation', index = target.location.index;
      const ids = upper ? board.foundations[index] : board.tableau[index];
      const lifted = !upper && this.press?.moved && this.press.from?.kind === 'tableau' && this.press.from.index === index && ids.every(id => this.press!.poses.some(p => p.id === id));
      const returning = !upper && this.returningWells.get(index);
      if (ids.length && !lifted && !returning) continue;
      const x = target.x, y = lifted ? this.metrics.poses.find(p => p.id === ids[0])!.y : returning ? returning.y : target.y;
      const ink = this.options.getSave().settings.palette === 'ink';
      this.slotViews.get(`${target.location.kind}:${index}`)!.setVisible(true).setPosition(x, y)
        .setDisplaySize(this.cardW - 4, this.cardH - 4).setTint(ink ? 0xd8ceff : 0xffffff)
        .setAlpha(ink ? upper ? .8 : .62 : upper ? 1 : .85);
    }
    if (!board.stock.length && board.waste.length) this.slots.fillStyle(0xd2e8db, .08).fillCircle(this.metrics.stock.x, this.metrics.stock.y, 35);
  }
  public sync(events: GameEvent[] = [], entering = false, command?: BoardCommand, feedback?: ContactFeedback, returningIds: readonly string[] = []): void {
    if (!this.world || this.presentedDealId !== this.options.getSave().attempt.dealId) return;
    this.clearKeys();
    const generation = ++this.presentationGeneration;
    let sounded = false;
    const contact = () => { if (!sounded && generation === this.presentationGeneration) { sounded = true; feedback?.play(); } };
    this.pendingReturn = null;
    this.settleSurfaces();
    this.coveredFaces.clear();
    for (const returning of this.returningWells.values()) for (const id of returning.ids) {
      const view = this.views.get(id), pose = this.metrics?.poses.find(p => p.id === id);
      if (view && pose) { this.tweens.killTweensOf(view.node); view.node.setPosition(pose.x, pose.y).setScale(1); }
    }
    this.returningWells.clear();
    const save = this.options.getSave(), board = save.attempt.board;
    const previousCollected = this.collectedIds; this.collectedIds = new Set(board.collected);
    const previous = this.metrics;
    const drawUnder = command?.type === 'draw' && !save.settings.reducedMotion ? board.waste.at(-2) : undefined;
    const bounds = this.options.boardBounds?.() ?? { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    this.frameKey = this.frameIdentity();
    const frame = boardFrame(bounds.width, bounds.height, save.settings.deckPosition, this.options.deal);
    this.unit = frame.unit; this.world.setScale(this.unit).setPosition(bounds.x + frame.offsetX, bounds.y);
    this.metrics = layout(board, this.options.deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
    if (this.backStyle !== (save.settings.cardBack ?? 'classic')) { this.backStyle = save.settings.cardBack ?? 'classic'; for (const view of this.views.values()) this.paintBack(view.backArt); }
    const duration = save.settings.reducedMotion ? 0 : 215;
    const movedIds = events.find(e => e.type === 'transfer')?.cards ?? [];
    // One packet owns one arrival time. Distances are CSS pixels, so phones
    // share the same feel; neither input nor the committed model waits for it.
    const undoing = events.some(e => e.type === 'undo');
    const settlingIds = movedIds.length ? movedIds : undoing ? this.metrics.poses.map(p => p.id) : returningIds;
    const distance = Math.max(0, ...this.metrics.poses.filter(p => settlingIds.includes(p.id)).map(p => {
      const view = this.views.get(p.id)!;
      return Math.hypot(p.x - view.node.x, p.y - view.node.y) * this.cssUnit;
    }));
    const settlingDuration = duration ? Phaser.Math.Clamp(75 + distance * .5, 80, undoing ? 210 : 180) : 0;
    const receivingColumn = command?.type === 'transfer' && command.to.kind === 'tableau' ? board.tableau[command.to.index] : undefined;
    const firstArrival = receivingColumn?.indexOf(movedIds[0]) ?? -1;
    const tableauUnder = duration && new URLSearchParams(location.search).get('fxCards') !== '0' && firstArrival > 0 ? receivingColumn![firstArrival - 1] : undefined;
    if (events.some(e => e.type === 'undo' || e.type === 'restart')) {
      for (const key of this.keyFlights) { this.tweens.killTweensOf(key); key.setVisible(false); }
      this.options.praise('');
      this.clearFeedback();
      if (entering && events.some(e => e.type === 'restart')) this.initial = true;
    }
    this.drawSlots();
    this.jokerArt.setVisible(Boolean(this.metrics.joker));
    this.jokerBadge.setVisible(Boolean(this.metrics.joker));
    if (this.metrics.joker) this.jokerBadge.setPosition(this.metrics.joker.x + this.cardW / 2 - 12, this.metrics.joker.y - this.cardH / 2 + 12);
    if (this.metrics.joker) this.jokerArt.setPosition(this.metrics.joker.x, this.metrics.joker.y).setDepth(this.metrics.joker.depth);
    const lockTarget = this.options.deal.lock && this.metrics.targets.find(t => t.location.kind === 'tableau' && t.location.index === this.options.deal.lock!.column);
    this.lockArt.setVisible(Boolean(lockTarget && isLocked(board, this.options.deal.lock!.column, this.options.deal)));
    if (lockTarget) { this.lockArt.setPosition(lockTarget.x, lockTarget.y); this.lockCount.setText(`${board.keys?.length ?? 0} / 3`); }
    const keyEvents = events.filter(e => e.type === 'key');
    const contactAtKey = keyEvents.length > 0 && (feedback?.kind === 'key' || feedback?.kind === 'unlock');
    if (keyEvents.length && lockTarget) this.presentKeys(keyEvents, events.some(e => e.type === 'unlock'), lockTarget, contactAtKey ? contact : undefined);
    else if (contactAtKey) contact();
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
    const contactAtCollection = Boolean(completed && !contactAtKey);
    const arrivalId = movedIds.filter(id => visible.has(id)).at(-1);
    let landed = false;
    const landTransfer = () => {
      if (landed || generation !== this.presentationGeneration) return;
      landed = true;
      if (!contactAtKey && !contactAtCollection) contact();
      const target = command?.type === 'transfer' && this.metrics.targets.find(t => same(t.location, command.to));
      if (target && !completed) this.cue(target.x, target.y, 0xffd990);
      const front = arrivalId && this.views.get(arrivalId);
      if (front && !this.press && !save.settings.reducedMotion && !completed) {
        this.tweens.add({ targets: front.node, y: front.node.y + 1.5, scaleY: .992, duration: 45, yoyo: true, ease: 'Sine.easeOut' });
      }
    };
    if (command?.type === 'transfer' && command.to.kind === 'foundation') {
      this.clearCollection(command.to.index);
      if (completed) this.collect(completed, movedIds, command.to.index, contactAtCollection ? contact : undefined);
    }
    if (!completed && command?.type === 'transfer' && command.to.kind === 'foundation' && !save.settings.reducedMotion) {
      const index = command.to.index, oldId = this.foundationFaces.get(index), frontId = foundationTops.find(id => board.foundations[index].includes(id));
      const target = this.metrics.targets.find(t => t.location.kind === 'foundation' && t.location.index === index)!;
      if (oldId && frontId && oldId !== frontId) {
        const view = this.copyCard(oldId);
        view.node.setPosition(target.x, target.y).setScale(1).setAngle(0).setAlpha(1).setDepth(18);
        view.face.setVisible(true); view.back.setVisible(false);
        this.foundationSurfaces.set(index, { view, frontId });
      }
    }
    this.foundationFaces = new Map(board.foundations.flatMap((ids, index) => ids.length ? [[index, ids.filter(id => !this.options.deal.cards[id].leader).at(-1) ?? ids.at(-1)!] as const] : []));
    const recycled = command?.type === 'recycle' && previous && !save.settings.reducedMotion;
    if (command?.type === 'draw' || command?.type === 'recycle') this.stockBusyUntil = performance.now() + (save.settings.reducedMotion ? 0 : command.type === 'draw' ? 280 : 370);
    for (const [id, view] of this.views) {
      if (visible.has(id)) continue;
      this.tweens.killTweensOf(view.node);
      this.tweens.killTweensOf(view.shade); view.shade.setAlpha(0);
      this.tweens.killTweensOf([view.face, view.back]); view.face.setScale(1); view.back.setScale(1);
      if (recycled && board.stock.includes(id)) {
        const old = previous.poses.find(p => p.id === id) ?? previous.waste;
        const index = board.stock.length - 1 - board.stock.indexOf(id), delay = index * Math.min(16, 120 / Math.max(1, board.stock.length - 1));
        view.node.setPosition(old.x, old.y).setDepth(100 + index).setScale(1).setAngle(0).setAlpha(1).setVisible(true);
        view.face.setVisible(true); view.back.setVisible(false); view.content.setVisible(true); view.strip?.setVisible(false);
        this.tweens.add({ targets: view.node, x: stock.x, y: stock.y, duration: 240, delay, ease: 'Sine.easeInOut',
          onUpdate: tween => { const t = tween.progress; view.node.setScale(Math.max(.045, Math.abs(1 - t * 2)), 1); view.face.setVisible(t < .5); view.back.setVisible(t >= .5); },
          onComplete: () => view.node.setVisible(false).setScale(1) });
      } else view.node.setVisible(false);
    }
    for (const pose of this.metrics.poses) {
      if (!visible.has(pose.id)) continue;
      const view = this.views.get(pose.id)!;
      view.shadow.setPosition(0, 0).setScale(1).setAlpha(1);
      this.tweens.killTweensOf(view.shade);
      if (view.shade.alpha && duration && this.enabled) this.tweens.add({ targets: view.shade, alpha: 0, duration: 120, ease: 'Sine.easeOut' });
      else view.shade.setAlpha(0);
      this.tweens.killTweensOf(view.node);
      this.tweens.killTweensOf([view.face, view.back]); view.face.setScale(1); view.back.setScale(1);
      view.face.setVisible(pose.faceUp); view.back.setVisible(!pose.faceUp);
      const def = this.options.deal.cards[pose.id];
      if (previousCollected.has(pose.id) && events.some(e => e.type === 'undo')) {
        // A reloaded save has no old sprite positions. Restore from an actual
        // upper area, never the factory's (0,0); no presentation data is saved.
        const restoredSlot = board.foundations.findIndex(ids => ids.some(id => this.options.deal.cards[id].category === def.category));
        const index = this.collectionOrigins.get(def.category) ?? restoredSlot;
        const upper = this.metrics.targets.filter(t => t.location.kind === 'foundation');
        const origin = upper.find(t => t.location.index === index) ?? upper.reduce<Target | undefined>((best, t) => !best || Math.abs(t.x - pose.x) < Math.abs(best.x - pose.x) ? t : best, undefined);
        if (origin) view.node.setPosition(origin.x, origin.y).setScale(1).setAlpha(1).setAngle(0);
      }
      const group = board.tableau.findIndex(col => col.includes(pose.id));
      const groupIds = group >= 0 ? packet(board, group, this.options.deal) : board.foundations.find(col => col.includes(pose.id)) ?? [];
      const total = Object.values(this.options.deal.cards).filter(c => c.category === def.category && !c.leader).length;
      view.badge.setText(def.leader ? `${groupIds.filter(id => !this.options.deal.cards[id].leader).length} / ${total}` : def.rank ? `${def.rank} / ${total}` : groupIds.length > 1 ? `×${groupIds.length}` : '');
      const foundation = board.foundations.some(ids => ids.includes(pose.id));
      // Ordered leaders already have a rule label above and progress dots below.
      // A second fraction at the rule-label baseline obscures both.
      view.badge.setVisible(!(foundation && def.ordered));
      if (foundation) {
        view.badge.setText(def.ordered || def.rank ? view.badge.text : '');
        view.badge.setY(-this.cardH / 2 + 13);
      } else view.badge.setY(def.leader && !def.ordered ? -this.cardH / 2 + 13 : this.cardH / 2 - 30);
      const column = group >= 0 ? board.tableau[group] : [], nextId = column[column.indexOf(pose.id) + 1];
      const next = group >= 0 && nextId ? this.metrics.poses.find(p => p.id === nextId) : undefined;
      const support = this.metrics.joker;
      const supportBelow = support && support.x === pose.x && support.depth > pose.depth && (!next || support.depth < next.depth);
      const rearWaste = board.waste.includes(pose.id) && board.waste.at(-1) !== pose.id;
      const wasteAbove = rearWaste ? this.metrics.poses.find(p => p.id === board.waste[board.waste.indexOf(pose.id) + 1]) : undefined;
      const band = rearWaste ? Math.abs((wasteAbove?.x ?? pose.x) - pose.x) : group < 0 ? this.cardH : Math.min(next ? next.y - pose.y : this.cardH, supportBelow ? support!.y - pose.y : this.cardH);
      const coveredCaption = band < this.cardH - 1;
      // Centre the preview in exposed paper, leaving both the rim and the
      // incoming card clear. A squeezed band yields no misleading fragment.
      const previewRoom = Math.max(0, band - (rearWaste ? 16 : 20));
      if (view.strip instanceof Phaser.GameObjects.Text) {
        view.strip.setFontSize(16).setText(rearWaste ? def.leader ? categoryCaption(def.text) : def.text : view.stripText!).setOrigin(.5).setScale(1);
        view.strip.setScale(Math.min(1, (rearWaste ? this.cardH - 28 : this.cardW - 28) / Math.max(1, view.strip.width), previewRoom / Math.max(1, view.strip.height)));
      } else if (view.strip) { const size = Math.min(rearWaste ? 16 : 22, previewRoom); view.strip.setDisplaySize(Math.max(1, size), Math.max(1, size)); }
      if (view.strip) {
        const side = save.settings.deckSide === 'left' ? -1 : 1;
        view.strip.setAngle(rearWaste && view.strip instanceof Phaser.GameObjects.Text ? side * 90 : 0)
          .setPosition(rearWaste ? side * (this.cardW / 2 - band / 2) : 0, rearWaste ? 0 : -this.cardH / 2 + band / 2);
      }
      const waitingForCover = pose.id === drawUnder || pose.id === tableauUnder;
      const stripVisible = Boolean(coveredCaption && pose.faceUp && view.strip && previewRoom >= 12 && (!(view.strip instanceof Phaser.GameObjects.Text) || view.strip.scaleX >= .65));
      if (waitingForCover) this.coveredFaces.set(pose.id, { frontId: pose.id === drawUnder ? board.waste.at(-1)! : movedIds.at(-1)!, strip: stripVisible });
      view.content.setVisible(!coveredCaption || waitingForCover); view.caption?.setVisible(!coveredCaption || waitingForCover);
      view.strip?.setVisible(!waitingForCover && stripVisible);
      const fresh = entering && this.initial;
      if (fresh) {
        const fromStock = Boolean(this.options.deal.initial.stock.length || this.options.deal.initial.waste.length);
        view.node.setPosition(fromStock ? stock.x : pose.x, fromStock ? stock.y : pose.y + 14).setAlpha(0).setAngle(fromStock ? -5 : 0).setScale(fromStock ? .88 : .96);
      }
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
            this.finishCovers(pose.id);
          } });
        continue;
      }
      if (!entering && pose.faceUp && previous?.poses.some(old => old.id === pose.id && !old.faceUp) && !save.settings.reducedMotion) {
        view.face.setVisible(false); view.back.setVisible(true);
        const revealDelay = this.keyPresentation?.revealed.includes(pose.id) ? this.keyPresentation.revealDelay : 0;
        this.tweens.add({ targets: view.back, scaleX: .045, delay: 25 + revealDelay, duration: 75, ease: 'Sine.easeIn', onComplete: () => {
          view.back.setVisible(false).setScale(1); view.face.setVisible(true).setScale(.045, 1);
          if (generation === this.presentationGeneration) this.options.sound('flip');
          this.tweens.add({ targets: view.face, scaleX: 1, duration: 90, ease: 'Sine.easeOut' });
        } });
      }
      const moving = events.some(e => e.type === 'transfer' && e.cards?.includes(pose.id)) || events.some(e => e.type === 'draw' && e.cards?.includes(pose.id));
      const animationOn = new URLSearchParams(location.search).get(moving ? 'fxCards' : 'fxLayout') !== '0';
      const covered = board.joker?.column === group && board.tableau[group].indexOf(pose.id) < board.joker.boundary;
      const moveDuration = entering && !fresh || !animationOn ? 0 : settlingIds.includes(pose.id) ? settlingDuration : duration;
      // A flight belongs above the board until contact, independently of the
      // destination's resting depth. Keep packet members in their source order.
      const flying = Boolean(moveDuration && moving && command?.type === 'transfer');
      if (flying) view.node.setDepth(720 + movedIds.indexOf(pose.id));
      // Zero-duration layout is synchronous: the first ready frame must already own its hit positions.
      if (!moveDuration) {
        view.node.setPosition(pose.x, pose.y).setScale(1).setAlpha(covered ? .5 : 1).setAngle(0);
        if (pose.id === arrivalId) landTransfer();
      }
      else this.tweens.add({ targets: view.node, x: pose.x, y: pose.y, scaleX: 1, scaleY: 1, alpha: covered ? .5 : 1, angle: 0,
        duration: moveDuration, delay: fresh ? Math.min(140, Math.max(0, pose.depth - 20) * 2.5) : 0, ease: 'Cubic.easeOut', onComplete: () => {
          if (flying) { view.node.setDepth(pose.depth); this.world.sort('depth'); }
          this.finishCovers(pose.id);
          for (const [index, surface] of this.foundationSurfaces) if (surface.frontId === pose.id) this.finishSurface(index);
          for (const [index, returning] of this.returningWells) if (returning.ids.at(-1) === pose.id) { this.returningWells.delete(index); this.drawSlots(); }
          if (pose.id === arrivalId) landTransfer();
        } });
    }
    this.initial = false;
    this.world.sort('depth');
    this.drawFocus();
    if (feedback && !arrivalId && !contactAtCollection && !contactAtKey) contact();
    if (previous && events.some(e => e.type === 'undo')) for (const pose of this.metrics.poses.filter(p => p.faceUp && visible.has(p.id) && !previous.poses.some(old => old.id === p.id && old.x === p.x && old.y === p.y && old.faceUp === p.faceUp)).slice(-3)) this.cue(pose.x, pose.y, 0xc3b3ec);
    // A completed touch may arrive after the pointerdown frame already slept.
    // Starting visual work must own its wake, independently of a future input.
    if (this.enabled && this.game.isRunning) this.game.loop.wake();
  }
  private clearKeys() {
    const pending = this.keyPresentation; if (!pending) return;
    this.keyPresentation = undefined;
    pending.timers.forEach(timer => timer.remove(false));
    for (const key of this.keyFlights) { this.tweens.killTweensOf(key); key.setVisible(false); }
    this.tweens.killTweensOf([this.lockArt, this.lockIcon]);
    this.lockArt.setScale(1).setAlpha(1); this.lockIcon.setTexture('art-lock').setAngle(0);
    const board = this.options.getSave().attempt.board, lock = this.options.deal.lock;
    this.lockArt.setVisible(Boolean(lock && isLocked(board, lock.column, this.options.deal)));
    this.lockCount.setText(`${board.keys?.length ?? 0} / 3`);
    for (const id of pending.revealed) {
      const view = this.views.get(id); if (!view) continue;
      this.tweens.killTweensOf([view.face, view.back]);
      const faceUp = board.faceUp.includes(id);
      view.face.setVisible(faceUp).setScale(1); view.back.setVisible(!faceUp).setScale(1);
    }
  }
  /** Already-owned keys get a visible destination. This snapshot never locks input. */
  private presentKeys(events: GameEvent[], unlock: boolean, target: Target, contact?: () => void) {
    const board = this.options.getSave().attempt.board, count = board.keys?.length ?? 0;
    const reduced = this.options.getSave().settings.reducedMotion || new URLSearchParams(location.search).get('fxCards') === '0';
    if (reduced) { this.lockCount.setText(`${count} / 3`); if (unlock) this.showPraise('Замок открыт!'); contact?.(); return; }
    const revealDelay = 190 + 240 + 60 + 130;
    const revealed = unlock ? this.metrics.poses.filter(p => board.tableau[this.options.deal.lock!.column].includes(p.id) && p.faceUp && !this.views.get(p.id)!.face.visible).map(p => p.id) : [];
    const pending: KeyPresentation = { timers: [], revealed, revealDelay };
    this.keyPresentation = pending;
    const alive = () => this.keyPresentation === pending;
    this.lockArt.setVisible(true).setScale(1).setAlpha(1);
    this.lockCount.setText(`${Math.max(0, count - events.length)} / 3`);
    const arrive = () => {
      if (!alive()) return;
      this.lockCount.setText(`${count} / 3`); contact?.();
      if (unlock) {
        this.showPraise('Замок открыт!');
        if (this.textures.exists('art-lock-open')) this.lockIcon.setTexture('art-lock-open');
        else this.lockIcon.setAngle(-16);
        this.tweens.add({ targets: this.lockArt, scaleX: 1.025, scaleY: 1.025, duration: 45, yoyo: true });
        this.tweens.add({ targets: this.lockArt, alpha: 0, scaleX: .96, scaleY: .96, delay: 60, duration: 130, onComplete: () => {
          if (alive()) { this.lockArt.setVisible(false).setAlpha(1).setScale(1); this.lockIcon.setTexture('art-lock').setAngle(0); }
        } });
      } else this.tweens.add({ targets: this.lockArt, scaleX: 1.015, scaleY: 1.015, duration: 45, yoyo: true });
      pending.timers.push(this.time.delayedCall(unlock ? 400 : 110, () => { if (alive()) this.keyPresentation = undefined; }));
    };
    pending.timers.push(this.time.delayedCall(190, () => {
      if (!alive()) return;
      const from = events.flatMap(e => e.cards ?? []).map(id => this.views.get(id)?.node).find(node => node?.visible);
      const key = this.keyFlights.find(k => !k.visible);
      if (!from || !key) { arrive(); return; }
      key.setPosition(from.x + this.cardW / 2 - 23, from.y - this.cardH / 2 + 23).setVisible(true).setAlpha(1).setScale(1);
      key.setDisplaySize(30, 30);
      const start = { x: key.x, y: key.y }, end = { x: target.x, y: target.y - 8 };
      const arc = Math.min(28, Math.hypot(end.x - start.x, end.y - start.y) * .1);
      this.tweens.add({ targets: key, x: end.x, y: end.y, duration: 240, ease: 'Sine.easeInOut',
        onUpdate: tween => {
          const t = Phaser.Math.Easing.Sine.InOut(tween.progress);
          key.y = Phaser.Math.Linear(start.y, end.y, t) - Math.sin(Math.PI * t) * arc;
        }, onComplete: () => { key.setVisible(false); arrive(); } });
    }));
  }
  private clearCollection(index: number) {
    const collection = this.collections.get(index); if (!collection) return;
    this.collections.delete(index);
    for (const timer of collection.timers) timer.remove(false);
    this.tweens.killTweensOf([collection.node, ...collection.targets]);
    for (const dot of collection.sparks) { this.tweens.killTweensOf(dot); dot.setVisible(false); }
    collection.node.destroy(true);
  }
  /** A bounded visual snapshot of an already committed collection, owned by its slot. */
  private collect(event: GameEvent, moved: string[], index: number, contact?: () => void) {
    const target = this.metrics.targets.find(t => t.location.kind === 'foundation' && t.location.index === index)!;
    const leaderId = event.cards?.find(id => this.options.deal.cards[id].leader); if (!leaderId) return;
    this.collectionOrigins.set(this.options.deal.cards[leaderId].category, index);
    const reduced = this.options.getSave().settings.reducedMotion || new URLSearchParams(location.search).get('fxCards') === '0';
    const node = this.add.container(target.x, target.y).setDepth(610); this.world.add(node);
    const collection: CollectionView = { node, targets: [], timers: [], sparks: [] }; this.collections.set(index, collection);
    const arriving: Phaser.GameObjects.Container[] = [];
    const previousId = this.foundationFaces.get(index);
    if (previousId && !moved.includes(previousId)) {
      const old = this.copyCard(previousId); old.node.setPosition(0, 0).setScale(1).setAlpha(1).setAngle(0);
      old.face.setVisible(true); old.back.setVisible(false);
      const total = event.cards!.length - 1, count = total - moved.length, dots = this.add.graphics();
      for (let i = 0; i < total; i++) {
        const x = (i - (total - 1) / 2) * Math.min(11, (this.cardW - 30) / Math.max(1, total));
        dots.fillStyle(i < count ? 0x218e95 : 0xe7ece4).fillCircle(x, this.cardH / 2 - 22, 3.6).lineStyle(1, 0x7b9ca5).strokeCircle(x, this.cardH / 2 - 22, 3.6);
      }
      old.face.add(dots); node.add(old.node); arriving.push(old.node);
    }
    for (const id of moved) {
      const copy = this.copyCard(id); copy.node.setPosition(copy.node.x - target.x, copy.node.y - target.y);
      node.add(copy.node); arriving.push(copy.node);
      if (!reduced) this.tweens.add({ targets: copy.node, x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, duration: 145, ease: 'Cubic.easeOut' });
      else copy.node.setPosition(0, 0).setScale(1);
    }
    let header: Phaser.GameObjects.Container | undefined;
    if (previousId) {
      const y = -this.cardH / 2 - 12;
      const background = this.add.graphics().fillStyle(0xedbb8d).fillRoundedRect(-this.cardW / 2 + 5, y - 14, this.cardW - 10, 29, 7);
      const title = this.add.text(0, y, categoryCaption(this.options.deal.cards[leaderId].text), { fontFamily: 'Nunito, Arial', fontSize: '18px', fontStyle: 'bold', color: '#886347' }).setOrigin(.5);
      title.setScale(Math.min(1, (this.cardW - 18) / Math.max(1, title.width)));
      header = this.add.container(0, 0, [background, title]); node.addAt(header, 0);
    }
    const completed = this.makeCard(leaderId), count = event.cards!.length - 1;
    completed.node.setPosition(0, 0).setScale(1).setAlpha(1).setAngle(0).setVisible(false);
    completed.face.setVisible(true); completed.back.setVisible(false); completed.strip?.setVisible(false);
    completed.badge.setText(`${count} / ${count}`);
    const halo = this.add.graphics()
      .fillStyle(0xfff1b9, .65).fillRoundedRect(-this.cardW / 2 + 9, -this.cardH / 2 + 5, this.cardW - 18, 6, 3)
      .fillStyle(0xffe3a5, .28).fillRoundedRect(-this.cardW / 2 + 5, -this.cardH / 2 + 10, 5, this.cardH * .43, 2.5).setAlpha(0);
    node.add([halo, completed.node]); collection.targets.push(...arriving, completed.node, halo);
    const alive = () => this.collections.get(index) === collection;
    const land = () => {
      if (!alive()) return;
      arriving.forEach(card => card.setVisible(false)); header?.setVisible(false); completed.node.setVisible(true);
      contact?.();
      this.showPraise(['Отлично!', 'Есть связь!', 'Так держать!', 'Блестяще!'][this.praiseIndex++ % 4]);
      if (!reduced) {
        halo.setAlpha(1); this.tweens.add({ targets: halo, alpha: 0, duration: 210, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: completed.node, scaleX: 1.035, scaleY: 1.035, duration: 65, yoyo: true, ease: 'Sine.easeOut' });
        this.collectionSparks(target.x, target.y, collection);
      }
      collection.timers.push(this.time.delayedCall(reduced ? 130 : 120, () => {
        if (!alive()) return;
        if (reduced) this.clearCollection(index);
        else this.tweens.add({ targets: node, y: target.y - 7, scaleX: .86, scaleY: .86, alpha: 0, duration: 155, ease: 'Cubic.easeIn', onComplete: () => { if (alive()) this.clearCollection(index); } });
      }));
    };
    if (reduced) land(); else collection.timers.push(this.time.delayedCall(145, land));
  }
  private collectionSparks(x: number, y: number, collection: CollectionView) {
    if (new URLSearchParams(location.search).get('fxParticles') === '0') return;
    for (let i = 0; i < 5; i++) {
      const dot = this.particles.find(p => !p.visible); if (!dot) break;
      const side = i % 2 ? 1 : -1, py = (Math.floor(i / 2) - 1) * this.cardH * .32;
      const paper = i % 3 === 0;
      dot.setTexture(paper ? 'art-card-face' : 'art-spark').setTint(paper ? 0xffefcf : 0xffe3a5)
        .setPosition(x + side * this.cardW * .46, y + py).setDisplaySize(paper ? 7 : 12, paper ? 10 : 12).setAlpha(.95).setRotation(i * .8).setVisible(true);
      collection.sparks.push(dot);
      this.tweens.add({ targets: dot, x: dot.x + side * 13, y: dot.y - 12, scaleX: dot.scaleX * .3, scaleY: dot.scaleY * .3, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => dot.setVisible(false) });
    }
  }
  /** Decorative work has no domain ownership and must not outlive its screen. */
  public clearFeedback(): void {
    this.presentationGeneration++;
    this.clearKeys();
    for (const pending of this.coveredFaces.values()) this.finishCovers(pending.frontId);
    this.settleSurfaces();
    for (const index of this.collections.keys()) this.clearCollection(index);
    this.cues.forEach(c => this.destroyCue(c)); this.cues = [];
    for (const object of [...this.particles, ...this.keyFlights]) {
      if (!object) continue;
      this.tweens.killTweensOf(object); object.setVisible(false);
    }
  }
  private showPraise(text: string) { this.options.praise(text); }
  private point(pointer: BoardPointer) { return { x: (pointer.x - this.world.x) / this.unit, y: (pointer.y - this.world.y) / this.unit }; }
  private get cssUnit() { return this.unit * this.scale.zoom; }
  private destroyCue(cue: Phaser.GameObjects.Container) { this.tweens.killTweensOf([cue, ...cue.list]); cue.destroy(true); }
  private cue(x: number, y: number, color: number, shake = false, delay = 0) {
    while (this.cues.length >= 4) this.destroyCue(this.cues.shift()!);
    const wash = this.add.graphics().fillStyle(color, shake ? .2 : .08).fillRoundedRect(-this.cardW / 2 + 3, -this.cardH / 2 + 3, this.cardW - 6, this.cardH - 6, 13);
    const streak = this.add.graphics().fillStyle(color, .9).fillRoundedRect(-this.cardW * .17, this.cardH / 2 - 7, this.cardW * .34, 3, 1.5);
    const cue = this.add.container(x, y, [wash, streak]).setDepth(690).setAlpha(delay ? 0 : 1);
    this.world.add(cue); this.world.sort('depth'); this.cues.push(cue);
    if (!shake && !this.options.getSave().settings.reducedMotion) {
      streak.x = -this.cardW * .27;
      this.tweens.add({ targets: streak, x: this.cardW * .27, duration: 180, delay, ease: 'Sine.easeInOut' });
    }
    if (shake && !this.options.getSave().settings.reducedMotion) this.tweens.add({ targets: cue, x: x + 5, duration: 45, yoyo: true, repeat: 2 });
    this.tweens.add({ targets: cue, alpha: 1, delay, duration: delay ? 45 : 0, onComplete: () => {
      this.tweens.add({ targets: cue, alpha: 0, delay: shake ? 100 : 55, duration: 160, onComplete: () => { this.cues = this.cues.filter(c => c !== cue); this.destroyCue(cue); } });
    } });
    this.game.loop.wake();
  }
  public reject(command?: BoardCommand) {
    const target = command?.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, command.to)) : undefined;
    if (target) this.cue(target.x, target.y, 0xe9a08a, true);
  }
  private hitSource(x: number, y: number): Location | null {
    const board = this.options.getSave().attempt.board;
    for (const pose of [...this.metrics.poses].sort((a, b) => this.views.get(b.id)!.node.depth - this.views.get(a.id)!.node.depth)) {
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
    return [...this.metrics.poses].sort((a, b) => this.views.get(b.id)!.node.depth - this.views.get(a.id)!.node.depth).find(p => this.views.get(p.id)!.node.visible && p.faceUp && inside(x, y, { x: this.views.get(p.id)!.node.x, y: this.views.get(p.id)!.node.y, width: this.cardW, height: this.cardH }));
  }
  private down(pointer: BoardPointer) {
    if (!this.enabled || !pointer.primaryDown || this.press) return;
    // A new gesture may use an already-unlocked column immediately.
    // Settle the cosmetic lock before deciding which visible card was touched.
    this.clearKeys();
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
    this.dragPointer = pointer;
    if (press.liftedAt === undefined) { press.liftedAt = performance.now(); if (press.from && press.poses.length > 1) this.options.sound('gather'); }
    const reduced = this.options.getSave().settings.reducedMotion, now = performance.now();
    const progress = reduced ? 1 : 1 - (1 - Math.min(1, (now - press.liftedAt) / 80)) ** 3;
    const motion = press.motion ??= { x, at: now, tilt: 0 }, dt = Math.max(1, now - motion.at);
    const wantedTilt = reduced ? 0 : Phaser.Math.Clamp((x - motion.x) * this.cssUnit / dt * 1.2, -1.4, 1.4);
    motion.tilt += (wantedTilt - motion.tilt) * (1 - Math.exp(-dt / 55));
    motion.x = x; motion.at = now;
    const tilt = reduced ? 0 : motion.tilt * progress;
    const lift = 68 / this.cssUnit * progress;
    const gathering = Boolean(press.from && press.poses.length > 1), gap = Math.min(10, 28 / Math.max(1, press.poses.length - 1));
    const heldY = press.poses.map((pose, i) => gathering ? Phaser.Math.Linear(pose.y, press.y - (press.poses.length - i - 1) * gap, progress) : pose.y);
    const minY = Math.min(...heldY), maxY = Math.max(...heldY);
    const dx = Phaser.Math.Clamp(x - press.x, (6 / this.scale.zoom - this.world.x) / this.unit + this.cardW / 2 - press.poses[0].x, (this.scale.width - 6 / this.scale.zoom - this.world.x) / this.unit - this.cardW / 2 - press.poses[0].x);
    const dy = Phaser.Math.Clamp(y - press.y - lift, (6 / this.scale.zoom - this.world.y) / this.unit + this.cardH / 2 - minY, (this.scale.height - 6 / this.scale.zoom - this.world.y) / this.unit - this.cardH / 2 - maxY);
    press.poses.forEach((pose, i) => {
      const view = this.views.get(pose.id)!;
      this.tweens.killTweensOf(view.node);
      this.tweens.killTweensOf(view.shade);
      const front = i === press.poses.length - 1;
      view.content.setVisible(front); view.caption?.setVisible(front); view.strip?.setVisible(false);
      if (gathering && front && !this.options.deal.cards[pose.id].rank && !this.options.deal.cards[pose.id].leader) view.badge.setVisible(false);
      view.shade.setAlpha(front ? 0 : .16 * progress);
      view.shadow.setPosition(-tilt * .6, 4 * progress).setScale(1 + .03 * progress).setAlpha(front ? 1 : .45);
      view.node.setPosition(pose.x + dx, heldY[i] + dy).setScale(1 + .035 * progress).setAngle(tilt).setDepth(800 + i);
    });
    const front = press.poses.at(-1);
    this.dragCount.setVisible(press.poses.length > 1);
    if (front) { const node = this.views.get(front.id)!.node; this.dragCount.setDepth(850).setText(`×${press.poses.length}`).setFontSize(Math.max(20, 12 / this.cssUnit)).setPosition(node.x - this.cardW / 2 + 14, node.y - this.cardH / 2 + 12); }
    this.world.sort('depth');
    this.drawSlots();
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
    this.pendingReturn = press.moved ? press : null;
    const { x, y } = this.point(pointer);
    if (reader && press.inspectId) { this.cancel(press); this.options.peek?.(press.inspectId); return; }
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
    } else if (press.moved || !press.from || press.toggle) this.cancel(press);
    else this.drawFocus();
  }
  private targetLight(target: Target, valid = true, progress = 1) {
    const color = valid ? 0xffdc98 : 0xe5a591, { x, y } = target;
    this.focus.fillStyle(color, (valid ? .13 : .09) * progress).fillRoundedRect(x - this.cardW / 2 + 3, y - this.cardH / 2 + 3, this.cardW - 6, this.cardH - 6, 14);
    this.focus.fillStyle(color, .85 * progress).fillRoundedRect(x - this.cardW * .3, y + this.cardH / 2 - 7, this.cardW * .6, 4, 2);
  }
  private drawFocus(hover?: Target | null) {
    if (!this.focus) return;
    this.focus.clear();
    if (this.jokerSelecting) for (const t of this.metrics.targets.filter(t => t.location.kind === 'tableau' && this.options.getSave().attempt.board.tableau[t.location.index].length && !isLocked(this.options.getSave().attempt.board, t.location.index, this.options.deal))) {
      this.targetLight(t);
    }
    if (this.selected && !this.press?.moved) {
      for (const id of sourceCards(this.options.getSave().attempt.board, this.selected, this.options.deal)) {
        const view = this.views.get(id)!;
        this.tweens.killTweensOf(view.node);
        this.tweens.killTweensOf([view.face, view.back]);
        view.face.setVisible(true).setScale(1); view.back.setVisible(false).setScale(1);
        view.node.setAlpha(1).setScale(this.options.getSave().settings.reducedMotion ? 1 : 1.025);
        view.shadow.setPosition(0, 3).setScale(1.035);
      }
    }
    if (hover && this.selected) {
      const valid = typeof applyBoard(this.options.getSave().attempt.board, { type: 'transfer', from: this.selected, to: hover.location }, this.options.deal) !== 'string';
      const key = `${hover.location.kind}:${hover.location.index}:${valid}`;
      if (this.hoverKey !== key) { this.hoverKey = key; this.hoverSince = performance.now(); }
      this.targetLight(hover, valid, this.options.getSave().settings.reducedMotion ? 1 : Math.min(1, (performance.now() - this.hoverSince) / 75));
    } else this.hoverKey = '';
  }
  public setJoker(active: boolean): void { this.cancel(); this.jokerSelecting = active; this.options.jokerMode?.(active); this.drawFocus(); this.game.loop.wake(); }
  public cancel(press = this.press ?? this.pendingReturn): void {
    const board = this.options.getSave().attempt.board;
    const index = press?.moved && press.from?.kind === 'tableau' ? press.from.index : -1;
    const returning = index >= 0 && board.tableau[index]?.length && board.tableau[index].every(id => press!.poses.some(p => p.id === id)) && !this.options.getSave().settings.reducedMotion
      ? { ids: press!.poses.map(p => p.id), y: this.metrics.poses.find(p => p.id === board.tableau[index][0])!.y } : undefined;
    this.jokerSelecting = false; this.options.jokerMode?.(false); this.options.peek?.(null); this.press = null; this.dragPointer = undefined; this.selected = null; this.dragCount?.setVisible(false);
    if (this.world) { this.sync([], false, undefined, undefined, press?.poses.map(p => p.id)); if (returning) { this.returningWells.set(index, returning); this.drawSlots(); } }
  }
  public back(): boolean { if (!this.jokerSelecting && !this.press && !this.selected && !this.hintObjects.length) return false; this.clearHint(); this.cancel(); return true; }
  public setEnabled(value: boolean): void { this.enabled = value; if (!value) { this.clearHint(); this.options.peek?.(null); if (this.press || this.selected || this.jokerSelecting) this.cancel(); } }
  public setInspect(value: boolean): void { this.inspectMode = value; this.clearHint(); this.cancel(); }
  public clearHint(): void { this.hintTweens.forEach(t => t.stop()); this.hintTweens = []; this.hintObjects.forEach(o => o.destroy()); this.hintObjects = []; }
  public hint(action: BoardCommand): void { this.cancel(); this.demonstrate(action, false); }
  /** One action at a time, following the real board; cosmetic and non-blocking. */
  public teach(action: BoardCommand): void { this.demonstrate(action, true); }
  private demonstrate(action: BoardCommand, teaching: boolean): void {
    this.clearHint();
    if (!this.enabled || this.press || this.selected || this.inspectMode) return;
    const source = action.type === 'transfer' ? sourceCards(this.options.getSave().attempt.board, action.from, this.options.deal) : [];
    const from = action.type === 'transfer' ? this.metrics.poses.find(p => p.id === source.at(-1)) : this.metrics.stock;
    const target = action.type === 'transfer' ? this.metrics.targets.find(t => same(t.location, action.to)) : this.metrics.stock;
    if (!from || !target) return;
    const light = (p: { x: number; y: number }) => {
      const g = this.add.graphics().setDepth(698).setAlpha(0);
      g.fillStyle(0xffe1a0, .16).fillRoundedRect(p.x - this.cardW / 2 + 3, p.y - this.cardH / 2 + 3, this.cardW - 6, this.cardH - 6, 13);
      g.fillStyle(0xffe1a0, .95).fillRoundedRect(p.x - this.cardW * .27, p.y + this.cardH / 2 - 7, this.cardW * .54, 4, 2);
      this.world.add(g); return g;
    };
    const origin = light(from), destination = light(target);
    let ghost: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
    if (teaching) {
      const h = Math.max(70, 32 / this.unit);
      ghost = this.add.image(from.x, from.y, 'tutorial-hand').setOrigin(.43, .06).setDisplaySize(h * .66, h);
    } else if (action.type === 'transfer') {
      const copy = this.makeCard(source.at(-1)!);
      copy.face.setVisible(true); copy.back.setVisible(false);
      copy.badge.setText(source.length > 1 ? `×${source.length}` : this.views.get(source.at(-1)!)!.badge.text);
      ghost = copy.node;
    } else ghost = this.add.image(0, 0, this.options.getSave().settings.cardBack === 'diamonds' ? 'art-card-back-diamonds' : 'art-card-back-classic').setDisplaySize(this.cardW, this.cardH);
    ghost.setPosition(from.x, from.y).setVisible(true).setAlpha(0).setDepth(700);
    this.world.add(ghost); this.world.sort('depth'); this.hintObjects.push(origin, destination, ghost);
    if (this.options.getSave().settings.reducedMotion) {
      origin.setAlpha(1); destination.setAlpha(1); ghost.setAlpha(teaching ? 1 : .5);
      this.game.loop.wake(); return;
    }
    const prepare = 220, travel = teaching ? 680 : 500, arrive = 240;
    const cycle = prepare + travel + arrive + (teaching ? 650 : 160);
    // The eye gets the source, the gesture, then its destination. Only this
    // disposable demonstration repeats; it never executes/charges an action.
    this.hintTweens.push(this.tweens.addCounter({ from: 0, to: cycle, duration: cycle, repeat: teaching ? -1 : 1,
      onUpdate: tween => {
        const time = tween.getValue() ?? 0, raw = Phaser.Math.Clamp((time - prepare) / travel, 0, 1);
        const t = Phaser.Math.Easing.Sine.InOut(raw), ending = Phaser.Math.Clamp((time - prepare - travel) / arrive, 0, 1);
        origin.setAlpha(time < prepare ? Math.min(1, time / 80) : Math.max(0, 1 - raw * 5));
        destination.setAlpha(raw < .8 ? 0 : Math.min(1, (raw - .8) * 5) * (1 - ending));
        ghost.setAlpha((teaching ? 1 : .6) * Math.min(1, time / 100) * (1 - ending));
        ghost.setPosition(Phaser.Math.Linear(from.x, target.x, t), Phaser.Math.Linear(from.y, target.y, t) + (action.type === 'transfer' ? 0 : Math.sin(Math.PI * raw) * 10));
      }, onComplete: () => this.clearHint() }));
    this.game.loop.wake();
  }
  public hasMotion(): boolean { return this.tweens.getTweens().length > 0 || this.collections.size > 0 || Boolean(this.keyPresentation) || Boolean(this.press?.moved); }
  public update(): void { if (this.press?.moved && this.dragPointer) this.move(this.dragPointer); }
  public geometry() { return this.metrics; }
}
