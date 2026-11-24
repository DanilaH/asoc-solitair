import { coreSpecialDeals } from '../../src/content/campaign-v8-integrated-specials';
import { content8Special } from '../../src/content/campaign-v8-special';
import { expect, test } from '@playwright/test';
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
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', value);
  }, JSON.stringify(save));
  await page.goto('/');
  const manifest = await page.request.get('/release-manifest.json');
  expect(await manifest.json()).toMatchObject({ id: 'c8-release-v1', contentVersion: 8, capabilities: { purchases: 'off' } });
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#campaign-lives-open')).toBeVisible();
  await page.locator('#home-play').tap();
  await page.locator('#next-level').tap();
  const difficulty = page.locator('#difficulty-play');
  if (await difficulty.isVisible()) await difficulty.tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).toMatch(/-c8-core-r1$/);
  const issued = (await read(page)).attempt;
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', issued.dealId);
  await page.locator('#wallet-open').tap();
  await expect(page.locator('#random-joker-open')).toBeVisible();
  await page.locator('#random-joker-open').tap();
  await expect(page.locator('#random-joker-confirm')).toHaveText('Потратить 1 Джокера');
  await page.locator('#random-joker-warning [data-close]').tap();
  if (await page.locator('#helpers').isVisible()) await page.locator('#helper-return').tap();
  const baseId = issued.dealId.replace(/-c8-core-r1$/, '');
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

test('opens full Frozen level through Next and keeps the board and Undo at compact widths', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'compact' ? { width: 320, height: 568 } : { width: 390, height: 844 });
  const prior = content8Special.find(deal => deal.campaignLevel === 18)!;
  const frozen = coreSpecialDeals.find(deal => deal.campaignLevel === 19)!;
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
  await expect(page.locator('#shop-video-claim')).toBeHidden();
  await page.locator('#shop-free-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(save.profile.coins + 30);
  await expect(page.locator('#shop-free-claim')).toBeHidden();
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).profile.coins).toBe(save.profile.coins + 30);
});
