import { expect, it } from 'vitest';
import { updateSourceDifficultySlot as update } from '../../tools/content/source-difficulty-slot';

it('writes native-static ExtraSteps and Restart before a win and advances only on win', () => {
  const extra = update(undefined, 'ContinueRequested');
  expect(extra).toEqual({ slot: { outcome: 'ExtraSteps', restarts: 0 }, advance: false });
  const restart = update(extra.slot, 'RestartedLevelBegin');
  expect(restart).toEqual({ slot: { outcome: 'Restart', restarts: 1 }, advance: false });
  expect(update(restart.slot, 'ContinueRequested')).toEqual(restart);
  const twice = update(restart.slot, 'RestartedLevelBegin');
  expect(update(twice.slot, 'LevelWon')).toEqual({ slot: { outcome: 'Restart', restarts: 2 }, advance: true });
  expect(update(extra.slot, 'LevelWon')).toEqual({ ...extra, advance: true });
  expect(update(undefined, 'LevelWon')).toEqual({ slot: { outcome: 'Clean', restarts: 0 }, advance: true });
  expect(update({ outcome: 'Clean', restarts: 0 }, 'ContinueRequested')).toEqual(extra);
});
