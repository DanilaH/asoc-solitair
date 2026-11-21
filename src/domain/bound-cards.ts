import type { Board, Deal } from './types';

export function isBoundCard(board: Board, deal: Deal, id: string | undefined): boolean {
  const scissors = id === undefined ? undefined : deal.bound?.scissorsByCard[id];
  return Boolean(scissors && !board.collected.includes(scissors) && !board.foundations.some(pile => pile.includes(scissors)));
}
