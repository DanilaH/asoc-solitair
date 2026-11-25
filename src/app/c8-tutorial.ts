import { applyBoard, boardKey } from '../domain/engine';
import type { Board, BoardCommand, Deal } from '../domain/types';

/** The published C8 opening and rule demonstrations, keyed by immutable deal revision. */
const sequenceR1 = new Set([
  'campaign-c8-dealer-001', 'campaign-c8-dealer-002',
  'campaign-c8-dealer-003', 'campaign-c8-dealer-004',
  'campaign-c8-dealer-005', 'campaign-c8-dealer-008',
  'campaign-c8-special-017', 'campaign-c8-special-017-core-special-r1', 'campaign-c8-special-018',
]);

const byDeal = new WeakMap<Deal, Map<string, BoardCommand>>();

export function usesAuthoredLesson(deal: Deal): boolean {
  return deal.version === 1 && sequenceR1.has(deal.id);
}

/**
 * Index the authored route by the actual pre-action board. Moves remaining are
 * intentionally outside the key: reload and Undo never need a separate cursor.
 * A player who leaves the authored position can still play a legal move.
 */
export function authoredLessonAction(board: Board, deal: Deal): BoardCommand | undefined {
  if (!usesAuthoredLesson(deal)) return;
  let states = byDeal.get(deal);
  if (!states) {
    states = new Map();
    let position = deal.initial;
    for (const action of deal.winningPath) {
      const result = applyBoard(position, action, deal);
      if (typeof result === 'string') break;
      const key = boardKey(position);
      if (!states.has(key)) states.set(key, action);
      position = result.board;
    }
    byDeal.set(deal, states);
  }
  const action = states.get(boardKey(board));
  return action && typeof applyBoard(board, action, deal) !== 'string' ? action : undefined;
}
