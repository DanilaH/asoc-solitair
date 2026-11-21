import { expect, it } from 'vitest';
import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import { introDeal } from '../../src/content/intro';
import { dispatch, freshSave } from '../../src/domain/engine';
import { availableEvents, claimMilestone, eventDay, eventKey, observeEvents, recordEventWin,
  settledFirstWin, type EventDefinition } from '../../src/domain/events/ledger';
import { SaveStore } from '../../src/platform/storage';
import { recoverable } from '../fixtures/content8-loss';

const photo: EventDefinition = {
  id: 'one', version: 1, sourceFeatureId: 'hitapps-puzzle-event', minCampaignLevel: 16, daily: false,
  schedule: { clock: 'local', zone: 'Asia/Yekaterinburg', start: 100, end: 200 },
  milestones: [{ id: 'one', threshold: 1, reward: { coins: 20 } }, { id: 'two', threshold: 2, reward: { hints: 1 } }],
};
const race: EventDefinition = { ...photo, sourceFeatureId: 'hitapps-weekend-race', milestones: [{ id: 'one', threshold: 1, reward: { coins: 20 } }] };

function actualWin() {
  let previous = freshSave(recoverable, 'event-proof');
  for (const move of recoverable.winningPath.slice(0, -1)) previous = dispatch(previous, move, recoverable).next;
  const final = dispatch(previous, recoverable.winningPath.at(-1)!, recoverable).next;
  return { previous, final, win: settledFirstWin(previous, final, recoverable)! };
}

it('accepts a settled first victory once for each real event identity and never mints on open', () => {
  const { win, previous, final } = actualWin();
  expect(win).toEqual({ id: 'campaign:16', mode: 'campaign', campaignLevel: 16 });
  expect(settledFirstWin(final, final, recoverable)).toBeUndefined();
  expect(settledFirstWin(previous, final, introDeal)).toBeUndefined();
  const save = freshSave(introDeal, 'playing');
  observeEvents(save, [], { localMs: 150 });
  expect(save.events).toBeUndefined();
  observeEvents(save, [photo, race], { localMs: 150 });
  expect(availableEvents(save).map(event => event.ready)).toEqual([[], []]);
  expect(save.profile.coins).toBe(100);
  expect(recordEventWin(save, [photo, race], win, { localMs: 151 })).toBe(2);
  expect(recordEventWin(save, [photo, race], win, { localMs: 152 })).toBe(0);
  expect(availableEvents(save).map(event => event.progress)).toEqual([1, 1]);
  expect(claimMilestone(save, eventKey(photo), 'one')).toBe(true);
  expect(claimMilestone(save, eventKey(photo), 'one')).toBe(false);
  expect(claimMilestone(save, eventKey(race), 'one')).toBe(true);
  expect(save.profile.coins).toBe(140);
});

it('preserves clocks across expired schedules, handles local date changes and never uses local time for a server event', () => {
  const { win } = actualWin();
  const save = freshSave(introDeal, 'state');
  observeEvents(save, [photo], { localMs: 201 });
  expect(recordEventWin(save, [photo], win, { localMs: 170 })).toBe(0);
  expect(save.events?.events).toEqual([]);

  const server = { ...race, schedule: { ...race.schedule, clock: 'server' as const } };
  expect(recordEventWin(save, [server], win, { localMs: 215 })).toBe(0);
  expect(recordEventWin(save, [server], win, { localMs: 215, verifiedServerMs: 180 })).toBe(1);
  expect(eventDay('Asia/Yekaterinburg', Date.UTC(2026, 10, 21, 19))).toBe('2026-11-22');
  expect(eventDay('Europe/Berlin', Date.UTC(2026, 2, 29, 0, 59))).toBe(eventDay('Europe/Berlin', Date.UTC(2026, 2, 29, 1, 0)));
});

it('retains earned expired claims and spends each once through real storage after restart', async () => {
  const { win } = actualWin();
  let raw: string | null = null;
  const disk: StorageAdapter = { getItem: async () => raw, setItem: async (_key, json) => { raw = json; }, removeItem: async () => { raw = null; } };
  const open = async () => {
    const store = new SaveStore(disk, introDeal, () => freshSave(introDeal, 'legacy-attempt'));
    await store.open();
    return store;
  };
  const store = await open(), legacy = structuredClone(store.state.attempt);
  await store.mutate(next => recordEventWin(next, [photo], win, { localMs: 175 }));
  await store.mutate(next => observeEvents(next, [photo], { localMs: 201 }));
  expect(availableEvents(store.state)[0]).toMatchObject({ phase: 'expired', progress: 1 });
  const restored = await open();
  expect(await Promise.all([
    restored.mutate(next => claimMilestone(next, eventKey(photo), 'one')),
    restored.mutate(next => claimMilestone(next, eventKey(photo), 'one')),
  ])).toEqual([true, false]);
  expect(restored.state.profile.coins).toBe(120);
  expect(restored.state.attempt).toEqual(legacy);
  expect(claimMilestone(restored.state, eventKey(photo), 'two')).toBe(false);
  const newOccurrence = { ...photo, id: 'next', schedule: { ...photo.schedule, start: 300, end: 400 } };
  await restored.mutate(next => observeEvents(next, [newOccurrence], { localMs: 310 }));
  expect(availableEvents(restored.state).map(event => event.progress)).toEqual([1, 0]);
});
