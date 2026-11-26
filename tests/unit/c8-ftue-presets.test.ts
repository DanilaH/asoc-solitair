import { expect, it } from 'vitest';
import { campaignDeals, campaignIssuance, findDeal, integratedCampaignDeals, isCurrentCampaignDeal, selectCampaignDeal } from '../../src/content/campaign';
import { c8TeachingPresets } from '../../src/content/campaign-v8-ftue';
import { dailyForDay } from '../../src/content/daily';
import { releaseProfile } from '../../src/config/profile';
import { applyBoard, dispatch, freshSave, placeJoker } from '../../src/domain/engine';
import { openingShuffleProof } from '../../src/domain/shuffle-intro-proof';
import { commitShuffle, prepareShuffleBoard } from '../../src/domain/proof-shuffle';
import { campaignId } from '../../src/domain/progression';
import { switchMode } from '../../src/domain/sessions';
import type { Board, Command, Deal } from '../../src/domain/types';
import { decodeSave } from '../../src/platform/storage';
import { eventProvesStep, isLessonBoardCommand, lessonMarker, recordReleaseLearning, releaseLessonStep, releaseLessonSteps } from '../../src/app/c8-tutorial';
import { advance, search } from '../../tools/qa/gameplay-oracle';

function progress(deal: Deal) {
  const save = freshSave(deal, 'ftue-proof');
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0,
    winsSinceInterstitial: 0, completedCampaign: Array.from({ length: deal.campaignLevel! - 1 }, (_, i) => campaignId(i + 1)) };
  return save;
}

function independent(board: Board, command: Command, deal: Deal): Board | null {
  if (isLessonBoardCommand(command)) return advance(board, command, deal);
  if (command.type === 'place-joker' && board.tableau[command.column]?.length && !board.joker)
    return { ...structuredClone(board), joker: { column: command.column, boundary: board.tableau[command.column].length } };
  return null;
}

const retained = [
  'campaign-c8-dealer-001', 'campaign-c8-dealer-002', 'campaign-c8-special-018',
  'campaign-c8-special-026-core-special-r1', 'campaign-c8-wave-027-core-special-r1',
].map(id => findDeal(id)!);

const retainedBudgets = retained.filter(deal => [26, 27].includes(deal.campaignLevel!)).flatMap(deal =>
  ['tight', 'relief'].flatMap(direction => findDeal(deal.id + '-' + direction + '-r2') ?? []));
for (const deal of [...c8TeachingPresets.map(item => item.deal), ...retained, ...retainedBudgets]) {
  it(`${deal.id} validates taught actions, accepted events and independent replay`, () => {
    let save = progress(deal);
    const taught = releaseLessonSteps(deal);
    expect(taught.length).toBeGreaterThan(0);
    const suffix = deal.campaignLevel === 26
      ? [deal.winningPath[0], deal.winningPath[3], ...deal.winningPath.slice(1, 3), ...deal.winningPath.slice(4)]
      : deal.tutorialPath ?? deal.winningPath;
    for (const [index, command] of suffix.entries()) {
      const before = save.attempt.board, step = taught[index];
      if (step) {
        expect(step.before).toEqual(before);
        expect(step.command).toEqual(command);
        expect(releaseLessonStep(save, deal)?.command).toEqual(command);
        if (step.marker) expect(save.campaign?.tutorials ?? []).not.toContain(lessonMarker(step.marker));
      }
      const result = dispatch(save, command, deal);
      expect(result.accepted, `${index + 1}: ${result.reason}`).toBe(true);
      expect(result.next.attempt.board).toEqual(independent(before, command, deal));
      save = result.next;
      recordReleaseLearning(save, before, command, deal, result.events);
      if (step) expect(eventProvesStep(step, save.attempt.board, deal, result.events)).toBe(true);
      if (step?.marker) expect(save.campaign?.tutorials).toContain(lessonMarker(step.marker));
      if (step && releaseProfile) {
        const reloaded = decodeSave(JSON.stringify(save), findDeal);
        expect(reloaded.attempt).toEqual(save.attempt);
        expect(releaseLessonStep(reloaded, deal)?.command).toEqual(releaseLessonStep(save, deal)?.command);
      }
    }
    expect(save.attempt.board.phase).toBe('won');
    if (deal.golden) expect(save.attempt.payout?.filter(grant => grant.reason === 'golden_cards')).toHaveLength(1);

    let withoutHelper = deal.initial;
    for (const command of deal.winningPath) {
      const next = advance(withoutHelper, command, deal);
      const result = applyBoard(withoutHelper, command, deal);
      expect(result).not.toEqual(expect.any(String));
      expect(next).toEqual(typeof result === 'string' ? null : result.board);
      withoutHelper = next!;
    }
    expect(withoutHelper.phase).toBe('won');
  });
}

for (const { base, deal } of c8TeachingPresets) {
  it.skipIf(!releaseProfile)(`selects ${deal.id} for a first clear and keeps the original restorable`, () => {
    let save = progress(base);
    expect(selectCampaignDeal(save, campaignDeals[deal.campaignLevel! - 1])).toBe(deal);
    expect(isCurrentCampaignDeal(deal.id, base)).toBe(true);
    expect(findDeal(base.id)).toBe(base);
    expect(campaignIssuance(save, base, deal)).toMatchObject({ baseId: base.id, dealId: deal.id, source: 'authored' });
    expect(deal.initial.tableau).toHaveLength(base.initial.tableau.length);
    expect(deal.initial.foundations).toHaveLength(base.initial.foundations.length);
    const original = dispatch(save, base.winningPath[0], base).next.attempt;
    save.attempt = original;
    switchMode(save, 'daily', dailyForDay('2026-11-25'), 'daily');
    save = decodeSave(JSON.stringify(save), findDeal);
    switchMode(save, 'campaign', base, 'resume');
    expect(save.attempt).toEqual(original);
    expect(dispatch(save, { type: 'undo' }, base).next.attempt.board).toEqual(base.initial);
    save.platform!.completedCampaign.push(campaignId(deal.campaignLevel!));
    expect(selectCampaignDeal(save, base)).not.toBe(deal);
  });
}

it('rejects incorrect Joker targets without charge and offers a winning ordinary path from each legal placement', () => {
  const deal = findDeal('campaign-c8-ftue-008-r1')!;
  const save = progress(deal), charge = save.profile.jokers;
  const invalid = dispatch(save, { type: 'place-joker', column: 9 }, deal);
  expect(invalid.accepted).toBe(false);
  expect(invalid.next.profile.jokers).toBe(charge);
  for (const column of deal.initial.tableau.keys()) {
    const board = placeJoker(deal.initial, column, deal);
    if (typeof board === 'string') throw Error(board);
    expect(search(board, deal, 6000).status, `column ${column + 1}`).toBe('SOLVED');
  }
});

it('independently replays the deterministic initial Shuffle for every issued L30 budget', () => {
  const deals = integratedCampaignDeals.filter(deal => deal.campaignLevel === 30 && deal.shuffleCost === 'charge');
  expect(deals).toHaveLength(6);
  for (const deal of deals) {
    const proof = openingShuffleProof(deal.initial, deal)!;
    expect(proof.seed).toBe(7);
    const shuffled = prepareShuffleBoard(deal.initial, deal, proof.seed)!;
    expect(shuffled).not.toEqual(deal.initial);
    const result = proof.route.reduce((board, action) => advance(board, action, deal)!, shuffled);
    expect(result.phase).toBe('won');
    expect(openingShuffleProof({ ...deal.initial, movesLeft: 1 }, deal)).toBeUndefined();
    const save = progress(deal);
    const request = { attemptId: save.attempt.id, dealId: deal.id, revision: save.revision,
      board: save.attempt.board, deal, seed: proof.seed };
    expect(commitShuffle(save, deal, request, proof.route)).toBe(false);
    expect(save.attempt.board).toEqual(deal.initial);
  }
});
