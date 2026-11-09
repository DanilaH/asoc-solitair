import { packet } from '../domain/engine';
import type { Board, Deal, Location } from '../domain/types';
export const WIDTH = 540;
export const CARD_W = 138;
export const CARD_H = 166;
export interface Pose { id: string; x: number; y: number; depth: number; faceUp: boolean }
export interface Target { location: Location; x: number; y: number; width: number; height: number }
export function layout(board: Board, deal: Deal, height: number): { poses: Pose[]; targets: Target[]; stock: { x: number; y: number }; waste: { x: number; y: number } } {
  const poses: Pose[] = [], targets: Target[] = [];
  const centers = [95, 270, 445];
  const top = 109;
  board.foundations.forEach((ids, index) => {
    const x = centers[index];
    targets.push({ location: { kind: 'foundation', index }, x, y: top, width: CARD_W + 16, height: CARD_H + 12 });
    ids.forEach((id, i) => poses.push({ id, x: x + Math.min(i, 3) * 1.5, y: top - Math.min(i, 3), depth: 20 + i, faceUp: true }));
  });
  const tableauY = 455;
  board.tableau.forEach((ids, index) => {
    let y = tableauY;
    const available = packet(board, index, deal);
    const maxOffset = Math.max(12, Math.min(45, (height - tableauY - CARD_H / 2 - 18) / Math.max(1, ids.length - 1)));
    ids.forEach((id, i) => {
      poses.push({ id, x: centers[index], y, depth: 50 + i, faceUp: board.faceUp.includes(id) });
      y += board.faceUp.includes(id) ? maxOffset : Math.min(20, maxOffset);
    });
    targets.push({ location: { kind: 'tableau', index }, x: centers[index], y: ids.length ? y - (ids.at(-1) && board.faceUp.includes(ids.at(-1)!) ? maxOffset : Math.min(20, maxOffset)) : tableauY,
      width: CARD_W + 16, height: CARD_H + 12 + Math.max(0, available.length - 1) * 5 });
  });
  const stock = { x: centers[2], y: top };
  const waste = { x: centers[2], y: top + CARD_H / 2 + 83 };
  board.waste.slice(-3).forEach((id, i, shown) => poses.push({ id, x: waste.x + (i - shown.length + 1) * 9, y: waste.y, depth: 35 + i, faceUp: true }));
  return { poses, targets, stock, waste };
}
