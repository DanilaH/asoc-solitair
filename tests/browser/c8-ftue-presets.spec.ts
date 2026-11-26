import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { lessonMarker, releaseLessonSteps } from '../../src/app/c8-tutorial';
import { findDeal } from '../../src/content/campaign';
import { c8TeachingPresets } from '../../src/content/campaign-v8-ftue';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { content8Special } from '../../src/content/campaign-v8-special';
import { coreSpecialDeals } from '../../src/content/campaign-v8-integrated-specials';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { applyBoard, dispatch, freshSave, placeJoker } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import { move, read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Exercises ordinary C8 release issuance and touch');
if (process.env.ASOC_FTUE_RECORD === '1') test.use({ video: 'on' });

async function proofCapture(page: Page, info: TestInfo, name: string) {
  if (process.env.ASOC_FTUE_RECORD === '1') await page.screenshot({ path: info.outputPath(name + '.png'), scale: 'css' });
}

const previousC8 = [...c8TeachingPresets.map(preset => preset.deal), ...coreSpecialDeals, ...content8Special,
  ...content8BonusDeals, ...content8Dealer, ...content8Wave, ...content8Late];

/** Replay a published previous C8 Deal to victory. No target board, Deal ID or cursor injected. */
async function enter(page: Page, level: number, opts: { zeroUndo?: boolean; reduced?: boolean } = {}) {
  if (level > 1) {
    const previous = previousC8.find(deal => deal.campaignLevel === level - 1)!;
    let save = freshSave(previous, `previous-victory-${level - 1}`);
    save.contentVersion = 8;
    save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
      winsSinceInterstitial: 0, completedCampaign: Array.from({ length: level - 2 }, (_, i) => campaignId(i + 1)) };
    if (level === 26) save.campaign = { version: 1, tutorials: ['intro:keys', 'learn:keys', lessonMarker('three-key-use')] };
    for (const action of previous.winningPath) {
      const result = dispatch(save, action, previous);
      if (!result.accepted) throw Error(result.reason);
      save = result.next;
    }
    if (opts.zeroUndo) save.profile.undos = 0;
    await page.addInitScript(value => {
      const key = 'asoc-solitaire.save.v1';
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    }, save);
  }
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  if (level > 1) {
    await page.locator('#home-play').tap();
    await expect(page.locator('#result')).toBeVisible();
    await page.locator('#next-level').tap();
    if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  }
  await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ ' + level);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
}

async function closeRule(page: Page) {
  if (await page.locator('#learn-rule').isVisible()) await page.locator('#learn-rule .primary').tap();
}

async function touchMove(page: Page, deal: Deal, action: BoardCommand) {
  const before = (await read(page)).attempt.board;
  const expected = applyBoard(before, action, deal);
  if (typeof expected === 'string') throw Error(expected);
  await move(page, deal, action);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
}

async function targetJoker(page: Page, deal: Deal, column: number) {
  const save = await read(page), rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, save.settings.deckPosition, deal);
  const target = layout(save.attempt.board, deal, frame, save.settings.deckSide, save.settings.deckPosition)
    .targets.find(target => target.location.kind === 'tableau' && target.location.index === column)!;
  await page.touchscreen.tap(rect.x + frame.offsetX + target.x * frame.unit, rect.y + target.y * frame.unit);
}

const retained = [
  'campaign-c8-dealer-001', 'campaign-c8-dealer-002', 'campaign-c8-special-018',
  'campaign-c8-special-026-core-special-r1', 'campaign-c8-wave-027-core-special-r1',
].map(id => findDeal(id)!);
for (const deal of [...c8TeachingPresets.map(preset => preset.deal), ...retained]) {
  test(`L${deal.campaignLevel} ordinary issuance • ${deal.id} • complete lesson and independent move`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize(info.project.name === 'compact' ? { width: 320, height: 480 } : { width: 360, height: 640 });
    await enter(page, deal.campaignLevel!);
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
    const start = await read(page);
    expect(start.attempt.board).toEqual(deal.initial);
    if (deal.campaignLevel! > 1) expect(start.attempt.issuance?.dealId).toBe(deal.id);
    await proofCapture(page, info, '00-start');
    await closeRule(page);

    const guide = releaseLessonSteps(deal);
    for (const [index, step] of guide.entries()) {
      const label = `${String(index + 1).padStart(2, '0')}-${step.marker ?? step.command.type}`;
      const copy = page.locator('#lesson-copy');
      await expect(copy).toHaveText(step.copy);
      const instructionFits = await copy.evaluate(p => p.getBoundingClientRect().bottom <= p.parentElement!.getBoundingClientRect().bottom);
      expect(instructionFits).toBe(true);
      await proofCapture(page, info, label);
      if (step.command.type === 'place-joker') {
        const expected = placeJoker((await read(page)).attempt.board, step.command.column, deal) as Board;
        await page.locator('#joker').tap();
        await expect(page.locator('#joker')).toHaveAttribute('aria-pressed', 'true');
        await proofCapture(page, info, label + '-column');
        await targetJoker(page, deal, step.command.column);
        await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected);
      } else {
        if (step.command.type === 'restart' || step.command.type === 'undo' || step.command.type === 'hint') throw Error('Unexpected authored action');
        await expect(page.locator('#lesson-note')).toHaveAttribute('data-action', step.command.type);
        await touchMove(page, deal, step.command);
      }
      if (step.marker) expect((await read(page)).campaign?.tutorials).toContain(lessonMarker(step.marker));
    }
    await proofCapture(page, info, '90-lesson-completed');
    const suffix = deal.campaignLevel === 26
      ? [...deal.winningPath.slice(1, 3), ...deal.winningPath.slice(4)]
      : (deal.tutorialPath ?? deal.winningPath).slice(guide.length);
    const firstMoves = [1, 27].includes(deal.campaignLevel!) ? suffix : suffix.slice(0, 2);
    for (const action of firstMoves) {
      if (action.type === 'restart' || action.type === 'undo' || action.type === 'hint' || action.type === 'place-joker') throw Error('Unexpected suffix');
      await touchMove(page, deal, action);
      // This part is deliberately unguided. Let the painted surface settle
      // before using a newly drawn/revealed card at its final hit point.
      await page.waitForTimeout(action.type === 'transfer' ? 245 : 390);
    }
    if (deal.campaignLevel === 27) {
      await expect(page.locator('#result')).toBeVisible();
      const won = await read(page);
      expect(won.attempt.payout?.filter(item => item.reason === 'golden_cards')).toHaveLength(1);
      await proofCapture(page, info, '99-golden-payout');
      await page.reload();
      await page.locator('#home-play').tap();
      await expect(page.locator('#result')).toBeVisible();
      expect((await read(page)).profile.coins).toBe(won.profile.coins);
    } else {
      await proofCapture(page, info, '99-playing-independently');
    }
  });
}

test('first Hint guides an independently performed move through a reload', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'compact' ? { width: 320, height: 480 } : { width: 360, height: 640 });
  await enter(page, 3);
  const before = await read(page), deal = findDeal(before.attempt.dealId)!;
  await expect(page.locator('#hint')).toHaveClass(/attention/);
  await proofCapture(page, info, '01-hint-available');
  await page.locator('#hint').tap();
  await expect.poll(async () => (await read(page)).attempt.lessonHint).toBeDefined();
  const guided = await read(page);
  expect(guided.profile.hints).toBe(before.profile.hints);
  expect(guided.attempt.board).toEqual(before.attempt.board);
  await expect(page.locator('#lesson-note')).toBeVisible();
  await proofCapture(page, info, '02-hint-demonstrated');
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#lesson-note')).toBeVisible();
  await touchMove(page, deal, guided.attempt.lessonHint!);
  expect((await read(page)).campaign?.tutorials).toContain('hint-practiced');
  await proofCapture(page, info, '03-hint-practised');
});

test('first Undo visibly returns the opening move and allows a repeat with zero stock', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'compact' ? { width: 320, height: 480 } : { width: 360, height: 640 });
  await enter(page, 4, { zeroUndo: true, reduced: info.project.name === 'compact' });
  const before = await read(page), deal = findDeal(before.attempt.dealId)!;
  await expect(page.locator('#lesson-note')).toBeVisible();
  await touchMove(page, deal, deal.winningPath[0]);
  await expect(page.locator('#undo')).toHaveClass(/attention/);
  await proofCapture(page, info, '01-undo-available');
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
  await expect(page.locator('#lesson-copy')).toContainText('Карта вернулась.');
  await proofCapture(page, info, '02-returned-card');
  await page.reload();
  await page.locator('#home-play').tap();
  await touchMove(page, deal, deal.winningPath[0]);
  const after = await read(page);
  expect(after.profile.undos).toBe(0);
  expect(after.campaign?.tutorials).toContain(lessonMarker('undo-repeated'));
  await proofCapture(page, info, '03-repeated-move');
});

test('Joker selection cancels freely, accepts another column and leaves playable input after Undo', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await enter(page, 8, { reduced: true });
  const deal = findDeal('campaign-c8-ftue-008-r1')!;
  await closeRule(page);
  const start = await read(page);
  await page.locator('#joker').tap();
  await expect(page.locator('#joker')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#joker').tap();
  expect((await read(page)).profile.jokers).toBe(start.profile.jokers);
  await page.locator('#joker').tap();
  await targetJoker(page, deal, 1);
  await expect.poll(async () => (await read(page)).attempt.board.joker?.column).toBe(1);
  const placed = await read(page);
  expect(placed.profile.jokers).toBe(Math.max(0, start.profile.jokers - 1));
  expect(placed.campaign?.tutorials).not.toContain(lessonMarker('wildcard'));
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(start.attempt.board);
  expect((await read(page)).profile.jokers).toBe(placed.profile.jokers);
  await expect(page.locator('#joker')).toBeDisabled();
  await touchMove(page, deal, deal.winningPath[0]);
  await proofCapture(page, info, 'alternate-column-undo-continued');
});

test('blocked ice does not count and the second layer resumes after reload and resize', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await enter(page, 19, { reduced: true });
  const deal = findDeal('campaign-c8-ftue-019-r1')!;
  const start = await read(page), rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, start.settings.deckPosition, deal);
  const ice = layout(start.attempt.board, deal, frame, start.settings.deckSide, start.settings.deckPosition)
    .poses.find(pose => pose.id === 'air_1')!;
  await page.touchscreen.tap(rect.x + frame.offsetX + ice.x * frame.unit, rect.y + ice.y * frame.unit);
  expect((await read(page)).attempt.board).toEqual(start.attempt.board);
  expect((await read(page)).campaign?.tutorials ?? []).not.toContain(lessonMarker('ice-use'));
  for (const action of deal.winningPath.slice(0, 2)) {
    await expect(page.locator('#lesson-note')).toHaveAttribute('data-action', action.type);
    await touchMove(page, deal, action);
  }
  const first = await read(page);
  expect(first.campaign?.tutorials).toContain(lessonMarker('ice-first'));
  expect(first.campaign?.tutorials).not.toContain(lessonMarker('ice-last'));
  await page.setViewportSize({ width: 320, height: 480 });
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#lesson-copy')).toContainText('Остался один слой.');
  expect((await read(page)).attempt.board).toEqual(first.attempt.board);
  await proofCapture(page, info, 'reloaded-second-layer');
  for (const action of deal.winningPath.slice(2, 6)) {
    await expect(page.locator('#lesson-note')).toHaveAttribute('data-action', action.type);
    await touchMove(page, deal, action);
  }
  expect((await read(page)).campaign?.tutorials).toContain(lessonMarker('ice-use'));
});

test('ordinary L30 prepares a fixed proved Shuffle, charges only after confirmation and resumes', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'compact' ? { width: 320, height: 480 } : { width: 360, height: 640 });
  await enter(page, 30);
  await expect(page.locator('#proof-shuffle')).toBeEnabled();
  const before = await read(page);
  expect(before.attempt.issuance?.dealId).toBe(before.attempt.dealId);
  expect(before.dailyTasks?.inventory.shuffles).toBeGreaterThan(0);
  await proofCapture(page, info, '01-before-shuffle');
  await page.locator('#proof-shuffle').tap();
  await expect(page.locator('#shuffle-warning')).toBeVisible();
  expect((await read(page)).dailyTasks?.inventory.shuffles).toBe(before.dailyTasks?.inventory.shuffles);
  await proofCapture(page, info, '02-shuffle-cost');
  await page.locator('#shuffle-confirm').tap();
  await expect.poll(async () => (await read(page)).attempt.shuffleUsed).toBe(true);
  const after = await read(page);
  expect(after.attempt.board).not.toEqual(before.attempt.board);
  expect(after.attempt.board.faceUp).toEqual(before.attempt.board.faceUp);
  expect(after.dailyTasks!.inventory.shuffles).toBe(before.dailyTasks!.inventory.shuffles - 1);
  expect(after.campaign?.tutorials).toContain(lessonMarker('shuffle-used'));
  await proofCapture(page, info, '03-shuffle-committed');
  await page.reload();
  await page.locator('#home-play').tap();
  await expect(page.locator('#proof-shuffle')).toBeDisabled();
  expect((await read(page)).attempt.board).toEqual(after.attempt.board);
});
