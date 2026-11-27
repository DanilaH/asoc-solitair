import { CAMPAIGN_CORE_STAGE1 } from '../config/hitapps-r4';
import beyondBank from '../content/campaign-v8-beyond-bank.json' with { type: 'json' };
import { CONTENT8_PREVIEW, type Deal, type Save } from './types';
export const BEYOND80_PREVIEW = CONTENT8_PREVIEW && import.meta.env?.VITE_CONTENT8_BEYOND80 === '1';
export const CAMPAIGN_LENGTH = 80 + (BEYOND80_PREVIEW ? beyondBank.length : 0);
export const HELPER_UNLOCK = { hint: 3, undo: 4, joker: 8 } as const;
export const campaignId = (level: number) => `campaign-${String(level).padStart(3, '0')}`;
export function completedLevels(save: Save): number {
  const ids = save.platform?.completedCampaign ?? [];
  let count = 0;
  while (count < CAMPAIGN_LENGTH && ids.includes(campaignId(count + 1))) count++;
  return count;
}
export const unlockedLevel = (save: Save) => Math.min(CAMPAIGN_LENGTH, completedLevels(save) + 1);
export function helperUnlocked(save: Save, helper: 'hint' | 'undo' | 'joker', deal?: Deal): boolean {
  if (CAMPAIGN_CORE_STAGE1 && !deal?.daily && (deal?.campaignLevel ?? 0) > 1) return true;
  return (!deal?.daily && deal?.campaignLevel === undefined) || unlockedLevel(save) >= HELPER_UNLOCK[helper];
}
export function seenTutorial(save: Save, id: string): boolean { return save.campaign?.tutorials.includes(id) ?? false; }
export function markTutorial(save: Save, id: string): void {
  const campaign = save.campaign ??= { version: 1, tutorials: [] };
  if (!campaign.tutorials.includes(id)) campaign.tutorials.push(id);
}
export function needsOpeningLesson(save: Save, deal: Deal, lesson: Deal['training'], marker: string): boolean {
  return deal.training === lesson && save.attempt.board.phase === 'playing' &&
    completedLevels(save) < (deal.campaignLevel ?? 0) && !seenTutorial(save, marker);
}
export const freeHintDemo = (save: Save, deal: Deal) => deal.campaignLevel === 3 &&
  (!seenTutorial(save, 'hint-demo') || needsOpeningLesson(save, deal, 'hint', 'hint-practiced'));
export const freeUndoPractice = (save: Save, deal: Deal) => save.profile.undos === 0 && needsOpeningLesson(save, deal, 'undo', 'undo-used');
export const freeJokerPractice = (save: Save, deal: Deal) => save.profile.jokers === 0 && needsOpeningLesson(save, deal, 'joker', 'joker-buffer');

export const RELEASE_UNLOCK = { bonus: 2, combo: 5, foundation: 6, daily: 6, tasks: 7, tableau: 12, recovery: 16 } as const;
export function dailyModeAvailable(save: Save) {
  const threshold = save.unlockSchedule?.legacyDaily || !save.unlockSchedule ? 3 : RELEASE_UNLOCK.daily;
  return completedLevels(save) >= threshold - 1 || Boolean(save.attempt.daily || save.parked?.daily || save.meta?.dailyDates.length);
}
export function dailyTasksAvailable(save: Save) {
  const threshold = save.unlockSchedule?.legacyTasks || !save.unlockSchedule ? 2 : RELEASE_UNLOCK.tasks;
  return completedLevels(save) >= threshold - 1 || Boolean(save.dailyTasks);
}
