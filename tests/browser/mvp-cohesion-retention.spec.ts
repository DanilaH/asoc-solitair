import { expect, test, type Page } from '@playwright/test';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { openDailyBonusRound, revealDailyBonusCard, claimDailyBonus } from '../../src/domain/events/daily-bonus';
import { claimTask, claimTaskMilestone, recordTaskSignal, scheduleTasks, updatePreviewTasks, type TaskSignal } from '../../src/domain/events/daily-tasks';
import { eventKey, observeEvents, recordEventWin, type EventDefinition } from '../../src/domain/events/ledger';
import { openPictureEvent } from '../../src/domain/events/picture';
import { rewardOfferState } from '../../src/domain/reward-offers';
import { boardFrame, layout } from '../../src/game/layout';
import type { Save } from '../../src/domain/types';
import { recoverable } from '../fixtures/content8-loss';
import { read } from './wallet-fixture';

test.skip(!process.env.VITE_ASOC_PROFILE, 'Requires the ordinary integrated C8 release build');
test.use({ timezoneId: 'UTC' });
if (process.env.ASOC_MVP_DEMO === '1') {
  test.use({ video: 'on' });
  test.afterEach(async ({ page }, info) => {
    if (!page.isClosed()) {
      const path = info.outputPath('screen.png');
      await page.screenshot({ path });
      await info.attach('screen', { path, contentType: 'image/png' });
    }
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
  const lockedJoker = page.locator('#helper-inventory-later > div').filter({ hasText: 'Ручные Джокеры' });
  await expect(lockedJoker.locator('dt span')).toHaveText('8');
  await expect(lockedJoker.locator('dd')).toContainText('С уровня');
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
  test('explains a saved source week and first-clear deadline while preserving old rewards', async ({ page }, info) => {
    const save = profile(), monday = '2026-11-23', tuesday = '2026-11-24';
    updatePreviewTasks(save, Date.parse(monday), true);
    const completedMonday: TaskSignal[] = [
      { id: 'login', kind: 'DailyLogin', channel: 'login', amount: 1 },
      { id: 'topics', kind: 'CollectThemes', channel: 'board', amount: 10 },
      { id: 'hints', kind: 'UseHints', channel: 'helper', amount: 2 },
      { id: 'earn', kind: 'EarnCoins', channel: 'wallet', amount: 100 },
    ];
    for (const signal of completedMonday) expect(recordTaskSignal(save, Date.parse(monday), signal)).toBe(true);
    for (const id of ['azur-1-1', 'azur-1-2', 'azur-1-3']) expect(claimTask(save, monday, id)).toBe(true);
    // This day was assigned in the C8 runtime before the profile reached 80/80.
    expect(scheduleTasks(save, Date.parse(tuesday), [
      { id: 'visit', kind: 'DailyLogin', target: 1, prize: { kind: 'Medals', quantity: 1 } },
      { id: 'draw', kind: 'DrawCards', target: 1, prize: { kind: 'Coins', quantity: 10 } },
      { id: 'moves', kind: 'ExecuteMoves', target: 4, prize: { kind: 'MoveHint', quantity: 1 } },
      { id: 'no-hint', kind: 'WinNoHints', target: 1, prize: { kind: 'Medals', quantity: 2 } },
    ], [], 'c8-task-base-r1')).toBe(true);
    platformState(save).completedCampaign = Array.from({ length: 80 }, (_, index) => campaignId(index + 1));
    const original = structuredClone(save.dailyTasks!.weeks[0]);
    const firstClear = original.days.find(day => day.utc === tuesday)!.tasks.find(task => task.id === 'no-hint')!;
    expect(firstClear).toMatchObject({ kind: 'WinNoHints', target: 1, progress: 0 });

    await seedHome(page, save, Date.parse(tuesday) + DAY / 2);
    await page.locator('#daily-tasks-open').tap();
    const list = page.locator('#daily-tasks-list');
    await expect(list.locator('[data-task=no-hint]')).toContainText('Впервые пройти раздачу без подсказок');
    await expect(page.locator('#daily-tasks-first-clear')).toContainText('Условия действуют до обновления');
    await expect(page.locator('#daily-tasks-day-status')).toContainText(/25\.11.*05:00/);
    await expect(page.locator('#daily-tasks-week-title')).toHaveText('Неделя прежней версии');
    await expect(page.locator('#daily-tasks-medals')).toHaveText('Медали недели · 30');
    await expect(page.locator('#daily-tasks-legacy-week')).toContainText(/Обычный недельный бонус начнётся 30\.11.*05:00/);
    await expect(page.locator('#daily-tasks-weekly')).toBeHidden();
    if (process.env.ASOC_MVP_DEMO === '1') {
      await page.locator('#daily-tasks-week-title').scrollIntoViewIfNeeded();
      await info.attach('saved source week', { body: await page.screenshot(), contentType: 'image/png' });
    }
    const oldTask = page.locator('[data-reward-key="task:2026-11-23:azur-1-4"]');
    await expect(oldTask).toContainText('25 мед.');
    await oldTask.getByRole('button').tap();
    await expect(page.locator('#daily-tasks-medals')).toHaveText('Медали недели · 55');
    const milestone = page.locator('#daily-tasks-milestones').getByRole('button', { name: /^50 мед\./ });
    await milestone.tap();
    await expect(milestone).toHaveText('50 мед. · Получено');
    const earned = (await read(page)).dailyTasks!.weeks[0];
    expect(earned.milestones).toEqual(original.milestones);
    expect(earned.claimedMilestones).toEqual(['source-50']);
    expect(earned.days[1].tasks.find(task => task.id === 'no-hint')).toEqual(firstClear);

    await page.clock.setSystemTime(new Date('2026-11-30T12:00:00Z'));
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.locator('#daily-tasks-open').tap();
    await expect(page.locator('#daily-tasks-week-title')).toHaveText('Бонус недели');
    await expect(page.locator('#daily-tasks-legacy-week')).toBeHidden();
    await expect(page.locator('#daily-tasks-first-clear')).toBeHidden();
    await expect(page.locator('#daily-tasks-medals')).toHaveText('Медали недели · 0/5');
    expect((await read(page)).dailyTasks!.weeks[0]).toEqual(earned);
  });

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

test('settles an old monthly reward at endgame once, preserves cosmetics, and keeps independent free shop coins', async ({ page }, info) => {
  const save = profile(16), baseline = save.profile.coins;
  platformState(save).completedCampaign = Array.from({ length: 80 }, (_, index) => campaignId(index + 1));
  save.meta!.winCycle = 3;
  save.settings.palette = 'ink'; save.settings.cardBack = 'diamonds'; save.settings.deckSide = 'left'; save.settings.deckPosition = 'bottom';
  save.storeProgress = { version: 1, season: '2026-10', clears: 3, piggy: 30 };
  await seedHome(page, save);
  await expect.poll(async () => (await read(page)).profile.coins).toBe(baseline + 10);
  const confirmation = page.locator('#campaign-monthly-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('+10');
  await expect(confirmation).toContainText('10.2026');
  expect((await read(page)).storeProgress).toEqual({ ...save.storeProgress, freeClaimed: true });
  await expect(page.locator('#win-cycle-open')).toBeHidden();
  await expect(page.locator('#campaign-monthly-bonus')).toBeHidden();
  const confirmationBox = (await confirmation.boundingBox())!;
  expect(confirmationBox.y).toBeGreaterThanOrEqual(0);
  expect(confirmationBox.y + confirmationBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  const screenshot = info.outputPath('monthly-confirmation.png');
  await page.screenshot({ path: screenshot });
  await info.attach('monthly-confirmation', { path: screenshot, contentType: 'image/png' });
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
  await expect(confirmation).toBeHidden();
  await expect(page.locator('#result-monthly-confirmation')).toBeHidden();
  await expect(page.locator('#campaign-monthly-bonus')).toBeHidden();
  expect((await read(page)).storeProgress).toEqual({ ...save.storeProgress, freeClaimed: true });
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
  await expect(page.locator('#picture-prize')).toContainText('за сохранённые жетоны');
  await expect(page.locator('#picture-claim')).toBeHidden();
  expect((await read(page)).profile.coins).toBe(baseline + 17);
  expect((await read(page)).events?.events).toHaveLength(2);
});

test('legacy helper-only and bundled claims name every frozen resource and grant exactly those amounts once', async ({ page }) => {
  const save = profile(32), start = NOW - 60 * DAY;
  const event: EventDefinition = { id: 'historic-resource-bundles', version: 1, sourceFeatureId: 'hitapps-gold-rush-event', minCampaignLevel: 16, daily: false,
    schedule: { clock: 'local', zone: 'UTC', start, end: start + 7 * DAY },
    milestones: [
      { id: 'helpers-only', threshold: 1, reward: { hints: 2, undos: 3, jokers: 1 } },
      { id: 'bundle', threshold: 2, reward: { coins: 17, hints: 4, undos: 5, jokers: 2 } },
    ] };
  for (const level of [16, 17]) recordEventWin(save, [event],
    { id: 'campaign:' + level, campaignLevel: level, mode: 'campaign' }, { localMs: start + level });
  observeEvents(save, [], { localMs: NOW });
  await seedHome(page, save);
  const baseline = (await read(page)).profile;
  await page.locator('#campaign-liveops-open').tap();
  const list = page.locator('#campaign-liveops-list');
  const helpers = list.locator('button[data-claim="helpers-only"]'), bundle = list.locator('button[data-claim="bundle"]');
  await expect(list.getByRole('button')).toHaveCount(2);
  await expect(helpers).toContainText(/\+2\s+подсказ/);
  await expect(helpers).toContainText(/\+3\s+отмен/);
  await expect(helpers).toContainText(/\+1\s+Джокер/);
  await expect(helpers).not.toContainText(/монет|undefined|NaN/);
  await expect(bundle).toContainText(/\+17\s+монет/);
  await expect(bundle).toContainText(/\+4\s+подсказ/);
  await expect(bundle).toContainText(/\+5\s+отмен/);
  await expect(bundle).toContainText(/\+2\s+Джокер/);
  await helpers.tap();
  await expect.poll(async () => (await read(page)).profile).toMatchObject({
    coins: baseline.coins, hints: baseline.hints + 2, undos: baseline.undos + 3, jokers: baseline.jokers + 1,
  });
  await expect(helpers).toHaveCount(0);
  await expect(list.getByRole('button')).toHaveCount(1);
  await bundle.tap();
  const expected = { coins: baseline.coins + 17, hints: baseline.hints + 6, undos: baseline.undos + 8, jokers: baseline.jokers + 3 };
  await expect.poll(async () => (await read(page)).profile).toMatchObject(expected);
  await expect(list.getByRole('button')).toHaveCount(0);
  const paid = (await read(page)).events!.events.find(record => eventKey(record.definition) === eventKey(event))!;
  expect(paid.definition).toEqual(event);
  expect(paid.claimed).toEqual(['helpers-only', 'bundle']);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#campaign-liveops-open')).toBeHidden();
  expect((await read(page)).profile).toMatchObject(expected);
  expect((await read(page)).events?.events).toHaveLength(1);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
});

test('repeated empty Definition after a manual wallet visit keeps its Bonus guidance without another offer activation', async ({ page }, info) => {
  let save = profile(16);
  for (const command of recoverable.winningPath.slice(0, 20)) save = dispatch(save, command, recoverable).next;
  updatePreviewTasks(save, NOW);
  rewardOfferState(save).definitions = 0;
  save.dailyTasks!.inventory.definitions = 0;
  await seedHome(page, save);
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', recoverable.id);
  const inspectEmptyDefinition = async () => {
    const rect = (await page.locator('#game-root').boundingBox())!;
    const board = (await read(page)).attempt.board;
    const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, recoverable);
    const geometry = layout(board, recoverable, frame, save.settings.deckSide, save.settings.deckPosition);
    const pose = geometry.poses.find(card => card.faceUp && board.tableau.some(column => column.at(-1) === card.id) &&
      board.faceUp.some(id => id !== card.id && !recoverable.cards[id].leader && recoverable.cards[id].category === recoverable.cards[card.id].category));
    expect(pose, 'the saved ordinary board has an inspectable card with a related word').toBeDefined();
    await page.locator('#inspect').tap();
    await page.touchscreen.tap(rect.x + frame.offsetX + pose!.x * frame.unit, rect.y + pose!.y * frame.unit);
    await expect(page.locator('#definition-use')).toHaveText('Связанное слово · 0');
    await expect(page.locator('#definition-use')).toBeDisabled();
    await page.locator('#definition-refill').tap();
    await expect(page.locator('#helpers')).toBeVisible();
  };
  const copy = page.locator('#product-offer-helpers'), source = page.locator('#context-bonus-open');
  const addressedContext = async () => {
    await expect(copy).toContainText(/Объяснения/);
    await expect(copy).toContainText(/не гарантирован/);
    await expect(page.locator('#helper-inventory')).toBeHidden();
    const viewport = page.viewportSize()!, body = (await page.locator('#helpers .sheet-body').boundingBox())!;
    for (const locator of [copy, source]) {
      await expect(locator).toBeVisible();
      const rect = (await locator.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(Math.max(0, body.x) - .5);
      expect(rect.y).toBeGreaterThanOrEqual(Math.max(0, body.y) - .5);
      expect(rect.x + rect.width).toBeLessThanOrEqual(Math.min(viewport.width, body.x + body.width) + .5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(Math.min(viewport.height, body.y + body.height) + .5);
    }
    const point = await source.evaluate(node => {
      const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, height: rect.height, hit: Boolean(hit && (hit === node || node.contains(hit))) };
    });
    expect(point.height).toBeGreaterThanOrEqual(44);
    expect(point.hit, 'the Bonus source is touchable before any test-driven scroll').toBe(true);
    return point;
  };
  const definitionId = 'definition-empty:' + save.attempt.id;
  await inspectEmptyDefinition();
  await addressedContext();
  await expect.poll(async () => (await read(page)).productOffers?.reservation).toMatchObject({
    eventId: definitionId, resource: 'definition', surface: 'definition',
  });
  const first = await read(page);
  expect(first.offerCampaigns!.accounts[0].campaigns.find(campaign => campaign.campaignId === 'c8-local-helper'))
    .toMatchObject({ activations: 1, shows: 1 });
  await page.locator('#helper-return').tap();
  await page.locator('#wallet-open').tap();
  await expect.poll(async () => (await read(page)).productOffers?.reservation).toMatchObject({
    eventId: 'manual-wallet:' + save.attempt.id, surface: 'resources',
  });
  await expect(copy).toContainText(/монеты/);
  await expect(copy).not.toContainText(/Объяснения/);
  await expect(page.locator('#helper-inventory')).toBeVisible();
  await expect(page.locator('#helper-inventory-later > div').filter({ hasText: 'Объяснения' }).locator('dt span')).toHaveText('0');
  const manual = await read(page);
  expect(manual.productOffers?.reservation?.resource).toBeUndefined();
  await page.locator('#helpers .sheet-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => page.locator('#helpers .sheet-body').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.locator('#helper-return').tap();
  await inspectEmptyDefinition();
  const point = await addressedContext();
  const screenshotPath = info.outputPath('definition-context.png');
  await page.screenshot({ path: screenshotPath });
  await info.attach('definition-context', { path: screenshotPath, contentType: 'image/png' });
  // Following the promised source also waits for a later SaveStore transaction,
  // so the duplicate fact has finished before comparing its unchanged journal.
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator('#daily-bonus-dialog')).toBeVisible();
  await expect.poll(async () => (await read(page)).dailyBonus?.roundId).toBeDefined();
  const after = await read(page);
  expect(after.offerCampaigns).toEqual(manual.offerCampaigns);
  expect(after.productOffers).toEqual(manual.productOffers);
  expect(after.offerCampaigns!.accounts[0].events.filter(event => event.id === definitionId)).toHaveLength(1);
  expect(after.dailyTasks?.inventory.definitions).toBe(0);
  expect(after.rewardOffers?.definitions).toBe(0);
  expect(after.profile.coins).toBe(save.profile.coins);
  expect(after.attempt.board).toEqual(save.attempt.board);
  expect(after.commerceAccount).toBeUndefined();
});

