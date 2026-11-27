import { describe, expect, it } from 'vitest';
import { quoteAdaptiveRetry, commitAdaptiveRetry } from '../../src/app/campaign-retry';
import { campaignDeals, findDeal, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { releaseProfile } from '../../src/config/profile';
import { LIVES_RULES, refreshCampaignLives } from '../../src/domain/campaign-lives';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { decodeSave, SaveStore } from '../../src/platform/storage';

function exhausted(level = 16) {
  const base = campaignDeals[level - 1];
  const context = freshSave(base, 'selection-context');
  context.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: level - 1 }, (_, i) => campaignId(i + 1)) };
  const deal = selectCampaignDeal(context, base);
  const save = { ...context, attempt: freshSave(deal, 'exhausted-original').attempt };
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  save.attempt.director = { restarts: 2, previousLosses: 2, exhausted: true };
  save.attempt.sourceDifficulty = { outcome: 'Restart', restarts: 2 };
  refreshCampaignLives(save, 100);
  return { save, deal };
}

describe.skipIf(!releaseProfile)('explicit adaptive retry', () => {
  it('keeps fixed restart immutable and offers the current director bank only after a useful change', () => {
    const { save, deal } = exhausted();
    const quote = quoteAdaptiveRetry(save)!;
    expect(quote).toBeDefined();
    expect(quote.selected.id).not.toBe(deal.id);
    expect(quote.changesLayout).toBe(true);
    const fixed = dispatch(save, { type: 'restart', attemptId: 'fixed-replay' }, deal);
    expect(fixed.accepted).toBe(true);
    expect(fixed.next.attempt.dealId).toBe(deal.id);
    expect(fixed.next.attempt.board).toEqual(deal.initial);
    save.attempt.director = { restarts: 0, previousLosses: 0, exhausted: true };
    expect(quoteAdaptiveRetry(save)?.changesLayout).toBe(true);
    save.attempt.director = { restarts: 2, previousLosses: 2, exhausted: true };
    save.platform!.completedCampaign.push(campaignId(16));
    expect(quoteAdaptiveRetry(save)).toBeUndefined();
    expect(quoteAdaptiveRetry(freshSave(dailyForDay('2026-11-24'), 'daily'))).toBeUndefined();
  });

  it('selects a different layout with a larger budget, preserving charged Shuffle on L36', () => {
    const { save, deal } = exhausted(36);
    save.difficultyPenalty = 10;
    const quote = quoteAdaptiveRetry(save)!;
    expect(quote.changesLayout).toBe(true);
    expect(quote.selected.initial.movesLeft).toBeGreaterThan(deal.initial.movesLeft!);
    expect(quote.selected.shufflePolicy).toBe('hidden-pool-r1');
    expect(quote.selected.shuffleCost).toBe('charge');
    expect(quote.selected.recovery).toBeUndefined();
    expect(commitAdaptiveRetry(save, quote, 'budget-retry', 110)).toBe('started');
    expect(save.attempt.issuance).toMatchObject({ source: 'certified-seed', policy: 'campaign-core-stage1-v1', dealId: quote.selected.id,
      effectiveBudget: quote.selected.initial.movesLeft });
    expect(decodeSave(JSON.stringify(save), findDeal)).toEqual(save);
  });

  it('commits one loss, new identity and director history atomically, retaining paid unused Joker rights', async () => {
    const { save, deal } = exhausted();
    save.attempt.randomJokerAccess = { version: 1, id: 'old-paid-unused', source: 'coins', cost: 250, issuedAt: 10 };
    let raw: string | null = JSON.stringify(save), mode: 'ok' | 'fail' | 'ambiguous' = 'ok';
    const disk = { getItem: async () => raw, setItem: async (_key: string, value: string) => {
      if (mode === 'fail') throw Error('disk full');
      raw = value;
      if (mode === 'ambiguous') throw Error('response lost');
    }, removeItem: async () => undefined };
    const store = new SaveStore(disk, findDeal, () => save);
    await store.open();
    const quote = quoteAdaptiveRetry(store.state)!;
    const retry = () => store.mutate(next => commitAdaptiveRetry(next, quote, 'atomic-new-attempt', 110));
    const before = structuredClone(store.state);
    mode = 'fail';
    await expect(retry()).rejects.toThrow();
    expect(store.state).toEqual(before);
    mode = 'ambiguous';
    expect(await Promise.all([retry(), retry()])).toEqual(['started', 'stale']);
    expect(store.state.attempt.dealId).not.toBe(deal.id);
    expect(store.state.attempt.id).toBe('atomic-new-attempt');
    expect(store.state.campaignLives?.remaining).toBe(LIVES_RULES.max - 1);
    expect(store.state.attempt.director).toMatchObject({ restarts: 3, previousLosses: 3 });
    expect(store.state.attempt.sourceDifficulty).toEqual({ outcome: 'Restart', restarts: 3 });
    expect(store.state.attempt.issuance).toMatchObject({ dealId: quote.selected.id, source: 'certified-seed', policy: 'campaign-core-stage1-v1' });
    expect(store.state.randomJokers?.grants).toEqual([{ version: 1, id: 'old-paid-unused', source: 'coins', cost: 250, issuedAt: 10 }]);
    mode = 'ok';
    const reopened = new SaveStore(disk, findDeal, () => save);
    await reopened.open();
    expect(reopened.state).toEqual(store.state);
  });

  it('records the last-life loss once and permits the same new-attempt request after the existing free timer', () => {
    const { save } = exhausted();
    save.profile.coins = save.profile.hints = save.profile.undos = save.profile.jokers = 0;
    save.campaignLives = { version: 2, remaining: 1, observedAt: 100, refillAt: 100 + LIVES_RULES.refillMs, earnedCredits: 0 };
    const quote = quoteAdaptiveRetry(save)!;
    expect(commitAdaptiveRetry(save, quote, 'after-timer', 110)).toBe('lives');
    expect(save.attempt.id).toBe('exhausted-original');
    expect(save.attempt.lostLife).toBe(true);
    expect(save.campaignLives.remaining).toBe(0);
    const lost = structuredClone(save);
    expect(commitAdaptiveRetry(save, quote, 'after-timer', 120)).toBe('lives');
    expect(save).toEqual(lost);
    expect(commitAdaptiveRetry(save, quote, 'after-timer', 100 + LIVES_RULES.refillMs)).toBe('started');
    expect(save.campaignLives.remaining).toBe(1);
    expect(save.attempt.id).toBe('after-timer');
    expect(save.profile.coins).toBe(0);
  });

  it('selects a certified generated layout where one exists and retains its seed passport', () => {
    const { save, deal } = exhausted(33), quote = quoteAdaptiveRetry(save)!;
    expect(quote.changesLayout).toBe(true);
    expect(quote.selected.initial.tableau).not.toEqual(deal.initial.tableau);
    expect(commitAdaptiveRetry(save, quote, 'generated-retry', 110)).toBe('started');
    expect(save.attempt.issuance).toMatchObject({ source: 'certified-seed', dealId: quote.selected.id });
    expect(save.attempt.issuance?.seed?.boardHash).toBeDefined();
    expect(save.attempt.board).toEqual(quote.selected.initial);
    expect(decodeSave(JSON.stringify(save), findDeal)).toEqual(save);
  });

  it('rejects a stale or invalid issuance request before spending any life', () => {
    const { save } = exhausted(), quote = quoteAdaptiveRetry(save)!;
    const before = structuredClone(save);
    expect(commitAdaptiveRetry(save, quote, save.attempt.id, 110)).toBe('stale');
    expect(commitAdaptiveRetry(save, { ...quote, selected: campaignDeals[0] }, 'new', 110)).toBe('stale');
    expect(commitAdaptiveRetry(save, { ...quote, attemptId: 'different' }, 'new', 110)).toBe('stale');
    expect(commitAdaptiveRetry(save, quote, 'invalid id', 110)).toBe('stale');
    expect(save).toEqual(before);
  });
});
