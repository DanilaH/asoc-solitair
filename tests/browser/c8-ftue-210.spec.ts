import { expect, test } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { read, move } from './wallet-fixture';

if (process.env.ASOC_FTUE_RECORD === '1') test.use({ video: 'on' });

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary C8 release profile');

test('the first ordered lesson waits for the placed cards and resumes from the board', async ({ page }) => {
  const deal = findDeal('campaign-c8-special-017-core-special-r1')!;
  const plan = freshSave(deal, 'ftue-210-ordered');
  plan.contentVersion = 8;
  plan.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 16 }, (_, i) => campaignId(i + 1)) };
  await page.clock.install();
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, plan);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await page.locator('#learn-rule .primary').tap();
  const copy = page.locator('#lesson-copy');
  await expect(copy).toHaveText('Положите «Будни» в верхний слот.');
  await move(page, deal, deal.winningPath[0]);
  const current = await read(page);
  expect(current.attempt.board.foundations[0]).toContain('workdays');
  await expect(copy).toHaveText('Добавьте «Понедельник», карту №1.');

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await expect(page.locator('#learn-rule')).not.toBeVisible();
  await expect(copy).toHaveText('Добавьте «Понедельник», карту №1.');
  await move(page, deal, deal.winningPath[1]);
  const advanced = await read(page);
  expect(advanced.attempt.board.foundations[0]).toContain('workdays_1');
  expect(advanced.profile).toEqual(plan.profile);
  await expect(copy).not.toContainText('Понедельник');
});

test('the stock lesson changes from opening to transferring only after the waste changes', async ({ page }) => {
  const deal = findDeal('campaign-c8-dealer-002')!;
  const plan = freshSave(deal, 'ftue-210-stock');
  plan.contentVersion = 8;
  plan.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: [campaignId(1)] };
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, plan);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  const copy = page.locator('#lesson-copy');
  await expect(copy).toHaveText('Положите тему в верхний слот.');
  await move(page, deal, deal.winningPath[0]);
  await expect(copy).toHaveText('Откройте колоду. Карта появится в сбросе.');
  expect((await read(page)).attempt.board.waste).toEqual([]);
  const earlyCopy = page.evaluate(() => {
    const text = document.querySelector('#lesson-copy')!;
    const key = 'asoc-solitaire.save.v1';
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Draw was not committed')), 4000);
      const wait = setInterval(() => {
        if (!JSON.parse(localStorage.getItem(key)!).attempt.board.waste.length) return;
        clearInterval(wait); clearTimeout(timeout); resolve(text.textContent ?? '');
      }, 8);
    });
  });
  await move(page, deal, { type: 'draw' });
  expect(await earlyCopy).not.toContain('Перенесите');
  expect((await read(page)).attempt.board.waste).toHaveLength(1);
  await expect(copy).toHaveText('Перенесите верхнюю карту из сброса.');
  await move(page, deal, deal.winningPath[2]);
  expect((await read(page)).campaign?.tutorials).toContain('learn:waste');
  await expect(copy).toHaveText('');
});
