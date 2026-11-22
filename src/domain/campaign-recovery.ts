import { applyBoard } from './engine';
import { recordUndo } from './history';
import { activePurchaseGoods } from './commerce/orders';
import { OWNER_ACCEPTANCE_PREVIEW } from './types';
import type { Attempt, Board, Deal, Save } from './types';

export const RECOVERY_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'recovery';
export const RECOVERY_GAMEPLAY = RECOVERY_PREVIEW || OWNER_ACCEPTANCE_PREVIEW;

export function restoreQuote(attempt: Attempt, deal: Deal) {
  const { board } = attempt, policy = deal.recovery;
  if (!policy || attempt.dealId !== deal.id || attempt.daily || board.phase !== 'playing' ||
      board.recyclesLeft !== 0 || board.stock.length || !board.waste.length) return;
  const count = attempt.stockRestores ?? 0;
  const cost = count === 0 ? 0 : policy.restoreBase + (count - 1) * policy.restoreIncrement;
  if (!Number.isSafeInteger(cost) || cost < 0) return;
  return cost;
}

export function restoreCampaignStock(save: Save, deal: Deal, quote: { attemptId: string; revision: number; cost: number }) {
  const attempt = save.attempt, cost = restoreQuote(attempt, deal);
  if (attempt.id !== quote.attemptId || save.revision !== quote.revision || cost === undefined ||
      cost !== quote.cost || save.profile.coins < cost || !Number.isSafeInteger((attempt.stockRestores ?? 0) + 1)) return false;
  // Use the ordinary stock transition with one separately authorized recycle.
  const result = applyBoard({ ...attempt.board, recyclesLeft: 1 }, { type: 'recycle' }, deal);
  if (typeof result === 'string') return false;
  recordUndo(attempt);
  attempt.board = result.board;
  attempt.stockRestores = (attempt.stockRestores ?? 0) + 1;
  save.profile.coins -= cost;
  save.revision++;
  return true;
}

interface UnlimitedGrant { id: string; attemptId: string; until?: number; purchaseRef?: string }

function unlimitedEligible(attempt: Attempt, deal: Deal) {
  return Boolean(deal.recovery && !attempt.daily && attempt.dealId === deal.id &&
    attempt.board.movesLeft !== null && attempt.board.phase === 'playing');
}

export function beginUnlimited(save: Save, deal: Deal, grant: Omit<UnlimitedGrant, 'purchaseRef'>, now: number) {
  return applyUnlimited(save, deal, { id: grant.id, attemptId: grant.attemptId, until: grant.until }, now);
}

function applyUnlimited(save: Save, deal: Deal, grant: UnlimitedGrant, now: number) {
  const attempt = save.attempt, board = attempt.board;
  const current = attempt.unlimited;
  if (!unlimitedEligible(attempt, deal) || board.movesLeft === null || grant.attemptId !== attempt.id ||
      (current && (!current.expired || !grant.purchaseRef || current.purchaseRef === grant.purchaseRef)) ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(grant.id) || !Number.isSafeInteger(now) || now < 0 ||
      (grant.until !== undefined && (!Number.isSafeInteger(grant.until) || grant.until <= now))) return false;
  attempt.unlimited = { version: 1, id: grant.id, issuedAt: now, ...(grant.until !== undefined ? { until: grant.until } : {}),
    ...(grant.purchaseRef ? { purchaseRef: grant.purchaseRef } : {}) };
  attempt.board = { ...board, retainedMoves: board.movesLeft, movesLeft: null };
  save.revision++;
  return true;
}

export function quotePurchasedUnlimited(save: Save, deal: Deal, accountId: string, now: number) {
  const attempt = save.attempt;
  if (!accountId || accountId !== save.commerceAccount || !unlimitedEligible(attempt, deal) ||
      (attempt.unlimited && !attempt.unlimited.expired)) return;
  const acknowledged = new Set(save.commerce?.orders.flatMap(order => order.acknowledged && order.grant ? [order.grant.id] : []));
  let quote: { attemptId: string; purchaseRef: string; until: number } | undefined;
  for (const item of activePurchaseGoods(save.commerce, accountId, now)) {
    if (item.good.type !== 'unlimited' || !item.expiresAt || !acknowledged.has(item.grantId) ||
        attempt.unlimited?.purchaseRef === item.grantId) continue;
    if (!quote || item.expiresAt > quote.until) {
      quote = { attemptId: attempt.id, purchaseRef: item.grantId, until: item.expiresAt };
    }
  }
  return quote;
}

export function usePurchasedUnlimited(save: Save, deal: Deal, grant: UnlimitedGrant, accountId: string, now: number) {
  const quote = quotePurchasedUnlimited(save, deal, accountId, now);
  if (!quote || grant.attemptId !== quote.attemptId || grant.purchaseRef !== quote.purchaseRef) return false;
  return applyUnlimited(save, deal, { ...quote, id: grant.id }, now);
}

function restoreFiniteBudget(board: Board): Board {
  if (board.retainedMoves === undefined) return board;
  const { retainedMoves: movesLeft, ...finite } = board;
  return { ...finite, movesLeft, phase: board.phase === 'won' ? 'won' : movesLeft ? 'playing' : 'exhausted' };
}

export function expireUnlimited(save: Save, now: number) {
  let changed = false;
  for (const attempt of [save.attempt, save.parked?.campaign]) {
    const deadline = attempt?.unlimited?.until;
    if (!attempt?.unlimited || attempt.unlimited.expired || deadline === undefined || !Number.isSafeInteger(now)) continue;
    const purchaseRef = attempt.unlimited.purchaseRef;
    const order = purchaseRef ? save.commerce?.orders.find(item => item.grant?.id === purchaseRef) : undefined;
    const revoked = Boolean(purchaseRef && (!order || order.status !== 'paid' || !order.acknowledged ||
      (save.commerceAccount && order.accountId !== save.commerceAccount)));
    if (!revoked && now < deadline) continue;
    attempt.board = restoreFiniteBudget(attempt.board);
    attempt.undo = attempt.undo.map(restoreFiniteBudget);
    attempt.unlimited.expired = true;
    changed = true;
  }
  if (changed) save.revision++;
  return changed;
}
