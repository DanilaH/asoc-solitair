import { applyBoard, boardKey, isLocked } from './engine';
import { recordUndo } from './history';
import type { Board, BoardCommand, Deal, Save } from './types';

export interface ShuffleRequest {
  attemptId: string; dealId: string; revision: number; seed: number;
  board: Board; deal: Deal;
}

export function canShuffle(save: Save, deal: Deal): boolean {
  const { attempt } = save;
  const { board } = attempt;
  if ((deal.shuffleCost === 'charge' && !save.dailyTasks?.inventory.shuffles) || attempt.daily || attempt.shuffleUsed || board.phase !== 'playing' || attempt.dealId !== deal.id) return false;
  if (deal.shufflePolicy === 'hidden-pool-r1') {
    const hidden = board.tableau.flat().filter(id => !board.faceUp.includes(id)).length;
    return !board.joker && !board.tableau.some((_, index) => isLocked(board, index, deal)) && board.stock.length + board.waste.length + hidden > 1;
  }
  return deal.shufflePreview === 1 && board.stock.length > 1;
}

/** Product seed and stock-only permutation. Original AZUR RNG is unknown. */
export function shuffledStock(stock: readonly string[], seed: number): string[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid stock shuffle seed');
  const next = permute(stock, seed);
  if (next.length > 1 && next.every((id, index) => id === stock[index])) [next[0], next[1]] = [next[1], next[0]];
  return next;
}

function permute(cards: readonly string[], seed: number): string[] {
  const next = [...cards];
  let state = seed;
  for (let index = next.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export function prepareShuffleBoard(board: Board, deal: Deal, seed: number): Board | undefined {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return;
  if (deal.shufflePreview === 1) return { ...board, stock: shuffledStock(board.stock, seed) };
  if (deal.shufflePolicy !== 'hidden-pool-r1' || board.joker || board.tableau.some((_, index) => isLocked(board, index, deal))) return;
  const visible = new Set(board.faceUp);
  const faceDown = board.tableau.flatMap(pile => pile.filter(id => !visible.has(id)));
  const resetStock = [...board.stock, ...board.waste];
  const pool = [...faceDown, ...resetStock];
  const shuffled = permute(pool, seed);
  if (pool.every((id, i) => shuffled[i] === id)) return;
  let reassigned = 0;
  const tableau = board.tableau.map(pile => pile.map(id => visible.has(id) ? id : shuffled[reassigned++]));
  const resetWaste = new Set(board.waste);
  return { ...board, tableau, stock: shuffled.slice(reassigned), waste: [],
    faceUp: board.faceUp.filter(id => !resetWaste.has(id)) };
}

export function commitShuffle(save: Save, deal: Deal, request: ShuffleRequest, route: readonly BoardCommand[]): boolean {
  const attempt = save.attempt;
  if (!canShuffle(save, deal) || request.attemptId !== attempt.id || request.dealId !== deal.id ||
    request.revision !== save.revision || request.board.movesLeft !== attempt.board.movesLeft ||
    boardKey(request.board) !== boardKey(attempt.board) || !Array.isArray(route) || !route.length ||
    (attempt.board.movesLeft !== null && route.length > attempt.board.movesLeft)) return false;
  const next = prepareShuffleBoard(attempt.board, deal, request.seed);
  if (!next) return false;
  let board = next;
  for (const command of route) {
    const result = applyBoard(board, command, deal);
    if (typeof result === 'string') return false;
    board = result.board;
  }
  if (board.phase !== 'won') return false;
  if (deal.shufflePolicy === 'hidden-pool-r1') attempt.undo = [];
  else recordUndo(attempt);
  attempt.board = next;
  attempt.shuffleUsed = true;
  if (deal.shuffleCost === 'charge') save.dailyTasks!.inventory.shuffles--;
  save.revision++;
  return true;
}
