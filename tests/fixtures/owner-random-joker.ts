import { randomJokerDeal as deal } from '../../src/content/campaign';
import { dispatch, freshSave } from '../../src/domain/engine';
import { campaignId } from '../../src/domain/progression';
import type { BoardCommand } from '../../src/domain/types';

export function randomJokerFixture() {
  const save = freshSave(deal, 'random-joker-certificate');
  save.contentVersion = 8;
  save.settings.reducedMotion = true;
  save.platform = { receipts: [], continuedAttempts: [], continueCredits: 0, lastFullscreenAt: 0, winsSinceInterstitial: 0,
    completedCampaign: Array.from({ length: 15 }, (_, i) => campaignId(i + 1)) };
  const cards = Object.values(deal.cards);
  const [first, second] = cards.filter(card => card.leader);
  const group = (category: string) => cards.filter(card => card.category === category)
    .sort((a, b) => Number(Boolean(a.leader)) - Number(Boolean(b.leader))).map(card => card.id);
  const tableau = deal.initial.tableau.map((_, i) => i === 0 ? group(first.category) : i === 2 ? group(second.category) : []);
  save.attempt.board = { ...deal.initial, tableau, stock: [], waste: [], movesLeft: 8,
    collected: cards.filter(card => card.category !== first.category && card.category !== second.category).map(card => card.id),
    faceUp: cards.map(card => card.id) };
  const transfer = (from: number, to: number, kind: 'tableau' | 'foundation' = 'tableau'): BoardCommand =>
    ({ type: 'transfer', from: { kind: 'tableau', index: from }, to: { kind, index: to } });
  const moved = dispatch(save, transfer(2, 1), deal);
  if (!moved.accepted) throw Error(moved.reason);
  const path = [transfer(1, 0), transfer(0, 0, 'foundation'), transfer(0, 0, 'foundation')];
  return { save: moved.next, column: 0, path, deal };
}
