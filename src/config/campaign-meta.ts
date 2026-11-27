import { E4_M1 } from './economy';

export const CAMPAIGN_META = E4_M1 && import.meta.env?.VITE_ASOC_ARCHIVE_230 !== '1';
export const EXTENDED_CHAPTER = { first: 81, count: 120, version: 1 } as const;
export const DAILY_CALENDAR = { first: '2026-11-28', count: 400, version: 2 } as const;
