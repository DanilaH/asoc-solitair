import type { Board, Deal } from './types';

export function isBoundCard(board: Board, deal: Deal, id: string | undefined): boolean {
  if (board.hitapps) return Boolean(id && board.hitapps.cards[id]?.bound === 2);
  const scissors = id === undefined ? undefined : deal.bound?.scissorsByCard[id];
  return Boolean(scissors && !board.collected.includes(scissors) && !board.foundations.some(pile => pile.includes(scissors)));
}
