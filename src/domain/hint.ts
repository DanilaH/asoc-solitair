import { boardRules } from './engine';
import { findReferenceRoute } from './ordinary-search';
import { knownContinuation, solve } from './solver';
import type { Board, BoardCommand, Deal } from './types';

/** A charge buys a step on a verified continuation, never an arbitrary legal move. */
export type HintResolution = { status: 'SOLVED'; action: BoardCommand }
  | { status: 'UNKNOWN' | 'UNSOLVABLE' | 'UNAVAILABLE' };
export interface HintRequest {
  requestId: number; revision: number; attemptId: string; board: Board; deal: Deal;
}
export type HintResponse = HintResolution & Pick<HintRequest, 'requestId' | 'revision' | 'attemptId'> & { dealId: string };

export function resolveHint(board: Board, deal: Deal, limit = 4000): HintResolution {
  if (board.phase !== 'playing') return { status: 'UNAVAILABLE' };
  const known = knownContinuation(board, deal);
  if (!known && boardRules(board) === 3 && !board.joker) {
    // Locks and puzzle pairs need the exact board identity and normative actions.
    // Only a complete verified route qualifies for a paid hint in either search.
    const fullBoard = Boolean(deal.lock || deal.puzzle);
    if (fullBoard || deal.tags?.includes('ordinary-dealer')) {
      const search = findReferenceRoute(deal, board, limit, true, performance.now() + (fullBoard ? 3200 : 1500),
        fullBoard ? 'verified-specials' : undefined);
      return search.status === 'FOUND' && search.path[0] ? { status: 'SOLVED', action: search.path[0] } : { status: 'UNKNOWN' };
    }
  }
  const result = known ? { status: 'SOLVED' as const, path: known } : solve(board, deal, limit);
  if (result.status !== 'SOLVED') return { status: result.status };
  return result.path[0] ? { status: 'SOLVED', action: result.path[0] } : { status: 'UNAVAILABLE' };
}
