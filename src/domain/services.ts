import { campaignRewards } from './meta';
import { isOfferPlacement, settleRewardOffer, type OfferPlacement } from './reward-offers';
import { BALANCE } from './balance';
import { campaignId } from './progression';
import { CONTENT8_PREVIEW, type Deal, type PlatformState, type Save } from './types';
import { recordCampaignOutcome } from './difficulty';
import { bonusKindFor, bonusPlacements, openBonusSlot, type BonusPlacement } from './bonus-slots';
import { requiresContinueProof, verifiesContinue, type ContinueProof } from './continuation';

export type RewardPlacement = 'hint' | 'undo' | 'continue' | BonusPlacement | OfferPlacement;
export interface EarnedReceipt { schema: 1; id: string; attempt: string; dealId: string; mode: 'campaign' | 'daily'; placement: RewardPlacement }
export interface FullscreenShown extends EarnedReceipt {
  kind: 'rewarded' | 'interstitial';
  shownAt: number;
}
export function platformState(save: Save): PlatformState {
  return save.platform ??= { receipts: [], continuedAttempts: [], continueCredits: 0, completedCampaign: [], winsSinceInterstitial: 0, lastFullscreenAt: 0 };
}
export function parseReceipt(value: unknown): EarnedReceipt {
  if (!value || typeof value !== 'object') throw Error('Invalid receipt');
  const r = value as Record<string, unknown>;
  if (r.schema !== 1 || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
    typeof r.attempt !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.attempt) ||
    typeof r.dealId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.dealId) ||
    (!['hint', 'undo', 'continue', ...Object.values(bonusPlacements)].includes(String(r.placement)) && !isOfferPlacement(String(r.placement))) ||
    !['campaign', 'daily'].includes(String(r.mode)) ||
    ((bonusKindFor(String(r.placement)) || isOfferPlacement(String(r.placement))) && r.mode !== 'campaign')) throw Error('Invalid receipt');
  return { schema: 1, id: r.id, attempt: r.attempt, dealId: r.dealId, placement: r.placement as RewardPlacement, mode: r.mode as EarnedReceipt['mode'] };
}
export function parseFullscreenShown(value: unknown): FullscreenShown {
  const receipt = parseReceipt(value);
  const { kind, shownAt } = value as Partial<FullscreenShown>;
  if (typeof shownAt !== 'number' || !Number.isSafeInteger(shownAt) || shownAt <= 0 ||
    (kind !== 'rewarded' && (kind !== 'interstitial' || receipt.mode !== 'campaign' || receipt.placement !== 'continue'))) {
    throw Error('Invalid fullscreen display');
  }
  return { ...receipt, kind, shownAt };
}

/** The native journal owns one verified show until this independent effect is durable. */
export function applyFullscreenShown(save: Save, shown: FullscreenShown): 'applied' | 'already-applied' {
  const attempt = save.attempt;
  if (shown.attempt !== attempt.id || shown.dealId !== attempt.dealId || shown.mode !== (attempt.daily ? 'daily' : 'campaign')) {
    return 'already-applied';
  }
  const state = platformState(save);
  if (state.fullscreenCadence &&
    (shown.id === state.fullscreenCadence.lastShownId || shown.shownAt <= state.lastFullscreenAt)) {
    return 'already-applied';
  }
  // Before the first verified show, the historical attempt time remains a conservative floor.
  state.lastFullscreenAt = shown.shownAt;
  state.fullscreenCadence = { version: 1, lastShownId: shown.id };
  if (shown.kind === 'interstitial') state.winsSinceInterstitial = 0;
  return 'applied';
}
/** All effects and identities enter the same coordinated snapshot; Undo never owns these fields. */
export function applyReceipt(save: Save, receipt: EarnedReceipt, options?: {
  deal?: Deal; onBonusUnlocked?: () => void; continueProof?: ContinueProof; offerNow?: number;
}): 'applied' | 'already-applied' {
  const state = platformState(save);
  if (state.receipts.includes(receipt.id)) return 'already-applied';
  if (receipt.placement === 'continue') {
    if (!state.continuedAttempts.includes(receipt.attempt)) {
      state.continuedAttempts.push(receipt.attempt); state.continueCredits++;
      // A late receipt must not mutate a different attempt. Its earned credit remains available.
      if (save.attempt.id === receipt.attempt && save.attempt.dealId === receipt.dealId &&
        receipt.mode === (save.attempt.daily ? 'daily' : 'campaign')) useContinue(save, options?.continueProof);
    }
  } else if (receipt.placement === 'hint' || receipt.placement === 'undo') {
    save.profile[receipt.placement === 'hint' ? 'hints' : 'undos'] += BALANCE.rewardedCharges[receipt.placement];
  } else if (isOfferPlacement(receipt.placement)) {
    if (options?.offerNow !== undefined) settleRewardOffer(save, { ...receipt, placement: receipt.placement }, options.offerNow);
  } else {
    const kind = bonusKindFor(receipt.placement);
    const attempt = save.attempt.daily ? save.parked?.campaign : save.attempt;
    const deal = options?.deal;
    // Only that campaign attempt may get the purchased space, including when parked.
    if (kind && receipt.mode === 'campaign' && deal?.id === receipt.dealId && attempt?.id === receipt.attempt &&
      openBonusSlot(attempt, deal, kind)) options?.onBonusUnlocked?.();
  }
  state.receipts.push(receipt.id); save.revision++;
  return 'applied';
}
export function useContinue(save: Save, proof?: ContinueProof): boolean {
  const state = save.platform, attempt = save.attempt;
  if (!state?.continueCredits || !canResume(save, proof)) return false;
  state.continueCredits--;
  if (!state.continuedAttempts.includes(attempt.id)) state.continuedAttempts.push(attempt.id);
  resumeAttempt(save, proof?.deal?.recovery ? 'earned' : undefined);
  return true;
}

export function buyContinue(save: Save, proof: ContinueProof): boolean {
  if (!requiresContinueProof(save.attempt) || save.profile.coins < BALANCE.continueCoinPrice ||
    save.platform?.continueCredits || !canResume(save, proof)) return false;
  save.profile.coins -= BALANCE.continueCoinPrice;
  // A receipt already earned from an earlier video remains payable as a credit.
  resumeAttempt(save, proof.deal.recovery ? 'coins' : undefined);
  return true;
}

function canResume(save: Save, proof?: ContinueProof): boolean {
  const attempt = save.attempt;
  return !attempt.continued && attempt.board.phase === 'exhausted' && attempt.board.movesLeft === 0 &&
    (!requiresContinueProof(attempt) || Boolean(proof && verifiesContinue(attempt, proof)));
}

function resumeAttempt(save: Save, channel?: 'coins' | 'earned') {
  const attempt = save.attempt;
  attempt.continued = true;
  if (channel) attempt.revive = { version: 1, channel, moves: BALANCE.continueMoves, price: channel === 'coins' ? BALANCE.continueCoinPrice : 0 };
  attempt.board.movesLeft = BALANCE.continueMoves;
  attempt.board.phase = 'playing';
  if (attempt.telemetry) attempt.telemetry.finished = false;
  // Undo can restore the cards, while the acquired move budget is kept.
  for (const board of attempt.undo) if (board.movesLeft !== null) board.movesLeft += BALANCE.continueMoves;
  save.revision++;
}
export function purchaseHelper(save: Save, helper: 'hint' | 'undo' | 'joker'): boolean {
  const cost = BALANCE.helperPrices[helper];
  if (save.profile.coins < cost) return false;
  save.profile.coins -= cost; save.profile[helper === 'hint' ? 'hints' : helper === 'undo' ? 'undos' : 'jokers']++; save.revision++; return true;
}
export function interstitialEligible(save: Save, level: number, mode: 'campaign' | 'daily', now: number, launchedAt: number): boolean {
  const state = platformState(save);
  return mode === 'campaign' && level > BALANCE.ads.interstitialAfterLevel &&
    state.winsSinceInterstitial >= BALANCE.ads.winsPerInterstitial &&
    now >= state.lastFullscreenAt && now - Math.max(state.lastFullscreenAt, launchedAt) >= BALANCE.ads.fullscreenGapMs;
}
export function markCampaignWin(save: Save, dealId: string, level?: number): import('./types').RewardGrant[] {
  // Control deal/replays are not new campaign progress.
  const state = platformState(save);
  if (level === undefined) return [];
  // Content revisions own different deal IDs; first-clear rewards belong to a level.
  const progressId = campaignId(level);
  if (state.completedCampaign.includes(progressId)) return [];
  state.completedCampaign.push(progressId);
  if (CONTENT8_PREVIEW && save.attempt.dealId === dealId) recordCampaignOutcome(save);
  if (level > BALANCE.ads.interstitialAfterLevel) state.winsSinceInterstitial++;
  return campaignRewards(save);
}
