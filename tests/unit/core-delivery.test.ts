import { expect, it } from 'vitest';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, campaignIssuance, findDeal, lateAdaptiveDeals, selectCampaignDeal } from '../../src/content/campaign';
import { coreSpecialDeals } from '../../src/content/campaign-v8-integrated-specials';
import { recoveryDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { expireUnlimited, grantUnlimitedAccess, quoteUnlimitedAccess, useUnlimitedAccess } from '../../src/domain/campaign-recovery';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave } from '../../src/platform/storage';
import { advance } from '../../tools/qa/gameplay-oracle';
import { sourceFrozenPositive } from '../../tools/content/hitapps-special-transitions';

it('keeps original full fields for new specials and replays the finished definitions independently', () => {
  for (const deal of [...coreSpecialDeals, ...lateAdaptiveDeals.filter(deal => deal.id.includes('-core-special-r1-'))]) {
    expect(Object.keys(deal.cards).length, deal.id).toBeGreaterThan(30);
    const start = freshSave(deal, 'proof-core-special');
    let save = start, board = start.attempt.board;
    for (const move of deal.winningPath) {
      const next = dispatch(save, move, deal);
      expect(next.accepted, deal.id).toBe(true);
      const oracle = advance(board, move, deal);
      expect(oracle, deal.id).toEqual(next.next.attempt.board);
      board = oracle!;
      save = next.next;
    }
    expect(board.phase, deal.id).toBe('won');
  }
});

it.skipIf(!releaseProfile)('binds generated provenance to the issued deal and carries it through a fixed restart', () => {
  const base = campaignDeals[15], save = freshSave(base, 'issuance');
  save.difficultyPenalty = -5;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const deal = selectCampaignDeal(save, base);
  const issued = freshSave(deal, 'generated');
  issued.attempt.issuance = campaignIssuance(save, base, deal);
  expect(issued.attempt.issuance).toMatchObject({
    dealId: deal.id,
    source: 'certified-seed', seed: { value: 47 }, equality: 'unknown-cohort',
  });
  const restart = dispatch(issued, { type: 'restart', attemptId: 'same-layout' }, deal).next;
  expect(restart.attempt.issuance).toEqual(issued.attempt.issuance);
  expect(decodeSave(JSON.stringify(restart), findDeal).attempt.issuance).toEqual(issued.attempt.issuance);
  restart.attempt.issuance!.effectiveBudget!++;
  expect(() => decodeSave(JSON.stringify(restart), findDeal)).toThrow('паспорт');
});

it('uses non-purchase rights once and expires both active and parked rights durably', () => {
  const deal = recoveryDeal, save = freshSave(deal, 'with-right');
  const grant = { version: 1, attemptId: save.attempt.id, id: 'earned-1', source: 'campaign', issuedAt: 200, until: 300 } as const;
  expect(grantUnlimitedAccess(save, deal, grant)).toBe(true);
  expect(grantUnlimitedAccess(save, deal, grant)).toBe(false);
  expect(useUnlimitedAccess(save, deal, grant.id, 199)).toBe(false);
  expect(useUnlimitedAccess(save, deal, grant.id, 200)).toBe(true);
  expect(save.attempt.board.movesLeft).toBeNull();
  expect(useUnlimitedAccess(save, deal, grant.id, 201)).toBe(false);
  switchMode(save, 'daily', dailyForDay('2026-11-24'), 'daily');
  expect(expireUnlimited(save, 300)).toBe(true);
  switchMode(save, 'campaign', deal, 'resume');
  expect(save.attempt.board.movesLeft).toBe(deal.initial.movesLeft);
  expect(decodeSave(JSON.stringify(save), findDeal).attempt.unlimitedAccess?.consumed).toBe(true);

  const unused = freshSave(deal, 'unused');
  expect(grantUnlimitedAccess(unused, deal, { ...grant, attemptId: unused.attempt.id })).toBe(true);
  expect(expireUnlimited(unused, 300)).toBe(true);
  expect(quoteUnlimitedAccess(unused, deal, 201)).toBeUndefined();
});

it('keeps the K2 classifier separate and preserves unresolved source inputs', () => {
  const input = { firstJoker: false, firstStarter: false, boosterSpendsMove: false,
    discriminator: 2, precedingIndex: 3, precedingJoker: true, placeOnJokerPositive: false } as const;
  expect(sourceFrozenPositive(input)).toBe(false);
  expect(sourceFrozenPositive({ ...input, firstJoker: true, discriminator: 3 })).toBe(false);
  expect(sourceFrozenPositive({ ...input, firstStarter: true, boosterSpendsMove: true })).toBe(true);
  expect(sourceFrozenPositive({ ...input, precedingIndex: 0 })).toBe(true);
  expect(sourceFrozenPositive({ ...input, precedingJoker: false })).toBe(true);
  expect(sourceFrozenPositive({ ...input, discriminator: 3 })).toBe(true);
  expect(sourceFrozenPositive({ ...input, discriminator: 9 })).toBe(false);
  expect(sourceFrozenPositive({ ...input, precedingJoker: 'UNKNOWN' })).toBe('UNKNOWN');
  expect(sourceFrozenPositive({ ...input, precedingJoker: 'UNKNOWN', placeOnJokerPositive: true })).toBe(true);
});
