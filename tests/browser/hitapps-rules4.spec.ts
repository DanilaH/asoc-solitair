import { extendedRecords } from '../../src/content/campaign-meta-bank';
import { expect, test, type Page } from '@playwright/test';
import { campaignDeals, findDeal, hitappsR4Deals } from '../../src/content/campaign';
import { dispatch, freshSave, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary C8 release profile');
const fixtureBuild = process.env.VITE_HITAPPS_FIXTURES === '1';

function profile(deal: Deal, id: string) {
  const save = freshSave(deal, id);
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:ordered', 'intro:keys', 'intro:joker'] };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: 32 }, (_, index) => campaignId(index + 1)) };
  return save;
}
async function launch(page: Page, save: Save, route = '/') {
  await page.addInitScript(value => {
    if (!localStorage.getItem('asoc-solitaire.save.v1')) localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value));
  }, save);
  await page.goto(route);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
}

async function touch(page: Page, deal: Deal, command: BoardCommand) {
  const save = await read(page), { board } = save.attempt;
  const game = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(game.width, game.height, save.settings.deckPosition, deal);
  const tiles = layout(board, deal, frame, save.settings.deckSide, save.settings.deckPosition);
  const tap = ({ x, y }: {x:number;y:number}) => page.touchscreen.tap(game.x + frame.offsetX + x * frame.unit, game.y + y * frame.unit);
  if (command.type !== 'transfer') await tap(tiles.stock);
  else {
    const ids = sourceCards(board, command.from, deal, command.root), id = ids[0];
    const origin = tiles.poses.find(tile => tile.id === id)!;
    const next = tiles.poses.find(tile => tile.id === ids[1]);
    const point = next && next.y > origin.y ? { x: origin.x, y: origin.y - 83 + (next.y - origin.y) / 2 } : origin;
    await tap(point);
    await tap(tiles.targets.find(tile => tile.location.kind === command.to.kind && tile.location.index === command.to.index)!);
  }
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(board.movesLeft! - 1);
}

test('a signed-candidate deal restores the same layout and Undo across reload', async ({ page }, info) => {
  const entry = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 &&
    row.deal.campaignLevel === 23 && row.deal.winningPath[0].type === 'draw') ??
    [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.winningPath[0].type === 'draw')!;
  const { deal } = entry;
  const save = profile(deal, 'hitapps-r4-restore-touch');
  await launch(page, save);
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  await page.waitForTimeout(350);
  await touch(page, deal, deal.winningPath[0]);
  const moved = (await read(page)).attempt;
  expect(moved.board.rulesVersion).toBe(4);
  expect(moved.board.hitapps?.move).toBe(1);
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect((await read(page)).attempt.board).toEqual(moved.board);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(save.attempt.board);
  await page.screenshot({ path: info.outputPath('hitapps-r4-board.png'), scale: 'css' });
});

test('the candidate picker issues a certified special board through the campaign SaveStore', async ({ page }, info) => {
  test.skip(!fixtureBuild, 'Requires the separate fixture web build');
  const base = campaignDeals.find(deal => deal.campaignLevel === 18)!;
  await launch(page, profile(base, 'hitapps-old-rule-save'));
  await page.locator('#level-picker-open').tap();
  const fixture = page.locator('#source-deal-list').getByRole('button', { name: '18 · Замок и ключи' }).first();
  await expect(fixture).toBeEnabled();
  await fixture.tap();
  await expect.poll(async () => (await read(page)).attempt.board.rulesVersion).toBe(4);
  const after = (await read(page)).attempt;
  expect(after.issuance).toMatchObject({ policy: 'hitapps-r4-bank-v1', dealId: after.dealId, source: 'certified-seed' });
  expect(Object.values(after.board.hitapps!.cards).some(card => card.lock?.type === 1)).toBe(true);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', after.dealId);
  await page.screenshot({ path: info.outputPath('hitapps-r4-locker.png'), scale: 'css' });
});

test('the Rules4 retry replaces geometry and settles one life with the new passport', async ({ page }) => {
  const { deal } = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 23)!;
  const save = profile(deal, 'hitapps-r4-exhausted-touch');
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  await launch(page, save);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#replay').tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).not.toBe(deal.id);
  const after = await read(page);
  expect(after.attempt.board.rulesVersion).toBe(4);
  expect([after.attempt.board.tableau, after.attempt.board.stock, after.attempt.board.faceUp])
    .not.toEqual([deal.initial.tableau, deal.initial.stock, deal.initial.faceUp]);
  expect(after.attempt.issuance?.dealId).toBe(after.attempt.dealId);
  expect(after.campaignLives?.remaining).toBe(4);
});

test('an ordinary L66 retry changes the layout and preserves the three-key lock', async ({ page }) => {
  const { deal } = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 66)!;
  const save = profile(deal, 'hitapps-r4-lock-retry-touch');
  save.platform!.completedCampaign = Array.from({ length: 65 }, (_, index) => campaignId(index + 1));
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  await launch(page, save);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#replay').tap();
  await expect.poll(async () => (await read(page)).attempt.dealId).not.toBe(deal.id);
  const after = await read(page);
  expect(after.attempt.board.rulesVersion).toBe(4);
  expect([after.attempt.board.tableau, after.attempt.board.stock]).not.toEqual([deal.initial.tableau, deal.initial.stock]);
  const states = Object.values(after.attempt.board.hitapps!.cards);
  expect(states.filter(card => card.lock).map(card => card.lock?.required)).toEqual([3]);
  expect(states.filter(card => card.key)).toHaveLength(3);
  expect(after.attempt.issuance?.dealId).toBe(after.attempt.dealId);
  expect(after.campaignLives?.remaining).toBe(4);
});

test('Next from the archived L65 issues Rules4 L66 through the normal campaign route', async ({ page }) => {
  const previous = findDeal('campaign-c8-wave-065')!;
  let save = profile(previous, 'hitapps-r4-next-66');
  save.platform!.completedCampaign = Array.from({ length: 64 }, (_, index) => campaignId(index + 1));
  for (const action of previous.winningPath) {
    const step = dispatch(save, action, previous);
    expect(step.accepted).toBe(true);
    save = step.next;
  }
  expect(save.attempt.board.phase).toBe('won');
  await launch(page, save);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await page.locator('#next-level').tap();
  if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  await expect.poll(async () => (await read(page)).attempt.issuance?.baseId).toBe('campaign-c8-special-066');
  const after = (await read(page)).attempt;
  expect(after.board.rulesVersion).toBe(4);
  expect(Object.values(after.board.hitapps!.cards).filter(card => card.key)).toHaveLength(3);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', after.dealId);
});

test('a URL cannot enable fixture controls in the release build', async ({ page }) => {
  test.skip(fixtureBuild, 'Requires the ordinary release build');
  const { deal } = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 23)!;
  const save = profile(deal, 'hitapps-production-query');
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  await launch(page, save, '/?qa-levels=1');
  const manifest = await page.request.get('/release-manifest.json');
  expect(await manifest.json()).toMatchObject({ fixtureNavigation: false, campaignBoardRulesVersion: 4 });
  await expect(page.locator('#level-picker-open')).toBeHidden();
  await expect(page.locator('#source-deal-list button')).toHaveCount(0);
  await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result-redeal')).toBeHidden();
  await expect(page.locator('#replay')).toBeVisible();
});

test('the finished campaign keeps Daily accessible and never opens the level picker', async ({ page }, info) => {
  test.skip(fixtureBuild, 'Requires the ordinary release build');
  const archived = process.env.VITE_ASOC_ARCHIVE_227 === '1' || process.env.VITE_ASOC_ARCHIVE_229 === '1' ||
    process.env.VITE_ASOC_ARCHIVE_230 === '1';
  const deal = archived ? [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 80)!.deal
    : findDeal(extendedRecords(200)[0].deal.id + '-core-stage1-v1-m1')!;
  let save = profile(deal, 'hitapps-production-completed');
  save.platform!.completedCampaign = Array.from({ length: deal.campaignLevel! - 1 }, (_, index) => campaignId(index + 1));
  for (const action of deal.winningPath) {
    const step = dispatch(save, action, deal);
    expect(step.accepted).toBe(true);
    save = step.next;
  }
  expect(save.attempt.board.phase).toBe('won');
  await launch(page, save);
  await page.locator('#home-play').tap();
  const next = page.locator('#next-level');
  await expect(next).toBeVisible();
  await next.tap();
  if (await next.isVisible()) await next.tap();
  const home = page.locator('#home-play');
  await expect(home).toContainText('Кампания пройдена');
  await expect(home).toBeDisabled();
  await expect(page.locator('#daily-play')).toBeVisible();
  await expect(page.locator('#level-picker')).toBeHidden();
  await expect(page.locator('#level-picker-open')).toBeHidden();
  await expect(page.locator('#level-grid button')).toHaveCount(0);
  expect((await read(page)).attempt.id).toBe(save.attempt.id);
  await page.screenshot({ path: info.outputPath('completed-campaign.png'), scale: 'css' });
});

test('the exact replay still keeps the same Rules4 layout and only charges one life', async ({ page }) => {
  test.skip(!fixtureBuild, 'Requires the separate fixture web build');
  const { deal } = [...hitappsR4Deals()].find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === 31)!;
  const save = profile(deal, 'hitapps-r4-exact-replay-touch');
  save.attempt.board.phase = 'exhausted';
  save.attempt.board.movesLeft = 0;
  await launch(page, save);
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#result-redeal').tap();
  await expect.poll(async () => (await read(page)).attempt.id).not.toBe(save.attempt.id);
  const after = await read(page);
  expect(after.attempt.dealId).toBe(deal.id);
  expect(after.attempt.board).toEqual(deal.initial);
  expect(after.campaignLives?.remaining).toBe(4);
});
