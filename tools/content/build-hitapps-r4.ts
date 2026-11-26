import { mkdirSync, writeFileSync } from 'node:fs';
import { campaignDeals, savedDealDefinitions } from '../../src/content/campaign';
import { englishBeyondDeal } from '../../src/content/campaign-v8-locale';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { Deal } from '../../src/domain/types';
import { authorSourceCandidate, certifySourceRoute } from './hitapps-source-pipeline';
import { hitappsR4Difficulty as difficulty } from '../../src/config/hitapps-r4';
import { emptyFeatures, prepareSourceInput, sourceCardOrder, type SourceFeatures } from './hitapps-source-authoring';
import { authoringHash } from './hitapps-authoring';

const absoluteLevel = (deal: Deal) => deal.campaignLevel ?? 0;
const cap = Number(process.env.HITAPPS_BANK_VISITS ?? 2600);
const seedsPerLevel = Number(process.env.HITAPPS_BANK_SEEDS ?? 14);
const part = Number(process.argv[2] ?? 0), parts = Number(process.argv[3] ?? 1);
if (![cap, seedsPerLevel, part, parts].every(Number.isSafeInteger) || cap < 1 || parts < 1 || part < 0 || part >= parts || seedsPerLevel < 1)
  throw Error('Invalid bank budget or shard');

const modes = process.env.HITAPPS_BANK_MODE ?? 'campaign';
const specialMode = modes === 'specials' || modes === 'compact-bound';
const offsetSeed = Number(process.env.HITAPPS_BANK_SEED_OFFSET ?? 0);
const levelFilter = process.env.HITAPPS_BANK_LEVELS?.split(',').map(Number);
const sources = modes === 'locale' ? [englishBeyondDeal] : [...campaignDeals,
  ...[...savedDealDefinitions()].filter(deal => absoluteLevel(deal) > 80 && deal.id.includes('beyond'))];
const levels = Array.from(new Set(sources.map(absoluteLevel))).filter(level => level >= 16 && (!levelFilter || levelFilter.includes(level)))
  .sort((left, right) => left - right);
const records = [], report = [];
function featureRecipe(base: Deal, seed: number): SourceFeatures {
  const level = absoluteLevel(base), heights = base.initial.tableau.map(pile => pile.length);
  const occupied = heights.map((count, column) => ({ column, position: count - 1 })).filter(point => point.position >= 0);
  const left = occupied[0], right = occupied.find(point => point.column !== left?.column);
  const configured = { enabled: true, index: 0, seed: seed + 1 };
  if (!left || !right) return emptyFeatures;
  switch (level) {
    case 17: return { ...emptyFeatures, ordered: [Object.values(base.cards).find(card => card.leader)!.category] };
    case 18: return { ...emptyFeatures, lockers: { ...configured, data: [{ lock: left, keys: [{ ...right, amount: 2 }], required: 2, type: 1 }] } };
    case 19: return { ...emptyFeatures, frozen: { ...configured, data: [{ ...left, layers: 2 }] } };
    case 20: {
      const draft = prepareSourceInput(base, { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0,
        cardOrder: sourceCardOrder(base), features: emptyFeatures }, base.initial.movesLeft!).prepare(seed + 1, 'None', () => 0).deal!;
      const upper = occupied.find(point => {
        const pile = draft.initial.tableau[point.column], above = draft.cards[pile[point.position]], below = draft.cards[pile[point.position - 1]];
        return above && below && !above.leader && !below.leader && !above.rank && !below.rank && above.category !== below.category;
      });
      const scissors = occupied.find(point => point.column !== upper?.column);
      return upper && scissors ? { ...emptyFeatures, bound: { ...configured, data: { pairs: [upper], scissors: [scissors] } } } : emptyFeatures;
    }
    case 21: {
      const card = Object.values(base.cards).find(card => !card.leader)!;
      return { ...emptyFeatures, puzzle: [{ assembled: card.id, tag: 1, halves: [
        { ...card, id: `${card.id}-upper-r4`, rank: undefined }, { ...card, id: `${card.id}-lower-r4`, rank: undefined },
      ] }] };
    }
    case 27: return { ...emptyFeatures, gold: { seed: seed + 5, initial: 2, first: 2, total: 4, coinsPerActivation: 1, eventKey: 'gold-r4-weekly-v1' } };
    case 28: case 32: {
      const kind = level === 28 ? 5 : 6;
      return { ...emptyFeatures, starter: [{ kind, seed: seed + 7, card: { id: `starter-r4-${level}`, category: 'starter',
        text: kind === 5 ? 'Магнит' : 'Молоток', explanation: 'Стартовый помощник' } }] };
    }
    default: return emptyFeatures;
  }
}

for (const [index, level] of levels.entries()) {
  if (index % parts !== part) continue;
  const template = sources.find(deal => absoluteLevel(deal) === level)!;
  const { training, ...full } = template;
  let base = full;
  if (modes === 'compact-bound') {
    const categories = Object.values(full.cards).filter(card => card.leader).slice(0, 3);
    const cards = categories.flatMap(leader => [leader, ...Object.values(full.cards)
      .filter(card => card.category === leader.category && !card.leader).slice(0, 2)]);
    const all = cards.map(card => card.id);
    base = { ...full, cards: Object.fromEntries(cards.map(card => [card.id, card])), initial: { ...full.initial,
      tableau: [all.slice(0, 2), all.slice(2, 4), all.slice(4, 6)], foundations: [[], [], []], movesLeft: 45,
      stock: all.slice(6), faceUp: [all[1], all[3], all[5]] } };
  }
  const budget = base.initial.movesLeft;
  if (budget === null || budget <= 0) continue;
  const recorded: { seed: number; strategy: string; use: string; cost: number; reserve: number }[] = [];
  const misses: Record<string, number> = {};
  const layoutSet = new Set<string>();
  const input = { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0,
    cardOrder: sourceCardOrder(base), features: emptyFeatures } as const;
  const baseSeed = level * 1000 + offsetSeed;
  for (let offset = 0; offset < seedsPerLevel && recorded.length < 2; offset++) {
    const seed = baseSeed + offset;
    const features = specialMode ? featureRecipe(base, seed) : emptyFeatures;
    if (specialMode && features === emptyFeatures) continue;
    let result;
    try {
      result = authorSourceCandidate(base, { input: { ...input, features }, difficulty, historyPenalty: 0, previousLosses: 0,
        strategy: { name: 'None' }, seeds: [seed], drawSeed: () => { throw Error('Expected explicit bank seed'); },
        findWitness: draft => findReferenceRoute(draft, draft.initial, cap, true, Infinity, 'verified-specials').path });
    } catch (error) {
      console.log(JSON.stringify({ level, seed, counterexample: (error as Error).message }));
      misses.COUNTEREXAMPLE = (misses.COUNTEREXAMPLE ?? 0) + 1;
      continue;
    }
    if (result.status !== 'CERTIFIED') { misses[result.status] = (misses[result.status] ?? 0) + 1; continue; }
    const { deal, manifest } = result;
    if (specialMode && manifest.receipt.results.some(row => row.status.startsWith('FAILED') || row.status.startsWith('UNKNOWN'))) continue;
    const fingerprint = authoringHash([deal.initial.tableau, deal.initial.stock, deal.initial.faceUp]);
    if (layoutSet.has(fingerprint)) continue;
    layoutSet.add(fingerprint);
    const use = specialMode ? 'feature-check' : 'campaign';
    const { cards, ...packed } = deal;
    const row = { seed, strategy: manifest.strategy, use, cost: manifest.proof.cost, reserve: manifest.proof.reserve };
    recorded.push(row);
    records.push({ ...row, ...(modes === 'locale' && { language: 'en' }), baseId: base.id, deal: packed, changedCards: Object.fromEntries(Object.entries(cards)
      .filter(([id, card]) => JSON.stringify(base.cards[id]) !== JSON.stringify(card))), sourceHash: manifest.receipt.sourceHash,
    boardHash: manifest.finalBoardHash, traceHash: manifest.proof.traceHash, routeHash: manifest.proof.routeHash,
    basicRuntime: 'rules4-independent-oracle-v1', receiptHash: authoringHash(manifest.receipt) });
  }
  if (!recorded.length && !specialMode) {
    // No route in the bounded search has no bearing on the shipped board or its solvability.
    const draft = prepareSourceInput(base, { ...input, layout: 'fixed' }, budget).prepare(0, 'None', () => 0).finish();
    let proof;
    try { proof = certifySourceRoute(draft.deal, base.winningPath); } catch { /* Rules3 witnesses need not be Rules4 witnesses. */ }
    if (proof) {
      const row = { seed: 0, strategy: 'None', use: 'fixed-control', cost: proof.cost, reserve: proof.reserve };
      recorded.push(row);
      const { cards: _cards, ...packed } = draft.deal;
      records.push({ ...row, ...(modes === 'locale' && { language: 'en' }), baseId: base.id, deal: { ...packed, winningPath: base.winningPath }, changedCards: {},
        sourceHash: draft.receipt.sourceHash, boardHash: authoringHash([draft.deal.initial, draft.deal.cards, draft.deal.hitapps]),
        traceHash: proof.traceHash, routeHash: proof.routeHash, basicRuntime: 'rules4-independent-oracle-v1', receiptHash: authoringHash(draft.receipt) });
    }
  }
  report.push({ level, baselineBudget: budget, recorded, misses });
  console.log(JSON.stringify(report.at(-1)));
}
mkdirSync('.authoring/hitapps-r4', { recursive: true });
writeFileSync(`.authoring/hitapps-r4/${modes}-${part}-of-${parts}.json`, JSON.stringify({ records, report }));
