import type { Board, BonusKind, Deal, Location } from '../domain/types';
import { packet } from '../domain/engine';
import { bonusKinds, bonusOffer, pilesFor } from '../domain/bonus-slots';
export const WIDTH = 540;
export const CARD_W = 138;
export const CARD_H = 166;
export const BOTTOM_DECK_MARGIN = 12;
export const GRID_GAP = 14;
export const DECK_TOP = 20;
const MAX_STOCK_THICKNESS = 18;
const FOUNDATION_TITLE = 26;
const ROW_GAP = 14;
export const TAP_SLOP_CSS = 10;
/** A logical distance is a tap only while it remains below 10 CSS px. */
export const exceedsTapSlop = (dx: number, dy: number, cssUnit: number) =>
  Math.hypot(dx, dy) * cssUnit >= TAP_SLOP_CSS;
export const slotCount = (deal: Deal, kind: BonusKind) =>
  pilesFor(deal.initial, kind).length + Number(Boolean(bonusOffer(deal, kind)));
const columnCount = (deal: Deal) => Math.max(slotCount(deal, 'tableau'), slotCount(deal, 'foundation'));
/** One logical card material, including all overlays and temporary copies.
 * Fit the complete reserved grid with a uniform world scale, not a narrower card.
 */
export function cardMetrics(_deal: Deal) { return { width: CARD_W, height: CARD_H }; }
const gridWidth = (deal?: Deal) => {
  const columns = deal ? columnCount(deal) : 3;
  return Math.max(WIDTH, columns * CARD_W + Math.max(0, columns - 1) * GRID_GAP);
};
const hasStockRow = (deal?: Deal) => !deal || Boolean(deal.initial.stock.length || deal.initial.waste.length);
const foundationTop = (bottom: boolean, hasDeck: boolean) => bottom ? FOUNDATION_TITLE + 4
  : hasDeck ? DECK_TOP + CARD_H + FOUNDATION_TITLE + 10 : DECK_TOP + 132 + FOUNDATION_TITLE + 4;
const bottomReserve = (bottom: boolean) => bottom ? BOTTOM_DECK_MARGIN + CARD_H + MAX_STOCK_THICKNESS + ROW_GAP : 12;
/** Fit width and structural row height plus a small authored-stack allowance.
 * Only immutable deal geometry and the usable viewport affect scale. Stock
 * counts, bonus purchases, packet lengths and Undo never change the axes.
 */
export function boardFrame(width: number, height: number, deckPosition: 'top' | 'bottom' = 'top', deal?: Deal) {
  const hasDeck = hasStockRow(deal), bottom = deckPosition === 'bottom' && hasDeck;
  const initialDepth = deal ? Math.max(1, ...deal.initial.tableau.map(pile => pile.length)) : 6;
  const strips = Math.max(30, Math.min(80, (initialDepth - 1) * 8));
  const neededHeight = foundationTop(bottom, hasDeck) + CARD_H * 2 + ROW_GAP + strips + bottomReserve(bottom);
  const unit = Math.min(width / gridWidth(deal), height / neededHeight);
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
  const { width: cardW, height: cardH } = cardMetrics(deal);
  const { width, height } = typeof frame === 'number' ? { width: gridWidth(deal), height: frame } : frame;
  const deckGap = GRID_GAP;
  // Both rows share a left origin and pitch, irrespective of their own length.
  // The immutable grid width includes the unpurchased bonus slots.
  const center = (index: number) => cardW / 2 + index * (cardW + GRID_GAP);
  const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
  const bottom = deckPosition === 'bottom' && hasDeck;
  const left = deckSide === 'left' && hasDeck;
  const deckY = bottom ? height - cardH / 2 - BOTTOM_DECK_MARGIN : cardH / 2 + DECK_TOP;
  const originalStock = deal.initial.stock.length + deal.initial.waste.length;
  const thickness = board.stock.length > 1 ? 3 + 15 * Math.min(1, (board.stock.length - 1) / Math.max(1, originalStock - 1)) : 0;
  const stock = { x: left ? cardW / 2 : width - cardW / 2, y: deckY - thickness, thickness };
  const fanStep = 32;
  // The first card lands beside the stock; further draws open away from it.
  // Preserve earlier positions while the initial three-card fan is opening.
  const fanWidth = Math.max(0, Math.min(3, board.waste.length) - 1) * fanStep;
  const waste = { x: stock.x + (left ? 1 : -1) * (cardW + deckGap + fanWidth), y: deckY };
  const top = cardH / 2 + foundationTop(bottom, hasDeck);
  board.foundations.forEach((ids, index) => {
    const x = center(index);
    targets.push({ location: { kind: 'foundation', index }, x, y: top, width: cardW + 8, height: cardH + 8 });
    ids.forEach((id, i) => poses.push({ id, x, y: top, depth: 20 + i, faceUp: true }));
  });
  const tableauBottom = height - bottomReserve(bottom);
  const tableauY = top + cardH + ROW_GAP;
  board.tableau.forEach((_, index) => {
    const x = center(index);
    let y = tableauY;
    const entries: (string | null)[] = [...tableauPresentation(board, deal, index)];
    if (board.joker?.column === index) entries.splice(board.joker.boundary, 0, null);
    const steps = entries.slice(0, -1), open = steps.filter(id => id === null || board.faceUp.includes(id)).length, closed = steps.length - open;
    const available = Math.max(0, tableauBottom - tableauY - cardH / 2);
    let closedStep = 18, openStep = 44;
    if (closed && open * openStep + closed * closedStep > available)
      closedStep = Math.min(18, Math.max(4, (available - open * openStep) / closed), available / closed);
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
  board.waste.slice(-3).forEach((id, i, shown) => poses.push({ id, x: waste.x + (shown.length - i - 1) * (left ? -fanStep : fanStep), y: waste.y, depth: 35 + i, faceUp: true }));
  for (const kind of bonusKinds) {
    const offer = bonusOffer(deal, kind);
    if (offer && pilesFor(board, kind).length === offer.index) offers.push({
      kind, x: center(offer.index), y: kind === 'foundation' ? top : tableauY, width: cardW,
    });
  }
  return { poses, targets, offers, stock, waste, joker };
}
