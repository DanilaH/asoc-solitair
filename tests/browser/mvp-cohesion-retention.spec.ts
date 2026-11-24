import { expect, test, type Page } from '@playwright/test';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { openDailyBonusRound, revealDailyBonusCard, claimDailyBonus } from '../../src/domain/events/daily-bonus';
import { claimTask, claimTaskMilestone, recordTaskSignal, updatePreviewTasks, type TaskSignal } from '../../src/domain/events/daily-tasks';
import { eventKey, observeEvents, recordEventWin, type EventDefinition } from '../../src/domain/events/ledger';
import { openPictureEvent } from '../../src/domain/events/picture';
import type { Save } from '../../src/domain/types';
import { read } from './wallet-fixture';

test.skip(!process.env.VITE_ASOC_PROFILE, 'Requires the ordinary integrated C8 release build');
test.use({ timezoneId: 'UTC' });
if (process.env.ASOC_MVP_DEMO === '1') {
  test.use({ video: 'on' });
  test.afterEach(async ({ page }, info) => {
    if (!page.isClosed()) await info.attach('screen', { body: await page.screenshot(), contentType: 'image/png' });
  });
}

const KEY = 'asoc-solitaire.save.v1', DAY = 86_400_000, NOW = Date.UTC(2026, 10, 23, 12);
const bank = [...content8Dealer, ...content8Wave, ...content8Late];
function profile(level = 3): Save {
  const deal = bank.find(entry => entry.campaignLevel === level)!;
  if (!deal) throw Error('Missing historical C8 fixture at level ' + level);
  const save = freshSave(deal, 'cohesion-retention-' + level);
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category', 'learn:match',
    'learn:stock', 'hint-demo', 'hint-practiced', 'undo-used', 'joker-buffer'] };
  platformState(save).completedCampaign = Array.from({ length: level - 1 }, (_, index) => campaignId(index + 1));
  return save;
}
async function seedHome(page: Page, save: Save, at = NOW) {
  await page.clock.install({ time: new Date(at) });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: KEY, value: JSON.stringify(save) });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#home')).toBeVisible();
}
async function openHelpers(page: Page) {
  if (await page.locator('#home').isVisible()) await page.locator('#home-play').tap();
  if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  await page.locator('#wallet-open').tap();
  await expect(page.locator('#helpers')).toBeVisible();
}
function winBonus(save: Save, at: number, joker = false) {
  const round = openDailyBonusRound(save, at, 'saved-browser-bonus', size => joker ? size - 1 : 0)!;
  for (const [index, column] of round.slots.entries()) if (column === 0) {
    if (!revealDailyBonusCard(save, round.roundId, index, at)) throw Error('Bonus fixture did not reveal');
  }
  return round;
}

test('an open unfinished Bonus expires at UTC midnight and starts a new round only through its explicit action', async ({ page }) => {
  const beforeMidnight = Date.UTC(2026, 10, 23, 23, 59, 50), midnight = Date.UTC(2026, 10, 24);
  const save = profile(), round = openDailyBonusRound(save, beforeMidnight, 'midnight-open', () => 0)!;
  revealDailyBonusCard(save, round.roundId, 0, beforeMidnight);
  await seedHome(page, save, beforeMidnight);
  await page.locator('#daily-bonus-open').tap();
  const old = (await read(page)).dailyBonus!;
  await page.clock.setSystemTime(new Date(midnight + 1000));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#daily-bonus-new')).toBeVisible();
  await expect(page.locator('#daily-bonus-cards button:enabled')).toHaveCount(0);
  expect((await read(page)).dailyBonus).toEqual(old);
  expect((await read(page)).profile.coins).toBe(save.profile.coins);
  await page.locator('#daily-bonus-new').tap();
  await expect.poll(async () => (await read(page)).dailyBonus?.day).toBe(Math.floor(midnight / DAY));
  const fresh = (await read(page)).dailyBonus!;
  expect(fresh.roundId).not.toBe(old.roundId);
  expect(fresh.revealed).toEqual([]);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-bonus-open').tap();
  expect((await read(page)).dailyBonus?.roundId).toBe(fresh.roundId);
});

test('an old won Bonus is paid once before the player can explicitly open today', async ({ page }) => {
  const save = profile(), old = winBonus(save, NOW - 3 * DAY), baseline = save.profile.coins;
  expect(old.columns[old.won!]).toEqual({ kind: 'Coins', quantity: 10 });
  await seedHome(page, save);
  await page.locator('#daily-bonus-open').tap();
  await expect(page.locator('#daily-bonus-claim')).toBeEnabled();
  await expect(page.locator('#daily-bonus-new')).toBeHidden();
  expect((await read(page)).dailyBonus?.roundId).toBe(old.roundId);
  await page.locator('#daily-bonus-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 10);
  await expect(page.locator('#daily-bonus-claim')).toBeHidden();
  await expect(page.locator('#daily-bonus-new')).toBeVisible();
  expect((await read(page)).dailyBonus?.claimed).toBe(true);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).profile.coins).toBe(baseline + 10);
  // Opening the activity is itself an explicit request for the now-available current day.
  await page.locator('#daily-bonus-open').tap();
  const today = (await read(page)).dailyBonus!;
  expect(today.day).toBe(Math.floor(NOW / DAY));
  expect(today.roundId).not.toBe(old.roundId);
  expect(today.won).toBeUndefined();
  expect((await read(page)).profile.coins).toBe(baseline + 10);
});

test('a saved future won Bonus cannot be collected or replaced until its own day', async ({ page }) => {
  const save = profile(), future = winBonus(save, NOW + DAY), baseline = save.profile.coins;
  await seedHome(page, save);
  await expect(page.locator('#daily-bonus-home-status')).not.toBeEmpty();
  if (await page.locator('#daily-bonus-open').isEnabled()) {
    await page.locator('#daily-bonus-open').tap();
    await expect(page.locator('#daily-bonus-claim:visible:enabled')).toHaveCount(0);
    await expect(page.locator('#daily-bonus-new:visible:enabled')).toHaveCount(0);
  }
  expect((await read(page)).dailyBonus).toEqual(future);
  expect((await read(page)).profile.coins).toBe(baseline);
  await page.clock.setSystemTime(new Date(NOW + DAY));
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-bonus-open').tap();
  await page.locator('#daily-bonus-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 10);
  expect((await read(page)).dailyBonus?.roundId).toBe(future.roundId);
  expect((await read(page)).dailyBonus?.claimed).toBe(true);
});

test('L2 can inspect an earned locked Joker without unlocking use, buying it, or losing it on reload', async ({ page }) => {
  const save = profile(2), round = winBonus(save, NOW, true), jokers = save.profile.jokers;
  expect(round.columns[round.won!]).toEqual({ kind: 'Joker', quantity: 1 });
  await seedHome(page, save);
  await page.locator('#daily-bonus-open').tap();
  await page.locator('#daily-bonus-claim').tap();
  await expect.poll(async () => (await read(page)).profile.jokers).toBe(jokers + 1);
  await page.locator('#daily-bonus-dialog .sheet-actions [data-close]').tap();
  await openHelpers(page);
  await expect(page.locator('#helper-inventory')).toBeVisible();
  await expect(page.locator('#helper-inventory-list')).toContainText(/Джокер/i);
  await expect(page.locator('#helper-inventory-list')).toContainText(/8/);
  await expect(page.locator('#joker-offer')).toBeHidden();
  await expect(page.locator('#joker')).toBeHidden();
  expect((await read(page)).profile.coins).toBe(save.profile.coins);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await openHelpers(page);
  await expect(page.locator('#helper-inventory')).toBeVisible();
  expect((await read(page)).profile.jokers).toBe(jokers + 1);
});

test('ordinary Tasks UI claims yesterday, then its newly earned old-week milestone with original IDs', async ({ page }) => {
  const save = profile(), baseline = save.profile.coins;
  for (const date of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-22']) {
    const at = Date.parse(date);
    updatePreviewTasks(save, at);
    recordTaskSignal(save, at, { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 });
    if (date !== '2026-11-22') expect(claimTask(save, date, 'visit')).toBe(true);
  }
  await seedHome(page, save);
  await expect(page.locator('#daily-tasks-home-status')).toContainText('2');
  await page.locator('#daily-tasks-open').tap();
  const previous = page.locator('#daily-tasks-previous-list');
  await expect(page.locator('#daily-tasks-previous')).toBeVisible();
  await expect(previous.getByRole('button')).toHaveCount(1);
  await previous.getByRole('button').tap();
  await expect.poll(async () => (await read(page)).dailyTasks?.weeks.find(week => week.startUtc === '2026-11-16')?.totalMedals).toBe(5);
  expect((await read(page)).dailyTasks?.weeks.find(week => week.startUtc === '2026-11-23')?.totalMedals).toBe(0);
  await expect(previous.getByRole('button')).toHaveCount(1);
  await previous.getByRole('button').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 20);
  await expect(page.locator('#daily-tasks-previous')).toBeHidden();
  const earned = (await read(page)).dailyTasks!.weeks.find(week => week.startUtc === '2026-11-16')!;
  expect(earned.claimedMilestones).toContain('week');
  expect(earned.days.find(day => day.utc === '2026-11-22')?.tasks.find(task => task.id === 'visit')?.claimed).toBe(true);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-tasks-open').tap();
  await expect(page.locator('#daily-tasks-previous')).toBeHidden();
  expect((await read(page)).profile.coins).toBe(baseline + 20);
});

test.describe('local presentation of unchanged UTC reward periods', () => {
  test.use({ timezoneId: 'Asia/Yekaterinburg' });
  test('shows a completed weekly bonus and local reset after all claims, without an open 12/5 goal', async ({ page }) => {
    const save = profile(), at = Date.UTC(2026, 10, 28, 12);
    for (let day = 23; day <= 28; day++) {
      const date = '2026-11-' + day, tick = Date.parse(date);
      updatePreviewTasks(save, tick);
      const current = save.dailyTasks!.weeks[0].days.find(entry => entry.utc === date)!;
      for (const task of current.tasks) {
        const channel: TaskSignal['channel'] = task.kind === 'DailyLogin' ? 'login' : 'board';
        recordTaskSignal(save, tick, { id: 'done:' + date + ':' + task.id, kind: task.kind, channel, amount: task.target, attemptId: 'completed-' + day });
        expect(claimTask(save, date, task.id)).toBe(true);
      }
    }
    expect(save.dailyTasks!.weeks[0].totalMedals).toBeGreaterThan(5);
    const total = save.dailyTasks!.weeks[0].totalMedals;
    expect(claimTaskMilestone(save, '2026-11-23', 'week')).toBe(true);
    const bonus = winBonus(save, at); claimDailyBonus(save, bonus.roundId, at);
    await seedHome(page, save, at);
    await expect(page.locator('#daily-bonus-home-status')).toContainText('05:00');
    await expect(page.locator('#daily-tasks-home-status')).toContainText(/выполнено/i);
    await page.locator('#daily-tasks-open').tap();
    await expect(page.locator('#daily-tasks-day-status')).toContainText('05:00');
    await expect(page.locator('#daily-tasks-dialog')).toContainText(/бонус недели получен/i);
    await expect(page.locator('#daily-tasks-medals')).not.toContainText(total + '/5');
    await expect(page.locator('#daily-tasks-previous')).toBeHidden();
    expect((await read(page)).profile.coins).toBe(save.profile.coins);
  });
});

test('settles an old monthly reward at endgame once, preserves cosmetics, and keeps independent free shop coins', async ({ page }) => {
  const save = profile(16), baseline = save.profile.coins;
  platformState(save).completedCampaign = Array.from({ length: 80 }, (_, index) => campaignId(index + 1));
  save.meta!.winCycle = 3;
  save.settings.palette = 'ink'; save.settings.cardBack = 'diamonds'; save.settings.deckSide = 'left'; save.settings.deckPosition = 'bottom';
  save.storeProgress = { version: 1, season: '2026-10', clears: 3, piggy: 30 };
  await seedHome(page, save);
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 10);
  await expect(page.locator('#win-cycle-open')).toBeHidden();
  await expect(page.locator('#campaign-monthly-bonus')).toBeHidden();
  await expect(page.locator('#looks-open')).toBeHidden();
  await expect(page.locator('#daily-play')).toBeVisible();
  await page.locator('#appearance-open').tap();
  await expect(page.locator('button[data-palette="ink"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button[data-card-back="diamonds"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#appearance-done').tap();
  await openHelpers(page);
  await expect(page.locator('#campaign-store-open')).toBeHidden();
  await expect(page.locator('#shop-free-claim')).toBeVisible();
  await page.locator('#shop-free-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 40);
  await expect(page.locator('#shop-claim-status')).not.toBeEmpty();
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).profile.coins).toBe(baseline + 40);
  expect((await read(page)).meta?.winCycle).toBe(3);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
  expect((await read(page)).settings).toMatchObject({ palette: 'ink', cardBack: 'diamonds', deckSide: 'left', deckPosition: 'bottom' });
});

test('legacy claims list only earned LiveOps while Picture retains its separate parts and final claim', async ({ page }) => {
  const save = profile(32), start = NOW - 60 * DAY, baseline = save.profile.coins;
  const event: EventDefinition = { id: 'historic-race', version: 1, sourceFeatureId: 'hitapps-weekend-race', minCampaignLevel: 16, daily: false,
    schedule: { clock: 'local', zone: 'UTC', start, end: start + 7 * DAY },
    milestones: [{ id: 'ready', threshold: 2, reward: { coins: 17 } }, { id: 'not-earned', threshold: 4, reward: { coins: 99 } }] };
  openPictureEvent(save, start);
  const picture = save.events!.events.find(record => record.definition.sourceFeatureId === 'hitapps-puzzle-event')!.definition;
  for (let level = 16; level <= 21; level++) {
    recordEventWin(save, [picture, ...(level <= 17 ? [event] : [])], { id: 'campaign:' + level, campaignLevel: level, mode: 'campaign' }, { localMs: start + level });
  }
  observeEvents(save, [], { localMs: NOW });
  await seedHome(page, save);
  await expect(page.locator('#picture-home')).toBeVisible();
  await page.locator('#campaign-liveops-open').tap();
  const claims = page.locator('#campaign-liveops-list').getByRole('button');
  await expect(claims).toHaveCount(1);
  await expect(claims).toContainText('17');
  await claims.tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 17);
  await expect(claims).toHaveCount(0);
  const paid = await read(page);
  expect(paid.events?.events.find(record => eventKey(record.definition) === eventKey(event))?.claimed).toEqual(['ready']);
  expect(paid.events?.events.find(record => eventKey(record.definition) === eventKey(picture))?.claimed).toEqual([]);
  expect(paid.picture?.parts).toEqual([]);
  expect(paid.picture?.gallery).toBeUndefined();
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#campaign-liveops-open')).toBeHidden();
  await page.locator('#picture-home').tap();
  await expect(page.locator('#picture-claim')).toBeHidden();
  expect((await read(page)).profile.coins).toBe(baseline + 17);
  expect((await read(page)).events?.events).toHaveLength(2);
});

