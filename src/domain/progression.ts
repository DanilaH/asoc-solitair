import type { Deal, Save } from './types';
export const CAMPAIGN_LENGTH = 80;
export const HELPER_UNLOCK = { hint: 3, undo: 4, joker: 21 } as const;
export const campaignId = (level: number) => `campaign-${String(level).padStart(3, '0')}`;
export function completedLevels(save: Save): number {
  const ids = save.platform?.completedCampaign ?? [];
  let count = 0;
  while (count < CAMPAIGN_LENGTH && ids.includes(campaignId(count + 1))) count++;
  return count;
}
export const unlockedLevel = (save: Save) => Math.min(CAMPAIGN_LENGTH, completedLevels(save) + 1);
export function helperUnlocked(save: Save, helper: 'hint' | 'undo' | 'joker', deal?: Deal): boolean {
  return (!deal?.daily && deal?.campaignLevel === undefined) || unlockedLevel(save) >= HELPER_UNLOCK[helper];
}
export function seenTutorial(save: Save, id: string): boolean { return save.campaign?.tutorials.includes(id) ?? false; }
export function markTutorial(save: Save, id: string): void {
  const campaign = save.campaign ??= { version: 1, tutorials: [] };
  if (!campaign.tutorials.includes(id)) campaign.tutorials.push(id);
}
export const freeHintDemo = (save: Save, deal: Deal) => deal.campaignLevel === 3 && !seenTutorial(save, 'hint-demo');
