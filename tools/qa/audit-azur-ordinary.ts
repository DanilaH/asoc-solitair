import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { generateAzurCards, traceAzurDeal } from '../content/azur-dealer';
import { advance } from './gameplay-oracle';

const topics = [
  { themeId: 1, title: 'Осень', words: ['Листопад', 'Дождь'] },
  { themeId: 2, title: 'Хвойные деревья', words: ['Сосна', 'Кедр'] },
  { themeId: 3, title: 'Керамика', words: ['Глина', 'Глазурь'] },
];
const managerCards = generateAzurCards(topics.map(t => ({ themeId: t.themeId, wordCount: t.words.length })));
const authoredDraws = [7, 7, 6, 3, 3, 3, 2, 1];
const trace = traceAzurDeal(managerCards, 3, 1, (_min, max) => authoredDraws[managerCards.length - max]);
const idOf = (card: (typeof managerCards)[number]) =>
  card.kind === 'category' ? `category-${card.themeId}` : `word-${card.themeId}-${card.memberOrdinal}`;
const cards = Object.fromEntries(managerCards.map(card => {
  const id = idOf(card);
  const theme = topics[card.themeId - 1];
  return [id, {
    id, category: String(card.themeId), leader: card.kind === 'category',
    text: card.kind === 'category' ? theme.title : theme.words[card.wordIndex], explanation: theme.title,
  }];
}));
assert.deepEqual(trace.managerOrder, managerCards);
assert.notDeepEqual(trace.shuffledOrder, managerCards);
const deal: Deal = {
  id: 'authoring-azur-ordinary-001-r1', version: 1, title: 'Слова и темы',
  cards, editorialStatus: 'authoring-preview', tags: ['azur-ordinary'],
  initial: {
    rulesVersion: 3, tableau: trace.tableau.map(column => column.map(idOf)), faceUp: trace.faceUp.map(idOf),
    foundations: [[], [], []], stock: trace.deckInput.map(idOf).reverse(), waste: [], collected: [], movesLeft: 50, phase: 'playing',
  },
  winningPath: decodeRoute('t0>f0 t1>f0 t1>f0 t2>f1 t2>f1 t2>f1 d d d w0>f2 w0>f2 w0>f2'),
};
assertBoard(deal.initial, deal);
function replay(board: Board, move: BoardCommand): Board {
  const next = applyBoard(board, move, deal);
  if (typeof next === 'string') throw Error(next);
  assert.deepEqual(next.board, advance(board, move, deal));
  return next.board;
}

assert.equal(deal.winningPath.reduce(replay, deal.initial).phase, 'won');

let cycling = deal.initial;
for (let pass = 0; pass < 2; pass++) {
  for (const expected of deal.initial.stock) {
    cycling = replay(cycling, { type: 'draw' });
    assert.equal(cycling.waste.at(-1), expected);
    assert.equal(cycling.phase, 'playing');
  }
  cycling = replay(cycling, { type: 'recycle' });
  assert.deepEqual(cycling.stock, deal.initial.stock);
  assert.equal(cycling.waste.length, 0);
}

const snapshot = JSON.stringify(deal, null, 2) + '\n';
const sha256 = createHash('sha256').update(snapshot).digest('hex');
const dir = '.authoring/azur-ordinary';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/${deal.id}.json`, snapshot);
await writeFile(`${dir}/${deal.id}-trace.json`, JSON.stringify({
  schema: 1, scope: 'PRODUCT_MODEL', id: deal.id, sha256, trace,
}, null, 2) + '\n');
console.log(JSON.stringify({ deal: deal.id, sha256, cards: managerCards.length, draws: trace.draws.length, winningMoves: deal.winningPath.length, stockRoundsVerified: 2 }));
