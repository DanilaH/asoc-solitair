export const hitappsR4Difficulty = { revision: 'hitapps-balance-v1', easy: {
  revision: 'source-easy-v1', enabled: true, minLevel: 16,
  byDifficulty: { normal: { lossThreshold: 3, decCoef: 8 }, hard: { lossThreshold: 3, decCoef: 12 },
    superhard: { lossThreshold: 3, decCoef: 16 } },
} } as const;

/** The owner can review this candidate without changing the existing C8 rollout. */
export const HITAPPS_SOURCE_QA = import.meta.env?.VITE_HITAPPS_SOURCE_QA === '1';
