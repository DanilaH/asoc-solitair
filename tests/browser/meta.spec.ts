import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { dispatch, freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
test.use({ timezoneId: 'UTC' });
const read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function seed(page: Page, save: Save) {
  await page.goto('/'); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
}
function profile(level: number) {
  const save = freshSave(campaignDeals[level - 1], `meta-level-${level}`); save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, level - 1).map(d => d.id) }; return save;
}
async function move(page: Page, deal: Deal, cmd: BoardCommand) {
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const before = await read(page), rect = (await page.locator('canvas').boundingBox())!, frame = boardFrame(rect.width, rect.height), geo = layout(before.attempt.board, deal, frame.height, before.settings.deckSide);
  const tap = (p: {x: number; y: number}) => page.touchscreen.tap(rect.x + frame.offsetX + p.x * frame.unit, rect.y + p.y * frame.unit);
  if (cmd.type === 'transfer') {
    const id = cmd.from.kind === 'waste' ? before.attempt.board.waste.at(-1) : packet(before.attempt.board, cmd.from.index, deal).at(-1);
    await tap(geo.poses.find(p => p.id === id)!); await tap(geo.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!);
  } else await tap(geo.stock);
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(before.attempt.board.movesLeft === null ? null : before.attempt.board.movesLeft - 1);
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => r())));
}
async function home(page: Page) { await page.locator('#menu').tap(); await page.locator('#levels-open').tap(); await expect(page.locator('#home')).toBeVisible(); }

test('tenth milestone and fifth win share one durable result; unlocked palette is immediately usable', async ({page}) => {
  const save = profile(10); save.meta!.winCycle = 4; await seed(page, save); await page.locator('#home-play').tap();
  for (const cmd of campaignDeals[9].winningPath) await move(page, campaignDeals[9], cmd);
  await expect(page.locator('#result')).toBeVisible(); await expect(page.locator('#result-rewards')).toContainText('Веха · 10'); await expect(page.locator('#result-rewards')).toContainText('Пять новых побед');
  const won = await read(page); expect(won.meta!.winCycle).toBe(0); expect(won.profile.hints).toBe(4);
  await page.screenshot({path:`test-results/${test.info().project.name}-meta-result.png`});
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true'); expect((await read(page)).profile).toEqual(won.profile);
  await page.locator('#appearance-open').tap(); await expect(page.locator('[data-palette=ink]')).toBeEnabled(); await expect(page.locator('[data-card-back=diamonds]')).toBeDisabled();
  await page.locator('[data-palette=ink]').tap(); await expect(page.locator('#app')).toHaveAttribute('data-palette', 'ink');
});

test('campaign and daily keep exact separate attempts; daily reward and third-day bonus survive reload without replay payout', async ({page}) => {
  test.setTimeout(90000); await page.clock.install({ time: new Date('2026-11-09T12:00:00Z') });
  const save = profile(4); save.meta!.winCycle = 3; save.meta!.dailyDates = ['2026-11-07','2026-11-08']; save.meta!.lastDaily = '2026-11-08'; save.meta!.dailyStreak = 2;
  await seed(page, save); await page.locator('#home-play').tap(); await move(page, campaignDeals[3], campaignDeals[3].winningPath[0]); const campaign = (await read(page)).attempt;
  await home(page); await page.locator('#daily-play').tap(); await expect(page.locator('#level-number')).toContainText('2026-11-09');
  const daily = dailyForDay('2026-11-09'); await move(page, daily, daily.winningPath[0]); const attempt = (await read(page)).attempt;
  await home(page); await page.locator('#home-play').tap(); await expect.poll(async () => (await read(page)).attempt.id).toBe(campaign.id); expect((await read(page)).attempt).toEqual(campaign);
  await home(page); await page.locator('#daily-play').tap(); await expect.poll(async () => (await read(page)).attempt.id).toBe(attempt.id);
  for (const cmd of daily.winningPath.slice(1)) await move(page, daily, cmd);
  await expect(page.locator('#result')).toBeVisible(); await expect(page.locator('#result-rewards')).toContainText('3 дня подряд');
  const won = await read(page); expect(won.meta!.dailyStreak).toBe(3); expect(won.meta!.winCycle).toBe(3); expect(won.parked!.campaign).toEqual(campaign);
  await page.locator('#replay').tap(); await expect(page.locator('#result')).toBeHidden();
  const wallet = (await read(page)).profile.coins;
  for (const cmd of daily.winningPath) await move(page, daily, cmd);
  await expect(page.locator('#result')).toBeVisible(); expect((await read(page)).profile.coins).toBe(wallet);
  await page.locator('#next-level').tap(); await page.locator('#calendar-open').tap(); await expect(page.locator('.calendar-day.complete')).toHaveCount(3);
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true'); expect((await read(page)).meta!.dailyDates).toContain('2026-11-09');
});

test('midnight keeps the old daily as training and next entry starts the new date without touching campaign', async ({page}) => {
  await page.clock.install({ time: new Date('2026-11-09T23:58:00Z') }); await seed(page, profile(3)); await page.locator('#daily-play').tap();
  const daily = dailyForDay('2026-11-09'); await move(page, daily, daily.winningPath[0]);
  await page.clock.setSystemTime(new Date('2026-11-10T00:00:02Z')); const old = (await read(page)).attempt.id;
  await home(page); await expect(page.locator('#daily-resume-old')).toBeVisible(); await page.locator('#daily-resume-old').tap(); expect((await read(page)).attempt.id).toBe(old);
  await home(page); await page.locator('#daily-play').tap(); await expect.poll(async () => (await read(page)).attempt.daily!.dayId).toBe('2026-11-10');
  expect((await read(page)).parked!.campaign!.dealId).toBe(campaignDeals[2].id);
});

test('alternative back and left deck persist, accept real stock and packet touches and fit the screen', async ({page}) => {
  const save = profile(21); save.attempt = freshSave(campaignDeals[2], 'left-deck').attempt; await seed(page, save);
  await page.locator('#appearance-open').tap(); await page.locator('[data-palette=ink]').tap(); await page.locator('[data-card-back=diamonds]').tap(); await page.locator('[data-deck-side=left]').tap(); await page.locator('#appearance .primary').tap();
  await page.locator('#home-play').tap(); const deal = campaignDeals[2];
  for (const cmd of deal.winningPath.slice(0, 6)) await move(page, deal, cmd);
  await page.screenshot({path:`test-results/${test.info().project.name}-ink-left-deck.png`});
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready','true'); await expect(page.locator('#app')).toHaveAttribute('data-back','diamonds'); expect((await read(page)).settings.deckSide).toBe('left');
});
