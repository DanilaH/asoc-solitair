import { BALANCE } from './balance';
import { applyBoard } from './engine';
import { findReferenceRoute } from './ordinary-search';
import { continuationLookup, knownContinuation, solve } from './solver';
import type { Attempt, Board, BoardCommand, Deal } from './types';

export type ContinueResult = { status: 'PROVEN_RECOVERABLE'; path: BoardCommand[] }
  | { status: 'UNKNOWN' | 'UNSOLVABLE' };
export interface ContinueProof { attemptId: string; deal: Deal; path: BoardCommand[] }
export type ContinueAttempt = Pick<Attempt, 'id' | 'dealId' | 'board' | 'continued' | 'lostLife'>;

export const requiresContinueProof = (attempt: Attempt) => !attempt.daily &&
  (attempt.board.rulesVersion === 4 || attempt.dealId.startsWith('campaign-c8-'));
const recoveryBoard = (board: Board): Board | undefined => board.phase === 'exhausted' && board.movesLeft === 0
  ? { ...board, phase: 'playing', movesLeft: BALANCE.continueMoves } : undefined;

export function verifiesContinue(attempt: ContinueAttempt, proof: ContinueProof): boolean {
  if (attempt.continued || attempt.lostLife || attempt.id !== proof.attemptId || attempt.dealId !== proof.deal.id ||
    !proof.path.length) return false;
  // Replay the actual finite transitions; command count is not the authority
  // for the cost of a versioned route.
  let board = recoveryBoard(attempt.board);
  for (const action of proof.path) {
    if (!board) return false;
    const result = applyBoard(board, action, proof.deal);
    if (typeof result === 'string') return false;
    board = result.board;
  }
  return board?.phase === 'won';
}

export function findContinue(attempt: ContinueAttempt, deal: Deal, limit = 3000, deadline = Infinity): ContinueResult {
  const start = recoveryBoard(attempt.board);
  if (!start || attempt.continued || attempt.lostLife || attempt.dealId !== deal.id) return { status: 'UNKNOWN' };
  // At most one theme can finish in a move, even if that move carries a group.
  const collected = new Set(start.collected);
  if (Object.values(deal.cards).filter(card => card.leader && !collected.has(card.id)).length > BALANCE.continueMoves)
    return { status: 'UNSOLVABLE' };
  const known = knownContinuation(start, deal);
  if (known && verifiesContinue(attempt, { attemptId: attempt.id, deal, path: known }))
    return { status: 'PROVEN_RECOVERABLE', path: known };
  if (performance.now() >= deadline) return { status: 'UNKNOWN' };
  if (start.rulesVersion === 4) {
    // One request-local deadline and node budget. A pruned graph is not a proof
    // of impossibility; only the sound lower bound above can reject Rules4.
    const lookup = continuationLookup(start, deal, deadline);
    const result = findReferenceRoute(deal, start, limit, true, deadline, 'verified-specials', lookup);
    return result.status === 'FOUND' && verifiesContinue(attempt, { attemptId: attempt.id, deal, path: result.path })
      ? { status: 'PROVEN_RECOVERABLE', path: result.path } : { status: 'UNKNOWN' };
  }
  const result = solve(start, deal, limit, deadline);
  return result.status === 'SOLVED'
    ? verifiesContinue(attempt, { attemptId: attempt.id, deal, path: result.path })
      ? { status: 'PROVEN_RECOVERABLE', path: result.path } : { status: 'UNKNOWN' }
    : { status: result.status };
}
