import { mkdirSync, writeFileSync } from 'node:fs';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { campaignDeals, layoutFingerprint, campaignAuthoringTemplate } from '../../src/content/campaign';
import type { SourceRecord } from '../../src/content/hitapps-r4-bank';
import { adjustedMoveBudget, C8_DIFFICULTY } from '../../src/domain/difficulty';
import { freshSave } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { campaignId } from '../../src/domain/progression';
import type { Deal } from '../../src/domain/types';
import { authoringHash } from './hitapps-authoring';
import { emptyFeatures, prepareSourceInput, sourceCardOrder, type SourceFeatures } from './hitapps-source-authoring';
import { runSourceBot } from './hitapps-source-bot';
import { authorSourceCandidate, certifySourceRoute } from './hitapps-source-pipeline';

const level = Number(process.argv[2]);
const seedOffset = Number(process.argv[3] ?? 280);
const count = Number(process.argv[4] ?? 240);
const visits = Number(process.env.HITAPPS_COVERAGE_VISITS ?? 450);
const limit = Number(process.env.HITAPPS_COVERAGE_LIMIT ?? 2);
const base = campaignDeals.find(deal => deal.campaignLevel === level);
if (!base || level < 16 || level > 80 || ![seedOffset, count, visits, limit].every(Number.isSafeInteger) ||
    seedOffset < 0 || count < 1 || visits < 0 || limit < 1) throw Error('Expected one campaign level and a bounded seed range');

const save = freshSave(base, 'hitapps-coverage-authoring');
save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
  completedCampaign: Array.from({ length: level }, (_, index) => campaignId(index + 1)) };
const legacy = campaignAuthoringTemplate(save, base);
const template: Deal = { ...base, training: undefined, recovery: legacy.recovery, extraHelpers: legacy.extraHelpers,
  randomJokerPreview: legacy.randomJokerPreview, randomJokerCost: legacy.randomJokerCost, shufflePolicy: legacy.shufflePolicy,
  shuffleCost: legacy.shuffleCost, bonusSlots: legacy.bonusSlots,
  initial: { ...base.initial, recyclesLeft: legacy.recovery?.freeRecycles } };
const budget = template.initial.movesLeft!;
const tight = adjustedMoveBudget(budget, C8_DIFFICULTY.hardPenalty, true);
const input = { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0,
  cardOrder: sourceCardOrder(template), features: emptyFeatures } as const;
const ordinary = prepareSourceInput(template, input, budget);
const positions = template.initial.tableau.map((stack, column) => ({ column, position: stack.length - 1 }));
const noEntropy = () => { throw Error('Expected an explicit campaign seed'); };

function recipe(seed: number): SourceFeatures | undefined {
  const features: SourceFeatures = { ...emptyFeatures };
  const pattern = { enabled: true, index: 0, seed: seed + 1 };
  if (legacy.lock) {
    const lock = positions[legacy.lock.column];
    const keys = positions.filter(point => point.column !== lock.column).slice(0, legacy.lock.requiredKeys.length)
      .map(point => ({ ...point, position: Math.max(0, point.position - 1), amount: 1 }));
    if (keys.length !== legacy.lock.requiredKeys.length) return;
    features.lockers = { ...pattern, data: [{ lock, keys, required: keys.length, type: 1 }] };
  }
  if (legacy.frozen) features.frozen = { ...pattern, data: Object.values(legacy.frozen.layers)
    .map((layers, index) => ({ ...positions[index], layers })) };
  if (legacy.bound) {
    const draft = ordinary.prepare(pattern.seed, 'None', noEntropy).deal!;
    const pairs = positions.filter(point => {
      const pile = draft.initial.tableau[point.column];
      const upper = draft.cards[pile[point.position]], lower = draft.cards[pile[point.position - 1]];
      return upper && lower && !upper.leader && !lower.leader && !upper.rank && !lower.rank && upper.category !== lower.category;
    }).slice(0, Object.keys(legacy.bound.scissorsByCard).length);
    const scissors = positions.filter(point => !pairs.some(pair => pair.column === point.column)).slice(0, pairs.length);
    if (pairs.length !== Object.keys(legacy.bound.scissorsByCard).length || scissors.length !== pairs.length) return;
    features.bound = { ...pattern, data: { pairs, scissors } };
  }
  if (legacy.puzzle) features.puzzle = legacy.puzzle.pairs.map(({ bottom, illustration }, index) => {
    const card = template.cards[bottom];
    return { assembled: card.id, tag: index + 1, halves: [
      { ...card, id: `${card.id}-r4-upper`, rank: undefined, image: illustration ?? card.image },
      { ...card, id: `${card.id}-r4-lower`, rank: undefined, image: illustration ?? card.image },
    ] };
  });
  if (legacy.golden) {
    const { ids, coinsPerCard, rewardGroup } = legacy.golden;
    features.gold = { seed: seed + 5, first: ids.length, initial: ids.length, total: ids.length,
      coinsPerActivation: coinsPerCard, rewardGroup: rewardGroup ?? legacy.id, eventKey: 'gold-r4-weekly-v1' };
  }
  if (legacy.starter) features.starter = Object.values(legacy.starter.cards).map((effect, index) => {
    const label = effect === 'magnet' ? 'Магнит' : 'Молоток';
    return { kind: effect === 'magnet' ? 5 : 6, seed: seed + 7 + index, card: {
      id: `starter-r4-campaign-${level}-${index}`, category: 'starter', text: label, explanation: 'Стартовый помощник',
    } };
  });
  return features;
}

const rows: SourceRecord[] = [], geometry = new Set([layoutFingerprint(base), layoutFingerprint(legacy)]);
const output = '.authoring/hitapps-r4';
const reasons: Record<string, number> = {};
function write() {
  writeFileSync(`${output}/coverage-${level * 10000 + seedOffset}-of-1.json`, JSON.stringify({ records: rows, level, reasons }));
}
mkdirSync(output, { recursive: true });
for (let offset = seedOffset; offset < seedOffset + count && rows.length < limit; offset++) {
  const seed = level * 100000 + offset;
  const features = recipe(seed);
  if (!features) continue;
  const result = authorSourceCandidate(template, {
    input: { ...input, features }, difficulty: hitappsR4Difficulty, historyPenalty: 0, previousLosses: 0,
    strategy: { name: 'None' }, seeds: [seed], drawSeed: noEntropy,
    findWitness(deal) {
      const initial = { ...deal.initial, movesLeft: tight };
      const proposal = runSourceBot({ ...deal, initial }, 'Priority');
      if (proposal.status === 'WON') return proposal.path;
      return visits ? findReferenceRoute(deal, initial, visits, true, Infinity, 'verified-specials').path : undefined;
    },
  });
  if (result.status !== 'CERTIFIED' || result.manifest.receipt.failedMask) {
    const reason = result.status === 'CERTIFIED' ? 'FAILED_FEATURE' : result.status;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    continue;
  }
  const { cards, ...packed } = result.deal;
  const { receipt, proof } = result.manifest;
  const fingerprint = layoutFingerprint(result.deal);
  if (geometry.has(fingerprint)) continue;
  geometry.add(fingerprint);
  const budgets = Object.fromEntries([C8_DIFFICULTY.hardPenalty, C8_DIFFICULTY.easyPenalty].map(penalty => {
    const moves = adjustedMoveBudget(budget, penalty, true);
    const revised = { ...result.deal, initial: { ...packed.initial, movesLeft: moves } };
    if (!certifySourceRoute(revised, packed.winningPath)) throw Error(`Uncertified budget: ${packed.id}`);
    return [String(penalty), { moves, hash: authoringHash([revised.initial, cards, packed.hitapps]) }];
  }));
  rows.push({ seed, strategy: 'None', use: 'campaign', budgets, cost: proof.cost, reserve: proof.reserve, baseId: base.id,
    deal: packed, campaignPolicy: 'c8-coverage-v1', changedCards: Object.fromEntries(Object.entries(cards)
      .filter(([id, card]) => JSON.stringify(base.cards[id]) !== JSON.stringify(card))), sourceHash: receipt.sourceHash,
    boardHash: result.manifest.finalBoardHash, routeHash: proof.routeHash, traceHash: proof.traceHash,
    receiptHash: authoringHash(receipt), basicRuntime: 'rules4-independent-oracle-v1' });
  write();
  console.log(JSON.stringify({ level, seed, cost: proof.cost, budget, features: receipt.results.filter(row => row.status === 'APPLIED').map(row => row.id) }));
}
write();
console.log(JSON.stringify({ level, certified: rows.length, reasons }));
