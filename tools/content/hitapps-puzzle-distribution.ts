import type { Board, Deal } from '../../src/domain/types';
import { assertBoard } from '../../src/domain/engine';
import { Kind, type SourceCard } from '../../src/domain/hitapps-rules';

export interface SourceSlot extends Pick<SourceCard, 'kind'> {
  id: string;
  container: 0 | 2;
  column: number;
  position: number;
  flags: number;
}

export const puzzleExchangeCount = (stockHalves: number, tableauHalves: number, ordinaryTableau: number) =>
  Math.min(Math.ceil((stockHalves + tableauHalves) / 2) - tableauHalves, stockHalves, ordinaryTableau);

export function shuffleOnce<T>(items: T[], next: (bound: number) => number) {
  for (let length = items.length; length > 1; length--) {
    const index = next(length);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length) throw Error('Invalid shuffle draw');
    [items[length - 1], items[index]] = [items[index], items[length - 1]];
  }
}

export function exchangeSourceSlots(stock: SourceSlot, tableau: SourceSlot, sizes: readonly number[]) {
  const stockPosition = stock.position;
  Object.assign(stock, { container: 2, column: tableau.column, position: tableau.position,
    flags: sizes[tableau.column] - 1 > tableau.position ? 1 : 80 });
  Object.assign(tableau, { container: 0, column: 0, position: stockPosition, flags: 2 });
}

export function redistributePuzzle(slots: SourceSlot[], sizes: readonly number[], next: (bound: number) => number) {
  const isHalf = (slot: SourceSlot) => slot.kind === Kind.puzzleTop || slot.kind === Kind.puzzleBottom;
  const stock = slots.filter(slot => isHalf(slot) && slot.container === 0);
  const tableau = slots.filter(slot => !isHalf(slot) && slot.container === 2);
  const existing = slots.filter(slot => isHalf(slot) && slot.container === 2).length;
  const count = puzzleExchangeCount(stock.length, existing, tableau.length);
  if (count <= 0) return [];
  shuffleOnce(tableau, next);
  shuffleOnce(stock, next);
  for (let index = 0; index < count; index++) exchangeSourceSlots(stock[index], tableau[index], sizes);
  return stock.slice(0, count).map(slot => slot.id);
}

/** Separate PuzzleCards list and deliberately supplied product placements.
 * Source placement and relative Shuffle feature timing remain unknown.
 */
export function distributeAuthoredPuzzleCards(
  ordinary: Deal,
  puzzle: NonNullable<Deal['puzzle']>,
  puzzleCards: readonly Deal['cards'][string][],
  place: (board: Board, parts: readonly string[]) => Board,
): Deal {
  const ids = puzzleCards.map(card => card.id);
  const parts = puzzle.pairs.flatMap(({ top, bottom }) => [top, bottom]);
  if (ordinary.puzzle || ids.length === 0 || new Set(ids).size !== ids.length ||
      ids.some(id => Object.hasOwn(ordinary.cards, id)) || parts.length !== ids.length ||
      new Set(parts).size !== parts.length || parts.some(id => !ids.includes(id))) {
    throw Error('PuzzleCards must be separate and paired exactly once');
  }
  assertBoard(ordinary.initial, ordinary);
  const initial = place(structuredClone(ordinary.initial), ids);
  const deal = { ...ordinary, cards: { ...ordinary.cards, ...Object.fromEntries(puzzleCards.map(card => [card.id, card])) },
    puzzle, initial, winningPath: [], recoveryPaths: undefined };
  assertBoard(initial, deal);
  return deal;
}
