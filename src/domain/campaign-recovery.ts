import { applyBoard } from './engine';
import { recordUndo } from './history';
import { activePurchaseGoods } from './commerce/orders';
import { releaseProfile } from '../config/profile';
import { LEGACY_OWNER_PREVIEW, OWNER_ACCEPTANCE_PREVIEW } from './types';
import type { Attempt, Board, Deal, Save } from './types';

export const RECOVERY_PREVIEW = LEGACY_OWNER_PREVIEW === 'recovery';
export const RECOVERY_GAMEPLAY = releaseProfile?.capabilities.stockRestore === 'active' || RECOVERY_PREVIEW || OWNER_ACCEPTANCE_PREVIEW;

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

type UnlimitedAccess = NonNullable<Attempt['unlimitedAccess']>;

export function validUnlimitedAccess(access: UnlimitedAccess, attempt: Attempt, deal: Deal) {
  return Boolean(access && deal.recovery && !deal.daily && access.version === 1 &&
    typeof access.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(access.id) && access.attemptId === attempt.id &&
    ['rewarded', 'campaign', 'coins'].includes(access.source) &&
    Number.isSafeInteger(access.issuedAt) && access.issuedAt >= 0 &&
    Number.isSafeInteger(access.until) && access.until > access.issuedAt &&
    (access.consumed === undefined || access.consumed === true) &&
    (access.expired === undefined || (access.expired === true && !access.consumed)) && validUnlimitedClock(access));
}

export function grantUnlimitedAccess(save: Save, deal: Deal, grant: UnlimitedAccess) {
  const { attempt } = save;
  if (attempt.unlimitedAccess || grant.consumed || grant.expired || !unlimitedEligible(attempt, deal) ||
      !validUnlimitedAccess(grant, attempt, deal)) return false;
  attempt.unlimitedAccess = { ...grant };
  save.revision++;
  return true;
}

export function canBuyUnlimitedAccess(save: Save, deal: Deal) {
  return Boolean(deal.extraHelpers && !save.attempt.unlimited && !save.attempt.unlimitedAccess &&
    save.profile.coins >= deal.extraHelpers.unlimitedCoins && unlimitedEligible(save.attempt, deal));
}

export function buyUnlimitedAccess(save: Save, deal: Deal, id: string, now: number) {
  const policy = deal.extraHelpers;
  if (!policy || !canBuyUnlimitedAccess(save, deal) || !Number.isSafeInteger(now) || now < 0 ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !Number.isSafeInteger(now + policy.unlimitedMs)) return false;
  const quote: UnlimitedAccess = { version: 1, id, attemptId: save.attempt.id, source: 'coins',
    issuedAt: now, until: now + policy.unlimitedMs };
  if (!beginUnlimited(save, deal, quote, now)) return false;
  save.attempt.unlimitedAccess = { ...quote, consumed: true };
  save.profile.coins -= policy.unlimitedCoins;
  return true;
}

export function quoteUnlimitedAccess(save: Save, deal: Deal, now: number, reading?: ClockReading) {
  const { attempt } = save;
  const access = attempt.unlimitedAccess;
  if (!access || access.consumed || access.expired || attempt.unlimited || !unlimitedEligible(attempt, deal) ||
      !Number.isSafeInteger(now) || (!reading && now < access.issuedAt) || !unlimitedRemaining(access, now, reading)) return;
  return access;
}

export function useUnlimitedAccess(save: Save, deal: Deal, grantId: string, now: number, reading?: ClockReading) {
  const quote = quoteUnlimitedAccess(save, deal, now, reading);
  if (quote?.id !== grantId || !beginUnlimited(save, deal, quote, quote.clock ? quote.issuedAt : now)) return false;
  if (quote.clock) save.attempt.unlimited!.clock = quote.clock;
  quote.consumed = true;
  return true;
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

interface ClockReading { timeline: string; elapsed: number }

type TimedRight = Pick<NonNullable<Attempt['unlimited']>, 'until' | 'issuedAt' | 'expired' | 'clock'>;

export function validUnlimitedClock(right: TimedRight) {
  const clock = right.clock;
  return clock === undefined || Boolean(clock && right.until && typeof clock.timeline === 'string' &&
    /^(android-\d+|page-[a-f0-9-]{36})$/.test(clock.timeline) && Number.isSafeInteger(clock.elapsed) &&
    clock.elapsed >= 0 && Number.isSafeInteger(clock.wall) && clock.wall >= right.issuedAt && clock.wall < right.until);
}

export function unlimitedRemaining(right: TimedRight, now: number, reading?: ClockReading) {
  if (right.until === undefined || right.expired) return;
  const anchor = right.clock;
  if (reading && now < right.issuedAt && (!anchor || reading.timeline !== anchor.timeline)) return 0;
  if (anchor?.timeline.startsWith('android-') && reading && reading.timeline !== anchor.timeline) {
    // Across a reboot there is no comparable offline elapsed clock.
    return 0;
  }
  const floor = anchor && reading?.timeline === anchor.timeline
    ? anchor.wall + Math.max(0, reading.elapsed - anchor.elapsed) : anchor?.wall ?? right.issuedAt;
  if (anchor && reading?.timeline !== anchor.timeline && now < floor) return 0;
  return Math.max(0, right.until - Math.max(now, floor));
}

function observeClock(right: TimedRight, now: number, remaining: number, reading?: ClockReading) {
  if (!reading || right.until === undefined) return false;
  const old = right.clock, wall = right.until - remaining;
  if (old && old.timeline === reading.timeline &&
      (now !== wall || now <= old.wall + Math.max(0, reading.elapsed - old.elapsed))) return false;
  right.clock = { ...reading, wall };
  return true;
}

export function expireUnlimited(save: Save, now: number, reading?: ClockReading) {
  if (!Number.isSafeInteger(now)) return false;
  let changed = false;
  for (const attempt of [save.attempt, save.parked?.campaign]) {
    const access = attempt?.unlimitedAccess;
    if (access && !access.consumed && !access.expired) {
      const remaining = unlimitedRemaining(access, now, reading)!;
      if (remaining === 0) {
        access.expired = true;
        changed = true;
      } else if (observeClock(access, now, remaining, reading)) changed = true;
    }
    const deadline = attempt?.unlimited?.until;
    if (!attempt?.unlimited || attempt.unlimited.expired || deadline === undefined) continue;
    const purchaseRef = attempt.unlimited.purchaseRef;
    const order = purchaseRef ? save.commerce?.orders.find(item => item.grant?.id === purchaseRef) : undefined;
    const revoked = Boolean(purchaseRef && (!order || order.status !== 'paid' || !order.acknowledged ||
      (save.commerceAccount && order.accountId !== save.commerceAccount)));
    const right = attempt.unlimited;
    const remaining = unlimitedRemaining(right, now, reading);
    if (!revoked && remaining !== 0) {
      if (observeClock(right, now, remaining!, reading)) changed = true;
      continue;
    }
    attempt.board = restoreFiniteBudget(attempt.board);
    attempt.undo = attempt.undo.map(restoreFiniteBudget);
    attempt.unlimited.expired = true;
    changed = true;
  }
  if (changed) save.revision++;
  return changed;
}
