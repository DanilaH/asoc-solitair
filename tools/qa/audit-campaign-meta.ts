import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CAMPAIGN_META, DAILY_CALENDAR, EXTENDED_CHAPTER } from '../../src/config/campaign-meta';
import { campaignDeals, campaignIssuance, findDeal, layoutFingerprint, selectCampaignDeal } from '../../src/content/campaign';
import { extendedRecords } from '../../src/content/campaign-meta-bank';
import { dailyForDay } from '../../src/content/daily';
import { quoteLayoutRetry } from '../../src/app/campaign-retry';
import { beginDeal } from '../../src/domain/campaign';
import { dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { clearUndo } from '../../src/domain/history';
import { CAMPAIGN_LENGTH, campaignId, completedLevels } from '../../src/domain/progression';
import type { Deal } from '../../src/domain/types';
import { decodeSave } from '../../src/platform/storage';
import { authoringHash, replayAuthoredRoute } from '../content/hitapps-authoring';
import { certifySourceRoute } from '../content/hitapps-source-pipeline';

assert(CAMPAIGN_META);
assert.equal(campaignDeals.length, CAMPAIGN_LENGTH);
const start = performance.now();
const dailyStart = Date.parse(DAILY_CALENDAR.first + 'T00:00:00Z'), dayMs = 86_400_000;
const turnDate = (index: number) => new Date(dailyStart + index * dayMs).toISOString().slice(0, 10);
function summarize(deal: Deal) {
  let firstCollect = 0, branches = 0, step = 0;
  const result = replayAuthoredRoute(deal, deal.winningPath, board => {
    step++;
    if (!firstCollect && board.collected.length) firstCollect = step;
    if (board.phase === 'playing' && legalCommands(board, deal).length > 1) branches++;
  });
  assert.equal(result.phase, 'won');
  assert(firstCollect > 0);
  const state = deal.initial.hitapps;
  const features = state ? Object.values(state.cards) : [];
  return { id: deal.id, cards: Object.keys(deal.cards).length, topics: Object.values(deal.cards).filter(card => card.leader).map(card => card.category),
    images: Object.values(deal.cards).filter(card => card.image).length, budget: deal.initial.movesLeft,
    cost: step, reserve: result.movesLeft, firstCollect, branchingPositions: branches,
    specials: { ordered: features.some(card => card.order > 0), ice: features.some(card => card.ice > 0),
      lock: features.some(card => card.lock), bound: features.some(card => card.bound),
      puzzle: Boolean(deal.hitapps?.assemblies.length), magnet: features.some(card => card.kind === 5),
      hammer: features.some(card => card.kind === 6), gold: Boolean(deal.hitapps?.gold) } };
}

const extension = [];
let rotationCount = 0, certifiedBudgets = 0;
for (const base of campaignDeals.slice(EXTENDED_CHAPTER.first - 1)) {
  const level = base.campaignLevel!, records = extendedRecords(level);
  assert.equal(records.length, 3);
  const rows = records.map(record => {
    const id = record.deal.id + '-core-stage1-v1-m1', issued = findDeal(id)!;
    assert(issued && issued.initial.rulesVersion === 4 && issued.extraHelpers?.randomJokerCoins === 300);
    const hash = authoringHash([issued.initial, issued.cards, issued.hitapps]);
    assert.equal(hash, record.boardHash, id);
    const proof = certifySourceRoute(issued, issued.winningPath)!;
    assert.deepEqual([proof.cost, proof.routeHash, proof.traceHash], [record.cost, record.routeHash, record.traceHash], id);
    for (const penalty of [-5, 10]) {
      const budget = findDeal(record.deal.id + `-budget-${penalty < 0 ? 'm' : 'p'}${Math.abs(penalty)}-core-stage1-v1-m1`)!;
      const replay = certifySourceRoute(budget, budget.winningPath);
      assert(replay?.reserve !== undefined && replay.reserve >= 0);
      assert.equal(authoringHash([budget.initial, budget.cards, budget.hitapps]), record.budgets![penalty].hash);
      certifiedBudgets++;
    }
    return summarize(issued);
  });
  for (const penalty of [-5, 0, 10]) {
    const save = freshSave(base, 'm3-rotation');
    save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
      completedCampaign: campaignDeals.slice(0, level - 1).map(deal => campaignId(deal.campaignLevel!)) };
    save.difficultyPenalty = penalty;
    const seen = new Set<string>();
    let selected = selectCampaignDeal(save, base);
    for (let turn = 0; turn < 3; turn++) {
      const previous = save.attempt;
      save.attempt = freshSave(selected, 'm3-turn-' + turn).attempt;
      save.attempt.issuance = campaignIssuance(save, base, selected, previous);
      assert.equal(decodeSave(JSON.stringify(save), findDeal).attempt.dealId, selected.id);
      seen.add(layoutFingerprint(selected));
      assert.equal(selected.initial.movesLeft, penalty ? records[0].budgets![penalty].moves : records[0].deal.initial.movesLeft);
      if (turn < 2) {
        save.attempt.board = { ...save.attempt.board, phase: 'exhausted', movesLeft: 0 };
        save.attempt.director = { previousLosses: 4, restarts: 4 };
        selected = quoteLayoutRetry(save)!.selected;
      }
    }
    assert.equal(seen.size, 3, `L${level} P${penalty}`);
    rotationCount++;
  }
  extension.push({ level, difficulty: base.difficultyTier, rows });
}

const daily = [], layoutIds = new Set<string>();
for (let index = 0; index < DAILY_CALENDAR.count; index++) {
  const day = turnDate(index), deal = dailyForDay(day);
  assert.equal(deal.initial.rulesVersion, 4);
  assert.equal(deal.daily?.contentVersion, 2);
  const layout = authoringHash([deal.initial.tableau, deal.initial.stock].map(group =>
    (group as (string | string[])[]).map(id => Array.isArray(id) ? id.map(card => deal.cards[card].text) : deal.cards[id].text)));
  assert(!layoutIds.has(layout), day);
  layoutIds.add(layout);
  daily.push({ day, geometry: layout, ...summarize(deal) });
}

let save = freshSave(campaignDeals[0], 'economy');
let steps = 0;
for (const base of campaignDeals) {
  const level = base.campaignLevel!;
  const previous = level === 1 ? undefined : save.attempt;
  const deal = selectCampaignDeal(save, base, previous);
  beginDeal(save, deal, 'audit-' + level);
  save.attempt.issuance = campaignIssuance(save, base, deal, previous);
  for (const command of deal.winningPath) {
    const result = dispatch(save, command, deal);
    assert(result.accepted, `L${level}: ${result.reason}`);
    save = result.next;
    clearUndo(save.attempt);
    steps++;
  }
  assert.equal(save.attempt.board.phase, 'won');
  assert.equal(completedLevels(save), level);
  save = decodeSave(JSON.stringify(save), findDeal);
}
assert.equal(save.platform?.receipts.length, 0);
assert.equal(save.commerce, undefined);

function minimumRecurrence(sequences: string[][]) {
  const last = new Map<string, number>(); let minimum = Infinity;
  sequences.forEach((topics, index) => {
    for (const topic of topics) {
      const prior = last.get(topic);
      if (prior !== undefined) minimum = Math.min(minimum, index - prior);
      last.set(topic, index);
    }
  });
  return { distinctTopics: last.size, minimumGap: minimum };
}
const report = { wins: CAMPAIGN_LENGTH, steps, campaign: { first: EXTENDED_CHAPTER.first, layouts: extension.length * 3,
  certifiedBudgets, rotationCount, ...minimumRecurrence(extension.map(row => row.rows[0].topics)) },
  daily: { count: layoutIds.size, first: DAILY_CALENDAR.first, last: daily.at(-1)!.day, ...minimumRecurrence(daily.map(row => row.topics)) },
  finalSaveBytes: Buffer.byteLength(JSON.stringify(save)), verifiedMs: Math.round(performance.now() - start),
  extension, calendar: daily };
mkdirSync('.recording/stage3', { recursive: true });
writeFileSync('.recording/stage3/generation.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, extension: undefined, calendar: undefined }, null, 2));
