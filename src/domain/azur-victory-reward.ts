import type { Deal } from './types';

export interface VictoryRewardConfig {
  readonly version: 1;
  readonly id: string;
  readonly sourceBuild: string;
  readonly provenance: 'SOURCE_COMPILED_DEFAULT' | 'PRODUCT_POLICY';
  readonly enabled: boolean;
  readonly coinsPerRemainingMove: number;
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
  readonly extreme: number;
  readonly fallback: number;
}

export const AZUR_VICTORY_DEFAULTS: VictoryRewardConfig = Object.freeze({
  version: 1,
  id: 'azur-1.3.3.8-244-compiled-v1',
  sourceBuild: 'com.solitaire.match.words 1.3.3.8/244',
  provenance: 'SOURCE_COMPILED_DEFAULT',
  enabled: true,
  coinsPerRemainingMove: 5,
  easy: 25,
  medium: 50,
  hard: 100,
  extreme: 200,
  fallback: 100,
});

export const AZUR_VICTORY_QA = import.meta.env?.VITE_AZUR_VICTORY_QA === '1';
export const AZUR_VICTORY_SAVE_KEY = `asoc-solitaire.qa.${AZUR_VICTORY_DEFAULTS.id}`;

const MAX_SOURCE_INT = 0x7fff_ffff;
function sourceAmount(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SOURCE_INT) {
    throw new RangeError('Amount outside the positive signed 32-bit reward range');
  }
  return value;
}

/** Local mapping from product deal metadata. Original live tier assignment is unknown. */
export function victoryDifficulty(deal: Deal): 0 | 1 | 2 | 3 | 4 {
  if (deal.campaignLevel === undefined || deal.daily) return 0;
  if (deal.difficultyTier === 'superhard') return 4;
  if (deal.difficultyTier === 'hard') return 3;
  return deal.training ? 1 : 2;
}

export function quoteVictoryReward(config: VictoryRewardConfig, difficulty: number, movesLeft: number | null) {
  const [fallback, easy, medium, hard, extreme, perMove] = [
    config.fallback, config.easy, config.medium, config.hard, config.extreme, config.coinsPerRemainingMove,
  ].map(sourceAmount);
  const remaining = sourceAmount(movesLeft ?? 0);
  const base = [fallback, easy, medium, hard, extreme][difficulty] ?? fallback;
  const bonus = config.enabled ? sourceAmount(remaining * perMove) : 0;
  return { base, bonus, total: sourceAmount(base + bonus) };
}
