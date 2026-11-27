import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { campaignCoreDeals, campaignDeals, campaignIssuance, findDeal, layoutFingerprint, selectCampaignDeal } from '../../src/content/campaign';
import { CAMPAIGN_CORE_STAGE1 } from '../../src/config/hitapps-r4';
import { beginDeal } from '../../src/domain/campaign';
import { applyBoard, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { findReferenceRoute } from '../../src/domain/ordinary-search';
import type { BoardCommand, Deal } from '../../src/domain/types';
import { certifySourceRoute } from '../content/hitapps-source-pipeline';
import { simulatePolicy } from '../content/difficulty-selection';
import { hitappsBotPolicies } from '../content/hitapps-bots';

function row(deal: Deal) {
  let board = deal.initial, firstCollect = 0, at20 = 0, at40 = 0, alternatives = 0, skips: number | undefined;
  for (const [index, action] of deal.winningPath.entries()) {
    const choices = legalCommands(board, deal);
    if (new Set(choices.filter(choice => choice.type === 'transfer').map(choice =>
      JSON.stringify([choice.from, choice.to]))).size > 1) alternatives++;
    if (CAMPAIGN_CORE_STAGE1 && deal.campaignLevel === 6 && skips === undefined && action.type === 'transfer' &&
        action.from.kind === 'waste' && board.stock.length) {
      const skipped: BoardCommand = { type: 'draw' };
      const alternate = applyBoard(board, skipped, deal);
      assert(typeof alternate !== 'string');
      const path = findReferenceRoute(deal, alternate.board, 1600).path;
      if (path) {
        const proof = certifySourceRoute(deal, [...deal.winningPath.slice(0, index), skipped, ...path], 1);
        skips = proof?.reserve;
      }
    }
    const advanced = applyBoard(board, action, deal);
    assert(typeof advanced !== 'string', deal.id + ': ' + advanced);
    board = advanced.board;
    if (!firstCollect && advanced.events.some(event => event.type === 'complete')) firstCollect = index + 1;
    if (index < 20) at20 = board.collected.filter(id => deal.cards[id]?.leader).length;
    if (index < 40) at40 = board.collected.filter(id => deal.cards[id]?.leader).length;
  }
  assert.equal(board.phase, 'won', deal.id);
  return { id: deal.id, level: deal.campaignLevel, rules: deal.initial.rulesVersion, cards: Object.keys(deal.cards).length,
    stock: deal.initial.stock.length, themes: Object.values(deal.cards).filter(card => card.leader).length,
    images: Object.values(deal.cards).filter(card => card.image).length, firstCollect, at20, at40,
    moves: deal.initial.movesLeft, path: deal.winningPath.length, left: board.movesLeft, alternatives,
    optionalSlots: deal.bonusSlots, spareAfterCoveredWaste: skips ?? null,
    ...(deal.campaignLevel === 6 && { bots: hitappsBotPolicies.map(policy => {
      const result = simulatePolicy(deal, policy);
      return { id: result.policyId, status: result.status, steps: result.steps };
    }) }) };
}

let save = freshSave(campaignDeals[0], 'core-stage1-metrics');
const first = campaignDeals.map((base, index) => {
  const previous = save.attempt;
  const deal = selectCampaignDeal(save, base, index ? previous : undefined);
  beginDeal(save, deal, 'campaign-metrics-' + index, findDeal(previous.dealId));
  save.attempt.issuance = campaignIssuance(save, base, deal, previous);
  for (const action of deal.winningPath) {
    const result = dispatch(save, action, deal);
    assert(result.accepted, deal.id + ': ' + result.reason);
    save = result.next;
  }
  return row(deal);
});
const bank = [...campaignCoreDeals()].filter(entry => !entry.penalty);
const alternatives = Array.from({ length: 80 }, (_, index) => {
  const level = index + 1, entries = bank.filter(entry => entry.deal.campaignLevel === level);
  return { level, distinct: new Set(entries.map(entry => layoutFingerprint(entry.deal))).size };
});
const openings = CAMPAIGN_CORE_STAGE1 ? bank.filter(entry => entry.deal.campaignLevel! <= 15).map(entry => row(entry.deal)) : [];
if (CAMPAIGN_CORE_STAGE1) {
  assert(alternatives.slice(1, 15).every(row => row.distinct >= 4));
  assert(alternatives.slice(15).every(row => row.distinct >= 3));
  const six = openings.filter(row => row.level === 6);
  assert(six.every(row => row.path <= 65 && row.firstCollect <= 20));
  assert(six.every(row => row.spareAfterCoveredWaste !== null), 'L6 must have a winning alternate after covering a useful waste card');
}
writeFileSync(process.argv[2], JSON.stringify({ first, openings, alternatives }, null, 2) + '\n');
console.log('Campaign evidence:', first.length, 'levels,', openings.length, 'opening layouts');
