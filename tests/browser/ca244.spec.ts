import { expect, test, type Page } from '@playwright/test';
import corpus from '../fixtures/ca244-continue.json' with { type: 'json' };
import { findDeal } from '../../src/content/campaign';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { Board, Save } from '../../src/domain/types';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1' || process.env.VITE_ASOC_ARCHIVE_227 === '1' ||
  process.env.VITE_ASOC_ARCHIVE_229 === '1' || process.env.VITE_ASOC_ARCHIVE_230 === '1', 'Current ordinary M1');
if (process.env.ASOC_CA244_RECORD === '1') test.use({ video: 'on' });
const rows = corpus.positions.filter(row => row.shape === 'current' && row.candidateCost !== null);
function fixture(index: number, coins: number) {
  const row = rows[index], deal = findDeal(row.dealId.replace(/-m\d+$/, ''))!;
  expect(deal).toBeDefined();
  const save = freshSave(deal, 'ca244-ui');
  save.attempt.board = structuredClone(row.board) as unknown as Board;
  save.profile.coins = coins;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 199 }, (_, i) => campaignId(i+1)) };
  return save;
}
async function seed(page: Page, save: Save) {
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
}
for (const index of [0,1]) test(`CA-06 L200 ordinary worker proof ${index+1}, purchase and reopen`, async ({ page }, info) => {
  await seed(page, fixture(index, 900));
  const button = page.locator('#result-continue-coins');
  await expect(button).toBeEnabled();
  await expect(button).toContainText('900');
  await page.screenshot({ path: info.outputPath('continue-proof.png') });
  await button.tap();
  await expect(page.locator('#result')).toBeHidden();
  const save = await read(page);
  expect(save.profile.coins).toBe(0);
  expect(save.attempt.board.movesLeft).toBe(10);
  expect(save.attempt.continued).toBe(true);
  await page.screenshot({ path: info.outputPath('continue-resumed.png') });
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).attempt).toEqual(save.attempt);
  expect((await read(page)).profile.coins).toBe(0);
});
test('CA-06 insufficient wallet retains the entire board and replay action', async ({ page }) => {
  const save = fixture(0, 899);
  await seed(page, save);
  await expect(page.locator('#result-continue-coins')).toBeVisible();
  await expect(page.locator('#result-continue-coins')).toBeDisabled();
  await expect(page.locator('#replay')).toBeEnabled();
  expect((await read(page)).profile.coins).toBe(899);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
});
test('CA-06 failed worker leaves no paid offer and does not consume anything', async ({ page }) => {
  await page.route('**/assets/continue.worker-*.js', route => route.abort());
  const save = fixture(0, 900);
  await seed(page, save);
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result-continue-coins')).toBeHidden();
  await expect(page.locator('#replay')).toBeEnabled();
  expect((await read(page)).profile.coins).toBe(900);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
});
