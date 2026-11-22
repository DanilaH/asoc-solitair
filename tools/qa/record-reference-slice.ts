import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect, type Page } from '@playwright/test';
import { preview } from 'vite';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import { content8Slice } from '../../src/content/campaign-v8-preview';
import { applyBoard, boardKey, dispatch, freshSave, placeJoker, sourceCards } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';
import { boardFrame, layout } from '../../src/game/layout';

const opening = process.env.C8_ONBOARDING === '1';
const catalog = opening ? content8Dealer : content8Slice;
const output = process.env.C8_OUTPUT ?? (opening ? '.recording/content8-onboarding' : '.recording/content8');
const dist = process.env.C8_DIST ?? output + '/dist';
const consequences: { level: number; step: number; path: BoardCommand[] }[] = process.env.C8_DECISIONS === '1'
  ? JSON.parse(await readFile('.authoring/content8-onboarding/unscripted.json', 'utf8')) : [];
const loss = process.env.C8_EXHAUST === '1'
  ? (JSON.parse(await readFile('.authoring/content8-onboarding/consequences.json', 'utf8')) as
    { level: number; exhaustion: { path: BoardCommand[] } }[]).find(row => row.level === 6)?.exhaustion.path
  : undefined;
const port = Number(process.env.C8_PORT ?? 4230);
const levels = (process.env.C8_RECORD_LEVELS ?? '15').split(',').map(Number);
const demo = process.env.C8_DEMO === '1';
const lastSteps = Number(process.env.C8_LAST_STEPS ?? 0);
const width = Number(process.env.C8_WIDTH ?? 360), height = Number(process.env.C8_HEIGHT ?? 780);
const slug = levels.join('-') + '-' + width + (demo ? '-lesson' : loss ? '-exhausted' : lastSteps ? '-last-' + lastSteps : consequences.length ? '-decision' : '');
const recordDir = `${output}/ui/${slug}`;
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
  const g = layout(before.attempt.board, d, frame, before.settings.deckSide, before.settings.deckPosition);
  const position = ({ x, y }: { x: number; y: number }) => ({ x: root.x + frame.offsetX + x * frame.unit, y: root.y + y * frame.unit });
  const tap = async (pt: { x: number; y: number }) => {
    assert(pt.x >= 0 && pt.x < width && pt.y >= 0 && pt.y < height);
    await page.touchscreen.tap(pt.x, pt.y);
  };
  if (cmd.type === 'transfer') {
    const group = sourceCards(before.attempt.board, cmd.from, d);
    const front = g.poses.filter(p => group.includes(p.id)).at(-1)!;
    const dest = g.targets.find(t => t.location.kind === cmd.to.kind && t.location.index === cmd.to.index)!;
    await tap(position(front));
    await page.waitForTimeout(35);
    await tap(position(dest));
  } else await tap(position(g.stock));
  const expected = applyBoard(before.attempt.board, cmd, d);
  assert(typeof expected !== 'string');
  await expect.poll(async () => (await read(page)).attempt.board, { timeout: 4500 }).toEqual(expected.board);
  await page.waitForTimeout(before.settings.reducedMotion ? 30 : cmd.type === 'draw' ? 315 : cmd.type === 'recycle' ? 405 : 225);
}

try {
  const first = catalog.find(d => d.campaignLevel === levels[0])!;
  let save = freshSave(first, `reference-ui-${slug}`);
  save.contentVersion = 8;
  save.settings.sfx = false;
  save.settings.reducedMotion = process.env.C8_REDUCED === '1';
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: levels[0] - 1 }, (_, i) => campaignId(i + 1)),
  };
  if (lastSteps) {
    assert.equal(levels.length, 1);
    for (const action of first.winningPath.slice(0, -lastSteps)) {
      const move = dispatch(save, action, first);
      assert(move.accepted);
      save = move.next;
    }
  }
  if (loss) {
    assert.deepEqual(levels, [6]);
    for (const action of loss.slice(0, -6)) {
      const move = dispatch(save, action, first);
      assert(move.accepted);
      save = move.next;
    }
    assert.equal(save.attempt.board.movesLeft, 6);
  }
  if (!opening) save.campaign = { version: 1, tutorials: ['learn:category','learn:match','learn:stock','hint-demo','undo-used','intro:joker'] };
  await page.goto('/');
  await page.locator('#app[data-ready=true]').waitFor();
  if (!(opening && levels[0] === 1 && !save.settings.reducedMotion)) {
    await page.evaluate(s => localStorage.setItem('asoc-solitaire.save.v1', JSON.stringify(s)), save);
    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    await page.locator('#home-play').tap();
  }
  for (const [i, level] of levels.entries()) {
    const d = catalog.find(deal => deal.campaignLevel === level)!;
    await expect(page.locator('#app')).toHaveAttribute('data-presented-deal', d.id);
    await expect(page.locator('#game-root')).toHaveAttribute('data-dealing', '0');
    assert.deepEqual((await read(page)).attempt.board, loss || lastSteps ? save.attempt.board : d.initial);
    await page.screenshot({ path: `${recordDir}/level-${level}-start.png` });
    const acceptance = [];
    const branch = consequences.find(record => record.level === level);
    const path = loss?.slice(-6) ?? branch?.path ?? (lastSteps ? d.winningPath.slice(-lastSteps) : d.winningPath);
    if (opening && level === 3) {
      const before = await read(page);
      await expect(page.locator('#lesson-copy')).toContainText('бесплатно');
      await page.locator('#hint').tap();
      await expect.poll(async () => (await read(page)).attempt.lessonHint).toEqual(d.winningPath[0]);
      assert.equal((await read(page)).profile.hints, before.profile.hints);
      assert.equal((await read(page)).campaign?.tutorials.includes('hint-practiced'), false);
      await page.waitForTimeout(800);
    }
    if (opening && level === 4) {
      const before = await read(page);
      await perform(d, d.winningPath[0], before);
      await expect(page.locator('#lesson-copy')).toContainText('Расходуется 1');
      await page.locator('#undo').tap();
      await expect.poll(async () => (await read(page)).attempt.board).toEqual(before.attempt.board);
      assert.equal((await read(page)).profile.undos, before.profile.undos - 1);
      assert((await read(page)).campaign?.tutorials.includes('undo-used'));
      await page.waitForTimeout(500);
      if (demo) { console.log('Undo lesson PASS'); break; }
    }
    for (const [j, command] of path.entries()) {
      if (branch && j === branch.step) {
        const before = await read(page);
        await page.locator('#hint').tap();
        await expect.poll(async () => (await read(page)).profile.hints).toBe(before.profile.hints - 1);
        await expect(page.locator('#hint-label')).toHaveText('Повторить');
        assert.deepEqual((await read(page)).attempt.board, before.attempt.board);
        await page.waitForTimeout(750);
      }
      if (opening && level === 8 && command.type === 'transfer' && !(await read(page)).attempt.jokerUsed) {
        const before = await read(page), board = before.attempt.board;
        const after = applyBoard(board, command, d);
        assert(typeof after !== 'string');
        for (const [column, pile] of board.tableau.entries()) {
          if (!pile.length || command.from.kind === 'tableau' && command.from.index === column ||
            command.to.kind === 'tableau' && command.to.index === column) continue;
          const placed = placeJoker(board, column, d);
          if (typeof placed === 'string') continue;
          const toJoker: BoardCommand = { type: 'transfer', from: command.from, to: { kind: 'tableau', index: column } };
          const fromJoker: BoardCommand = { ...command, from: { kind: 'tableau', index: column } };
          const hold = applyBoard(placed, toJoker, d);
          const release = typeof hold === 'string' ? hold : applyBoard(hold.board, fromJoker, d);
          if (typeof release === 'string' || boardKey(release.board) !== boardKey(after.board)) continue;
          const root = (await page.locator('#game-root').boundingBox())!;
          const frame = boardFrame(root.width, root.height, before.settings.deckPosition, d);
          const target = layout(board, d, frame, before.settings.deckSide, before.settings.deckPosition).targets
            .find(t => t.location.kind === 'tableau' && t.location.index === column)!;
          await page.locator('#joker').tap();
          await expect(page.locator('#joker')).toHaveAttribute('aria-pressed', 'true');
          await page.touchscreen.tap(root.x + frame.offsetX + target.x * frame.unit, root.y + target.y * frame.unit);
          await expect.poll(async () => (await read(page)).attempt.board.joker).toEqual(placed.joker);
          assert.equal((await read(page)).profile.jokers, before.profile.jokers - 1);
          await expect(page.locator('#lesson-copy')).toContainText('на Джокера');
          await page.waitForTimeout(650);
          await perform(d, toJoker, await read(page));
          assert((await read(page)).campaign?.tutorials.includes('joker-buffer'));
          await perform(d, fromJoker, await read(page));
          acceptance.push({ time: await page.evaluate(() => performance.now()), command: toJoker });
          acceptance.push({ time: await page.evaluate(() => performance.now()), command: fromJoker });
          break;
        }
        if ((await read(page)).attempt.jokerUsed) {
          if (demo) break;
          continue;
        }
      }
      try { await perform(d, command, await read(page)); }
      catch (error) {
        await page.screenshot({ path: `${recordDir}/failure-${level}-${j + 1}.png` });
        const state = await read(page);
        throw Error(`Level ${level}, action ${j + 1} ${JSON.stringify(command)}, ${state.attempt.board.movesLeft} moves left: ${await page.locator('#message').textContent()}`, { cause: error });
      }
      acceptance.push({ time: await page.evaluate(() => performance.now()), command });
      if (demo && (level === 2 && j === 2 || level === 3 && j === 0)) break;
    }
    if (demo) {
      await page.waitForTimeout(800);
      const markers = (await read(page)).campaign?.tutorials ?? [];
      assert(markers.includes(({ 2: 'learn:waste', 3: 'hint-practiced', 8: 'joker-buffer' } as Record<number, string>)[level]));
      console.log(level, 'lesson PASS');
      break;
    }
    await page.locator('#result[open]').waitFor();
    const final = await read(page);
    assert.equal(final.attempt.board.phase, loss ? 'exhausted' : 'won');
    if (loss) {
      assert.equal(final.attempt.board.movesLeft, 0);
      await expect(page.locator('#replay')).toBeVisible();
      await page.screenshot({ path: `${recordDir}/exhausted.png` });
      await page.locator('#result-undo').tap();
      await expect.poll(async () => (await read(page)).attempt.board.movesLeft).toBe(1);
      assert.equal((await read(page)).profile.undos, final.profile.undos - 1);
      console.log(level, 'exhausted → Undo', 'PASS');
      break;
    }
    if (opening && level === 3) assert(final.campaign?.tutorials.includes('hint-practiced'));
    if (opening && level === 5) assert(final.campaign?.tutorials.includes('learn:recycle'));
    if (opening && level === 8) assert(final.campaign?.tutorials.includes('joker-buffer'));
    assert.equal(final.attempt.board.collected.length, Object.keys(d.cards).length);
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.waitForTimeout(save.settings.reducedMotion ? 100 : 650);
    await page.screenshot({ path: `${recordDir}/level-${level}-result.png` });
    evidence.push({ level, runtime, width, height, reduced: save.settings.reducedMotion, actions: acceptance.length, final: final.attempt.board.phase,
      stockSize: d.initial.stock.length, initialSHA: sha(JSON.stringify(d.initial)), witnessSHA: sha(JSON.stringify(path)), acceptance });
    await writeFile(`${recordDir}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
    console.log(level, d.winningPath.length, final.attempt.board.movesLeft, 'PASS');
    if (i + 1 < levels.length) {
      const next = catalog.find(item => item.campaignLevel === levels[i + 1])!;
      if (next.difficultyTier && next.difficultyTier !== 'normal') {
        await expect(page.locator('#next-level')).toHaveAttribute('data-tier', next.difficultyTier);
        await page.locator('#next-level').tap();
        await expect(page.locator('#difficulty-entry')).toBeVisible();
        await page.screenshot({ path: `${recordDir}/level-${levels[i + 1]}-difficulty.png` });
        await page.waitForTimeout(950);
        await page.locator('#difficulty-play').tap();
        await expect(page.locator('#difficulty-entry')).not.toBeVisible();
      } else await page.locator('#next-level').tap();
    }
  }
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(`${recordDir}/play.webm`);
  await browser.close(); server.httpServer.close();
}
