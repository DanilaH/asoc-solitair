import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { content8Dealer, content8Wave, decodeRoute } from '../../src/content/campaign-v8-dealer';
import data from '../../src/content/campaign-v8-wave.json';
import passports from '../../docs/qa/content-v8/core3-passports.json';
import source from '../../docs/qa/content-v8/hitapps-local-1-31.json';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import { cardArtwork } from '../../src/game/art';
import { boardFrame, cardMetrics, layout } from '../../src/game/layout';
import { distributeWave } from '../../tools/content/c8-wave-layout';
import { advance, options } from '../../tools/qa/gameplay-oracle';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('reproduces every Content 8 extension deal, proves wins and audits play on the narrow board', () => {
  expect(content8Wave.map(deal => deal.campaignLevel)).toEqual(Array.from({ length: 16 }, (_, i) => 16 + i));
  let preceding = new Set(Object.values(content8Dealer[14].cards).map(card => card.category));
  const initialHashes = new Set<string>();
  for (const [index, deal] of content8Wave.entries()) {
    const row = source[deal.campaignLevel! - 1], passport = passports[index], record = data[index];
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
    expect([...categories.keys()].filter(id => preceding.has(id)), label).toEqual([]);
    preceding = new Set(categories.keys());
    expect(new Set(Object.values(deal.cards).map(card => card.text.toLocaleLowerCase('ru'))).size).toBe(row.cards);
    expect(initial.movesLeft).toBe(row.baseMoves + (row.columns === 3 ? 5 : 0));
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
          const { poses } = layout(board, deal, frame.height);
          expect(poses.every(pose => pose.x >= width / 2 && pose.x <= 540 - width / 2 &&
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
  expect(initialHashes.size).toBe(content8Wave.length);
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
  expect(campaignDeals.slice(15, 31).map(deal => deal.id)).toEqual(content8Wave.map(deal => deal.id));
  expect(campaignDeals[31].id).toBe('campaign-c7-032');
  const archive = findDeal('campaign-c7-026')!;
  const wave = campaignDeals[25];
  const old = dispatch(freshSave(archive, 'old-c8-fallback'), archive.winningPath[0], archive).next;
  old.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 25 }, (_, i) => campaignId(i + 1)) };
  expect(decodeSave(JSON.stringify(old), findDeal).attempt).toEqual(old.attempt);
  const daily = dailyForDay('2026-11-20');
  switchMode(old, 'daily', daily, 'daily');
  const loaded = decodeSave(JSON.stringify(old), findDeal);
  expect(loaded.parked?.campaign).toEqual(old.parked?.campaign);
  switchMode(loaded, 'campaign', archive, 'return');
  expect(loaded.attempt).toEqual(old.parked?.campaign);
  beginDeal(loaded, wave, 'new-five-columns');
  expect(loaded.attempt.dealId).toBe('campaign-c8-wave-026');
  expect(loaded.attempt.board.tableau).toHaveLength(5);
  expect(decodeSave(JSON.stringify(loaded), findDeal)).toEqual(loaded);
});
