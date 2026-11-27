import { DAILY_CALENDAR, EXTENDED_CHAPTER } from '../config/campaign-meta';
import type { Deal } from '../domain/types';
import { bindHitappsBank } from './hitapps-r4-bank';
import { unpackMetaDeal, type PackedMetaDeal } from './campaign-meta-pack';
import { dailyRecipes, extendedRecipes, metaTemplate } from './campaign-meta-recipes';

import { campaignShards, dailyShards } from './campaign-meta-bank/index';

function bankReader(shards: readonly string[], bank: 'campaign' | 'daily', shardSize: number) {
  let cachedStart = -1;
  let rows: PackedMetaDeal[][] = [];
  return (index: number): readonly PackedMetaDeal[] => {
    const start = Math.floor(index / shardSize) * shardSize;
    if (start !== cachedStart) {
      const shard = shards[start / shardSize];
      if (!shard) throw Error(`Missing certified ${bank} shard ${start}`);
      rows = JSON.parse(shard) as PackedMetaDeal[][];
      cachedStart = start;
    }
    return rows[index - start];
  };
}

const forLevel = bankReader(campaignShards, 'campaign', 8);
const forDay = bankReader(dailyShards, 'daily', 20);

export const extendedCampaign: readonly Deal[] = extendedRecipes.map((recipe, index) => {
  const level = EXTENDED_CHAPTER.first + index;
  const template = metaTemplate(recipe, `campaign-meta-source-${level}`, level);
  const theme = Object.values(template.cards).find(card => card.leader)!;
  return { ...template, title: theme.text };
});

export function extendedRecords(level: number) {
  const index = level - EXTENDED_CHAPTER.first;
  const template = extendedCampaign[index];
  return !template ? [] : forLevel(index).map(row => {
    const record = unpackMetaDeal(row, template);
    return { ...record, deal: { ...record.deal, title: template.title } };
  });
}

export function calendarLayout(index: number, dayId: string): Deal {
  const recipe = dailyRecipes[index];
  const rows = forDay(index);
  if (!recipe || !rows || rows.length !== 1) throw Error(`Missing Daily certificate ${index}`);
  const id = `meta-daily-source-${index + 1}`;
  const template = metaTemplate(recipe, id, 1001 + index);
  const row = unpackMetaDeal(rows[0], template);
  const { campaignLevel, ...deal } = bindHitappsBank(new Map([[id, template]]), [row]).values().next().value!.deal;
  return { ...deal, id: `daily-v${DAILY_CALENDAR.version}-${dayId}`, title: 'Задание дня',
    daily: { dayId, contentVersion: DAILY_CALENDAR.version, poolId: deal.id }, tags: ['daily'] };
}
