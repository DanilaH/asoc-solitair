import { mkdirSync, writeFileSync } from 'node:fs';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { content8Dealer } from '../../src/content/campaign-v8-dealer';
import type { SourceRecord } from '../../src/content/hitapps-r4-bank';
import { cardsFor, imageByCard, type TopicId } from '../../src/content/topics';
import { adjustedMoveBudget, C8_DIFFICULTY } from '../../src/domain/difficulty';
import { applyBoard } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { authoringHash } from './hitapps-authoring';
import { emptyFeatures, sourceCardOrder } from './hitapps-source-authoring';
import { runSourceBot } from './hitapps-source-bot';
import { authorSourceCandidate, certifySourceRoute } from './hitapps-source-pipeline';

// Own pacing targets for this version of the early chapter.
interface OpeningRecipe {
  topics: TopicId[];
  words: number;
  columns: number[];
  slots: number;
  moves: number;
  firstCollect: number;
}
const recipes: OpeningRecipe[] = [
  { topics: ['fruit', 'pets', 'dishes', 'clothes'], words: 3, columns: [2, 3, 3], slots: 3, moves: 40, firstCollect: 17 },
  { topics: ['birds', 'tools', 'vegetables', 'books'], words: 4, columns: [2, 3, 4], slots: 3, moves: 49, firstCollect: 18 },
  { topics: ['fish', 'clothes', 'office', 'building', 'fruit'], words: 4, columns: [3, 3, 4], slots: 3, moves: 56, firstCollect: 19 },
  { topics: ['dishes', 'tools', 'trees', 'appliances', 'sports'], words: 4, columns: [3, 4, 4], slots: 3, moves: 62, firstCollect: 22 },
  { topics: ['pets', 'fruit', 'tools', 'fish', 'clothes', 'dishes'], words: 4, columns: [3, 4, 5], slots: 3, moves: 69, firstCollect: 18 },
  { topics: ['flowers', 'water', 'vegetables', 'hats', 'bath', 'drinks'], words: 4, columns: [3, 4, 5], slots: 3, moves: 73, firstCollect: 23 },
  { topics: ['sea', 'shapes', 'birds', 'office', 'air', 'sports'], words: 5, columns: [3, 4, 5], slots: 3, moves: 80, firstCollect: 24 },
  { topics: ['shoes', 'road', 'trees', 'fish', 'drinks', 'books'], words: 5, columns: [3, 4, 5, 4], slots: 3, moves: 82, firstCollect: 24 },
  { topics: ['computer', 'weather', 'clothes', 'sea', 'building', 'fruit', 'music'], words: 5, columns: [3, 4, 5, 5], slots: 4, moves: 94, firstCollect: 26 },
  { topics: ['office', 'lights', 'reptiles', 'fish', 'shapes', 'vegetables', 'road'], words: 5, columns: [3, 4, 5, 6], slots: 4, moves: 99, firstCollect: 28 },
  { topics: ['furniture', 'pets', 'trees', 'air', 'tools', 'shoes', 'birds'], words: 5, columns: [4, 4, 5, 6], slots: 4, moves: 101, firstCollect: 29 },
  { topics: ['bath', 'computer', 'flowers', 'hats', 'sports', 'dishes', 'water', 'sweets'], words: 5, columns: [4, 4, 5, 6], slots: 4, moves: 108, firstCollect: 30 },
  { topics: ['building', 'drinks', 'books', 'vegetables', 'weather', 'clothes', 'sea', 'music'], words: 5, columns: [4, 5, 5, 6], slots: 4, moves: 114, firstCollect: 31 },
  { topics: ['shoes', 'road', 'reptiles', 'office', 'air', 'lights', 'shapes', 'fish', 'baking'], words: 5, columns: [4, 5, 6, 6], slots: 4, moves: 122, firstCollect: 34 },
];

function addIllustrations(cards: Deal['cards']): Deal['cards'] {
  const representative = new Map(Object.entries(imageByCard).map(([id, image]) => [id.split('_')[0], image]));
  const textCategories = new Set(['books', 'building', 'drinks', 'weather']);
  return Object.fromEntries(Object.entries(cards).map(([id, card]) => {
    const subject = card.leader && !textCategories.has(card.category) ? representative.get(card.category) : imageByCard[id];
    return [id, subject ? { ...card, image: `art/campaign/${subject}.svg` } : card];
  }));
}

function templateFor(base: Deal, recipe?: OpeningRecipe): Deal {
  const { training, ...template } = base;
  if (!recipe) {
    return { ...template, cards: addIllustrations(base.cards), initial: { ...base.initial, movesLeft: 60 } };
  }
  const cards = addIllustrations(cardsFor(recipe.topics.map(id => ({ id, count: recipe.words }))));
  const ids = Object.keys(cards);
  const tableau = recipe.columns.map(size => ids.splice(0, size));
  return { ...template, cards, difficultyTier: base.campaignLevel === 11 ? 'hard' : 'normal',
    initial: { ...base.initial, tableau, stock: ids, foundations: Array.from({ length: recipe.slots }, () => []),
      faceUp: tableau.flatMap(pile => pile.slice(-1)), movesLeft: recipe.moves } };
}

function firstCollect(deal: Deal, path: readonly BoardCommand[]): number {
  let board = deal.initial;
  for (const [index, command] of path.entries()) {
    const next = applyBoard(board, command, deal);
    if (typeof next === 'string') return Infinity;
    if (next.events.some(event => event.type === 'complete')) return index + 1;
    board = next.board;
  }
  return Infinity;
}

const output = process.argv[2] ?? 'src/content/hitapps-r4-bank/core-stage1';
const levels = process.argv.slice(3).map(Number);
mkdirSync(output, { recursive: true });
for (const base of content8Dealer) {
  const level = base.campaignLevel!;
  if (levels.length && !levels.includes(level)) continue;
  const recipe = recipes[level - 2];
  const template = templateFor(base, recipe);
  // Stage 1 uses an authored first lesson and the existing embedded RNG for every later DTO.
  const target = level === 1 ? 1 : 6;
  const rows: SourceRecord[] = [];
  for (let offset = 1; offset <= 800 && rows.length < target; offset++) {
    const seed = level * 100000 + 80000 + offset;
    const result = authorSourceCandidate(template, {
      input: { version: 'hitapps-input-v2', layout: level === 1 ? 'fixed' : 'random', stable: true,
        levelPenalty: 0, cardOrder: sourceCardOrder(template), features: emptyFeatures },
      difficulty: hitappsR4Difficulty, historyPenalty: 0, previousLosses: 0, strategy: { name: 'None' },
      seeds: [seed], drawSeed: () => { throw Error('Expected an explicit opening seed'); },
      findWitness(deal) {
        if (level === 1) return base.winningPath;
        const tight = adjustedMoveBudget(deal.initial.movesLeft!, C8_DIFFICULTY.hardPenalty, true);
        const initial = { ...deal.initial, movesLeft: tight };
        const bot = runSourceBot({ ...deal, initial }, 'Priority');
        const path = bot.status === 'WON' ? bot.path : findReferenceRoute(deal, initial, 350, true).path;
        if (!path || firstCollect(deal, path) > recipe.firstCollect ||
            (level === 6 && (path.length > 65 || path.some(command => command.type === 'recycle')))) return;
        return path;
      },
    });
    if (result.status !== 'CERTIFIED') continue;
    const certified = level === 1 ? { ...result.deal, initial: { ...result.deal.initial, movesLeft: null } } : result.deal;
    const { cards, ...deal } = certified;
    const { receipt } = result.manifest;
    const proof = level === 1 ? certifySourceRoute(certified, deal.winningPath)! : result.manifest.proof;
    const geometry = JSON.stringify([deal.initial.tableau, deal.initial.stock]);
    if (rows.some(row => JSON.stringify([row.deal.initial.tableau, row.deal.initial.stock]) === geometry)) continue;
    const budgets: NonNullable<SourceRecord['budgets']> = Object.fromEntries(
      (level < 11 ? [] : [C8_DIFFICULTY.hardPenalty, C8_DIFFICULTY.easyPenalty]).map(penalty => {
        const moves = adjustedMoveBudget(deal.initial.movesLeft!, penalty, true);
        const revised = { ...deal, cards, initial: { ...deal.initial, movesLeft: moves } };
        if (!certifySourceRoute(revised, deal.winningPath, 2)) throw Error(`Uncertified opening budget ${deal.id}`);
        return [String(penalty), { moves, hash: authoringHash([revised.initial, cards, deal.hitapps]) }];
      }));
    rows.push({ seed, strategy: 'None', use: 'campaign', campaignPolicy: 'core-stage1-opening-v1',
      cost: proof.cost, reserve: proof.reserve, baseId: base.id,
      deal, budgets, changedCards: Object.fromEntries(Object.entries(cards)
        .filter(([id, card]) => JSON.stringify(base.cards[id]) !== JSON.stringify(card))),
      sourceHash: receipt.sourceHash, boardHash: authoringHash([deal.initial, cards, deal.hitapps]), routeHash: proof.routeHash,
      traceHash: proof.traceHash, receiptHash: authoringHash(receipt), basicRuntime: 'rules4-independent-oracle-v1' });
    console.log(level, seed, proof.cost, firstCollect(result.deal, deal.winningPath), proof.reserve);
  }
  if (rows.length !== target) throw Error(`L${level}: generated ${rows.length} of ${target}`);
  writeFileSync(`${output}/${String(level).padStart(3, '0')}.json`, JSON.stringify(rows));
}
