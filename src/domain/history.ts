import type { Attempt } from './types';

/** One shared bound for new commands and compatible loading of older long attempts. */
export const MAX_UNDO_HISTORY = 300;
export function recordUndo(attempt: Attempt): void {
  attempt.undo.push(attempt.board);
  if (attempt.undo.length > MAX_UNDO_HISTORY) attempt.undo.splice(0, attempt.undo.length - MAX_UNDO_HISTORY);
}
