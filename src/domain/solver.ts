import { applyBoard, boardKey, legalCommands } from './engine';
import type { Board, BoardCommand, Deal } from './types';
export type SearchResult = { status: 'SOLVED'; path: BoardCommand[]; visited: number }
  | { status: 'UNKNOWN' | 'UNSOLVABLE'; visited: number };

export function solve(start: Board, deal: Deal, limit = 8000): SearchResult {
  const queue: { board: Board; path: BoardCommand[] }[] = [{ board: start, path: [] }];
  const seen = new Map<string, number>();
  seen.set(boardKey(start), start.movesLeft ?? Infinity);
  let head = 0;
  while (head < queue.length && head < limit) {
    const { board, path } = queue[head++];
    if (board.phase === 'won') return { status: 'SOLVED', path, visited: head };
    for (const action of legalCommands(board, deal)) {
      const result = applyBoard(board, action, deal);
      if (typeof result === 'string') continue;
      const remaining = result.board.movesLeft ?? Infinity;
      const key = boardKey(result.board);
      if (seen.has(key) && seen.get(key)! >= remaining) continue;
      seen.set(key, remaining);
      queue.push({ board: result.board, path: [...path, action] });
    }
  }
  return { status: head < queue.length ? 'UNKNOWN' : 'UNSOLVABLE', visited: head };
}

export function knownContinuation(board: Board, deal: Deal): BoardCommand[] | null {
  let current = structuredClone(deal.initial);
  for (let index = 0; index < deal.winningPath.length; index++) {
    if (boardKey(current) === boardKey(board)) {
      const path = deal.winningPath.slice(index);
      if (board.movesLeft === null || path.length <= board.movesLeft) return path;
    }
    const result = applyBoard(current, deal.winningPath[index], deal);
    if (typeof result === 'string') return null;
    current = result.board;
  }
  return null;
}
