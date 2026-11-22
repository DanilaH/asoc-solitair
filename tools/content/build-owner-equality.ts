import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { applyBoard } from '../../src/domain/engine';
import type { Deal } from '../../src/domain/types';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { advance } from '../qa/gameplay-oracle';
import { prepareEqualityPlan } from './equality-provenance';
import { dealOrdinary } from './plain-dealer';
import type { SimulationPolicy } from './difficulty-selection';

const base = content8Wave[0];
const policies: SimulationPolicy[] = [
  { id: 'stock-first', choose: (board, legal) => legal.find(action => action.type === (board.stock.length ? 'draw' : 'recycle')) ?? legal[0] },
  { id: 'tableau-first-then-stock', choose: (board, legal, deal) =>
    ((board.movesLeft! > deal.initial.movesLeft! - 32 && legal.find(action => action.type === 'transfer')) ||
    legal.find(action => action.type === (board.stock.length ? 'draw' : 'recycle'))) ?? legal[0] },
];
for (let seed = 41; seed < 61; seed++) {
  const { tableau, stock } = dealOrdinary(Object.keys(base.cards), base.initial.stock.length, base.initial.tableau.map(col => col.length), seed);
  const initial = { ...base.initial, tableau, stock, faceUp: tableau.map(col => col.at(-1)!) };
  const deal: Deal = { ...base, id: base.id + '-equality-r2-s' + seed, initial, recoveryPaths: undefined };
  const route = findReferenceRoute(deal, initial, 3200);
  if (!route.path?.length) continue;
  deal.winningPath = route.path;
  let board = initial;
  for (const move of deal.winningPath) {
    const result = applyBoard(board, move, deal);
    assert(typeof result !== 'string');
    assert.deepEqual(advance(board, move, deal), result.board);
    board = result.board;
  }
  assert.equal(board.phase, 'won');
  const evidence = prepareEqualityPlan({
    request: { level: 16, seed, segment: 'NonPayer', issued: 0 },
    config: { enabled: true, minLevel: 16, limit: 1, version: 'controlled-r2', segments: ['NonPayer'] },
    cohortEvidence: 'controlled-fixture', requests: [seed], drawSeed: () => 0, deal: () => deal, policies,
  });
  if (evidence.result !== 'SELECTED_CONTROLLED_CANDIDATE') continue;
  const file = { baseId: base.id, id: deal.id, seed, initial, route: deal.winningPath,
    lateLossPaths: evidence.trials[0].runs.map(run => run.traceDigest), evidence };
  await writeFile('src/content/campaign-v8-equality-bank.json', JSON.stringify(file) + '\n');
  console.log({ id: file.id, seed, witness: deal.winningPath.length, bots: evidence.trials[0].runs.map(run => [run.policyId, run.steps]) });
  process.exit(0);
}
throw Error('No fair Equality trial passed both oracles');
