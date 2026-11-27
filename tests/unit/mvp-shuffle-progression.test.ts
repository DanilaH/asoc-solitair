import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { campaignDeals, campaignIssuance, findDeal, integratedCampaignDeals, isCurrentCampaignDeal, selectCampaignDeal } from '../../src/content/campaign';
import { releaseProfile } from '../../src/config/profile';
import { dailyForDay } from '../../src/content/daily';
import { applyBoard, dispatch, freshSave } from '../../src/domain/engine';
import { claimDailyBonus, openDailyBonusRound, revealDailyBonusCard } from '../../src/domain/events/daily-bonus';
import { updatePreviewTasks } from '../../src/domain/events/daily-tasks';
import { canShuffle, commitShuffle, prepareShuffleBoard, type ShuffleRequest } from '../../src/domain/proof-shuffle';
import { campaignId } from '../../src/domain/progression';
import { grantShuffleIntro, hasFutureShuffleUse, SHUFFLE_INTRO_KEY } from '../../src/domain/shuffle-progression';
import { switchMode } from '../../src/domain/sessions';
import { proveShuffle } from '../../src/game/shuffle-proof';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import { advance } from '../../tools/qa/gameplay-oracle';
import { shuffleIntroWitness, shuffleProgressionWitnesses } from '../fixtures/mvp-shuffle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

const now = Date.UTC(2026, 10, 24, 12);
const evidence: unknown[] = [];
afterAll(() => {
  if (process.env.SHUFFLE_EVIDENCE) writeFileSync(process.env.SHUFFLE_EVIDENCE, JSON.stringify({
    policy: 'c8-shuffle-progression-r1', note: 'Positive reachable positions; not every initial seed is promised solvable.', witnesses: evidence,
    sourceHashes: Object.fromEntries(['src/game/shuffle-proof.ts', 'src/domain/ordinary-search.ts', 'src/domain/proof-shuffle.ts',
      'src/content/campaign.ts', 'src/config/c8-release.json'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  }, null, 2));
});
function profile(deal: Deal, completed = deal.campaignLevel! - 1) {
  const save = freshSave(deal, 'shuffle-progression');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: completed }, (_, i) => campaignId(i + 1)) };
  updatePreviewTasks(save, now);
  return save;
}
function positioned(witness: { id: string; prefix: number; seed: number }) {
  const deal = findDeal(witness.id)!;
  let save = profile(deal);
  save.attempt.issuance = campaignIssuance(save, campaignDeals[deal.campaignLevel! - 1], deal);
  save.dailyTasks!.inventory.shuffles = 1;
  for (const move of deal.winningPath.slice(0, witness.prefix)) {
    const next = dispatch(save, move, deal);
    expect(next.accepted, deal.id).toBe(true);
    save = next.next;
  }
  const request: ShuffleRequest = { attemptId: save.attempt.id, revision: save.revision, dealId: deal.id,
    board: save.attempt.board, deal, seed: witness.seed };
  return { save, deal, request };
}
function dualReplay(initial: Board, route: readonly BoardCommand[], deal: Deal) {
  let production = initial, independent = initial;
  for (const action of route) {
    const next = applyBoard(production, action, deal), oracle = advance(independent, action, deal);
    if (typeof next === 'string') throw Error(`${deal.id}: ${next}`);
    expect(oracle, deal.id).toEqual(next.board);
    production = next.board; independent = oracle!;
  }
  expect(production.phase, deal.id).toBe('won');
  return production;
}

describe.skipIf(!releaseProfile)('charged Shuffle progression', () => {
  it('preserves all old immutable deals and fully replays every new composed definition without recovery rights', () => {
    const composed = integratedCampaignDeals.filter(deal => deal.id.endsWith('-shuffle-r2'));
    const expected = [...shuffleProgressionWitnesses.map(row => row.id), 'campaign-c8-wave-036-restart-r1-shuffle-r2'];
    expect(composed.map(deal => deal.id).sort()).toEqual(expected.sort());
    for (const deal of composed) {
      const source = findDeal(deal.id.slice(0, -'-shuffle-r2'.length))!;
      expect(source).toBeDefined();
      expect(source.shufflePolicy).toBeUndefined();
      expect(deal).toEqual({ ...source, id: `${source.id}-shuffle-r2`, shufflePolicy: 'hidden-pool-r1', shuffleCost: 'charge' });
      expect(deal.recovery).toBeUndefined();
      expect(deal.extraHelpers).toBeUndefined();
      expect(deal.initial.recyclesLeft).toBeUndefined();
      expect(isCurrentCampaignDeal(deal.id, campaignDeals[deal.campaignLevel! - 1])).toBe(true);
      dualReplay(deal.initial, deal.winningPath, deal);
    }
    for (const level of [33, 36, 39]) for (const difficultyPenalty of [-5, 0, 10]) {
      const base = campaignDeals[level - 1], save = profile(base);
      save.difficultyPenalty = difficultyPenalty;
      const selected = selectCampaignDeal(save, base);
      expect(selected.initial.rulesVersion).toBe(4);
      expect(selected.shuffleCost).toBe('charge');
      expect(campaignIssuance(save, base, selected)).toMatchObject({ dealId: selected.id, policy: 'hitapps-r4-bank-v1' });
    }
  }, 15000);

  it.each(shuffleProgressionWitnesses)('proves and commits the actual $id at prefix $prefix and seed $seed', witness => {
    let { save, deal, request } = positioned(witness);
    expect(canShuffle(save, deal)).toBe(true);
    const before = structuredClone(save), route = proveShuffle(request);
    expect(route?.length, deal.id).toBeGreaterThan(0);
    expect(route!.length).toBeLessThanOrEqual(save.attempt.board.movesLeft!);
    expect(commitShuffle(save, deal, { ...request, revision: request.revision - 1 }, route!)).toBe(false);
    expect(commitShuffle(save, deal, request, [])).toBe(false);
    expect(save).toEqual(before);
    const candidate = prepareShuffleBoard(request.board, deal, request.seed)!;
    expect(commitShuffle(save, deal, request, route!)).toBe(true);
    expect(save.attempt.board).toEqual(candidate);
    expect(save.attempt.board).not.toEqual(request.board);
    expect(save.attempt.undo).toEqual([]);
    expect(save.dailyTasks!.inventory.shuffles).toBe(0);
    expect(save.profile).toEqual(before.profile);
    dualReplay(candidate, route!, deal);
    const hidden = request.board.tableau.flat().filter(id => !request.board.faceUp.includes(id)).length;
    evidence.push({ ...witness, movesLeft: request.board.movesLeft, hidden, stock: request.board.stock.length,
      waste: request.board.waste.length, hiddenPool: hidden + request.board.stock.length + request.board.waste.length,
      remainingCards: Object.keys(deal.cards).length - request.board.collected.length, route,
      production: 'won', independent: 'won', chargeConsumed: 1 });
    switchMode(save, 'daily', dailyForDay('2026-11-24'), 'daily-shuffle');
    save = decodeSave(JSON.stringify(save), findDeal);
    switchMode(save, 'campaign', deal, 'return-shuffle');
    expect(save.attempt.shuffleUsed).toBe(true);
    expect(canShuffle(save, deal)).toBe(false);
    expect(save.dailyTasks!.inventory.shuffles).toBe(0);
  });

  it('issues the L30 tutorial stock once independently of an already claimed Bonus, then commits a real proof', () => {
    const base = campaignDeals[29], selected = selectCampaignDeal(profile(base), base);
    let save = profile(selected, 28);
    const round = openDailyBonusRound(save, now, 'already-used-today', () => 0)!;
    round.slots.forEach((column, index) => { if (column === 0) revealDailyBonusCard(save, round.roundId, index, now); });
    expect(claimDailyBonus(save, round.roundId, now)).toBeDefined();
    expect(grantShuffleIntro(save)).toBe(false);
    save.platform!.completedCampaign.push(campaignId(29));
    expect(grantShuffleIntro(save)).toBe(true);
    expect(save.dailyTasks!.inventory.shuffles).toBe(1);
    expect(save.profile.rewards.filter(key => key === SHUFFLE_INTRO_KEY)).toHaveLength(1);
    expect(grantShuffleIntro(save)).toBe(false);
    expect(selected.id).toBe(shuffleIntroWitness.id);
    const { prefix, seed } = shuffleIntroWitness;
    for (const action of selected.winningPath.slice(0, prefix)) save = dispatch(save, action, selected).next;
    const request = { attemptId: save.attempt.id, revision: save.revision, dealId: selected.id, deal: selected, board: save.attempt.board, seed };
    const route = proveShuffle(request);
    expect(route).not.toBeNull();
    expect(commitShuffle(save, selected, request, route!)).toBe(true);
    dualReplay(save.attempt.board, route!, selected);
    const hidden = request.board.tableau.flat().filter(id => !request.board.faceUp.includes(id)).length;
    evidence.push({ id: selected.id, prefix, seed, movesLeft: request.board.movesLeft, hidden,
      stock: request.board.stock.length, waste: request.board.waste.length,
      hiddenPool: hidden + request.board.stock.length + request.board.waste.length,
      remainingCards: Object.keys(selected.cards).length - request.board.collected.length,
      route, production: 'won', independent: 'won', introGrant: 1, chargeConsumed: 1 });
    save = decodeSave(JSON.stringify(save), findDeal);
    save = dispatch(save, { type: 'restart', attemptId: 'repeat-intro-level' }, selected).next;
    expect(grantShuffleIntro(save)).toBe(false);
    expect(save.dailyTasks!.inventory.shuffles).toBe(0);
  });

  it('adds to old stock once and filters only new Bonus rounds after the final applicable clear', () => {
    let save = profile(campaignDeals[38], 38);
    save.dailyTasks!.inventory.shuffles = 7;
    expect(grantShuffleIntro(save)).toBe(true);
    expect(save.dailyTasks!.inventory.shuffles).toBe(8);
    save = decodeSave(JSON.stringify(save), findDeal);
    expect(grantShuffleIntro(save)).toBe(false);
    expect(hasFutureShuffleUse(save)).toBe(true);
    const round = openDailyBonusRound(save, now, 'frozen-shuffle-prize', n => n - 1)!;
    const column = round.columns.findIndex(prize => prize.kind === 'Shuffle');
    expect(column).toBeGreaterThanOrEqual(0);
    for (const [index, value] of round.slots.entries()) if (value === column) revealDailyBonusCard(save, round.roundId, index, now);
    save.platform!.completedCampaign.push(campaignId(39));
    expect(hasFutureShuffleUse(save)).toBe(false);
    expect(claimDailyBonus(save, round.roundId, now)).toEqual({ kind: 'Shuffle', quantity: 1 });
    expect(save.dailyTasks!.inventory.shuffles).toBe(9);
    const tomorrow = openDailyBonusRound(save, now + 86_400_000, 'after-last-applicability', n => n - 1)!;
    expect(tomorrow.columns.every(prize => prize.kind !== 'Shuffle')).toBe(true);
  });

  it('leaves inventory and identity untouched for UNKNOWN and a failed durable commit, then consumes once after ambiguous success', async () => {
    const { save, deal, request } = positioned(shuffleProgressionWitnesses[1]);
    const before = structuredClone(save);
    expect(proveShuffle({ ...request, board: { ...request.board, movesLeft: 1 } })).toBeNull();
    expect(save).toEqual(before);
    const route = proveShuffle(request)!;
    let raw: string | null = JSON.stringify(save), mode: 'ok' | 'fail' | 'ambiguous' = 'ok';
    const disk = { getItem: async () => raw, setItem: async (_key: string, value: string) => {
      if (mode === 'fail') throw Error('disk full');
      raw = value;
      if (mode === 'ambiguous') throw Error('response lost');
    }, removeItem: async () => undefined };
    const store = new SaveStore(disk, findDeal, () => save); await store.open();
    const commit = () => store.mutate(next => commitShuffle(next, deal, request, route));
    mode = 'fail'; await expect(commit()).rejects.toThrow();
    expect(store.state).toEqual(before);
    mode = 'ambiguous'; expect(await Promise.all([commit(), commit()])).toEqual([true, false]);
    expect(store.state.dailyTasks!.inventory.shuffles).toBe(0);
    expect(decodeSave(raw!, findDeal)).toEqual(store.state);
  });
});
