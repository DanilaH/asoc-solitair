import { applyBoard, boardKey } from '../../src/domain/engine';
import { MAX_UNDO_HISTORY } from '../../src/domain/history';
import type { Attempt, Board, BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';

export interface MagnetHint {
  card: string;
  foundation: number;
  attemptId: string;
  dealId: string;
  boardKey: string;
  movesLeft: number | null;
}

export interface MagnetTrial {
  version: 1;
  attempt: Attempt;
  receipt?: { scheme: 'magnet-trial-v1'; attemptId: string; dealId: string; card: string };
}

const fromWaste = (index: number): BoardCommand => ({
  type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index },
});

function moveBuried(board: Board, card: string): Board {
  return { ...board, waste: [...board.waste.filter(id => id !== card), card] };
}

export function magnetHint(trial: MagnetTrial, deal: Deal, foundation: number): MagnetHint | undefined {
  const { attempt } = trial;
  const { board } = attempt;
  if (trial.version !== 1 || trial.receipt || attempt.dealId !== deal.id || board.rulesVersion !== 3 ||
    board.phase !== 'playing' || (board.movesLeft !== null && board.movesLeft <= 0)) return;
  const leader = board.foundations[foundation]?.map(id => deal.cards[id]).find(card => card?.leader);
  if (!leader?.leader) return;

  const card = board.waste.slice(0, -1).reverse().find(id => {
    const candidate = deal.cards[id];
    return candidate && !candidate.leader && candidate.category === leader.category && board.faceUp.includes(id) &&
      advance(moveBuried(board, id), fromWaste(foundation), deal) !== null;
  });
  if (card) return { card, foundation, attemptId: attempt.id, dealId: deal.id, boardKey: boardKey(board), movesLeft: board.movesLeft };
}

/** Offline product trial. Each use is a regular one-move transfer from the buried waste. */
export function useTrialMagnet(trial: MagnetTrial, deal: Deal, hint: MagnetHint): MagnetTrial {
  const { attempt } = trial;
  const expected = magnetHint(trial, deal, hint.foundation);
  if (!expected || expected.card !== hint.card || expected.attemptId !== hint.attemptId ||
    expected.dealId !== hint.dealId || expected.boardKey !== hint.boardKey || expected.movesLeft !== hint.movesLeft) return trial;
  const prepared = moveBuried(attempt.board, hint.card);
  const move = fromWaste(hint.foundation);
  const result = applyBoard(prepared, move, deal);
  const replay = advance(prepared, move, deal);
  if (typeof result === 'string' || !replay || boardKey(result.board) !== boardKey(replay) ||
    result.board.movesLeft !== replay.movesLeft || result.board.phase !== replay.phase) return trial;
  return {
    ...trial,
    attempt: { ...attempt, board: result.board, undo: [...attempt.undo, attempt.board].slice(-MAX_UNDO_HISTORY) },
    receipt: { scheme: 'magnet-trial-v1', attemptId: attempt.id, dealId: deal.id, card: hint.card },
  };
}
