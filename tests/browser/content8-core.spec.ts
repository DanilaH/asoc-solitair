import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { beyond80Deals } from '../../src/content/campaign-v8-beyond';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { content8Special } from '../../src/content/campaign-v8-special';
import { content8FrozenDeal } from '../../src/content/campaign-v8-frozen';
import { content8BoundDeal } from '../../src/content/campaign-v8-bound';
import { content8PuzzleDeal } from '../../src/content/campaign-v8-puzzle';
import { content8GoldenDeal } from '../../src/content/campaign-v8-golden';
import { content8StarterDeal } from '../../src/content/campaign-v8-starter';
import { content8ShuffleDeal } from '../../src/content/campaign-v8-shuffle';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { content8DirectorDeals } from '../../src/content/campaign-v8-director';
import { applyBoard, dispatch, freshSave, legalCommands, sourceCards } from '../../src/domain/engine';
import { openPictureEvent } from '../../src/domain/events/picture';
import { campaignId } from '../../src/domain/progression';
import { BALANCE } from '../../src/domain/balance';
import type { EarnedReceipt, FullscreenShown } from '../../src/domain/services';
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

async function loadWaveFixture(page: Page, save: Save, completed: number, continueCredits = 0, initialCadence?: Pick<NonNullable<Save['platform']>, 'lastFullscreenAt' | 'winsSinceInterstitial'>) {
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: completed }, (_, i) => campaignId(i + 1)), ...initialCadence };
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
  confirmDisplay(shown: FullscreenShown): void;
}

async function installNativeAdTestBridge(page: Page, interstitialReady = false) {
  await page.addInitScript(interstitialReady => {
    const listeners = new Map<string, (event: object) => void>();
    const requests: AdRequest[] = [];
    const acknowledged: string[] = [];
    const receipts: EarnedReceipt[] = [];
    let fullscreenDisplay: FullscreenShown | null = null;
    let finish: (outcome: AdOutcome) => void;
    const controls: AdTestControls = {
      requests, acknowledged,
      active: isActive => listeners.get('App.appStateChange')?.({ isActive }),
      finish: outcome => finish(outcome),
      earn(receipt) {
        receipts.push(receipt);
        listeners.get('SolitaireAds.adEvent')?.({ kind: 'rewarded', phase: 'earned' });
      },
      confirmDisplay(shown) {
        fullscreenDisplay = shown;
        listeners.get('SolitaireAds.adEvent')?.({ kind: shown.kind, phase: 'show' });
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
          methods('SolitaireAds', ['status', 'prepareInterstitial', 'show', 'pending', 'acknowledge', 'pendingShown', 'acknowledgeShown', 'hideBanner', 'dispose'], true),
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
            if (method === 'status') return { rewarded: true, interstitial: interstitialReady, banner: false, ready: true, mode: 'test' };
            if (method === 'show') {
              requests.push(options as unknown as AdRequest);
              return new Promise<AdOutcome>(resolve => { finish = resolve; });
            }
            if (method === 'pending') return { receipts: [...receipts] };
            if (method === 'pendingShown') return { shown: fullscreenDisplay };
            if (method === 'acknowledgeShown' && fullscreenDisplay?.id === options.id) fullscreenDisplay = null;
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
  }, interstitialReady);
}

const adControls = (page: Page) => page.evaluate(() =>
  (window as unknown as { adTestControls: AdTestControls }).adTestControls.requests);

for (const shown of [false, true]) {
  test(`post-win transition preserves cadence until the SDK confirms display (shown=${shown})`, async ({ page }) => {
    const before = content8Dealer[6], after = content8Dealer[7];
    const save = freshSave(before, 'cadence-post-win');
    for (const action of before.winningPath) {
      const result = applyBoard(save.attempt.board, action, before);
      if (typeof result === 'string') throw Error(result);
      save.attempt.board = result.board;
    }
    const previous = 1_700_000_000_000, displayed = previous + 240_001;
    await page.clock.setFixedTime(previous + 120_000);
    await installNativeAdTestBridge(page, true);
    await loadWaveFixture(page, save, before.campaignLevel!, 0, { lastFullscreenAt: previous, winsSinceInterstitial: 3 });
    await openGame(page, before);
    await page.clock.setFixedTime(displayed);
    await page.locator('#next-level').tap();
    const request: AdRequest = { kind: 'interstitial', placement: 'continue', attempt: save.attempt.id, dealId: before.id, mode: 'campaign' };
    await expect.poll(() => adControls(page)).toEqual([request]);
    const waiting = await read(page);
    expect(waiting.platform).toMatchObject({ lastFullscreenAt: previous, winsSinceInterstitial: 3 });
    expect(waiting.attempt.id).toBe(save.attempt.id);
    if (shown) {
      await page.evaluate(value => (window as unknown as { adTestControls: AdTestControls }).adTestControls.confirmDisplay(value),
        { ...request, schema: 1 as const, id: 'recorded-display', shownAt: displayed });
      await expect.poll(async () => (await read(page)).platform?.lastFullscreenAt).toBe(displayed);
      expect((await read(page)).attempt.id).toBe(save.attempt.id);
    }
    await page.evaluate(shown => (window as unknown as { adTestControls: AdTestControls }).adTestControls.finish({
      shown, outcome: shown ? 'dismissed' : 'unavailable',
    }), shown);
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', after.id);
    const advanced = await read(page);
    expect(advanced.platform).toMatchObject({ lastFullscreenAt: shown ? displayed : previous, winsSinceInterstitial: shown ? 0 : 3, receipts: [] });
    expect(advanced.profile).toEqual(waiting.profile);
  });
}

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
  test.skip(process.env.VITE_CONTENT8_BEYOND80 === '1', 'The post-80 preview has a dedicated continuation test.');
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

test('the Shuffle preview applies one verified free change and restores stock after Undo', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_SPECIAL !== 'shuffle', 'Requires the separate Shuffle preview.');
  const deal = content8ShuffleDeal;
  await loadWaveFixture(page, freshSave(deal, 'shuffle-preview-tap'), 28);
  await page.locator('#app').evaluate(() => {
    const key = 'asoc-solitaire.save.v1';
    const persisted = JSON.parse(localStorage.getItem(key)!);
    persisted.settings.reducedMotion = false;
    localStorage.setItem(key, JSON.stringify(persisted));
  });
  await page.reload();
  await openGame(page, deal);
  const before = await read(page);
  const action = page.getByRole('button', { name: 'Перемешать колоду' });
  await expect(action).toBeEnabled();
  await action.tap();
  await expect.poll(async () => (await read(page)).attempt.shuffleUsed).toBe(true);
  await expect(action).toBeDisabled();
  const shuffled = await read(page);
  expect(shuffled.attempt.board.stock).not.toEqual(before.attempt.board.stock);
  expect(shuffled.attempt.board.movesLeft).toBe(before.attempt.board.movesLeft);
  expect(shuffled.profile).toEqual(before.profile);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board.stock).toEqual(before.attempt.board.stock);
  await page.reload();
  await openGame(page, deal);
  await expect(action).toBeDisabled();
  expect((await read(page)).attempt.shuffleUsed).toBe(true);
});

test('the test App bridge cancels a pending shuffle without changing stock or balance', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_SPECIAL !== 'shuffle', 'Requires the separate Shuffle preview.');
  await installNativeAdTestBridge(page);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = function (url: string | URL, options?: WorkerOptions) {
      if (!String(url).includes('shuffle.worker')) return new NativeWorker(url, options);
      return { postMessage() {}, terminate() {} };
    } as unknown as typeof Worker;
  });
  const deal = content8ShuffleDeal;
  await loadWaveFixture(page, freshSave(deal, 'shuffle-background'), 28);
  await openGame(page, deal);
  const before = await read(page);
  const action = page.getByRole('button', { name: 'Перемешать колоду' });
  await action.tap();
  await expect(action).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => (window as unknown as { adTestControls: AdTestControls }).adTestControls.active(false));
  await expect(action).toHaveAttribute('aria-busy', 'false');
  const after = await read(page);
  expect(after.attempt.board).toEqual(before.attempt.board);
  expect(after.profile).toEqual(before.profile);
  expect(after.attempt.shuffleUsed).toBeUndefined();
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
  expect(await page.locator('#bonus-title').evaluate(title => {
    const close = title.parentElement!.querySelector('.close')!.getBoundingClientRect();
    const text = document.createRange();
    text.selectNodeContents(title);
    return [...text.getClientRects()].every(line => line.right <= close.left || line.top >= close.bottom);
  })).toBe(true);
  await expect(page.locator('#bonus-buy')).toBeDisabled();
  await expect(page.locator('#bonus-balance')).toHaveText('Не хватает 40 монет.');
  await expect(page.locator('#bonus-video')).toBeHidden();
  await page.locator('#bonus-offer .close').tap();
  await touch(page, deal, deal.winningPath[0]);
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(deal.initial.movesLeft! - 1);
  expect((await read(page)).attempt.board.tableau).toHaveLength(4);
  expect((await read(page)).profile.coins).toBe(20);
});

test('a bonus slot preview tap cannot also confirm a purchase on the wider layout', async ({ page }) => {
  const deal = content8BonusDeals[2], save = freshSave(deal, 'bonus-separate-confirmation');
  save.profile.coins = 200;
  await loadWaveFixture(page, save, 39);
  await page.setViewportSize({ width: 520, height: 700 });
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await tapBonus(page, 'tableau');
  const pending = await read(page);
  expect(pending.profile.coins).toBe(200);
  expect(pending.attempt.board.tableau).toEqual(deal.initial.tableau);
  await page.locator('#bonus-buy').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(140);
  expect((await read(page)).attempt.board.tableau).toHaveLength(5);
  await expect(page.locator('#bonus-offer')).toBeHidden();
});

for (const side of ['left', 'right'] as const) {
  test(`the moves badge clears rendered cards with the bottom stock at ${side}`, async ({ page }) => {
    const deal = content8Wave.find(deal => deal.campaignLevel === 31)!;
    let save = freshSave(deal, 'full-foundation-layout');
    for (const command of deal.winningPath) {
      save = dispatch(save, command, deal).next;
      if (save.attempt.board.foundations.every(group => group.length)) break;
    }
    expect(save.attempt.board.foundations.every(group => group.length)).toBe(true);
    save.settings.deckSide = side;
    save.settings.deckPosition = 'bottom';
    await loadWaveFixture(page, save, 30);
    await openGame(page, deal);

    const field = page.locator('#game-root');
    const area = (await field.boundingBox())!;
    const badge = (await page.locator('#inspect').boundingBox())!;
    const overlay = await page.addStyleTag({ content: '.deck-tools { visibility: hidden !important; }' });
    const screenshot = await field.screenshot({ scale: 'css' });
    await overlay.evaluate(style => style.parentNode?.removeChild(style));
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixelWidth = info.width, pixelHeight = info.height;
    let cards = 0, covered = 0;
    for (let y = 0; y < pixelHeight; y++) for (let x = 0; x < pixelWidth; x++) {
      const offset = (y * pixelWidth + x) * info.channels;
      if (data[offset] <= 240 || data[offset + 1] <= 220 || data[offset + 2] <= 168) continue;
      cards++;
      if (x + area.x >= badge.x + 3 && x + area.x < badge.x + badge.width - 3 &&
          y + area.y >= badge.y + 3 && y + area.y < badge.y + badge.height - 3) covered++;
    }
    expect(cards).toBeGreaterThan(500);
    expect(covered).toBeLessThan(20);
    await page.locator('#inspect').tap();
    await expect(page.locator('#inspect')).toHaveAttribute('aria-pressed', 'true');
  });
}

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

test('reward offer preview keeps the normal victory and grants only a matching earned delta', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_REWARD_OFFERS !== '1', 'Requires the optional reward offer preview.');
  await installNativeAdTestBridge(page);
  let save = freshSave(recoverable, 'p20-last-play');
  for (const move of recoverable.winningPath.slice(0, -1)) save = dispatch(save, move, recoverable).next;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  await touch(page, recoverable, recoverable.winningPath.at(-1)!);
  const pane = page.locator('#win-video-offers');
  await expect(page.locator('#result')).toHaveAttribute('data-won', 'true');
  await expect(pane).toBeVisible();
  const payout = (await read(page)).attempt.payout!;
  const baseline = payout.find(entry => entry.reason === 'win')!.coins;
  await expect(page.locator('#result-total')).toHaveText('+' + payout.reduce((total, entry) => total + entry.coins, 0));
  await page.locator('#win-video-kind').selectOption('win-triple');
  const button = page.locator('#win-video-claim');
  await expect(button).toHaveText(`Получить ещё ${2 * baseline} монет`);
  const beforeOffer = await read(page);
  await button.tap();
  await expect.poll(async () => (await adControls(page)).length).toBe(1);
  await page.evaluate(() => (window as unknown as { adTestControls: AdTestControls }).adTestControls.finish({ shown: false, outcome: 'unavailable' }));
  await expect(pane).toBeVisible();
  expect((await read(page)).profile.coins).toBe(beforeOffer.profile.coins);
  expect((await read(page)).platform?.lastFullscreenAt).toBe(0);

  await button.tap();
  await expect.poll(async () => (await adControls(page)).length).toBe(2);
  const [first, second] = await adControls(page);
  expect(second).toEqual(first);
  const receipt: EarnedReceipt = { schema: 1, id: 'p20-earned-win', placement: second.placement,
    attempt: second.attempt, dealId: second.dealId, mode: 'campaign' };
  await page.evaluate(value => {
    const mock = (window as unknown as { adTestControls: AdTestControls }).adTestControls;
    mock.finish({ shown: true, outcome: 'dismissed' });
    mock.earn(value);
  }, receipt);
  await expect.poll(async () => (await read(page)).profile.coins).toBe(beforeOffer.profile.coins + 2 * baseline);
  await expect(pane).toBeHidden();
  await page.reload();
  await openGame(page, recoverable);
  await expect(pane).toBeHidden();
  expect((await read(page)).profile.coins).toBe(beforeOffer.profile.coins + 2 * baseline);
});

test('reward offer preview keeps the free reader and a distinct related-word charge after reload', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_REWARD_OFFERS !== '1', 'Requires the optional reward offer preview.');
  let save = freshSave(recoverable, 'p20-definition');
  for (const move of recoverable.winningPath.slice(0, 20)) save = dispatch(save, move, recoverable).next;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  async function openReader() {
    const { attempt: { board }, settings } = await read(page);
    const rect = (await page.locator('#game-root').boundingBox())!;
    const frame = boardFrame(rect.width, rect.height, settings.deckPosition, recoverable);
    const geometry = layout(board, recoverable, frame.height, settings.deckSide, settings.deckPosition);
    const pose = geometry.poses.find(p => p.faceUp && board.tableau.some(col => col.at(-1) === p.id) &&
      board.faceUp.some(id => id !== p.id && !recoverable.cards[id].leader && recoverable.cards[id].category === recoverable.cards[p.id].category));
    expect(pose).toBeDefined();
    await page.locator('#inspect').tap();
    await page.touchscreen.tap(rect.x + frame.offsetX + pose!.x * frame.unit, rect.y + pose!.y * frame.unit);
    await expect(page.locator('#inspect-dialog')).toBeVisible();
    await expect(page.locator('#word-title')).toHaveText(recoverable.cards[pose!.id].text);
    await expect(page.locator('#word-description')).toBeVisible();
  }
  await openReader();
  await page.locator('#definition-use').tap();
  await expect(page.locator('#definition-related')).toContainText('Связанное слово · ');
  await expect(page.locator('#definition-use')).toBeDisabled();
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
  expect((await read(page)).profile).toEqual(save.profile);
  await page.reload();
  await openGame(page, recoverable);
  await openReader();
  await expect(page.locator('#definition-use')).toHaveText('Связанное слово · 0');
});

test('reward offer preview renews the shop and theme only with their own receipts', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_REWARD_OFFERS !== '1', 'Requires the optional reward offer preview.');
  await installNativeAdTestBridge(page);
  const save = freshSave(recoverable, 'p20-shop-theme');
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  async function earn(button: string, placement: EarnedReceipt['placement'], count: number) {
    await page.locator(button).tap();
    await expect.poll(async () => (await adControls(page)).length).toBe(count);
    const request = (await adControls(page)).at(-1)!;
    expect(request.placement).toBe(placement);
    await page.evaluate(value => {
      const mock = (window as unknown as { adTestControls: AdTestControls }).adTestControls;
      mock.finish({ shown: true, outcome: 'dismissed' });
      mock.earn(value);
    }, { schema: 1, id: `p20-earned-${count}`, placement, attempt: request.attempt,
      dealId: request.dealId, mode: 'campaign' } satisfies EarnedReceipt);
  }
  await page.locator('#wallet-open').tap();
  await earn('#shop-video-claim', 'shop-free-coins', 1);
  await expect(page.locator('#helpers')).toBeVisible();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(save.profile.coins + 30);
  await expect(page.locator('#shop-video-claim')).toBeHidden();
  await page.locator('#helper-return').tap();
  await page.locator('#menu').tap();
  await page.locator('#pause-options summary').tap();
  await page.locator('#appearance-settings').tap();
  await earn('#theme-video-claim', 'rewarded-theme', 2);
  await expect(page.locator('#appearance')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-reward-theme', '');
  await expect(page.locator('#theme-video-claim')).toBeHidden();
  expect((await read(page)).profile.coins).toBe(save.profile.coins + 30);
});

test('picture gallery preview reveals the last fragment from a real winning touch and saves the artwork', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_PICTURE !== '1', 'Requires the picture gallery preview.');
  const now = Date.now();
  let save = freshSave(recoverable, 'p27-last-gallery-win');
  openPictureEvent(save, now);
  save.events!.events[0].wins = Array.from({ length: 5 }, (_, index) => ({ id: `campaign:${11 + index}`, day: '2026-11-21' }));
  save.picture!.parts = [0, 1, 2, 3, 4];
  for (const move of recoverable.winningPath.slice(0, -1)) save = dispatch(save, move, recoverable).next;
  await loadWaveFixture(page, save, 15);
  await openGame(page, recoverable);
  await touch(page, recoverable, recoverable.winningPath.at(-1)!);
  const entry = page.locator('#picture-result'), album = page.locator('#picture-dialog');
  await expect(entry).toHaveText('Альбом · +2 жетона и 3 монеты');
  await entry.tap();
  await expect(album).toBeVisible();
  await expect(page.locator('#picture-status')).toHaveText('Жетоны · 3  •  Открыто 5 из 6');
  await expect(page.locator('#picture-claim')).toBeHidden();
  const before = await read(page);
  await page.locator('#picture-grid [data-part="5"]').tap();
  await expect(page.locator('#picture-grid [data-open]')).toHaveCount(6);
  await page.locator('#picture-claim').tap();
  await expect(page.locator('#picture-status')).toHaveText('Иллюстрация сохранена в альбоме.');
  const earned = await read(page);
  expect(earned.profile.coins).toBe(before.profile.coins + 20);
  expect(earned.profile.hints).toBe(before.profile.hints + 1);
  expect(earned.attempt).toEqual(before.attempt);
  await page.reload();
  await openGame(page, recoverable);
  await entry.tap();
  await expect(page.locator('#picture-grid [data-open]')).toHaveCount(6);
  await expect(page.locator('#picture-claim')).toBeHidden();
  expect((await read(page)).profile.coins).toBe(earned.profile.coins);
});

test('picture gallery preview can be opened without granting progress or blocking play', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_PICTURE !== '1', 'Requires the picture gallery preview.');
  const save = freshSave(recoverable, 'p27-new-gallery');
  await loadWaveFixture(page, save, 15);
  await expect(page.locator('#picture-home')).toBeVisible();
  await page.locator('#picture-home').tap();
  await expect(page.locator('#picture-status')).toHaveText('Жетоны · 0  •  Открыто 0 из 6');
  await expect(page.locator('#picture-grid button:disabled')).toHaveCount(6);
  expect((await read(page)).profile).toEqual(save.profile);
  await page.locator('#picture-done').tap();
  await openGame(page, recoverable);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
});

test('daily task preview records a real draw and lets the player claim once after returning home', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_DAILY_TASKS !== '1', 'Requires the daily task preview.');
  const save = freshSave(recoverable, 'p28-task-draw');
  await loadWaveFixture(page, save, 15);
  const link = page.locator('#daily-tasks-open'), task = page.locator('#daily-tasks-list section').filter({ hasText: 'Взять карту из колоды' });
  await link.tap();
  await expect(task).toContainText('0/1');
  await expect(task.locator('button')).toBeDisabled();
  expect((await read(page)).profile.coins).toBe(save.profile.coins);
  await page.locator('#daily-tasks-dialog .sheet-actions button').tap();
  await openGame(page, recoverable);
  await touch(page, recoverable, { type: 'draw' });
  await expect.poll(async () => (await read(page)).attempt.board.stock.length).toBe(save.attempt.board.stock.length - 1);
  await page.locator('#menu').tap();
  await page.locator('#levels-open').tap();
  await link.tap();
  await expect(task).toContainText('1/1');
  await task.locator('button').tap();
  await expect(task.locator('button')).toHaveText('Получено');
  expect((await read(page)).profile.coins).toBe(save.profile.coins + 10);
  await page.reload();
  await link.tap();
  await expect(task.locator('button')).toHaveText('Получено');
  expect((await read(page)).profile.coins).toBe(save.profile.coins + 10);
});

test('beyond campaign preview continues from a real level 80 win into a saved new level at 320px', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_BEYOND80 !== '1', 'Requires the post-80 preview.');
  const last = content8Late.at(-1)!;
  let save = freshSave(last, 'p33-level80-boundary');
  for (const move of last.winningPath.slice(0, -1)) save = dispatch(save, move, last).next;
  await loadWaveFixture(page, save, 79);
  await openGame(page, last);
  await touch(page, last, last.winningPath.at(-1)!);
  await expect(page.locator('#result')).toHaveAttribute('data-won', 'true');
  await expect(page.locator('#next-level')).toContainText('81');
  await page.locator('#next-level').tap();
  if (await page.locator('#difficulty-play').isVisible()) await page.locator('#difficulty-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', 'campaign-c8-beyond-81-r1');
  const issued = await read(page);
  expect(issued.attempt.board.movesLeft).toBe(53);
  expect(issued.platform?.completedCampaign).toContain(campaignId(80));
  await page.reload();
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', 'campaign-c8-beyond-81-r1');
  expect((await read(page)).attempt).toEqual(issued.attempt);
});

test('locale preview preserves a Russian attempt until the player confirms starting over in English', async ({ page }) => {
  test.skip(process.env.VITE_CONTENT8_LOCALE !== '1', 'Requires the locale preview.');
  const ru = beyond80Deals[0], save = freshSave(ru, 'p34-russian-pinned');
  await loadWaveFixture(page, save, 80);
  await openGame(page, ru);
  await touch(page, ru, { type: 'draw' });
  await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(52);
  const pinned = (await read(page)).attempt;
  await page.locator('#menu').tap();
  await page.locator('#pause-options summary').tap();
  await page.locator('#card-language').selectOption('en');
  await expect.poll(async () => (await read(page)).settings.contentLanguage).toBe('en');
  expect((await read(page)).attempt).toEqual(pinned);
  const restart = page.locator('#locale-restart');
  await restart.tap();
  await expect(page.locator('#restart-confirm-copy')).toContainText('история ходов этой попытки');
  await page.locator('#restart-confirm-yes').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', 'campaign-c8-beyond-81-en-r1');
  const started = await read(page);
  expect(started.attempt.undo).toEqual([]);
  expect(started.attempt.board.movesLeft).toBe(55);
  expect(started.profile.coins).toBe(save.profile.coins);
  await page.reload();
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', 'campaign-c8-beyond-81-en-r1');
  expect((await read(page)).attempt.id).toBe(started.attempt.id);
});
