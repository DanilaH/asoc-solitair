import { applyBoard, boardKey, legalCommands, sourceCards } from '../../src/domain/engine';
import { hitappsDeckLookahead } from '../../src/domain/hitapps-board';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import type { PolicyRun } from './difficulty-selection';

export type SourceStrategy = 'Priority' | 'Equality';
export const sourceStrategies: readonly SourceStrategy[] = ['Priority', 'Equality'];
type BotMove = { command: BoardCommand; card: string; position: number; targetCount: number; type: 0 | 1 | 2 | 3 | 4 };
export const sourceStepCap = 500;

export function sourceMoves(board: Board, deal: Deal): BotMove[] {
  if (!board.hitapps || board.rulesVersion !== 4 || board.phase !== 'playing') return [];
  const commands = legalCommands(board, deal), state = board.hitapps;
  const carriers = [...board.waste.slice(-1), ...board.tableau.map(column => column.at(-1))]
    .some(id => id && state.cards[id].scissors && board.faceUp.includes(id));
  if (carriers) return commands.filter((action): action is Extract<BoardCommand, { type: 'transfer' }> =>
    action.type === 'transfer' && action.scissors === 'cut').map(command => ({ command, type: 4, card: '', position: -1, targetCount: -1 }));
  const moves: BotMove[] = [];
  for (const command of commands) {
    if (command.type !== 'transfer') continue;
    if (command.root !== undefined || command.scissors) continue;
    const group = sourceCards(board, command.from, deal), card = group[0];
    if (!card || !board.faceUp.includes(card)) continue;
    const position = command.from.kind === 'tableau' ? board.tableau[command.from.index].indexOf(card) : board.waste.length - 1;
    const home = command.to.kind === 'foundation';
    const targetCount = (home ? board.foundations : board.tableau)[command.to.index].length;
    moves.push({ command, card, position, type: home ? 1 : 0, targetCount });
  }
  const stock = commands.find(action => action.type !== 'transfer');
  if (stock && hitappsDeckLookahead({ ...board, hitapps: state }, deal))
    moves.push({ command: stock, type: stock.type === 'draw' ? 2 : 3, card: '', position: -1, targetCount: -1 });
  return moves;
}

export function chooseSourceMove(moves: readonly BotMove[], strategy: SourceStrategy): BoardCommand | undefined {
  let reservedTableau = '', reservedHome = '', best: BoardCommand | undefined, greatest = 0;
  for (const move of moves) {
    if (move.targetCount === 0 && move.type === 0) {
      if (move.position === 0 || move.card === reservedTableau) continue;
      reservedTableau = move.card;
    }
    if (move.targetCount === 0 && move.type === 1) {
      if (move.card === reservedHome) continue;
      reservedHome = move.card;
    }
    if (strategy === 'Equality') return move.command;
    const weight = move.type === 0 ? (move.position === 0 ? 3 : 2) : move.type === 1 ? (move.targetCount ? 3 : 2) : move.type === 4 ? 2 : 1;
    if (weight <= greatest) continue;
    greatest = weight;
    best = move.command;
  }
  return best;
}

export function runSourceBot(deal: Deal, policy: SourceStrategy, cap = sourceStepCap): PolicyRun {
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > sourceStepCap) throw Error('Invalid native-shaped simulation bound');
  let board = deal.initial, spent = 0;
  const path: BoardCommand[] = [], seen = new Set<string>();
  const result = (status: PolicyRun['status'], lossReason?: PolicyRun['lossReason']): PolicyRun => ({
    policyId: `hitapps-${policy.toLowerCase()}-v1`, status, steps: spent, path, ...(lossReason && { lossReason }),
  });
  while (board.phase === 'playing') {
    if (path.length >= cap) return result('UNKNOWN');
    const key = boardKey(board);
    if (seen.has(key)) return result('UNKNOWN', 'repeated-position');
    seen.add(key);
    const action = chooseSourceMove(sourceMoves(board, deal), policy);
    if (!action) return result('LOST', 'no-legal-action');
    const step = applyBoard(board, action, deal);
    if (typeof step === 'string' || step.consumedMoves === undefined) return result('UNKNOWN');
    spent += step.consumedMoves;
    path.push(action);
    board = step.board;
  }
  return board.phase === 'won' ? result('WON') : result('LOST', 'budget');
}
