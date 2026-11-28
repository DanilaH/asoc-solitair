import { campaignPlaytest, playtestReserve, type CampaignPlaytest } from '../config/campaign-playtest';
import type { Deal } from '../domain/types';
import { bindCampaignCore } from './campaign-core-stage1';
import { unpackMetaDeal, type PackedMetaDeal } from './campaign-meta-pack';
import { playtestShards, playtestShardKeys } from './playtest246-bank';

export interface PlaytestSet {
  recipe: { key: string; level: number; groups: number; physical: number; slots: number; columns: number[];
    displayTier: number; topics: string[]; feature?: string; source: string };
  template: Deal;
  controls: Record<'15' | '25', PackedMetaDeal[]>;
}
const cache = new Map<string, ReturnType<typeof bindCampaignCore>>();
let shardIndex = -1, shard: Record<string, PlaytestSet> = {};
export function playtestSet(key: string): PlaytestSet | undefined {
  const index = playtestShardKeys.findIndex(keys=>keys.includes(key));
  if (index<0) return;
  if (index!==shardIndex) { shard = JSON.parse(playtestShards[index]); shardIndex=index; }
  return shard[key];
}
export function playtestKey(level: number, mode: CampaignPlaytest) {
  return `${mode==='hybrid21-v1' && (level-81)%7===6?'hybrid':'azur'}-${level}`;
}
/** Lazy, immutable admission. Every registered budget has its own independent certificate. */
export function playtestCore(level: number, mode=campaignPlaytest, reserve=playtestReserve) {
  if (!mode || level<81 || level>101) return;
  const key=playtestKey(level,mode), cacheKey=`${key}:${reserve}`;
  let result=cache.get(cacheKey);
  if (!result) {
    const data=playtestSet(key);
    if (!data || data.controls[String(reserve) as '15'|'25'].length!==3) throw Error('Missing certified playtest admission '+cacheKey);
    const records=data.controls[String(reserve) as '15'|'25'].map(row=>unpackMetaDeal(row,data.template));
    result=bindCampaignCore(new Map([[data.template.id,data.template]]),new Map(),records);
    cache.set(cacheKey,result);
    if (cache.size>4) cache.delete(cache.keys().next().value!);
  }
  return result;
}
export function playtestCoreById(id: string) {
  const match=/^campaign-ha4-(\d+)-.*-pt246-r(15|25)(?:-|$)/.exec(id);
  if (!match) return;
  const level=Number(match[1]), reserve=Number(match[2]) as 15|25;
  return playtestCore(level,'azur21-v1',reserve)?.byId.get(id) ?? playtestCore(level,'hybrid21-v1',reserve)?.byId.get(id);
}
