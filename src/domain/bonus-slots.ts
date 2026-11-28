import type { Attempt, Board, BonusKind, Deal, Save } from './types';

export const bonusKinds = ['foundation', 'tableau'] as const;
export const bonusPlacements = { foundation: 'bonus-foundation', tableau: 'bonus-tableau' } as const;
export type BonusPlacement = typeof bonusPlacements[BonusKind];
export const bonusKindFor = (placement: string): BonusKind | undefined =>
  bonusKinds.find(kind => bonusPlacements[kind] === placement);

export const pilesFor = (board: Board, kind: BonusKind) => kind === 'foundation' ? board.foundations : board.tableau;

/** An immutable offer records the authored eligibility of this particular deal. */
export function bonusOffer(deal: Deal, kind: BonusKind): { index: number; coins: number } | undefined {
  const offer = deal.bonusSlots?.[kind], index = pilesFor(deal.initial, kind).length;
  if (deal.daily || deal.campaignLevel === undefined || !offer || !Number.isSafeInteger(offer.coins) ||
    offer.coins <= 0 || (index !== 3 && index !== 4)) return;
  return { index, coins: offer.coins };
}

export function openBonusSlot(attempt: Attempt, deal: Deal, kind: BonusKind): boolean {
  const offer = bonusOffer(deal, kind);
  if (!offer || attempt.dealId !== deal.id || pilesFor(attempt.board, kind).length !== offer.index) return false;
  pilesFor(attempt.board, kind).push([]);
  // The unlock has been paid for. Undo still owns card positions, never the entitlement.
  for (const board of attempt.undo) pilesFor(board, kind).push([]);
  return true;
}

export function purchaseBonusSlot(save: Save, deal: Deal, attemptId: string, kind: BonusKind): boolean {
  const offer = bonusOffer(deal, kind);
  if (!offer || save.attempt.id !== attemptId || save.attempt.board.phase !== 'playing' ||
    save.profile.coins < offer.coins || !openBonusSlot(save.attempt, deal, kind)) return false;
  save.profile.coins -= offer.coins;
  save.revision++;
  return true;
}

/** Late earned space keeps its type and waits for explicit use on an eligible board. */
export function bonusSlotCreditCount(save: Save, kind: BonusKind): number {
  return save.platform?.bonusSlotCredits?.[kind] ?? 0;
}

export function useBonusSlotCredit(save: Save, deal: Deal, attemptId: string, kind: BonusKind): boolean {
  const credits = save.platform?.bonusSlotCredits;
  if (!credits || credits[kind] <= 0 || save.attempt.id !== attemptId ||
      save.attempt.board.phase !== 'playing' || !openBonusSlot(save.attempt, deal, kind)) return false;
  credits[kind]--;
  save.revision++;
  return true;
}
