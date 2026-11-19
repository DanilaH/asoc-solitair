import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect, type Page } from '@playwright/test';
import { preview } from 'vite';
import { content8Slice } from '../../src/content/campaign-v8-preview';
import { applyBoard, freshSave, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';

const dist = '.recording/content8/dist', output = '.recording/content8/ui';
const port = Number(process.env.C8_PORT ?? 4230);
const levels = (process.env.C8_RECORD_LEVELS ?? '15').split(',').map(Number);
const width = Number(process.env.C8_WIDTH ?? 360), height = Number(process.env.C8_HEIGHT ?? 780);
const slug = levels.join('-') + '-' + width;
const recordDir = `${output}/${slug}`;
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const read = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('asoc-solitaire.save.v1')!) as Save);
await mkdir(recordDir, { recursive: true });
const runtime = sha(await readFile(`${dist}/index.html`));
const server = await preview({ build: { outDir: dist }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: `http://127.0.0.1:${port}`,
  viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  ...(process.env.C8_VIDEO === '1' ? { recordVideo: { dir: recordDir, size: { width, height } } } : {}),
});
const page = await context.newPage(), errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const evidence = [];

async function perform(d: Deal, cmd: BoardCommand, before: Save) {
  const root = (await page.locator('#game-root').boundingBox())!;
  const frame = boardFrame(root.width, root.height, before.settings.deckPosition, d);
  const g = layout(before.attempt.board, d, frame.height, before.settings.deckSide, before.settings.deckPosition);
  const position = ({ x, y }: { x: number; y: number }) => ({ x: root.x + frame.offsetX + x * frame.unit, y: root.y + y * frame.unit });
  const tap = async (pt: { x: number; y: number }) => {
    assert(pt.x >= 0 && pt.x < width && pt.y >= 0 && pt.y < height);
    await page.touchscreen.tap(pt.x, pt.y);
  };
  if (cmd.type === 'transfer') {
    const group = sourceCards(before.attempt.board, cmd.from, d);
    const front = g.poses.filter(p => group.includes(p.id)).at(-1)!;
    const dest = g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!;
    await tap(position(front)); await tap(position(dest));
  } else await tap(position(g.stock));
  const expected = applyBoard(before.attempt.board, cmd, d);
  assert(typeof expected !== 'string');
  await expect.poll(async () => (await read(page)).attempt.board, { timeout: 4500 }).toEqual(expected.board);
  if (!before.settings.reducedMotion) await page.waitForTimeout(cmd.type === 'draw' ? 315 : cmd.type === 'recycle' ? 405 : 225);
}

try {
  const first = content8Slice.find(d => d.campaignLevel === levels[0])!;
  const save = freshSave(first, `reference-ui-${slug}`);
  save.contentVersion = 8;
  save.settings.sfx = false;
  save.settings.reducedMotion = process.env.C8_REDUCED === '1';
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: levels[0] - 1 }, (_, i) => campaignId(i + 1)),
  };
  save.campaign = { version: 1, tutorials: ['learn:category','learn:match','learn:stock','hint-demo','undo-used','intro:joker'] };
  await page.goto('/');
  await page.locator('#app[data-ready=true]').waitFor();
  await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
  await page.reload();
  await page.locator('#app[data-ready=true]').waitFor();
  await page.locator('#home-play').tap();
  for (const [i, level] of levels.entries()) {
    const d = content8Slice.find(deal => deal.campaignLevel === level)!;
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', d.id);
    await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
    assert.deepEqual((await read(page)).attempt.board, d.initial);
    await page.screenshot({ path: `${recordDir}/level-${level}-start.png` });
    const acceptance = [];
    for (const [j, command] of d.winningPath.entries()) {
      try { await perform(d, command, await read(page)); }
      catch (error) { throw Error(`Level ${level}, action ${j + 1} ${JSON.stringify(command)}`, { cause: error }); }
      acceptance.push({ time: await page.evaluate(() => performance.now()), command });
    }
    await page.locator('#result[open]').waitFor();
    const final = await read(page);
    assert.equal(final.attempt.board.phase, 'won');
    assert.equal(final.attempt.board.collected.length, Object.keys(d.cards).length);
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.waitForTimeout(save.settings.reducedMotion ? 100 : 650);
    await page.screenshot({ path: `${recordDir}/level-${level}-result.png` });
    evidence.push({ level, runtime, width, height, reduced: save.settings.reducedMotion, actions: d.winningPath.length, final: final.attempt.board.phase,
      stockSize: d.initial.stock.length, initialSHA: sha(JSON.stringify(d.initial)), witnessSHA: sha(JSON.stringify(d.winningPath)), acceptance });
    await writeFile(`${recordDir}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
    console.log(level, d.winningPath.length, final.attempt.board.movesLeft, 'PASS');
    if (i + 1 < levels.length) await page.locator('#next-level').tap();
  }
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(`${recordDir}/play.webm`);
  await browser.close(); server.httpServer.close();
}
