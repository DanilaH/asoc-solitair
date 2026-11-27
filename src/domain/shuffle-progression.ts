import { CAMPAIGN_CORE_STAGE1 } from '../config/hitapps-r4';
import config from '../config/c8-release.json' with { type: 'json' };
import { CAMPAIGN_LENGTH, campaignId, completedLevels, dailyTasksAvailable, unlockedLevel } from './progression';
import { grantEventPrize } from './events/daily-tasks';
import type { Save } from './types';

export const SHUFFLE_LEVELS: readonly number[] = config.policies.chargedShuffleLevels;
export const SHUFFLE_INTRO_KEY = `helper-intro:${config.policies.shuffleProgression}`;

/** The grant shares the existing inventory and reward identity, never a second wallet. */
export function grantShuffleIntro(save: Save): boolean {
  const unlocked = CAMPAIGN_CORE_STAGE1 ? dailyTasksAvailable(save) : unlockedLevel(save) >= SHUFFLE_LEVELS[0];
  if (!unlocked || save.profile.rewards.includes(SHUFFLE_INTRO_KEY) ||
      !grantEventPrize(save, { kind: 'Shuffle', quantity: 1 })) return false;
  save.profile.rewards.push(SHUFFLE_INTRO_KEY);
  save.revision++;
  return true;
}

/** Only new prize selection uses this; frozen rounds and existing inventory are retained. */
export function hasFutureShuffleUse(save: Save): boolean {
  if (CAMPAIGN_CORE_STAGE1) return completedLevels(save) < CAMPAIGN_LENGTH;
  return unlockedLevel(save) >= SHUFFLE_LEVELS[0] &&
    SHUFFLE_LEVELS.some(level => !save.platform?.completedCampaign.includes(campaignId(level)));
}
