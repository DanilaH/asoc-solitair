import { releaseProfile } from './profile';

export type CampaignPlaytest = 'azur21-v1' | 'hybrid21-v1';
const requested = import.meta.env?.VITE_ASOC_CAMPAIGN_PLAYTEST;
export const campaignPlaytest: CampaignPlaytest | undefined = releaseProfile &&
  (requested === 'azur21-v1' || requested === 'hybrid21-v1') ? requested : undefined;
export const playtestReserve: 15 | 25 = import.meta.env?.VITE_ASOC_PLAYTEST_RESERVE === '15' ? 15 : 25;
export const playtestLabel = campaignPlaytest === 'azur21-v1' ? 'Плейтест A · AZUR' : 'Плейтест B · гибрид';
export const playtestChapter = { version: 'campaign-playtest246-v1', first: 81, last: 101 } as const;
