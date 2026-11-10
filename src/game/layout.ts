import type { Board, Deal, Location } from '../domain/types';
export const WIDTH = 540;
export const CARD_W = 138;
export const CARD_H = 166;
export const cardMetrics = (deal: Deal) => deal.initial.tableau.length >= 4 ? { width: 108, height: 148 } : { width: CARD_W, height: CARD_H };
/** Reserve enough logical height even when a real native banner shortens the canvas. */
export function boardFrame(width: number, height: number, deckPosition: 'top' | 'bottom' = 'top', deal?: Deal) {
  const hasDeck = !deal || Boolean(deal.initial.stock.length || deal.initial.waste.length);
  const unit = Math.min(width / WIDTH, height / (deckPosition === 'bottom' && hasDeck ? 600 : 565));
  return { unit, offsetX: (width - WIDTH * unit) / 2, height: height / unit };
}
export interface Pose { id: string; x: number; y: number; depth: number; faceUp: boolean }
export interface Target { location: Location; x: number; y: number; width: number; height: number }
export function layout(board: Board, deal: Deal, height: number, deckSide: 'left' | 'right' = 'right', deckPosition: 'top' | 'bottom' = 'top'): { poses: Pose[]; targets: Target[]; stock: { x: number; y: number }; waste: { x: number; y: number }; joker?: { x: number; y: number; depth: number } } {
  const poses: Pose[] = [], targets: Target[] = [];
  let joker: { x: number; y: number; depth: number } | undefined;
  const { width: cardW, height: cardH } = cardMetrics(deal);
  const four = board.tableau.length >= 4;
  const topCenters = deal.campaignLevel === 1 ? [160, 380, 445] : four ? [72, 204, 336, 468] : [95, 270, 445];
  const centers = board.tableau.length === 2 ? [160, 380] : topCenters;
  const hasDeck = Boolean(deal.initial.stock.length || deal.initial.waste.length);
  const bottom = deckPosition === 'bottom' && hasDeck;
  const left = deckSide === 'left' && hasDeck;
  const sideWaste = four && board.foundations.length === 2;
  const foundationCenters = bottom ? board.foundations.map((_, i) => WIDTH * (i + 1) / (board.foundations.length + 1)) : left ? topCenters.slice(sideWaste ? 2 : 1) : topCenters;
  const top = cardH / 2 + (bottom ? 10 : 26);
  board.foundations.forEach((ids, index) => {
    const x = foundationCenters[index];
    targets.push({ location: { kind: 'foundation', index }, x, y: top, width: cardW + 12, height: cardH + 8 });
    ids.forEach((id, i) => poses.push({ id, x: x + Math.min(i, 3) * 1.5, y: top - Math.min(i, 3), depth: 20 + i, faceUp: true }));
  });
  const stock = { x: left ? topCenters[0] : topCenters.at(-1)!, y: bottom ? height - cardH / 2 - 12 : top };
  const waste = { x: bottom ? topCenters[left ? 1 : topCenters.length - 2] : sideWaste ? topCenters[left ? 1 : 2] : stock.x, y: bottom ? stock.y : sideWaste ? top : top + cardH };
  // A deal without a deck needs no reserved waste row; leave room for a visible Joker header.
  const tableauY = bottom ? top + cardH + 12 : sideWaste ? top + cardH + 45 : hasDeck ? top + cardH * 2 + 14 : top + cardH + 60;
  const tableauBottom = bottom ? stock.y - cardH / 2 - 28 : height - 12;
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
  board.waste.slice(-3).forEach((id, i, shown) => poses.push({ id, x: waste.x + (i - shown.length + 1) * 7, y: waste.y, depth: 35 + i, faceUp: true }));
  return { poses, targets, stock, waste, joker };
}
