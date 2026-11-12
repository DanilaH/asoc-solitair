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
    // Foundation slots have identical rules. Match their contents, then map the
    // stored route back to the player's actual slots; tableau/locks stay exact.
    const used = new Set<number>();
    const slots: number[] = [];
    // Reserve matches sequentially so multiple empty slots remain a bijection.
    for (let i = 0; i < current.foundations.length; i++) {
      slots[i] = board.foundations.findIndex((other, j) => !used.has(j) && JSON.stringify(current.foundations[i]) === JSON.stringify(other));
      if (slots[i] >= 0) used.add(slots[i]);
    }
    if (slots.every(i => i >= 0) && boardKey(current) === boardKey({ ...board, foundations: slots.map(i => board.foundations[i]) })) {
      const path = deal.winningPath.slice(index).map(action => action.type === 'transfer' ? {
        ...action,
        from: action.from.kind === 'foundation' ? { ...action.from, index: slots[action.from.index] } : action.from,
        to: action.to.kind === 'foundation' ? { ...action.to, index: slots[action.to.index] } : action.to,
      } : action);
      if (board.movesLeft === null || path.length <= board.movesLeft) return path;
    }
    const result = applyBoard(current, deal.winningPath[index], deal);
    if (typeof result === 'string') return null;
    current = result.board;
  }
  return null;
}
