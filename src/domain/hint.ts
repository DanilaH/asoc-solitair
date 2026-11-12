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
  const result = known ? { status: 'SOLVED' as const, path: known } : solve(board, deal, limit);
  if (result.status !== 'SOLVED') return { status: result.status };
  return result.path[0] ? { status: 'SOLVED', action: result.path[0] } : { status: 'UNAVAILABLE' };
}
