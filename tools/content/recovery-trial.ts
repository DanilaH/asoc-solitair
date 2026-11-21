import { applyBoard, boardKey } from '../../src/domain/engine';
import { MAX_UNDO_HISTORY } from '../../src/domain/history';
import type { Attempt, Board, BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';

const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;

interface StockRules {
  version: 1;
  freeRecycles: number;
  restoreBase: number;
  restoreIncrement: number;
}

interface StockState {
  rules: StockRules;
  attempt: Attempt;
  recycles: number;
  restores: number;
  coins: number;
}

export function stockRestorePrice(state: StockState): number | undefined {
  const { rules, attempt } = state;
  if (rules.version !== 1 || ![rules.freeRecycles, rules.restoreBase, rules.restoreIncrement,
    state.recycles, state.restores].every(natural) || state.recycles < rules.freeRecycles ||
    attempt.board.phase !== 'playing' || attempt.board.movesLeft === 0 || attempt.board.stock.length || !attempt.board.waste.length) return;
  const price = state.restores ? rules.restoreBase + (state.restores - 1) * rules.restoreIncrement : 0;
  return natural(price) ? price : undefined;
}

export function trialStockRecycle(state: StockState, deal: Deal, action: 'ordinary' | 'restore', quotedPrice?: number): StockState {
  const { attempt, rules } = state;
  if (rules.version !== 1 || attempt.dealId !== deal.id || attempt.board.rulesVersion !== 3 || attempt.board.movesLeft === 0 ||
    ![state.coins, state.recycles, state.restores, rules.freeRecycles].every(natural)) return state;
  const price = action === 'restore' ? stockRestorePrice(state) : 0;
  const count = action === 'restore' ? state.restores : state.recycles;
  if (!natural(count + 1) || price === undefined || price > state.coins ||
    (action === 'ordinary' ? count >= rules.freeRecycles : price !== quotedPrice)) return state;

  const cmd = { type: 'recycle' } as const;
  const result = applyBoard(attempt.board, cmd, deal);
  const replay = advance(attempt.board, cmd, deal);
  if (typeof result === 'string' || !replay || boardKey(result.board) !== boardKey(replay) ||
    result.board.phase !== replay.phase || result.board.movesLeft !== replay.movesLeft) return state;
  return { ...state, coins: state.coins - price, recycles: state.recycles + Number(action === 'ordinary'),
    restores: state.restores + Number(action === 'restore'), attempt: withBoard(attempt, result.board) };
}

function withBoard(attempt: Attempt, board: Board): Attempt {
  return { ...attempt, board, undo: [...attempt.undo, attempt.board].slice(-MAX_UNDO_HISTORY) };
}

type ReviveSegment = 'payer' | 'nonpayer';
interface RevivePolicy {
  version: 1;
  revision: string;
  enabled: boolean;
  minLevel: number;
  cooldownMs: number;
  dailyCap: number;
  options: Record<ReviveSegment, { coins: number; coinMoves: number; videoMoves: number }>;
}
interface ReviveContext {
  attempt: Attempt;
  now: number;
  segment?: ReviveSegment;
  history: readonly { attemptId: string; at: number; receiptId?: string }[];
}

export function trialReviveOffer(policy: RevivePolicy, context: ReviveContext, deal: Deal,
  kind: 'coins' | 'video', path: readonly BoardCommand[]) {
  const { attempt, now, segment, history } = context;
  const level = deal.campaignLevel;
  if (policy.version !== 1 || !policy.enabled || !segment || !policy.revision ||
    ![policy.minLevel, policy.cooldownMs, policy.dailyCap, now].every(natural) ||
    level === undefined || level < policy.minLevel || attempt.daily || attempt.dealId !== deal.id ||
    attempt.continued || attempt.board.phase !== 'exhausted' || attempt.board.movesLeft !== 0) return;
  const today = Math.floor(now / 86_400_000);
  if (history.some(entry => entry.attemptId === attempt.id || !natural(entry.at) || now - entry.at < policy.cooldownMs) ||
    history.filter(entry => Math.floor(entry.at / 86_400_000) === today).length >= policy.dailyCap) return;

  const option = policy.options[segment], moves = kind === 'coins' ? option.coinMoves : option.videoMoves;
  const cost = kind === 'coins' ? option.coins : 0;
  if (!natural(cost) || !natural(moves) || !path.length || path.length > moves) return;
  let board: Board = { ...attempt.board, phase: 'playing', movesLeft: moves };
  for (const cmd of path) {
    const next = advance(board, cmd, deal);
    if (!next) return;
    board = next;
  }
  if (board.phase === 'won') return { revision: policy.revision, attemptId: attempt.id, dealId: deal.id,
    id: JSON.stringify([policy.revision, attempt.id, deal.id, segment, kind, cost, moves, boardKey(attempt.board)]), kind, cost, moves } as const;
}

interface ReviveTrial extends ReviveContext {
  coins: number;
}

/** Accepts simulated receipts only in the offline trial. The shipped reward bridge never imports this module. */
export function settleTrialRevive(state: ReviveTrial, policy: RevivePolicy, deal: Deal,
  path: readonly BoardCommand[], confirmation: { kind: 'coins'; offerId: string } |
  { kind: 'video'; offerId: string; earnedReceiptId: string }): ReviveTrial {
  const offer = trialReviveOffer(policy, state, deal, confirmation.kind, path);
  if (!offer || confirmation.offerId !== offer.id || !natural(state.coins) || state.coins < offer.cost) return state;
  const receiptId = confirmation.kind === 'video' ? confirmation.earnedReceiptId : undefined;
  if (confirmation.kind === 'video' && (!receiptId || state.history.some(entry => entry.receiptId === receiptId))) return state;
  const { attempt } = state;
  return { ...state, coins: state.coins - offer.cost,
    history: [...state.history, { attemptId: attempt.id, at: state.now, ...(receiptId ? { receiptId } : {}) }],
    attempt: { ...attempt, continued: true, board: { ...attempt.board, movesLeft: offer.moves, phase: 'playing' },
      undo: attempt.undo.map(board => board.movesLeft === null ? board : { ...board, movesLeft: board.movesLeft + offer.moves }) } };
}

type UnlimitedGrant = {
  id: string;
  attemptId: string;
  dealId: string;
} & ({ term: 'attempt' } | { term: 'time'; until: number });

interface UnlimitedState {
  version: 1;
  attempt: Attempt;
  observedAt: number;
  used: readonly string[];
  active?: { grant: UnlimitedGrant; remaining: number };
}

export function activateTrialUnlimited(state: UnlimitedState, grant: UnlimitedGrant, now: number): UnlimitedState {
  if (state.version !== 1 || !natural(now) || now < state.observedAt || state.active || !grant.id || state.used.includes(grant.id) ||
    grant.attemptId !== state.attempt.id || grant.dealId !== state.attempt.dealId || state.attempt.board.phase === 'won' ||
    (grant.term === 'time' && (!natural(grant.until) || grant.until <= now))) return state;
  const { attempt } = state;
  if (attempt.board.movesLeft === null) return state;
  return { ...state, used: [...state.used, grant.id], observedAt: now, active: { grant, remaining: attempt.board.movesLeft },
    attempt: { ...attempt, board: { ...attempt.board, movesLeft: null, phase: 'playing' } } };
}

function reviveFinite(board: Board, remaining: number): Board {
  return board.movesLeft !== null ? board : { ...board, movesLeft: remaining,
    phase: board.phase === 'won' ? 'won' : remaining ? 'playing' : 'exhausted' };
}

export function observeTrialUnlimited(state: UnlimitedState, now: number): UnlimitedState {
  if (!natural(now) || now < state.observedAt) return state;
  const active = state.active;
  if (active && active.grant.term === 'time' && now >= active.grant.until) {
    const { attempt } = state;
    return { ...state, observedAt: now, active: undefined,
      attempt: { ...attempt, board: reviveFinite(attempt.board, active.remaining),
        undo: attempt.undo.map(board => reviveFinite(board, active.remaining)) } };
  }
  return now === state.observedAt ? state : { ...state, observedAt: now };
}

export function trialUnlimitedMove(state: UnlimitedState, now: number, deal: Deal, cmd: BoardCommand | { type: 'undo' }): UnlimitedState {
  if (!natural(now)) return state;
  const current = observeTrialUnlimited(state, now);
  const { attempt, active } = current;
  if (!active || attempt.dealId !== deal.id || now < current.observedAt || attempt.board.phase === 'won') return current;
  if (cmd.type === 'undo') {
    const previous = attempt.undo.at(-1);
    if (!previous) return current;
    return { ...current, attempt: { ...attempt, board: { ...previous, movesLeft: null, phase: 'playing' }, undo: attempt.undo.slice(0, -1) } };
  }
  const result = applyBoard(attempt.board, cmd, deal);
  return typeof result === 'string' ? current : { ...current, attempt: withBoard(attempt, result.board) };
}
