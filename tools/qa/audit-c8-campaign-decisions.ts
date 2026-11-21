import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { campaignDeals, isCurrentCampaignDeal } from '../../src/content/campaign';
import { content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { content8DirectorDeals } from '../../src/content/campaign-v8-director';
import { bonusKinds, bonusOffer, openBonusSlot } from '../../src/domain/bonus-slots';
import { applyBoard, boardKey, freshAttempt, legalCommands, sourceCards } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { knownContinuation, solve } from '../../src/domain/solver';
import { CONTENT8_PREVIEW, type Board, type BoardCommand, type BonusKind, type Deal, type Location } from '../../src/domain/types';
import { advance, options, search } from './gameplay-oracle';

const phases = ['early', 'middle', 'late'] as const;
const kinds = ['other-leader', 'other-transfer', 'other-target', 'transfer-vs-stock', 'skip-waste', 'draw', 'recycle'] as const;
type Phase = typeof phases[number];
type Kind = typeof kinds[number];
type Scenario = { bank: 'campaign' | 'archived' | 'director' | 'bonus-open'; deal: Deal; slots?: BonusKind[] };
type Pivot = { step: number; phase: Phase; board: Board; chosen: BoardCommand; alternatives: Candidate[]; canRecycle: boolean; transfers: number };
type Candidate = { kind: Kind; action: BoardCommand; board: Board; prefix: BoardCommand[] };
type Result =
  | { outcome: 'WIN'; proof: 'witness' | 'rejoin' | 'ordinary-search' | 'oracle'; route: BoardCommand[] }
  | { outcome: 'NO_WIN'; proof: 'both-graphs' }
  | { outcome: 'UNKNOWN'; proof: 'search-limit' };
const requestedLevel = process.argv[2];
if (requestedLevel !== undefined && !/^--deep-level=([1-9]|[1-7][0-9]|80)$/.test(requestedLevel))
  throw Error('Use --deep-level=N with a campaign level from 1 to 80');
const deepLevel = requestedLevel ? Number(requestedLevel.split('=')[1]) : undefined;
const searchLimit = deepLevel ? 1400 : 320;
const ordinarySearchLimit = deepLevel ? 800 : 100;
const sampleIntervals = deepLevel ? 21 : 9;
const encodeLocation = ({ kind, index }: Location) => kind[0] + index;
const encode = (a: BoardCommand) => a.type === 'draw' ? 'd' : a.type === 'recycle' ? 'r' : encodeLocation(a.from) + '>' + encodeLocation(a.to);
const encodeRoute = (path: readonly BoardCommand[]) => path.map(encode).join(' ');

function step(board: Board, action: BoardCommand, deal: Deal): Board {
  const result = applyBoard(board, action, deal);
  if (typeof result === 'string') throw Error(deal.id + ' rejected ' + encode(action) + ': ' + result);
  assert.deepEqual(advance(board, action, deal), result.board, deal.id + ' oracle transition ' + encode(action));
  return result.board;
}

function replay(board: Board, path: readonly BoardCommand[], deal: Deal): Board {
  for (const action of path) board = step(board, action, deal);
  return board;
}

function boardIdentity(board: Board, deal: Deal) {
  // Unlocked tableau positions and foundation slots have identical board rules.
  // Keep the indexed lower positions whenever a lock or Joker can affect them.
  const byCards = (a: string[], b: string[]) => {
    const first = a.join(',');
    const second = b.join(',');
    return first < second ? -1 : first > second ? 1 : 0;
  };
  return boardKey({
    ...board, tableau: deal.lock || board.joker ? board.tableau : [...board.tableau].sort(byCards),
    foundations: [...board.foundations].sort(byCards),
  });
}

function classify(action: BoardCommand, chosen: BoardCommand, board: Board, deal: Deal, coversWaste: boolean): Kind {
  if (action.type === 'recycle') return 'recycle';
  if (action.type === 'draw') return coversWaste ? 'skip-waste' : 'draw';
  if (chosen.type !== 'transfer') return 'transfer-vs-stock';
  if (encodeLocation(action.from) === encodeLocation(chosen.from)) return 'other-target';
  const startsTheme = (move: typeof action) => move.to.kind === 'foundation' && sourceCards(board, move.from, deal).some(id => deal.cards[id].leader);
  return startsTheme(action) && startsTheme(chosen) ? 'other-leader' : 'other-transfer';
}

function inspectPivot(stepIndex: number, phase: Phase, board: Board, chosen: BoardCommand, next: Board, deal: Deal): Pivot {
  const oracle = options(board, deal);
  const actions = legalCommands(board, deal);
  assert.deepEqual(oracle.map(item => encode(item.action)).sort(), actions.map(encode).sort(), deal.id + ' legal commands');
  const seen = new Set([boardIdentity(next, deal)]);
  const coversWaste = actions.some(a => a.type === 'transfer' && a.from.kind === 'waste' && a.to.kind === 'foundation');
  const alternatives: Candidate[] = [];
  for (const { action, board: oracleBoard } of oracle) {
    const result = applyBoard(board, action, deal);
    if (typeof result === 'string') throw Error(result);
    assert.deepEqual(oracleBoard, result.board);
    const key = boardIdentity(result.board, deal);
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push({ kind: classify(action, chosen, board, deal, coversWaste), action, board: result.board, prefix: [] });
  }
  return { step: stepIndex, phase, board, chosen, alternatives, canRecycle: actions.some(action => action.type === 'recycle'),
    transfers: actions.filter(action => action.type === 'transfer').length };
}

function sample(deal: Deal, initial: Board) {
  const witness = deal.winningPath;
  const pivots: Pivot[] = [];
  const checkpointKeys = new Set<string>();
  for (const route of [witness, ...(deal.recoveryPaths ?? [])]) {
    let board = initial;
    for (const [index, action] of route.entries()) {
      checkpointKeys.add(boardIdentity(board, deal));
      const next = step(board, action, deal);
      if (route === witness && (index === 0 || index === witness.length - 1 ||
        Math.floor(index * sampleIntervals / witness.length) !== Math.floor((index - 1) * sampleIntervals / witness.length))) {
        pivots.push(inspectPivot(index, phases[Math.floor(index * 3 / witness.length)], board, action, next, deal));
      }
      board = next;
    }
    assert.equal(board.phase, 'won', deal.id + ' authored witness');
  }
  return { pivots, checkpointKeys };
}

function follow(candidate: Candidate, deal: Deal, checkpointKeys: ReadonlySet<string>): Result {
  if (candidate.board.phase === 'won') return { outcome: 'WIN', proof: 'witness', route: [] };
  const known = checkpointKeys.has(boardIdentity(candidate.board, deal)) ? knownContinuation(candidate.board, deal) : null;
  if (known) return { outcome: 'WIN', proof: 'witness', route: known };
  // Check short detours back to an authored state before spending the search budget.
  for (const { action, board } of options(candidate.board, deal)) {
    if (!checkpointKeys.has(boardIdentity(board, deal))) continue;
    const continuation = knownContinuation(board, deal);
    if (continuation) return { outcome: 'WIN', proof: 'rejoin', route: [action, ...continuation] };
  }
  if (!deal.lock && !candidate.board.joker && !Object.values(deal.cards).some(card => card.ordered)) {
    const result = findReferenceRoute(deal, candidate.board, ordinarySearchLimit);
    if (result.status === 'FOUND') return { outcome: 'WIN', proof: 'ordinary-search', route: result.path };
  }
  const result = search(candidate.board, deal, searchLimit);
  if (result.status === 'SOLVED') return { outcome: 'WIN', proof: 'oracle', route: result.path };
  if (result.status === 'UNSOLVABLE' && solve(candidate.board, deal, searchLimit).status === 'UNSOLVABLE')
    return { outcome: 'NO_WIN', proof: 'both-graphs' };
  return { outcome: 'UNKNOWN', proof: 'search-limit' };
}

function recycleProbe(pivot: Pivot, deal: Deal): Candidate | undefined {
  const action = { type: 'recycle' } as const;
  const prefix = Array.from({ length: pivot.board.stock.length }, () => ({ type: 'draw' } as const));
  const needed = prefix.length + 1;
  if (pivot.board.movesLeft !== null && pivot.board.movesLeft < needed) return;
  if (!prefix.length && !pivot.board.waste.length) return;
  const before = replay(pivot.board, prefix, deal);
  return { kind: 'recycle', prefix, action, board: step(before, action, deal) };
}

function run({ bank, deal, slots = [] }: Scenario) {
  const attempt = freshAttempt(deal, 'decision-audit');
  for (const slot of slots) assert(openBonusSlot(attempt, deal, slot), deal.id + ' bonus ' + slot);
  const { pivots, checkpointKeys } = sample(deal, attempt.board);
  function examine(pivot: Pivot, candidate: Candidate) {
    const result = follow(candidate, deal, checkpointKeys);
    const before = replay(pivot.board, candidate.prefix, deal);
    assert.deepEqual(step(before, candidate.action, deal), candidate.board);
    const moved = candidate.action.type === 'transfer' ? sourceCards(before, candidate.action.from, deal) : undefined;
    const evidence = { phase: pivot.phase, step: pivot.step + 1, budget: pivot.board.movesLeft, kind: candidate.kind,
      witness: encode(pivot.chosen), prefix: encodeRoute(candidate.prefix), action: encode(candidate.action),
      ...(moved?.length ? { moved } : {}), outcome: result.outcome, proof: result.proof };
    if (result.outcome !== 'WIN') return evidence;
    let board = candidate.board;
    const original = boardIdentity(pivot.board, deal);
    let loopsBack = boardIdentity(board, deal) === original;
    for (const action of result.route) {
      board = step(board, action, deal);
      loopsBack ||= boardIdentity(board, deal) === original;
    }
    assert.equal(board.phase, 'won', deal.id + ' alternative proof');
    return { ...evidence, route: encodeRoute(result.route), movesLeft: board.movesLeft, loopsBack };
  }
  const probes = phases.flatMap(phase => kinds.flatMap(kind => {
    const opportunities = pivots.filter(pivot => pivot.phase === phase);
    for (const pivot of opportunities) {
      const candidate = pivot.alternatives.find(candidate => candidate.kind === kind);
      if (candidate) return [examine(pivot, candidate)];
    }
    return [];
  }));
  if (!probes.some(probe => probe.kind === 'recycle')) {
    const closest = [...pivots].filter(pivot => !pivot.canRecycle && (pivot.board.stock.length || pivot.board.waste.length))
      .sort((a, b) => a.board.stock.length - b.board.stock.length || b.step - a.step);
    for (const pivot of closest) {
      const candidate = recycleProbe(pivot, deal);
      if (!candidate) continue;
      probes.push(examine(pivot, candidate));
      break;
    }
  }
  return { bank, level: deal.campaignLevel!, dealId: deal.id, slots, training: deal.training ?? null,
    dealDigest: createHash('sha256').update(JSON.stringify(deal)).digest('hex'), budget: deal.initial.movesLeft,
    witnessLength: deal.winningPath.length, witnessRecycles: deal.winningPath.filter(action => action.type === 'recycle').length,
    pivots: pivots.map(p => ({ step: p.step + 1, phase: p.phase, chosen: encode(p.chosen), transfers: p.transfers,
      canRecycle: p.canRecycle, distinct: Object.fromEntries(kinds.map(kind => [kind, p.alternatives.filter(a => a.kind === kind).length])) })),
    probes };
}

assert(CONTENT8_PREVIEW, 'Build with VITE_CONTENT8_PREVIEW=1');
assert.deepEqual(campaignDeals.map(deal => deal.campaignLevel), Array.from({ length: 80 }, (_, index) => index + 1));
const archive = [...content8Wave, ...content8Late].filter(deal => !campaignDeals.includes(deal));
const director = content8DirectorDeals.filter(deal => isCurrentCampaignDeal(deal.id, campaignDeals[deal.campaignLevel! - 1]));
const scenarios: Scenario[] = [
  ...campaignDeals.map(deal => ({ bank: 'campaign' as const, deal })),
  ...archive.map(deal => ({ bank: 'archived' as const, deal })),
  ...director.map(deal => ({ bank: 'director' as const, deal })),
  ...campaignDeals.flatMap(deal => {
    const available = bonusKinds.filter(kind => bonusOffer(deal, kind));
    const choices = available.map(kind => [kind]);
    if (available.length === 2) choices.push(available);
    return choices.map(slots => ({ bank: 'bonus-open' as const, deal, slots }));
  }),
];
const selected = deepLevel ? scenarios.filter(scenario => scenario.bank === 'campaign' && scenario.deal.campaignLevel === deepLevel) : scenarios;
const rows = selected.map(scenario => {
  const row = run(scenario);
  console.log(row.bank, row.level, row.slots.join('+'), row.probes.length, row.probes.filter(probe => probe.outcome === 'WIN').length);
  return row;
});
const output = { schema: 1, searchLimit, ordinarySearchLimit, rows };
const directory = '.authoring/content8';
await mkdir(directory, { recursive: true });
const filename = deepLevel ? 'campaign-decisions-level-' + deepLevel + '.json' : 'campaign-decisions.json';
await writeFile(directory + '/' + filename, JSON.stringify(output) + '\n');
