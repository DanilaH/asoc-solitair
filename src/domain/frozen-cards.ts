import type { Board, Deal } from './types';

/** This authored rule thaws one layer per completed category. Undo owns the completed cards. */
export function frozenLayers(board: Board, deal: Deal, id: string | undefined): number {
  if (board.hitapps) return id ? board.hitapps.cards[id]?.ice ?? 0 : 0;
  const initial = id === undefined ? 0 : deal.frozen?.layers[id] ?? 0;
  if (!initial) return 0;
  const finished = board.collected.filter(card => deal.cards[card]?.leader).length;
  return Math.max(0, initial - finished);
}
