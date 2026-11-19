import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { content7Deals } from '../../src/content/campaign-v7';
import { content8Slice } from '../../src/content/campaign-v8-preview';
import { applyBoard, assertBoard, packet, sourceCards } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal, Location } from '../../src/domain/types';
import { advance, identity, options } from './gameplay-oracle';
import { referenceActions } from '../content/reference-route';
import source from '../../docs/qa/content-v8/hitapps-local-1-31.json';
import evidence from '../../docs/qa/content-v8/slice-evidence.json';

function prebuilt(deal: Deal) {
  const start = deal.initial;
  const sameThemeColumns = start.tableau.filter(col => col.length > 1 && col.every(id => deal.cards[id].category === deal.cards[col[0]].category));
  const readyPackets = start.tableau.map((_, i) => packet(start, i, deal)).filter(ids => ids.length > 1);
  const readyLeaderPackets = readyPackets.filter(ids => ids.some(id => deal.cards[id].leader));
  // Count distinct categories finishable from the start in at most three foundation
  // transfers. No draw, recycle or lower arrangement is permitted in this probe.
  const done = new Map<string, number>(), seen = new Set<string>();
  function visit(board: Board, steps: number) {
    if (steps === 3 || board.phase !== 'playing') return;
    const key = steps + identity(board, deal);
    if (seen.has(key)) return;
    seen.add(key);
    for (const { action, board: next } of options(board, deal, true)) {
      if (action.type !== 'transfer' || action.to.kind !== 'foundation') continue;
      for (const id of next.collected) {
        const theme = deal.cards[id].category;
        done.set(theme, Math.min(done.get(theme) ?? Infinity, steps + 1));
      }
      visit(next, steps + 1);
    }
  }
  visit(start, 0);
  return {
    level: deal.campaignLevel,
    sameThemeColumns: sameThemeColumns.length,
    readyPackets: readyPackets.map(ids => ({ theme: deal.cards[ids[0]].category, cards: ids.length })),
    readyLeaderPackets: readyLeaderPackets.length,
    quicklyFinishable: Object.fromEntries(done),
  };
}

function decode(s: string): BoardCommand[] {
  function loc(value: string): Location {
    if (value === 'w') return { kind: 'waste', index: 0 };
    assert(/^[tf]\d+$/.test(value), value);
    return { kind: value.startsWith('t') ? 'tableau' : 'foundation', index: Number(value.slice(1)) };
  }
  return s.split(' ').map(raw => {
    if (raw === 'd' || raw === 'r') return { type: raw === 'd' ? 'draw' : 'recycle' };
    const [from, to] = raw.split('>');
    return { type: 'transfer', from: loc(from), to: loc(to) };
  });
}

function replay(deal: Deal, path: BoardCommand[]) {
  let board = deal.initial, oracle = deal.initial;
  const track = [];
  for (const action of path) {
    const next = applyBoard(board, action, deal), other = advance(oracle, action, deal);
    assert(typeof next !== 'string', deal.id + ': ' + next);
    assert.deepEqual(next.board, other, deal.id);
    track.push(board);
    board = next.board; oracle = other!;
  }
  assert.equal(board.phase, 'won', deal.id);
  return { track, board };
}

const c7Audit = content7Deals.map(prebuilt);
const output = [];
assert.deepEqual(content8Slice.map(d => d.campaignLevel), [6,7,8,9,10,11,12,13,14,15]);
type Buried = { level: number; step: number; id: string; path: string; total: number };
const discarded: Buried[] = JSON.parse(await readFile('docs/qa/content-v8/stock-recoveries.json', 'utf8'));
for (const deal of content8Slice) {
  const level = deal.campaignLevel!, row = source[level - 1], entry = evidence.find(e => e.level === level)!;
  const measured = prebuilt(deal);
  assertBoard(deal.initial, deal);
  assert.equal(Object.values(deal.cards).filter(card => card.leader).length, row.categories);
  assert.equal(Object.keys(deal.cards).length, row.cards);
  assert.equal(deal.initial.stock.length, row.stock);
  assert.equal(deal.initial.tableau.length, row.columns);
  assert.equal(deal.initial.movesLeft, row.baseMoves + ([7, 12].includes(level) ? 5 : 0));
  assert.equal(measured.sameThemeColumns, 0); assert.equal(measured.readyPackets.length, 0);
  assert.deepEqual(measured.quicklyFinishable, {});
  const { track, board } = replay(deal, deal.winningPath);
  assert.equal(board.movesLeft, entry.slack);
  assert.equal(deal.winningPath.filter(a => a.type === 'draw').length, entry.draws);
  const stockIds = new Set(deal.initial.stock);
  let parked = 0, lower = 0, decisions = 0, chooseDraw = 0, maxForced = 0, run = 0;
  const destinations = new Set<string>();
  for (const [i, action] of deal.winningPath.entries()) {
    const state = track[i], candidates = referenceActions(state, deal);
    const transfer = candidates.some(m => m.type === 'transfer');
    if (transfer && candidates.length > 1) decisions++;
    if (action.type !== 'transfer') {
      if (transfer) { chooseDraw++; run = 0; } else maxForced = Math.max(maxForced, ++run);
      continue;
    }
    run = 0;
    if (action.to.kind === 'tableau') { lower++; if (action.from.kind === 'waste') parked++; }
    else for (const id of sourceCards(state, action.from, deal)) if (stockIds.has(id)) destinations.add(id);
  }
  assert.equal(destinations.size, row.stock);
  assert.equal(parked, entry.parked); assert.equal(lower, entry.lower); assert.equal(decisions, entry.decisionStates);
  assert.equal(chooseDraw, entry.selectedDraw); assert.equal(maxForced, entry.maxRun);
  for (const branch of entry.alternatives) {
    assert.notDeepEqual(deal.winningPath[branch.step], branch.action);
    const path = [...deal.winningPath.slice(0, branch.step), branch.action as BoardCommand, ...decode(branch.path)];
    assert.equal(path.length, branch.total);
    replay(deal, path);
  }
  assert(entry.alternatives.some(x => x.extraAgainstWitness > 0));
  for (const branch of discarded.filter(x => x.level === level)) {
    assert.equal(track[branch.step].waste.at(-1), branch.id);
    const path: BoardCommand[] = [...deal.winningPath.slice(0, branch.step), { type: 'draw' }, ...decode(branch.path)];
    assert.equal(path.length, branch.total);
    const { track: steps } = replay(deal, path);
    const recycling = path.findIndex((a, i) => a.type === 'recycle' && steps[i].waste.includes(branch.id));
    assert(recycling > branch.step);
    assert(path.some((a, i) => i > recycling && a.type === 'transfer' && sourceCards(steps[i], a.from, deal).includes(branch.id)));
  }
  output.push({ ...measured, stockUsed: destinations.size, forcedRunMax: maxForced, branches: entry.alternatives.length,
    stockRecoveries: discarded.filter(branch => branch.level === level).length });
}
const summary = {
  c7Levels: c7Audit.length,
  c7HomogeneousLevels: c7Audit.filter(row => row.sameThemeColumns).length,
  c7LevelsWithReadyLeader: c7Audit.filter(row => row.readyLeaderPackets).length,
  c7LevelsWithQuickFinish: c7Audit.filter(row => Object.keys(row.quicklyFinishable).length).length,
  c8Levels: output.length,
  c8BranchWins: output.reduce((n, row) => n + row.branches + row.stockRecoveries, 0),
};
if (process.env.C8_WRITE_AUDIT === '1') await writeFile('docs/qa/content-v8/stock-and-packets.json',
  JSON.stringify({ summary, content7: c7Audit, content8: output }, null, 2) + '\n');
console.log(JSON.stringify(summary));
