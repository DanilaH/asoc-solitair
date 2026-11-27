import { findDeal } from '../../src/content/campaign';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand, Deal, Save } from '../../src/domain/types';

export const hammerCases = [
  ['campaign-ha4-32-3200281-119e4789c83acbdc-f5719d5f', 10],
  ['campaign-ha4-32-3200282-9851c376910590f8-0f57d818', 16],
] as const;
export const puzzleCases = [
  ['campaign-ha4-17-1700289-8a461fc84372bd59-33ebeceb', 9, 2],
  ['campaign-ha4-17-1700295-e3489d3fcab45531-33ebeceb', 58, 0],
] as const;
export const heavyDeal = 'campaign-ha4-80-80004-cc69ef28590359b4-0c0b90d5-budget-p10';
export const toSocket = (column: number): BoardCommand => ({
  type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'tableau', index: column },
});

export function profileAt(deal: Deal, id = 'functional-audit-225') {
  const save = freshSave(deal, id);
  save.settings.reducedMotion = true;
  save.campaign = { version: 1, tutorials: ['intro:ordered', 'intro:keys', 'intro:joker'] };
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, winsSinceInterstitial: 0, lastFullscreenAt: 0,
    completedCampaign: Array.from({ length: (deal.campaignLevel ?? 1) - 1 }, (_, i) => campaignId(i + 1)) };
  return save;
}

export function play(save: Save, deal: Deal, route: readonly BoardCommand[]) {
  for (const action of route) {
    const result = dispatch(save, action, deal);
    if (!result.accepted) throw Error(result.reason);
    save = result.next;
  }
  return save;
}

export function atSocket(id: string, prefix: number, column: number) {
  const deal = findDeal(id)!;
  const save = play(profileAt(deal), deal, deal.winningPath.slice(0, prefix));
  save.profile.jokers = 1;
  const result = dispatch(save, { type: 'place-joker', column }, deal);
  if (!result.accepted || !result.next.attempt.board.joker) throw Error(result.reason ?? 'Missing Joker');
  return { deal, save: result.next, action: toSocket(column) };
}
