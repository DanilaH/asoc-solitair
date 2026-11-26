import { mkdirSync, writeFileSync } from 'node:fs';
import { campaignDeals } from '../../src/content/campaign';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import { authoringHash } from './hitapps-authoring';
import { emptyFeatures, sourceCardOrder } from './hitapps-source-authoring';
import { authorSourceCandidate } from './hitapps-source-pipeline';

const records = [], report = [];
const kind = process.env.HITAPPS_BANK_STRATEGY === 'Equality' ? 'Equality' : 'Priority';
for (const level of [16, 22, 26, 31, 35, 38, 53, 74, 80]) {
  const { training, ...base } = campaignDeals.find(deal => deal.campaignLevel === level)!;
  const result = authorSourceCandidate(base, {
    input: { version: 'hitapps-input-v2', layout: 'random', stable: true, levelPenalty: 0, cardOrder: sourceCardOrder(base), features: emptyFeatures },
    difficulty: hitappsR4Difficulty, historyPenalty: 0, previousLosses: 2,
    strategy: kind === 'Priority' ? { name: 'Priority', target: Math.floor(base.initial.movesLeft! * .86), tolerance: 10 }
      : { name: 'Equality', spare: 2, cohort: { version: 'hitapps-local-cohort-v1', authority: 'fixture',
        player: { level, seed: 47, issued: 0, segment: 'NonPayer' }, policy: { enabled: true, minLevel: 16, limit: 1, segments: ['NonPayer'] } } },
    seeds: Array.from({ length: 100 }, (_, offset) => level * 1000 + 700 + offset), drawSeed: () => 0,
    findWitness: candidate => findReferenceRoute(candidate, candidate.initial, 2500, true, Infinity, 'verified-specials').path,
  });
  const reasons: Record<string, number> = {};
  for (const trial of result.trials) if (trial.reason) reasons[trial.reason] = (reasons[trial.reason] ?? 0) + 1;
  report.push({ level, strategy: kind, status: result.status, tried: result.trials.length, reasons, ...(result.status === 'CERTIFIED' && { manifest: result.manifest }) });
  if (result.status !== 'CERTIFIED') continue;
  const { cards, ...deal } = result.deal, { manifest } = result;
  records.push({ seed: manifest.receipt.resolvedSeed, strategy: kind, use: kind === 'Equality' ? 'feature-check' : 'campaign', cost: manifest.proof.cost,
    reserve: manifest.proof.reserve, baseId: base.id, deal, changedCards: Object.fromEntries(Object.entries(cards)
      .filter(([id, card]) => JSON.stringify(base.cards[id]) !== JSON.stringify(card))), sourceHash: manifest.receipt.sourceHash,
    boardHash: manifest.finalBoardHash, traceHash: manifest.proof.traceHash, routeHash: manifest.proof.routeHash,
    basicRuntime: 'rules4-independent-oracle-v1', receiptHash: authoringHash(manifest.receipt) });
}
mkdirSync('.authoring/hitapps-r4', { recursive: true });
const part = Number(kind === 'Equality');
writeFileSync(`.authoring/hitapps-r4/strategies-${part}-of-2.json`, JSON.stringify({ records, report }));
console.log(JSON.stringify(report.map(({ manifest, ...row }) => ({ ...row, seed: manifest?.receipt.resolvedSeed }))));
