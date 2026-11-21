import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { beyondCards, beyondRecipes } from '../../src/content/beyond80-topics';
import { applyBoard, assertBoard, boardKey } from '../../src/domain/engine';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';
import { distributeWave } from './c8-wave-layout';
import { findReferenceRoute, referenceActions } from './reference-route';

function audit(deal: Deal, path: BoardCommand[]) {
  let board = deal.initial, forced = 0, run = 0, peak = 0;
  for (const move of path) {
    if (move.type !== 'transfer' && !referenceActions(board, deal).some(action => action.type === 'transfer')) {
      forced++;
      peak = Math.max(peak, ++run);
    } else run = 0;
    const next = applyBoard(board, move, deal);
    if (typeof next === 'string' || !isDeepStrictEqual(next.board, advance(board, move, deal))) throw Error('Oracle mismatch ' + deal.id);
    board = next.board;
  }
  if (board.phase !== 'won') throw Error('Incomplete witness ' + deal.id);
  return { forced, peak, slack: board.movesLeft, moves: path.length };
}

function alternative(deal: Deal, path: BoardCommand[]) {
  let board = deal.initial, tested = 0;
  for (const [step, move] of path.entries()) {
    const expected = applyBoard(board, move, deal);
    if (typeof expected === 'string') throw Error(expected);
    if (move.type === 'transfer' && step < path.length / 2) {
      for (const other of referenceActions(board, deal)) {
        if (other.type !== 'transfer' || tested >= 12) continue;
        const candidate = applyBoard(board, other, deal);
        if (typeof candidate === 'string' || boardKey(candidate.board) === boardKey(expected.board)) continue;
        tested++;
        const route = findReferenceRoute(deal, candidate.board, 1600);
        if (route.status === 'FOUND') {
          const branchPath = [...path.slice(0, step), other, ...route.path];
          return { tested, step, branchPath, metrics: audit(deal, branchPath) };
        }
      }
    }
    board = expected.board;
  }
}

const compact = (path: BoardCommand[]) => path.map(move => move.type === 'draw' ? 'd' : move.type === 'recycle' ? 'r' :
  `${move.from.kind[0]}${move.from.index}>${move.to.kind[0]}${move.to.index}`).join(' ');

const records = [], witnesses = [];
for (const definition of beyondRecipes) {
  const { level, title, columns, foundations, stock, budget } = definition;
  const cards = beyondCards(definition), size = Object.keys(cards).length;
  const heights = Array.from({ length: columns }, (_, index) => Math.floor((size - stock + index) / columns));
  for (let step = 1; step <= 100; step++) {
    const seed = level * 10_000 + step;
    const piles = distributeWave(cards, stock, heights, seed, 'guided-stock');
    const initial: Deal['initial'] = { ...piles, foundations: Array.from({ length: foundations }, () => []),
      waste: [], faceUp: piles.tableau.map(column => column.at(-1)!), collected: [], rulesVersion: 3, movesLeft: budget, phase: 'playing' };
    const deal: Deal = { id: `campaign-c8-beyond-${level}-r1`, version: 1, title, campaignLevel: level, cards,
      initial, winningPath: [], difficultyTier: columns === 5 ? 'hard' : 'normal',
      editorialStatus: 'ru-original-pilot', tags: ['content8-beyond80'] };
    assertBoard(initial, deal);
    const route = findReferenceRoute(deal, initial, 3400);
    if (route.status !== 'FOUND' || budget - route.path.length < 6) continue;
    const stats = audit(deal, route.path);
    if (stats.peak > 9) continue;
    const recovery = alternative(deal, route.path);
    if (!recovery) continue;
    const publishedBudget = Math.max(route.path.length, recovery.branchPath.length) + (columns === 5 ? 9 : 11);
    const final = { ...deal, initial: { ...deal.initial, movesLeft: publishedBudget } };
    const primary = audit(final, route.path), alternate = audit(final, recovery.branchPath);
    const { cards: _words, winningPath: _route, ...published } = final;
    records.push({ ...published, winningPath: compact(route.path), recoveryPaths: [compact(recovery.branchPath)] });
    witnesses.push({ level, seed, columns, foundations, cards: size, stock, budget: publishedBudget, ...primary,
      alternate: { step: recovery.step, tested: recovery.tested, ...alternate } });
    break;
  }
  if (records.length !== witnesses.length || witnesses.at(-1)?.level !== level) throw Error('No verified candidate for ' + level);
}
await writeFile('src/content/campaign-v8-beyond-bank.json', JSON.stringify(records, null, 2) + '\n');
await mkdir('docs/qa/content-v8', { recursive: true });
await writeFile('docs/qa/content-v8/beyond80-witnesses.json', JSON.stringify(witnesses, null, 2) + '\n');
console.log(JSON.stringify(witnesses));
