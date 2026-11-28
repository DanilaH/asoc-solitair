import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { findDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { applyBoard, freshSave, sourceCards } from '../../src/domain/engine';
import { openDailyBonusRound } from '../../src/domain/events/daily-bonus';
import { campaignId } from '../../src/domain/progression';
import type { Deal, Save } from '../../src/domain/types';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { dismissTeaching } from '../../tools/qa/navigation';
import { read } from './wallet-fixture';

test.skip(process.env.VITE_ASOC_PROFILE !== 'c8-release-v1', 'Requires the ordinary integrated C8 release profile');
test.use({ video: 'on' });

const key = 'asoc-solitaire.save.v1';
const available = new Date('2026-11-25T12:00:00Z');
// Playwright runs the fixture code in Node. Use the published C8 IDs explicitly.
const issuedIds: Record<number, string> = {
  1: 'dealer-001',
  2: 'dealer-002',
  3: 'dealer-003',
  5: 'ftue-005-r1',
  8: 'ftue-008-r1',
  16: 'wave-016-c8-core-r1-rights-r1',
  17: 'ftue-017-r1',
  18: 'special-018',
  19: 'ftue-019-r1',
  21: 'wave-021',
  22: 'bonus-022-c8-core-r1-rights-r1',
  24: 'ftue-024-r1',
  26: 'special-026-core-special-r1',
  27: 'wave-027-core-special-r1',
  28: 'ftue-028-r1',
  30: 'bonus-030-c8-core-r1-shuffle-r1-rights-r1',
  32: 'ftue-032-r1',
  33: 'wave-033-shuffle-r2',
  36: 'wave-036-shuffle-r2',
  39: 'wave-039-shuffle-r2',
  40: 'bonus-040',
  45: 'special-045',
  66: 'special-066',
  80: 'wave-080',
};
const dealAt = (level: number) => findDeal('campaign-c8-' + issuedIds[level])!;

function fixture(deal: Deal, reduced = true) {
  const save = freshSave(deal, 'ui205-' + deal.id);
  save.contentVersion = 8;
  save.settings.reducedMotion = reduced;
  save.profile.coins = 1000;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: (deal.campaignLevel ?? 16) - 1 }, (_, index) => campaignId(index + 1)) };
  save.campaign = { version: 1, tutorials: ['intro:joker', 'intro:ordered', 'intro:keys', 'intro:keys:1',
    'learn:category', 'learn:match', 'learn:stock', 'hint-demo', 'undo-used', 'joker-used'] };
  return save;
}

async function seed(page: Page, deal: Deal, save: Save, banner = 0, origin = '/') {
  await page.goto(origin);
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key, save });
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.locator(deal.daily ? '#daily-play' : '#home-play').tap();
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
  if (banner) {
    await page.locator('#banner-slot').evaluate((node, size) => {
      node.removeAttribute('hidden');
      node.style.height = size + 'px';
    }, banner);
  }
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  await dismissTeaching(page);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function touchable(page: Page, selector: string, minimum = 44) {
  await page.locator(selector).evaluate(node => Promise.all(
    (node.closest('dialog')?.getAnimations() ?? []).map(animation => animation.finished.catch(() => undefined))));
  const result = await page.locator(selector).evaluate(node => {
    const r = node.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, width: r.width, height: r.height, hit: Boolean(hit && node.contains(hit)) };
  });
  expect(result.width, selector).toBeGreaterThanOrEqual(minimum);
  expect(result.height, selector).toBeGreaterThanOrEqual(minimum);
  expect(result.hit, selector).toBe(true);
  return result;
}

async function geometry(page: Page, deal: Deal) {
  const save = await read(page), area = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(area.width, area.height, save.settings.deckPosition, deal);
  const model = layout(save.attempt.board, deal, frame, save.settings.deckSide, save.settings.deckPosition);
  const point = ({ x, y }: { x: number; y: number }) => ({ x: area.x + frame.offsetX + x * frame.unit, y: area.y + y * frame.unit });
  return { save, area, frame, model, point };
}

const capture = (page: Page, info: TestInfo, name: string) =>
  page.screenshot({ path: info.outputPath(name + '.png'), scale: 'css' });

test('C8 viewport matrix and exact L16 and L30 comparisons', async ({ browser, request }, info) => {
  test.setTimeout(170_000);
  const manifest = await (await request.get('/release-manifest.json')).json();
  expect(manifest).toMatchObject({ id: 'c8-release-v1', contentVersion: 8, rulesVersion: 3, capabilities: {
    bonusSlots: 'active', frozenBoundPuzzleGoldenStarter: 'active', proofShuffle: 'active', purchases: 'off',
  } });
  const samples = [
    { width: 320, height: 480, dpr: 1, banner: 60, levels: [1, 16, 22, 40, 80] },
    { width: 320, height: 568, dpr: 3, banner: 90, levels: [2, 17, 19] },
    { width: 360, height: 640, dpr: 2, banner: 0, levels: [3, 8, 18, 30] },
    { width: 360, height: 780, dpr: 2, banner: 60, levels: [21, 24, 26, 27] },
    { width: 393, height: 851, dpr: 3, banner: 90, levels: [28, 32, 33] },
    { width: 412, height: 915, dpr: 2, banner: 0, levels: [36, 39, 45] },
    { width: 520, height: 700, dpr: 1, banner: 60, levels: [66, 80] },
    { width: 768, height: 1024, dpr: 2, banner: 0, levels: [30, 80] },
  ];
  const observed = [];
  for (const { width, height, dpr, banner, levels } of samples) {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width, height },
      deviceScaleFactor: dpr, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.clock.install({ time: available });
      const deals = levels.map(dealAt);
      if (width === 393) deals.push(dailyForDay('2026-11-25'));
      for (const [index, deal] of deals.entries()) {
        const saved = fixture(deal), level = deal.campaignLevel ?? 'daily';
        const comparison = width === 320 && height === 480 && level === 16 || width === 360 && height === 640 && level === 30;
        saved.settings.deckSide = !comparison && index % 2 ? 'left' : 'right';
        saved.settings.deckPosition = !comparison && index % 3 === 2 ? 'bottom' : 'top';
        await seed(page, deal, saved, deal.campaignLevel === 1 ? 0 : banner);
        const { area, frame, model, point } = await geometry(page, deal);
        const card = cardMetrics(deal);
        const reader = await touchable(page, '#inspect', 48);
        expect(reader.y - reader.height / 2).toBeGreaterThanOrEqual(area.y + area.height - 1);
        const shuffleLabel = await page.locator('#proof-shuffle-label').boundingBox();
        if (shuffleLabel) expect(shuffleLabel.y + shuffleLabel.height).toBeLessThanOrEqual(height);
        expect(await page.locator('html').evaluate(node => getComputedStyle(node).getPropertyValue('text-size-adjust'))).toBe('100%');
        const offers = [];
        for (const offer of model.offers) {
          const button = page.locator('#bonus-' + offer.kind);
          const box = (await button.locator('.board-bonus-face').boundingBox())!;
          const hit = (await button.boundingBox())!;
          expect(Math.abs(box.height - 166 / 138 * box.width)).toBeLessThan(1);
          const center = point(offer);
          expect(Math.abs(box.x + box.width / 2 - center.x)).toBeLessThan(1);
          expect(Math.abs(box.y + box.height / 2 - center.y)).toBeLessThan(1);
          expect(hit.width).toBeGreaterThanOrEqual(box.width - .1);
          expect(hit.width - box.width).toBeLessThanOrEqual(14 * frame.unit + .1);
          offers.push({ kind: offer.kind, box, hit });
        }
        const upper = model.targets.filter(target => target.location.kind === 'foundation').map(point);
        const lower = model.targets.filter(target => target.location.kind === 'tableau').map(point);
        lower.slice(0, upper.length).forEach((p, i) => expect(Math.abs(p.x - upper[i].x)).toBeLessThan(1));
        const stem = `${width}x${height}-L${level}`;
        await capture(page, info, stem);
        observed.push({ stem, id: deal.id, dpr, banner, area, deck: saved.settings.deckPosition,
          card: { width: card.width * frame.unit, height: card.height * frame.unit }, unit: frame.unit, reader,
          font: { bodyPx: 29 * frame.unit, categoryTabPx: 19 * frame.unit, stripMaxPx: 16 * frame.unit },
          upper, lower, offers, hitboxes: model.targets.map(({ width, height }) => [width * frame.unit, height * frame.unit]) });
        const baseline = process.env.ASOC_UI_BASELINE_URL;
        if (comparison && baseline) {
          await seed(page, deal, saved, banner, baseline);
          await capture(page, info, stem + '-before');
        }
      }
    } finally { await context.close(); }
  }
  await writeFile(info.outputPath('viewport-measurements.json'), JSON.stringify({ manifest: manifest.commit, observed }, null, 2));
});

test('stock tap classification survives DPR, tap jitter, pointer cancel and resize', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const deal = dealAt(16);
  for (const [width, height, dpr] of [[320, 480, 1], [360, 640, 2], [412, 915, 3]]) {
    const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width, height },
      deviceScaleFactor: dpr, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    try {
      const page = await ctx.newPage();
      await seed(page, deal, fixture(deal), 60);
      const cdp = await ctx.newCDPSession(page);
      const initial = await geometry(page, deal);
      const p = initial.point(initial.model.stock);
      const start = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
      const offset = (delta: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x - delta, y: p.y }] });
      const end = (cancelled = false) => cdp.send('Input.dispatchTouchEvent', { type: cancelled ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await start(); await offset(12); await offset(0); await end();
      expect((await read(page)).attempt.undo.length).toBe(initial.save.attempt.undo.length);
      await start(); await offset(8); await end(true);
      expect((await read(page)).attempt.board).toEqual(initial.save.attempt.board);
      await start(); await offset(8); await end();
      await expect.poll(async () => (await read(page)).attempt.board.stock.length).toBe(initial.save.attempt.board.stock.length - 1);
      expect((await read(page)).attempt.undo).toHaveLength(initial.save.attempt.undo.length + 1);
      await page.locator('#undo').tap();
      await expect.poll(async () => (await read(page)).attempt.board).toEqual(initial.save.attempt.board);
      const beforeResize = await read(page);
      await start();
      await page.setViewportSize({ width, height: height - 12 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await end();
      expect((await read(page)).attempt.undo).toEqual(beforeResize.attempt.undo);
      expect((await read(page)).profile).toEqual(beforeResize.profile);
    } finally { await ctx.close(); }
  }
});

test('compact Home, helpers and a committed Bonus reveal are reachable through real taps', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.clock.install({ time: available });
  const deal = dealAt(16), save = fixture(deal, false);
  const date = available.getTime();
  const bonus = openDailyBonusRound(save, date, 'c8-ui-205', () => 0, 'azur-compiled-r1')!;
  const matching = bonus.slots.flatMap((column, index) => column === bonus.slots[0] ? [index] : []);
  await page.goto('/');
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key, save });
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await touchable(page, '#home-play');
  await capture(page, info, 'home-320');
  await page.locator('#menu').tap();
  if (!await page.locator('#helpers-open').isVisible()) await page.locator('#pause-options summary').tap();
  await page.locator('#helpers-open').tap();
  await expect(page.locator('#helper-inventory-future')).toBeVisible();
  await capture(page, info, 'helpers-320');
  await page.locator('#helper-return').tap();
  await page.locator('#settings-done').tap();
  const entry = await touchable(page, '#daily-bonus-open');
  await page.touchscreen.tap(entry.x, entry.y);
  const dialog = page.locator('#daily-bonus-dialog'), cards = dialog.locator('.daily-bonus-card');
  await expect(cards).toHaveCount(12);
  await expect(cards).toHaveText(Array(12).fill(''));
  await touchable(page, '#daily-bonus-dialog .close');
  await capture(page, info, 'daily-bonus-closed');
  for (const [opened, index] of matching.entries()) {
    const card = await touchable(page, `.daily-bonus-card:nth-child(${index + 1})`);
    await page.touchscreen.tap(card.x, card.y);
    await expect(cards.nth(index)).toHaveAttribute('data-revealed', 'true');
    await expect(cards.nth(index)).toContainText(`${opened + 1}/3`);
    await expect.poll(async () => (await read(page)).dailyBonus?.revealed).toEqual(matching.slice(0, opened + 1));
    expect((await read(page)).profile.coins).toBe(save.profile.coins);
    await page.waitForTimeout(250);
    await capture(page, info, 'daily-bonus-' + (opened + 1));
  }
  const claim = await touchable(page, '#daily-bonus-claim');
  const lastCard = (await cards.last().boundingBox())!;
  const bonusBody = (await dialog.locator('.sheet-body').boundingBox())!;
  expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(bonusBody.y + bonusBody.height + 1);
  await page.touchscreen.tap(claim.x, claim.y);
  await expect.poll(async () => (await read(page)).dailyBonus?.claimed).toBe(true);
  const after = (await read(page)).profile.coins;
  await page.touchscreen.tap(claim.x, claim.y);
  expect((await read(page)).profile.coins).toBe(after);
});

test('raw purchase keeps bonus at its reserved axis and returns through Undo', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const deal = dealAt(40), save = fixture(deal, false);
  await seed(page, deal, save, 60);
  const source = await geometry(page, deal);
  const offer = source.model.offers.find(slot => slot.kind === 'foundation')!;
  const p = source.point(offer);
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('#bonus-offer')).toBeVisible();
  expect((await read(page)).profile.coins).toBe(source.save.profile.coins);
  await capture(page, info, 'bonus-extra-slot-confirmation');
  await page.locator('#bonus-buy').tap();
  await expect(page.locator('#bonus-foundation')).toBeHidden();
  const after = await geometry(page, deal);
  expect(after.area).toEqual(source.area);
  expect(after.model.targets.find(slot => slot.location.kind === 'foundation' && slot.location.index === 4)).toMatchObject({ x: offer.x, y: offer.y });
  const move = deal.winningPath.find(cmd => cmd.type === 'transfer' && cmd.to.kind === 'foundation')!;
  if (move.type !== 'transfer') throw Error('Fixture has no transfer');
  const next = applyBoard(after.save.attempt.board, { ...move, to: { kind: 'foundation', index: 4 } }, deal);
  expect(typeof next).not.toBe('string');
  const id = sourceCards(after.save.attempt.board, move.from, deal).at(-1);
  const from = after.point(after.model.poses.find(pose => pose.id === id)!);
  await page.touchscreen.tap(from.x, from.y);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(async () => (await read(page)).attempt.board.foundations[4].length).toBeGreaterThan(0);
  await capture(page, info, 'bonus-extra-slot-after-transfer');
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(after.save.attempt.board);
  await expect(page.locator('#bonus-foundation')).toBeHidden();
});

test('real-time draw, Undo, drag, result and Next on C8', async ({ page, context }, info) => {
  test.setTimeout(65_000);
  await page.setViewportSize({ width: 360, height: 640 });
  const deal = dealAt(16), saved = fixture(deal, false);
  await seed(page, deal, saved);
  await capture(page, info, 'motion-initial');
  await page.evaluate(() => {
    const marks: number[] = [];
    Object.assign(window, { qa205Frames: marks });
    const start = performance.now();
    function frame(now: number) {
      marks.push(now - start);
      if (now - start < 2600) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  const initial = await geometry(page, deal);
  const p = initial.point(initial.model.stock);
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(async () => (await read(page)).attempt.board.stock.length).toBe(initial.save.attempt.board.stock.length - 1);
  await page.waitForTimeout(300);
  await capture(page, info, 'motion-draw');
  await page.locator('#undo').tap();
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(initial.save.attempt.board);
  await page.waitForTimeout(230);

  const first = deal.winningPath[0];
  if (first.type !== 'transfer') throw Error('Expected opening transfer');
  const g = await geometry(page, deal);
  const top = sourceCards(g.save.attempt.board, first.from, deal).at(-1);
  const source = g.point(g.model.poses.find(pose => pose.id === top)!);
  const target = g.point(g.model.targets.find(t => t.location.kind === first.to.kind && t.location.index === first.to.index)!);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [source] });
  for (let step = 1; step <= 10; step++) {
    const d = step / 10;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ x: source.x + d * (target.x - source.x), y: source.y + d * (target.y - source.y) }] });
    await page.waitForTimeout(18);
  }
  await capture(page, info, 'motion-drag-held');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect.poll(async () => (await read(page)).attempt.board.foundations[first.to.index].length).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await capture(page, info, 'motion-drag-landed');
  const frames = await page.evaluate(() => (window as Window & { qa205Frames?: number[] }).qa205Frames);
  await writeFile(info.outputPath('browser-frame-intervals.json'), JSON.stringify(frames));

  // Reuse a legal pre-win position, then perform the last command through touch.
  for (const command of deal.winningPath.slice(0, -1)) {
    const next = applyBoard(saved.attempt.board, command, deal);
    if (typeof next === 'string') throw Error(next);
    saved.attempt.board = next.board;
  }
  await seed(page, deal, saved);
  const finish = deal.winningPath.at(-1)!, geo = await geometry(page, deal);
  if (finish.type !== 'transfer') throw Error('Expected final transfer');
  const id = sourceCards(geo.save.attempt.board, finish.from, deal).at(-1);
  const from = geo.point(geo.model.poses.find(pose => pose.id === id)!);
  const to = geo.point(geo.model.targets.find(t => t.location.kind === finish.to.kind && t.location.index === finish.to.index)!);
  await page.touchscreen.tap(from.x, from.y);
  await page.touchscreen.tap(to.x, to.y);
  await expect(page.locator('#result')).toBeVisible();
  await page.waitForTimeout(780);
  await capture(page, info, 'result-win');
  await expect(page.locator('#next-level')).toHaveText('Забрать');
  const claim = await touchable(page, '#next-level');
  await page.touchscreen.tap(claim.x, claim.y);
  await expect(page.locator('#next-level')).toHaveText('Дальше');
  const next = await touchable(page, '#next-level');
  await page.touchscreen.tap(next.x, next.y);
  await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', dealAt(17).id);
  await dismissTeaching(page);
  await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
  await capture(page, info, 'next-L17-special');
});
