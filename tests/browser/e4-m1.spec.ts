import { expect, test, type Page } from '@playwright/test';
import { campaignCoreDeals, findDeal } from '../../src/content/campaign';
import { restoreCampaignStock } from '../../src/domain/campaign-recovery';
import type { BoardCommand, Save } from '../../src/domain/types';
import { play, profileAt } from '../fixtures/functional-audit-225';
import paths from '../fixtures/functional-audit-225-stuck.json' with { type: 'json' };
import { move, read } from './wallet-fixture';

const before = process.env.ASOC_RECORD_BEFORE === '1';
const record = process.env.ASOC_E4_RECORD === '1';
test.skip(!before && (process.env.VITE_ASOC_PROFILE !== 'c8-release-v1' ||
  process.env.VITE_ASOC_ARCHIVE_227 === '1' || process.env.VITE_ASOC_ARCHIVE_229 === '1'), 'Requires an ordinary E4-M1 build');
if (record) test.use({ video: 'on' });

const baseline = findDeal('campaign-c8-wave-016-c8-core-r1-rights-r1')!;
const now = Date.UTC(2026, 10, 27, 12);
type Call = { method: string; options: Record<string, string> };
type Browser = Window & { stage2Ads: { calls: Call[]; fill: boolean; preload: () => void; replay: () => void } };
const game = (page: Page) => page.locator('#game-root');
const calls = (page: Page) => page.evaluate(() => (window as unknown as Browser).stage2Ads.calls);
const showCount = async (page: Page) => (await calls(page)).filter(call => call.method === 'show').length;

async function open(page: Page, save: Save, withAds = true) {
  save.contentVersion = 8;
  await page.clock.install({ time: new Date(now) });
  await page.addInitScript(({ save, withAds }) => {
    const key = 'asoc-solitaire.save.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
    if (!withAds) return;
    const calls: Call[] = [];
    let loaded = true, shown: object | null = null, earned: object | null = null, original: object | null = null;
    let onAd: ((event: object) => void) | undefined;
    const stage2Ads = { calls, fill: false,
      preload: () => { loaded = true; onAd?.({ kind: 'interstitial', phase: 'loaded' }); },
      replay: () => { earned = original; onAd?.({ kind: 'rewarded', phase: 'earned' }); } };
    const headers = (name: string, methods: string[], events = false) => ({ name,
      methods: [...methods.map(name => ({ name, rtype: 'promise' })),
        ...(events ? [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'callback' }] : [])] });
    Object.assign(window, { androidBridge: {}, stage2Ads,
      Capacitor: {
        PluginHeaders: [
          headers('App', ['getState'], true),
          headers('SolitaireStorage', ['get', 'set', 'remove', 'readRecoveryClock']),
          headers('SolitaireAudio', ['configure'], true), headers('SolitaireFeedback', ['pulse', 'cancel']),
          headers('SolitaireAnalytics', ['report']),
          headers('SolitaireAds', ['status', 'prepareInterstitial', 'discardInterstitial', 'show', 'pending', 'acknowledge',
            'pendingShown', 'acknowledgeShown', 'hideBanner', 'measureBanner', 'placeBanner', 'dispose'], true),
        ],
        async nativeCallback(plugin: string, _method: string, _options: object, callback: (event: object) => void) {
          if (plugin === 'SolitaireAds') onAd = callback;
          return 'listener';
        },
        async nativePromise(plugin: string, method: string, options: Record<string, string>) {
          if (plugin === 'App') return { isActive: true };
          if (plugin === 'SolitaireAudio') return { focused: true };
          if (plugin === 'SolitaireStorage') {
            if (method === 'get') return { value: localStorage.getItem(options.key) };
            if (method === 'set') localStorage.setItem(options.key, options.value);
            if (method === 'readRecoveryClock') return { boot: 1, elapsed: performance.now() };
          }
          if (plugin !== 'SolitaireAds') return {};
          calls.push({ method, options });
          if (method === 'status') return { ready: true, mode: 'test', rewarded: true, banner: true, interstitial: true, interstitialLoaded: loaded };
          if (method === 'discardInterstitial') loaded = false;
          if (method === 'pending') return { receipts: earned ? [earned] : [], activeLife: null };
          if (method === 'pendingShown') return { shown };
          if (method === 'acknowledge') earned = null;
          if (method === 'acknowledgeShown') shown = null;
          if (method === 'measureBanner') {
            const width = Number(options.viewportWidth), height = innerHeight;
            return { webView: { x: 0, y: 0, width, height }, root: { width, height }, adHeight: 50 };
          }
          if (method === 'show') {
            if (!stage2Ads.fill) return { shown: false, outcome: 'unavailable' };
            shown = { ...options, schema: 1, id: 'stage2-display', shownAt: Date.now() };
            if (options.kind === 'rewarded') earned = original = { ...options, schema: 1, id: 'stage2-earned' };
            return { shown: true, outcome: 'dismissed' };
          }
          return {};
        },
      },
    });
  }, { save, withAds });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  if (await page.locator('#home-play').isVisible()) await page.locator('#home-play').tap();
  await expect(game(page)).toHaveAttribute('data-dealing', '0');
  await page.waitForTimeout(400);
}

for (const watch of [false, true]) {
  test(`victory ${watch ? 'settles one video and advances' : 'continues without ads in one tap'}`, async ({ page }, info) => {
    test.skip(before && watch, 'One reference capture');
    const deal = findDeal('campaign-c8-dealer-006-bonus-r2')!;
    const save = play(profileAt(deal, 'stage2-near-win'), deal, deal.winningPath.slice(0, -1));
    save.settings.reducedMotion = false;
    await open(page, save);
    await move(page, deal, deal.winningPath.at(-1)!);
    await expect(page.locator('#result')).toBeVisible();
    if (record) await page.screenshot({ path: info.outputPath('victory.png'), scale: 'css' });
    if (before) return;
    const after = await read(page), video = page.locator('#win-video-claim');
    const byVideo = after.attempt.victory!.tierBase * 2;
    const total = byVideo + after.attempt.payout!.reduce((sum, row) => sum + row.coins, 0);
    await expect(video).toHaveAccessibleName(`Видео · всего ${total} монет, ×3 к базовой награде`);
    await expect(page.locator('#next-level')).toHaveText('Дальше');
    if (watch) {
      await video.tap();
      await expect(page.locator('#win-video-status')).toContainText('Видео недоступно');
      expect((await read(page)).profile.coins).toBe(after.profile.coins);
      expect((await read(page)).rewardOffers?.pending).toHaveLength(0);
      await page.evaluate(() => { (window as unknown as Browser).stage2Ads.fill = true; });
      await video.tap();
    } else await page.locator('#next-level').tap();
    await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ 7');
    expect(await showCount(page)).toBe(watch ? 2 : 0);
    expect((await read(page)).profile.coins).toBe(after.profile.coins + (watch ? byVideo : 0));
    if (watch) {
      await page.evaluate(() => (window as unknown as Browser).stage2Ads.replay());
      await expect.poll(async () => (await calls(page)).filter(call => call.method === 'acknowledge').length).toBe(2);
      expect((await read(page)).profile.coins).toBe(after.profile.coins + byVideo);
    }
    if (record) await page.waitForTimeout(1200);
  });
}

test('S2-A ordinary Next considers level-start only after the shared cooldown', async ({ page }) => {
  test.skip(before, 'Ordinary candidate');
  const deal = findDeal('campaign-c8-dealer-006-bonus-r2')!;
  const save = play(profileAt(deal, 'stage3-ad-eligible'), deal, deal.winningPath.slice(0, -1));
  save.campaign!.tutorials.push('intro:bonus-tableau', 'intro:bonus-foundation');
  save.attempt.teachingAds = { version: 1, ordinary: 2 };
  await open(page, save);
  await page.clock.fastForward(121_000);
  await move(page, deal, deal.winningPath.at(-1)!);
  await expect(page.locator('#next-level')).toHaveText('Дальше');
  await page.evaluate(() => { (window as unknown as Browser).stage2Ads.fill = true; });
  await page.locator('#next-level').tap();
  await expect(page.locator('#level-number')).toHaveText('УРОВЕНЬ 7');
  expect((await calls(page)).filter(call => call.method === 'show').map(call => call.options)).toMatchObject([
    { kind: 'interstitial', placement: 'level-start' },
  ]);
  expect((await read(page)).platform!.lastFullscreenAt).toBeGreaterThan(now);
});

test('Coffee has one fullscreen notice until a fresh preload, cooldown and accepted action', async ({ page }, info) => {
  const save = profileAt(baseline, 'stage2-coffee');
  save.settings.reducedMotion = false;
  await open(page, save);
  await page.clock.fastForward(181_000);
  const label = page.locator('.coffee-pause-label');
  await move(page, baseline, baseline.winningPath[0]);
  await expect(label).toBeVisible();
  if (record) {
    await page.waitForTimeout(290);
    await page.screenshot({ path: info.outputPath('coffee.png'), scale: 'css' });
  }
  if (before) return;
  expect(await label.boundingBox()).toMatchObject({ x: 0, y: 0, width: await page.evaluate(() => innerWidth), height: await page.evaluate(() => innerHeight) });
  await expect.poll(() => showCount(page)).toBe(1);
  await expect(label).toBeHidden();
  const first = await read(page);
  expect(first.platform?.lastFullscreenAt).toBe(0);
  expect(first.attempt.adBreakShown).toBeUndefined();
  await page.clock.fastForward(31_000);
  await move(page, baseline, baseline.winningPath[1]);
  await page.waitForTimeout(400);
  await expect(label).toBeHidden();
  expect(await showCount(page)).toBe(1);
  await page.evaluate(() => (window as unknown as Browser).stage2Ads.preload());
  await page.waitForTimeout(400);
  await expect(label).toBeHidden();
  await move(page, baseline, baseline.winningPath[2]);
  await expect(label).toBeVisible();
  await expect.poll(() => showCount(page)).toBe(2);
  await expect(label).toBeHidden();
});

test('a stuck campaign presents a closable panel without spending a life', async ({ page }, info) => {
  const [id, path] = Object.entries(paths)[0];
  const deal = findDeal(id)!;
  const save = play(profileAt(deal), deal, path as BoardCommand[]);
  Object.assign(save.profile, { hints: 0, undos: 0, coins: 0, jokers: 0 });
  save.campaignLives = { version: 2, remaining: 5, observedAt: now, earnedCredits: 0 };
  await open(page, save, false);
  const panel = page.locator('#dead-end');
  await expect(panel).toBeVisible();
  if (record) await page.screenshot({ path: info.outputPath('dead-end.png'), scale: 'css' });
  if (before) return;
  await panel.locator('#dead-end-dismiss').tap();
  await expect(panel).toBeHidden();
  expect((await read(page)).campaignLives?.remaining).toBe(5);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
  if (record) await page.waitForTimeout(800);
});

test('a paid recycle can be undone and refunded from the actual board', async ({ page }, info) => {
  const entry = [...campaignCoreDeals()].find(entry => entry.deal.campaignLevel === 16 && entry.deal.recovery && !entry.penalty)!;
  const deal = before ? entry.deal : findDeal(entry.deal.id + '-m1')!;
  let save = profileAt(deal);
  save.profile.coins = 500;
  save.profile.undos = 2;
  save.attempt.board.movesLeft = 500;
  const drain = () => { while (save.attempt.board.stock.length) save = play(save, deal, [{ type: 'draw' }]); };
  while (save.attempt.board.recyclesLeft) { drain(); save = play(save, deal, [{ type: 'recycle' }]); }
  drain();
  expect(restoreCampaignStock(save, deal, { attemptId: save.attempt.id, revision: save.revision, cost: 0 })).toBe(true);
  drain();
  if (before) delete save.attempt.restoreUndo;
  await open(page, save, false);
  const button = page.locator('#stock-recovery-button');
  await expect(button).toBeVisible();
  if (record) await page.screenshot({ path: info.outputPath('restore-quote.png'), scale: 'css' });
  if (before) return;
  await expect(button).toContainText('100');
  await button.tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(400);
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).profile.coins).toBe(500);
  expect((await read(page)).attempt.stockRestores).toBe(1);
  expect((await read(page)).attempt.board).toEqual(save.attempt.board);
  if (record) await page.screenshot({ path: info.outputPath('restore-refund.png'), scale: 'css' });
});
