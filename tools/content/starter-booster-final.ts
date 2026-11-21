import type { StarterBooster } from '../../src/domain/starter-boosters';

const UNITY_SEED_LIMIT = 2147483647;

/** The original Final branch draws once for the resolved selection. Stock placement remains unknown. */
export function traceStarterBoosterFinal(finalComplete: boolean, selected: readonly number[],
  range: (minInclusive: number, maxExclusive: number) => number) {
  if (!finalComplete) return { status: 'PRE_FINAL' } as const;
  const mapped = new Map<number, { booster: StarterBooster; sourceCardType: 5 | 6 }>([
    [3, { booster: 'magnet', sourceCardType: 5 }], [4, { booster: 'hammer', sourceCardType: 6 }],
  ]);
  const boosters = [...new Set(selected)].flatMap(id => {
    const entry = mapped.get(id);
    return entry ? [{ selectedId: id, ...entry }] : [];
  });
  if (!boosters.length) return { status: 'SKIPPED' } as const;
  const seed = range(0, UNITY_SEED_LIMIT);
  if (!Number.isInteger(seed) || seed < 0 || seed >= UNITY_SEED_LIMIT) throw Error('Unexpected Unity booster seed');
  return { status: 'CONDITIONAL_SOURCE_MODEL', seed, boosters, placement: 'ORIGINAL_STOCK_PLACEMENT_UNKNOWN' } as const;
}
