import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { freshSave } from '../../src/domain/engine';
import { claimDailyBonus, openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import { updatePreviewTasks } from '../../src/domain/events/daily-tasks';
import { prepareShuffleBoard } from '../../src/domain/proof-shuffle';
import { campaignId } from '../../src/domain/progression';
import { SHUFFLE_INTRO_KEY } from '../../src/domain/shuffle-progression';
import { shuffleIntroWitness } from '../fixtures/mvp-shuffle';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary integrated C8 release build');
test.use({ timezoneId: 'UTC' });
if (process.env.ASOC_MVP_DEMO === '1') test.use({ video: 'on' });

const KEY = 'asoc-solitaire.save.v1', NOW = Date.UTC(2026, 10, 24, 12);
const deal = findDeal(shuffleIntroWitness.id)!;

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('L30 grants its first Shuffle after an already claimed Bonus and commits a real worker proof once', async ({ page }, info) => {
  test.setTimeout(60_000);
  expect(shuffleIntroWitness.prefix).toBe(0);
  expect(shuffleIntroWitness.seed).toBe(7);
  const save = freshSave(deal, 'mvp-shuffle-initial');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category',
    'learn:match', 'learn:stock', 'learn:covered-waste', 'hint-demo', 'hint-practiced', 'undo-used', 'joker-buffer'] };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 29 }, (_, i) => campaignId(i + 1)) };
  updatePreviewTasks(save, NOW);
  const round = openDailyBonusRound(save, NOW, 'already-claimed-shuffle-intro', () => 0)!;
  for (const [index, column] of round.slots.entries()) if (column === 0) revealDailyBonusCard(save, round.roundId, index, NOW);
  expect(claimDailyBonus(save, round.roundId, NOW)).toEqual({ kind: 'Coins', quantity: 10 });
  expect(save.dailyTasks!.inventory.shuffles).toBe(0);
  expect(save.profile.rewards).not.toContain(SHUFFLE_INTRO_KEY);
  const sourceInitial = structuredClone(deal.initial);
  const expected = prepareShuffleBoard(sourceInitial, deal, shuffleIntroWitness.seed)!;
  expect(expected).toBeDefined();
  expect(expected).not.toEqual(sourceInitial);
  const workers: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(({ key, value, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    // The production worker and its 1.8s search bound are unchanged. Only the
    // requested random seed is fixed to the independently replayed initial witness.
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array: ArrayBufferView<ArrayBuffer>) {
        if (array instanceof Uint32Array && array.length === 1) { array[0] = seed; return array; }
        return original(array);
      },
    });
  }, { key: KEY, value: JSON.stringify(save), seed: shuffleIntroWitness.seed });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#home')).toBeVisible();
  await expect.poll(async () => (await read(page)).dailyTasks?.inventory.shuffles).toBe(1);
  const granted = await read(page);
  expect(granted.profile.rewards.filter(key => key === SHUFFLE_INTRO_KEY)).toHaveLength(1);
  expect(granted.dailyBonus).toEqual(save.dailyBonus);
  expect(granted.attempt.board).toEqual(sourceInitial);
  expect(granted.attempt.dealId).toBe(deal.id);
  expect(granted.attempt.board.movesLeft).toBe(124);
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#proof-shuffle')).toBeEnabled();
  await expect(page.locator('#proof-shuffle-label')).toHaveText('Перемешать · 1');
  await expect(page.locator('#proof-shuffle svg')).toBeVisible();
  await expect(page.locator('#proof-shuffle svg')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await capture(page, info, 'shuffle-before');

  await page.locator('#proof-shuffle').tap();
  await expect(page.locator('#shuffle-warning')).toBeVisible();
  await expect(page.locator('#shuffle-warning')).toContainText('история отмены очистится');
  const consent = await read(page);
  expect(consent.attempt.board).toEqual(sourceInitial);
  expect(consent.dailyTasks!.inventory.shuffles).toBe(1);
  await capture(page, info, 'shuffle-consent');
  await page.locator('#shuffle-confirm').tap();
  await expect.poll(async () => (await read(page)).attempt.shuffleUsed, { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#proof-shuffle')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#proof-shuffle-label')).toHaveText('Использовано');
  await expect(page.locator('#proof-shuffle')).toBeDisabled();
  await expect(page.locator('#undo')).toBeDisabled();
  expect(workers.filter(url => url.includes('shuffle.worker'))).toHaveLength(1);
  const committed = await read(page);
  expect(committed.attempt.id).toBe(save.attempt.id);
  expect(committed.attempt.dealId).toBe(deal.id);
  expect(committed.attempt.board).toEqual(expected);
  expect(committed.attempt.board.movesLeft).toBe(sourceInitial.movesLeft);
  expect(committed.attempt.board.recyclesLeft).toBe(sourceInitial.recyclesLeft);
  expect(committed.attempt.board.faceUp).toEqual(sourceInitial.faceUp);
  expect(committed.attempt.undo).toEqual([]);
  expect(committed.dailyTasks!.inventory.shuffles).toBe(0);
  expect(committed.profile).toEqual(granted.profile);
  expect(committed.dailyBonus).toEqual(granted.dailyBonus);
  expect(deal.initial).toEqual(sourceInitial);
  await capture(page, info, 'shuffle-committed');

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#proof-shuffle-label')).toHaveText('Использовано');
  await expect(page.locator('#proof-shuffle')).toBeDisabled();
  const restored = await read(page);
  expect(restored.attempt.board).toEqual(committed.attempt.board);
  expect(restored.attempt.undo).toEqual([]);
  expect(restored.dailyTasks!.inventory.shuffles).toBe(0);
  expect(restored.profile.rewards.filter(key => key === SHUFFLE_INTRO_KEY)).toHaveLength(1);
  expect(restored.dailyBonus).toEqual(granted.dailyBonus);
  await capture(page, info, 'shuffle-reloaded');
});
