import type { Board, Deal } from './types';

export function picturePair(deal: Deal, id: string) {
  return deal.puzzle?.pairs.find(candidate => candidate.top === id || candidate.bottom === id);
}

export function puzzleHalf(deal: Deal, id: string): 'top' | 'bottom' | undefined {
  const pair = picturePair(deal, id);
  return pair ? pair.top === id ? 'top' : 'bottom' : undefined;
}

export function isPictureJoined(board: Board, pair: { top: string; bottom: string }): boolean {
  return [...board.tableau, ...board.foundations].some(pile => {
    const top = pile.indexOf(pair.top);
    return top > 0 && pile[top - 1] === pair.bottom;
  });
}

export function puzzleError(deal: Deal, cards: readonly string[], allowSingle: boolean): string | undefined {
  if (allowSingle && cards.length === 1) return;
  for (const pair of deal.puzzle?.pairs ?? []) {
    const top = cards.indexOf(pair.top), bottom = cards.indexOf(pair.bottom);
    if ((top >= 0 || bottom >= 0) && (bottom < 0 || top !== bottom + 1)) return 'Положите верхнюю половину на её нижнюю';
  }
}
