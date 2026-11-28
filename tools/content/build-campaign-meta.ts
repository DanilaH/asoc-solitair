import { featuresFor } from './hitapps-feature-recipes';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { EXTENDED_CHAPTER } from '../../src/config/campaign-meta';
import { dailyRecipes, extendedRecipes, metaTemplate, type MetaRecipe } from '../../src/content/campaign-meta-recipes';
import { unpackMetaDeal, type PackedMetaDeal } from '../../src/content/campaign-meta-pack';
import { adjustedMoveBudget } from '../../src/domain/difficulty';
import { Kind, sourceCard } from '../../src/domain/hitapps-rules';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { Deal } from '../../src/domain/types';
import { authoringHash } from './hitapps-authoring';
import { emptyFeatures, prepareSourceInput, sourceCardOrder, type SourceFeatures } from './hitapps-source-authoring';
import { runSourceBot } from './hitapps-source-bot';
import { authorSourceCandidate, certifySourceRoute } from './hitapps-source-pipeline';

const [mode, beginText, endText] = process.argv.slice(2);
assert(mode === 'campaign' || mode === 'daily');
const daily = mode === 'daily', recipes = daily ? dailyRecipes : extendedRecipes;
const begin = Number(beginText ?? 0), end = Number(endText ?? recipes.length);
assert(Number.isInteger(begin) && begin >= 0 && Number.isInteger(end) && end <= recipes.length && end > begin);
const output = `.authoring/campaign-meta/${mode}`;
mkdirSync(output, { recursive: true });
const noRandom = () => { throw Error('Expected a recorded seed'); };


for (let index = begin; index < end; index++) {
  const recipe = recipes[index], level = daily ? 1001 + index : EXTENDED_CHAPTER.first + index;
  const template = metaTemplate(recipe, daily ? `meta-daily-source-${index + 1}` : `campaign-meta-source-${level}`, level);
  const entries: PackedMetaDeal[] = [], geometries = new Set<string>();
  const target = daily ? 1 : 3, minimum = daily ? recipe.budget - 5 : adjustedMoveBudget(recipe.budget, -5, true) - 1;
  for (let offset = 1; offset <= 420 && entries.length < target; offset++) {
    const seed = level * 10000 + 3700 + offset;
    const features = featuresFor(template, recipe, seed);
    if (!features) continue;
    const result = authorSourceCandidate(template, {
      input: { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0, cardOrder: sourceCardOrder(template), features },
      difficulty: hitappsR4Difficulty, historyPenalty: 0, previousLosses: 0,
      strategy: { name: 'None' }, seeds: [seed], drawSeed: noRandom,
      findWitness(candidate) {
        const initial = { ...candidate.initial, movesLeft: minimum };
        const bot = runSourceBot({ ...candidate, initial }, 'Priority');
        return bot.status === 'WON' ? bot.path : findReferenceRoute(candidate, initial, offset < 220 ? 170 : 600, true, Infinity, 'verified-specials').path;
      },
    });
    if (result.status !== 'CERTIFIED' || result.manifest.receipt.failedMask) continue;
    const { deal, manifest: { proof, receipt } } = result;
    if (proof.cost > minimum) continue;
    if (recipe.feature === 'puzzle' && !deal.hitapps?.assemblies.length ||
        recipe.feature === 'gold' && !deal.initial.hitapps?.generatedGold) continue;
    const geometry = JSON.stringify([deal.initial.tableau, deal.initial.stock]);
    if (geometries.has(geometry)) continue;
    const budgets = Object.fromEntries((daily ? [] : [-5, 10]).map(penalty => {
      const moves = adjustedMoveBudget(deal.initial.movesLeft!, penalty, true);
      const adjusted = { ...deal, initial: { ...deal.initial, movesLeft: moves } };
      assert(certifySourceRoute(adjusted, deal.winningPath));
      return [String(penalty), { moves, hash: authoringHash([adjusted.initial, deal.cards, deal.hitapps]) }];
    }));
    const { cards, initial: full, ...record } = deal, { hitapps, ...initial } = full;
    const changed = Object.fromEntries(Object.entries(hitapps!.cards).filter(([id, value]) =>
      JSON.stringify(value) !== JSON.stringify(sourceCard(cards[id].leader ? Kind.category : Kind.word, cards[id].rank ?? 0))));
    const packed: PackedMetaDeal = { seed, strategy: 'None', use: 'campaign', cost: proof.cost, reserve: proof.reserve,
      baseId: template.id, deal: { ...record, initial, native: { changed, order: Object.keys(hitapps!.cards), generatedGold: hitapps!.generatedGold } },
      changedCards: Object.fromEntries(Object.entries(cards).filter(([id, value]) => JSON.stringify(value) !== JSON.stringify(template.cards[id]))),
      sourceHash: receipt.sourceHash, boardHash: authoringHash([full, cards, deal.hitapps]), routeHash: proof.routeHash,
      traceHash: proof.traceHash, receiptHash: authoringHash(receipt), basicRuntime: 'rules4-independent-oracle-v1', budgets };
    const unpacked = unpackMetaDeal(packed, template);
    assert.equal(authoringHash(unpacked.deal.initial), authoringHash(full));
    entries.push(packed);
    geometries.add(geometry);
  }
  if (entries.length !== target) throw Error(`${mode} ${index}: generated ${entries.length}/${target} (${recipe.feature})`);
  // Author with a search ceiling, then issue one pace budget shared by all
  // geometries. Re-certify the exact board and each adaptive move allowance.
  if (!daily) {
    const margin = recipe.difficulty === 'superhard' ? 10 : recipe.difficulty === 'hard' ? 14 : 18;
    const movesLeft = Math.max(...entries.map(entry => entry.cost)) + margin;
    for (const row of entries) {
      row.deal.initial.movesLeft = movesLeft;
      const record = unpackMetaDeal(row, template);
      const live = { ...record.deal, cards: { ...template.cards, ...record.changedCards } };
      const proof = certifySourceRoute(live, live.winningPath)!;
      assert(proof);
      row.reserve = proof.reserve;
      row.traceHash = proof.traceHash;
      row.boardHash = authoringHash([live.initial, live.cards, live.hitapps]);
      row.budgets = Object.fromEntries([-5, 10].map(penalty => {
        const moves = adjustedMoveBudget(movesLeft, penalty, true);
        const board = { ...live.initial, movesLeft: moves };
        assert(certifySourceRoute({ ...live, initial: board }, live.winningPath));
        return [String(penalty), { moves, hash: authoringHash([board, live.cards, live.hitapps]) }];
      }));
    }
  }
  writeFileSync(`${output}/${index}.json`, JSON.stringify(entries));
  console.log(mode, index, recipe.feature ?? 'plain', ...entries.map(entry => entry.cost));
}
