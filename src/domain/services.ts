import { matchesLifeShow, settleLifeVideo } from './campaign-lives';
import { isCampaignInterstitial, recordAdBreakShown, recordCoffeeDisplay, settleCoffee, type CampaignInterstitialPlacement } from './campaign-advertising';
import { campaignRewards } from './meta';
import { isOfferPlacement, offerShowContext, settleRewardOffer, type OfferPlacement } from './reward-offers';
import { BALANCE } from './balance';
import { campaignId } from './progression';
import { CONTENT8_PREVIEW, type ContinueVideoQuote, type Deal, type PlatformState, type Save } from './types';
import { recordCampaignOutcome } from './difficulty';
import { bonusKindFor, bonusPlacements, openBonusSlot, type BonusPlacement } from './bonus-slots';
import { requiresContinueProof, verifiesContinue, type ContinueProof } from './continuation';

export type RewardPlacement = 'hint' | 'undo' | 'continue' | 'ads-break' | 'coffee-break' | 'life-refill' | BonusPlacement | OfferPlacement;
export interface EarnedReceipt { schema: 1; id: string; attempt: string; dealId: string; mode: 'campaign' | 'daily'; placement: RewardPlacement }
export type AdPlacement = RewardPlacement | CampaignInterstitialPlacement;
export interface FullscreenShown extends Omit<EarnedReceipt, 'placement'> {
  placement: AdPlacement;
  kind: 'rewarded' | 'interstitial';
  shownAt: number;
}
export function platformState(save: Save): PlatformState {
  return save.platform ??= { receipts: [], continuedAttempts: [], continueCredits: 0, completedCampaign: [], winsSinceInterstitial: 0, lastFullscreenAt: 0 };
}
export function parseReceipt(value: unknown): EarnedReceipt {
  return parseAdIdentity(value, false) as EarnedReceipt;
}
function parseAdIdentity(value: unknown, interstitial: boolean): Omit<EarnedReceipt, 'placement'> & { placement: AdPlacement } {
  if (!value || typeof value !== 'object') throw Error('Invalid receipt');
  const r = value as Record<string, unknown>;
  const placement = String(r.placement), campaignAd = interstitial && isCampaignInterstitial(placement);
  if (r.schema !== 1 || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
    typeof r.attempt !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.attempt) ||
    typeof r.dealId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.dealId) ||
    (!['hint', 'undo', 'continue', 'ads-break', 'coffee-break', 'life-refill', ...Object.values(bonusPlacements)].includes(String(r.placement)) && !isOfferPlacement(placement) && !campaignAd) ||
    !['campaign', 'daily'].includes(String(r.mode)) ||
    ((campaignAd || r.placement === 'ads-break' && !interstitial || r.placement === 'coffee-break' || r.placement === 'life-refill' || bonusKindFor(String(r.placement)) || isOfferPlacement(String(r.placement))) && r.mode !== 'campaign')) throw Error('Invalid receipt');
  return { schema: 1, id: r.id, attempt: r.attempt, dealId: r.dealId, placement: r.placement as AdPlacement, mode: r.mode as EarnedReceipt['mode'] };
}
export function parseFullscreenShown(value: unknown): FullscreenShown {
  const { kind, shownAt } = (value ?? {}) as Partial<FullscreenShown>;
  const receipt = parseAdIdentity(value, kind === 'interstitial');
  if (typeof shownAt !== 'number' || !Number.isSafeInteger(shownAt) || shownAt <= 0 ||
    (kind !== 'rewarded' && (kind !== 'interstitial' || receipt.placement !== 'ads-break' && (receipt.mode !== 'campaign' || receipt.placement !== 'continue' && !isCampaignInterstitial(receipt.placement))))) {
    throw Error('Invalid fullscreen display');
  }
  return { ...receipt, kind, shownAt };
}

/** The native journal owns one verified show until this independent effect is durable. */
export function applyFullscreenShown(save: Save, shown: FullscreenShown, level?: number, repeatableDeal?: Deal): 'applied' | 'already-applied' {
  const attempt = save.attempt;
  const verifiedLife = shown.placement === 'life-refill' && matchesLifeShow(save, shown.attempt, shown.dealId);
  const offerPlacement = isOfferPlacement(shown.placement);
  const verifiedOffer = offerPlacement && shown.kind === 'rewarded' && Boolean(offerShowContext(save, shown));
  if (offerPlacement && !verifiedOffer) return 'already-applied';
  const verifiedContinue = shown.placement === 'continue' && shown.kind === 'rewarded' && Boolean(findContinueVideo(save, shown));
  if (!verifiedLife && !verifiedOffer && !verifiedContinue && (shown.attempt !== attempt.id || shown.dealId !== attempt.dealId || shown.mode !== (attempt.daily ? 'daily' : 'campaign'))) {
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
  if (shown.placement === 'ads-break' && shown.kind === 'interstitial') {
    if (repeatableDeal) recordCoffeeDisplay(save, repeatableDeal);
    else if (level !== undefined && shown.mode === 'campaign') recordAdBreakShown(save, level);
  }
  return 'applied';
}
/** All effects and identities enter the same coordinated snapshot; Undo never owns these fields. */
export function applyReceipt(save: Save, receipt: EarnedReceipt, options?: {
  deal?: Deal; onBonusUnlocked?: () => void; continueProof?: ContinueProof; unrestrictedVideo?: boolean; offerNow?: number;
}): 'applied' | 'already-applied' {
  if (receipt.placement === 'life-refill') {
    // The consumed request nonce is the durable exact-once authority, even if a late receipt is restamped.
    return settleLifeVideo(save, receipt.attempt, receipt.dealId, options?.offerNow) ? 'applied' : 'already-applied';
  }
  const state = platformState(save);
  if (state.receipts.includes(receipt.id)) return 'already-applied';
  if (receipt.placement === 'ads-break') return 'already-applied';
  if (receipt.placement === 'coffee-break') settleCoffee(save, receipt.attempt, receipt.dealId);
  else if (receipt.placement === 'continue') {
    if (state.continuedAttempts.includes(receipt.attempt)) {
      if (options?.unrestrictedVideo) return 'already-applied';
      state.receipts.push(receipt.id); save.revision++;
      return 'applied';
    }
    const quote = findContinueVideo(save, receipt);
    if (options?.unrestrictedVideo && state.continueVideos && !quote) return 'already-applied';
    state.continuedAttempts.push(receipt.attempt);
    const active = sameContinueIdentity(receipt, continueIdentity(save));
    if (quote) {
      quote.status = 'credit';
      if (active) useVideoContinue(save, options?.deal);
    } else {
      // Android may deliver a receipt from an older installation before the first versioned quote.
      state.continueCredits++;
      if (active) {
        if (options?.unrestrictedVideo) useVideoContinue(save, options.deal);
        else useContinue(save, options?.continueProof);
      }
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
function continueIdentity(save: Save): Omit<ContinueVideoQuote, 'status'> {
  return { attempt: save.attempt.id, dealId: save.attempt.dealId, mode: save.attempt.daily ? 'daily' : 'campaign' };
}
function sameContinueIdentity(a: Omit<ContinueVideoQuote, 'status'>, b: Omit<ContinueVideoQuote, 'status'>) {
  return a.attempt === b.attempt && a.dealId === b.dealId && a.mode === b.mode;
}
function findContinueVideo(save: Save, identity: Omit<ContinueVideoQuote, 'status'>) {
  return save.platform?.continueVideos?.quotes.find(row => sameContinueIdentity(row, identity));
}
export function quoteContinueVideo(save: Save) {
  if (!canResumeBoard(save) || save.platform?.continuedAttempts.includes(save.attempt.id)) return false;
  const journal = platformState(save).continueVideos ??= { version: 1, quotes: [] };
  const identity = continueIdentity(save);
  if (!findContinueVideo(save, identity)) journal.quotes.push({ ...identity, status: 'pending' });
  return true;
}
export function canShowContinueVideo(save: Save, identity: Omit<ContinueVideoQuote, 'status'>) {
  return canResumeBoard(save) && sameContinueIdentity(identity, continueIdentity(save)) &&
    findContinueVideo(save, identity)?.status === 'pending' && !save.platform?.continuedAttempts.includes(identity.attempt);
}
export function cancelContinueVideo(save: Save, identity: Omit<ContinueVideoQuote, 'status'>) {
  const journal = save.platform?.continueVideos, quote = findContinueVideo(save, identity);
  if (journal && quote?.status === 'pending') journal.quotes = journal.quotes.filter(row => row !== quote);
}
function earnedVideoCredit(save: Save) {
  const attempt = continueIdentity(save);
  const parkedIds = [save.parked?.campaign?.id, save.parked?.daily?.id];
  const credits = save.platform?.continueVideos?.quotes.filter(quote => quote.status === 'credit');
  return credits?.find(quote => sameContinueIdentity(quote, attempt)) ??
    credits?.find(quote => quote.attempt !== attempt.attempt && !parkedIds.includes(quote.attempt));
}
export function hasVideoContinueCredit(save: Save) {
  return Boolean(save.platform?.continueCredits || earnedVideoCredit(save));
}
export function useVideoContinue(save: Save, deal?: Deal): boolean {
  const state = save.platform;
  if (!state || !canResumeBoard(save) || deal?.id !== save.attempt.dealId) return false;
  const quote = earnedVideoCredit(save);
  if (quote && state.continueVideos) state.continueVideos.quotes = state.continueVideos.quotes.filter(row => row !== quote);
  else if (state.continueCredits) state.continueCredits--;
  else return false;
  if (!state.continuedAttempts.includes(save.attempt.id)) state.continuedAttempts.push(save.attempt.id);
  resumeAttempt(save, deal.recovery ? 'earned' : undefined);
  return true;
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
    hasVideoContinueCredit(save) || !canResume(save, proof)) return false;
  save.profile.coins -= BALANCE.continueCoinPrice;
  // A receipt already earned from an earlier video remains payable as a credit.
  resumeAttempt(save, proof.deal.recovery ? 'coins' : undefined);
  return true;
}

function canResumeBoard(save: Save): boolean {
  const attempt = save.attempt;
  return !attempt.continued && !attempt.lostLife && attempt.board.phase === 'exhausted' && attempt.board.movesLeft === 0;
}
function canResume(save: Save, proof?: ContinueProof): boolean {
  return canResumeBoard(save) && (!requiresContinueProof(save.attempt) || Boolean(proof && verifiesContinue(save.attempt, proof)));
}

function resumeAttempt(save: Save, channel?: 'coins' | 'earned') {
  const attempt = save.attempt;
  attempt.continued = true;
  if (channel) attempt.revive = { version: 1, channel, moves: BALANCE.continueMoves, price: channel === 'coins' ? BALANCE.continueCoinPrice : 0 };
  attempt.board.movesLeft = BALANCE.continueMoves;
  attempt.board.phase = 'playing';
  if (attempt.telemetry) attempt.telemetry.finished = false;
  // Undo can restore the cards, while the acquired move budget is kept.
  for (const board of attempt.undo) {
    if (board.movesLeft === null) continue;
    board.movesLeft += BALANCE.continueMoves;
    if (board.phase === 'exhausted') board.phase = 'playing';
  }
  save.revision++;
}
export function purchaseHelper(save: Save, helper: 'hint' | 'undo' | 'joker'): boolean {
  const cost = BALANCE.helperPrices[helper];
  if (save.profile.coins < cost) return false;
  save.profile.coins -= cost; save.profile[helper === 'hint' ? 'hints' : helper === 'undo' ? 'undos' : 'jokers']++; save.revision++; return true;
}
export function interstitialEligible(save: Save, level: number, mode: 'campaign' | 'daily', now: number, launchedAt: number): boolean {
  const state = save.platform;
  return Boolean(state && mode === 'campaign' && level > BALANCE.ads.interstitialAfterLevel &&
    state.winsSinceInterstitial >= BALANCE.ads.winsPerInterstitial &&
    now >= state.lastFullscreenAt && now - Math.max(state.lastFullscreenAt, launchedAt) >= BALANCE.ads.fullscreenGapMs);
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
