import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { E4_M1, M1 } from '../../src/config/economy';
import { releaseProfile } from '../../src/config/profile';
import { campaignDeals, campaignIssuance, selectCampaignDeal } from '../../src/content/campaign';
import { BALANCE } from '../../src/domain/balance';
import { beginDeal } from '../../src/domain/campaign';
import { claimDailyBonus, openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import { updatePreviewTasks, type TaskPrize } from '../../src/domain/events/daily-tasks';
import { dispatch, freshSave } from '../../src/domain/engine';
import { clearUndo } from '../../src/domain/history';
import { unlockedLevel } from '../../src/domain/progression';

assert.equal(releaseProfile?.id, 'c8-release-v1');
assert.equal(releaseProfile.capabilities.purchases, 'off');
const start = Date.UTC(2026, 10, 23, 12), dayMs = 86_400_000;
const policy = E4_M1 ? 'e4-m1' : 'pr229';
const routes: {
  level: number; deal: string; tier: number; steps: number; spare: number;
  tierBase: number; moves: number; combo: number; meta: number; gross: number; rv: number; hints: number;
}[] = [];
let save = freshSave(campaignDeals[0], 'economy');
for (const base of campaignDeals) {
  const level = base.campaignLevel!;
  assert.equal(unlockedLevel(save), level);
  const now = start + Math.floor((level - 1) / 3) * dayMs;
  const previous = level === 1 ? undefined : save.attempt;
  const deal = selectCampaignDeal(save, base, previous);
  beginDeal(save, deal, 'audit-' + level);
  save.attempt.issuance = campaignIssuance(save, base, deal, previous);
  const opening = { coins: save.profile.coins, hints: save.profile.hints };
  const date = new Date(now).toISOString().slice(0, 10);
  for (const command of deal.winningPath) {
    const result = dispatch(save, command, deal, date);
    assert(result.accepted, `L${level} ${deal.id}: ${result.reason}`);
    save = result.next;
    // These are first-clear witnesses without Undo. Test SaveStore and Undo separately.
    clearUndo(save.attempt);
  }
  assert.equal(save.attempt.board.phase, 'won', deal.id);
  assert.equal(save.platform?.completedCampaign.length, level);
  const payout = save.attempt.payout ?? [];
  const win = payout.find(grant => grant.reason === 'win')?.coins ?? 0;
  const victory = save.attempt.victory;
  const payoutCombo = payout.find(grant => grant.reason === 'campaign_combo')?.coins ?? 0;
  const meta = payout.filter(row => row.reason !== 'win' && row.reason !== 'campaign_combo').reduce((sum, row) => sum + row.coins, 0);
  const gross = save.profile.coins - opening.coins;
  const combo = gross - win - meta;
  assert(combo >= payoutCombo);
  const tierBase = victory?.tierBase ?? BALANCE.winCoins, spare = save.attempt.board.movesLeft ?? 0;
  const offer = save.rewardOffers?.multiplier?.selected[`win-${save.balanceVersion}-${level}`];
  const rv = offer ? tierBase * (offer === 'win-fivefold' ? 4 : 2) : 0;
  routes.push({ level, deal: deal.id, tier: victory?.tier ?? 0, steps: deal.winningPath.length, spare, tierBase,
    moves: win - tierBase, combo, meta, gross, rv, hints: save.profile.hints - opening.hints });
}
assert.equal(routes.length, 80);
assert.equal(save.platform?.receipts.length, 0);
assert.equal(save.commerce, undefined);

type Basket = 'light' | 'base' | 'heavy';
const controls = {
  E4: { free: 200, hint: 150, undo: 100, joker: 400, lower: 300, upper: 500, continue: 500 },
  M1: { free: M1.freeWallet, ...M1.helperPrices, lower: M1.lowerSlot, upper: M1.upperSlot, continue: M1.continueCoinPrice },
};
function randomFor(seed: number) {
  let x = seed;
  return (bound: number) => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // The RNG belongs to this simulation only.
    return Math.floor((x >>> 0) / 2 ** 32 * bound);
  };
}

function bonusSequence(trial: number) {
  const random = randomFor(0x4e2ab13 + trial * 0x13f37);
  const state = freshSave(campaignDeals[6], 'bonus');
  state.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0,
    lastFullscreenAt: 0, completedCampaign: Array.from({ length: 6 }, (_, i) => `campaign-00${i + 1}`) };
  updatePreviewTasks(state, start);
  const prizes: (TaskPrize | undefined)[] = [];
  for (let day = 0; day < 7; day++) {
    const now = start + day * dayMs;
    const round = openDailyBonusRound(state, now, 'week-' + day, random, 'azur-compiled-r1');
    assert(round);
    for (let i = 0; i < 12 && round.won === undefined; i++) assert(revealDailyBonusCard(state, round.roundId, i, now));
    const prize = claimDailyBonus(state, round.roundId, now);
    assert(prize);
    prizes.push(prize);
  }
  return prizes;
}

function simulate(price: typeof controls.E4, basket: Basket, bonus: ReturnType<typeof bonusSequence>, video: boolean, daily: boolean) {
  const repeat = { light: 1, base: 2, heavy: 3 }[basket];
  let balance = 100, denied = 0, views = 0;
  const inventory = { hint: 3, undo: 5, joker: 1 };
  for (let day = 0; day < 7; day++) {
    const dayRoutes = routes.slice(day * 3, day * 3 + 3);
    balance += price.free + dayRoutes.reduce((sum, row) => sum + row.tierBase + Math.floor(row.moves / 2) +
      Math.floor(row.combo / 2) + row.meta, 0);
    inventory.hint += dayRoutes.reduce((sum, row) => sum + row.hints, 0);
    // Optimistic model starts the source-shaped bonus from the first day of the week.
    const prize = bonus[day];
    if (prize?.kind === 'Coins') balance += prize.quantity;
    if (prize?.kind === 'MoveHint') inventory.hint += prize.quantity;
    if (prize?.kind === 'Undo') inventory.undo += prize.quantity;
    if (prize?.kind === 'Joker') inventory.joker += prize.quantity;
    if (day >= 2) { balance += 25; inventory.hint++; }
    if (day === 3 || day === 5) inventory.undo++;
    if (day === 6) balance += 100;
    if (day === 4) balance += 100; // Assume the free seasonal claim is earned this week.
    if (daily) balance += day === 6 ? 50 : 100; // Explicit +650 sensitivity, not the full calendar.
    if (video && (day === 2 || day === 4)) {
      const selected = dayRoutes.find(route => route.rv > 0);
      if (selected) { balance += selected.rv; views++; }
    }
    const request: Array<keyof Omit<typeof controls.E4, 'free'>> = Array.from({ length: repeat }, () => ['hint', 'undo'] as const).flat();
    if (day === 1) request.push('lower');
    if (day === 3) request.push('continue');
    if (day === 5) request.push('joker');
    if (basket !== 'light' && day === 2) request.push('upper');
    if (basket !== 'light' && day === 4) request.push('joker');
    if (basket !== 'light' && day === 6) request.push('continue');
    let walletUsed = false;
    for (const kind of request) {
      if (kind in inventory && inventory[kind as keyof typeof inventory] > 0) {
        inventory[kind as keyof typeof inventory]--;
        continue;
      }
      if (balance < price[kind] && video && !walletUsed) {
        balance += M1.videoWallet;
        views++;
        walletUsed = true;
      }
      if (balance < price[kind]) { denied++; continue; }
      balance -= price[kind];
    }
  }
  return { balance, denied, views };
}

const campaigns = [15, 40, 80].map(level => {
  const current = routes.slice(0, level);
  return { level, coins: current.reduce((sum, row) => sum + row.gross, 0),
    base: current.reduce((sum, row) => sum + row.tierBase, 0),
    moves: current.reduce((sum, row) => sum + row.moves, 0),
    combo: current.reduce((sum, row) => sum + row.combo, 0),
    meta: current.reduce((sum, row) => sum + row.meta, 0),
    minSpare: Math.min(...current.map(row => row.spare)) };
});
const experiments = [];
if (E4_M1) {
  const prizes = Array.from({ length: 1000 }, (_, trial) => bonusSequence(trial));
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const [control, prices] of Object.entries(controls))
    for (const basket of ['light', 'base', 'heavy'] as const)
      for (const daily of [false, true])
        for (const video of [false, true]) {
          const trials = prizes.map(bonus => simulate(prices, basket, bonus, video, daily));
          experiments.push({ control, basket, daily, video, deniedPercent: trials.filter(row => row.denied > 0).length / 10,
            medianBalance: median(trials.map(row => row.balance)), medianDenied: median(trials.map(row => row.denied)),
            medianViews: median(trials.map(row => row.views)) });
        }
}
const report = { policy, wins: routes.length, adReceipts: 0, purchases: 0, campaigns, routes, experiments };
mkdirSync('.recording/e4-m1', { recursive: true });
writeFileSync(`.recording/e4-m1/${policy}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ policy, campaigns, experiments }, null, 2));
