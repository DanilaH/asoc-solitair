import { applyBoard, legalCommands, sameBoardCommand } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

export type PlayerSegment = 'NonPayer' | 'Payer' | 'PotentialPayer' | 'SleepPayer' | 'unknown';

export function eligibleForEquality(input: { level: number; seed: number; issued: number; segment: PlayerSegment }, config: {
  enabled: boolean; minLevel: number; limit: number; segments: readonly PlayerSegment[];
}) {
  return config.enabled && Number.isSafeInteger(input.seed) && input.seed > 0 && input.seed <= 2147483647 &&
    Number.isSafeInteger(input.level) && input.level >= config.minLevel &&
    Number.isSafeInteger(input.issued) && input.issued >= 0 && input.issued < config.limit &&
    config.segments.includes(input.segment);
}

export interface SimulationPolicy {
  id: string;
  choose(board: Board, legal: BoardCommand[], deal: Deal): BoardCommand | undefined;
}
type PolicyRun = { policyId: string; status: 'WON' | 'LOST' | 'UNKNOWN'; steps: number; path: BoardCommand[] };

function simulate(deal: Deal, policy: SimulationPolicy): PolicyRun {
  let board = structuredClone(deal.initial);
  const path: BoardCommand[] = [];
  const result = (status: PolicyRun['status']): PolicyRun => ({ policyId: policy.id, status, steps: path.length, path });
  while (board.phase === 'playing') {
    const commands = legalCommands(board, deal);
    if (!commands.length) return result('LOST');
    const action = policy.choose(board, commands, deal);
    const command = action && commands.find(candidate => sameBoardCommand(candidate, action));
    if (!command) return result('UNKNOWN');
    const next = applyBoard(board, command, deal);
    if (typeof next === 'string') return result('UNKNOWN');
    board = next.board;
    path.push(command);
  }
  return result(board.phase === 'won' ? 'WON' : 'LOST');
}

/** Offline late non-win predicate; each policy starts from the same prepared deal. */
export function selectEquality(candidates: Iterable<Deal>, policies: readonly SimulationPolicy[], options?: {
  distinctPaths?: boolean; onTrial?: (runs: readonly PolicyRun[]) => void;
}) {
  if (!policies.length || new Set(policies.map(policy => policy.id)).size !== policies.length)
    throw Error('Equality requires distinct configured policies');
  let attempts = 0;
  for (const deal of candidates) {
    attempts++;
    const limit = deal.initial.movesLeft;
    const runs: PolicyRun[] = [];
    let accepted = false;
    if (limit !== null && Number.isInteger(limit) && limit > 0 && limit <= 2147483647 && deal.initial.phase === 'playing') {
      for (const policy of policies) {
        const run = simulate(deal, policy);
        runs.push(run);
        if (run.status !== 'LOST' || run.steps * 5 < limit * 4) break;
        accepted = runs.length === policies.length;
      }
    }
    options?.onTrial?.(runs);
    if (accepted && (!options?.distinctPaths ||
      (runs.length >= 2 && new Set(runs.map(run => JSON.stringify(run.path))).size === runs.length))) return { deal, attempts, runs };
    if (attempts === 100) break;
  }
  return { attempts };
}
