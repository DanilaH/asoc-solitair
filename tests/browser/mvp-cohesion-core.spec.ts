import { expect, test, type Page } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { dailyForDay } from '../../src/content/daily';
import { LIVES_RULES } from '../../src/domain/campaign-lives';
import { buyUnlimitedAccess, grantUnlimitedAccess } from '../../src/domain/campaign-recovery';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import { losingPath } from '../fixtures/content8-loss';
import { move, read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary integrated C8 release build');
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

const KEY = 'asoc-solitaire.save.v1', REPORTS = 'mvp-core-analytics-reports';
const DAY = '2026-11-24', NOW = Date.UTC(2026, 10, 24, 12);
const level16 = findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!;
const relief16 = findDeal('campaign-c8-wave-016-relief-r2-c8-core-r1-rights-r1')!;
type Report = { event: string; params: Record<string, string | number | boolean> };
type ClockReading = { fail: boolean; boot: number; elapsed: number };
type NativeClockFixture = ClockReading & { sampledAt: number; reads: number };
type NativeStorageFixture = { fail: boolean; writes: number; failures: number; breakTransition?: boolean; blockedRead?: boolean };

function profile(deal: Deal = content8Dealer[3], id = 'mvp-core-campaign'): Save {
  const save = freshSave(deal, id);
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category',
    'learn:match', 'learn:stock', 'learn:covered-waste', 'hint-demo', 'hint-practiced', 'undo-used', 'joker-buffer'] };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: (deal.campaignLevel ?? 1) - 1 }, (_, i) => campaignId(i + 1)) };
  return save;
}

async function seedHome(page: Page, save: Save, now = NOW) {
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: KEY, value: JSON.stringify(save) });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#home')).toBeVisible();
}

async function home(page: Page) {
  await page.locator('#menu').tap();
  await page.locator('#levels-open').tap();
  await expect(page.locator('#home')).toBeVisible();
}

async function gameReady(page: Page, deal: Deal) {
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
}

/** Observe only the final Capacitor transport. Product producers and validEvent run unchanged. */
async function observeAnalytics(page: Page, initialClock?: ClockReading) {
  await page.addInitScript(({ reportKey, initialClock }) => {
    const listeners = new Map<string, (event: object) => void>();
    const clock: NativeClockFixture | undefined = initialClock ? { ...initialClock, sampledAt: performance.now(), reads: 0 } : undefined;
    const storage: NativeStorageFixture = { fail: false, writes: 0, failures: 0 };
    const methods = (name: string, names: string[], events = false) => ({
      name, methods: [...names.map(name => ({ name, rtype: 'promise' })),
        ...events ? [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'callback' }] : []],
    });
    Object.assign(window, {
      androidBridge: {},
      mvpNativeClock: clock,
      mvpNativeStorage: storage,
      Capacitor: {
        PluginHeaders: [
          methods('App', ['getState'], true),
          methods('SolitaireStorage', ['get', 'set', 'remove', 'readRecoveryClock']),
          methods('SolitaireAudio', ['configure'], true), methods('SolitaireFeedback', ['pulse', 'cancel']),
          methods('SolitaireAnalytics', ['report']),
          methods('SolitaireAds', ['status', 'prepareInterstitial', 'show', 'pending', 'acknowledge',
            'pendingShown', 'acknowledgeShown', 'hideBanner', 'dispose'], true),
        ],
        async nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (event: object) => void) {
          const id = `${plugin}.${options.eventName}`;
          if (method === 'addListener') listeners.set(id, callback);
          else listeners.delete(id);
          return id;
        },
        async nativePromise(plugin: string, method: string, options: { key: string; value: string; event: string; params: Report['params'] }) {
          if (plugin === 'App') return { isActive: true };
          if (plugin === 'SolitaireAudio') return { focused: true };
          if (plugin === 'SolitaireStorage') {
            if (method === 'get') {
              if (storage.blockedRead) throw Error('Fixture read-back unavailable');
              return { value: localStorage.getItem(options.key) };
            }
            if (method === 'set') {
              storage.writes++;
              if (storage.fail) { storage.failures++; throw Error('Fixture storage temporarily unavailable'); }
              const previous = localStorage.getItem(options.key);
              localStorage.setItem(options.key, options.value);
              if (storage.breakTransition && previous &&
                  JSON.parse(previous).attempt.dealId !== JSON.parse(options.value).attempt.dealId) {
                storage.breakTransition = false; storage.blockedRead = true; storage.failures++;
                throw Error('Fixture lost response after saving a different deal');
              }
            }
            if (method === 'remove') localStorage.removeItem(options.key);
            if (method === 'readRecoveryClock') {
              if (clock) {
                clock.reads++;
                if (clock.fail) throw Error('Fixture native clock temporarily unavailable');
                return { boot: clock.boot, elapsed: clock.elapsed + Math.floor(Math.max(0, performance.now() - clock.sampledAt)) };
              }
              return { boot: 1, elapsed: Math.max(0, Date.now() - Date.UTC(2026, 0, 1)) };
            }
          }
          if (plugin === 'SolitaireAds') {
            if (method === 'status') return { rewarded: false, interstitial: false, banner: false, ready: true, mode: 'disabled' };
            if (method === 'pending') return { receipts: [] };
            if (method === 'pendingShown') return { shown: null };
          }
          if (plugin === 'SolitaireAnalytics' && method === 'report') {
            const reports: Report[] = JSON.parse(sessionStorage.getItem(reportKey) ?? '[]');
            reports.push({ event: options.event, params: options.params });
            sessionStorage.setItem(reportKey, JSON.stringify(reports));
          }
          return {};
        },
      },
    });
  }, { reportKey: REPORTS, initialClock: initialClock ?? null });
}

const clockReads = (page: Page) => page.evaluate(() => (window as typeof window & { mvpNativeClock: NativeClockFixture }).mvpNativeClock.reads);
const storageState = (page: Page) => page.evaluate(() => ({ ...(window as typeof window & { mvpNativeStorage: NativeStorageFixture }).mvpNativeStorage }));
async function failStorage(page: Page, fail: boolean) {
  await page.evaluate(value => { (window as typeof window & { mvpNativeStorage: NativeStorageFixture }).mvpNativeStorage.fail = value; }, fail);
}
async function setNativeClock(page: Page, reading: ClockReading) {
  await page.evaluate(value => {
    const clock = (window as typeof window & { mvpNativeClock: NativeClockFixture }).mvpNativeClock;
    Object.assign(clock, value, { sampledAt: performance.now() });
  }, reading);
}

async function tapStock(page: Page, deal: Deal) {
  const save = await read(page), rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, deal);
  const stock = layout(save.attempt.board, deal, frame, save.settings.deckSide, save.settings.deckPosition).stock;
  await page.touchscreen.tap(rect.x + frame.offsetX + stock.x * frame.unit, rect.y + stock.y * frame.unit);
}

const reports = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? '[]') as Report[], REPORTS);
async function reportsFor(page: Page, event: string, attemptId: string) {
  return (await reports(page)).filter(report => report.event === event && report.params.attemptId === attemptId);
}

function almostDaily(dayId = DAY) {
  const deal = dailyForDay(dayId);
  let save = freshSave(deal, 'mvp-saved-daily-' + dayId);
  // Replay the shipped legal witness into a near-win save, then drive the two remaining moves through real UI.
  for (const command of deal.winningPath.slice(0, -2)) {
    const step = dispatch(save, command, deal, dayId);
    if (!step.accepted) throw Error('Invalid Daily fixture: ' + step.reason);
    save = step.next;
  }
  if (save.attempt.board.phase !== 'playing') throw Error('Daily fixture must remain unfinished');
  const campaign = profile();
  campaign.parked = { daily: save.attempt };
  return { save: campaign, deal };
}

test('Daily accepted actions reach native analytics with the saved day and emit one completion after park and reload', async ({ page }) => {
  test.setTimeout(60_000);
  await observeAnalytics(page);
  const { save, deal } = almostDaily(), id = save.parked!.daily!.id;
  await seedHome(page, save);
  await page.locator('#daily-play').tap();
  await gameReady(page, deal);
  await move(page, deal, deal.winningPath.at(-2)!);
  await expect.poll(async () => (await reportsFor(page, 'daily_start', id)).length).toBe(1);
  const dailyStart = (await reportsFor(page, 'daily_start', id))[0];
  expect(dailyStart.params).toMatchObject({ mode: 'daily', dayId: DAY, attemptId: id, dealId: deal.id });
  // This report is observable only after the production strict contract validator accepted it.
  expect(typeof dailyStart.params.dayId).toBe('string');
  await expect.poll(async () => (await reportsFor(page, 'level_start', id)).length).toBe(1);
  expect((await reportsFor(page, 'level_start', id))[0].params).not.toHaveProperty('dayId');
  const partial = (await read(page)).attempt;

  await home(page);
  await page.locator('#home-play').tap();
  await gameReady(page, content8Dealer[3]);
  expect((await read(page)).parked?.daily?.id).toBe(id);
  await home(page);
  await page.locator('#daily-play').tap();
  await gameReady(page, deal);
  expect((await read(page)).attempt.board).toEqual(partial.board);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-play').tap();
  await gameReady(page, deal);
  expect((await read(page)).attempt.id).toBe(id);
  expect((await read(page)).attempt.board).toEqual(partial.board);
  await move(page, deal, deal.winningPath.at(-1)!);
  await expect(page.locator('#result')).toBeVisible();
  await expect.poll(async () => (await reportsFor(page, 'daily_completion', id)).length).toBe(1);
  expect((await reportsFor(page, 'daily_completion', id))[0].params).toMatchObject({ mode: 'daily', dayId: DAY, dealId: deal.id });
  expect((await reportsFor(page, 'daily_start', id)).length).toBe(1);
  expect((await reportsFor(page, 'level_start', id)).length).toBe(1);
  const won = await read(page);
  expect(won.profile.rewards).toContain('daily:' + DAY);
  expect(won.meta?.dailyDates).toContain(DAY);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).profile).toEqual(won.profile);
  expect((await reportsFor(page, 'daily_completion', id)).length).toBe(1);
});

test('an old Daily keeps its identity across midnight and reports its saved day without granting a training reward', async ({ page }) => {
  test.setTimeout(60_000);
  await observeAnalytics(page);
  const { save, deal } = almostDaily(), id = save.parked!.daily!.id;
  await seedHome(page, save, Date.UTC(2026, 10, 24, 23, 59, 40));
  await page.locator('#daily-play').tap();
  await gameReady(page, deal);
  await home(page);
  await page.locator('#home-play').tap();
  await gameReady(page, content8Dealer[3]);
  await page.clock.setSystemTime(new Date('2026-11-25T00:00:02Z'));
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#daily-resume-old')).toBeVisible();
  await page.locator('#daily-resume-old').tap();
  await gameReady(page, deal);
  expect((await read(page)).attempt.id).toBe(id);
  expect((await read(page)).attempt.daily?.dayId).toBe(DAY);
  const before = await read(page);
  for (const command of deal.winningPath.slice(-2)) await move(page, deal, command);
  await expect(page.locator('#result')).toBeVisible();
  await expect.poll(async () => (await reportsFor(page, 'daily_start', id)).length).toBe(1);
  expect((await reportsFor(page, 'daily_start', id))[0].params.dayId).toBe(DAY);
  expect((await reportsFor(page, 'level_start', id)).length).toBe(1);
  expect((await reportsFor(page, 'level_win', id)).length).toBe(1);
  expect(await reportsFor(page, 'daily_completion', id)).toEqual([]);
  const won = await read(page);
  expect(won.attempt.id).toBe(id);
  expect(won.attempt.board.phase).toBe('won');
  expect(won.profile).toEqual(before.profile);
  expect(won.meta?.dailyDates).toEqual(before.meta?.dailyDates);
  expect(won.profile.rewards).not.toContain('daily:' + DAY);
  expect(won.profile.rewards).not.toContain('daily:2026-11-25');
});

test('Random Joker asks before payment and preserves its separate unused charge through restart, Daily and reload', async ({ page }) => {
  test.setTimeout(60_000);
  const save = profile(level16, 'mvp-joker-prepay');
  save.profile.coins = 500;
  save.profile.jokers = 2;
  await seedHome(page, save);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  const before = await read(page), price = level16.extraHelpers!.randomJokerCoins!;
  await page.locator('#wallet-open').tap();
  await page.locator('#random-joker-open').tap();
  await expect(page.locator('#random-joker-warning')).toBeVisible();
  await expect(page.locator('#random-joker-copy')).toContainText(String(price) + ' монет');
  await expect(page.locator('#random-joker-copy')).toContainText('сохраняется после перезапуска');
  await expect(page.locator('#random-joker-copy')).toContainText('уровне 16');
  expect((await read(page)).profile).toEqual(before.profile);
  await page.locator('#random-joker-warning [data-close]').tap();
  expect((await read(page)).profile).toEqual(before.profile);
  expect((await read(page)).randomJokers).toBeUndefined();
  if (!await page.locator('#helpers').isVisible()) await page.locator('#wallet-open').tap();
  await page.locator('#random-joker-open').tap();
  await page.locator('#random-joker-confirm').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(before.profile.coins - price);
  const purchased = await read(page), rights = purchased.randomJokers;
  expect(rights?.grants).toHaveLength(1);
  expect(rights!.grants[0]).toMatchObject({ source: 'coins', cost: price });
  expect(rights!.grants[0].consumed).toBeUndefined();
  expect(purchased.profile.jokers).toBe(before.profile.jokers);
  expect(purchased.attempt.board).toEqual(before.attempt.board);
  if (await page.locator('#helpers').isVisible()) await page.locator('#helper-return').tap();
  await page.locator('#menu').tap();
  await page.locator('#restart').tap();
  if (await page.locator('#restart-confirm').isVisible()) await page.locator('#restart-confirm-yes').tap();
  await expect.poll(async () => (await read(page)).attempt.id).not.toBe(before.attempt.id);
  await gameReady(page, level16);
  const restarted = (await read(page)).attempt;
  expect((await read(page)).randomJokers).toEqual(rights);
  expect((await read(page)).profile).toEqual(purchased.profile);
  await home(page);
  await page.locator('#daily-play').tap();
  await gameReady(page, dailyForDay(DAY));
  expect((await read(page)).parked?.campaign?.id).toBe(restarted.id);
  expect((await read(page)).randomJokers).toEqual(rights);
  await home(page);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  const reopened = await read(page);
  expect(reopened.attempt.id).toBe(restarted.id);
  expect(reopened.randomJokers).toEqual(rights);
  expect(reopened.profile).toEqual(purchased.profile);
  expect(reopened.attempt.board.joker).toBeUndefined();
  await page.locator('#wallet-open').tap();
  await page.locator('#random-joker-open').tap();
  await expect(page.locator('#random-joker-confirm')).toHaveText('Разместить');
  await expect(page.locator('#random-joker-copy')).toContainText('очистит историю отмен');
  await page.locator('#random-joker-warning [data-close]').tap();
  expect((await read(page)).randomJokers).toEqual(rights);
  expect((await read(page)).profile.jokers).toBe(2);
});

function beforeThirdLoss(previousLosses = 2) {
  let save = profile(level16, 'mvp-level16-loss-' + previousLosses);
  for (const command of losingPath.slice(0, level16.initial.movesLeft! - 1)) {
    const step = dispatch(save, command, level16);
    if (!step.accepted) throw Error('Invalid L16 loss fixture: ' + step.reason);
    save = step.next;
  }
  if (save.attempt.board.movesLeft !== 1 || save.attempt.board.phase !== 'playing') throw Error('Expected one remaining move');
  save.attempt.director = { restarts: previousLosses, previousLosses };
  save.attempt.sourceDifficulty = { outcome: 'Restart', restarts: previousLosses };
  save.campaignLives = { version: 1, remaining: 3, observedAt: NOW, earnedCredits: 0 };
  save.profile.coins = 500;
  return save;
}

for (const choice of ['fixed', 'new'] as const) {
  test(`L16 third loss offers honest budget relief; ${choice} retry spends one life and retains the chosen identity`, async ({ page }) => {
    test.setTimeout(60_000);
    const save = beforeThirdLoss();
    await seedHome(page, save);
    await page.locator('#home-play').tap();
    await gameReady(page, level16);
    await move(page, level16, losingPath[level16.initial.movesLeft! - 1]);
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#replay')).toHaveText('Тот же расклад');
    await expect(page.locator('#result-new-attempt')).toBeVisible();
    await expect(page.locator('#result-new-attempt small')).toHaveText('Больше ходов · лимит ' + relief16.initial.movesLeft);
    await expect(page.locator('#result-life-note')).toContainText('одна жизнь');
    const lost = await read(page);
    expect(lost.attempt.board.phase).toBe('exhausted');
    expect(lost.campaignLives?.remaining).toBe(3);
    await page.locator(choice === 'fixed' ? '#replay' : '#result-new-attempt').tap();
    await expect.poll(async () => (await read(page)).attempt.id).not.toBe(lost.attempt.id);
    const expected = choice === 'fixed' ? level16 : relief16;
    await gameReady(page, expected);
    const issued = await read(page);
    expect(issued.attempt.board).toEqual(expected.initial);
    expect(issued.profile.coins).toBe(lost.profile.coins);
    expect(issued.profile.jokers).toBe(lost.profile.jokers);
    expect(issued.campaignLives?.remaining).toBe(2);
    expect(issued.campaignLives?.refillAt! - issued.campaignLives!.observedAt).toBe(LIVES_RULES.refillMs);
    expect(issued.attempt.director).toMatchObject({ restarts: 3, previousLosses: 3 });
    if (choice === 'new') {
      expect(issued.attempt.dealId).not.toBe(lost.attempt.dealId);
      expect(issued.attempt.issuance).toMatchObject({ source: 'budget-r2', dealId: relief16.id });
      expect(issued.attempt.board.tableau).toEqual(level16.initial.tableau);
      expect(issued.attempt.board.movesLeft).toBeGreaterThan(level16.initial.movesLeft!);
    } else expect(issued.attempt.dealId).toBe(lost.attempt.dealId);
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.locator('#home-play').tap();
    await gameReady(page, expected);
    const reopened = await read(page);
    expect(reopened.attempt.id).toBe(issued.attempt.id);
    expect(reopened.attempt.board).toEqual(issued.attempt.board);
    expect(reopened.attempt.issuance).toEqual(issued.attempt.issuance);
    expect(reopened.profile).toEqual(issued.profile);
    expect(reopened.campaignLives?.remaining).toBe(2);
  });
}

test('L16 below the third-loss threshold exposes fixed replay without promising an unavailable new attempt', async ({ page }) => {
  const save = beforeThirdLoss(1);
  await seedHome(page, save);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  await move(page, level16, losingPath[level16.initial.movesLeft! - 1]);
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#replay')).toBeVisible();
  await expect(page.locator('#result-new-attempt')).toBeHidden();
  expect((await read(page)).attempt.dealId).toBe(level16.id);
  expect((await read(page)).campaignLives?.remaining).toBe(3);
});

test('failed native clock at startup preserves an unused earned right, keeps finite play available and later activates only its original remainder', async ({ page }) => {
  test.setTimeout(60_000);
  const save = profile(level16, 'mvp-earned-clock-startup');
  save.profile.coins = 300;
  expect(grantUnlimitedAccess(save, level16, { version: 1, id: 'earned-before-process-restart',
    attemptId: save.attempt.id, source: 'rewarded', issuedAt: NOW, until: NOW + 60_000 },
  { timeline: 'android-7', elapsed: 50_000, native: true })).toBe(true);
  const earned = structuredClone(save.attempt.unlimitedAccess);
  await observeAnalytics(page, { fail: true, boot: 7, elapsed: 60_000 });
  await seedHome(page, save, NOW + 10_000);
  expect(await clockReads(page)).toBeGreaterThanOrEqual(1);
  expect((await read(page)).attempt.unlimitedAccess).toEqual(earned);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  await expect(page.locator('#app')).toHaveAttribute('data-recovery-clock', 'false');
  await expect(page.locator('#recovery-clock-status')).toBeHidden();
  await expect(page.locator('#moves')).toHaveText(String(level16.initial.movesLeft));
  await move(page, level16, { type: 'draw' });
  const finite = (await read(page)).attempt;
  expect(finite.board.movesLeft).toBe(level16.initial.movesLeft! - 1);
  expect(finite.unlimitedAccess).toEqual(earned);
  await page.locator('#wallet-open').tap();
  const readsBeforeRetry = await clockReads(page);
  await page.locator('#unlimited-preview').tap();
  await expect.poll(() => clockReads(page)).toBeGreaterThan(readsBeforeRetry);
  await expect(page.locator('#unlimited-status')).toBeVisible();
  await expect(page.locator('#unlimited-status')).toContainText('Не удалось проверить время');
  expect((await read(page)).attempt.unlimitedAccess).toEqual(earned);
  expect((await read(page)).attempt.unlimited).toBeUndefined();
  expect((await read(page)).profile.coins).toBe(300);
  await page.locator('#helper-return').tap();

  await home(page);
  await page.locator('#daily-play').tap();
  const daily = dailyForDay(DAY);
  await gameReady(page, daily);
  await move(page, daily, daily.winningPath[0]);
  expect((await read(page)).parked?.campaign?.unlimitedAccess).toEqual(earned);
  await home(page);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  expect((await read(page)).attempt.id).toBe(save.attempt.id);

  // The wall clock is now before issuance. The Android sample says forty of sixty seconds elapsed.
  await page.clock.setSystemTime(new Date(NOW - 10_000));
  await setNativeClock(page, { fail: false, boot: 7, elapsed: 90_000 });
  await page.locator('#wallet-open').tap();
  await page.locator('#unlimited-preview').tap();
  await expect.poll(async () => (await read(page)).attempt.unlimitedAccess?.consumed).toBe(true);
  const activated = await read(page);
  expect(activated.attempt.unlimited).toMatchObject({ until: earned!.until, clock: earned!.clock });
  expect(activated.attempt.board.movesLeft).toBeNull();
  expect(activated.attempt.board.retainedMoves).toBe(finite.board.movesLeft);
  expect(activated.profile.coins).toBe(300);
  await expect(page.locator('#moves')).toHaveText('∞');
  await page.clock.fastForward(21_000);
  await expect.poll(async () => (await read(page)).attempt.unlimited?.expired).toBe(true);
  expect(await page.evaluate(() => Date.now())).toBeLessThan(earned!.until);
  expect((await read(page)).attempt.board.movesLeft).toBe(finite.board.movesLeft);
  expect((await read(page)).attempt.unlimited?.until).toBe(earned!.until);
  expect((await read(page)).profile.coins).toBe(300);
  await expect(page.locator('#recovery-clock-status')).toBeHidden();
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  expect((await read(page)).attempt.unlimitedAccess?.consumed).toBe(true);
  expect((await read(page)).attempt.unlimited?.expired).toBe(true);
  expect((await read(page)).attempt.board.movesLeft).toBe(finite.board.movesLeft);
});

test('unknown startup clock blocks an active infinite board while Home and Daily work; delayed native recovery restores the expired finite board and Undo', async ({ page }) => {
  test.setTimeout(60_000);
  let save = profile(level16, 'mvp-active-clock-startup');
  save.profile.coins = 300;
  expect(buyUnlimitedAccess(save, level16, 'paid-before-process-restart', NOW,
    { timeline: 'android-7', elapsed: 50_000, native: true })).toBe(true);
  const drawn = dispatch(save, { type: 'draw' }, level16);
  expect(drawn.accepted).toBe(true);
  save = drawn.next;
  const original = structuredClone(save.attempt), paidCoins = save.profile.coins;
  await observeAnalytics(page, { fail: true, boot: 7, elapsed: 60_000 });
  await seedHome(page, save, NOW + 10_000);
  expect((await read(page)).attempt.unlimited).toEqual(original.unlimited);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  await expect(page.locator('#app')).toHaveAttribute('data-recovery-clock', 'true');
  await expect(page.locator('#recovery-clock-status')).toBeVisible();
  await expect(page.locator('#moves')).toHaveText('…');
  await tapStock(page, level16);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect((await read(page)).attempt.board).toEqual(original.board);
  expect((await read(page)).attempt.undo).toEqual(original.undo);
  expect((await read(page)).profile.coins).toBe(paidCoins);

  await home(page);
  await expect(page.locator('#app')).toHaveAttribute('data-recovery-clock', 'false');
  await page.locator('#daily-play').tap();
  const daily = dailyForDay(DAY);
  await gameReady(page, daily);
  await expect(page.locator('#recovery-clock-status')).toBeHidden();
  await move(page, daily, daily.winningPath[0]);
  const dailyMoved = (await read(page)).attempt;
  expect((await read(page)).parked?.campaign?.unlimited).toEqual(original.unlimited);
  // Keep the timer segment deterministic: the pinned clock's realtime run and
  // fastForward can overlap. runFor preserves each timer's own due time.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.clock.setSystemTime(new Date(NOW - 120_000));
  // Reach at least the eight-second native retry delay. Daily's accepted move started
  // real five-second telemetry checkpoints, which must not postpone the native retry.
  for (let tick = 0; tick < 4 && await clockReads(page) < 4; tick++) {
    const before = await clockReads(page);
    await page.clock.runFor(5000);
    await expect.poll(() => clockReads(page)).toBeGreaterThan(before);
  }
  expect(await clockReads(page)).toBeGreaterThanOrEqual(4);
  expect((await read(page)).parked?.campaign?.unlimited).toEqual(original.unlimited);
  expect((await read(page)).attempt.board).toEqual(dailyMoved.board);
  await expect(page.locator('#app')).toHaveAttribute('data-recovery-clock', 'false');

  // Each step commits a genuine checkpoint. The already scheduled native sample still
  // runs on its original due time, despite unrelated onChange calls every five seconds.
  await page.clock.setSystemTime(new Date(NOW - 120_000));
  const readsBeforeRecovery = await clockReads(page);
  await setNativeClock(page, { fail: false, boot: 7, elapsed: 111_000 });
  for (let tick = 0; tick < 4; tick++) {
    const activeBefore = (await read(page)).attempt.telemetry!.activeMs;
    await page.clock.runFor(5000);
    await expect.poll(async () => (await read(page)).attempt.telemetry?.activeMs).toBeGreaterThan(activeBefore);
  }
  expect(await clockReads(page)).toBeGreaterThan(readsBeforeRecovery);
  await expect.poll(async () => (await read(page)).parked?.campaign?.unlimited?.expired).toBe(true);
  expect(await page.evaluate(() => Date.now())).toBeLessThan(original.unlimited!.issuedAt);
  const recovered = (await read(page)).parked!.campaign!;
  expect(recovered.id).toBe(original.id);
  expect(recovered.unlimited?.clock).toEqual(original.unlimited?.clock);
  expect(recovered.unlimited?.until).toBe(original.unlimited?.until);
  expect(recovered.board.movesLeft).toBe(level16.initial.movesLeft! - 1);
  expect(recovered.undo[0].movesLeft).toBe(level16.initial.movesLeft);
  expect((await read(page)).attempt.board).toEqual(dailyMoved.board);
  expect((await read(page)).profile.coins).toBe(paidCoins);
  await page.clock.resume();
  await home(page);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  await expect(page.locator('#recovery-clock-status')).toBeHidden();
  await expect(page.locator('#moves')).toHaveText(String(level16.initial.movesLeft! - 1));
  await move(page, level16, { type: 'draw' });
  expect((await read(page)).attempt.board.movesLeft).toBe(level16.initial.movesLeft! - 2);
  expect((await read(page)).profile.coins).toBe(paidCoins);
});

test('failed persistence of timed expiry backs off instead of spinning and restores the original finite board once storage recovers', async ({ page }) => {
  test.setTimeout(60_000);
  let save = profile(level16, 'mvp-expiry-write-retry');
  save.profile.coins = 300;
  expect(buyUnlimitedAccess(save, level16, 'paid-expiry-write', NOW,
    { timeline: 'android-7', elapsed: 50_000, native: true })).toBe(true);
  const drawn = dispatch(save, { type: 'draw' }, level16);
  expect(drawn.accepted).toBe(true);
  save = drawn.next;
  const original = structuredClone(save.attempt), paidCoins = save.profile.coins;
  await observeAnalytics(page, { fail: false, boot: 7, elapsed: 50_000 });
  await seedHome(page, save);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  await expect(page.locator('#moves')).toHaveText('∞');
  expect((await read(page)).attempt.telemetry?.started).not.toBe(true);
  await failStorage(page, true);
  const before = await storageState(page);
  await page.clock.fastForward(61_000);
  await expect.poll(async () => (await storageState(page)).failures).toBeGreaterThan(before.failures);
  // Run every timer in this interval: a zero-delay retry loop cannot pass as one skipped timeout.
  await page.clock.runFor(3500);
  const failed = await storageState(page), attempts = failed.writes - before.writes;
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(attempts).toBeLessThanOrEqual(4);
  expect(failed.failures - before.failures).toBe(attempts);
  const waiting = await read(page);
  expect(waiting.attempt.board).toEqual(original.board);
  expect(waiting.attempt.undo).toEqual(original.undo);
  expect(waiting.attempt.unlimited?.expired).toBeUndefined();
  expect(waiting.profile.coins).toBe(paidCoins);

  await failStorage(page, false);
  await page.clock.fastForward(4500);
  await expect.poll(async () => (await read(page)).attempt.unlimited?.expired).toBe(true);
  const recovered = await read(page);
  expect(recovered.attempt.id).toBe(original.id);
  expect(recovered.attempt.unlimited?.until).toBe(original.unlimited?.until);
  expect(recovered.attempt.board.movesLeft).toBe(level16.initial.movesLeft! - 1);
  expect(recovered.attempt.board.retainedMoves).toBeUndefined();
  expect(recovered.attempt.undo[0].movesLeft).toBe(level16.initial.movesLeft);
  expect(recovered.attempt.undo[0].retainedMoves).toBeUndefined();
  expect(recovered.profile.coins).toBe(paidCoins);
  await expect(page.locator('#moves')).toHaveText(String(level16.initial.movesLeft! - 1));
  await move(page, level16, { type: 'draw' });
  expect((await read(page)).attempt.board.movesLeft).toBe(level16.initial.movesLeft! - 2);
  expect((await read(page)).profile.coins).toBe(paidCoins);
});

for (const direction of ['to-daily', 'to-campaign', 'level-picker'] as const) {
  test(`rebinds the board to a saved deal after ambiguous ${direction} transition`, async ({ page }) => {
    const daily = dailyForDay(DAY);
    const campaign = content8Dealer[3];
    const save = direction === 'to-campaign' ? profile(daily, 'audit-active-daily') : profile(campaign);
    if (direction === 'to-campaign') {
      save.parked = { campaign: profile(campaign).attempt };
      save.platform!.completedCampaign = profile(campaign).platform!.completedCampaign;
    }
    await observeAnalytics(page);
    await seedHome(page, save);
    await page.evaluate(() => {
      (window as typeof window & { mvpNativeStorage: NativeStorageFixture }).mvpNativeStorage.breakTransition = true;
    });
    if (direction === 'level-picker') {
      await page.locator('#level-picker-open').tap();
      await page.locator('#level-2').tap();
    } else {
      await page.locator(direction === 'to-daily' ? '#daily-play' : '#home-play').tap();
    }
    const retry = page.locator('#save-retry');
    await expect(retry).toBeVisible();
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', save.attempt.dealId);
    const committed = (await read(page)).attempt;
    expect(committed.dealId).not.toBe(save.attempt.dealId);
    await page.evaluate(() => {
      (window as typeof window & { mvpNativeStorage: NativeStorageFixture }).mvpNativeStorage.blockedRead = false;
    });
    if (direction === 'to-campaign') {
      // An unrelated settings write can confirm the earlier commit.
      await page.locator('#menu').tap();
      await page.locator('#haptics').uncheck();
    } else await retry.tap();
    const target = findDeal(committed.dealId)!;
    await gameReady(page, target);
    await expect(page.locator('#play-screen')).toBeVisible();
    await expect(retry).toBeHidden();
    const ready = await read(page);
    expect(ready.attempt).toEqual(committed);
    await move(page, target, target.winningPath[0]);
    expect((await read(page)).attempt.undo.at(-1)).toEqual(committed.board);
  });
}

test('shows a readable Unlimited timer and permits stock recovery at 320x480 with a banner', async ({ page }, info) => {
  const touched = profile(level16, 'audit-timer-stock');
  let save = touched;
  while (save.attempt.board.stock.length || save.attempt.board.recyclesLeft) {
    const next = dispatch(save, { type: save.attempt.board.stock.length ? 'draw' : 'recycle' }, level16);
    if (!next.accepted) throw Error(next.reason);
    save = next.next;
  }
  expect(save.attempt.board.phase).toBe('playing');
  save.profile.coins = 120;
  await page.setViewportSize({ width: 320, height: 480 });
  await seedHome(page, save);
  await page.locator('#home-play').tap();
  await gameReady(page, level16);
  const banner = page.locator('#banner-slot');
  const reserveBanner = () => banner.evaluate(slot => {
    slot.removeAttribute('hidden');
    slot.style.height = '60px';
  });
  await reserveBanner();
  await expect(page.locator('#stock-recovery')).toContainText('Повторы колоды исчерпаны');
  const restore = page.locator('#stock-recovery-button');
  await expect(restore).toHaveText('Восстановить бесплатно');
  const timer = page.locator('#unlimited-countdown');
  await expect(timer).toBeHidden();
  await page.locator('#wallet-open').tap();
  await page.locator('#unlimited-preview').tap();
  if (await page.locator('#helpers').isVisible()) await page.locator('#helper-return').tap();
  await expect(page.locator('#moves')).toHaveText('∞');
  await expect(timer).toBeVisible();
  await reserveBanner();
  const value = timer.locator('strong');
  await expect(value).toHaveText(/^(1:00|0:5[0-9])$/);
  const before = await value.textContent();
  await page.clock.runFor(2100);
  await expect(value).not.toHaveText(before!);

  // Measure the first viewport before touching Restore. Locator.tap can scroll.
  const bounds = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
    const button = document.querySelector('#stock-recovery-button')!;
    const restore = rect('#stock-recovery-button');
    const center = { x: restore.x + restore.width / 2, y: restore.y + restore.height / 2 };
    return {
      scroll: [scrollX, scrollY, document.querySelector('#play-screen')!.scrollTop],
      timer: rect('#unlimited-countdown'), value: rect('#unlimited-countdown strong'),
      board: rect('#game-root'), restore, banner: rect('#banner-slot'), center,
      hitsRestore: button.contains(document.elementFromPoint(center.x, center.y)),
    };
  });
  expect(bounds.scroll).toEqual([0, 0, 0]);
  expect(bounds.value.height).toBeGreaterThanOrEqual(15);
  expect(bounds.value.width).toBeGreaterThanOrEqual(26);
  expect(bounds.timer.left).toBeGreaterThanOrEqual(0);
  expect(bounds.timer.right).toBeLessThanOrEqual(320);
  expect(bounds.timer.top).toBeGreaterThanOrEqual(0);
  expect(bounds.timer.bottom).toBeLessThanOrEqual(bounds.board.top + 1);
  expect(bounds.banner.height).toBe(60);
  expect(bounds.banner.bottom).toBeLessThanOrEqual(480);
  expect(bounds.restore.top).toBeGreaterThanOrEqual(bounds.board.bottom - 1);
  expect(bounds.restore.left).toBeGreaterThanOrEqual(0);
  expect(bounds.restore.right).toBeLessThanOrEqual(320);
  expect(bounds.restore.bottom).toBeLessThanOrEqual(bounds.banner.top);
  expect(bounds.hitsRestore).toBe(true);
  await info.attach('320x480 with countdown, Restore and 60px banner reserve', {
    body: JSON.stringify(bounds), contentType: 'application/json',
  });
  if (process.env.ASOC_MVP_DEMO === '1') {
    await info.attach('countdown and Restore', { body: await page.screenshot(), contentType: 'image/png' });
  }
  await page.touchscreen.tap(bounds.center.x, bounds.center.y);
  await expect.poll(async () => (await read(page)).attempt.stockRestores).toBe(1);
  await expect(restore).toBeHidden();
  await page.locator('#undo').tap();
  await expect(restore).toHaveText('Восстановить · 60 монет');
  await expect(restore).toBeDisabled();
  expect((await read(page)).profile.coins).toBe(0);
});
