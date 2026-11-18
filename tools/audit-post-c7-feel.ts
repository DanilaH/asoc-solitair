/** Audit real browser input against the frozen campaign and daily. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import { preview } from 'vite';
import { campaignDeals } from '../src/content/campaign';
import { dailyForDay } from '../src/content/daily';
import { dispatch, freshSave, sourceCards } from '../src/domain/engine';
import { localDay } from '../src/domain/meta';
import { campaignId } from '../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../src/domain/types';
import { boardFrame, layout } from '../src/game/layout';

const out = process.env.ASOC_FEEL_OUTPUT ?? '.recording/post-c7-audit';
const dist = process.env.ASOC_FEEL_DIST ?? 'dist';
const port = Number(process.env.ASOC_FEEL_PORT ?? 4195);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);

type Scenario = {
  name: string; deal: Deal; prefix?: number; actions: number;
  lesson?: 'joker' | 'ordered' | 'keys'; next?: true; daily?: true; cancel?: true;
};
const campaign = (number: number) => campaignDeals[number - 1];
const finalKeyIndex = (deal: Deal) => {
  let save = freshSave(deal, 'find-key');
  return deal.winningPath.findIndex(command => {
    const result = dispatch(save, command, deal);
    save = result.next;
    return result.events.some(event => event.type === 'unlock');
  });
};
const daily = dailyForDay(localDay());
const scenarios: Scenario[] = [
  { name: 'opening-next', deal: campaign(1), actions: campaign(1).winningPath.length, next: true },
  { name: 'buffer-cancel', deal: campaign(4), actions: 3, cancel: true },
  { name: 'optional-joker', deal: campaign(8), actions: 2, lesson: 'joker' },
  { name: 'ordered', deal: campaign(30), actions: 5, lesson: 'ordered' },
  { name: 'last-key', deal: campaign(49), prefix: finalKeyIndex(campaign(49)), actions: 1, lesson: 'keys' },
  { name: 'dense-deck', deal: campaign(76), actions: 5 },
  { name: 'final-wallet', deal: campaign(80), prefix: campaign(80).winningPath.length - 1, actions: 1, next: true },
  { name: 'daily-resume', deal: daily, actions: 3, daily: true },
];

async function geometry(page: Page, deal: Deal) {
  const save = await read(page);
  const root = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(root.width, root.height, save.settings.deckPosition, deal);
  const board = layout(save.attempt.board, deal, frame.height, save.settings.deckSide, save.settings.deckPosition);
  const point = ({ x, y }: {x: number; y: number}) => ({ x: root.x + frame.offsetX + x * frame.unit, y: root.y + y * frame.unit });
  return { save, board, point, root };
}
async function action(page: Page, deal: Deal, command: BoardCommand, mode: 'tap' | 'cancel' = 'tap') {
  const { save, board, point, root } = await geometry(page, deal);
  const expected = dispatch(save, command, deal, localDay());
  if (!expected.accepted) throw Error('Fixture command refused: ' + JSON.stringify(command));
  const before = await page.evaluate(() => performance.now());
  if (command.type === 'transfer') {
    const id = sourceCards(save.attempt.board, command.from, deal).at(-1);
    const source = point(board.poses.find(p => p.id === id)!);
    const target = point(board.targets.find(t => t.location.kind === command.to.kind && t.location.index === command.to.index)!);
    if (mode === 'cancel') {
      const cdp = await page.context().newCDPSession(page);
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [source] });
        for (let step = 1; step <= 6; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: source.x, y: source.y + (root.y + root.height - 20 - source.y) * step / 6 }] });
          await page.waitForTimeout(30);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      } finally { await cdp.detach(); }
    } else {
      await page.touchscreen.tap(source.x, source.y);
      await page.touchscreen.tap(target.x, target.y);
    }
  } else {
    const stock = point(board.stock);
    await page.touchscreen.tap(stock.x, stock.y);
  }
  await expect.poll(async () => (await read(page)).attempt.board).toEqual(mode === 'cancel' ? save.attempt.board : expected.next.attempt.board);
  await page.waitForTimeout(mode === 'cancel' ? 400 : 385);
  const after = await read(page);
  if (mode === 'cancel') expect(after).toEqual(save);
  return { mode, before, revisionBefore: save.revision, revisionAfter: after.revision,
    boardBefore: hash(save.attempt.board), boardAfter: hash(after.attempt.board), command,
    modelEvents: mode === 'cancel' ? [] : expected.events.map(event => event.type) };
}

await mkdir(out, { recursive: true });
const server = await preview({ build: { outDir: dist }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch();
const rows: object[] = [];
try {
  for (const [width, height] of [[360,780],[320,568]] as const) {
    for (const [index, scenario] of scenarios.entries()) {
      const { name, deal, prefix = 0, lesson } = scenario;
      if (prefix < 0) throw Error('Missing reference event: ' + name);
      const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:' + port, viewport: { width, height }, hasTouch: true, isMobile: true,
        recordVideo: { dir: join(out, 'raw'), size: { width, height } },
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          const events: object[] = [];
          Object.defineProperty(window, '__auditFeelTrace', { value: events });
          const setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            setItem.call(this, key, value);
            if (key === 'asoc-solitaire.save.v1') {
              const saved = JSON.parse(value);
              events.push({ kind: 'save', at: performance.now(), revision: saved.revision, phase: saved.attempt.board.phase });
            }
          };
          const start = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function (...args) {
            events.push({ kind: 'audio-start', at: performance.now(), clipSeconds: this.buffer?.duration ?? 0 });
            return start.apply(this, args);
          };
        });
        let save = freshSave(deal, `feel-${name}-${width}`);
        save.settings.sfx = true;
        save.settings.deckSide = index % 2 ? 'left' : 'right';
        save.settings.deckPosition = width === 320 ? 'bottom' : 'top';
        save.settings.reducedMotion = false;
        save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
          completedCampaign: Array.from({ length: (deal.campaignLevel ?? 1) - 1 }, (_, n) => campaignId(n + 1)) };
        if (deal.campaignLevel !== 1) {
          save.campaign = { version: 1, tutorials: ['learn:category','learn:match','learn:stock','hint-demo','undo-used',
            ...['joker','ordered','keys'].filter(rule => rule !== lesson).map(rule => 'intro:' + rule)] };
        }
        for (const command of deal.winningPath.slice(0, prefix)) save = dispatch(save, command, deal, localDay()).next;
        await page.goto('/');
        await page.locator('#app[data-ready=true]').waitFor();
        await page.evaluate(value => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(value)), save);
        await page.reload();
        await page.locator('#app[data-ready=true]').waitFor();
        await page.locator(scenario.daily ? '#daily-play' : '#home-play').tap();
        await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', deal.id);
        if (lesson === 'joker') await page.locator('#joker').tap();
        if (lesson) {
          await expect(page.locator('#learn-rule')).toHaveAttribute('data-rule', lesson);
          const before = await read(page);
          await page.locator('#learn-rule .primary').tap();
          expect((await read(page)).attempt).toEqual(before.attempt);
        }
        if (lesson === 'joker') {
          const before = await read(page);
          await page.locator('#joker').tap();
          await expect(page.locator('#joker')).toHaveAttribute('aria-pressed', 'true');
          await page.keyboard.press('Escape');
          expect((await read(page)).attempt).toEqual(before.attempt);
        }
        await page.waitForTimeout(500);
        const actions = [];
        const witnessed = deal.winningPath.slice(prefix, prefix + scenario.actions);
        if (scenario.cancel) actions.push(await action(page, deal, witnessed[0], 'cancel'));
        for (const command of witnessed) actions.push(await action(page, deal, command));
        if (scenario.next) {
          await expect(page.locator('#result')).toBeVisible();
          const won = await read(page);
          expect(won.attempt.board.phase).toBe('won');
          await page.locator('#next-level').tap();
          if (deal.campaignLevel === 80) await expect(page.locator('#home')).toBeVisible();
          else {
            await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', campaign(2).id);
            await page.waitForTimeout(450);
            actions.push(await action(page, campaign(2), campaign(2).winningPath[0]));
          }
          expect((await read(page)).profile.coins).toBe(won.profile.coins);
        }
        const trace = await page.evaluate(() => (window as unknown as { __auditFeelTrace: object[] }).__auditFeelTrace);
        if (scenario.daily) {
          const played = await read(page);
          await page.reload();
          await page.locator('#app[data-ready=true]').waitFor();
          await page.locator('#daily-play').tap();
          expect((await read(page)).attempt).toEqual(played.attempt);
        }
        expect(errors).toEqual([]);
        const video = page.video()!;
        await context.close();
        await video.saveAs(join(out, `${name}-${width}.webm`));
        rows.push({ name, viewport: { width, height }, dealId: deal.id, prefix, attemptId: save.attempt.id,
          rulesVersion: save.rulesVersion, contentVersion: save.contentVersion, balanceVersion: save.balanceVersion,
          initialBoardSHA: hash(save.attempt.board), deckSide: save.settings.deckSide, deckPosition: save.settings.deckPosition,
          actions, trace });
        await writeFile(join(out, 'evidence.json'), JSON.stringify({
          htmlSHA: createHash('sha256').update(await readFile(join(dist, 'index.html'))).digest('hex'), rows,
        }, null, 2) + '\n');
        console.info(name, width, 'PASS', actions.length);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await new Promise<void>(resolve => server.httpServer.close(() => resolve()));
}
