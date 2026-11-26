import { findDeal } from '../../src/content/campaign';
import { content8Special } from '../../src/content/campaign-v8-special';
import { expect, test } from '@playwright/test';
import { recoverable } from '../fixtures/content8-loss';
import { updatePreviewTasks } from '../../src/domain/events/daily-tasks';
import { rewardOfferState } from '../../src/domain/reward-offers';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { campaignId } from '../../src/domain/progression';
import { dispatch, freshSave } from '../../src/domain/engine';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { hitappsDirectorDeals } from '../../src/content/campaign-v8-hitapps-director';
import { boardFrame, layout } from '../../src/game/layout';
import { move, read } from './wallet-fixture';

test.skip(!process.env.VITE_ASOC_PROFILE, 'Requires the explicit integrated release build');
if (process.env.ASOC_RELEASE_DEMO === '1') test.use({ video: 'on' });

test('L15 to adaptive L16 through the normal campaign UI, then reopen and retain Undo', async ({ page }) => {
  const level = content8Dealer[14];
  let save = freshSave(level, 'level-15');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category', 'learn:match', 'learn:stock', 'hint-demo', 'undo-used'] };
  for (const command of level.winningPath) save = dispatch(save, command, level).next;
  save.platform!.completedCampaign = Array.from({ length: 15 }, (_, index) => campaignId(index + 1));
  save.difficultyPenalty = 10;
  save.profile.coins = 500;
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', value);
  }, JSON.stringify(save));
  await page.goto('/');
  const manifest = await page.request.get('/release-manifest.json');
  expect(await manifest.json()).toMatchObject({ id: 'c8-release-v1', contentVersion: 8, capabilities: { purchases: 'off', proofShuffle: 'active', contextOffers: 'active' }, policies: { chargedShuffleLevel: 30 } });
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#campaign-lives-open')).toBeVisible();
  await page.locator('#home-play').tap();
  await page.locator('#next-level').tap();
  const difficulty = page.locator('#difficulty-play');
  if (await difficulty.isVisible()) await difficulty.tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).toMatch(/-c8-core-r1-rights-r1$/);
  const issued = (await read(page)).attempt;
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', issued.dealId);
  await page.locator('#wallet-open').tap();
  await expect(page.locator('#random-joker-open')).toBeVisible();
  const before = await read(page);
  await expect(page.locator('#random-joker-open')).toContainText('250 монет');
  await page.locator('#random-joker-open').tap();
  await expect(page.locator('#random-joker-copy')).toContainText('250 монет');
  expect((await read(page)).profile.coins).toBe(before.profile.coins);
  await page.locator('#random-joker-confirm').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(before.profile.coins - 250);
  expect((await read(page)).profile.jokers).toBe(before.profile.jokers);
  await page.locator('#wallet-open').tap();
  await page.locator('#random-joker-open').tap();
  await expect(page.locator('#random-joker-confirm')).toHaveText('Разместить');
  await page.locator('#random-joker-warning [data-close]').tap();
  if (await page.locator('#helpers').isVisible()) await page.locator('#helper-return').tap();
  const baseId = issued.dealId.replace(/-c8-core-r1-rights-r1$/, '');
  const base = hitappsDirectorDeals.find(entry => entry.deal.id === baseId)?.deal ?? content8Wave[0];
  const rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, base);
  const stock = layout(issued.board, base, frame, save.settings.deckSide, save.settings.deckPosition).stock;
  await page.touchscreen.tap(rect.x + frame.offsetX + stock.x * frame.unit, rect.y + stock.y * frame.unit);
  await expect.poll(async () => (await read(page)).attempt.undo.length).toBe(1);
  const moved = (await read(page)).attempt;
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', issued.dealId);
  expect((await read(page)).attempt).toEqual(moved);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(issued.board);
});

test('opens the Frozen teaching deal through Next and keeps the board and Undo at compact widths', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'compact' ? { width: 320, height: 568 } : { width: 390, height: 844 });
  const prior = content8Special.find(deal => deal.campaignLevel === 18)!;
  const frozen = findDeal('campaign-c8-ftue-019-r1')!;
  let save = freshSave(prior, 'won-level-18');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category', 'learn:match', 'learn:stock', 'hint-demo', 'undo-used'] };
  for (const command of prior.winningPath) save = dispatch(save, command, prior).next;
  save.platform!.completedCampaign = Array.from({ length: 18 }, (_, index) => campaignId(index + 1));
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', value);
  }, JSON.stringify(save));
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await page.locator('#next-level').tap();
  if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', frozen.id);
  const starting = (await read(page)).attempt;
  expect(starting.board).toEqual(frozen.initial);
  await move(page, frozen, frozen.winningPath[0]);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(starting.board);
});

test('claims free shop coins through the ordinary helper panel on an offline build', async ({ page }) => {
  const campaign = content8Wave[0];
  const save = freshSave(campaign, 'free-shop-coins');
  save.contentVersion = 8;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 15 }, (_, index) => campaignId(index + 1)) };
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category', 'learn:match', 'learn:stock', 'hint-demo', 'undo-used'] };
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', value);
  }, JSON.stringify(save));
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await page.locator('#wallet-open').tap();
  await expect(page.locator('#coffee-open')).toBeHidden();
  await expect(page.locator('#shop-video-claim')).toBeDisabled();
  await expect(page.locator('#shop-video-status')).not.toBeEmpty();
  await page.locator('#shop-free-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(save.profile.coins + 30);
  await expect(page.locator('#shop-free-claim')).toBeDisabled();
  await expect(page.locator('#shop-free-claim')).toContainText('получены');
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).profile.coins).toBe(save.profile.coins + 30);
});

test('opens cards in Daily Bonus, resumes the same round and claims only once', async ({ page }) => {
  const deal = content8Dealer[2];
  const save = freshSave(deal, 'bonus-browser');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: [campaignId(1), campaignId(2)] };
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', value);
  }, JSON.stringify(save));
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-bonus-open').tap();
  const round = (await read(page)).dailyBonus!;
  const chosen = round.slots.flatMap((column, index) => column === 0 ? [index] : []);
  const cards = page.locator('#daily-bonus-cards button');
  await cards.nth(chosen[0]).tap();
  await expect.poll(async () => (await read(page)).dailyBonus?.revealed).toEqual([chosen[0]]);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-bonus-open').tap();
  expect((await read(page)).dailyBonus?.roundId).toBe(round.roundId);
  await cards.nth(chosen[1]).tap();
  await cards.nth(chosen[2]).tap();
  await page.locator('#daily-bonus-claim').tap();
  await expect(page.locator('#daily-bonus-status')).toHaveText('Приз получен');
  await expect(page.locator('#daily-bonus-claim')).toBeHidden();
  expect((await read(page)).dailyBonus?.claimed).toBe(true);
});

test('uses both task Definition charges and opens normal offers when the stock is empty', async ({ page }) => {
  let save = freshSave(recoverable, 'task-definition');
  save.contentVersion = 8;
  for (const command of recoverable.winningPath.slice(0, 20)) save = dispatch(save, command, recoverable).next;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 15 }, (_, index) => campaignId(index + 1)) };
  save.settings.reducedMotion = true;
  updatePreviewTasks(save, Date.now());
  rewardOfferState(save).definitions = 0;
  save.dailyTasks!.inventory.definitions = 2;
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', value);
  }, JSON.stringify(save));
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  const rect = (await page.locator('#game-root').boundingBox())!;
  const board = save.attempt.board;
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, recoverable);
  const geometry = layout(board, recoverable, frame, save.settings.deckSide, save.settings.deckPosition);
  const pose = geometry.poses.find(p => p.faceUp && board.tableau.some(col => col.at(-1) === p.id) &&
    board.faceUp.some(id => id !== p.id && !recoverable.cards[id].leader && recoverable.cards[id].category === recoverable.cards[p.id].category))!;
  const use = page.locator('#definition-use');
  for (let available = 2; available >= 0; available--) {
    await page.locator('#inspect').tap();
    await page.touchscreen.tap(rect.x + frame.offsetX + pose.x * frame.unit, rect.y + pose.y * frame.unit);
    await expect(use).toHaveText(`Связанное слово · ${available}`);
    if (!available) break;
    await use.tap();
    await expect(page.locator('#definition-related')).toBeVisible();
    await page.getByRole('button', { name: 'Понятно' }).tap();
  }
  await expect(use).toBeDisabled();
  await page.locator('#definition-refill').tap();
  await expect(page.locator('#helpers')).toBeVisible();
  await expect(page.locator('#product-offer-helpers')).toContainText('Объяснения');
  await expect(page.locator('#product-offer-helpers')).toContainText('не гарантирован');
  await expect.poll(async () => (await read(page)).productOffers?.reservation).toMatchObject({ resource: 'definition', surface: 'definition' });
  await expect(page.locator('#shop-free-claim')).toBeVisible();
  await expect(page.locator('#shop-video-claim')).toBeDisabled();
  await expect(page.locator('#shop-video-status')).not.toBeEmpty();
  await page.locator('#shop-free-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(save.profile.coins + 30);
  const after = await read(page);
  expect(after.dailyTasks?.inventory.definitions).toBe(0);
  expect(after.attempt.board).toEqual(board);
  expect(after.commerceAccount).toBeUndefined();
});
