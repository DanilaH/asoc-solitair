import type { CampaignOutcome } from '../../src/domain/types';

type SourceProgressEvent = 'ContinueRequested' | 'RestartedLevelBegin' | 'LevelWon';

/** Native-static transition of the current slot. Original timing/config remains device evidence. */
export function updateSourceDifficultySlot(slot: CampaignOutcome | undefined, event: SourceProgressEvent) {
  if (event === 'RestartedLevelBegin') return {
    slot: { outcome: 'Restart', restarts: (slot?.restarts ?? 0) + 1 } satisfies CampaignOutcome, advance: false,
  };
  if (event === 'ContinueRequested') return {
    slot: slot?.outcome === 'Restart' ? slot : { outcome: 'ExtraSteps', restarts: 0 } satisfies CampaignOutcome,
    advance: false,
  };
  return { slot: slot ?? { outcome: 'Clean', restarts: 0 } satisfies CampaignOutcome, advance: true };
}
