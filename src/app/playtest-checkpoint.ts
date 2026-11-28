import { campaignPlaytest } from '../config/campaign-playtest';
import { campaignDeals, campaignIssuance, selectCampaignDeal } from '../content/campaign';
import { freshSave } from '../domain/engine';
import { campaignId } from '../domain/progression';
import { platformState } from '../domain/services';

/** New installations in separate test applications only. Existing saves bypass this factory. */
export function newPlaytestCheckpoint(attemptId: string) {
  if (!campaignPlaytest) return;
  const context=freshSave(campaignDeals[0],attemptId);
  // Canonical rights for the skipped prefix are closed, never paid or claimable again.
  platformState(context).completedCampaign=Array.from({length:80},(_,i)=>campaignId(i+1));
  const base=campaignDeals[80], selected=selectCampaignDeal(context,base);
  const save=freshSave(selected,attemptId);
  save.platform=context.platform;
  save.profile.rewards=Array.from({length:8},(_,i)=>`milestone:${(i+1)*10}`);
  save.attempt.issuance=campaignIssuance(save,base,selected);
  return save;
}
