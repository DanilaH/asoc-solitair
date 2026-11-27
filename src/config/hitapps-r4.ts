import { releaseProfile } from './profile';

export const hitappsR4Difficulty = { revision: 'hitapps-balance-v1', easy: {
  revision: 'source-easy-v1', enabled: true, minLevel: 16,
  byDifficulty: { normal: { lossThreshold: 3, decCoef: 8 }, hard: { lossThreshold: 3, decCoef: 12 },
    superhard: { lossThreshold: 3, decCoef: 16 } },
} } as const;

export const HITAPPS_RULES4_CAMPAIGN = releaseProfile?.campaignBoardRulesVersion === 4;
export const HITAPPS_FIXTURE_UI = import.meta.env?.VITE_HITAPPS_FIXTURES === '1';

export const campaignCorePolicy = 'campaign-core-stage1-v1';
export const CAMPAIGN_CORE_STAGE1 = releaseProfile?.policies.campaignCore === campaignCorePolicy &&
  import.meta.env?.VITE_ASOC_ARCHIVE_227 !== '1';
export const campaignCoreDealId = (id: string) => /-core-stage1-v1(?:-m1)?$/.test(id);
