import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { openDailyBonusRound } from '../../src/domain/events/daily-bonus';
import { campaignId } from '../../src/domain/progression';
import type { Save } from '../../src/domain/types';
import { move, read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Uses the ordinary C8 release profile');
if (process.env.ASOC_CASUAL_RECORD === '1') test.use({ video: 'on' });
const now = Date.UTC(2026, 10, 25, 12);
const deal = findDeal('campaign-c8-wave-021')!;

function player() {
  const save = freshSave(deal, 'card-table-210');
  save.contentVersion = 8;
  save.profile.coins = 1234567;
  save.meta!.winCycle = 4;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 20 }, (_, i) => campaignId(i + 1)) };
  return save;
}
function nearWin() {
  const save = player();
  for (const action of deal.winningPath.slice(0, -1)) {
    const step = applyBoard(save.attempt.board, action, deal);
    if (typeof step === 'string') throw new Error(step);
    save.attempt.board = step.board;
  }
  return save;
}
async function show(page: Page, save: Save, width: number, height: number, reserve: boolean) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  if (reserve) await page.locator('#banner-slot').evaluate(slot => slot.removeAttribute('hidden'));
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name + '.png'), scale: 'css' });
}
async function rawTap(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  expect(await page.locator(selector).evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), { x, y })).toBe(true);
  await page.touchscreen.tap(x, y);
}

for (const [width, height, reserve] of [[320, 480, true], [360, 640, false]] as const) {
  test(`Card Table ${width}×${height}: Home, tasks and matching rewards from real taps`, async ({ page }, info) => {
    const save = player();
    openDailyBonusRound(save, now, 'card-table-round-210', () => 0);
    await show(page, save, width, height, reserve);
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#level-picker-open')).toBeHidden();
    await expect(page.locator('#campaign-lives-open')).toBeVisible();
    await expect(page.locator('#calendar-open')).toHaveText('Календарь');
    const homeColor = await page.locator('#app').evaluate(app => getComputedStyle(app).backgroundImage);
    expect(homeColor).toContain('rgb(38, 127, 128)');
    await capture(page, info, 'home');
    await rawTap(page, '#daily-tasks-open');
    await expect(page.locator('#daily-tasks-dialog')).toBeVisible();
    await expect(page.locator('#daily-tasks-list .casual-track')).toHaveCount(4);
    await capture(page, info, 'tasks');
    await rawTap(page, '#daily-tasks-list [data-task="visit"] button');
    await expect(page.locator('#daily-tasks-list [data-task="visit"] button')).toHaveText('Получено');
    await page.locator('#daily-tasks-dialog .close').tap();
    await rawTap(page, '#daily-bonus-open');
    const cards = page.locator('.daily-bonus-card');
    await expect(cards).toHaveCount(12);
    await capture(page, info, 'bonus');
    const round = (await read(page)).dailyBonus!, first = round.slots[0];
    const indices = round.slots.flatMap((value, index) => first === value ? [index] : []);
    for (const [i, index] of indices.entries()) {
      await rawTap(page, `.daily-bonus-card:nth-child(${index + 1})`);
      await expect(cards.nth(index)).toHaveAttribute('data-revealed', 'true');
      if (i === 1) await capture(page, info, 'bonus-two');
    }
    await expect(page.locator('.daily-bonus-card[data-won=true]')).toHaveCount(3);
    await capture(page, info, 'bonus-triple');
    await rawTap(page, '#daily-bonus-claim');
    await expect.poll(async () => (await read(page)).dailyBonus?.claimed).toBe(true);
  });

  test(`Card Table ${width}×${height}: fifth win claim with an immediate next action`, async ({ page }, info) => {
    await show(page, nearWin(), width, height, reserve);
    await rawTap(page, '#home-play');
    await move(page, deal, deal.winningPath.at(-1)!);
    await expect(page.locator('#next-level')).toHaveText('Забрать');
    await expect(page.locator('#result-meta')).toHaveAttribute('aria-label', 'Пять побед: 5 из 5');
    await expect(page.locator('#replay')).toBeHidden();
    const won = await read(page);
    const regular = won.attempt.payout!.filter(item => item.reason !== 'campaign_win_cycle').reduce((total, item) => total + item.coins, 0);
    await expect(page.locator('#result-total')).toHaveText('+' + regular);
    await capture(page, info, 'victory');
    await rawTap(page, '#next-level');
    await expect(page.locator('#next-level')).toHaveText('Дальше');
    await expect(page.locator('#next-level')).toBeEnabled();
    expect((await read(page)).profile.coins).toBe(won.profile.coins);
    await capture(page, info, 'claimed');
  });
}

test('Reduced motion keeps the victory reward and skips the board burst', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await show(page, nearWin(), 320, 480, true);
  await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
  await rawTap(page, '#home-play');
  await move(page, deal, deal.winningPath.at(-1)!);
  await expect(page.locator('#next-level')).toHaveText('Забрать');
  await expect(page.locator('.victory-particles i')).toHaveCount(0);
  await rawTap(page, '#next-level');
  await expect(page.locator('#next-level')).toHaveText('Дальше');
});
