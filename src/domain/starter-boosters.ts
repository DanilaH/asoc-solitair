import type { Board, Deal } from './types';

export type StarterBooster = 'magnet' | 'hammer';

export function matchingStock(board: Board, deal: Deal, category: string): number {
  return board.stock.findIndex(id => deal.cards[id].category === category);
}

export function hammerCard(board: Board, deal: Deal): string | undefined {
  const locked = deal.lock && !deal.lock.requiredKeys.every(key => board.keys?.includes(key)) ? deal.lock.column : undefined;
  for (const [index, column] of board.tableau.entries()) {
    if (index === locked) continue;
    const firstVisible = column.findIndex(id => board.faceUp.includes(id));
    if (firstVisible > 0) return column[firstVisible - 1];
  }
}
