import { campaignId } from './progression';
import type { Attempt, Deal, Save } from './types';

export interface EqualityCandidate {
  baseId: string;
  deal: Deal;
  proof: { version: 1; scope: 'PRODUCT_ADAPTED'; winningSteps: number; lateLossPaths: readonly string[] };
}

export interface EqualityPreviewPolicy {
  enabled: boolean;
  cohortEvidence: 'controlled-fixture' | 'unknown';
  version: string;
  maxIssued: number;
  candidates: readonly EqualityCandidate[];
}

export function issueEqualityDeal(save: Save, base: Deal, attemptId: string, policy?: EqualityPreviewPolicy): Deal {
  const level = base.campaignLevel;
  if (!policy?.enabled || policy.cohortEvidence !== 'controlled-fixture' ||
    !policy.version || !Number.isSafeInteger(policy.maxIssued) || policy.maxIssued <= (save.equality?.issued ?? 0) ||
    level === undefined || base.daily || save.platform?.completedCampaign.includes(campaignId(level))) return base;

  const stats = save.equality ??= { version: 1, eligible: 0, attempted: 0, selected: 0, issued: 0, lost: 0, completed: 0 };
  stats.eligible++; stats.attempted++;
  const candidate = policy.candidates.find(({ baseId, deal, proof }) => baseId === base.id &&
    deal.id !== base.id && deal.version > 0 && !deal.daily && deal.campaignLevel === level &&
    deal.initial.phase === 'playing' && deal.initial.movesLeft !== null && proof.version === 1 &&
    proof.scope === 'PRODUCT_ADAPTED' && proof.winningSteps === deal.winningPath.length &&
    proof.winningSteps > 0 && proof.winningSteps <= deal.initial.movesLeft &&
    proof.lateLossPaths.every(hash => /^[a-f0-9]{64}$/.test(hash)) && new Set(proof.lateLossPaths).size >= 2);
  if (!candidate) return base;

  stats.selected++; stats.issued++;
  stats.last = { attemptId, dealId: candidate.deal.id, dealVersion: candidate.deal.version, policyVersion: policy.version, lost: false, completed: false };
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
