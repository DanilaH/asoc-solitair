import { expect, test, type Page } from '@playwright/test';
import { hitappsR4Deals } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { scheduleTasks, m1WeekRows } from '../../src/domain/events/daily-tasks';
import { addWinStreakProgress } from '../../src/domain/events/win-streak';
import { play, profileAt } from '../fixtures/functional-audit-225';
import { read } from './wallet-fixture';

const before = process.env.ASOC_S3_BEFORE === '1', record = process.env.ASOC_S3_RECORD === '1';
test.skip(!before && (process.env.VITE_ASOC_PROFILE !== 'c8-release-v1' ||
  process.env.VITE_ASOC_ARCHIVE_227 === '1' || process.env.VITE_ASOC_ARCHIVE_229 === '1' ||
  process.env.VITE_ASOC_ARCHIVE_230 === '1' || process.env.VITE_HITAPPS_FIXTURES === '1'), 'Requires the ordinary expansion');
if (record) test.use({ video: 'on' });

const at = Date.UTC(2026, 10, 30, 12);
const oldL80 = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 80)!.deal;

async function launch(page: Page, save: ReturnType<typeof profileAt>) {
  save.contentVersion = 8;
  await page.clock.install({ time: new Date(at) });
  await page.addInitScript(value => {
    const key = 'asoc-solitaire.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
}

test('a completed PR230 save continues to L81 without another grant or life debit', async ({ page }, info) => {
  const save = play(profileAt(oldL80, 'm3-existing-80'), oldL80, oldL80.winningPath);
  save.campaignLives = { version: 2, remaining: 4, observedAt: at, refillAt: at + 300000, earnedCredits: 0 };
  await launch(page, save);
  await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#next-level').tap();
  if (before) {
    await expect(page.locator('#home-play')).toContainText('Кампания пройдена');
    if (record) await page.screenshot({ path: info.outputPath('campaign.png'), scale: 'css' });
    return;
  }
  await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ 81');
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  expect((await read(page)).attempt.board.rulesVersion).toBe(4);
  expect((await read(page)).attempt.issuance?.seed).toBeDefined();
  expect((await read(page)).campaignLives?.remaining).toBe(4);
  expect((await read(page)).profile.coins).toBe(save.profile.coins);
  await expect(page.locator('#level-picker-open')).toBeHidden();
  if (record) await page.screenshot({ path: info.outputPath('campaign.png'), scale: 'css' });
});

test('chooses the correct local calendar layout and preserves a v1 attempt already issued today', async ({ page }, info) => {
  const save = profileAt(oldL80, 'm3-daily-account');
  await launch(page, save);
  await page.locator('#daily-play').tap();
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  const fresh = await read(page);
  expect(fresh.attempt.daily?.contentVersion).toBe(before ? 1 : 2);
  expect(fresh.attempt.board.rulesVersion).toBe(before ? 3 : 4);
  if (record) await page.screenshot({ path: info.outputPath('daily.png'), scale: 'css' });
  const old = dailyForDay('2026-11-30', 1);
  await page.evaluate(value => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value)), {
    ...save, parked: { daily: profileAt(old, 'm3-pinned-v1').attempt },
  });
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-play').tap();
  expect((await read(page)).attempt.dealId).toBe(old.id);
});

test('uses the existing win and task screens for staged claims', async ({ page }, info) => {
  const save = profileAt(oldL80, 'm3-meta-account');
  save.meta!.winCycle = 0;
  if (!before) {
    addWinStreakProgress(save, 6);
    scheduleTasks(save, at, m1WeekRows(0), [
      { id: 'm1-week-50', medals: 50, prize: { kind: 'Coins', quantity: 15 } },
      { id: 'm1-week-100', medals: 100, prize: { kind: 'Definition', quantity: 1 } },
      { id: 'm1-week-300', medals: 300, prize: { kind: 'Coins', quantity: 25 } },
      { id: 'm1-week-600', medals: 600, prize: { kind: 'Coins', quantity: 30 } },
      { id: 'm1-week-1000', medals: 1000, prize: { kind: 'Coins', quantity: 30 }, chest: { kind: 'Undo', quantity: 1 } },
    ], 'azur-m1-week-r1');
    save.dailyTasks!.weeks[0].totalMedals = 1000;
  }
  await launch(page, save);
  await page.locator('#win-cycle-open').tap();
  await expect(page.locator('#cycle-title')).toHaveText(before ? 'Пять побед' : 'Серия побед');
  if (record) await page.screenshot({ path: info.outputPath('series.png'), scale: 'css' });
  if (!before) {
    await page.locator('#cycle-claim').tap();
    await expect.poll(async () => (await read(page)).profile.coins).toBe(save.profile.coins + 100);
    await expect(page.locator('#cycle-claim')).toBeHidden();
  }
  await page.locator('#cycle-info button[data-close]').last().tap();
  await page.locator('#daily-tasks-open').tap();
  await expect(page.locator('#daily-tasks-dialog')).toBeVisible();
  if (!before) {
    await expect(page.locator('#daily-tasks-dialog .sheet-body #daily-tasks-milestones button')).toHaveCount(5);
    const medalValue = page.locator('#daily-tasks-medals > span:has(.casual-track)');
    await expect(medalValue).toHaveText('1000/1000');
    expect(await medalValue.evaluate(value => value.scrollWidth <= value.clientWidth)).toBe(true);
  }
  if (record) await page.screenshot({ path: info.outputPath('week.png'), scale: 'css' });
  if (!before) {
    await page.locator('#daily-tasks-milestones button').last().tap();
    await page.locator('#task-chest-open').tap();
    await expect(page.locator('#task-chest-prize')).toContainText('отмен');
    expect((await read(page)).profile.undos).toBe(save.profile.undos + 1);
  }
});
