import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, sourceCards } from '../../src/domain/engine';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import { fixture, move, read, seed } from './wallet-fixture';

if (process.env.ASOC_CAPTURE_COMPARISON === '1') test.use({ video: 'on' });
const comparisonBaseline = process.env.ASOC_COMPARISON_BASELINE === '1';

async function transferPoints(page: Page, deal: Deal, cmd: Extract<BoardCommand, {type: 'transfer'}>, save: Save) {
  const box = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(box.width, box.height, save.settings.deckPosition, deal);
  const board = layout(save.attempt.board, deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
  const point = (p: {x: number; y: number}) => ({ x: box.x + frame.offsetX + p.x * frame.unit, y: box.y + p.y * frame.unit });
  const from = sourceCards(save.attempt.board, cmd.from, deal).at(-1);
  return {
    source: point(board.poses.find(p => p.id === from)!),
    target: point(board.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!),
  };
}

test('Next lets the first settled column move while neighboring columns are dealing', async ({ page }) => {
  const first = campaignDeals[0], second = campaignDeals[1];
  await seed(page, fixture(0, true));
  await move(page, first, first.winningPath.at(-1)!);
  await expect(page.locator('#result')).toBeVisible();
  const command = second.winningPath[0];
  if (command.type !== 'transfer') throw Error('C7-002 starts with a transfer');
  const opening = fixture(1), expected = dispatch(opening, command, second).next.attempt.board;
  if (!comparisonBaseline) {
    const { source, target } = await transferPoints(page, second, command, opening);
    await page.exposeBinding('__playDealtColumn', async () => {
      await page.touchscreen.tap(source.x, source.y);
      await page.touchscreen.tap(target.x, target.y);
    });
    await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>('#game-root')!;
      const w = window as unknown as { __playDealtColumn(): Promise<void>; __earlyPress?: number };
      const observer = new MutationObserver(() => {
        const remaining = Number(board.dataset.dealing);
        if (remaining !== 4) return;
        observer.disconnect();
        board.addEventListener('pointerdown', () => { w.__earlyPress = Number(board.dataset.dealing); }, { once: true });
        void w.__playDealtColumn();
      });
      observer.observe(board, { attributes: true, attributeFilter: ['data-dealing'] });
    });
  }
  await page.locator('#next-level').tap();
  if (comparisonBaseline) {
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', second.id);
    await page.waitForTimeout(450);
    await move(page, second, command);
  }
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected);
  if (!comparisonBaseline) {
    const atPress = await page.evaluate(() => (window as unknown as {__earlyPress?: number}).__earlyPress);
    expect(atPress).toBeGreaterThan(0);
    await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  }
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', second.id);
});

test('normal victory waits for the settled category and opens without an idle delay', async ({ page }) => {
  const win = campaignDeals.map((deal, index) => {
    const save = fixture(index, true), command = deal.winningPath.at(-1)!;
    const result = dispatch(save, command, deal);
    return { save, deal, command, result };
  }).find(({result}) => result.events.some(e => e.type === 'win') && !result.events.some(e => e.type === 'coins'))!;
  await page.addInitScript(() => {
    const trace: {commit?: number; result?: number} = {};
    Object.defineProperty(window, '__winMotionTrace', { value: trace });
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      write.call(this, key, value);
      if (key === 'asoc-solitaire.save.v1' && JSON.parse(value).attempt.board.phase === 'won') trace.commit ??= performance.now();
    };
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'result') trace.result ??= performance.now();
      return show.call(this);
    };
  });
  await seed(page, win.save);
  await move(page, win.deal, win.command);
  await expect(page.locator('#result')).toBeVisible();
  const elapsed = await page.evaluate(() => {
    const {commit, result} = (window as unknown as {__winMotionTrace: {commit: number; result: number}}).__winMotionTrace;
    return result - commit;
  });
  console.info('Normal result after durable win (ms)', Math.round(elapsed));
  if (!comparisonBaseline) {
    expect(elapsed).toBeGreaterThan(240);
    expect(elapsed).toBeLessThan(820);
  }
  expect((await read(page)).profile.coins).toBe(win.result.next.profile.coins);
});

for (const [index, name, matches] of [
  [48, 'a source flip on C7-049', (result: ReturnType<typeof dispatch>) => result.events.some(e => e.type === 'flip')],
  [75, 'a large transfer on C7-076', (result: ReturnType<typeof dispatch>) => result.events.some(e => e.type === 'transfer' && (e.cards?.length ?? 0) >= 3)],
] as const) {
  test(`${name} keeps the exact model board after motion and Undo`, async ({ page }) => {
    const deal = campaignDeals[index];
    let save = fixture(index);
    const step = deal.winningPath.find(command => {
      const result = dispatch(save, command, deal);
      if (matches(result)) return true;
      save = result.next;
      return false;
    });
    if (!step) throw Error('No witness for ' + name);
    await seed(page, save);
    const before = await read(page), expected = dispatch(before, step, deal).next.attempt.board;
    await move(page, deal, step);
    await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected);
    await page.waitForTimeout(400);
    const accepted = await read(page);
    await page.locator('#undo').tap();
    await expect.poll(async () => (await read(page)).attempt.board).toEqual(dispatch(accepted, { type: 'undo' }, deal).next.attempt.board);
  });
}
