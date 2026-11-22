import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { equalityPreviewDeal } from '../../src/content/campaign-v8-equality';
import { authoringHash, hitappsInputHash, prepareHitappsInput } from '../content/hitapps-authoring';
import { hitappsBotPolicies } from '../content/hitapps-bots';
import { isLateLoss, simulatePolicy } from '../content/difficulty-selection';
import { findReferenceRoute } from '../../src/domain/ordinary-search';

const controls = [content8Wave[0], equalityPreviewDeal, ...content8Wave.slice(1, 6)];
const base = content8Wave[Number(process.env.HITAPPS_PROBE_LEVEL ?? 16) - 16];
const input = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'random',
  cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0 } as const;
const prepared = prepareHitappsInput(base, { ...input, levelInputHash: hitappsInputHash(base, input) }, Number(process.env.HITAPPS_PROBE_PENALTY ?? 0));
const results = (deal: typeof base) => hitappsBotPolicies.map(policy => simulatePolicy(deal, policy));
const summary = (runs: ReturnType<typeof results>) => runs.map(run =>
  [run.policyId, run.status, run.steps, run.lossReason, run.path.filter(action => action.type === 'transfer').length]);
if (!process.env.HITAPPS_PROBE_LEVEL) for (const deal of controls) console.log(deal.id, summary(results(deal)));
for (let seed = Number(process.env.HITAPPS_PROBE_START ?? 0); seed <= Number(process.env.HITAPPS_PROBE_MAX ?? 99); seed++) {
  if (process.env.HITAPPS_PROBE_SEEDS && !process.env.HITAPPS_PROBE_SEEDS.split(',').includes(String(seed))) continue;
  const deal = prepared.deal(seed);
  const runs = results(deal);
  if (runs.every(run => isLateLoss(run, prepared.effectiveBudget)) && authoringHash(runs[0].path) !== authoringHash(runs[1].path)) {
    const route = findReferenceRoute(deal, deal.initial, Number(process.env.HITAPPS_PROBE_SOLVER_CAP ?? 6400));
    console.log(seed, route.status, route.path?.length, summary(runs));
  }
}
