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
  version?: number;
  start?(deal: Deal): SimulationPolicy['choose'];
  detectCycles?: true;
  choose(board: Board, legal: BoardCommand[], deal: Deal): BoardCommand | undefined;
}
export type LossReason = 'budget' | 'no-legal-action' | 'repeated-position';
export type PolicyRun = {
  policyId: string; status: 'WON' | 'LOST' | 'UNKNOWN'; steps: number; path: BoardCommand[];
  lossReason?: LossReason;
};

export function simulationPosition(board: Board) {
  const { movesLeft: _budget, retainedMoves: _retained, ...position } = board;
  return JSON.stringify({ ...position, faceUp: [...position.faceUp].sort() });
}

export function isLateLoss(run: Pick<PolicyRun, 'status' | 'steps'>, limit: number): boolean {
  return run.status === 'LOST' && Math.fround(run.steps) >= Math.fround(Math.fround(limit) * Math.fround(0.8));
}


export function simulatePolicy(deal: Deal, policy: SimulationPolicy): PolicyRun {
  let board = structuredClone(deal.initial);
  const path: BoardCommand[] = [];
  let spent = 0;
  const choose = policy.start?.(deal) ?? policy.choose;
  const seen = new Set<string>();
  const result = (status: PolicyRun['status'], lossReason?: LossReason): PolicyRun => ({
    policyId: policy.id, status, steps: spent, path, ...(lossReason ? { lossReason } : {}),
  });
  while (board.phase === 'playing') {
    if (policy.detectCycles) {
      const key = simulationPosition(board);
      if (seen.has(key)) return result('LOST', 'repeated-position');
      seen.add(key);
    }
    const commands = legalCommands(board, deal);
    if (!commands.length) return result('LOST', 'no-legal-action');
    const action = choose(board, commands, deal);
    const command = action && commands.find(candidate => sameBoardCommand(candidate, action));
    if (!command) return result('UNKNOWN');
    const next = applyBoard(board, command, deal);
    if (typeof next === 'string') return result('UNKNOWN');
    board = next.board;
    spent += next.consumedMoves ?? 1;
    path.push(command);
  }
  return board.phase === 'won' ? result('WON') : result('LOST', 'budget');
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
        const run = simulatePolicy(deal, policy);
        runs.push(run);
        if (!isLateLoss(run, limit)) break;
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
