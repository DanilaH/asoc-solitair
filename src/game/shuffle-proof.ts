import { solve } from '../domain/solver';
import { findReferenceRoute } from '../domain/ordinary-search';
import { openingShuffleProof } from '../domain/shuffle-intro-proof';
import { prepareShuffleBoard, type ShuffleRequest } from '../domain/proof-shuffle';
import type { Board, BoardCommand, Deal } from '../domain/types';
import { advance, identity, options } from '../../tools/qa/gameplay-oracle';

function foundationFirst(start: Board, deal: Deal): BoardCommand[] | null {
  let position = start;
  const path: BoardCommand[] = [];
  for (let i = 0; i < Math.min(start.movesLeft ?? 120, 240); i++) {
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

/** A bounded progress-first search can reach a long witness before breadth-first search.
 * The score only orders proposals: every returned step is independently replayed below. */
function progressFirst(start: Board, deal: Deal, deadline: number): BoardCommand[] | null {
  type Node = { board: Board; path: BoardCommand[]; score: number };
  const queue: Node[] = [{ board: start, path: [], score: 0 }];
  const seen = new Map([[identity(start, deal), start.movesLeft ?? Infinity]]);
  const score = (board: Board, depth: number) => {
    const visible = new Set(board.faceUp);
    const hidden = board.tableau.flat().filter(id => !visible.has(id)).length;
    const secured = board.collected.length + board.foundations.flat().length;
    return secured * 10 - hidden * 4 - depth;
  };
  for (let visited = 0; queue.length && visited < 6000 && performance.now() < deadline; visited++) {
    const node = queue.pop()!;
    for (const next of options(node.board, deal, true)) {
      if (performance.now() >= deadline) return null;
      const path = [...node.path, next.action];
      if (next.board.phase === 'won') return path;
      if (next.board.phase !== 'playing') continue;
      const key = identity(next.board, deal), remaining = next.board.movesLeft ?? Infinity;
      if ((seen.get(key) ?? -1) >= remaining) continue;
      seen.set(key, remaining);
      const item = { board: next.board, path, score: score(next.board, path.length) };
      let low = 0, high = queue.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (queue[middle].score < item.score) low = middle + 1;
        else high = middle;
      }
      queue.splice(low, 0, item);
      if (queue.length > 4000) queue.shift();
    }
  }
  return null;
}

export function proveShuffle(request: ShuffleRequest): BoardCommand[] | null {
  const { board, deal, seed } = request;
  if (board.phase !== 'playing' || (deal.shufflePreview === 1 && board.stock.length < 2)) return null;
  const candidate = prepareShuffleBoard(board, deal, seed);
  if (!candidate) return null;
  const preset = openingShuffleProof(board, deal);
  if (preset?.seed === seed && replaysToWin(candidate, deal, preset.route)) return preset.route;
  const quick = foundationFirst(candidate, deal);
  if (quick) return quick;
  const deadline = performance.now() + 1800;
  const ordinary = !deal.lock && !deal.frozen && !deal.bound && !deal.puzzle && !deal.starter &&
    !Object.values(deal.cards).some(card => card.ordered)
    ? findReferenceRoute(deal, candidate, 6400, true, performance.now() + 900).path : undefined;
  const guided = ordinary ?? progressFirst(candidate, deal, Math.min(deadline, performance.now() + 900));
  const result = guided ? { status: 'SOLVED' as const, path: guided } : solve(candidate, deal, 12_000, deadline);
  if (result.status !== 'SOLVED') return null;
  return replaysToWin(candidate, deal, result.path) ? result.path : null;
}

function replaysToWin(board: Board, deal: Deal, route: readonly BoardCommand[]) {
  let replay = board;
  for (const command of route) {
    const next = advance(replay, command, deal);
    if (!next) return false;
    replay = next;
  }
  return replay.phase === 'won';
}
