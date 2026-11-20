import { applyBoard, legalCommands, sameBoardCommand } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal, DifficultyTier } from '../../src/domain/types';

export type PlayerSegment = 'NonPayer' | 'Payer' | 'PotentialPayer' | 'SleepPayer' | 'unknown';

export function eligibleForEquality(input: { level: number; seed: number; issued: number; segment: PlayerSegment }, config: {
  enabled: boolean; minLevel: number; limit: number; segments: readonly PlayerSegment[];
}) {
  return config.enabled && Number.isSafeInteger(input.seed) && input.seed > 0 && input.seed <= 2147483647 &&
    Number.isSafeInteger(input.level) && input.level >= config.minLevel &&
    Number.isSafeInteger(input.issued) && input.issued >= 0 && input.issued < config.limit &&
    config.segments.includes(input.segment);
}

export function easyDealTarget(input: {
  level: number; random: boolean; stable: boolean; previousLosses: number; difficulty: DifficultyTier; special: boolean;
}, config: {
  enabled: boolean; minLevel: number;
  byDifficulty: Partial<Record<DifficultyTier, { lossThreshold: number; targetSteps: number }>>;
}) {
  // Product configuration supplies explicit validated targets. The native
  // paywall-specific decCoef and counter policy still require source evidence.
  if (!config.enabled || input.level < config.minLevel || !input.random || !input.stable || input.special) return;
  const setting = config.byDifficulty[input.difficulty];
  if (!setting || !Number.isSafeInteger(setting.lossThreshold) || setting.lossThreshold < 1 ||
    !Number.isSafeInteger(setting.targetSteps) || setting.targetSteps < 1) return;
  if (!Number.isSafeInteger(input.previousLosses) || input.previousLosses < 0 || input.previousLosses + 1 < setting.lossThreshold) return;
  return setting.targetSteps;
}

export interface SimulationPolicy {
  id: string;
  choose(board: Board, legal: BoardCommand[], deal: Deal): BoardCommand | undefined;
}
type PolicyRun = { policyId: string; status: 'WON' | 'LOST' | 'UNKNOWN'; steps: number };

function simulate(deal: Deal, policy: SimulationPolicy): PolicyRun {
  let board = structuredClone(deal.initial);
  let steps = 0;
  const result = (status: PolicyRun['status']): PolicyRun => ({ policyId: policy.id, status, steps });
  while (board.phase === 'playing') {
    const commands = legalCommands(board, deal);
    if (!commands.length) return result('LOST');
    const action = policy.choose(board, commands, deal);
    const command = action && commands.find(candidate => sameBoardCommand(candidate, action));
    if (!command) return result('UNKNOWN');
    const next = applyBoard(board, command, deal);
    if (typeof next === 'string') return result('UNKNOWN');
    board = next.board;
    steps++;
  }
  return result(board.phase === 'won' ? 'WON' : 'LOST');
}

/** Offline late non-win predicate; each policy starts from the same prepared deal. */
export function selectEquality(candidates: Iterable<Deal>, policies: readonly SimulationPolicy[]) {
  if (!policies.length || new Set(policies.map(policy => policy.id)).size !== policies.length)
    throw Error('Equality requires distinct configured policies');
  let attempts = 0;
  for (const deal of candidates) {
    attempts++;
    const limit = deal.initial.movesLeft;
    if (limit !== null && Number.isInteger(limit) && limit > 0 && limit <= 2147483647 && deal.initial.phase === 'playing') {
      const runs: PolicyRun[] = [];
      for (const policy of policies) {
        const run = simulate(deal, policy);
        runs.push(run);
        if (run.status !== 'LOST' || run.steps * 5 < limit * 4) break;
        if (runs.length === policies.length) return { deal, attempts, runs };
      }
    }
    if (attempts === 100) break;
  }
  return { attempts };
}
