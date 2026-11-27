import config from '../config/c8-release.json' with { type: 'json' };
import { unlockedLevel } from './progression';
import { LEGACY_OWNER_PREVIEW } from '../domain/types';
import { activePurchaseGoods } from './commerce/orders';
import type { Deal, Save } from './types';

export const ADS_CONTROLS_PREVIEW = LEGACY_OWNER_PREVIEW === 'ad-controls';
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export interface AdRevenue {
  id: string; placement?: string; micros: number; currency: string; kind: 'banner'|'rewarded'|'interstitial';
}
interface CoffeeDisplay {
  attemptId: string;
  dealId: string;
  mode: 'campaign' | 'daily';
  level?: number;
  difficulty?: string;
  count: number;
}
export interface CampaignAdsState {
  version: 1;
  shownLevels: number[];
  coffeeDisplays?: CoffeeDisplay[];
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

export const releaseAdCadence = config.policies.advertisingCadence;
type CoffeePolicy = Omit<typeof releaseAdCadence.coffee, 'minRemainingStepsPercent' | 'maxByDifficulty'> & {
  minRemainingStepsPercent: number | null;
  maxByDifficulty: Partial<Record<string, number>>;
};
const MIN_LEVEL = 16;
export const AD_BREAK_GAP_MS = 180_000;
export function coffeeBlocker(save: Save, deal: Deal, now: number, launchedAt: number, approved: boolean, idle: boolean, policy: CoffeePolicy = releaseAdCadence.coffee) {
  const attempt = save.attempt, mode = attempt.daily ? 'daily' : 'campaign';
  const difficulty = deal.difficultyTier ?? 'normal';
  if (!approved) return 'policy';
  if (!policy.modes.includes(mode) || unlockedLevel(save) < policy.unlockLevel ||
      attempt.dealId !== deal.id || (!attempt.daily && (deal.campaignLevel ?? 0) < policy.unlockLevel)) return 'campaign';
  if (!attempt.telemetry?.started || attempt.board.phase !== 'playing') return 'board';
  const total = deal.initial.movesLeft;
  if (policy.minRemainingStepsPercent !== null && total && attempt.board.movesLeft !== null &&
      attempt.board.movesLeft * 100 < total * policy.minRemainingStepsPercent) return 'board';
  const cap = policy.maxByDifficulty[difficulty];
  if (cap !== undefined && (save.campaignAds?.coffeeDisplays?.find(row => row.attemptId === attempt.id && row.dealId === deal.id)?.count ?? 0) >= cap) return 'shown';
  if (adFree(save, now)) return 'entitlement';
  if (now < coffeeEligibleAt(save, launchedAt, policy)) return 'cadence';
  if (!idle) return 'busy';
}
export function coffeeEligibleAt(save: Save, launchedAt: number, policy: CoffeePolicy = releaseAdCadence.coffee) {
  return Math.max(launchedAt + policy.startupMs, (save.platform?.lastFullscreenAt ?? 0) + policy.spacingMs);
}
export const campaignInterstitialPlacements = ['menu', 'level-start', 'level-end', 'theme'] as const;
export type CampaignInterstitialPlacement = typeof campaignInterstitialPlacements[number];
export function isCampaignInterstitial(placement: string): placement is CampaignInterstitialPlacement {
  return (campaignInterstitialPlacements as readonly string[]).includes(placement);
}

export function releasePlacementEligible(save: Save, level: number, placement: CampaignInterstitialPlacement,
  now: number, launchedAt: number, policy = releaseAdCadence.interstitial) {
  if (placement === 'theme' && !policy.theme || placement === 'level-start' && !policy.levelStart ||
      placement === 'level-end' && policy.levelStart) return false;
  return releaseLevelAdEligible(save, level, now, launchedAt, policy);
}
export function releaseLevelAdEligible(save: Save, target: number, now: number, launchedAt: number, policy = releaseAdCadence.interstitial) {
  return !save.attempt.daily && target >= policy.minimumLevel && !adFree(save, now) &&
    now >= Math.max(launchedAt + policy.startupMs, (save.platform?.lastFullscreenAt ?? 0) + policy.spacingMs);
}
export function recordCoffeeDisplay(save: Save, deal?: Deal, attempt = save.attempt) {
  const data = state(save);
  const history = data.coffeeDisplays ?? [];
  const previous = history.find(row => row.attemptId === attempt.id && row.dealId === attempt.dealId);
  const next: CoffeeDisplay = {
    attemptId: attempt.id, dealId: attempt.dealId, mode: attempt.daily ? 'daily' : 'campaign',
    ...(deal?.campaignLevel !== undefined ? { level: deal.campaignLevel } : {}),
    ...(deal?.difficultyTier ? { difficulty: deal.difficultyTier } : {}),
    count: Math.min(Number.MAX_SAFE_INTEGER, (previous?.count ?? 0) + 1),
  };
  data.coffeeDisplays = [...history.filter(row => row !== previous), next].slice(-128);
}
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
export function recordAdBreakShown(save: Save, level: number, attempt = save.attempt) {
  attempt.adBreakShown = true;
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
    (value.coffeeDisplays === undefined || (Array.isArray(value.coffeeDisplays) && value.coffeeDisplays.length <= 128 &&
      value.coffeeDisplays.every(row => row && token(row.attemptId) && token(row.dealId) &&
        (row.mode === 'campaign' || row.mode === 'daily') && natural(row.count) && row.count > 0 &&
        (row.level === undefined || natural(row.level) && row.level > 0) && (row.difficulty === undefined || token(row.difficulty))) &&
      new Set(value.coffeeDisplays.map(row => row.attemptId + '/' + row.dealId)).size === value.coffeeDisplays.length)) &&
    (value.pendingCoffee === undefined || (value.pendingCoffee && token(value.pendingCoffee.attemptId) &&
      token(value.pendingCoffee.dealId) && value.pendingCoffee.amount === 10)));
}
