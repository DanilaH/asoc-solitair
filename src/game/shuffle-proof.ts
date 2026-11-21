import { solve } from '../domain/solver';
import { shuffledStock, type ShuffleRequest } from '../domain/proof-shuffle';
import type { Board, BoardCommand, Deal } from '../domain/types';
import { advance, options } from '../../tools/qa/gameplay-oracle';

function foundationFirst(start: Board, deal: Deal): BoardCommand[] | null {
  let position = start;
  const path: BoardCommand[] = [];
  for (let i = 0; i < Math.min(start.movesLeft ?? 120, 120); i++) {
    const moves = options(position, deal, true);
    const next = moves.find(({ action }) => action.type === 'transfer' && action.to.kind === 'foundation') ??
      moves.find(({ action }) => action.type !== 'transfer');
    if (!next) return null;
    path.push(next.action);
    position = next.board;
    if (position.phase === 'won') return path;
  }
  return null;
}

export function proveShuffle(request: ShuffleRequest): BoardCommand[] | null {
  const { board, deal, seed } = request;
  if (deal.shufflePreview !== 1 || board.phase !== 'playing' || board.stock.length < 2) return null;
  const candidate = { ...board, stock: shuffledStock(board.stock, seed) };
  const quick = foundationFirst(candidate, deal);
  if (quick) return quick;
  const result = solve(candidate, deal, 12_000, performance.now() + 1800);
  if (result.status !== 'SOLVED') return null;
  let replay = candidate;
  for (const command of result.path) {
    const next = advance(replay, command, deal);
    if (!next) return null;
    replay = next;
  }
  return replay.phase === 'won' ? result.path : null;
}
