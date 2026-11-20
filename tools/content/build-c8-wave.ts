import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { content8Cards, type Content8TopicSelection } from '../../src/content/content8-words';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal, DifficultyTier, Location } from '../../src/domain/types';
import earlyRecipes from '../../docs/qa/content-v8/core3-recipes.json';
import lateRecipes from '../../docs/qa/content-v8/core3-late-recipes.json';
import { lateShapes, type LateShape } from './c8-late-shapes';
import source from '../../docs/qa/content-v8/hitapps-local-1-31.json';
import { advance, identity } from '../qa/gameplay-oracle';
import { preparePriorityPlan } from './candidate-pipeline';
import { distributeWave } from './c8-wave-layout';
import { findReferenceRoute, referenceActions } from './reference-route';

const output = '.authoring/content8-wave';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const location = (loc: Location) => ({ tableau: 't', foundation: 'f', waste: 'w' })[loc.kind] + loc.index;
const encode = (command: BoardCommand) => command.type === 'draw' ? 'd' : command.type === 'recycle' ? 'r' : location(command.from) + '>' + location(command.to);
const encodePath = (path: BoardCommand[]) => path.map(encode).join(' ');

function crossCheck(deal: Deal, path: BoardCommand[]) {
  let board = deal.initial;
  for (const action of path) {
    const next = applyBoard(board, action, deal);
    if (typeof next === 'string' || !isDeepStrictEqual(next.board, advance(board, action, deal))) {
      throw Error('Independent transition mismatch: ' + deal.id);
    }
    board = next.board;
  }
  if (board.phase !== 'won') throw Error('Witness did not win: ' + deal.id);
}

function inspect(deal: Deal, path: BoardCommand[]) {
  let board = deal.initial;
  let forcedRun = 0, longestForcedRun = 0, forcedStock = 0, optionalStock = 0, lowerMoves = 0;
  const probes: { step: number; action: BoardCommand; next: Board; missedWaste: boolean }[] = [];
  for (const [step, action] of path.entries()) {
    const actions = referenceActions(board, deal);
    const next = applyBoard(board, action, deal);
    if (typeof next === 'string') throw Error(next);
    if (action.type === 'transfer') {
      forcedRun = 0;
      if (action.to.kind === 'tableau') lowerMoves++;
      if (step < path.length * .85) for (const alt of actions) {
        const alternative = applyBoard(board, alt, deal);
        if (typeof alternative === 'string') throw Error(alternative);
        if (identity(alternative.board, deal) === identity(next.board, deal)) continue;
        const missedWaste = action.from.kind === 'waste' && alt.type === 'draw';
        if (missedWaste || alt.type === 'transfer') probes.push({ step, action: alt, next: alternative.board, missedWaste });
      }
    } else if (actions.some(candidate => candidate.type === 'transfer')) {
      optionalStock++;
      forcedRun = 0;
    } else {
      forcedStock++;
      longestForcedRun = Math.max(longestForcedRun, ++forcedRun);
    }
    board = next.board;
  }
  return {
    longestForcedRun, forcedStock, optionalStock, lowerMoves, probes,
    slack: board.movesLeft!,
    recycles: path.filter(step => step.type === 'recycle').length,
  };
}

function auditChoices(deal: Deal, witness: BoardCommand[], probes: ReturnType<typeof inspect>['probes']) {
  const ordered = [...probes.filter(probe => probe.missedWaste), ...probes.filter(probe => !probe.missedWaste)];
  const choices: { step: number; move: string; extraActions: number; missedWaste: boolean; recoveryPath: string }[] = [];
  let otherWins = 0, unresolved = 0, tested = 0;
  for (const probe of ordered.slice(0, 16)) {
    tested++;
    const route = findReferenceRoute(deal, probe.next, 430);
    if (route.status !== 'FOUND') { unresolved++; continue; }
    const full = [...witness.slice(0, probe.step), probe.action, ...route.path];
    const extraActions = full.length - witness.length;
    if (extraActions === 0 || choices.some(choice => choice.step === probe.step)) { otherWins++; continue; }
    choices.push({
      step: probe.step, move: encode(probe.action), extraActions, missedWaste: probe.missedWaste, recoveryPath: encodePath(full),
    });
    if (choices.length === 2) break;
  }
  return { tested, otherWins, unresolved, choices };
}

await mkdir(output, { recursive: true });
const first = Number(process.env.C8_FIRST ?? 16), last = Number(process.env.C8_LAST ?? 80);
const recipes = [
  ...earlyRecipes.map(recipe => {
    const row = source[recipe.level - 1];
    return {
      ...recipe, ...row, budget: row.baseMoves + (row.columns === 3 ? 5 : 0),
      sourcePosition: row.position, sourceBaseMoves: row.baseMoves,
    };
  }),
  ...lateRecipes.map(recipe => ({
    ...recipe, ...lateShapes[recipe.profile as LateShape], sourcePosition: null, sourceBaseMoves: null,
  })),
];
for (const recipe of recipes.filter(row => row.level >= first && row.level <= last)) {
  const { level, title, target, budget, sourcePosition, sourceBaseMoves, seedOffset, searchCap } = recipe;
  const strategy = recipe.strategy as 'ordinary' | 'guided-stock';
  const row = recipe, topics = recipe.topics as Content8TopicSelection[];
  const cards = content8Cards(topics), ids = Object.keys(cards);
  if (ids.length !== row.cards || topics.length !== row.categories || new Set(Object.values(cards).map(card => card.text.toLocaleLowerCase('ru'))).size !== ids.length) {
    throw Error('Invalid editorial bank at level ' + level);
  }
  const columns = Array.from({ length: row.columns }, (_, index) =>
    Math.floor((row.cards - row.stock + index) / row.columns));
  const difficultyTier: DifficultyTier = row.columns === 5 ? 'superhard' : row.cards >= 78 ? 'hard' : 'normal';
  const design = {
    id: 'campaign-c8-wave-' + String(level).padStart(3, '0'), version: 1, title, campaignLevel: level,
    difficultyTier, editorialStatus: 'playtest', tags: ['ordinary-dealer', 'content8-wave'],
  };
  const tolerancePercent = 9;
  const requests = Array.from({ length: 100 }, (_, index) => level * 10000 + seedOffset + index + 1);
  const attempts = { structural: 0, wins: 0, pacing: 0, alternatives: 0 };
  const plan = preparePriorityPlan({
    requests, target, tolerancePercent, digest,
    drawSeed() { throw Error('Positive seed window required'); },
    shuffle(seed) {
      const { stock, tableau } = distributeWave(cards, row.stock, columns, seed, strategy);
      return {
        tableau, stock, faceUp: tableau.map(col => col.at(-1)!), foundations: columns.map(() => []),
        waste: [], collected: [], movesLeft: budget, phase: 'playing', rulesVersion: 3,
      } satisfies Board;
    },
    evaluate({ snapshot: initial }) {
      const leaders = initial.faceUp.filter(id => cards[id].leader).length;
      if (leaders === 0 || leaders === row.columns ||
        initial.tableau.some(col => col.every(id => cards[id].category === cards[col[0]].category))) return;
      attempts.structural++;
      const deal: Deal = { ...design, initial, cards, winningPath: [] };
      assertBoard(initial, deal);
      const route = findReferenceRoute(deal, initial, searchCap);
      if (route.status !== 'FOUND' || budget - route.path.length < 4) return;
      attempts.wins++;
      const { probes, ...metrics } = inspect(deal, route.path);
      if (metrics.longestForcedRun > 9 || metrics.forcedStock / route.path.length > .22 || !metrics.optionalStock) return;
      attempts.pacing++;
      const choices = auditChoices(deal, route.path, probes);
      if (!choices.choices.length) return;
      attempts.alternatives++;
      return { steps: route.path.length, value: { path: route.path, metrics, choices, visited: route.visited, leaders } };
    },
  });
  const selected = plan.selected;
  if (!selected) { console.log(level, 'NO_CERTIFIED_CANDIDATE', plan.attempts, attempts); process.exitCode = 1; continue; }
  const { actualSeed, evaluation, final } = selected;
  const deal: Deal = { ...design, cards, initial: final.snapshot, winningPath: evaluation.path };
  crossCheck(deal, evaluation.path);
  const record = {
    ...design, topics, initial: deal.initial, winningPath: encodePath(evaluation.path),
    recoveryPaths: evaluation.choices.choices.map(choice => choice.recoveryPath),
  };
  const audit = {
    level, sourcePosition, sourceBaseMoves, strategy, seed: actualSeed, seedOffset, searchCap,
    target, tolerancePercent, candidates: plan.attempts, selectedBy: plan.reason, columns, cards: ids.length,
    stock: row.stock, categories: topics.length, layoutHash: digest(deal.initial),
    witnessHash: digest(record.winningPath), steps: evaluation.path.length, initialLeaders: evaluation.leaders,
    ...evaluation.metrics, choices: evaluation.choices, visited: evaluation.visited,
  };
  await writeFile(output + '/level-' + level + '.json', JSON.stringify({ record, audit }) + '\n');
  console.log(level, actualSeed, evaluation.path.length, budget, audit.longestForcedRun, audit.choices.choices.map(choice => choice.extraActions));
}
