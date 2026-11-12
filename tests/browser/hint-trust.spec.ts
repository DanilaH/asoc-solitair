import { expect, test, type Page } from '@playwright/test';
import { campaignDeals } from '../../src/content/campaign';
import { applyBoard, freshSave, packet } from '../../src/domain/engine';
import { boardFrame, layout } from '../../src/game/layout';
import blocked from '../fixtures/hint-blocked.json' with { type: 'json' };
import type { Board, BoardCommand, Save } from '../../src/domain/types';
const read = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
async function load(p: Page, index: number, board?: Board) {
  await p.goto('/'); await p.locator('#app[data-ready=true]').waitFor();
  const s = freshSave(campaignDeals[index], 'hint-trust');
  if (board) s.attempt.board = structuredClone(board);
  s.settings.reducedMotion = true;
  s.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0, completedCampaign: campaignDeals.slice(0, index).map(d => d.id) };
  s.campaign = { version: 1, tutorials: ['hint-demo','undo-used','intro:joker','intro:ordered','intro:keys'] };
  await p.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), s);
  await p.reload(); await p.locator('#app[data-ready=true]').waitFor(); await p.locator('#home-play').tap();
}
async function move(p: Page, index: number, a: BoardCommand) {
  const s = await read(p), d = campaignDeals[index], r = (await p.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, s.settings.deckPosition, d), g = layout(s.attempt.board, d, f.height, s.settings.deckSide, s.settings.deckPosition);
  const tap = (q: { x: number; y: number }) => p.touchscreen.tap(r.x + f.offsetX + q.x * f.unit, r.y + q.y * f.unit);
  if (a.type !== 'transfer') await tap(g.stock);
  else {
    const id = a.from.kind === 'waste' ? s.attempt.board.waste.at(-1) : packet(s.attempt.board, a.from.index, d).at(-1);
    await tap(g.poses.find(q => q.id === id)!); await tap(g.targets.find(q => q.location.kind === a.to.kind && q.location.index === a.to.index)!);
  }
  await expect.poll(async () => (await read(p)).revision).toBeGreaterThan(s.revision);
}
async function controlledWorker(p: Page) {
  await p.addInitScript(() => {
    const Native = window.Worker;
    (window as any).hintWorkers = [];
    window.Worker = class {
      onmessage: any; onerror: any; requests: any[] = []; terminated = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        if (!String(url).includes('hint.worker')) return new Native(url, options) as any;
        (window as any).hintWorkers.push(this);
      }
      postMessage(data: any) { this.requests.push(data); }
      terminate() { this.terminated = true; }
      emit(index: number, result: any) { const q = this.requests[index]; this.onmessage?.({ data: { requestId: q.requestId, revision: q.revision, attemptId: q.attemptId, dealId: q.deal.id, ...result } }); }
    } as any;
  });
}
test('real unsolvable remainder keeps its charge, board, wallet and streak', async ({ page }) => {
  await load(page, 18, blocked as Board); const before = await read(page);
  await page.locator('#hint').tap();
  await expect(page.locator('#message')).toContainText('Решения без помощников нет');
  const after = await read(page);
  expect(after.profile).toEqual(before.profile); expect(after.attempt).toEqual(before.attempt);
  await expect(page.locator('#hint-label')).toHaveText('Подсказка');
});
test('choosing a different free foundation still gives a verified real-worker hint', async ({ page }) => {
  const d = campaignDeals[5]; let board = d.initial;
  for (const action of d.winningPath) {
    if (action.type === 'transfer' && action.to.kind === 'foundation' && !board.foundations[action.to.index].length) {
      const other = board.foundations.findIndex((x, i) => i !== action.to.index && !x.length);
      if (other >= 0) { const n = applyBoard(board, { ...action, to: { ...action.to, index: other } }, d); if (typeof n === 'string') throw Error(n); board = n.board; break; }
    }
    const n = applyBoard(board, action, d); if (typeof n === 'string') throw Error(n); board = n.board;
  }
  await load(page, 5, board); const before = await read(page); await page.locator('#hint').tap();
  await expect(page.locator('#hint-label')).toHaveText('Повторить');
  expect((await read(page)).profile.hints).toBe(before.profile.hints - 1);
  expect((await read(page)).attempt.board).toEqual(before.attempt.board);
});
test('unknown search and worker failure preserve the charge; a later retry works', async ({ page }) => {
  await controlledWorker(page); await load(page, 16); const before = await read(page);
  await page.locator('#hint').tap();
  await page.evaluate(() => (window as any).hintWorkers[0].emit(0, { status: 'UNKNOWN' }));
  await expect(page.locator('#message')).toContainText('Не удалось найти продолжение');
  expect((await read(page)).profile).toEqual(before.profile);
  await page.locator('#hint').tap();
  await page.evaluate(() => (window as any).hintWorkers[0].onerror({}));
  await expect(page.locator('#message')).toContainText('Не удалось подготовить');
  expect((await read(page)).profile).toEqual(before.profile);
  await page.locator('#hint').tap();
  await page.evaluate(action => (window as any).hintWorkers[1].emit(0, { status: 'SOLVED', action }), campaignDeals[16].winningPath[0]);
  await expect.poll(async () => (await read(page)).profile.hints).toBe(before.profile.hints - 1);
});
test('stale and duplicate replies cannot charge or cancel a newer request; repeat is free', async ({ page }) => {
  await controlledWorker(page); await load(page, 16); const before = await read(page);
  await page.locator('#hint').tap(); await move(page, 16, campaignDeals[16].winningPath[0]);
  await page.evaluate(action => (window as any).hintWorkers[0].emit(0, { status: 'SOLVED', action }), campaignDeals[16].winningPath[0]);
  await expect(page.locator('#hint')).toBeEnabled(); expect((await read(page)).profile.hints).toBe(before.profile.hints);
  await page.locator('#hint').tap();
  await page.evaluate(action => (window as any).hintWorkers[0].emit(0, { status: 'SOLVED', action }), campaignDeals[16].winningPath[0]);
  await expect(page.locator('#hint')).toBeDisabled();
  await page.evaluate(action => { const w = (window as any).hintWorkers[0]; w.emit(1, { status: 'SOLVED', action }); w.emit(1, { status: 'SOLVED', action }); }, campaignDeals[16].winningPath[1]);
  await expect(page.locator('#hint-label')).toHaveText('Повторить');
  expect((await read(page)).profile.hints).toBe(before.profile.hints - 1);
  const shown = await read(page); await page.locator('#hint').tap(); expect((await read(page)).profile).toEqual(shown.profile);
});
test('timeout terminates the worker and an already queued reply cannot spend a charge', async ({ page }) => {
  await controlledWorker(page); await load(page, 16); const before = await read(page);
  await page.locator('#hint').tap(); await expect(page.locator('#message')).toContainText('Поиск занял слишком много времени', { timeout: 7000 });
  await page.evaluate(action => (window as any).hintWorkers[0].emit(0, { status: 'SOLVED', action }), campaignDeals[16].winningPath[0]);
  expect((await read(page)).profile).toEqual(before.profile); await expect(page.locator('#hint')).toBeEnabled();
  await page.locator('#hint').tap();
  await page.evaluate(() => (window as any).hintWorkers[0].onerror({}));
  await expect(page.locator('#hint')).toBeDisabled();
  await page.evaluate(action => (window as any).hintWorkers[1].emit(0, { status: 'SOLVED', action }), campaignDeals[16].winningPath[0]);
  await expect(page.locator('#hint-label')).toHaveText('Повторить');
  expect((await read(page)).profile.hints).toBe(before.profile.hints - 1);
});
test('category reader shows its full meaning without altering the compact label or save', async ({ page }) => {
  const d = campaignDeals[5]; let board = d.initial;
  for (const action of d.winningPath) {
    if (board.tableau.some(c => c.at(-1) === 'kitchen') || board.waste.at(-1) === 'kitchen') break;
    const next = applyBoard(board, action, d); if (typeof next === 'string') throw Error(next); board = next.board;
  }
  await load(page, 5, board); const before = await read(page);
  const r = (await page.locator('#game-root').boundingBox())!, f = boardFrame(r.width, r.height, undefined, d), g = layout(before.attempt.board, d, f.height), pose = g.poses.find(q => q.id === 'kitchen')!;
  await page.locator('#inspect').tap(); await page.touchscreen.tap(r.x + f.offsetX + pose.x * f.unit, r.y + pose.y * f.unit);
  await expect(page.locator('#word-title')).toHaveText('Кухонная утварь');
  await expect(page.locator('#word-description')).toContainText('готовят еду');
  await expect(page.locator('#word-description')).toContainText('посуда'); await page.locator('#inspect-dialog .primary').tap();
  expect((await read(page)).profile).toEqual(before.profile); expect((await read(page)).attempt.board).toEqual(before.attempt.board);
});
