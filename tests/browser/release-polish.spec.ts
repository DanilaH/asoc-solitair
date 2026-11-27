import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { findDeal } from '../../src/content/campaign';
import { extendedRecords } from '../../src/content/campaign-meta-bank';
import { dailyForDay } from '../../src/content/daily';
import { m1WeekRows, scheduleTasks } from '../../src/domain/events/daily-tasks';
import { addWinStreakProgress } from '../../src/domain/events/win-streak';
import { openDailyBonusRound } from '../../src/domain/events/daily-bonus';
import { decodePcm16 } from '../../src/platform/recorded-sounds';
import { openPictureEvent } from '../../src/domain/events/picture';
import { layout, boardFrame, cardMetrics } from '../../src/game/layout';
import type { Deal, Save } from '../../src/domain/types';
import { profileAt, play } from '../fixtures/functional-audit-225';
import { move, read } from './wallet-fixture';

const before = process.env.ASOC_POLISH_BEFORE === '1', record = process.env.ASOC_POLISH_RECORD === '1';
test.skip(!before && (process.env.VITE_ASOC_PROFILE !== 'c8-release-v1' ||
  ['227', '229', '230'].some(version => process.env['VITE_ASOC_ARCHIVE_' + version] === '1') || process.env.VITE_HITAPPS_FIXTURES === '1'), 'Requires ordinary release polish');
if (record) test.use({ video: 'on' });
const now = Date.UTC(2026, 10, 30, 12), day = '2026-11-30';
const sourceAt = (level: number) => findDeal(extendedRecords(level)[0].deal.id + '-core-stage1-v1-m1')!;
const saveKey = 'asoc-solitaire.save.v1';

function sample(deal: Deal, reduced = true) {
  const save = profileAt(deal, 'polish-' + (deal.campaignLevel ?? 'daily'));
  save.contentVersion = 8;
  save.settings.reducedMotion = reduced;
  save.campaign!.tutorials.push('intro:bonus-tableau', 'intro:bonus-foundation');
  save.attempt.teachingAds = { version: 1, ordinary: 2 };
  save.profile.coins = 12_345_678;
  return save;
}
async function load(page: Page, save: Save, banner = 0) {
  if (page.url() === 'about:blank') {
    await page.clock.install({ time: new Date(now) });
    await page.goto('/');
  }
  await page.evaluate(({ value, saveKey }) => localStorage.setItem(saveKey, JSON.stringify(value)), { value: save, saveKey });
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });
  if (banner) await page.locator('#banner-slot').evaluate((node, height) => {
    node.removeAttribute('hidden'); node.style.height = height + 'px';
  }, banner);
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page: Page, info: TestInfo, name: string) {
  if (!record) return;
  await page.screenshot({ path: info.outputPath(name + '.png'), scale: 'css' });
  if (!process.env.CI) await page.waitForTimeout(650);
}
async function open(page: Page, button: string, dialog: string) {
  await page.locator(button).tap();
  await expect(page.locator(dialog)).toBeVisible();
  await page.locator(dialog).evaluate(node => Promise.allSettled(node.getAnimations().map(a => a.finished)));
}
async function anchors(page: Page, surface: string, action: string) {
  return page.locator(surface).evaluate((node, selector) => {
    const title = node.querySelector('h2'), close = node.querySelector('.close');
    const button = node.querySelector(selector)!;
    const b = button.getBoundingClientRect(), r = node.getBoundingClientRect(), t = title?.getBoundingClientRect();
    const range = document.createRange(); if (title) range.selectNodeContents(title);
    const c = close?.getBoundingClientRect();
    const overlap = !!c && !!t && Array.from(range.getClientRects()).some(x => Math.min(x.right, c.right) > Math.max(x.left, c.left) + .5 &&
      Math.min(x.bottom, c.bottom) > Math.max(x.top, c.top) + .5);
    return { overlap, oversize: node.scrollWidth > node.clientWidth + 2, top: r.top, buttonY: b.top,
      target: b.height >= 43 && button.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)),
      clipped: r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 };
  }, action);
}

const ext = [81, 100, 200].map(sourceAt);
const boardCases: [number, number, number, Deal][] = [
  [320, 480, 60, findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!],
  [320, 480, 90, findDeal('campaign-c8-wave-080')!],
  [320, 568, 90, findDeal('campaign-c8-wave-039-shuffle-r2')!],
  [360, 640, 0, ext[0]], [360, 780, 60, ext[1]], [393, 851, 90, ext[2]], [412, 915, 0, dailyForDay(day, 2)],
];
test('UI-01 ordinary board, compact captions and stable card geometry', async ({ page }, info) => {
  test.setTimeout(160_000);
  const measures = [];
  for (const [index, [width, height, banner, deal]] of boardCases.entries()) {
    await page.setViewportSize({ width, height });
    const save = sample(deal);
    if (deal.daily) {
      save.platform = sample(ext[0]).platform;
      save.parked = { campaign: sample(ext[0]).attempt };
    }
    const deckSide = index % 2 ? 'left' : 'right', deckPosition = index % 2 ? 'bottom' : 'top';
    Object.assign(save.settings, { deckSide, deckPosition });
    await load(page, save, banner);
    await page.locator(deal.daily ? '#daily-play' : '#home-play').tap();
    await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
    const area = (await page.locator('#game-root').boundingBox())!, geometry = boardFrame(area.width, area.height, deckPosition, deal);
    const frame = layout(save.attempt.board, deal, geometry, deckSide, deckPosition);
    const aa = (await page.locator('#inspect').boundingBox())!;
    const card = cardMetrics(deal);
    const hit = await page.locator('#inspect').evaluate(node => {
      const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(aa.width).toBeGreaterThanOrEqual(44);
    expect(hit).toBe(true);
    expect(card.height / card.width).toBeCloseTo(166 / 138, 4);
    expect(area.y + area.height).toBeLessThanOrEqual(aa.y + 1);
    const name = `${width}x${height}-${banner}-${deal.campaignLevel ?? 'Daily-v2'}`;
    await capture(page, info, 'UI01-' + name);
    if (save.attempt.board.stock.length) {
      await page.touchscreen.tap(area.x + frame.stock.x * geometry.unit, area.y + frame.stock.y * geometry.unit);
      await expect.poll(async () => (await read(page)).attempt.board.stock.length).toBeLessThan(save.attempt.board.stock.length);
      const nextArea = (await page.locator('#game-root').boundingBox())!;
      expect(Math.abs(area.width - nextArea.width) + Math.abs(area.height - nextArea.height)).toBeLessThanOrEqual(1);
    }
    measures.push({ name, cardPx: geometry.unit * card.width, board: area, aa, deckSide, deckPosition, hit });
  }
  if (record) await writeFile(info.outputPath('geometry.json'), JSON.stringify(measures, null, 2));
});

test('UI-02–05 and UI-08 paper sheets, long wallet, legacy album and focus return', async ({ page }, info) => {
  test.setTimeout(100_000);
  await page.setViewportSize({ width: 320, height: 480 });
  const save = sample(ext[0]);
  save.campaignLives = { version: 2, remaining: 0, observedAt: now, refillAt: now + 60000, earnedCredits: 0 };
  save.meta!.dailyDates.push('2026-11-28', '2026-11-29', day);
  save.meta!.lastDaily = day; save.meta!.dailyStreak = 3;
  openPictureEvent(save, now - 86400000);
  await load(page, save, 90);
  await capture(page, info, 'UI05-home');
  const results = [];
  for (const [button, dialog, action, shot] of [
    ['#picture-home', '#picture-dialog', '#picture-done', 'UI02-legacy-album'],
    ['#calendar-open', '#calendar', '.sheet-actions button', 'UI03-calendar'],
    ['#appearance-open', '#appearance', '#appearance-done', 'UI03-appearance'],
    ['#campaign-lives-open', '#campaign-lives', '.close', 'UI04-lives'],
    ['#wallet-open', '#coins-dialog', '#coins-return', 'UI04-wallet'],
    ['#menu', '#settings', '#settings-done', 'UI04-settings'],
  ] as const) {
    await open(page, button, dialog);
    const metrics = await anchors(page, dialog, action);
    if (!before) expect(metrics, shot).toMatchObject({ overlap: false, oversize: false, clipped: false, target: true });
    await capture(page, info, shot);
    if (!before && dialog === '#appearance') {
      await expect(page.locator(dialog)).toHaveAttribute('data-scroll-down', '');
      const body = page.locator(dialog + ' .sheet-body');
      await body.evaluate(n => { n.scrollTop = n.scrollHeight; });
      await expect(page.locator(dialog)).not.toHaveAttribute('data-scroll-down');
      await expect(page.locator('[data-deck-side=left]')).toBeInViewport();
      await capture(page, info, 'UI03-appearance-end');
    }
    if (dialog === '#settings') {
      await open(page, '#helpers-open', '#helpers');
      if (!before) expect(await page.locator('#hint-offer h3').evaluate(n => getComputedStyle(n, '::before').content)).toBe('none');
      await capture(page, info, 'UI08-helpers');
      await page.locator('#helper-return').tap();
      await expect(page.locator('#settings')).toBeVisible();
      if (!before) await expect(page.locator('#helpers-open')).toBeFocused();
    }
    await page.locator(dialog + ' .close').tap();
    await expect(page.locator(dialog)).toBeHidden();
    results.push({ shot, ...metrics });
  }
  if (record) await writeFile(info.outputPath('sheets.json'), JSON.stringify(results, null, 2));
});

test('UI-07 and UI-10 keep series and weekly anchors through a committed chest', async ({ page }, info) => {
  test.setTimeout(80_000);
  await page.setViewportSize({ width: 360, height: 640 });
  const save = sample(ext[0], false);
  addWinStreakProgress(save, 6);
  scheduleTasks(save, now, m1WeekRows(0), [
    { id: 'm1-week-50', medals: 50, prize: { kind: 'Coins', quantity: 15 } },
    { id: 'm1-week-100', medals: 100, prize: { kind: 'Definition', quantity: 1 } },
    { id: 'm1-week-300', medals: 300, prize: { kind: 'Coins', quantity: 25 } },
    { id: 'm1-week-600', medals: 600, prize: { kind: 'Coins', quantity: 30 } },
    { id: 'm1-week-1000', medals: 1000, prize: { kind: 'Coins', quantity: 30 }, chest: { kind: 'Undo', quantity: 1 } },
  ], 'azur-m1-week-r1');
  save.dailyTasks!.weeks[0].totalMedals = 1000;
  await load(page, save);
  await open(page, '#win-cycle-open', '#cycle-info');
  const a = await anchors(page, '#cycle-info', 'button[data-close]:last-child');
  await capture(page, info, 'UI10-series');
  await page.locator('#cycle-claim').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(save.profile.coins + 100);
  await expect(page.locator('#cycle-claim')).toBeHidden();
  const b = await anchors(page, '#cycle-info', 'button[data-close]:last-child');
  if (!before) expect(Math.abs(a.buttonY - b.buttonY)).toBeLessThanOrEqual(1);
  await capture(page, info, 'UI07-series-claimed');
  await page.locator('#cycle-info .close').tap();
  await open(page, '#daily-tasks-open', '#daily-tasks-dialog');
  await capture(page, info, 'UI10-week');
  const weekly = page.locator('#daily-tasks-milestones button');
  await weekly.last().tap();
  await page.locator('#task-chest-open').tap();
  await expect(page.locator('#task-chest-prize')).toContainText('отмен');
  await expect.poll(async () => (await read(page)).profile.undos).toBe(save.profile.undos + 1);
  await capture(page, info, 'UI10-chest');
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });
  await open(page, '#daily-tasks-open', '#daily-tasks-dialog');
  await expect(page.locator('#task-chest-open')).toBeHidden();
  if (record) await writeFile(info.outputPath('anchors.json'), JSON.stringify({ a, b }, null, 2));
});

test('UI-06 result and recovery remain usable on the short viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 480 });
  const deal = findDeal('campaign-c8-dealer-006-bonus-r2')!;
  const save = play(sample(deal), deal, deal.winningPath.slice(0, -1));
  await load(page, save, 90);
  await page.locator('#home-play').tap();
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  await move(page, deal, deal.winningPath.at(-1)!);
  await expect(page.locator('#result')).toBeVisible();
  if (!before) expect(await anchors(page, '#result', '#next-level')).toMatchObject({ target: true, clipped: false });
  await capture(page, info, 'UI06-win');
  const loss = sample(ext[1]);
  loss.attempt.board.movesLeft = 0; loss.attempt.board.phase = 'exhausted';
  await load(page, loss);
  await open(page, '#home-play', '#result');
  if (!before) expect(await anchors(page, '#result', '#replay')).toMatchObject({ target: true, clipped: false });
  await capture(page, info, 'UI06-loss');
});

test('UI-09 durable Daily Bonus match respects audio, haptics and motion independently', async ({ page }, info) => {
  test.setTimeout(150_000);
  const raw = await readFile('public/audio/card-place-2.wav');
  const sound = decodePcm16(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const expected = `${sound.rate}/${sound.samples.length}`;
  await page.addInitScript(() => {
    const cues = { audio: [] as string[], haptic: [] as string[] };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) cues.audio.push(`${this.buffer.sampleRate}/${this.buffer.length}`);
      return start.apply(this, args);
    };
    const headers = (name: string, methods: string[]) => ({ name, methods: methods.map(name => ({ name, rtype: 'promise' })) });
    Object.assign(window, { androidBridge: {}, polishCues: cues, Capacitor: {
      PluginHeaders: [headers('App', ['getState']), headers('SolitaireFeedback', ['pulse', 'cancel']),
        headers('SolitaireAudio', ['configure']), headers('SolitaireStorage', ['get', 'set', 'remove'])],
      nativePromise: async (plugin: string, method: string, options: Record<string, string>) => {
        if (plugin === 'App') return { isActive: true };
        if (plugin === 'SolitaireAudio') return { focused: true };
        if (plugin === 'SolitaireFeedback' && method === 'pulse') cues.haptic.push(options.cue);
        if (plugin === 'SolitaireStorage') {
          if (method === 'get') return { value: localStorage.getItem(options.key) };
          if (method === 'set') localStorage.setItem(options.key, options.value);
          if (method === 'remove') localStorage.removeItem(options.key);
        }
        return {};
      },
    } });
  });
  const counts = () => page.evaluate(id => {
    const cues = (window as Window & { polishCues?: { audio: string[]; haptic: string[] } }).polishCues!;
    return { audio: cues.audio.filter(x => x === id).length, haptic: cues.haptic.filter(x => x === 'complete').length };
  }, expected);
  const results = [];
  for (const reduced of [false, true]) for (const sfx of [true, false]) for (const haptics of [true, false]) {
    if (before && (sfx !== true || haptics !== true)) continue;
    const save = sample(ext[0], reduced);
    Object.assign(save.settings, { sfx, haptics });
    const round = openDailyBonusRound(save, now, 'polish-match', () => 0, 'azur-compiled-r1')!;
    const prize = round.slots.find((slot, _, list) => list.filter(value => value === slot).length === 3)!;
    const indexes = round.slots.flatMap((slot, index) => slot === prize ? [index] : []);
    expect(indexes).toHaveLength(3);
    await load(page, save);
    await open(page, '#daily-bonus-open', '#daily-bonus-dialog');
    const cards = page.locator('#daily-bonus-cards button');
    const initial = await counts();
    for (const index of indexes) await cards.nth(index).tap();
    await expect(page.locator('#daily-bonus-claim')).toBeVisible();
    const counted = await counts();
    const result = { audio: counted.audio - initial.audio, haptic: counted.haptic - initial.haptic };
    if (!before) expect(result).toEqual({ audio: Number(sfx), haptic: Number(haptics) });
    if (sfx && haptics) await capture(page, info, 'UI09-match-' + (reduced ? 'reduced' : 'motion'));
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });
    await open(page, '#daily-bonus-open', '#daily-bonus-dialog');
    await expect(page.locator('#daily-bonus-claim')).toBeVisible();
    if (!before) expect(await counts()).toEqual({ audio: 0, haptic: 0 });
    results.push({ reduced, sfx, haptics, ...result });
  }
  if (record) await writeFile(info.outputPath('reward-feedback.json'), JSON.stringify(results, null, 2));
});
