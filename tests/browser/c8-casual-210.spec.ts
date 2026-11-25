import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { applyBoard, freshSave } from '../../src/domain/engine';
import { updatePreviewTasks } from '../../src/domain/events/daily-tasks';
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

async function capture(page: Page, info: TestInfo, name: string, settle = true) {
  if (settle) await page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    .map(animation => animation.finished)));
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
    const rasterBeat = page.evaluate(() => new Promise<boolean>(resolve => {
      const until = performance.now() + 3500;
      function scan() {
        const burst = document.querySelector<HTMLElement>('.victory-particles');
        if (burst && !burst.hidden && !document.querySelector('#result[open]') && Number(getComputedStyle(burst).opacity) > .7 &&
            Number(getComputedStyle(burst).zIndex) > Number(getComputedStyle(document.querySelector('#game-surface')!).zIndex)) {
          resolve(true);
        } else if (performance.now() >= until) resolve(false);
        else requestAnimationFrame(scan);
      }
      requestAnimationFrame(scan);
    }));
    await move(page, deal, deal.winningPath.at(-1)!);
    expect(await rasterBeat).toBe(true);
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
    await capture(page, info, 'claimed', false);
    await rawTap(page, '#next-level');
    if (await page.locator('#difficulty-play').isVisible()) await rawTap(page, '#difficulty-play');
    await expect.poll(async () => (await read(page)).attempt.id).not.toBe(won.attempt.id);
    expect((await read(page)).profile.coins).toBe(won.profile.coins);
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

test('C8 cold and resumed navigation paint the real startup shell before saved UI', async ({ page }, info) => {
  const save = player();
  await page.addInitScript(value => {
    localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, save);
  for (const view of ['cold', 'reload']) {
    let release!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/assets/main-*.js', async route => { await hold; await route.continue(); });
    try {
      if (view === 'cold') await page.goto('/', { waitUntil: 'commit' });
      else await page.reload({ waitUntil: 'commit' });
      await expect(page.locator('#c8-startup')).toBeVisible();
      await expect(page.locator('#home-play')).toBeHidden();
      await expect(page.locator('#wallet-open')).toBeHidden();
      await capture(page, info, 'startup-' + view);
    } finally {
      release();
    }
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#c8-startup')).toBeHidden();
    await expect(page.locator('#coins')).toHaveText('1,2 млн');
    await page.unroute('**/assets/main-*.js');
  }
});

test('C8 boot exposes a retry if the application module fails', async ({ page }) => {
  await page.route('**/assets/main-*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#startup-retry')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await page.unroute('**/assets/main-*.js');
  await page.locator('#startup-retry').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
});

test('compact weekly claim and a 200-coin reveal fit the actual touch viewport', async ({ page }, info) => {
  const save = player();
  updatePreviewTasks(save, now);
  const weekly = save.dailyTasks!.weeks[0];
  weekly.totalMedals = weekly.milestones[0].medals;
  openDailyBonusRound(save, now, 'maximum-prize-210', () => 0, 'azur-compiled-r1');
  const round = save.dailyBonus!;
  const first = round.slots[0];
  const maxPrizes = [{ kind: 'Coins', quantity: 200 }, { kind: 'Coins', quantity: 500 },
    { kind: 'MoveHint', quantity: 5 }, { kind: 'Undo', quantity: 2 }] as const;
  round.columns = round.columns.map((_, index) => maxPrizes[(index - first + 4) % 4]);
  await show(page, save, 320, 480, true);
  await page.locator('#banner-slot').evaluate(slot => { slot.style.height = '90px'; });
  await capture(page, info, 'home-banner90');
  await rawTap(page, '#daily-tasks-open');
  await expect(page.locator('#daily-tasks-ready #daily-tasks-weekly')).toBeEnabled();
  await capture(page, info, 'weekly-ready');
  await rawTap(page, '#daily-tasks-weekly');
  await expect.poll(async () => (await read(page)).dailyTasks?.weeks[0].claimedMilestones).toContain('week');
  await expect(page.locator('#daily-tasks-dialog [data-reward-counter="Coins"]')).toBeVisible();
  await page.locator('#daily-tasks-dialog .close').tap();
  await rawTap(page, '#daily-bonus-open');
  await rawTap(page, '.daily-bonus-card:first-child');
  const count = page.locator('.daily-bonus-card:first-child .prize-count');
  await expect(count).toHaveText('+200');
  await capture(page, info, 'bonus-200');
  const box = (await count.boundingBox())!, card = (await page.locator('.daily-bonus-card:first-child').boundingBox())!;
  expect(box.x).toBeGreaterThan(card.x);
  expect(box.x + box.width).toBeLessThan(card.x + card.width);
});
