import { expect, it } from 'vitest';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { beginDeal } from '../../src/domain/campaign';
import { dispatch } from '../../src/domain/engine';
import { buyRandomJokerAccess, randomJokerCount, randomJokerReady, settleRandomJoker } from '../../src/domain/random-joker';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import { randomJokerFixture } from '../fixtures/owner-random-joker';
import { CONTENT_VERSION } from '../../src/domain/types';

const extraHelpers = { version: 1, randomJokerCoins: 250, unlimitedCoins: 120, unlimitedMs: 60_000 } as const;
function fixture() {
  const value = randomJokerFixture();
  const deal = { ...value.deal, id: 'mvp-durable-random-joker', extraHelpers };
  value.save.attempt.dealId = deal.id;
  value.save.contentVersion = CONTENT_VERSION;
  value.save.profile.coins = 500;
  return { ...value, deal, lookup: (id: string) => id === deal.id ? deal : findDeal(id) };
}
const receipt = { version: 1, id: 'legacy-coins', source: 'coins', cost: 250, issuedAt: 100 } as const;

it.each(['active', 'parked'] as const)('migrates an unused %s legacy right once, including an already imported identity', mode => {
  const { save, deal, lookup } = fixture();
  save.profile.coins -= receipt.cost;
  save.attempt.randomJokerAccess = { ...receipt };
  const campaign = structuredClone(save.attempt), profile = structuredClone(save.profile);
  if (mode === 'parked') switchMode(save, 'daily', dailyForDay('2026-11-24'), 'daily-migrate');
  const loaded = decodeSave(JSON.stringify(save), lookup);
  expect(loaded.randomJokers?.grants).toEqual([receipt]);
  expect(randomJokerCount(loaded)).toBe(1);
  expect(loaded.profile).toEqual(profile);
  const migratedAttempt = mode === 'active' ? loaded.attempt : loaded.parked!.campaign!;
  expect(migratedAttempt.randomJokerAccess).toBeUndefined();
  expect({ ...migratedAttempt, randomJokerAccess: receipt }).toEqual(campaign);
  expect(decodeSave(JSON.stringify(loaded), lookup)).toEqual(loaded);
  migratedAttempt.randomJokerAccess = { ...receipt };
  const repeated = decodeSave(JSON.stringify(loaded), lookup);
  expect(repeated.randomJokers?.grants).toEqual([receipt]);
  if (mode === 'parked') switchMode(repeated, 'campaign', deal, 'return-migrate');
  expect(randomJokerReady(repeated, deal)).toBe(true);
});

it('preserves a paid unused charge across fixed restart, another level, Daily, reload and a new compatible L16 attempt', () => {
  let { save, deal, lookup, path, column } = fixture();
  const manual = save.profile.jokers;
  expect(buyRandomJokerAccess(save, deal, 'durable-purchase', 100)).toBe(true);
  expect(save.attempt.randomJokerAccess).toBeUndefined();
  expect(save.randomJokers?.grants[0]).toMatchObject({ id: 'durable-purchase', cost: 250, source: 'coins' });
  save = dispatch(save, { type: 'restart', attemptId: 'same-deal-retry' }, deal).next;
  expect(randomJokerCount(save)).toBe(1);
  const incompatible = campaignDeals[0];
  beginDeal(save, incompatible, 'another-level', deal);
  expect(randomJokerReady(save, incompatible)).toBe(false);
  switchMode(save, 'daily', dailyForDay('2026-11-24'), 'daily-roundtrip');
  save = decodeSave(JSON.stringify(save), lookup);
  expect(randomJokerCount(save)).toBe(1);
  switchMode(save, 'campaign', incompatible, 'return-campaign');
  beginDeal(save, deal, 'new-compatible-l16', incompatible);
  expect(randomJokerReady(save, deal)).toBe(true);
  expect(buyRandomJokerAccess(save, deal, 'duplicate-buy', 101)).toBe(false);
  // A valid reachable contract fixture isolates the durable right from search performance.
  save.attempt.board = structuredClone(fixture().save.attempt.board);
  const quote = { attemptId: save.attempt.id, revision: save.revision, column, id: 'azj-durable' };
  const before = structuredClone(save);
  expect(settleRandomJoker(save, deal, { ...quote, path: [] })).toBe(false);
  expect(settleRandomJoker(save, deal, { ...quote, attemptId: 'stale-attempt', path })).toBe(false);
  expect(save).toEqual(before);
  expect(settleRandomJoker(save, deal, { ...quote, path })).toBe(true);
  expect(randomJokerCount(save)).toBe(0);
  expect(save.attempt.randomJokerAccess).toMatchObject({ id: 'durable-purchase', consumed: true });
  expect(save.profile).toEqual(before.profile);
  expect(save.profile.jokers).toBe(manual);
  expect(save.attempt.undo).toEqual([]);
  save = decodeSave(JSON.stringify(save), lookup);
  save = dispatch(save, { type: 'restart', attemptId: 'after-consumption' }, deal).next;
  expect(randomJokerCount(save)).toBe(0);
  expect(randomJokerReady(save, deal)).toBe(false);
});

it('never revives a consumed identity, preserves historical cost and rejects conflicting provenance', () => {
  const { save, deal, lookup, path, column } = fixture();
  save.attempt.randomJokerAccess = { ...receipt };
  save.randomJokers = { version: 1, grants: [{ ...receipt, consumed: true }] };
  expect(randomJokerCount(decodeSave(JSON.stringify(save), lookup))).toBe(0);
  save.randomJokers.grants[0].issuedAt++;
  expect(() => decodeSave(JSON.stringify(save), lookup)).toThrow('Противоречивое');
  delete save.randomJokers;
  expect(settleRandomJoker(save, deal, { attemptId: save.attempt.id, revision: save.revision, column, id: 'azj-legacy-used', path })).toBe(true);
  delete save.randomJokers;
  const consumed = decodeSave(JSON.stringify(save), lookup);
  expect(consumed.randomJokers?.grants).toEqual([{ ...receipt, consumed: true }]);
  expect(randomJokerCount(consumed)).toBe(0);
  // The receipt records what was paid, even if a future compatible price changes.
  const repriced = { ...deal, extraHelpers: { ...extraHelpers, randomJokerCoins: 300 } };
  expect(decodeSave(JSON.stringify(consumed), repriced).randomJokers?.grants[0].cost).toBe(250);
});

it('migrates before a direct legacy restart and never invents rights for a save that has already lost them', () => {
  const { save, deal, lookup } = fixture();
  expect(decodeSave(JSON.stringify(save), lookup).randomJokers).toBeUndefined();
  save.attempt.randomJokerAccess = { ...receipt };
  const retry = dispatch(save, { type: 'restart', attemptId: 'legacy-direct-restart' }, deal);
  expect(retry.accepted).toBe(true);
  expect(randomJokerCount(retry.next)).toBe(1);
  expect(retry.next.randomJokers?.grants).toEqual([receipt]);
});

it('settles purchase and proof consumption through failed writes, ambiguous commits and double taps without losing a right', async () => {
  const { save, deal, lookup, path, column } = fixture();
  let raw: string | null = JSON.stringify(save), mode: 'ok' | 'fail' | 'ambiguous' = 'ok';
  const disk = { getItem: async () => raw, setItem: async (_key: string, value: string) => {
    if (mode === 'fail') throw Error('disk full');
    raw = value;
    if (mode === 'ambiguous') throw Error('response lost');
  }, removeItem: async () => undefined };
  const store = new SaveStore(disk, lookup, () => save);
  await store.open();
  const buy = () => store.mutate(next => buyRandomJokerAccess(next, deal, 'atomic-coins', 100));
  mode = 'fail';
  await expect(buy()).rejects.toThrow();
  expect(store.state.profile.coins).toBe(500);
  expect(randomJokerCount(store.state)).toBe(0);
  mode = 'ambiguous';
  expect(await Promise.all([buy(), buy()])).toEqual([true, false]);
  expect(store.state.profile.coins).toBe(250);
  expect(randomJokerCount(store.state)).toBe(1);
  const request = { attemptId: store.state.attempt.id, revision: store.state.revision, column, id: 'azj-atomic', path };
  const use = () => store.mutate(next => settleRandomJoker(next, deal, request));
  mode = 'fail';
  await expect(use()).rejects.toThrow();
  expect(randomJokerCount(store.state)).toBe(1);
  expect(store.state.attempt.randomJokerUsed).toBeUndefined();
  mode = 'ambiguous';
  expect(await Promise.all([use(), use()])).toEqual([true, false]);
  expect(randomJokerCount(store.state)).toBe(0);
  mode = 'ok';
  const reopened = new SaveStore(disk, lookup, () => save);
  await reopened.open();
  expect(reopened.state).toEqual(store.state);
  expect(randomJokerCount(reopened.state)).toBe(0);
});
