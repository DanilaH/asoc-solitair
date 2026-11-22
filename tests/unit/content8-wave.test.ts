import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { content8Dealer, content8Late, content8Wave, decodeRoute } from '../../src/content/campaign-v8-dealer';
import data from '../../src/content/campaign-v8-wave.json';
import passports from '../../docs/qa/content-v8/core3-passports.json';
import lateData from '../../src/content/campaign-v8-late.json';
import latePassports from '../../docs/qa/content-v8/core3-late-passports.json';
import lateRecipes from '../../docs/qa/content-v8/core3-late-recipes.json';
import { lateTopics } from '../../src/content/content8-late-topics';
import { lateShapes, type LateShape } from '../../tools/content/c8-late-shapes';
import source from '../../docs/qa/content-v8/hitapps-local-1-31.json';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import { cardArtwork } from '../../src/game/art';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { distributeWave } from '../../tools/content/c8-wave-layout';
import { advance, options } from '../../tools/qa/gameplay-oracle';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const content8 = [...content8Dealer, ...content8Wave, ...content8Late];
const batches = [{ first: 16, count: 16 }, ...Array.from({ length: 7 }, (_, index) => ({ first: 32 + index * 7, count: 7 }))];

it.each(batches)('reproduces the Content 8 boards and winning branches starting at $first', ({ first, count }) => {
  const deals = content8.slice(first - 1, first + count - 1);
  expect(deals.map(deal => deal.campaignLevel)).toEqual(Array.from({ length: count }, (_, i) => first + i));
  let preceding = new Set(Object.values(content8[first - 2].cards).map(card => card.category));
  const initialHashes = new Set<string>();
  for (const deal of deals) {
    const level = deal.campaignLevel!;
    const native = source[level - 1];
    const row = native ? { ...native, budget: native.baseMoves + (native.columns === 3 ? 5 : 0) } :
      lateShapes[lateRecipes[level - 32].profile as LateShape];
    const passport = native ? passports[level - 16] : latePassports[level - 32];
    const record = native ? data[level - 16] : lateData[level - 32];
    const initial = deal.initial, label = deal.id;
    expect(passport.level).toBe(deal.campaignLevel);
    expect(Object.keys(deal.cards), label).toHaveLength(row.cards);
    expect(initial.stock, label).toHaveLength(row.stock);
    expect(initial.tableau, label).toHaveLength(row.columns);
    expect(initial.foundations, label).toHaveLength(row.columns);
    const categories = new Map<string, number>();
    for (const card of Object.values(deal.cards)) {
      if (!card.leader) categories.set(card.category, (categories.get(card.category) ?? 0) + 1);
    }
    expect(categories.size, label).toBe(row.categories);
    expect([...categories.values()].every(size => size >= 4 && size <= 6), label).toBe(true);
    expect([...categories.keys()].filter(id => preceding.has(id)), label).toEqual([]);
    preceding = new Set(categories.keys());
    expect(new Set(Object.values(deal.cards).map(card => card.text.toLocaleLowerCase('ru'))).size).toBe(row.cards);
    expect(initial.movesLeft, label).toBe(row.budget);
    expect(distributeWave(deal.cards, row.stock, initial.tableau.map(col => col.length), passport.seed,
      passport.strategy as 'ordinary' | 'guided-stock'))
      .toEqual({ tableau: initial.tableau, stock: initial.stock });
    expect(passport.layoutHash).toBe(hash(initial));
    expect(passport.witnessHash).toBe(hash(record.winningPath));
    initialHashes.add(passport.layoutHash);
    assertBoard(initial, deal);

    const members = Object.values(deal.cards).filter(card => !card.leader);
    const illustrated = members.filter(card => cardArtwork(card, deal));
    expect(illustrated.length, label).toBeGreaterThan(0);
    for (const category of new Set(illustrated.map(card => card.category))) {
      for (const member of members.filter(card => card.category === category)) {
        const image = cardArtwork(member, deal);
        expect(image && existsSync('public/' + image), member.text).toBe(true);
      }
    }

    const paths = [deal.winningPath, ...(deal.recoveryPaths ?? [])];
    expect(paths.length - 1).toBe(passport.choices.choices.length);
    expect(paths.length).toBeGreaterThan(1);
    for (const [pathIndex, path] of paths.entries()) {
      let board = initial, forced = 0, run = 0, longest = 0;
      for (const [step, action] of path.entries()) {
        if (pathIndex === 0) {
          if (action.type !== 'transfer' && !options(board, deal, true).some(candidate => candidate.action.type === 'transfer')) {
            forced++;
            longest = Math.max(longest, ++run);
          } else run = 0;
        }
        const next = applyBoard(board, action, deal);
        if (typeof next === 'string') throw Error(`${label} route ${pathIndex}, move ${step}: ${next}`);
        expect(next.board, label).toEqual(advance(board, action, deal));
        board = next.board;
        if (pathIndex === 0 && row.columns === 5) {
          const frame = boardFrame(296, 368, 'top', deal);
          const { width, height } = cardMetrics(deal);
          const { poses } = layout(board, deal, frame);
          expect(poses.every(pose => pose.x >= width / 2 - .01 && pose.x <= frame.width - width / 2 + .01 &&
            pose.y >= height / 2 && pose.y <= frame.height - height / 2 + .01), label).toBe(true);
        }
      }
      expect(board.phase, label).toBe('won');
      if (pathIndex === 0) {
        expect(board.movesLeft, label).toBe(passport.slack);
        expect(board.movesLeft!, label).toBeGreaterThanOrEqual(4);
        expect([forced, longest], label).toEqual([passport.forcedStock, passport.longestForcedRun]);
        expect(forced / path.length, label).toBeLessThanOrEqual(.22);
        expect(longest, label).toBeLessThanOrEqual(9);
      } else {
        const choice = passport.choices.choices[pathIndex - 1];
        expect(path.slice(0, choice.step), label).toEqual(deal.winningPath.slice(0, choice.step));
        expect(path[choice.step], label).toEqual(decodeRoute(choice.move)[0]);
        expect(path[choice.step], label).not.toEqual(deal.winningPath[choice.step]);
        expect(path.length - deal.winningPath.length, label).toBe(choice.extraActions);
        expect(choice.extraActions, label).not.toBe(0);
      }
    }
  }
  expect(initialHashes.size).toBe(count);
}, 45000);

it('uses the new wave on fresh C8 starts and retains active and parked archived C7 geometry', async () => {
  vi.stubEnv('VITE_CONTENT8_PREVIEW', '1');
  const { campaignDeals, findDeal } = await import('../../src/content/campaign');
  const { freshSave, dispatch } = await import('../../src/domain/engine');
  const { beginDeal } = await import('../../src/domain/campaign');
  const { dailyForDay } = await import('../../src/content/daily');
  const { switchMode } = await import('../../src/domain/sessions');
  const { campaignId } = await import('../../src/domain/progression');
  const { decodeSave } = await import('../../src/platform/storage');
  for (const deal of content8) expect(findDeal(deal.id)).toEqual(deal);
  expect(campaignDeals.slice(0, 80).map(deal => deal.campaignLevel)).toEqual(Array.from({ length: 80 }, (_, index) => index + 1));
  expect(new Set(campaignDeals.map(deal => deal.id)).size).toBe(campaignDeals.length);
  const archive = findDeal('campaign-c7-080')!;
  const wave = campaignDeals[79];
  const old = dispatch(freshSave(archive, 'old-c8-fallback'), archive.winningPath[0], archive).next;
  old.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 79 }, (_, i) => campaignId(i + 1)) };
  expect(decodeSave(JSON.stringify(old), findDeal).attempt).toEqual(old.attempt);
  const daily = dailyForDay('2026-11-20');
  switchMode(old, 'daily', daily, 'daily');
  const loaded = decodeSave(JSON.stringify(old), findDeal);
  expect(loaded.parked?.campaign).toEqual(old.parked?.campaign);
  switchMode(loaded, 'campaign', archive, 'return');
  expect(loaded.attempt).toEqual(old.parked?.campaign);
  beginDeal(loaded, wave, 'new-five-columns');
  expect(loaded.attempt.dealId).toBe('campaign-c8-wave-080');
  expect(loaded.attempt.board.tableau).toHaveLength(5);
  expect(decodeSave(JSON.stringify(loaded), findDeal)).toEqual(loaded);
});

it('rotates the late topics and keeps the chapter pattern independent from theme order', () => {
  const last = new Map<string, number>(), usedNewTopics = new Set<string>();
  for (const deal of content8) {
    const level = deal.campaignLevel!;
    const leaders = Object.values(deal.cards).filter(card => card.leader);
    for (const card of leaders) {
      if (level >= 32) {
        expect(level - (last.get(card.category) ?? -Infinity), card.category).toBeGreaterThanOrEqual(4);
        if (Object.hasOwn(lateTopics, card.category)) usedNewTopics.add(card.category);
      }
      last.set(card.category, level);
    }
  }
  expect([...usedNewTopics].sort()).toEqual(Object.keys(lateTopics).sort());
  const pattern = ['rest', 'standard', 'hard', 'standard', 'hard', 'standard', 'peak'];
  expect(lateRecipes.map(recipe => recipe.profile)).toEqual(Array.from({ length: 49 }, (_, index) => pattern[index % 7]));
  expect(content8Late.filter(deal => deal.initial.tableau.length === 5).map(deal => deal.campaignLevel)).toEqual([38, 45, 52, 59, 66, 73, 80]);
});
