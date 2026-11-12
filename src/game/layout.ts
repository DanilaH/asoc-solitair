import type { Board, Deal, Location } from '../domain/types';
export const WIDTH = 540;
export const CARD_W = 138;
export const CARD_H = 166;
export const cardMetrics = (deal: Deal) => deal.initial.tableau.length >= 4 ? { width: 124, height: CARD_H } : { width: CARD_W, height: CARD_H };
/** Reserve enough logical height even when a real native banner shortens the canvas. */
export function boardFrame(width: number, height: number, deckPosition: 'top' | 'bottom' = 'top', deal?: Deal) {
  const hasDeck = !deal || Boolean(deal.initial.stock.length || deal.initial.waste.length);
  const unit = Math.min(width / WIDTH, height / (deckPosition === 'bottom' && hasDeck ? 680 : 650));
  return { unit, offsetX: 0, height: height / unit };
}
export interface Pose { id: string; x: number; y: number; depth: number; faceUp: boolean }
export interface Target { location: Location; x: number; y: number; width: number; height: number }
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
export function layout(board: Board, deal: Deal, height: number, deckSide: 'left' | 'right' = 'right', deckPosition: 'top' | 'bottom' = 'top'): { poses: Pose[]; targets: Target[]; stock: { x: number; y: number }; waste: { x: number; y: number }; joker?: { x: number; y: number; depth: number } } {
  const poses: Pose[] = [], targets: Target[] = [];
  let joker: { x: number; y: number; depth: number } | undefined;
  const { width: cardW, height: cardH } = cardMetrics(deal);
  // A short row stays together at the left edge rather than stretching to fill
  // the table. The dense four-column row retains its established safe spacing.
  const gap = board.tableau.length >= 4 ? (WIDTH - cardW * 4) / 3 : 14;
  const centers = board.tableau.map((_, index) => cardW / 2 + index * (cardW + gap));
  const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
  const bottom = deckPosition === 'bottom' && hasDeck;
  const left = deckSide === 'left' && hasDeck;
  // Foundation slots keep the left edge, independently of the deck's side.
  const foundationCenters = centers;
  const stock = { x: left ? cardW / 2 : WIDTH - cardW / 2, y: bottom ? height - cardH / 2 - 12 : cardH / 2 + 8 };
  const fanStep = 22;
  const waste = { x: stock.x + (left ? 1 : -1) * (cardW + gap + fanStep * 2), y: stock.y + (bottom ? -44 : 44) };
  const top = cardH / 2 + (bottom ? 30 : hasDeck ? cardH + 54 : 185);
  board.foundations.forEach((ids, index) => {
    const x = foundationCenters[index];
    targets.push({ location: { kind: 'foundation', index }, x, y: top, width: cardW + 8, height: cardH + 8 });
    ids.forEach((id, i) => poses.push({ id, x, y: top, depth: 20 + i, faceUp: true }));
  });
  const tableauBottom = bottom ? waste.y - cardH / 2 - 28 : height - 12;
  const tableauY = Math.min(top + cardH + (bottom ? 30 : 44), tableauBottom - cardH / 2);
  board.tableau.forEach((ids, index) => {
    let y = tableauY;
    const entries: (string | null)[] = [...ids];
    if (board.joker?.column === index) entries.splice(board.joker.boundary, 0, null);
    const steps = entries.slice(0, -1), open = steps.filter(id => id === null || board.faceUp.includes(id)).length, closed = steps.length - open;
    const available = Math.max(0, tableauBottom - tableauY - cardH / 2);
    let closedStep = 18, openStep = 44;
    if (open * openStep + closed * closedStep > available) closedStep = Math.max(4, Math.min(18, (available - open * openStep) / Math.max(1, closed)));
    if (open * openStep + closed * closedStep > available) openStep = Math.max(0, (available - closed * closedStep) / Math.max(1, open));
    // The front card remains fully inside the board; closed strips compress before open captions.
    entries.forEach((id, i) => {
      if (id === null) joker = { x: centers[index], y, depth: 50 + i };
      else poses.push({ id, x: centers[index], y, depth: 50 + i, faceUp: board.faceUp.includes(id) });
      if (i < entries.length - 1) y += id === null || board.faceUp.includes(id) ? openStep : closedStep;
    });
    targets.push({ location: { kind: 'tableau', index }, x: centers[index], y, width: cardW + 12, height: cardH + 8 });
  });
  // Fan away from the stock: even the rear waste cards keep a visible gap.
  board.waste.slice(-3).forEach((id, i, shown) => poses.push({ id, x: waste.x + (shown.length - i - 1) * (left ? -fanStep : fanStep), y: waste.y - (shown.length - i - 1) * fanStep, depth: 35 + i, faceUp: true }));
  return { poses, targets, stock, waste, joker };
}
