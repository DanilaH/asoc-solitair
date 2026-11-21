import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { campaignDeals, findDeal, selectCampaignDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { adjustedMoveBudget, C8_DIFFICULTY } from '../../src/domain/difficulty';
import { applyBoard, assertBoard, dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import { platformState } from '../../src/domain/services';
import { switchMode } from '../../src/domain/sessions';
import type { Deal } from '../../src/domain/types';
import { decodeSave } from '../../src/platform/storage';
import { advance } from './gameplay-oracle';

const bases = campaignDeals.slice(15);
assert.deepEqual(bases.map(base => base.campaignLevel), Array.from({ length: 65 }, (_, i) => i + 16));
assert(bases.every(base => base.id.startsWith('campaign-c8-')), 'Build the C8 preview authoring bank');
const sha = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const variants = new Map<string, Deal>();
const rows = bases.map(base => {
  const budget = base.initial.movesLeft;
  assert(budget !== null);
  const deals = (['tight', 'relief'] as const).map(tier => {
    const penalty = tier === 'tight' ? C8_DIFFICULTY.hardPenalty : C8_DIFFICULTY.easyPenalty;
    const movesLeft = adjustedMoveBudget(budget, penalty, true);
    assert(tier === 'tight' ? movesLeft < budget : movesLeft > budget, base.id);
    const deal: Deal = {
      ...base, id: `${base.id}-${tier}-r2`, initial: { ...base.initial, movesLeft },
      recoveryPaths: undefined,
    };
    assertBoard(deal.initial, deal);
    let board = deal.initial;
    for (const move of deal.winningPath) {
      const next = applyBoard(board, move, deal);
      assert(typeof next !== 'string', `${deal.id}: ${next}`);
      assert.deepEqual(next.board, advance(board, move, deal), deal.id);
      board = next.board;
    }
    assert.equal(board.phase, 'won', deal.id);
    variants.set(deal.id, deal);
    return { tier, id: deal.id, budget: movesLeft, winningMoves: deal.winningPath.length, slack: board.movesLeft, sha256: sha(deal) };
  });
  return { level: base.campaignLevel, normal: { id: base.id, sha256: sha(base), budget }, variants: deals };
});
assert.equal(variants.size, 130);

const daily = dailyForDay('2026-11-21');
const lookup = (id: string) => variants.get(id) ?? findDeal(id);
for (const deal of variants.values()) {
  const save = freshSave(deal, 'adaptive-authoring-check');
  platformState(save).completedCampaign = Array.from({ length: deal.campaignLevel! - 1 }, (_, i) => campaignId(i + 1));
  const moved = dispatch(save, deal.winningPath[0], deal);
  assert(moved.accepted);
  const expected = moved.next.attempt;
  switchMode(moved.next, 'daily', daily, 'adaptive-daily-check');
  const restored = decodeSave(JSON.stringify(moved.next), lookup);
  assert.deepEqual(restored.parked?.campaign, expected);
  switchMode(restored, 'campaign', deal, 'adaptive-resume-check');
  const undo = dispatch(restored, { type: 'undo' }, deal);
  assert(undo.accepted);
  assert.deepEqual(undo.next.attempt.board, deal.initial);
}

for (const base of bases) {
  for (const penalty of [C8_DIFFICULTY.hardPenalty, C8_DIFFICULTY.easyPenalty]) {
    const save = freshSave(base, 'adaptive-default-check');
    save.difficultyPenalty = penalty;
    save.attempt.board.phase = 'exhausted';
    save.attempt.board.movesLeft = 0;
    save.attempt.director = { restarts: 2, previousLosses: 2, exhausted: true };
    assert.equal(selectCampaignDeal(save, base, save.attempt), base);
  }
}

const output = '.authoring/c8-adaptive-bank';
await mkdir(output, { recursive: true });
await writeFile(`${output}/manifest.json`, JSON.stringify({
  schema: 1, status: 'OFFLINE_OWNER_ACTIVATION_GATE', scope: 'PRODUCT_ADAPTED_BUDGET_ONLY',
  policy: C8_DIFFICULTY, baselineDigest: sha(bases), rows,
}, null, 2) + '\n');
await writeFile(`${output}/deals.json`, JSON.stringify([...variants.values()]) + '\n');
console.log(JSON.stringify({
  levels: rows.length, variants: variants.size, baselineDigest: sha(bases), manifestDigest: sha(rows),
  minSlack: Math.min(...rows.flatMap(row => row.variants.map(variant => variant.slack ?? 0))),
  status: 'OFFLINE_OWNER_ACTIVATION_GATE',
}));
