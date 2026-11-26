import assert from 'node:assert/strict';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, campaignIssuance, selectCampaignDeal } from '../../src/content/campaign';
import { BALANCE } from '../../src/domain/balance';
import { beginDeal } from '../../src/domain/campaign';
import { LIVES_RULES, mayStartCampaignAttempt, refreshCampaignLives } from '../../src/domain/campaign-lives';
import { dispatch, freshSave } from '../../src/domain/engine';
import { claimTask, claimTaskMilestone, recordTaskSignal, updatePreviewTasks } from '../../src/domain/events/daily-tasks';
import { unlockedLevel } from '../../src/domain/progression';
import type { Save } from '../../src/domain/types';

assert.equal(releaseProfile?.id, 'c8-release-v1');
assert.equal(releaseProfile!.capabilities.purchases, 'off');
assert.equal(campaignDeals.length, 80);
const start = Date.UTC(2026, 10, 23, 12);
const dayMs = 86_400_000;
const checkpoints: object[] = [];
let save = freshSave(campaignDeals[0], 'economy-1');
let baseline = save.profile.coins;
let minSpare = Infinity;
for (const target of campaignDeals) {
  const level = target.campaignLevel!;
  const now = start + (level - 1) * dayMs;
  assert.equal(unlockedLevel(save), level);
  const previous = save.attempt;
  const deal = selectCampaignDeal(save, target, previous);
  if (level > 1) {
    assert(mayStartCampaignAttempt(save, previous, now));
    beginDeal(save, deal, `economy-${level}`);
    save.attempt.issuance = campaignIssuance(save, target, deal);
  }
  assert.equal(save.attempt.dealId, deal.id);
  if (level === 30) assert.equal(deal.shuffleCost, 'charge');
  for (const command of deal.winningPath) {
    const result = dispatch(save, command, deal, new Date(now).toISOString().slice(0, 10));
    assert(result.accepted, `L${level} ${deal.id}: ${result.reason}`);
    save = result.next;
  }
  assert.equal(save.attempt.board.phase, 'won', `L${level} ${deal.id}`);
  minSpare = Math.min(minSpare, save.attempt.board.movesLeft!);
  assert.equal(save.platform?.completedCampaign.length, level);
  assert.deepEqual(save.platform?.receipts, []);
  assert.equal(save.commerce, undefined);
  if ([15, 40, 80].includes(level)) {
    checkpoints.push({ level, earningsInSegment: save.profile.coins - baseline, balance: save.profile.coins, minSpare });
    baseline = save.profile.coins;
    minSpare = Infinity;
  }
}
const free: Save = freshSave(campaignDeals[1], 'economy-free');
free.profile.coins = 0;
free.campaignLives = { version: 2, remaining: 0, observedAt: start, refillAt: start + LIVES_RULES.refillMs, earnedCredits: 0 };
assert.equal(mayStartCampaignAttempt(free, undefined, start + LIVES_RULES.refillMs - 1), false);
refreshCampaignLives(free, start + LIVES_RULES.refillMs);
assert.equal(mayStartCampaignAttempt(free, undefined, start + LIVES_RULES.refillMs), true);
for (let day = 0; day < 7; day++) {
  const now = start + day * dayMs;
  updatePreviewTasks(free, now);
  assert(recordTaskSignal(free, now, { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 }));
  assert(claimTask(free, new Date(now).toISOString().slice(0, 10), 'visit'));
}
assert(claimTaskMilestone(free, '2026-11-23', 'week'));
assert.equal(free.profile.coins, 20);
assert.deepEqual(free.platform?.receipts ?? [], []);
console.log(JSON.stringify({ profile: releaseProfile!.id, wins: 80, adReceipts: 0, purchases: 0, campaignSpend: 0,
  checkpoints, optionPrices: BALANCE.helperPrices, freeLifeAfterMs: LIVES_RULES.refillMs, weeklyLoginMedals: 7,
  weeklyLoginCoins: free.profile.coins }, null, 2));
