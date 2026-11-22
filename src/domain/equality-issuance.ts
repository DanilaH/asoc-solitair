import { equalityAttestation, type EqualityCandidate } from './equality-attestation';
import { futureDifficultyPenalty } from './difficulty';
import { campaignId } from './progression';
import type { Attempt, Deal, Save } from './types';

export type EqualitySegment = 'NonPayer' | 'Payer' | 'PotentialPayer' | 'SleepPayer' | 'unknown';

export interface EqualityPreviewPolicy {
  enabled: boolean;
  cohortEvidence: 'controlled-fixture' | 'verified-provider' | 'unknown';
  segment?: EqualitySegment;
  enabledSegments: readonly Exclude<EqualitySegment, 'unknown'>[];
  providerRevision?: string;
  seed?: number;
  minLevel?: number;
  version: string;
  maxIssued: number;
  candidates: readonly EqualityCandidate[];
}

export function issueEqualityDeal(save: Save, base: Deal, attemptId: string, policy?: EqualityPreviewPolicy): Deal {
  const level = base.campaignLevel;
  const segment = policy?.segment ?? 'unknown';
  const seed = policy?.seed ?? 0;
  if (!policy?.enabled || (policy.cohortEvidence !== 'controlled-fixture' && policy.cohortEvidence !== 'verified-provider') ||
    (policy.cohortEvidence === 'verified-provider' && !policy.providerRevision) ||
    segment === 'unknown' || !['NonPayer', 'Payer', 'PotentialPayer', 'SleepPayer'].includes(segment) ||
    !Number.isSafeInteger(seed) || seed <= 0 || seed > 2147483647 ||
    !policy.enabledSegments.includes(segment) ||
    !policy.version || !Number.isSafeInteger(policy.maxIssued) || policy.maxIssued <= (save.equality?.issued ?? 0) ||
    level === undefined || level < (policy.minLevel ?? 1) || base.daily || save.platform?.completedCampaign.includes(campaignId(level))) return base;

  const stats = save.equality ??= { version: 1, eligible: 0, attempted: 0, selected: 0, issued: 0, lost: 0, completed: 0 };
  stats.eligible++; stats.attempted++;
  const penalty = futureDifficultyPenalty(save);
  const candidate = policy.candidates.map(equalityAttestation).find(entry => entry &&
    entry.baseId === base.id && entry.paywallSeed === seed && entry.historyPenalty === penalty &&
    entry.baseBudget === base.initial.movesLeft && entry.deal.id !== base.id && entry.deal.campaignLevel === level);
  if (!candidate) return base;

  stats.selected++; stats.issued++;
  stats.last = { attemptId, dealId: candidate.deal.id, dealVersion: candidate.deal.version, policyVersion: policy.version, segment, cohortEvidence: policy.cohortEvidence, seed, attestation: candidate.attestation, providerRevision: policy.cohortEvidence === 'verified-provider' ? policy.providerRevision : undefined, lost: false, completed: false };
  return candidate.deal;
}

export function recordEqualityOutcome(save: Save, attempt: Attempt): void {
  const stats = save.equality, last = stats?.last;
  if (!stats || !last || last.attemptId !== attempt.id || last.dealId !== attempt.dealId || attempt.daily) return;
  if (attempt.board.phase === 'exhausted' && !last.lost) { last.lost = true; stats.lost++; }
  if (attempt.board.phase === 'won' && !last.completed) { last.completed = true; stats.completed++; }
}

export function carryEqualityRestart(save: Save, previous: Attempt): void {
  const last = save.equality?.last;
  if (last?.attemptId === previous.id && last.dealId === previous.dealId && save.attempt.dealId === previous.dealId) {
    last.attemptId = save.attempt.id;
  }
}
