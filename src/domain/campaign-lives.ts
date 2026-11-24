import { recordLiveOpsLoss } from './events/campaign-liveops';
import { releaseProfile } from '../config/profile';
import { LEGACY_OWNER_PREVIEW, OWNER_ACCEPTANCE_PREVIEW } from './types';
import type { Attempt, Save } from './types';

export const LIVEOPS_PREVIEW = LEGACY_OWNER_PREVIEW === 'lives' || OWNER_ACCEPTANCE_PREVIEW;
export const LIVES_PREVIEW = releaseProfile?.capabilities.lives === 'active' || LIVEOPS_PREVIEW;
export const LIVES_RULES = { max: 3, refillMs: 5 * 60_000, coinPrice: 50 } as const;
const natural = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

export interface CampaignLives {
  version: 1;
  remaining: number;
  observedAt: number;
  refillAt?: number;
  earnedCredits: number;
  pending?: { id: string; attemptId: string; dealId: string };
  lastEarned?: { id: string; dealId: string };
}

export function validCampaignLives(data: CampaignLives) {
  return Boolean(data && data.version === 1 && natural(data.remaining) && data.remaining <= LIVES_RULES.max &&
    natural(data.observedAt) && natural(data.earnedCredits) &&
    (data.remaining === LIVES_RULES.max ? data.refillAt === undefined : natural(data.refillAt) && data.refillAt > data.observedAt) &&
    (data.pending === undefined || (data.pending && [data.pending.id, data.pending.attemptId, data.pending.dealId].every(token))) &&
    (data.lastEarned === undefined || (data.lastEarned && [data.lastEarned.id, data.lastEarned.dealId].every(token))));
}

function lifeState(save: Save, now: number) {
  return save.campaignLives ??= { version: 1, remaining: LIVES_RULES.max, observedAt: now, earnedCredits: 0 };
}
export function refreshCampaignLives(save: Save, now: number) {
  if (!natural(now)) return;
  const state = lifeState(save, now);
  if (now < state.observedAt || state.refillAt === undefined || now < state.refillAt) return;
  const steps = 1 + Math.floor((now - state.refillAt) / LIVES_RULES.refillMs);
  state.remaining = Math.min(LIVES_RULES.max, state.remaining + steps);
  state.observedAt = now;
  if (state.remaining === LIVES_RULES.max) delete state.refillAt;
  else state.refillAt += steps * LIVES_RULES.refillMs;
  save.revision++;
}

export function mayStartCampaignAttempt(save: Save, previous: Attempt | undefined, now: number, enabled = LIVES_PREVIEW) {
  if (!enabled) return true;
  if (!natural(now)) return false;
  refreshCampaignLives(save, now);
  const lives = lifeState(save, now);
  if (previous && !previous.daily && previous.board.phase === 'exhausted' && !previous.lostLife && lives.remaining > 0) {
    const clock = Math.max(now, lives.observedAt);
    previous.lostLife = true;
    recordLiveOpsLoss(save);
    lives.remaining--;
    lives.observedAt = clock;
    lives.refillAt ??= clock + LIVES_RULES.refillMs;
    save.revision++;
  }
  return lives.remaining > 0;
}

function addLife(lives: CampaignLives) {
  lives.remaining++;
  if (lives.remaining === LIVES_RULES.max) delete lives.refillAt;
}
export function refillCampaignLife(save: Save, quote: { revision: number; method: 'coins'|'credit'; now: number }) {
  if (save.revision !== quote.revision || !natural(quote.now)) return false;
  refreshCampaignLives(save, quote.now);
  const lives = lifeState(save, quote.now);
  if (lives.remaining >= LIVES_RULES.max) return false;
  if (quote.method === 'coins') {
    if (save.profile.coins < LIVES_RULES.coinPrice) return false;
    save.profile.coins -= LIVES_RULES.coinPrice;
  } else {
    if (lives.earnedCredits === 0) return false;
    lives.earnedCredits--;
  }
  addLife(lives);
  save.revision++;
  return true;
}
export function authorizeLifeVideo(save: Save, now: number, id: string, approved: boolean) {
  if (!approved || !natural(now) || !token(id) || save.attempt.daily) return false;
  refreshCampaignLives(save, now);
  const lives = lifeState(save, now);
  if (lives.remaining >= LIVES_RULES.max || lives.pending) return false;
  lives.pending = { id, attemptId: save.attempt.id, dealId: save.attempt.dealId };
  save.revision++;
  return true;
}
export function matchesLifeVideo(save: Save, id: string, dealId: string) {
  const pending = save.campaignLives?.pending;
  return pending?.id === id && pending.dealId === dealId;
}
export function matchesLifeShow(save: Save, id: string, dealId: string) {
  const last = save.campaignLives?.lastEarned;
  return matchesLifeVideo(save, id, dealId) || (last?.id === id && last.dealId === dealId);
}
export function cancelLifeVideo(save: Save, id: string) {
  if (save.campaignLives?.pending?.id !== id) return;
  delete save.campaignLives!.pending;
  save.revision++;
}
export function settleLifeVideo(save: Save, id: string, dealId: string) {
  const lives = save.campaignLives;
  if (!lives || !matchesLifeVideo(save, id, dealId)) return false;
  delete lives.pending;
  lives.lastEarned = { id, dealId };
  if (lives.remaining < LIVES_RULES.max) addLife(lives);
  else if (natural(lives.earnedCredits + 1)) lives.earnedCredits++;
  save.revision++;
  return true;
}
