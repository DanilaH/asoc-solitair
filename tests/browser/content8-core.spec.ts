import { expect, test, type Page } from '@playwright/test';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { content8Special } from '../../src/content/campaign-v8-special';
import { content8FrozenDeal } from '../../src/content/campaign-v8-frozen';
import { content8BoundDeal } from '../../src/content/campaign-v8-bound';
import { content8PuzzleDeal } from '../../src/content/campaign-v8-puzzle';
import { content8GoldenDeal } from '../../src/content/campaign-v8-golden';
import { content8StarterDeal } from '../../src/content/campaign-v8-starter';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { content8DirectorDeals } from '../../src/content/campaign-v8-director';
import { applyBoard, freshSave, legalCommands, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { BALANCE } from '../../src/domain/balance';
import type { EarnedReceipt } from '../../src/domain/services';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';
import type { AdOutcome, AdRequest } from '../../src/platform/ads';
import { recoverable, unrecoverable, loadLoss, winningRescue } from '../fixtures/content8-loss';

test.skip(process.env.VITE_CONTENT8_PREVIEW !== '1', 'Requires the Content 8 preview build.');

const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);

async function openGame(page: Page, deal: Deal) {
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  // Reserve the same 60 CSS pixels as the native banner without injecting ads.
  await page.locator('#app').evaluate(e => { e.style.height = 'calc(100dvh - 60px)'; });
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
}

async function touch(page: Page, deal: Deal, action: BoardCommand) {
  const { attempt: { board }, settings } = await read(page);
  const rect = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(rect.width, rect.height, settings.deckPosition, deal);
  const geometry = layout(board, deal, frame.height, settings.deckSide, settings.deckPosition);
  const tap = (point: { x: number; y: number }) =>
    page.touchscreen.tap(rect.x + frame.offsetX + point.x * frame.unit, rect.y + point.y * frame.unit);
  if (action.type !== 'transfer') return tap(geometry.stock);
  const id = sourceCards(board, action.from, deal).at(-1);
  await tap(geometry.poses.find(p => p.id === id)!);
  await tap(geometry.targets.find(t => t.location.kind === action.to.kind && t.location.index === action.to.index)!);
}

async function expectLegibleLesson(page: Page) {
  const copy = page.locator('#lesson-copy');
  await expect(copy).toBeVisible();
  await expect(copy).toHaveCSS('font-size', '18px');
  expect(await copy.evaluate(e => {
    const text = e.getBoundingClientRect(), panel = e.parentElement!.getBoundingClientRect();
    return text.top >= panel.top && text.bottom <= panel.bottom && panel.bottom <= innerHeight;
  })).toBe(true);
}

test('a fresh campaign start persists its chosen variant and exact budget through a relaunch', async ({ page }) => {
  const previous = content8Dealer[9], base = content8Dealer[10];
  const selected = content8DirectorDeals.find(deal => deal.id === base.id + '-tight-r1')!;
  const save = freshSave(previous, 'core2-won-level-10');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  let board = previous.initial;
  for (const action of previous.winningPath) {
    const result = applyBoard(board, action, previous);
    if (typeof result === 'string') throw Error(result);
    board = result.board;
  }
  save.attempt.board = board;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 10 }, (_, i) => campaignId(i + 1)) };
  save.difficultyHistory = Array.from({ length: 10 }, () => ({ outcome: 'Clean', restarts: 0 }));
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: 'asoc-solitaire.save.v1', value: JSON.stringify(save) });
  await page.goto('/');
  await openGame(page, previous);
  await page.locator('#next-level').tap();
  await page.locator('#difficulty-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', selected.id);
  const starting = await read(page);
  expect(starting.attempt.board).toEqual(selected.initial);
  expect(starting.attempt.board.movesLeft).toBe(160);
  await touch(page, selected, { type: 'draw' });
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(159);
  const afterDraw = (await read(page)).attempt;
  await page.reload();
  await openGame(page, selected);
  const restored = (await read(page)).attempt;
  expect(restored.id).toBe(afterDraw.id);
  expect(restored.board).toEqual(afterDraw.board);
  expect(restored.undo).toEqual(afterDraw.undo);
  await page.locator('#menu').tap();
  await page.locator('#levels-open').tap();
  await page.locator('#level-picker-open').tap();
  await page.locator('#level-11').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#switch-level')).toBeHidden();
  expect((await read(page)).attempt.id).toBe(afterDraw.id);
});

test('starting the exhausted level again from Home uses the certified relief deal after three losses', async ({ page }) => {
  const base = content8Dealer[11];
  const relief = content8DirectorDeals.find(deal => deal.id === base.id + '-relief-r1')!;
  const save = freshSave(base, 'core2-third-loss');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.attempt.board.movesLeft = 1;
  const exhausted = applyBoard(save.attempt.board, { type: 'draw' }, base);
  if (typeof exhausted === 'string') throw Error(exhausted);
  save.attempt.board = exhausted.board;
  save.attempt.director = { restarts: 2, previousLosses: 2, exhausted: true };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 11 }, (_, i) => campaignId(i + 1)) };
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: 'asoc-solitaire.save.v1', value: JSON.stringify(save) });
  await page.goto('/');
  await openGame(page, base);
  await page.locator('#result-home').tap();
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', relief.id);
  const issued = (await read(page)).attempt;
  expect(issued.id).not.toBe(save.attempt.id);
  expect(issued.board).toEqual(relief.initial);
  expect(issued.director).toEqual({ restarts: 3, previousLosses: 3 });
});

async function loadWaveFixture(page: Page, save: Save, completed: number, continueCredits = 0) {
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: completed }, (_, i) => campaignId(i + 1)) };
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: 'asoc-solitaire.save.v1', value: JSON.stringify(save) });
  await page.goto('/');
}

interface AdTestControls {
  requests: AdRequest[];
  acknowledged: string[];
  active(isActive: boolean): void;
  finish(outcome: AdOutcome): void;
  earn(receipt: EarnedReceipt): void;
}

async function installNativeAdTestBridge(page: Page) {
  await page.addInitScript(() => {
    const listeners = new Map<string, (event: object) => void>();
    const requests: AdRequest[] = [];
    const acknowledged: string[] = [];
    const receipts: EarnedReceipt[] = [];
    let finish: (outcome: AdOutcome) => void;
    const controls: AdTestControls = {
      requests, acknowledged,
      active: isActive => listeners.get('App.appStateChange')?.({ isActive }),
      finish: outcome => finish(outcome),
      earn(receipt) {
        receipts.push(receipt);
        listeners.get('SolitaireAds.adEvent')?.({ kind: 'rewarded', phase: 'earned' });
      },
    };
    const methods = (name: string, promises: string[], events = false) => ({
      name, methods: [
        ...promises.map(name => ({ name, rtype: 'promise' })),
        ...events ? [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'callback' }] : [],
      ],
    });
    Object.assign(window, {
      adTestControls: controls, androidBridge: {},
      Capacitor: {
        PluginHeaders: [
          methods('App', ['getState'], true), methods('SolitaireStorage', ['get', 'set', 'remove']),
          methods('SolitaireAds', ['status', 'show', 'pending', 'acknowledge', 'hideBanner', 'dispose'], true),
          methods('SolitaireAudio', ['configure'], true), methods('SolitaireFeedback', ['configure', 'pulse']),
        ],
        async nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (event: object) => void) {
          const id = `${plugin}.${options.eventName}`;
          if (method === 'addListener') listeners.set(id, callback);
          else listeners.delete(id);
          return id;
        },
        async nativePromise(plugin: string, method: string, options: { key: string; value: string; id: string }) {
          if (plugin === 'App') return { isActive: true };
          if (plugin === 'SolitaireAudio') return { focused: true };
          if (plugin === 'SolitaireStorage') {
            if (method === 'get') return { value: localStorage.getItem(options.key) };
            if (method === 'set') localStorage.setItem(options.key, options.value);
            else localStorage.removeItem(options.key);
          }
          if (plugin === 'SolitaireAds') {
            if (method === 'status') return { rewarded: true, interstitial: false, banner: false, ready: true, mode: 'test' };
            if (method === 'show') {
              requests.push(options as unknown as AdRequest);
              return new Promise<AdOutcome>(resolve => { finish = resolve; });
            }
            if (method === 'pending') return { receipts: [...receipts] };
            if (method === 'acknowledge') {
              acknowledged.push(options.id);
              const index = receipts.findIndex(receipt => receipt.id === options.id);
              if (index >= 0) receipts.splice(index, 1);
            }
          }
          return {};
        },
      },
    });
  });
}

const adControls = (page: Page) => page.evaluate(() =>
  (window as unknown as { adTestControls: AdTestControls }).adTestControls.requests);

for (const [previous, next] of [[content8Dealer[14], content8Wave[0]], [content8Wave[15], content8Late[0]]]) {
  test(`Next from C8 level ${previous.campaignLevel} opens the authored level ${next.campaignLevel}`, async ({ page }) => {
    const save = freshSave(previous, `core3-won-level-${previous.campaignLevel}`);
    for (const action of previous.winningPath) {
      const step = applyBoard(save.attempt.board, action, previous);
      if (typeof step === 'string') throw Error(step);
      save.attempt.board = step.board;
    }
    await loadWaveFixture(page, save, previous.campaignLevel!);
    await openGame(page, previous);
    await page.locator('#next-level').tap();
    if (next.difficultyTier !== 'normal') await page.locator('#difficulty-play').tap();
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', next.id);
    expect((await read(page)).attempt.board).toEqual(next.initial);
    expect(next.initial.stock).toHaveLength(previous.campaignLevel === 15 ? 54 : 28);
    await touch(page, next, { type: 'draw' });
    await expect.poll(async () => (await read(page)).attempt.board.stock.length).toBe(next.initial.stock.length - 1);
  });
}

for (const level of [26, 31, 80]) test(`level ${level} accepts a touch move through the fifth column at 320px`, async ({ page }) => {
  const deal = level === 80 ? content8Late[48] : content8Wave[level - 16];
  const save = freshSave(deal, `core3-five-column-${level}`);
  let move: BoardCommand | undefined;
  for (const action of deal.winningPath) {
    move = legalCommands(save.attempt.board, deal).find(candidate => candidate.type === 'transfer' &&
      (level === 26 ? candidate.from.kind === 'tableau' && candidate.from.index === 4 :
        candidate.to.kind === 'foundation' && candidate.to.index === 4));
    if (move) break;
    const step = applyBoard(save.attempt.board, action, deal);
    if (typeof step === 'string') throw Error(step);
    save.attempt.board = step.board;
  }
  if (!move) throw Error('Fixture has no legal move through the fifth column');
  const expected = applyBoard(save.attempt.board, move, deal);
  if (typeof expected === 'string') throw Error(expected);
  await loadWaveFixture(page, save, level - 1);
  await openGame(page, deal);
  await touch(page, deal, move);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
  await page.reload();
  await openGame(page, deal);
  const reloaded = (await read(page)).attempt;
  expect(reloaded.board).toEqual(expected.board);
  expect(reloaded.undo.at(-1)).toEqual(save.attempt.board);
});

test('the final C8 move records level 80 and opens the completed campaign', async ({ page }) => {
  const deal = content8Late[48], save = freshSave(deal, 'core3-final-move');
  const lastAction = deal.winningPath.at(-1)!;
  for (const action of deal.winningPath.slice(0, -1)) {
    const step = applyBoard(save.attempt.board, action, deal);
    if (typeof step === 'string') throw Error(step);
    save.attempt.board = step.board;
  }
  await loadWaveFixture(page, save, 79);
  await openGame(page, deal);
  await touch(page, deal, lastAction);
  await expect(page.locator('#result-copy')).toContainText('Все 80 уровней пройдены');
  const completed = await read(page);
  expect(completed.attempt.board.phase).toBe('won');
  expect(completed.platform?.completedCampaign).toHaveLength(80);
  expect(completed.platform?.completedCampaign).toContain(campaignId(80));
  await page.locator('#next-level').tap();
  await expect(page.locator('#home-progress')).toHaveText('Пройдено 80 из 80');
});

test('level 17 teaches the first ordered transfer and remembers accepted practice', async ({ page }) => {
  const previous = content8Wave[0], deal = content8Special[0];
  const save = freshSave(previous, 'core4-completed-sixteen');
  for (const command of previous.winningPath) {
    const applied = applyBoard(save.attempt.board, command, previous);
    if (typeof applied === 'string') throw Error(applied);
    save.attempt.board = applied.board;
  }
  await loadWaveFixture(page, save, 16);
  await openGame(page, previous);
  await page.locator('#next-level').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#learn-rule')).toHaveAttribute('data-rule', 'ordered');
  await page.locator('#learn-rule .primary').tap();
  await expect(page.locator('#lesson-copy')).toContainText('Будни');
  const initial = (await read(page)).attempt.board;
  await touch(page, deal, { type: 'draw' });
  expect((await read(page)).attempt.board).toEqual(initial);
  await touch(page, deal, deal.winningPath[0]);
  await expect(page.locator('#lesson-copy')).toContainText('понедельника');
  await page.reload();
  await openGame(page, deal);
  await expect(page.locator('#learn-rule')).toBeHidden();
  await expect(page.locator('#lesson-copy')).toContainText('понедельника');
  await touch(page, deal, deal.winningPath[1]);
  await expect(page.locator('#lesson-note')).toBeHidden();
  expect((await read(page)).campaign?.tutorials).toContain('learn:ordered');
});

test('the third key opens the column and Undo restores the saved two-key board', async ({ page }) => {
  const deal = content8Special[1], save = freshSave(deal, 'core4-keys');
  await loadWaveFixture(page, save, 17);
  await openGame(page, deal);
  await expect(page.locator('#learn-rule')).toHaveAttribute('data-rule', 'keys');
  await page.locator('#learn-rule .primary').tap();
  await expect(page.locator('#lesson-copy')).toContainText('0 из 3');
  for (const [index, move] of deal.winningPath.slice(0, 2).entries()) {
    await touch(page, deal, move);
    await expect(page.locator('#lesson-copy')).toContainText(`${index + 1} из 3`);
  }
  const before = (await read(page)).attempt.board;
  await page.reload();
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toContainText('2 из 3');
  await touch(page, deal, deal.winningPath[2]);
  await expect(page.locator('#lesson-note')).toBeHidden();
  const opened = await read(page);
  expect(opened.attempt.board.keys).toHaveLength(3);
  expect(opened.attempt.board.faceUp).toContain(opened.attempt.board.tableau[deal.lock!.column].at(-1));
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(before);
  expect((await read(page)).campaign?.tutorials).toContain('learn:keys');
});

test('level 66 opens and uses the rightmost locked column at 320px', async ({ page }) => {
  const deal = content8Special.find(candidate => candidate.campaignLevel === 66)!;
  const save = freshSave(deal, 'core4-rightmost-lock');
  save.campaign = { version: 1, tutorials: ['intro:keys', 'learn:keys'] };
  const column = deal.lock!.column;
  let unlockIndex = -1;
  for (const [index, move] of deal.winningPath.entries()) {
    const applied = applyBoard(save.attempt.board, move, deal);
    if (typeof applied === 'string') throw Error(applied);
    if (applied.events.some(event => event.type === 'unlock')) { unlockIndex = index; break; }
    save.attempt.board = applied.board;
  }
  expect(unlockIndex).toBeGreaterThanOrEqual(0);
  expect(column).toBe(4);
  expect(save.attempt.board.keys).toHaveLength(2);
  await loadWaveFixture(page, save, 65);
  await openGame(page, deal);
  let board = save.attempt.board, usedRightmost = false;
  for (const move of deal.winningPath.slice(unlockIndex)) {
    const applied = applyBoard(board, move, deal);
    if (typeof applied === 'string') throw Error(applied);
    await touch(page, deal, move);
    await expect.poll(async () => (await read(page)).attempt.board).toEqual(applied.board);
    board = applied.board;
    if (move.type === 'transfer' && [move.from, move.to].some(location => location.kind === 'tableau' && location.index === column)) {
      usedRightmost = true;
      break;
    }
  }
  expect(usedRightmost).toBe(true);
  expect(board.keys).toHaveLength(3);
});

test('the Frozen preview thaws with completed groups and restores ice after Undo', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_FROZEN !== '1', 'Requires the separate Frozen preview.');
  const deal = content8FrozenDeal;
  const save = freshSave(deal, 'frozen-preview-tap');
  await loadWaveFixture(page, save, 22);
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toHaveText('Соберите тему, чтобы снять один слой льда.');
  const root = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(root.width, root.height, save.settings.deckPosition, deal);
  const geometry = layout(save.attempt.board, deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
  const frozen = geometry.poses.find(pose => pose.id === 'space-word')!;
  const upper = geometry.targets.find(target => target.location.kind === 'foundation')!;
  for (const point of [frozen, upper]) {
    await page.touchscreen.tap(root.x + frame.offsetX + point.x * frame.unit, root.y + point.y * frame.unit);
  }
  expect((await read(page)).attempt.board).toEqual(deal.initial);
  for (const [index, action] of deal.winningPath.slice(0, 2).entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(23 - index);
  }
  expect((await read(page)).attempt.board.collected).toHaveLength(2);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board.collected).toEqual([]);
  await page.reload();
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toBeVisible();
  expect((await read(page)).attempt.id).toBe(save.attempt.id);
  for (const [index, action] of deal.winningPath.slice(1).entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(22 - index);
  }
  expect((await read(page)).attempt.board.phase).toBe('won');
});

test('the five-column Scissors preview releases the bond on transfer and restores it after Undo', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_BOUND !== '1', 'Requires the separate Bound preview.');
  const deal = content8BoundDeal;
  const save = freshSave(deal, 'scissors-preview-tap');
  await loadWaveFixture(page, save, 23);
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toHaveText('Перенесите ножницы в верхний слот, чтобы разрезать связь.');
  expect((await read(page)).attempt.board.tableau).toHaveLength(5);
  for (const [index, action] of deal.winningPath.slice(0, 4).entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(25 - index);
    if (index === 2) await expect(page.locator('#lesson-copy')).toBeVisible();
  }
  await expect(page.locator('#lesson-copy')).toBeHidden();
  await page.locator('#undo').tap();
  await expect(page.locator('#lesson-copy')).toBeVisible();
  expect((await read(page)).attempt.board.waste.at(-1)).toBe('tools-word');
  await page.reload();
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toBeVisible();
  expect((await read(page)).attempt.id).toBe(save.attempt.id);
  for (const [index, action] of deal.winningPath.slice(3).entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(22 - index);
  }
  expect((await read(page)).attempt.board.phase).toBe('won');
});

test('the Puzzle preview joins both halves before accepting the pair in a foundation', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_SPECIAL !== 'puzzle', 'Requires the separate Puzzle preview.');
  const deal = content8PuzzleDeal;
  const save = freshSave(deal, 'puzzle-preview-tap');
  await loadWaveFixture(page, save, 24);
  await openGame(page, deal);
  await expectLegibleLesson(page);
  for (const [index, action] of deal.winningPath.slice(0, 2).entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(21 - index);
  }
  await touch(page, deal, { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: 0 } });
  expect((await read(page)).attempt.board.movesLeft).toBe(20);
  await touch(page, deal, deal.winningPath[2]);
  await expect.poll(async () => (await read(page)).attempt.board.tableau[1]).toEqual(['kite-bottom', 'kite-top']);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board.waste).toEqual(['kite-top']);
  await page.reload();
  await openGame(page, deal);
  expect((await read(page)).attempt.id).toBe(save.attempt.id);
  for (const [index, action] of deal.winningPath.slice(2).entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(19 - index);
  }
  expect((await read(page)).attempt.board.phase).toBe('won');
});

test('the Golden preview shows partial collection and grants its separate bonus once', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_SPECIAL !== 'gold', 'Requires the separate Golden preview.');
  const deal = content8GoldenDeal;
  const save = freshSave(deal, 'golden-preview-tap');
  await loadWaveFixture(page, save, 26);
  await openGame(page, deal);
  await expectLegibleLesson(page);
  await expect(page.locator('#lesson-copy')).toContainText('0 из 2');
  for (const [index, action] of deal.winningPath.entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(19 - index);
    if (index === 1) {
      await expect(page.locator('#lesson-copy')).toContainText('1 из 2');
      expect((await read(page)).profile.coins).toBe(save.profile.coins);
    }
  }
  await expect(page.locator('#result-copy')).toHaveText('За золотые карты начислено 10 монет.');
  const settled = await read(page);
  expect(settled.attempt.payout?.find(grant => grant.reason === 'golden_cards')?.coins).toBe(10);
  await page.reload();
  await openGame(page, deal);
  await expect(page.locator('#result-copy')).toHaveText('За золотые карты начислено 10 монет.');
  expect((await read(page)).profile).toEqual(settled.profile);
});

test('the Starter preview pulls stock with the magnet and reveals a separate card with the hammer', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_SPECIAL !== 'starter', 'Requires the separate Starter preview.');
  const deal = content8StarterDeal;
  await loadWaveFixture(page, freshSave(deal, 'starter-preview-tap'), 27);
  await openGame(page, deal);
  await expectLegibleLesson(page);
  await expect(page.locator('#lesson-copy')).toContainText('Магнит');
  for (const [index, action] of deal.winningPath.entries()) {
    await touch(page, deal, action);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(23 - index);
    if (index === 2) {
      expect((await read(page)).attempt.board.waste.at(-1)).toBe('copper');
      await expect(page.locator('#lesson-copy')).toContainText('Молоток');
    }
    if (index === 5) expect((await read(page)).attempt.board.faceUp).not.toContain('nail');
    if (index === 6) expect((await read(page)).attempt.board.faceUp).toContain('nail');
  }
  expect((await read(page)).attempt.board.phase).toBe('won');
});

test('the first lesson gates real touches at 320px and resumes after reload', async ({ page }) => {
  const deal = content8Dealer[0];
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await openGame(page, deal);
  await expectLegibleLesson(page);
  const before = await read(page);
  expect(before.contentVersion).toBe(8);
  expect(typeof applyBoard(before.attempt.board, { type: 'draw' }, deal)).toBe('object');

  await page.locator('#inspect').tap();
  await expectLegibleLesson(page);
  await page.locator('#inspect').tap();
  await touch(page, deal, { type: 'draw' });
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
  expect((await read(page)).attempt.undo).toEqual([]);

  const first = deal.winningPath[0], expected = applyBoard(before.attempt.board, first, deal);
  if (typeof expected === 'string') throw Error(expected);
  await touch(page, deal, first);
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(expected.board);
  await expect(page.locator('#lesson-copy')).toContainText('одной темы');
  const accepted = await read(page);

  await page.reload();
  await openGame(page, deal);
  await expectLegibleLesson(page);
  await expect(page.locator('#lesson-copy')).toContainText('одной темы');
  const restored = await read(page);
  expect(restored.attempt.board).toEqual(accepted.attempt.board);
  expect(restored.attempt.undo).toEqual(accepted.attempt.undo);
  expect(restored.profile).toEqual(accepted.profile);
});

test('the free Hint lesson survives relaunch until the demonstrated play is made', async ({ page }) => {
  const deal = content8Dealer[2];
  const save = freshSave(deal, 'core0-hint-lesson');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = {
    receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: [campaignId(1), campaignId(2)],
  };
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: 'asoc-solitaire.save.v1', value: JSON.stringify(save) });
  await page.goto('/');
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toContainText('Первый раз бесплатно');
  await page.locator('#hint').tap();
  await expect.poll(async () => Boolean((await read(page)).attempt.lessonHint)).toBe(true);
  const revealed = await read(page);
  expect(revealed.profile.hints).toBe(save.profile.hints);

  await page.reload();
  await openGame(page, deal);
  await expectLegibleLesson(page);
  expect((await read(page)).attempt.lessonHint).toEqual(revealed.attempt.lessonHint);
  await touch(page, deal, revealed.attempt.lessonHint!);
  await expect.poll(async () => (await read(page)).campaign?.tutorials).toContain('hint-practiced');
  const practiced = await read(page);
  expect(practiced.attempt.lessonHint).toBeUndefined();
  expect(practiced.profile.hints).toBe(save.profile.hints);
  await expect(page.locator('#lesson-note')).toBeHidden();
});

async function tapBonus(page: Page, kind: 'foundation' | 'tableau') {
  const offer = page.locator('#bonus-' + kind);
  expect(await offer.evaluate(button => {
    const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && button.contains(hit);
  })).toBe(true);
  await offer.tap();
  await expect(page.locator('#bonus-offer')).toBeVisible();
}

test('Next at level 22 introduces an optional upper slot that can collect a topic at 320px', async ({ page }) => {
  const previous = content8Wave.find(deal => deal.campaignLevel === 21)!, deal = content8BonusDeals[0];
  const save = freshSave(previous, 'won-before-upper-bonus');
  for (const action of previous.winningPath) {
    const result = applyBoard(save.attempt.board, action, previous);
    if (typeof result === 'string') throw Error(result);
    save.attempt.board = result.board;
  }
  await loadWaveFixture(page, save, 21);
  await openGame(page, previous);
  await page.locator('#next-level').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#bonus-tableau')).toBeHidden();
  const before = await read(page);
  await tapBonus(page, 'foundation');
  await expect(page.locator('#bonus-title')).toHaveText('Слот для темы');
  await expect(page.locator('#bonus-video')).toBeHidden();
  await expect(page.locator('#bonus-buy')).toHaveText('Открыть за 100 монет');
  await page.locator('#bonus-buy').tap();
  await expect(page.locator('#bonus-foundation')).toBeHidden();
  await expectLegibleLesson(page);
  expect((await read(page)).attempt.board.movesLeft).toBe(before.attempt.board.movesLeft);
  expect((await read(page)).profile.coins).toBe(before.profile.coins - 100);
  await page.reload();
  await openGame(page, deal);
  await expect(page.locator('#lesson-copy')).toContainText('новый слот');
  const first = deal.winningPath[0];
  if (first.type !== 'transfer') throw Error('Expected foundation transfer');
  await touch(page, deal, { ...first, to: { kind: 'foundation', index: 3 } });
  await expect.poll(async () => (await read(page)).campaign?.tutorials).toContain('learn:bonus-foundation');
  expect((await read(page)).attempt.board.foundations[3].length).toBeGreaterThan(0);
});

test('the lower offer can be declined and regular play works without coins or video', async ({ page }) => {
  const deal = content8BonusDeals[1], save = freshSave(deal, 'lower-without-coins');
  save.profile.coins = 20;
  await loadWaveFixture(page, save, 29);
  await openGame(page, deal);
  await expect(page.locator('#bonus-foundation')).toBeHidden();
  await tapBonus(page, 'tableau');
  await expect(page.locator('#bonus-title')).toHaveText('Дополнительный столбец');
  await expect(page.locator('#bonus-buy')).toBeDisabled();
  await expect(page.locator('#bonus-balance')).toHaveText('Не хватает 40 монет.');
  await expect(page.locator('#bonus-video')).toBeHidden();
  await page.locator('#bonus-offer .close').tap();
  await touch(page, deal, deal.winningPath[0]);
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(deal.initial.movesLeft! - 1);
  expect((await read(page)).attempt.board.tableau).toHaveLength(4);
  expect((await read(page)).profile.coins).toBe(20);
});

test('level 40 opens both fifth slots separately with the deck below and keeps each through Undo', async ({ page }) => {
  const deal = content8BonusDeals[2], save = freshSave(deal, 'both-bonuses');
  save.settings.deckPosition = 'bottom';
  save.profile.coins = 200;
  await loadWaveFixture(page, save, 39);
  await openGame(page, deal);

  await tapBonus(page, 'foundation');
  await page.locator('#bonus-buy').tap();
  await expect(page.locator('#bonus-foundation')).toBeHidden();
  const first = deal.winningPath[0];
  if (first.type !== 'transfer') throw Error('Expected foundation transfer');
  await touch(page, deal, { ...first, to: { kind: 'foundation', index: 4 } });
  await expect.poll(async () => (await read(page)).attempt.board.foundations[4].length).toBeGreaterThan(0);

  await tapBonus(page, 'tableau');
  await expect(page.locator('#bonus-buy')).toHaveText('Открыть за 60 монет');
  await page.locator('#bonus-buy').tap();
  await expect(page.locator('#bonus-tableau')).toBeHidden();
  await expectLegibleLesson(page);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(deal.initial.movesLeft);
  const undone = (await read(page)).attempt.board;
  expect(undone.foundations).toEqual([...deal.initial.foundations, []]);
  expect(undone.tableau).toEqual([...deal.initial.tableau, []]);

  const park = legalCommands(undone, deal).find(cmd => cmd.type === 'transfer' && cmd.to.kind === 'tableau' && cmd.to.index === 4)!;
  await touch(page, deal, park);
  await expect.poll(async () => (await read(page)).campaign?.tutorials).toContain('learn:bonus-tableau');
  const parked = await read(page);
  expect(parked.profile.coins).toBe(40);
  expect(parked.attempt.board.tableau[4].length).toBeGreaterThan(0);
  await page.reload();
  await openGame(page, deal);
  expect((await read(page)).attempt).toMatchObject({ board: parked.attempt.board, undo: parked.attempt.undo });
  await expect(page.locator('#bonus-foundation')).toBeHidden();
  await expect(page.locator('#bonus-tableau')).toBeHidden();
  await page.locator('#menu').tap();
  await page.locator('#restart').tap();
  await expect(page.locator('#restart-confirm-copy')).toContainText('Дополнительные места закроются.');
  await page.locator('#restart-confirm-yes').tap();
  await expect(page.locator('#bonus-foundation')).toBeVisible();
  await expect(page.locator('#bonus-tableau')).toBeVisible();
  expect((await read(page)).profile.coins).toBe(40);
});

test('real level 16 exhaustion offers a verified ten-move recovery and the tenth tap can win', async ({ page }) => {
  const save = loadLoss(recoverable, 'recoverable-l16', true);
  await loadWaveFixture(page, save, 15, 1);
  await openGame(page, recoverable);
  const last = { type: 'transfer', from: { kind: 'tableau', index: 0 }, to: { kind: 'tableau', index: 2 } } as const;
  await touch(page, recoverable, last);
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result')).toHaveAttribute('data-continue-status', 'PROVEN_RECOVERABLE');
  await page.reload();
  await openGame(page, recoverable);
  await expect(page.locator('#result-continue')).toBeEnabled();
  await expect(page.locator('#result-continue-coins')).toBeHidden();
  await expect(page.locator('#result-continue-note')).toContainText('10 ходов или меньше');
  await page.locator('#result-continue').tap();
  await expect(page.locator('#result')).toBeHidden();
  const continued = await read(page);
  expect(continued.attempt.board.movesLeft).toBe(10);
  expect(continued.attempt.id).toBe(save.attempt.id);
  expect(continued.platform?.continueCredits).toBe(0);
  for (const [index, move] of winningRescue.entries()) {
    await touch(page, recoverable, move);
    await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(9 - index);
  }
  await expect(page.locator('#result')).toHaveAttribute('data-won', 'true');
  expect((await read(page)).platform?.completedCampaign).toContain(campaignId(16));
});

test('real level 38 exhaustion keeps the stored credit and promotes Undo when ten moves cannot win', async ({ page }) => {
  const save = loadLoss(unrecoverable, 'unrecoverable-l38');
  await loadWaveFixture(page, save, 37, 1);
  await openGame(page, unrecoverable);
  await expect(page.locator('#result')).toHaveAttribute('data-continue-status', 'UNSOLVABLE');
  await expect(page.locator('#result-continue')).toBeHidden();
  await expect(page.locator('#result-continue-coins')).toBeHidden();
  await expect(page.locator('#result-undo')).toHaveClass('primary');
  await expect(page.locator('#result-continue-note')).toContainText('за 10 ходов не выиграть');
  expect((await read(page)).platform?.continueCredits).toBe(1);
  await page.locator('#result-undo').tap();
  await expect(page.locator('#result')).toBeHidden();
  expect((await read(page)).attempt.board.movesLeft).toBe(1);
  expect((await read(page)).platform?.continueCredits).toBe(1);
});

test('an unavailable continuation worker keeps the credit and never offers an unverified rescue', async ({ page }) => {
  await page.route('**/assets/continue.worker-*.js', route => route.abort());
  const save = loadLoss(recoverable, 'continue-check-unavailable');
  await loadWaveFixture(page, save, 15, 1);
  await openGame(page, recoverable);
  await expect(page.locator('#result')).toHaveAttribute('data-continue-status', 'UNKNOWN');
  await expect(page.locator('#result-continue')).toBeHidden();
  await expect(page.locator('#result-continue-coins')).toBeHidden();
  await expect(page.locator('#result-continue-note')).toContainText('не подтверждён');
  await expect(page.locator('#result-undo')).toBeVisible();
  expect((await read(page)).platform?.continueCredits).toBe(1);
});

test('an unavailable video returns to the same loss after foreground and promotes Undo', async ({ page }) => {
  await installNativeAdTestBridge(page);
  const save = loadLoss(recoverable, 'video-unavailable');
  save.profile.coins = 0;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  const video = page.locator('#result-continue');
  await expect(video).toHaveClass('primary');
  await video.tap();
  await expect.poll(() => adControls(page)).toEqual([{
    kind: 'rewarded', placement: 'continue', attempt: save.attempt.id, dealId: recoverable.id, mode: 'campaign',
  }]);
  await page.evaluate(() => {
    const bridge = (window as unknown as { adTestControls: AdTestControls }).adTestControls;
    bridge.active(false);
    bridge.finish({ shown: false, outcome: 'unavailable' });
  });
  await expect(video).toHaveText('Повторить запрос видео');
  await expect(page.locator('#result')).toBeHidden();
  await page.evaluate(() => (window as unknown as { adTestControls: AdTestControls }).adTestControls.active(true));
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result-continue-note')).toHaveText('Видео сейчас недоступно.');
  await expect(video).toHaveClass('secondary');
  const undo = page.locator('#result-undo');
  await expect(undo).toHaveClass('primary');
  const exhausted = await read(page);
  expect(exhausted.attempt).toEqual(save.attempt);
  expect(exhausted.profile).toEqual(save.profile);
  expect(exhausted.platform?.receipts).toEqual([]);
  expect(exhausted.platform?.continueCredits).toBe(0);
  const bounds = (await undo.boundingBox())!;
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  expect(await undo.evaluate((button, { x, y }) => button.contains(document.elementFromPoint(x, y)), point)).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator('#result')).toBeHidden();
  expect((await read(page)).attempt.board.movesLeft).toBe(1);
});

test('an earned video continuation in background resumes play without reopening the loss', async ({ page }) => {
  await installNativeAdTestBridge(page);
  const save = loadLoss(recoverable, 'video-earned');
  save.profile.coins = 0;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  await page.locator('#result-continue').tap();
  await expect.poll(async () => (await adControls(page)).length).toBe(1);
  const receipt = { schema: 1, id: 'video-earned-receipt', dealId: recoverable.id,
    attempt: save.attempt.id, placement: 'continue', mode: 'campaign' } satisfies EarnedReceipt;
  await page.evaluate(receipt => {
    const bridge = (window as unknown as { adTestControls: AdTestControls }).adTestControls;
    bridge.active(false);
    bridge.earn(receipt);
    bridge.finish({ shown: true, outcome: 'dismissed' });
  }, receipt);
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { adTestControls: AdTestControls }).adTestControls.acknowledged)).toEqual([receipt.id]);
  await page.evaluate(() => (window as unknown as { adTestControls: AdTestControls }).adTestControls.active(true));
  await expect(page.locator('#result')).toBeHidden();
  const resumed = await read(page);
  expect(resumed.attempt.id).toBe(save.attempt.id);
  expect(resumed.attempt.board).toEqual({ ...save.attempt.board, phase: 'playing', movesLeft: 10 });
  expect(resumed.platform?.receipts).toEqual([receipt.id]);
  expect(resumed.platform?.continueCredits).toBe(0);
  await touch(page, recoverable, winningRescue[0]);
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(9);
});

test('a proven C8 loss buys ten moves offline and keeps the debit after reload and Undo', async ({ page }) => {
  const save = loadLoss(recoverable, 'coins-continue');
  save.profile.coins = BALANCE.continueCoinPrice;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  const coinOffer = page.locator('#result-continue-coins');
  await expect(coinOffer).toBeEnabled();
  await expect(coinOffer).toHaveText('+10 ходов за 120 монет');
  await expect(page.locator('#result-continue')).toBeHidden();
  expect(await coinOffer.evaluate(button => {
    const r = button.getBoundingClientRect();
    return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight && button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  await coinOffer.tap();
  await expect(page.locator('#result')).toBeHidden();
  const purchased = await read(page);
  expect(purchased.attempt.board.movesLeft).toBe(10);
  expect(purchased.attempt.id).toBe(save.attempt.id);
  expect(purchased.profile.coins).toBe(0);
  await page.reload();
  await openGame(page, recoverable);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(11);
  expect((await read(page)).profile.coins).toBe(0);
});

test('one coin short leaves Undo and Replay available without a charge', async ({ page }) => {
  const save = loadLoss(recoverable, 'short-coins-continue');
  save.profile.coins = BALANCE.continueCoinPrice - 1;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  const coinOffer = page.locator('#result-continue-coins');
  await expect(coinOffer).toBeVisible();
  await expect(coinOffer).toBeDisabled();
  await expect(page.locator('#result-continue-note')).toContainText('не хватает монет');
  await expect(page.locator('#result-undo')).toHaveClass('primary');
  await expect(page.locator('#replay')).toBeVisible();
  expect((await read(page)).profile.coins).toBe(BALANCE.continueCoinPrice - 1);
});

test('an ambiguous coin write can be checked from the result without a second debit', async ({ page }) => {
  const save = loadLoss(recoverable, 'coin-uncertain');
  save.profile.coins = BALANCE.continueCoinPrice;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  const button = page.locator('#result-continue-coins');
  await expect(button).toBeEnabled();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem, read = Storage.prototype.getItem;
    let failRead = false;
    Storage.prototype.setItem = function (key, value) {
      write.call(this, key, value);
      if (key === 'asoc-solitaire.save.v1' && JSON.parse(value).attempt.continued) {
        Storage.prototype.setItem = write;
        failRead = true;
        throw Error('Bridge response lost after writing');
      }
    };
    Storage.prototype.getItem = function (key) {
      if (key === 'asoc-solitaire.save.v1' && failRead) {
        failRead = false;
        Storage.prototype.getItem = read;
        throw Error('Read-back unavailable once');
      }
      return read.call(this, key);
    };
  });
  await button.tap();
  await expect(page.locator('#result-continue-error')).toContainText('Проверьте');
  await expect(button).toBeDisabled();
  await page.locator('#result-save-retry').tap();
  await expect(page.locator('#result')).toBeHidden();
  const settled = await read(page);
  expect(settled.attempt.board.movesLeft).toBe(10);
  expect(settled.profile.coins).toBe(0);
});

test('level 12 can change layout from the loss result and saves the chosen deal and budget', async ({ page }) => {
  const deal = content8Dealer[11], alternate = content8DirectorDeals.find(candidate => candidate.id === deal.id + '-relief-r1')!;
  const save = loadLoss(deal, 'redeal-loss');
  await loadWaveFixture(page, save, 11, 1);
  await openGame(page, deal);
  await expect(page.locator('#replay')).toHaveText('Тот же расклад');
  const button = page.locator('#result-redeal');
  await expect(button).toContainText('Лимит 74');
  await expect(button).toBeEnabled();
  expect(await button.evaluate(e => {
    const r = e.getBoundingClientRect();
    return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight && e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  const before = await read(page);
  await button.tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', alternate.id);
  const started = await read(page);
  expect(started.attempt.id).not.toBe(before.attempt.id);
  expect(started.attempt.board).toEqual(alternate.initial);
  expect(started.attempt.undo).toEqual([]);
  expect(started.profile).toEqual(before.profile);
  expect(started.platform?.continueCredits).toBe(1);
  expect(started.attempt.director).toEqual({ restarts: 1, previousLosses: 1 });
  await page.reload();
  await openGame(page, alternate);
  expect((await read(page)).attempt).toEqual(started.attempt);
  await touch(page, alternate, { type: 'draw' });
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(73);
});

test('the same-layout replay keeps its original cards and a budget-only variant offers no redeal', async ({ page }) => {
  const deal = content8Dealer[11];
  const save = loadLoss(deal, 'same-replay');
  await loadWaveFixture(page, save, 11);
  await openGame(page, deal);
  await expect(page.locator('#result-redeal')).toBeVisible();
  await page.locator('#replay').tap();
  await expect(page.locator('#result')).toBeHidden();
  const restarted = await read(page);
  expect(restarted.attempt.id).not.toBe(save.attempt.id);
  expect(restarted.attempt.dealId).toBe(deal.id);
  expect(restarted.attempt.board).toEqual(deal.initial);
  const budgetOnly = content8Dealer[10];
  const other = loadLoss(budgetOnly, 'no-layout-change');
  other.contentVersion = 8;
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), other);
  await page.reload();
  await openGame(page, budgetOnly);
  await expect(page.locator('#result-redeal')).toBeHidden();
  await expect(page.locator('#replay')).toHaveText('Ещё раз');
});

test('a reconciled alternate-deal save presents the committed board exactly once', async ({ page }) => {
  const deal = content8Dealer[11], alternate = content8DirectorDeals.find(candidate => candidate.id === deal.id + '-relief-r1')!;
  const save = loadLoss(deal, 'redeal-uncertain');
  await loadWaveFixture(page, save, 11);
  await openGame(page, deal);
  await page.evaluate(alternateId => {
    const write = Storage.prototype.setItem, read = Storage.prototype.getItem;
    let failRead = false;
    Storage.prototype.setItem = function (key, value) {
      write.call(this, key, value);
      if (key === 'asoc-solitaire.save.v1' && JSON.parse(value).attempt.dealId === alternateId) {
        Storage.prototype.setItem = write;
        failRead = true;
        throw Error('Lost response after write');
      }
    };
    Storage.prototype.getItem = function (key) {
      if (key === 'asoc-solitaire.save.v1' && failRead) {
        failRead = false;
        Storage.prototype.getItem = read;
        throw Error('Read-back failed once');
      }
      return read.call(this, key);
    };
  }, alternate.id);
  await page.locator('#result-redeal').tap();
  await expect(page.locator('#result-continue-error')).toContainText('Проверьте, сохранился ли новый расклад');
  await expect(page.locator('#result-redeal')).toBeDisabled();
  const committed = await read(page);
  await page.locator('#result-save-retry').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', alternate.id);
  expect((await read(page)).attempt).toEqual(committed.attempt);
  expect(committed.attempt.board).toEqual(alternate.initial);
});
