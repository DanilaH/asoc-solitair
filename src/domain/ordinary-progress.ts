import { applyBoard, boardKey, legalCommands } from './engine';
import type { Board, Deal } from './types';

export type OrdinaryProgress = 'reachable' | 'stuck' | 'unknown';

/**
 * Check for observable progress without helpers. Neutral transfers can expose
 * options after another move. A bounded search that stops early stays unknown.
 */
export function ordinaryProgress(initial: Board, deal: Deal, limit = 128): OrdinaryProgress {
  if (initial.phase !== 'playing') return 'stuck';
  const queue = [initial], visited = new Map<string, number>();
  for (let i = 0; i < queue.length; i++) {
    if (i >= limit) return 'unknown';
    const board = queue[i], moves = board.movesLeft ?? Infinity;
    const key = boardKey(board);
    if ((visited.get(key) ?? -1) >= moves) continue;
    visited.set(key, moves);
    for (const command of legalCommands(board, deal)) {
      const step = applyBoard(board, command, deal);
      if (typeof step === 'string') continue;
      const next = step.board;
      if (next.phase === 'won' || command.type === 'transfer' && (
        command.from.kind === 'waste' || command.to.kind === 'foundation' ||
        step.events.some(event => ['flip', 'unlock', 'cut', 'unbind', 'assemble', 'complete'].includes(event.type))
      )) return 'reachable';
      if (next.phase === 'playing' && (visited.get(boardKey(next)) ?? -1) < (next.movesLeft ?? Infinity)) queue.push(next);
    }
  }
  return 'stuck';
}
