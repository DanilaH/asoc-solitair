import { activePurchaseGoods } from './commerce/orders';
import type { Deal, Save } from './types';

export const ADS_CONTROLS_PREVIEW = import.meta.env?.VITE_C8_OWNER_PREVIEW === 'ad-controls';
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export interface AdRevenue {
  id: string; micros: number; currency: string; kind: 'banner'|'rewarded'|'interstitial';
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
  const { id, micros, currency, kind } = value as Partial<AdRevenue>;
  if (!token(id) || !natural(micros) || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) ||
      !kind || !['banner', 'rewarded', 'interstitial'].includes(kind)) return;
  return { id, micros, currency, kind };
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
  const accounts = new Set(save.commerce?.orders.map(order => order.accountId));
  return [...accounts].some(account => activePurchaseGoods(save.commerce, account, now).some(item => item.good.type === 'no-ads' && (placement === 'interstitial' || item.good.placements === 'banner-and-interstitial')));
}

const MIN_LEVEL = 16, GAP = 180_000;
export function eligibleAdBreak(save: Save, deal: Deal, now: number, launchedAt: number, approved: boolean, idle: boolean) {
  const level = deal.campaignLevel;
  return Boolean(approved && idle && level !== undefined && level >= MIN_LEVEL && deal.difficultyTier !== 'superhard' &&
    save.attempt.dealId === deal.id && !save.attempt.daily && save.attempt.telemetry?.started &&
    save.attempt.board.phase === 'playing' && (save.attempt.board.movesLeft ?? 0) > 10 &&
    !save.attempt.adBreakShown && !save.campaignAds?.shownLevels.includes(level) && !adFree(save, now) &&
    now - Math.max(launchedAt, save.platform?.lastFullscreenAt ?? 0) >= GAP);
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
