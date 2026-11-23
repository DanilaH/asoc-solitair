import type { Board, Deal } from '../../src/domain/types';
import { assertBoard } from '../../src/domain/engine';

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
