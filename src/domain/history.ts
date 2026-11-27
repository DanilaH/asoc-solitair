import type { Attempt, Deal } from './types';

/** One shared bound for new commands and compatible loading of older long attempts. */
export const MAX_UNDO_HISTORY = 300;
type Restore = NonNullable<Attempt['restoreUndo']>['entries'][number];

export function recordUndo(attempt: Attempt, restore?: Omit<Restore, 'frame'>): void {
  if (restore) (attempt.restoreUndo ??= { version: 1, entries: [] }).entries.push({ ...restore, frame: attempt.undo.length });
  attempt.undo.push(attempt.board);
  const drop = Math.max(0, attempt.undo.length - MAX_UNDO_HISTORY);
  if (!drop) return;
  attempt.undo.splice(0, drop);
  if (attempt.restoreUndo) attempt.restoreUndo.entries = attempt.restoreUndo.entries
    .filter(entry => entry.frame >= drop).map(entry => ({ ...entry, frame: entry.frame - drop }));
}

export function clearUndo(attempt: Attempt) {
  attempt.undo = [];
  delete attempt.restoreUndo;
}

export function pendingRestoreRefund(attempt: Attempt) {
  const entry = attempt.restoreUndo?.entries.at(-1);
  return entry && entry.frame === attempt.undo.length - 1 && entry.ordinal === attempt.stockRestores ? entry : undefined;
}

export function validRestoreUndo(attempt: Attempt, deal: Deal) {
  const journal = attempt.restoreUndo;
  if (journal === undefined) return true;
  return Boolean(deal.recovery && !attempt.daily && journal && journal.version === 1 &&
    Array.isArray(journal.entries) && journal.entries.length <= attempt.undo.length &&
    journal.entries.every((entry, index) => {
      const previous = journal.entries[index - 1];
      const frame = entry && attempt.undo[entry.frame];
      return entry && Number.isSafeInteger(entry.frame) && entry.frame >= 0 && entry.frame > (previous?.frame ?? -1) &&
        Number.isSafeInteger(entry.ordinal) && entry.ordinal > (previous?.ordinal ?? 0) && entry.ordinal <= (attempt.stockRestores ?? 0) &&
        Number.isSafeInteger(entry.debit) && entry.debit >= 0 && frame?.recyclesLeft === 0 &&
        frame.stock.length === 0 && frame.waste.length > 0;
    }));
}
