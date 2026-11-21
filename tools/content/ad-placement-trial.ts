import type { DifficultyTier } from '../../src/domain/types';

export type TrialPlacement = 'ads-break' | 'coffee-break' | 'banner';
interface PlacementRule { cooldownMs: number; levelCap: number; attemptCap: number }
export interface PlacementPolicy {
  version: 1;
  enabled: boolean;
  minLevel: number;
  rules: Record<DifficultyTier, PlacementRule>;
  coffeeCoins: number;
  requestTimeoutMs: number;
}

interface Opportunity {
  placement: TrialPlacement;
  attemptId: string;
  dealId: string;
  level: number;
  difficulty: DifficultyTier;
  now: number;
  mode: 'campaign' | 'daily';
  playing: boolean;
  clearInput: boolean;
}
interface ShowRequest {
  id: string;
  provider: string;
  placement: TrialPlacement;
  attemptId: string;
  dealId: string;
  level: number;
  at: number;
  coffeeCoins: number;
}
interface Session extends ShowRequest {
  shownAt?: number;
  impression?: string;
  earnedReceipt?: string;
  revenue?: { id: string; impression: string; currency: string; amountMicros: number };
}
export interface PlacementsTrial {
  version: 1;
  lastFullscreenAt: number;
  sessions: readonly Session[];
  coins: number;
}

const natural = (number: number) => Number.isSafeInteger(number) && number >= 0;
const token = (value: string) => /^[a-zA-Z0-9_:-]{1,100}$/.test(value);

export function requestPlacement(state: PlacementsTrial, policy: PlacementPolicy, opportunity: Opportunity,
  id: string, provider: string): PlacementsTrial {
  const { now, level, attemptId, placement } = opportunity;
  if (state.version !== 1 || policy.version !== 1 || !policy.enabled || opportunity.mode !== 'campaign' ||
    level < policy.minLevel || !opportunity.playing || !opportunity.clearInput || !natural(now) || !natural(level) ||
    !token(id) || !token(provider) || !token(attemptId) || !token(opportunity.dealId) ||
    state.sessions.some(session => session.id === id)) return state;
  const rule = policy.rules[opportunity.difficulty];
  if (!rule || ![rule.cooldownMs, rule.levelCap, rule.attemptCap, policy.coffeeCoins, policy.requestTimeoutMs].every(natural) ||
    policy.requestTimeoutMs === 0) return state;

  const history = state.sessions.filter(session => session.placement === placement && session.shownAt !== undefined);
  if (placement !== 'banner' && (now - state.lastFullscreenAt < rule.cooldownMs ||
    history.filter(session => session.level === level).length >= rule.levelCap ||
    history.filter(session => session.attemptId === attemptId).length >= rule.attemptCap ||
    state.sessions.some(session => session.placement !== 'banner' && session.shownAt === undefined && now - session.at < policy.requestTimeoutMs))) return state;
  if (placement === 'banner' && history.some(session => session.attemptId === attemptId)) return state;

  const request: ShowRequest = { id, provider, placement, attemptId, dealId: opportunity.dealId, level, at: now,
    coffeeCoins: placement === 'coffee-break' ? policy.coffeeCoins : 0 };
  return { ...state, sessions: [...state.sessions, request] };
}

interface PlacementEvidence { requestId: string; provider: string }
type Evidence = PlacementEvidence & (
  { type: 'no-fill' } |
  { type: 'shown'; at: number } |
  { type: 'impression'; id: string } |
  { type: 'earned'; receiptId: string } |
  { type: 'revenue'; id: string; impression: string; currency: string; amountMicros: number }
);

export function placeEvidence(state: PlacementsTrial, evidence: Evidence): PlacementsTrial {
  const current = state.sessions.find(session => session.id === evidence.requestId && session.provider === evidence.provider);
  if (!current) return state;
  const update = (next: Session) => ({ ...state, sessions: state.sessions.map(session => session === current ? next : session) });
  if (evidence.type === 'no-fill') {
    return current.shownAt !== undefined ? state : { ...state, sessions: state.sessions.filter(session => session !== current) };
  }
  if (evidence.type === 'shown') {
    if (current.shownAt !== undefined || !natural(evidence.at) || evidence.at < current.at) return state;
    const next = update({ ...current, shownAt: evidence.at });
    return current.placement === 'banner' ? next : { ...next, lastFullscreenAt: Math.max(state.lastFullscreenAt, evidence.at) };
  }
  if (current.shownAt === undefined) return state;
  if (evidence.type === 'impression') {
    if (current.impression || !token(evidence.id) ||
      state.sessions.some(session => session.provider === current.provider && session.impression === evidence.id)) return state;
    return update({ ...current, impression: evidence.id });
  }
  if (evidence.type === 'earned') {
    if (current.placement !== 'coffee-break' || !current.coffeeCoins || current.earnedReceipt || !token(evidence.receiptId) ||
      state.sessions.some(session => session.provider === current.provider && session.earnedReceipt === evidence.receiptId) ||
      !natural(state.coins + current.coffeeCoins)) return state;
    return { ...update({ ...current, earnedReceipt: evidence.receiptId }), coins: state.coins + current.coffeeCoins };
  }
  if (current.revenue || !current.impression || current.impression !== evidence.impression ||
    !token(evidence.id) || !/^[A-Z]{3}$/.test(evidence.currency) || !natural(evidence.amountMicros) ||
    state.sessions.some(session => session.provider === current.provider && session.revenue?.id === evidence.id)) return state;
  return update({ ...current, revenue: { id: evidence.id, impression: evidence.impression,
    currency: evidence.currency, amountMicros: evidence.amountMicros } });
}
