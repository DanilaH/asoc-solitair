import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { campaignDeals, campaignIssuance, findDeal, hitappsR4Deals, layoutFingerprint, savedDealDefinitions,
  selectCampaignDeal, selectRetryLayout } from '../../src/content/campaign';
import { hitappsR4Difficulty } from '../../src/config/hitapps-r4';
import { beginDeal } from '../../src/domain/campaign';
import { adjustedMoveBudget, easyDealTarget } from '../../src/domain/difficulty';
import { applyBoard, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { Kind } from '../../src/domain/hitapps-rules';
import { campaignId, completedLevels, unlockedLevel } from '../../src/domain/progression';
import { decodeSave } from '../../src/platform/storage';
import { authoringHash } from '../content/hitapps-authoring';
import { certifySourceRoute } from '../content/hitapps-source-pipeline';
import { runSourceBot } from '../content/hitapps-source-bot';
import { advance } from './gameplay-oracle';

const archive = [...savedDealDefinitions()].filter(deal => !deal.hitapps).sort((left, right) => left.id.localeCompare(right.id));
assert.equal(archive.length, 1015);
assert.equal(authoringHash(archive), 'd08544e30eea43a85b27772bb290a0930704384bd2c34e80fc63606e2402bf30');
const campaign = campaignDeals.slice(15, 80);
assert.equal(campaign.length, 65);
const teaching = new Map<number, string>([
  [17, 'campaign-c8-ftue-017-r1'], [18, 'campaign-c8-special-018'], [19, 'campaign-c8-ftue-019-r1'],
  [24, 'campaign-c8-ftue-024-r1'], [28, 'campaign-c8-ftue-028-r1'],
  [30, 'campaign-c8-bonus-030-c8-core-r1-shuffle-r1-rights-r1'], [32, 'campaign-c8-ftue-032-r1'],
]);
assert.equal(campaignDeals.length, 80);
let session = freshSave(selectCampaignDeal(freshSave(campaignDeals[0], 'campaign-audit-template'), campaignDeals[0]), 'campaign-audit-1');
const firstTraversal = campaignDeals.map((base, index) => {
  const level = index + 1;
  assert.equal(unlockedLevel(session), level);
  const deal = index ? selectCampaignDeal(session, base, session.attempt) : findDeal(session.attempt.dealId)!;
  if (index) beginDeal(session, deal, `campaign-audit-${level}`, findDeal(session.attempt.dealId));
  if (level === 30) {
    const lesson = findDeal(teaching.get(level)!)!;
    assert.equal(layoutFingerprint(deal), layoutFingerprint(lesson));
    assert.deepEqual(deal.winningPath, lesson.winningPath);
    assert.equal(deal.shuffleCost, lesson.shuffleCost);
  } else if (teaching.has(level)) assert.equal(deal.id, teaching.get(level), `L${level} lesson changed during campaign`);
  else if (level >= 16) assert.equal(deal.initial.rulesVersion, 4, `L${level} fell back during campaign`);
  const passport = campaignIssuance(session, base, deal);
  if (passport) session.attempt.issuance = passport;
  let independent = deal.initial;
  for (const [move, command] of deal.winningPath.entries()) {
    const next = dispatch(session, command, deal);
    assert(next.accepted, `L${level} move ${move + 1}: ${next.reason}`);
    const expected = advance(independent, command, deal);
    assert(expected, `L${level} oracle refused move ${move + 1}`);
    assert.deepEqual(next.next.attempt.board, expected, `L${level} diverged on move ${move + 1}`);
    session = next.next;
    independent = expected;
  }
  assert.equal(session.attempt.board.phase, 'won', `L${level} did not finish`);
  assert.equal(completedLevels(session), level);
  const restored = decodeSave(JSON.stringify(session), findDeal);
  assert.deepEqual(restored.attempt, session.attempt, `L${level} changed when restored`);
  session = restored;
  return { level, dealId: deal.id, rules: deal.initial.rulesVersion, commands: deal.winningPath.length, movesLeft: session.attempt.board.movesLeft };
});
assert.equal(unlockedLevel(session), 80);
const issuance = campaign.map(base => {
  const level = base.campaignLevel!;
  const start = freshSave(base, `hitapps-r4-coverage-${level}`);
  start.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: level - 1 }, (_, index) => campaignId(index + 1)) };
  const first = selectCampaignDeal(start, base);
  if (teaching.has(level)) assert.equal(first.id, teaching.get(level), `L${level} lesson changed`);
  else assert.equal(first.initial.rulesVersion, 4, `L${level} initial issue fell back`);
  start.platform.completedCampaign.push(campaignId(level));
  start.campaign = { version: 1, tutorials: ['ftue:shuffle-used:r1'] };
  const adaptive = [-5, 0, 10].map(penalty => {
    start.difficultyPenalty = penalty;
    const issued = selectCampaignDeal(start, base);
    assert.equal(issued.initial.rulesVersion, 4, `L${level} issue fell back at ${penalty}`);
    const budget = adjustedMoveBudget(base.initial.movesLeft!, penalty, true);
    assert.equal(issued.initial.movesLeft, budget, `L${level} issue used the wrong budget at ${penalty}`);
    const saved = { ...start, attempt: freshSave(issued, `hitapps-r4-live-${level}-${penalty}`).attempt };
    const passport = campaignIssuance(saved, base, issued);
    assert(passport && passport.dealId === issued.id && passport.seed);
    saved.attempt.issuance = passport;
    const restored = decodeSave(JSON.stringify(saved), findDeal(issued.id)!);
    assert.deepEqual(restored.attempt.board, saved.attempt.board);
    assert.deepEqual(restored.attempt.issuance, passport);
    saved.attempt.board = { ...saved.attempt.board, phase: 'exhausted', movesLeft: 0 };
    const retry = selectRetryLayout(saved, base, issued);
    assert(retry?.initial.rulesVersion === 4 && layoutFingerprint(retry) !== layoutFingerprint(issued),
      `L${level} retry has no fresh alternative at ${penalty}`);
    assert.equal(retry.initial.movesLeft, budget, `L${level} retry changed the budget at ${penalty}`);
    return { penalty, issued: issued.id, retry: retry.id, budget };
  });
  return { level, first: first.id, adaptive };
});
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
  const special = Boolean(deal.hitapps?.assemblies.length || Object.values(deal.initial.hitapps!.cards)
    .some(card => card.bound || card.ice || card.lock || card.kind === Kind.magnet || card.kind === Kind.hammer));
  const target = easyDealTarget({ level, difficulty: tier, previousLosses: 2, random: true, stable: true, special,
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
  originalRuntime: 'UNOBSERVED', skill: 'bot-and-solver-distributions', summary, issuance, firstTraversal, rows };
assert(rows.length > 0, 'Candidate must contain a certified fresh seed');
mkdirSync('.authoring/hitapps-r4', { recursive: true });
writeFileSync('.authoring/hitapps-r4/balance-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, issuance: issuance.length, firstTraversal: firstTraversal.length, rows: undefined }, null, 2));
