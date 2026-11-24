import { campaignDeals, campaignIssuance, findDeal, selectCampaignDeal } from '../content/campaign';
import { releaseProfile } from '../config/profile';
import { beginDeal } from '../domain/campaign';
import { mayStartCampaignAttempt } from '../domain/campaign-lives';
import { campaignId } from '../domain/progression';
import type { Deal, Save } from '../domain/types';

export interface AdaptiveRetryQuote {
  attemptId: string; dealId: string; level: number; selected: Deal; changesLayout: boolean;
}

/** New issuance is explicit. Ordinary restart continues to replay its immutable deal. */
export function quoteAdaptiveRetry(save: Save): AdaptiveRetryQuote | undefined {
  const previous = save.attempt;
  if (!releaseProfile || previous.daily || previous.board.phase !== 'exhausted' || previous.board.movesLeft !== 0) return;
  const current = findDeal(previous.dealId), level = current?.campaignLevel;
  if (!current || level === undefined || level < 16 || save.platform?.completedCampaign.includes(campaignId(level))) return;
  const base = campaignDeals[level - 1];
  if (!base) return;
  const selected = selectCampaignDeal(save, base, previous);
  if (selected.id === current.id) return;
  const layout = (deal: Deal) => JSON.stringify([deal.initial.tableau, deal.initial.stock, deal.initial.faceUp]);
  const changesLayout = layout(current) !== layout(selected);
  if (!changesLayout && (selected.initial.movesLeft ?? 0) <= (current.initial.movesLeft ?? 0)) return;
  return { attemptId: previous.id, dealId: previous.dealId, level, selected, changesLayout };
}

/** Invoke inside SaveStore.mutate: loss debit, history and new passport settle together. */
export function commitAdaptiveRetry(save: Save, quote: AdaptiveRetryQuote, attemptId: string, now: number): 'started' | 'lives' | 'stale' {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(attemptId) || attemptId === save.attempt.id ||
      !Number.isSafeInteger(now) || now < 0 || save.attempt.id !== quote.attemptId || save.attempt.dealId !== quote.dealId) return 'stale';
  const current = quoteAdaptiveRetry(save);
  if (!current || current.level !== quote.level || current.selected.id !== quote.selected.id) return 'stale';
  const previous = save.attempt, previousDeal = findDeal(previous.dealId)!;
  if (!mayStartCampaignAttempt(save, previous, now)) return 'lives';
  beginDeal(save, current.selected, attemptId, previousDeal);
  const issuance = campaignIssuance(save, campaignDeals[current.level - 1], current.selected);
  if (issuance) save.attempt.issuance = issuance;
  return 'started';
}
