import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { adjustedMoveBudget } from '../../src/domain/difficulty';
import { applyBoard, assertBoard } from '../../src/domain/engine';
import { equalityBoardBinding } from '../../src/domain/equality-attestation';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';
import { prepareFreshPlan, prepareSimulatedShuffle, resolveCandidateSeed } from './candidate-pipeline';
import { dealOrdinary, EmbeddedRandom } from './plain-dealer';

export function authoringHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Named handlers are explicit for every enabled feature. Unknown original configs remain outside the controlled run. */
type Appliers = NonNullable<Parameters<typeof prepareFreshPlan<Deal>>[1]>;
export type HitappsFeatureConfig = {
  revision: string;
  enabled: readonly (keyof Appliers)[];
  appliers?: Appliers;
};

export function validateHitappsFeatures(config: HitappsFeatureConfig): Appliers {
  const appliers = config.appliers ?? {};
  if (!config.revision || new Set(config.enabled).size !== config.enabled.length ||
      config.enabled.some(feature => typeof appliers[feature] !== 'function') ||
      Object.keys(appliers).some(feature => !config.enabled.includes(feature as keyof Appliers))) {
    throw Error('Hitapps feature gates do not match the implemented phases');
  }
  return appliers;
}

export const rulesSnapshot = equalityBoardBinding;

export function replayAuthoredRoute(deal: Deal, actions: readonly BoardCommand[], afterStep?: (board: Board) => void) {
  assertBoard(deal.initial, deal);
  let board = deal.initial;
  for (const [index, action] of actions.entries()) {
    const step = applyBoard(board, action, deal);
    const oracle = advance(board, action, deal);
    if (typeof step === 'string' || !oracle || !isDeepStrictEqual(step.board, oracle)) {
      throw Error(`Engine and oracle do not certify action ${index + 1} for ${deal.id}`);
    }
    board = oracle;
    afterStep?.(board);
  }
  return board;
}

export interface HitappsStructure {
  schema: 'hitapps-authoring-v1';
  provenance: 'PRODUCT_ADAPTED' | 'AUTHENTICATED_NUMERIC_INPUT';
  levelInputHash: string;
  layout: 'fixed' | 'random';
  cardOrder: readonly string[];
  stableMoves: boolean;
  levelPenalty: number;
}

export function hitappsInputHash(template: Deal, structure: Omit<HitappsStructure, 'levelInputHash'>) {
  return authoringHash({ id: template.id, version: template.version, level: template.campaignLevel, ...structure, ...rulesSnapshot(template) });
}

/** Binds the numeric input to the expected input digest before interpreting any seed. */
export function prepareHitappsInput(template: Deal, structure: HitappsStructure, dynamicPenalty: number, trustedInputHash?: string) {
  const { levelInputHash, ...input } = structure;
  if (input.provenance === 'AUTHENTICATED_NUMERIC_INPUT' && trustedInputHash !== levelInputHash) {
    throw Error('Authenticated numeric input requires an external digest pin');
  }
  const cardIds = Object.keys(template.cards);
  if (structure.schema !== 'hitapps-authoring-v1' || hitappsInputHash(template, input) !== levelInputHash ||
      cardIds.length !== input.cardOrder.length || new Set(input.cardOrder).size !== cardIds.length ||
      input.cardOrder.some(id => !Object.hasOwn(template.cards, id))) throw Error('Invalid Hitapps structural input');
  assertBoard(template.initial, template);
  const baseBudget = template.initial.movesLeft;
  if (baseBudget === null || baseBudget <= 0 || template.initial.phase !== 'playing') throw Error('Expected a fresh finite budget');
  if (![structure.levelPenalty, dynamicPenalty].every(value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647)) {
    throw Error('Expected signed Int32 penalties');
  }
  const penalty = structure.levelPenalty + dynamicPenalty;
  const effectiveBudget = adjustedMoveBudget(baseBudget, penalty, structure.stableMoves);
  if (effectiveBudget <= 0) throw Error('Adjusted budget must be positive');

  const fixed = { ...template, initial: { ...template.initial, movesLeft: effectiveBudget } };
  function deal(seed: number, rng = new EmbeddedRandom(seed)): Deal {
    if (input.layout === 'fixed') return structuredClone(fixed);
    const { initial, lock, frozen, bound, puzzle, starter, golden, training, daily, recovery } = template;
    if (lock || frozen || bound || puzzle || starter || golden || training || daily || recovery ||
        initial.waste.length || initial.collected.length || initial.foundations.some(pile => pile.length) ||
        initial.keys?.length || initial.joker || initial.recyclesLeft !== undefined || initial.retainedMoves !== undefined ||
        Object.values(template.cards).some(card => card.ordered || card.keyId)) {
      throw Error('Random authoring requires an unapplied ordinary template');
    }
    const { tableau, stock } = dealOrdinary(input.cardOrder, initial.stock.length, initial.tableau.map(pile => pile.length), rng);
    return { ...structuredClone(fixed), initial: { ...structuredClone(fixed.initial), tableau, stock,
      faceUp: tableau.flatMap(pile => pile.slice(-1)) }, winningPath: [], recoveryPaths: undefined, legacyWinningPath: undefined };
  }
  return { deal, layout: input.layout, levelInputHash, baseBudget, effectiveBudget, penalty };
}

/** Initial belongs to the fresh path. Simulated candidates start with Shuffle already seeded. */
export function prepareHitappsBoard(input: ReturnType<typeof prepareHitappsInput>, options: {
  mode: 'fresh' | 'simulated';
  seedRequest: number;
  drawSeed: (maxExclusive: number) => number;
  features: HitappsFeatureConfig;
}) {
  const appliers = validateHitappsFeatures(options.features);
  const seed = resolveCandidateSeed(options.seedRequest, options.drawSeed);
  const deal = input.deal(seed);
  const plan = options.mode === 'fresh' ? prepareFreshPlan(deal, appliers) : prepareSimulatedShuffle(deal, appliers);
  assertBoard(plan.snapshot.initial, plan.snapshot);
  return { ...plan, seed, requestedSeed: options.seedRequest, boardHash: authoringHash(rulesSnapshot(plan.snapshot)) };
}
