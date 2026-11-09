import { BALANCE } from './balance';
import type { PlatformState, Save } from './types';

export type RewardPlacement = 'hint' | 'undo' | 'continue';
export interface EarnedReceipt { schema: 1; id: string; attempt: string; dealId: string; mode: 'campaign' | 'daily'; placement: RewardPlacement }
export function platformState(save: Save): PlatformState {
  return save.platform ??= { receipts: [], continuedAttempts: [], continueCredits: 0, completedCampaign: [], winsSinceInterstitial: 0, lastFullscreenAt: 0 };
}
export function parseReceipt(value: unknown): EarnedReceipt {
  if (!value || typeof value !== 'object') throw Error('Invalid receipt');
  const r = value as Record<string, unknown>;
  if (r.schema !== 1 || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
    typeof r.attempt !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.attempt) ||
    typeof r.dealId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.dealId) ||
    !['hint', 'undo', 'continue'].includes(String(r.placement)) || !['campaign', 'daily'].includes(String(r.mode))) throw Error('Invalid receipt');
  return { schema: 1, id: r.id, attempt: r.attempt, dealId: r.dealId, placement: r.placement as RewardPlacement, mode: r.mode as EarnedReceipt['mode'] };
}
/** All effects and identities enter the same coordinated snapshot; Undo never owns these fields. */
export function applyReceipt(save: Save, receipt: EarnedReceipt): 'applied' | 'already-applied' {
  const state = platformState(save);
  if (state.receipts.includes(receipt.id)) return 'already-applied';
  if (receipt.placement === 'continue') {
    if (!state.continuedAttempts.includes(receipt.attempt)) {
      state.continuedAttempts.push(receipt.attempt); state.continueCredits++;
      // A late receipt must not mutate a different attempt. Its earned credit remains available.
      if (save.attempt.id === receipt.attempt) useContinue(save);
    }
  } else save.profile[receipt.placement === 'hint' ? 'hints' : 'undos'] += BALANCE.rewardedCharges[receipt.placement];
  state.receipts.push(receipt.id); save.revision++;
  return 'applied';
}
export function useContinue(save: Save): boolean {
  const state = platformState(save), attempt = save.attempt;
  if (state.continueCredits < 1 || attempt.continued || attempt.board.phase !== 'exhausted' || attempt.board.movesLeft !== 0) return false;
  state.continueCredits--; attempt.continued = true; attempt.board.movesLeft = BALANCE.continueMoves; attempt.board.phase = 'playing';
  if (!state.continuedAttempts.includes(attempt.id)) state.continuedAttempts.push(attempt.id);
  if (attempt.telemetry) attempt.telemetry.finished = false;
  // Keep the earned budget when undoing an earlier board move. The allowance itself is never rolled back.
  for (const board of attempt.undo) if (board.movesLeft !== null) board.movesLeft += BALANCE.continueMoves;
  save.revision++; return true;
}
export function purchaseHelper(save: Save, helper: 'hint' | 'undo'): boolean {
  const cost = BALANCE.helperPrices[helper];
  if (save.profile.coins < cost) return false;
  save.profile.coins -= cost; save.profile[helper === 'hint' ? 'hints' : 'undos']++; save.revision++; return true;
}
export function interstitialEligible(save: Save, level: number, mode: 'campaign' | 'daily', now: number, launchedAt: number): boolean {
  const state = platformState(save);
  return mode === 'campaign' && level > BALANCE.ads.interstitialAfterLevel &&
    state.winsSinceInterstitial >= BALANCE.ads.winsPerInterstitial &&
    now >= state.lastFullscreenAt && now - Math.max(state.lastFullscreenAt, launchedAt) >= BALANCE.ads.fullscreenGapMs;
}
export function markCampaignWin(save: Save, dealId: string, level?: number): void {
  // Control deal/replays are not new campaign progress.
  const state = platformState(save);
  if (level === undefined || state.completedCampaign.includes(dealId)) return;
  state.completedCampaign.push(dealId);
  if (level > BALANCE.ads.interstitialAfterLevel) state.winsSinceInterstitial++;
}
