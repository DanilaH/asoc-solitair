import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { hitappsR4Deals, savedDealDefinitions } from '../../src/content/campaign';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { easyDealTarget } from '../../src/domain/difficulty';
import { applyBoard, legalCommands } from '../../src/domain/engine';
import { authoringHash } from '../content/hitapps-authoring';
import { certifySourceRoute } from '../content/hitapps-source-pipeline';
import { runSourceBot } from '../content/hitapps-source-bot';

const archive = [...savedDealDefinitions()].filter(deal => !deal.hitapps).sort((left, right) => left.id.localeCompare(right.id));
assert.equal(archive.length, 1015);
assert.equal(authoringHash(archive), 'd08544e30eea43a85b27772bb290a0930704384bd2c34e80fc63606e2402bf30');
const rows = [], coverage = { normal: [], hard: [], superhard: [] } as Record<string, { cost: number; spare: number; branch: number; ratio: number }[]>;
const seenLevels = new Set<number>(), routes = new Set<string>();
let checkedEdges = 0;
for (const { deal, record, hash, penalty } of hitappsR4Deals()) {
  const proof = certifySourceRoute(deal, deal.winningPath);
  assert(proof && proof.cost === record.cost && proof.routeHash === record.routeHash);
  assert.equal(hash, authoringHash([deal.initial, deal.cards, deal.hitapps]));
  if (penalty || record.use !== 'campaign') continue;
  assert.equal(proof.traceHash, record.traceHash);
  let board = deal.initial;
  const steps = [];
  for (const action of deal.winningPath) {
    const options = legalCommands(board, deal);
    const alternatives = new Set(options.filter(choice => choice.type === 'transfer').map(choice =>
      `${choice.scissors ?? ''}:${choice.from.kind}:${choice.from.index}:${choice.to.kind}:${choice.to.index}`));
    steps.push(alternatives.size);
    const result = applyBoard(board, action, deal);
    assert(typeof result !== 'string');
    board = result.board;
    checkedEdges++;
  }
  const level = deal.campaignLevel!, tier = deal.difficultyTier ?? 'normal', budget = deal.initial.movesLeft!;
  const target = easyDealTarget({ level, difficulty: tier, previousLosses: 2, random: true, stable: true, special: false,
    dtoMoves: budget, dtoPenalty: 0 }, hitappsR4Difficulty.easy);
  const branch = steps.filter(count => count > 1).length;
  seenLevels.add(level);
  routes.add(proof.routeHash);
  const row = { level, id: deal.id, seed: record.seed, tier, budget, cost: proof.cost, spare: proof.reserve, branch,
    ratio: proof.cost / budget, target: target ?? null, reachesEasyTarget: target !== undefined && proof.cost <= target,
    ...(process.env.HITAPPS_AUDIT_BOTS === '1' && { bots: ['Priority', 'Equality'].map(name => {
      const bot = runSourceBot(deal, name as 'Priority' | 'Equality');
      return { id: bot.policyId, status: bot.status, cost: bot.steps, reason: bot.lossReason };
    }) }) };
  rows.push(row);
  coverage[tier].push(row);
}
const quantiles = (values: number[]) => {
  if (!values.length) return null;
  const sorted = values.sort((a, b) => a - b);
  return [.1, .5, .9].map(q => sorted[Math.floor(q * (sorted.length - 1))]);
};
const summary = Object.fromEntries(Object.entries(coverage).map(([tier, values]) => [tier, { count: values.length,
  spareP10P50P90: quantiles(values.map(row => row.spare)), costRatioP10P50P90: quantiles(values.map(row => row.ratio)),
  decisionP10P50P90: quantiles(values.map(row => row.branch)) }]));
const report = { archive: archive.length, verifiedSeededRoutes: rows.length, distinctRoutes: routes.size, verifiedSeededEdges: checkedEdges,
  actualCampaignCoverage: [...seenLevels].sort((a, b) => a - b), fallbackLevels: Array.from({ length: 65 }, (_, index) => index + 16)
    .filter(level => !seenLevels.has(level)), meetsEasyTarget: rows.filter(row => row.reachesEasyTarget).length,
  originalRuntime: 'UNOBSERVED', skill: 'bot-and-solver-distributions', summary, rows };
assert(rows.length > 0, 'Candidate must contain a certified fresh seed');
mkdirSync('.authoring/hitapps-r4', { recursive: true });
writeFileSync('.authoring/hitapps-r4/balance-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
