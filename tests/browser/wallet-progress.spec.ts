import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { BALANCE } from '../../src/domain/balance';
import type { Save } from '../../src/domain/types';
import { fixture, move, read, seed } from './wallet-fixture';

async function observeProgress(page: Page) {
  await page.addInitScript(() => {
    const records: { parent: string; text: string | null; save: Save }[] = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      queueMicrotask(() => {
        if (animation.id !== 'reward-progress') return;
        records.push({
          parent: this.closest('#result-meta, #result-bonus, #daily-tasks-medals')?.id ?? '',
          text: this.closest('#result-meta, #result-bonus, #daily-tasks-medals')?.textContent ?? null,
          save: JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!),
        });
      });
      return animation;
    };
    Object.assign(window, { rewardProgressLog: records });
  });
}
const progressLog = (page: Page) => page.evaluate(() =>
  (window as typeof window & { rewardProgressLog: { parent: string; text: string; save: Save }[] }).rewardProgressLog);

test.use({ viewport: { width: 320, height: 568 } });

test('a committed coin spend is shown beside the balance and settles under reduced motion', async ({ page }) => {
  const initial = fixture(5);
  await seed(page, initial);
  await page.locator('#wallet-open').tap();
  const balance = page.locator('#helper-wallet-amount'), buy = page.locator('#buy-undo');
  await expect(balance).toHaveText('100 монет');
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'asoc-solitaire.save.v1') {
        Storage.prototype.setItem = write;
        throw new Error('Test write failure');
      }
      return write.call(this, key, value);
    };
  });
  const price = BALANCE.helperPrices.undo;
  await buy.tap();
  await expect(page.getByText('Не удалось сохранить покупку. Попробуйте ещё раз.')).toBeAttached();
  expect((await read(page)).profile).toEqual(initial.profile);
  await expect(page.locator('.coin-debit')).toHaveCount(0);

  await buy.tap();
  const debit = page.locator('#helpers .coin-debit');
  await expect(debit).toHaveText(`−${price}`);
  await expect(balance).toHaveText(`${initial.profile.coins - price} монет`);
  expect((await read(page)).profile.undos).toBe(initial.profile.undos + 1);
  expect(await debit.evaluate(badge => {
    const bounds = badge.getBoundingClientRect();
    const text = document.querySelector('#helper-wallet-amount')!.getBoundingClientRect();
    const heading = badge.closest('.sheet-heading')!.getBoundingClientRect();
    return bounds.left >= text.right && bounds.right <= heading.right &&
      bounds.top < text.bottom && bounds.bottom > text.top;
  })).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
  await expect(debit).toBeVisible();
  expect(await debit.evaluate(badge => badge.getAnimations().length)).toBe(0);
  await page.locator('#helper-return').tap();
  await expect(debit).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#coins')).toHaveText(String(initial.profile.coins - price));
  await expect(page.locator('.coin-debit')).toHaveCount(0);
});

test('a targeted purchase that closes the sheet shows its debit on the field wallet', async ({ page }) => {
  const initial = fixture(5, true);
  initial.profile.undos = 0;
  await seed(page, initial);
  await page.locator('#undo').tap();
  await expect(page.locator('#helpers')).toBeVisible();
  await page.locator('#buy-undo').tap();
  await expect(page.locator('#helpers')).toBeHidden();
  await expect(page.locator('#wallet-open .coin-debit')).toHaveText(`−${BALANCE.helperPrices.undo}`);
  expect((await read(page)).profile.undos).toBe(1);
  expect((await read(page)).attempt.board).toEqual(initial.attempt.board);
});

test('a fresh campaign win shows the exact cycle progress once and reload is static', async ({ page }) => {
  await observeProgress(page);
  const current = fixture(4, true), deal = campaignDeals[4];
  current.meta!.winCycle = 2;
  await seed(page, current);
  await move(page, deal, deal.winningPath.at(-1)!);
  const progress = page.locator('#result-meta');
  await expect(progress).toHaveText('Пять побед · 3 / 5');
  await expect(progress.locator('i.lit')).toHaveCount(3);
  await expect.poll(() => progressLog(page)).toMatchObject([
    { parent: 'result-meta', text: 'Пять побед · 3 / 5', save: { meta: { winCycle: 3 }, attempt: { board: { phase: 'won' } } } },
  ]);
  await page.reload();
  await page.locator('#app[data-ready=true]').waitFor();
  await page.locator('#home-play').tap();
  await expect(progress).toHaveText('Пять побед · 3 / 5');
  expect(await progressLog(page)).toEqual([]);
});

test('a claimed weekly medal gets an accent after saving and keeps its static count on revisit', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_DAILY_TASKS !== '1', 'Isolated weekly tasks preview');
  await observeProgress(page);
  await seed(page, fixture(4));
  await page.locator('#menu').tap();
  await page.locator('#levels-open').tap();
  const open = page.locator('#daily-tasks-open');
  await open.tap();
  const medals = page.locator('#daily-tasks-medals');
  const visit = page.locator('#daily-tasks-list section').filter({ hasText: 'Зайти в игру' }).getByRole('button');
  await expect(medals).toHaveText('Медали недели · 0/5');
  await visit.tap();
  await expect(visit).toHaveText('Получено');
  await expect(medals).toHaveText('Медали недели · 1/5');
  await expect.poll(() => progressLog(page)).toMatchObject([
    { parent: 'daily-tasks-medals', text: 'Медали недели · 1/5',
      save: { dailyTasks: { weeks: [{ totalMedals: 1 }] } } },
  ]);
  await page.locator('#daily-tasks-dialog .sheet-actions button').tap();
  await open.tap();
  await expect(medals).toHaveText('Медали недели · 1/5');
  expect(await progressLog(page)).toHaveLength(1);
});
