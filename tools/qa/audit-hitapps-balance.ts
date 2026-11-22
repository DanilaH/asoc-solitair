import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { adaptiveBank } from '../../src/content/campaign-v8-adaptive';
import { content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { applyBoard, sameBoardCommand } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { replayAuthoredRoute } from '../content/hitapps-authoring';
import { advance, identity, options, search } from './gameplay-oracle';

const bases = [...content8Wave, ...content8Late];
const adaptive = adaptiveBank(bases);
const rows = bases.map(base => {
  const entry = adaptive.get(base.id)!;
  assert(entry.tight);
  function verify(deal: Deal) {
    const board = replayAuthoredRoute(deal, deal.winningPath);
    assert.equal(board.phase, 'won');
    return board.movesLeft!;
  }
  return { level: base.campaignLevel!, base: verify(base), tight: verify(entry.tight), relief: verify(entry.relief),
    id: base.id, budget: entry.tight.initial.movesLeft!, deal: entry.tight };
});

function probe(deal: Deal) {
  const pivots: { action: BoardCommand; step: number; position: Board; choices: number }[] = [];
  let board = deal.initial;
  const boundaries = [.25, .5, .75].map(fraction => Math.floor(deal.winningPath.length * fraction));
  for (const [index, move] of deal.winningPath.entries()) {
    const witness = advance(board, move, deal)!;
    if (pivots.length < boundaries.length && index >= boundaries[pivots.length]) {
      const alternatives = new Map<string, ReturnType<typeof options>[number]>();
      for (const next of options(board, deal, true)) {
        if (!sameBoardCommand(move, next.action) && identity(witness, deal) !== identity(next.board, deal)) {
          alternatives.set(identity(next.board, deal), next);
        }
      }
      const alt = [...alternatives.values()].find(entry => entry.action.type === 'transfer') ?? alternatives.values().next().value;
      if (alt) {
        const applied = applyBoard(board, alt.action, deal);
        assert(typeof applied !== 'string');
        assert.deepEqual(applied.board, alt.board);
        pivots.push({ action: alt.action, step: index + 1, position: alt.board, choices: alternatives.size });
      }
    }
    board = witness;
  }
  return pivots.map(({ action, step, position, choices }) => {
    const bounded = findReferenceRoute(deal, position, 800);
    const independent = bounded.path ? undefined : search(position, deal, 500);
    const path = bounded.path ?? (independent?.status === 'SOLVED' ? independent.path : undefined);
    if (path) {
      const remaining = replayAuthoredRoute({ ...deal, initial: position }, path);
      assert.equal(remaining.phase, 'won');
      return { action, step, choices, outcome: 'VERIFIED_WIN', remaining: remaining.movesLeft };
    }
    return { action, step, choices, outcome: independent?.status === 'UNSOLVABLE' ? 'NO_WIN_IN_ORACLE_GRAPH' : 'UNKNOWN_LIMIT' };
  });
}

const sensitive = rows.filter(row => row.tight <= 5 || row.tight * 10 <= row.deal.winningPath.length);
const detours = sensitive.sort((a, b) => a.tight - b.tight || a.level - b.level).map(row => {
  const attempts = probe(row.deal);
  return { level: row.level, slack: row.tight, attempts };
});
const average = (field: 'base' | 'tight' | 'relief') => Number((rows.reduce((sum, row) => sum + row[field], 0) / rows.length).toFixed(2));
const results = {
  schema: 'hitapps-balance-v1', scope: 'PRODUCT_ADAPTED witness and bounded detours',
  levels: rows.length, pathsReplayed: rows.length * 3, averages: { base: average('base'), tight: average('tight'), relief: average('relief') },
  tightAtMostFive: rows.filter(row => row.tight <= 5).map(row => row.level),
  tightAtMostTenPercent: rows.filter(row => row.tight * 10 <= row.deal.winningPath.length).length,
  sensitiveLevels: sensitive.length,
  detourTotals: Object.fromEntries(['VERIFIED_WIN', 'NO_WIN_IN_ORACLE_GRAPH', 'UNKNOWN_LIMIT'].map(outcome =>
    [outcome, detours.flatMap(record => record.attempts).filter(record => record.outcome === outcome).length])),
  rows: rows.map(({ deal: _deal, ...row }) => row), detours,
};
await mkdir('.authoring/hitapps', { recursive: true });
await writeFile('.authoring/hitapps/balance.json', JSON.stringify(results, null, 2) + '\n');
const { rows: _rows, detours: _detours, ...summary } = results;
console.log(JSON.stringify(summary));
