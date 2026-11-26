import { decodeRoute } from '../content/route';
import { boardKey } from './engine';
import type { Board, Deal } from './types';

/** Verified tutorial permutation, shared by the three original L30 layouts and their rights wrappers. */
const deals = new Set([
  'campaign-c8-bonus-030-c8-core-r1-shuffle-r1',
  'campaign-c8-bonus-030-tight-r2-c8-core-r1-shuffle-r1',
  'campaign-c8-bonus-030-relief-r2-c8-core-r1-shuffle-r1',
  'campaign-c8-bonus-030-c8-core-r1-shuffle-r1-rights-r1',
  'campaign-c8-bonus-030-tight-r2-c8-core-r1-shuffle-r1-rights-r1',
  'campaign-c8-bonus-030-relief-r2-c8-core-r1-shuffle-r1-rights-r1',
]);
const route = decodeRoute('t3>f0 d d d d w0>f1 t0>f1 t0>t3 t0>f2 t1>f2 t2>f2 d w0>f2 d d w0>f3 t0>f3 t0>f3 d d d d d w0>f3 d d d w0>f1 d d w0>f1 d w0>f3 d w0>f3 d d w0>f1 d d w0>f1 d w0>f0 d w0>f0 d w0>f2 d w0>f0 d w0>f1 w0>t0 w0>f1 t0>f1 d d d w0>f1 d d d w0>f0 d d w0>f2 d w0>f2 w0>t0 w0>f2 t1>f2 t1>f2 w0>f2 d d w0>f2 d w0>f2 d d d w0>f3 w0>f3 t1>f3 t1>f0 w0>f0 t2>f0 w0>f0 d w0>f1 t2>t0 t2>f2 t2>f3 t2>f0 w0>t3 w0>f0 t3>t1 t3>f0 t3>f1 t3>t1 t3>f3 w0>t1 w0>t0 w0>f0 t0>f0 w0>f0 w0>f3 w0>f0 w0>f2 t1>f2 w0>f1 w0>f0 w0>f2 w0>f3');
const seed = 7;
export function openingShuffleProof(board: Board, deal: Deal) {
  if (!deals.has(deal.id) || board.phase !== 'playing' ||
      (board.movesLeft !== null && board.movesLeft < route.length) || boardKey(board) !== boardKey(deal.initial)) return;
  return { seed, route };
}
