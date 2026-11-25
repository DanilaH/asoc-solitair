import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { findDeal } from '../../src/content/campaign';
import { freshSave } from '../../src/domain/engine';
import { claimDailyBonus, openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import { updatePreviewTasks } from '../../src/domain/events/daily-tasks';
import { prepareShuffleBoard } from '../../src/domain/proof-shuffle';
import { campaignId } from '../../src/domain/progression';
import { SHUFFLE_INTRO_KEY } from '../../src/domain/shuffle-progression';
import { shuffleIntroWitness } from '../fixtures/mvp-shuffle';
import { move, read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary integrated C8 release build');
test.use({ timezoneId: 'UTC' });
if (process.env.ASOC_MVP_DEMO === '1') test.use({ video: 'on' });

const KEY = 'asoc-solitaire.save.v1', NOW = Date.UTC(2026, 10, 24, 12);
const deal = findDeal(shuffleIntroWitness.id)!;

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function bannerReserve(page: Page, info: TestInfo, name: string) {
  // Geometry fixture only: reserve the same slot as NativeBanner without claiming
  // a native SDK/ad render. The ordinary production profile and layout run unchanged.
  const manifest = await (await page.request.get('/release-manifest.json')).json();
  expect(manifest.id).toBe('c8-release-v1');
  await page.locator('#banner-slot').evaluate(slot => {
    slot.removeAttribute('hidden');
    slot.style.height = '60px';
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      banner: rect('#banner-slot'), board: rect('#game-root'), dock: rect('#dock'),
      buttons: ['hint', 'undo', 'joker', 'proof-shuffle'].map(id => {
        const element = document.getElementById(id)!, r = rect('#' + id);
        const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id, ...r, centerHit: Boolean(target && element.contains(target)) };
      }),
    };
  });
  expect(metrics.banner.height).toBe(60);
  expect(metrics.banner.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1);
  expect(metrics.dock.bottom).toBeLessThanOrEqual(metrics.banner.y + 1);
  expect(metrics.board.bottom).toBeLessThanOrEqual(metrics.dock.y + 1);
  for (const button of metrics.buttons) {
    expect(button.width, button.id).toBeGreaterThanOrEqual(44);
    expect(button.height, button.id).toBeGreaterThanOrEqual(44);
    expect(button.x, button.id).toBeGreaterThanOrEqual(0);
    expect(button.right, button.id).toBeLessThanOrEqual(metrics.viewport.width + 1);
    expect(button.bottom, button.id).toBeLessThanOrEqual(metrics.banner.y + 1);
    expect(button.centerHit, button.id).toBe(true);
  }
  const path = info.outputPath(name + '.json');
  await writeFile(path, JSON.stringify({ profile: manifest.id, head: manifest.commit,
    payloadSha256: manifest.webPayload.sha256, reserveSource: 'test-injected DOM slot; native SDK not executed', metrics }, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
  return metrics;
}

test('L30 grants its first Shuffle after an already claimed Bonus and commits a real worker proof once with the banner reserve', async ({ page }, info) => {
  test.setTimeout(60_000);
  expect(shuffleIntroWitness.prefix).toBe(0);
  expect(shuffleIntroWitness.seed).toBe(7);
  const save = freshSave(deal, 'mvp-shuffle-initial');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'learn:category',
    'learn:match', 'learn:stock', 'learn:covered-waste', 'hint-demo', 'hint-practiced', 'undo-used', 'joker-buffer'] };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: 29 }, (_, i) => campaignId(i + 1)) };
  updatePreviewTasks(save, NOW);
  const round = openDailyBonusRound(save, NOW, 'already-claimed-shuffle-intro', () => 0)!;
  for (const [index, column] of round.slots.entries()) if (column === 0) revealDailyBonusCard(save, round.roundId, index, NOW);
  expect(claimDailyBonus(save, round.roundId, NOW)).toEqual({ kind: 'Coins', quantity: 10 });
  expect(save.dailyTasks!.inventory.shuffles).toBe(0);
  expect(save.profile.rewards).not.toContain(SHUFFLE_INTRO_KEY);
  const sourceInitial = structuredClone(deal.initial);
  const expected = prepareShuffleBoard(sourceInitial, deal, shuffleIntroWitness.seed)!;
  expect(expected).toBeDefined();
  expect(expected).not.toEqual(sourceInitial);
  const workers: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(({ key, value, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    // The production worker and its 1.8s search bound are unchanged. Only the
    // requested random seed is fixed to the independently replayed initial witness.
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array: ArrayBufferView<ArrayBuffer>) {
        if (array instanceof Uint32Array && array.length === 1) { array[0] = seed; return array; }
        return original(array);
      },
    });
  }, { key: KEY, value: JSON.stringify(save), seed: shuffleIntroWitness.seed });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#home')).toBeVisible();
  await expect.poll(async () => (await read(page)).dailyTasks?.inventory.shuffles).toBe(1);
  const granted = await read(page);
  expect(granted.profile.rewards.filter(key => key === SHUFFLE_INTRO_KEY)).toHaveLength(1);
  expect(granted.dailyBonus).toEqual(save.dailyBonus);
  expect(granted.attempt.board).toEqual(sourceInitial);
  expect(granted.attempt.dealId).toBe(deal.id);
  expect(granted.attempt.board.movesLeft).toBe(124);
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#proof-shuffle')).toBeEnabled();
  await expect(page.locator('#proof-shuffle-label')).toHaveText('Перемешать');
  await expect(page.locator('#proof-shuffle-count')).toHaveText('1');
  await expect(page.locator('#proof-shuffle svg')).toBeVisible();
  await expect(page.locator('#proof-shuffle svg')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  const reserved = await bannerReserve(page, info, 'banner-layout-before');
  await capture(page, info, 'shuffle-before');

  const button = reserved.buttons.find(button => button.id === 'proof-shuffle')!;
  await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
  await expect(page.locator('#shuffle-warning')).toBeVisible();
  await expect(page.locator('#shuffle-warning')).toContainText('история отмены очистится');
  const consent = await read(page);
  expect(consent.attempt.board).toEqual(sourceInitial);
  expect(consent.dailyTasks!.inventory.shuffles).toBe(1);
  await capture(page, info, 'shuffle-consent');
  await page.locator('#shuffle-confirm').tap();
  await expect.poll(async () => (await read(page)).attempt.shuffleUsed, { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#proof-shuffle')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#proof-shuffle-label')).toHaveText('Использовано');
  await expect(page.locator('#proof-shuffle')).toBeDisabled();
  await expect(page.locator('#undo')).toBeDisabled();
  expect(workers.filter(url => url.includes('shuffle.worker'))).toHaveLength(1);
  const committed = await read(page);
  expect(committed.attempt.id).toBe(save.attempt.id);
  expect(committed.attempt.dealId).toBe(deal.id);
  expect(committed.attempt.board).toEqual(expected);
  expect(committed.attempt.board.movesLeft).toBe(sourceInitial.movesLeft);
  expect(committed.attempt.board.recyclesLeft).toBe(sourceInitial.recyclesLeft);
  expect(committed.attempt.board.faceUp).toEqual(sourceInitial.faceUp);
  expect(committed.attempt.undo).toEqual([]);
  expect(committed.dailyTasks!.inventory.shuffles).toBe(0);
  expect(committed.profile).toEqual(granted.profile);
  expect(committed.dailyBonus).toEqual(granted.dailyBonus);
  expect(deal.initial).toEqual(sourceInitial);
  await capture(page, info, 'shuffle-committed');

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  await expect(page.locator('#proof-shuffle-label')).toHaveText('Использовано');
  await expect(page.locator('#proof-shuffle')).toBeDisabled();
  const restored = await read(page);
  await bannerReserve(page, info, 'banner-layout-reloaded');
  expect(restored.attempt.board).toEqual(committed.attempt.board);
  expect(restored.attempt.undo).toEqual([]);
  expect(restored.dailyTasks!.inventory.shuffles).toBe(0);
  expect(restored.profile.rewards.filter(key => key === SHUFFLE_INTRO_KEY)).toHaveLength(1);
  expect(restored.dailyBonus).toEqual(granted.dailyBonus);
  await capture(page, info, 'shuffle-reloaded');

  // Real board input and Undo remain usable above the reserved native-ad area.
  await move(page, deal, { type: 'draw' });
  await expect(page.locator('#undo')).toBeEnabled();
  const afterDraw = await read(page);
  expect(afterDraw.attempt.board.movesLeft).toBe(sourceInitial.movesLeft! - 1);
  expect(afterDraw.attempt.undo).toHaveLength(1);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(committed.attempt.board);
  expect((await read(page)).attempt.undo).toEqual([]);
  expect((await read(page)).dailyTasks!.inventory.shuffles).toBe(0);
  await capture(page, info, 'banner-board-after-undo');
});
