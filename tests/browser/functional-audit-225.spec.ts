import { expect, test } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { assertBoard, legalCommands } from '../../src/domain/engine';
import { restoreQuote } from '../../src/domain/campaign-recovery';
import type { BoardCommand } from '../../src/domain/types';
import { play, profileAt } from '../fixtures/functional-audit-225';
import paths from '../fixtures/functional-audit-225-stuck.json' with { type: 'json' };
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary release profile');

for (const [id, path] of Object.entries(paths)) {
  const deal = findDeal(id)!;
  test(`FA-05 L${deal.campaignLevel} offers a deliberate restart for the stuck board`, async ({ page }) => {
    const save = play(profileAt(deal), deal, path as BoardCommand[]);
    expect(save.attempt.board).toMatchObject({ phase: 'playing', stock: [], waste: [], movesLeft: deal.campaignLevel === 39 ? 4 : 19 });
    expect(legalCommands(save.attempt.board, deal)).toEqual([]);
    expect(restoreQuote(save.attempt, deal)).toBeUndefined();
    Object.assign(save.profile, { hints: 0, undos: 0, coins: 0, jokers: 0 });
    save.campaignLives = { version: 2, remaining: 5, observedAt: Date.now(), earnedCredits: 0 };
    await page.addInitScript(value => {
      const key = 'asoc-solitaire.save.v1';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    }, save);
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.locator('#home-play').tap();
    const notice = page.locator('#dead-end');
    await expect(notice).toContainText('Нет доступных ходов');
    await expect(notice).toBeVisible();
    const before = await read(page);
    expect(before.attempt.board).toEqual(save.attempt.board);
    expect(before.campaignLives?.remaining).toBe(5);
    await expect(notice.locator('#dead-end-undo')).toBeHidden();
    await expect(notice.locator('#dead-end-joker')).toBeHidden();
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
    await expect(notice).toBeVisible();
    await notice.locator('#dead-end-restart').tap();
    await expect(page.locator('#restart-confirm')).toBeVisible();
    await expect(notice).toBeHidden();
    await page.locator('#restart-confirm [data-close]').tap();
    await expect(notice).toBeVisible();
    expect((await read(page)).campaignLives?.remaining).toBe(5);
    await notice.locator('#dead-end-restart').tap();
    await page.locator('#restart-confirm-yes').tap();
    await expect.poll(async () => (await read(page)).attempt.id).not.toBe(before.attempt.id);
    await expect(notice).toBeHidden();
    expect((await read(page)).campaignLives?.remaining).toBe(5);
  });
}


test('FA-05 offers an available Undo on a stuck Daily snapshot and never spends a campaign life', async ({ page }) => {
  const date = '2026-11-27', daily = dailyForDay(date);
  await page.clock.install({ time: new Date(date + 'T12:00:00') });
  const base = findDeal(Object.keys(paths)[0])!, save = profileAt(base);
  save.campaignLives = { version: 2, remaining: 0, observedAt: new Date(date + 'T12:00:00').getTime(),
    refillAt: new Date(date + 'T12:30:00').getTime(), earnedCredits: 0 };
  const game = profileAt(daily, 'stuck-daily').attempt, board = game.board;
  const words = new Map(Object.values(daily.cards).filter(card => !card.leader).map(card => [card.category, card.id]));
  const exposed = [...words.values()].slice(0, board.tableau.length);
  expect(exposed).toHaveLength(board.tableau.length);
  // Model a valid persisted no-move Daily board. These positions are not a claimed player route.
  game.undo.push(structuredClone(board));
  const covered = Object.keys(daily.cards).filter(id => !exposed.includes(id));
  board.tableau = exposed.map((id, index) => index === 0 ? [...covered, id] : [id]);
  board.stock = []; board.waste = []; board.faceUp = exposed;
  assertBoard(board, daily);
  expect(legalCommands(board, daily)).toEqual([]);
  save.parked = { daily: game };
  save.profile.undos = 1;
  await page.addInitScript(value => {
    localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, save);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#daily-play').tap();
  const notice = page.locator('#dead-end');
  await expect(notice).toBeVisible();
  await expect(notice.locator('#dead-end-undo')).toBeVisible();
  await page.locator('#menu').tap();
  await expect(notice).toBeHidden();
  await page.locator('#settings-done').tap();
  await expect(notice).toBeVisible();
  await notice.locator('#dead-end-undo').tap();
  await expect(notice).toBeHidden();
  const restored = await read(page);
  expect(restored.attempt.board).toEqual(daily.initial);
  expect(restored.profile.undos).toBe(0);
  expect(restored.campaignLives?.remaining).toBe(0);
});
