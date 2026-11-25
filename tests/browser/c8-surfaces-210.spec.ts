import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { openPictureEvent } from '../../src/domain/events/picture';
import { observeEvents, recordEventWin, type EventDefinition } from '../../src/domain/events/ledger';
import type { Save } from '../../src/domain/types';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary C8 release profile');
const now = Date.UTC(2026, 10, 25, 12);
const deal = findDeal('campaign-c8-wave-021')!;
const saveKey = 'asoc-solitaire.save.v1';
function profile() {
  const save = freshSave(deal, 'surface-audit-210');
  save.contentVersion = 8;
  save.profile.coins = 1234567;
  save.meta!.winCycle = 3;
  save.profile.rewards.push('milestone:10', 'milestone:20');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 20 }, (_, i) => campaignId(i + 1)) };
  return save;
}
async function open(page: Page, selector: string, dialog: string) {
  await page.locator(selector).tap();
  await expect(page.locator(dialog)).toBeVisible();
}
async function close(page: Page, dialog: string) {
  await page.locator(dialog + ' .close').tap();
  await expect(page.locator(dialog)).toBeHidden();
}
async function capture(page: Page, info: TestInfo, id: string, name: string, focusedAction?: string) {
  const root = page.locator(id);
  await expect(root).toBeVisible();
  await page.evaluate(() => Promise.allSettled(document.getAnimations()
    .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    .map(animation => animation.finished)));
  const issues = await root.evaluate((surface, action) => {
    const problems: string[] = [];
    const rect = surface.getBoundingClientRect();
    if (rect.left < -.5 || rect.right > innerWidth + .5 || rect.top < -.5 || rect.bottom > innerHeight + .5)
      problems.push('surface outside viewport');
    if (surface.scrollWidth - surface.clientWidth > 3) problems.push('horizontal overflow');
    if (action) {
      const node = document.querySelector(action);
      const hit = node?.getBoundingClientRect();
      if (!node || !hit || !node.contains(document.elementFromPoint(hit.x + hit.width / 2, hit.y + hit.height / 2)))
        problems.push('unreachable primary ' + action);
    }
    return problems;
  }, focusedAction);
  await page.screenshot({ path: info.outputPath(name + '.png'), scale: 'css' });
  expect.soft(issues, name).toEqual([]);
}
async function load(page: Page, save: Save) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: save });
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
}
for (const [width, height, reserve] of [[320, 480, 90], [360, 640, 0]] as const) {
  test(`settled everyday and archived C8 surfaces at ${width}×${height}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    await page.clock.install({ time: new Date(now) });
    await page.goto(process.env.ASOC_COMPARE_210_URL ?? '/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const loaded = profile();
    const oldDaily = dailyForDay('2026-11-24');
    loaded.parked = { daily: dispatch(freshSave(oldDaily, 'surface-old-daily'), oldDaily.winningPath[0], oldDaily).next.attempt };
    loaded.parked.daily!.telemetry = { started: true, finished: false, activeMs: 1000 };
    const event: EventDefinition = { id: 'audit-legacy-race', version: 1, sourceFeatureId: 'hitapps-weekend-race', minCampaignLevel: 16, daily: false,
      schedule: { clock: 'local', zone: 'UTC', start: now - 86_400_000, end: now - 1 },
      milestones: [{ id: 'ready', threshold: 1, reward: { coins: 17 } }] };
    openPictureEvent(loaded, now - 86_400_000);
    recordEventWin(loaded, [event], { id: 'campaign:20', campaignLevel: 20, mode: 'campaign' }, { localMs: now - 100 });
    observeEvents(loaded, [], { localMs: now });
    loaded.campaignLives = { version: 1, remaining: 0, observedAt: now, refillAt: now + 60_000, earnedCredits: 0 };
    await load(page, loaded);
    if (reserve) await page.locator('#banner-slot').evaluate((element, height) => {
      element.removeAttribute('hidden');
      element.style.height = height + 'px';
    }, reserve);
    await capture(page, info, '#app', 'home-parked-empty-lives', '#home-play');
    await open(page, '#campaign-lives-open', '#campaign-lives');
    await capture(page, info, '#campaign-lives', 'lives-zero', '#campaign-lives .close');
    await close(page, '#campaign-lives');
    for (const [control, dialog, name] of [
      ['#calendar-open', '#calendar', 'calendar'],
      ['#appearance-open', '#appearance', 'appearance-unlocked'],
      ['#wallet-open', '#helpers', 'helpers'],
      ['#win-cycle-open', '#cycle-info', 'cycle'],
      ['#picture-home', '#picture-dialog', 'album-legacy'],
      ['#campaign-liveops-open', '#campaign-liveops', 'events-legacy'],
      ['#menu', '#settings', 'settings-home'],
    ]) {
      await open(page, control, dialog);
      const exit = dialog === '#picture-dialog' ? '#picture-close' : dialog + ' .close';
      await capture(page, info, dialog, name, exit);
      await close(page, dialog);
    }
    await open(page, '#daily-play', '#replace-daily');
    await capture(page, info, '#replace-daily', 'replace-daily', '#replace-daily-yes');
    await page.locator('#replace-daily button[data-close]').tap();
    const inGame = dispatch(profile(), deal.winningPath[0], deal).next;
    inGame.settings.deckPosition = 'bottom';
    inGame.settings.deckSide = 'left';
    await load(page, inGame);
    await open(page, '#home-play', '#play-screen');
    await open(page, '#menu', '#settings');
    await capture(page, info, '#settings', 'pause', '#settings-done');
    await page.locator('#pause-options summary').tap();
    await capture(page, info, '#settings', 'pause-options', '#settings-done');
    await open(page, '#appearance-settings', '#appearance');
    await capture(page, info, '#appearance', 'deck-preview', '#appearance .close');
    await page.locator('#appearance-done').tap();
    await page.locator('#pause-options summary').tap();
    await open(page, '#restart', '#restart-confirm');
    await capture(page, info, '#restart-confirm', 'restart', '#restart-confirm-yes');
    const exhausted = profile();
    exhausted.attempt.board.movesLeft = 0;
    exhausted.attempt.board.phase = 'exhausted';
    await load(page, exhausted);
    await open(page, '#home-play', '#result');
    await capture(page, info, '#result', 'loss', '#replay');
  });
}
