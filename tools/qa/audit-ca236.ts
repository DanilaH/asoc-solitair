import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { campaignDeals, campaignCoreDeals, findDeal, selectCampaignDeal } from '../../src/content/campaign';
import { freshSave, applyBoard } from '../../src/domain/engine';
import { campaignId, dailyTasksAvailable } from '../../src/domain/progression';
import { grantEventPrize } from '../../src/domain/events/daily-tasks';
import * as hint from '../../src/domain/hint';
import { quoteLayoutRetry, commitAdaptiveRetry } from '../../src/app/campaign-retry';
import { applyReceipt } from '../../src/domain/services';
import * as joker from '../../src/domain/random-joker';
import { advance } from './gameplay-oracle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { dailyForDay } from '../../src/content/daily';

const phase = process.argv[2] ?? 'after';
const legacyPlacement = joker.placeRandomJoker;
function selected(level: number) {
  const exact = level === 2 ? 'campaign-ha4-2-280006-4f50c85dae3c8c5f-272bb506-core-stage1-v1-m1'
    : level === 6 ? 'campaign-ha4-6-680057-a9d537d3500896af-9524f5b7-core-stage1-v1-m1' : '';
  if (exact) return findDeal(exact)!;
  const entry = [...campaignCoreDeals()].find(e => e.deal.campaignLevel === level);
  if (entry) return findDeal(entry.deal.id + '-m1') ?? entry.deal;
  const base = campaignDeals[level - 1], save = freshSave(base, 'select');
  return selectCampaignDeal(save, base);
}
function fixture(level: number) {
  const deal = selected(level), save = freshSave(deal, 'audit-236');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: level - 1 }, (_, i) => campaignId(i + 1)) };
  return { deal, save };
}
function replay(board: Board, path: readonly BoardCommand[], deal: Deal) {
  for (const action of path) { const next = advance(board, action, deal); if (!next) return; board = next; }
  return board;
}
const hints = [];
for (const level of [2,3,6,10,12,16,23,39,66,80,81]) {
  const deal = selected(level);
  let off: { board: Board; prefix: number; proof: BoardCommand[] } | undefined;
  for (let prefix = 0; prefix + 1 < deal.winningPath.length; prefix++) {
    const board = replay(deal.initial, deal.winningPath.slice(0, prefix), deal);
    if (!board) throw Error('invalid witness');
    const path = [deal.winningPath[prefix + 1], deal.winningPath[prefix], ...deal.winningPath.slice(prefix + 2)];
    const swapped = replay(board, path.slice(0,2), deal);
    if (!swapped || swapped.phase !== 'playing' || replay(swapped, path.slice(2), deal)?.phase !== 'won') continue;
    // Exact off-route check, as opposed to a commutation that returns to the witness.
    const first = applyBoard(board, path[0], deal);
    if (typeof first === 'string' || first.board.phase !== 'playing') continue;
    const { knownContinuation } = await import('../../src/domain/solver');
    if (knownContinuation(first.board, deal)) continue;
    off = { board: first.board, prefix, proof: path.slice(1) }; break;
  }
  if (!off) throw Error('no independently witnessed deviation L' + level);
  const start = performance.now(), result = hint.resolveHint(off.board, deal), ms = performance.now() - start;
  const route = 'resolveHintRoute' in hint ? hint.resolveHintRoute(off.board, deal) : undefined;
  const oracle = route?.status === 'SOLVED' ? replay(off.board, route.path, deal)?.phase === 'won' : undefined;
  hints.push({ level, deal: deal.id, prefix: off.prefix, witnessed: replay(off.board, off.proof, deal)?.phase === 'won', ...result, oracle, ms: Math.round(ms) });
}
const { save: early } = fixture(2);
const shuffleGranted = grantEventPrize(early, { kind: 'Shuffle', quantity: 2 });
const { deal, save } = fixture(6);
save.attempt.director = { restarts: 2, previousLosses: 2 };
save.attempt.sourceDifficulty = { outcome: 'Restart', restarts: 2 };
const quote = quoteLayoutRetry(save)!;
const retry = commitAdaptiveRetry(save, quote, 'audit-next', Date.UTC(2026,10,28), quoteLayoutRetry);
applyReceipt(save, { schema: 1, id: 'late-slot', attempt: 'audit-236', dealId: deal.id, mode: 'campaign', placement: 'bonus-tableau' }, { deal });
const jokers = [];
for (const [level, prefix] of [[2,5],[6,10],[16,60],[23,58],[39,62],[81,5],[100,38],[150,11]]) {
  const { deal, save } = fixture(level);
  const board = replay(save.attempt.board, deal.winningPath.slice(0,prefix), deal);
  if (!board) throw Error('bad prefix');
  save.attempt.board = board;
  const columns = [];
  for (let column = 0; column < Math.min(5,board.tableau.length); column++) {
    const start = performance.now(), candidate = 'placeRandomJokerAt' in joker
      ? joker.placeRandomJokerAt(save.attempt, deal, column, 'azj-audit')
      : legacyPlacement(save.attempt, deal, () => column, () => 'azj-audit');
    const path = candidate && joker.proveRandomJoker(candidate, deal, performance.now()+220);
    columns.push({ column, empty: !board.tableau[column].length, placed: Boolean(candidate), proved: Boolean(path), ms: Math.round(performance.now()-start) });
  }
  const started = performance.now();
  const selection = 'findRandomJokerPlacement' in joker ? joker.findRandomJokerPlacement(save.attempt, deal, 'azj-selection', () => 0) : undefined;
  const candidate = selection && joker.placeRandomJokerAt(save.attempt, deal, selection.column, selection.id);
  jokers.push({ level, deal: deal.id, prefix, columns, selection: selection ? { column: selection.column,
    oracle: candidate && replay(candidate, selection.path, deal)?.phase === 'won', ms: Math.round(performance.now()-started) } : null });
}
// Controlled random reachable boards. Two independently commuting witness actions
// in random positions provide a full known solution, without using the hint search.
let rng = 236;
const random = (n: number) => { rng = (Math.imul(rng,1664525)+1013904223)>>>0; return rng%n; };
const { knownContinuation } = await import('../../src/domain/solver');
const reachable = [];
for (let sample = 0; sample < 60; sample++) {
  const level = [2,3,6,10,12,16,23,39,66,80,81,100,150,200][sample%14];
  const deal = sample%5 === 4 ? dailyForDay(new Date(Date.UTC(2026,10,28)+sample*86400000).toISOString().slice(0,10)) : selected(level);
  const positions = Array.from({length:deal.winningPath.length-1},(_,i)=>i);
  let board: Board | undefined, prefix = -1;
  while (positions.length) {
    const [at] = positions.splice(random(positions.length),1), start = replay(deal.initial,deal.winningPath.slice(0,at),deal);
    if (!start) continue;
    const tail = [deal.winningPath[at+1],deal.winningPath[at],...deal.winningPath.slice(at+2)];
    const off = replay(start,tail.slice(0,1),deal);
    if (!off || off.phase !== 'playing' || knownContinuation(off,deal) || replay(off,tail.slice(1),deal)?.phase !== 'won') continue;
    board=off;prefix=at;break;
  }
  if (!board) continue;
  const start=performance.now(), result=hint.resolveHint(board,deal), ms=Math.round(performance.now()-start);
  const route = 'resolveHintRoute' in hint ? hint.resolveHintRoute(board,deal) : undefined;
  reachable.push({sample,level:deal.daily?'Daily':level,deal:deal.id,prefix,status:result.status,
    oracle:route?.status==='SOLVED'?replay(board,route.path,deal)?.phase==='won':undefined,ms});
}
const result = { phase, shuffle: { granted: shuffleGranted, inventory: early.dailyTasks?.inventory.shuffles ?? 0, tasksAvailable: dailyTasksAvailable(early) },
  retry: { result: retry, director: save.attempt.director ?? null, sourceDifficulty: save.attempt.sourceDifficulty ?? null },
  lateSlot: { platform: save.platform, columns: save.attempt.board.tableau.length }, hints, jokers, reachable };
mkdirSync('.recording/ca236', { recursive: true });
writeFileSync(`.recording/ca236/${phase}.json`, JSON.stringify(result,null,2));
if (phase === 'after') {
  assert.equal(hints.length,11); assert.equal(reachable.length,60);
  assert([...hints,...reachable].every(row=>row.status==='SOLVED'&&row.oracle));
  assert.equal(result.shuffle.granted,true); assert.equal(result.shuffle.tasksAvailable,false);
  assert.deepEqual(result.retry.director,{restarts:3,previousLosses:2});
  assert.deepEqual(result.retry.sourceDifficulty,{outcome:'Restart',restarts:3});
  assert.equal(result.lateSlot.platform?.bonusSlotCredits?.tableau,1);
  assert(jokers.every(row=>!row.selection||row.selection.oracle));
}
console.log(JSON.stringify({phase,shuffle:result.shuffle,retry:result.retry,hints:hints.map(({level,status,ms})=>({level,status,ms})),
  reachable:{total:reachable.length,solved:reachable.filter(row=>row.status==='SOLVED').length},jokers:jokers.map(({level,selection})=>({level,selection}))}));
