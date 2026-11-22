import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { C8_DIFFICULTY } from '../../src/domain/difficulty';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { authoringHash, hitappsInputHash } from './hitapps-authoring';
import { certifyEqualityBankEntry } from './hitapps-equality-bank';
import { authorHitappsCandidate } from './hitapps-pipeline';

const historyPenalty = Number(process.env.HITAPPS_HISTORY_PENALTY ?? 0);
assert([C8_DIFFICULTY.hardPenalty, 0, C8_DIFFICULTY.easyPenalty].includes(historyPenalty));
const level = Number(process.env.HITAPPS_LEVEL ?? 16);
const base = content8Wave.find(deal => deal.campaignLevel === level);
assert(base, 'Expected a C8 wave source template');
const firstSeed = Number(process.env.HITAPPS_FIRST_SEED ?? 0);
assert(Number.isSafeInteger(firstSeed) && firstSeed >= 0 && firstSeed <= 2147483548);
const seeds = Array.from({ length: 100 }, (_, index) => firstSeed + index);
const featureConfig = { revision: 'ordinary-product-v1', enabled: [], pairTransform: 'UNKNOWN' } as const;
const input = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'random',
  cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0 } as const;
const paywallSeed = 1; // local-only stable cohort fixture
const run = authorHitappsCandidate(base, {
  structure: { ...input, levelInputHash: hitappsInputHash(base, input) },
  features: featureConfig, difficulty: { historyPenalty, previousLosses: 0, special: false },
  easy: { enabled: false, minLevel: 16, byDifficulty: {} },
  seeds, drawSeed() { throw Error('Expected explicit candidate seed'); },
  strategy: {
    kind: 'Equality', minimumSpareMoves: 6, eligibility: {
      request: { level, seed: paywallSeed, segment: 'NonPayer', issued: 0 },
      config: { version: 'controlled-attested-v2', enabled: true, minLevel: 16, limit: 1, segments: ['NonPayer'] },
      cohortEvidence: 'controlled-fixture',
    },
  },
});

const bank = [];
if (run.deal && 'selected' in run.selection) {
  const proof = certifyEqualityBankEntry(base, run.deal, { sourceSeed: run.selection.selected.candidateSeed, paywallSeed, featureConfig, historyPenalty });
  assert(proof, 'Equality authoring selection did not pass the independent bank verifier');
  bank.push({ manifest: proof.manifest, sha256: authoringHash(proof.manifest), initial: proof.deal.initial, route: proof.deal.winningPath });
}
await mkdir('.authoring/hitapps', { recursive: true });
await writeFile(`.authoring/hitapps/equality-${level}-${firstSeed}-p${historyPenalty}.json`, JSON.stringify(bank) + '\n');
await writeFile(`.authoring/hitapps/equality-${level}-${firstSeed}-p${historyPenalty}-evidence.json`, JSON.stringify(run) + '\n');
console.log(JSON.stringify({ level, firstSeed, historyPenalty, considered: 'trials' in run.selection ? run.selection.trials.length : 0, qualified: bank.length }));
