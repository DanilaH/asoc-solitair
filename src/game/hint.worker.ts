import { knownContinuation, solve } from '../domain/solver';
import { legalCommands } from '../domain/engine';
import type { Board, Deal } from '../domain/types';
self.onmessage = (event: MessageEvent<{ revision: number; board: Board; deal: Deal }>) => {
  const { revision, board, deal } = event.data;
  const known = knownContinuation(board, deal);
  const result = known ? { status: 'SOLVED', path: known } : solve(board, deal, 4000);
  const action = 'path' in result ? result.path[0] : legalCommands(board, deal)[0];
  self.postMessage({ revision, action, guaranteed: result.status === 'SOLVED' });
};
