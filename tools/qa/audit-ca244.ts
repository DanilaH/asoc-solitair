/** Reproducible own-board comparison, not an original-device or human test. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import corpus from '../../tests/fixtures/ca244-continue.json' with { type: 'json' };
import { BALANCE } from '../../src/domain/balance';
import { findContinue, verifiesContinue } from '../../src/domain/continuation';
import { knownContinuation, solve } from '../../src/domain/solver';
import { freshSave } from '../../src/domain/engine';
import { buyContinue } from '../../src/domain/services';
import { advance } from './gameplay-oracle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

assert.equal(BALANCE.continueCoinPrice, 900);
const deals = corpus.deals as unknown as Record<string, Deal>;
const results = corpus.positions.map(row => {
  const deal = deals[row.dealId], save = freshSave(deal, 'ca244-audit');
  save.attempt.board = structuredClone(row.board) as unknown as Board;
  const board: Board = { ...save.attempt.board, phase: 'playing', movesLeft: 10 };
  const t0 = performance.now(), deadline = t0 + 1400;
  // Exact pre-CA06 strategy. The original fast lower bound remains in product.
  const known = knownContinuation(board, deal);
  const baseline = Object.values(deal.cards).filter(c => c.leader && !board.collected.includes(c.id)).length > 10
    ? { status: 'UNSOLVABLE' }
    : known && verifiesContinue(save.attempt, { attemptId: save.attempt.id, deal, path: known })
      ? { status: 'SOLVED' } : solve(board, deal, 3000, deadline);
  const baselineMs = Math.round(performance.now() - t0), t1 = performance.now();
  const candidate = findContinue(save.attempt, deal, 3000, t1+1400);
  const candidateMs = Math.round(performance.now() - t1);
  if (row.candidateCost !== null) assert.equal(candidate.status, 'PROVEN_RECOVERABLE', row.boardHash);
  let cost: number | null = null;
  if (candidate.status === 'PROVEN_RECOVERABLE') {
    let oracle = board;
    for (const action of candidate.path as BoardCommand[]) oracle = advance(oracle, action, deal)!;
    assert.equal(oracle.phase, 'won'); cost = 10-oracle.movesLeft!;
    const proof = { attemptId: save.attempt.id, deal, path: candidate.path };
    assert(verifiesContinue(save.attempt, proof)); save.profile.coins = 900;
    assert(buyContinue(save, proof)); assert.equal(save.profile.coins, 0);
    assert.equal(save.attempt.board.movesLeft, 10); assert.equal(buyContinue(save, proof), false);
  }
  const result = { hash: row.boardHash, shape: row.shape, exact: row.exactPilot5, baseline: baseline.status,
    baselineMs, candidate: candidate.status, candidateMs, cost };
  console.log('CA244_ROW '+JSON.stringify(result)); return result;
});
const aggregate = (rows: typeof results) => ({ n: rows.length,
  baseline: rows.filter(r => r.baseline === 'SOLVED').length,
  candidate: rows.filter(r => r.candidate === 'PROVEN_RECOVERABLE').length,
  lost: rows.filter(r => r.baseline === 'SOLVED' && r.candidate !== 'PROVEN_RECOVERABLE').length,
  baselineMaxMs: Math.max(...rows.map(r => r.baselineMs)), candidateMaxMs: Math.max(...rows.map(r => r.candidateMs)) });
const summary = { head: execFileSync('git',['rev-parse','HEAD'], { encoding: 'utf8' }).trim(),
  limits: corpus.limits, all: aggregate(results), prior: aggregate(results.filter(r => r.exact)), results };
assert.equal(summary.all.baseline,5); assert.equal(summary.all.candidate,11); assert.equal(summary.all.lost,0);
assert.equal(summary.prior.candidate,4);
mkdirSync('.recording/ca244', { recursive: true });
writeFileSync('.recording/ca244/comparison.json', JSON.stringify(summary,null,2)+'\n');
console.log('CA244_SUMMARY '+JSON.stringify({ ...summary, results: undefined }));
