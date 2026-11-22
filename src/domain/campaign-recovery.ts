import { applyBoard } from './engine';
import { recordUndo } from './history';
import type { Attempt, Board, Deal, Save } from './types';

export const RECOVERY_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'recovery';

export function restoreQuote(attempt: Attempt, deal: Deal) {
  const { board } = attempt, policy = deal.recovery;
  if (!policy || attempt.dealId !== deal.id || attempt.daily || board.phase !== 'playing' ||
      board.recyclesLeft !== 0 || board.stock.length || !board.waste.length) return;
  const count = attempt.stockRestores ?? 0;
  const cost = count === 0 ? 0 : policy.restoreBase + (count - 1) * policy.restoreIncrement;
  if (!Number.isSafeInteger(cost) || cost < 0) return;
  return cost;
}

export function restoreCampaignStock(save: Save, deal: Deal, quote: { attemptId: string; revision: number; cost: number }) {
  const attempt = save.attempt, cost = restoreQuote(attempt, deal);
  if (attempt.id !== quote.attemptId || save.revision !== quote.revision || cost === undefined ||
      cost !== quote.cost || save.profile.coins < cost || !Number.isSafeInteger((attempt.stockRestores ?? 0) + 1)) return false;
  // Use the ordinary stock transition with one separately authorized recycle.
  const result = applyBoard({ ...attempt.board, recyclesLeft: 1 }, { type: 'recycle' }, deal);
  if (typeof result === 'string') return false;
  recordUndo(attempt);
  attempt.board = result.board;
  attempt.stockRestores = (attempt.stockRestores ?? 0) + 1;
  save.profile.coins -= cost;
  save.revision++;
  return true;
}

export function beginUnlimited(save: Save, deal: Deal, grant: { id: string; attemptId: string; until?: number }, now: number) {
  const attempt = save.attempt, board = attempt.board;
  if (!deal.recovery || attempt.daily || attempt.dealId !== deal.id || grant.attemptId !== attempt.id ||
      attempt.unlimited || board.movesLeft === null || board.phase !== 'playing' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(grant.id) || !Number.isSafeInteger(now) || now < 0 ||
      (grant.until !== undefined && (!Number.isSafeInteger(grant.until) || grant.until <= now))) return false;
  attempt.unlimited = { version: 1, id: grant.id, issuedAt: now, ...(grant.until !== undefined ? { until: grant.until } : {}) };
  attempt.board = { ...board, retainedMoves: board.movesLeft, movesLeft: null };
  save.revision++;
  return true;
}

function restoreFiniteBudget(board: Board): Board {
  if (board.retainedMoves === undefined) return board;
  const { retainedMoves: movesLeft, ...finite } = board;
  return { ...finite, movesLeft, phase: board.phase === 'won' ? 'won' : movesLeft ? 'playing' : 'exhausted' };
}

export function expireUnlimited(save: Save, now: number) {
  let changed = false;
  for (const attempt of [save.attempt, save.parked?.campaign]) {
    const deadline = attempt?.unlimited?.until;
    if (!attempt?.unlimited || attempt.unlimited.expired || deadline === undefined || !Number.isSafeInteger(now) || now < deadline) continue;
    attempt.board = restoreFiniteBudget(attempt.board);
    attempt.undo = attempt.undo.map(restoreFiniteBudget);
    attempt.unlimited.expired = true;
    changed = true;
  }
  if (changed) save.revision++;
  return changed;
}
