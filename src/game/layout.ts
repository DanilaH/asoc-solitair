import type { Board, BonusKind, Deal, Location } from '../domain/types';
import { packet } from '../domain/engine';
import { bonusKinds, bonusOffer, pilesFor } from '../domain/bonus-slots';
export const WIDTH = 540;
export const CARD_W = 138;
export const CARD_H = 166;
const GAP = 14;
const FAN_STEP = 32;
const TOP_MARGIN = 5;
const BOTTOM_MARGIN = 12;
const STOCK_DEPTH = 18;
const FOUNDATION_TAB = 26;
const DECK_GAP = 7;
const ROW_GAP = 10;
export const slotCount = (deal: Deal, kind: BonusKind) =>
  pilesFor(deal.initial, kind).length + Number(Boolean(bonusOffer(deal, kind)));
const columnCount = (deal: Deal) => Math.max(slotCount(deal, 'tableau'), slotCount(deal, 'foundation'));
export const cardMetrics = (_deal: Deal) => ({ width: CARD_W, height: CARD_H });
const hasDeck = (deal: Deal) => Boolean(deal.initial.stock.length || deal.initial.waste.length);
const pileRoom = (deal: Deal) => {
  const layers = Math.max(0, ...deal.initial.tableau.map(pile => pile.length - 1));
  return Math.min(92, layers * 12 + (layers ? 12 : 0));
};
function minimumHeight(deck: boolean, bottom: boolean) {
  return 2 * CARD_H + TOP_MARGIN + BOTTOM_MARGIN + FOUNDATION_TAB + ROW_GAP +
    (deck ? CARD_H + STOCK_DEPTH + (bottom ? ROW_GAP : DECK_GAP) : 0);
}
/** Fit immutable Deal geometry in the usable field. Moves cannot change the card scale. */
export function boardFrame(width: number, height: number, deckPosition: 'top' | 'bottom' = 'top', deal: Deal) {
  const deck = hasDeck(deal);
  const columns = columnCount(deal);
  const gridWidth = columns * CARD_W + Math.max(0, columns - 1) * GAP;
  const fanWidth = deck ? 2 * CARD_W + GAP + 2 * FAN_STEP : 0;
  const unit = Math.min(width / Math.max(gridWidth, fanWidth), height / (minimumHeight(deck, deckPosition === 'bottom') + pileRoom(deal)));
  return { unit, offsetX: 0, width: width / unit, height: height / unit };
}
export interface Pose { id: string; x: number; y: number; depth: number; faceUp: boolean }
export interface Target { location: Location; x: number; y: number; width: number; height: number }
interface BonusTarget { kind: BonusKind; x: number; y: number; width: number }
/** A movable packet with a leader always shows that leader on its face. */
export function tableauPresentation(board: Board, deal: Deal, index: number): string[] {
  const column = board.tableau[index], moving = packet(board, index, deal);
  const leader = moving.find(id => deal.cards[id].leader);
  if (!leader || moving.at(-1) === leader) return column;
  return [...column.slice(0, -moving.length), ...moving.filter(id => id !== leader), leader];
}
/** Forgive only an unambiguous geometric near miss; the engine still validates the move. */
export function dropTarget(targets: Target[], x: number, y: number, tolerance: number): Target | null {
  const distance = (t: Target) => Math.hypot(Math.max(0, Math.abs(x - t.x) - t.width / 2), Math.max(0, Math.abs(y - t.y) - t.height / 2));
  const direct = targets.find(t => distance(t) === 0);
  if (direct) return direct;
  const near = targets.filter(t => distance(t) <= tolerance);
  return near.length === 1 ? near[0] : null;
}
/** Card and finger are both intentional drop anchors. Never choose an unrelated legal slot. */
export function dragTarget(targets: Target[], finger: { x: number; y: number }, card: { x: number; y: number; width: number; height: number }, tolerance: number, valid: (target: Target) => boolean): Target | null {
  const directCard = dropTarget(targets, card.x, card.y, 0);
  const directFinger = dropTarget(targets, finger.x, finger.y, 0);
  for (const candidate of [directCard, directFinger]) if (candidate && valid(candidate)) return candidate;
  const overlaps = targets.map(target => ({ target, area:
    Math.max(0, Math.min(card.x + card.width / 2, target.x + target.width / 2) - Math.max(card.x - card.width / 2, target.x - target.width / 2)) *
    Math.max(0, Math.min(card.y + card.height / 2, target.y + target.height / 2) - Math.max(card.y - card.height / 2, target.y - target.height / 2)) / (card.width * card.height),
  })).filter(item => item.area >= .3 && valid(item.target)).sort((a, b) => b.area - a.area);
  if (overlaps[0] && (!overlaps[1] || overlaps[0].area - overlaps[1].area > .15)) return overlaps[0].target;
  const near = dropTarget(targets, finger.x, finger.y, tolerance);
  return near && valid(near) ? near : directCard ?? directFinger ?? near;
}
export function layout(board: Board, deal: Deal, frame: Pick<ReturnType<typeof boardFrame>, 'width' | 'height'> | number, deckSide: 'left' | 'right' = 'right', deckPosition: 'top' | 'bottom' = 'top'): { poses: Pose[]; targets: Target[]; offers: BonusTarget[]; stock: { x: number; y: number; thickness: number }; waste: { x: number; y: number }; joker?: { x: number; y: number; depth: number } } {
  const poses: Pose[] = [], targets: Target[] = [], offers: BonusTarget[] = [];
  let joker: { x: number; y: number; depth: number } | undefined;
  const cardW = CARD_W, cardH = CARD_H;
  const { width, height } = typeof frame === 'number' ? { width: WIDTH, height: frame } : frame;
  const center = (index: number) => cardW / 2 + index * (cardW + GAP);
  const deck = hasDeck(deal), bottom = deckPosition === 'bottom' && deck;
  const left = deckSide === 'left' && deck;
  const spacing = Math.min(14, Math.max(0, (height - minimumHeight(deck, bottom) - pileRoom(deal)) / 4));
  const deckY = bottom ? height - cardH / 2 - BOTTOM_MARGIN : cardH / 2 + TOP_MARGIN + STOCK_DEPTH;
  const originalStock = deal.initial.stock.length + deal.initial.waste.length;
  const thickness = board.stock.length > 1 ? 3 + (STOCK_DEPTH - 3) * Math.min(1, (board.stock.length - 1) / Math.max(1, originalStock - 1)) : 0;
  const stock = { x: left ? cardW / 2 : width - cardW / 2, y: deckY - thickness, thickness };
  // The first card lands beside the stock; further draws open away from it.
  // Preserve earlier positions while the initial three-card fan is opening.
  const fanWidth = Math.max(0, Math.min(3, board.waste.length) - 1) * FAN_STEP;
  const waste = { x: stock.x + (left ? 1 : -1) * (cardW + GAP + fanWidth), y: deckY };
  const top = cardH / 2 + TOP_MARGIN + FOUNDATION_TAB + spacing + (deck && !bottom ? STOCK_DEPTH + cardH + DECK_GAP : 0);
  board.foundations.forEach((ids, index) => {
    const x = center(index);
    targets.push({ location: { kind: 'foundation', index }, x, y: top, width: cardW + 8, height: cardH + 8 });
    ids.forEach((id, i) => poses.push({ id, x, y: top, depth: 20 + i, faceUp: true }));
  });
  // Keep the same floor when the stock fan empties, recycles or is restored.
  const tableauBottom = bottom ? deckY - cardH / 2 - STOCK_DEPTH - ROW_GAP - spacing : height - BOTTOM_MARGIN;
  const tableauY = top + cardH + ROW_GAP + spacing;
  board.tableau.forEach((_, index) => {
    const x = center(index);
    let y = tableauY;
    const entries: (string | null)[] = [...tableauPresentation(board, deal, index)];
    if (board.joker?.column === index) entries.splice(board.joker.boundary, 0, null);
    const steps = entries.slice(0, -1), open = steps.filter(id => id === null || board.faceUp.includes(id)).length, closed = steps.length - open;
    const available = Math.max(0, tableauBottom - tableauY - cardH / 2);
    let closedStep = 18, openStep = 44;
    if (closed && open * openStep + closed * closedStep > available)
      closedStep = Math.min(18, Math.max(6, (available - open * openStep) / closed), available / (closed + 2 * open));
    if (open * openStep + closed * closedStep > available) openStep = Math.max(0, (available - closed * closedStep) / Math.max(1, open));
    // The front card remains fully inside the board; closed strips compress before open captions.
    entries.forEach((id, i) => {
      if (id === null) joker = { x, y, depth: 50 + i };
      else poses.push({ id, x, y, depth: 50 + i, faceUp: board.faceUp.includes(id) });
      if (i < entries.length - 1) y += id === null || board.faceUp.includes(id) ? openStep : closedStep;
    });
    targets.push({ location: { kind: 'tableau', index }, x, y, width: cardW + 12, height: cardH + 8 });
  });
  // Fan away from the stock: even the rear waste cards keep a visible gap.
  board.waste.slice(-3).forEach((id, i, shown) => poses.push({ id, x: waste.x + (shown.length - i - 1) * (left ? -FAN_STEP : FAN_STEP), y: waste.y, depth: 35 + i, faceUp: true }));
  for (const kind of bonusKinds) {
    const offer = bonusOffer(deal, kind);
    if (offer && pilesFor(board, kind).length === offer.index) offers.push({
      kind, x: center(offer.index), y: kind === 'foundation' ? top : tableauY, width: cardW,
    });
  }
  return { poses, targets, offers, stock, waste, joker };
}
