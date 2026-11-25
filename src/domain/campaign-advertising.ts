import { LEGACY_OWNER_PREVIEW } from '../domain/types';
import { activePurchaseGoods } from './commerce/orders';
import type { Deal, Save } from './types';

export const ADS_CONTROLS_PREVIEW = LEGACY_OWNER_PREVIEW === 'ad-controls';
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export interface AdRevenue {
  id: string; placement?: string; micros: number; currency: string; kind: 'banner'|'rewarded'|'interstitial';
}
export interface CampaignAdsState {
  version: 1;
  shownLevels: number[];
  pendingCoffee?: { attemptId: string; dealId: string; amount: number };
  revenue: AdRevenue[];
}

const state = (save: Save) => save.campaignAds ??= { version: 1, shownLevels: [], revenue: [] };
export function parseAdRevenue(value: unknown): AdRevenue | undefined {
  if (!value || typeof value !== 'object') return;
  const { id, placement, micros, currency, kind } = value as Partial<AdRevenue>;
  if (!token(id) || !natural(micros) || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) ||
      !kind || !['banner', 'rewarded', 'interstitial'].includes(kind)) return;
  if (placement !== undefined && (!token(placement) || placement.length > 48)) return;
  return { id, micros, currency, kind, ...(placement ? { placement } : {}) };
}
export function recordAdRevenue(save: Save, value: unknown) {
  const event = parseAdRevenue(value);
  if (!event || save.campaignAds?.revenue.some(entry => entry.id === event.id)) return false;
  const data = state(save);
  data.revenue = [...data.revenue, event].slice(-128);
  save.revision++;
  return true;
}

export function adFree(save: Save, now: number, placement: 'interstitial'|'banner' = 'interstitial') {
  return activePurchaseGoods(save.commerce, save.commerceAccount ?? '', now)
    .some(item => item.good.type === 'no-ads' && (placement === 'interstitial' || item.good.placements === 'banner-and-interstitial'));
}

const MIN_LEVEL = 16;
export const AD_BREAK_GAP_MS = 180_000;
export function adBreakBlocker(save: Save, deal: Deal, now: number, launchedAt: number, approved: boolean, idle: boolean) {
  const level = deal.campaignLevel, attempt = save.attempt;
  if (!approved) return 'policy';
  if (level === undefined || level < MIN_LEVEL || attempt.daily || attempt.dealId !== deal.id) return 'campaign';
  if (deal.difficultyTier === 'superhard') return 'difficulty';
  if (!attempt.telemetry?.started || attempt.board.phase !== 'playing' || (attempt.board.movesLeft ?? 0) <= 10) return 'board';
  if (attempt.adBreakShown || save.campaignAds?.shownLevels.includes(level)) return 'shown';
  if (adFree(save, now)) return 'entitlement';
  if (now - Math.max(launchedAt, save.platform?.lastFullscreenAt ?? 0) < AD_BREAK_GAP_MS) return 'cadence';
  if (!idle) return 'busy';
}
export function eligibleAdBreak(save: Save, deal: Deal, now: number, launchedAt: number, approved: boolean, idle: boolean) {
  return adBreakBlocker(save, deal, now, launchedAt, approved, idle) === undefined;
}
export function recordAdBreakShown(save: Save, level: number) {
  save.attempt.adBreakShown = true;
  if (!state(save).shownLevels.includes(level)) state(save).shownLevels.push(level);
}

export function authorizeCoffee(save: Save, deal: Deal, approved: boolean) {
  const attempt = save.attempt, level = deal.campaignLevel;
  if (!approved || !level || level < MIN_LEVEL || attempt.daily || attempt.dealId !== deal.id ||
      attempt.coffeeRequested || save.campaignAds?.pendingCoffee || attempt.board.phase !== 'playing') return false;
  attempt.coffeeRequested = true;
  state(save).pendingCoffee = { attemptId: attempt.id, dealId: deal.id, amount: 10 };
  save.revision++;
  return true;
}

export function matchesCoffee(save: Save, attemptId: string, dealId: string) {
  const pending = save.campaignAds?.pendingCoffee;
  return pending?.attemptId === attemptId && pending.dealId === dealId;
}
export function settleCoffee(save: Save, attemptId: string, dealId: string) {
  const pending = save.campaignAds?.pendingCoffee;
  if (!pending || !matchesCoffee(save, attemptId, dealId) || !natural(save.profile.coins + pending.amount)) return;
  delete save.campaignAds!.pendingCoffee;
  save.profile.coins += pending.amount;
}
export function cancelCoffee(save: Save, attemptId: string, dealId: string) {
  if (!matchesCoffee(save, attemptId, dealId)) return;
  delete save.campaignAds!.pendingCoffee;
  if (save.attempt.id === attemptId) delete save.attempt.coffeeRequested;
  save.revision++;
}

export function validCampaignAds(value: CampaignAdsState) {
  return Boolean(value && value.version === 1 && Array.isArray(value.shownLevels) &&
    value.shownLevels.every(level => natural(level) && level > 0) && new Set(value.shownLevels).size === value.shownLevels.length &&
    Array.isArray(value.revenue) && value.revenue.length <= 128 && value.revenue.every(parseAdRevenue) &&
    new Set(value.revenue.map(event => event.id)).size === value.revenue.length &&
    (value.pendingCoffee === undefined || (value.pendingCoffee && token(value.pendingCoffee.attemptId) &&
      token(value.pendingCoffee.dealId) && value.pendingCoffee.amount === 10)));
}
