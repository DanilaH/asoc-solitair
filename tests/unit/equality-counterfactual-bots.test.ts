import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { equalityPreviewDeal } from '../../src/content/campaign-v8-equality';
import { selectEquality, type SimulationPolicy } from '../../tools/content/difficulty-selection';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Deal } from '../../src/domain/types';

// Research counterfactual: the two P08 control bots are NOT independent
// estimates of challenge. These are the EXACT authored policies from
// tools/content/build-owner-equality.ts. This test changes no product policy.
const policies: SimulationPolicy[] = [
  {
    id: 'stock-first',
    choose: (board, legal) =>
      legal.find(action => action.type === (board.stock.length ? 'draw' : 'recycle')) ?? legal[0],
  },
  {
    id: 'tableau-first-then-stock',
    choose: (board, legal, deal) =>
      ((board.movesLeft! > deal.initial.movesLeft! - 32 &&
        legal.find(action => action.type === 'transfer')) ||
        legal.find(action => action.type === (board.stock.length ? 'draw' : 'recycle'))) ?? legal[0],
  },
];

function certifiedWitness(deal: Deal) {
  let board = structuredClone(deal.initial);
  for (const command of deal.winningPath) {
    const next = advance(board, command, deal);
    expect(next, `independent route for ${deal.id}`).not.toBeNull();
    board = next!;
  }
  expect(board.phase).toBe('won');
  expect(deal.initial.movesLeft).not.toBeNull();
  return {
    steps: deal.winningPath.length,
    budget: deal.initial.movesLeft!,
    slack: deal.initial.movesLeft! - deal.winningPath.length,
  };
}

it('P08 counterfactual: BOTH ordinary and Equality boards pass the same late-loss bots', () => {
  const ordinary = content8Wave.find(deal => deal.campaignLevel === 16)!;
  const equality = equalityPreviewDeal;
  expect(equality.id).not.toBe(ordinary.id);
  expect(ordinary.initial.movesLeft).toBe(equality.initial.movesLeft);
  const normal = certifiedWitness(ordinary);
  const special = certifiedWitness(equality);
  expect(normal).toMatchObject({ steps: 138, budget: 164, slack: 26 });
  expect(special).toMatchObject({ steps: 163, budget: 164, slack: 1 });

  for (const deal of [ordinary, equality]) {
    const test = selectEquality([deal], policies, { distinctPaths: true });
    expect(test.deal?.id, `candidate ${deal.id}`).toBe(deal.id);
    expect(test.runs?.map(run => [run.policyId, run.status, run.steps])).toEqual([
      ['stock-first', 'LOST', 164],
      ['tableau-first-then-stock', 'LOST', 164],
    ]);
    const [noTransfers, earlyOnly] = test.runs!;
    expect(noTransfers.path.some(c => c.type === 'transfer')).toBe(false);
    expect(earlyOnly.path.slice(31).some(c => c.type === 'transfer')).toBe(false);
    expect(earlyOnly.path.some(c => c.type === 'transfer')).toBe(true);
  }
  // In the same ordered pool the current late-bot predicate can select the
  // ORDINARY 26-slack board first. It cannot measure relative challenge.
  const first = selectEquality([ordinary, equality], policies, { distinctPaths: true });
  expect(first.deal?.id).toBe(ordinary.id);
  expect(first.attempts).toBe(1);
});

it('competent policies win the ordinary control and the legacy seed 47', async () => {
  const { simulatePolicy } = await import('../../tools/content/difficulty-selection');
  const { hitappsBotPolicies } = await import('../../tools/content/hitapps-bots');
  for (const [deal, lengths] of [[content8Wave[0], [138, 138]], [equalityPreviewDeal, [138, 163]]] as const) {
    for (const [index, policy] of hitappsBotPolicies.entries()) {
      const result = simulatePolicy({ ...deal, winningPath: [] }, policy);
      expect(result).toMatchObject({ status: 'WON', steps: lengths[index] });
      certifiedWitness({ ...deal, winningPath: result.path });
    }
  }
}, 15000);
