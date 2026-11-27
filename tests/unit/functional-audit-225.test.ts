import { expect, it, vi } from 'vitest';
import { findDeal, hitappsR4Deals } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { advance } from '../../tools/qa/gameplay-oracle';
import { serializeSave } from '../../src/platform/save-undo';
import captured from '../fixtures/functional-audit-225-legacy-hammer.json' with { type: 'json' };
import { releaseLevelAdEligible } from '../../src/domain/campaign-advertising';
import { applyBoard, assertBoard, dispatch, legalCommands, placeJoker } from '../../src/domain/engine';
import { acceptedTaskSignals, claimTask, recordTaskSignal, scheduleTasks, type TaskTarget } from '../../src/domain/events/daily-tasks';
import { applyFullscreenShown } from '../../src/domain/services';
import { createAds, type AdsBridge } from '../../src/platform/ads';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import { atSocket, hammerCases, heavyDeal, play, profileAt, puzzleCases } from '../fixtures/functional-audit-225';
import type { Board, Save } from '../../src/domain/types';

function memory(save: Save) {
  let raw: string | null = JSON.stringify(save);
  return {
    getItem: async () => raw, setItem: async (_key: string, data: string) => { raw = data; },
    removeItem: async () => { raw = null; },
  };
}
const unavailable = () => { throw Error('Expected an existing save'); };
const socketCases = [...hammerCases.flatMap(([id, prefix]) => [0, 1, 2].map(column => ({ id, prefix, column, fa: 'FA-01' }))),
  ...puzzleCases.map(([id, prefix, column]) => ({ id, prefix, column, fa: 'FA-03' }))];

it.each(socketCases)('$fa disallows crossing the Joker in $id column $column', async ({ id, prefix, column }) => {
  const { save, deal, action } = atSocket(id, prefix, column);
  const adapter = memory(save);
  const store = new SaveStore(adapter, findDeal, unavailable);
  const before = structuredClone(await store.open());
  const beforeRaw = await adapter.getItem();
  const commands = legalCommands(before.attempt.board, deal);
  const move = await store.mutate(next => {
    const result = dispatch(next, action, deal);
    if (result.accepted) Object.assign(next, result.next);
    return result;
  });
  const reopened = await new SaveStore(adapter, findDeal, unavailable).open().catch(error => String(error));
  expect({ accepted: move.accepted, inPreview: commands.some(command => JSON.stringify(command) === JSON.stringify(action)),
    unchanged: beforeRaw === await adapter.getItem(), reopened: typeof reopened === 'string' ? reopened : reopened.attempt.board.joker,
  }).toEqual({ accepted: false, inPreview: false, unchanged: true, reopened: before.attempt.board.joker });
  expect(applyBoard(store.state.attempt.board, action, deal)).toContain('Джокер');
  expect(advance(store.state.attempt.board, action, deal)).toBeNull();
});

it('FA-02 commits a late fullscreen fact after the original attempt changed', async () => {
  const deal = findDeal(hammerCases[0][0])!;
  const adapter = memory(profileAt(deal, 'old-attempt'));
  const store = new SaveStore(adapter, findDeal, unavailable);
  await store.open();
  const shownAt = 360_000;
  const shown = { schema: 1, id: 'native-shown-sale', attempt: 'old-attempt', dealId: deal.id, mode: 'campaign',
    placement: 'ads-break', kind: 'interstitial', shownAt } as const;
  let failed = false, pending = false, ack = 0, requests = 0;
  const bridge = {
    status: async () => ({ banner: false, interstitial: true, rewarded: true, mode: 'test' }),
    addListener: async () => ({ remove: async () => {} }), pending: async () => ({ receipts: [] }),
    pendingShown: async () => { if (failed) throw Error('read failed'); return { shown: pending ? shown : null }; },
    acknowledgeShown: async () => { pending = false; ack++; },
    show: async () => { requests++; failed = true; pending = true; return { shown: true as const, outcome: 'dismissed' as const }; },
    dispose: async () => {},
  } as unknown as AdsBridge;
  const options = { activity: { setBlocked() {}, isBlocked: () => false }, beforeShow: async () => {}, onStatus() {}, onEvent() {},
    commit: async () => 'already-applied' as const,
    commitShown: (notice: typeof shown) => store.mutate(next => applyFullscreenShown(next, notice, 32, deal)) };
  const ads = createAds({ ...options, commitShown: notice => options.commitShown(notice as typeof shown) }, bridge);
  try {
    await ads.refresh();
    await ads.recover();
    expect(await ads.show({ ...shown })).toMatchObject({ shown: true });
    await store.mutate(next => { next.attempt.id = 'new-attempt'; });
    await ads.recover();
    expect((await ads.show({ ...shown, attempt: 'new-attempt' })).shown).toBe(false);
    expect(requests).toBe(1);
    expect(ack).toBe(0);
    await ads.recover(); // Join the last failed read before the transport becomes available.
    failed = false;
    await ads.recover();
    const restored = await new SaveStore(adapter, findDeal, unavailable).open();
    expect({ ack, clock: restored.platform!.lastFullscreenAt, next: releaseLevelAdEligible(restored, 32, shownAt + 1000, 0),
      local: restored.attempt.adBreakShown ?? false }).toEqual({ ack: 1, clock: shownAt, next: false, local: false });
  } finally { ads.destroy(); }
});

const day = 86_400_000;
const taskDefinitions: TaskTarget[] = [
  { id: 'visit', kind: 'DailyLogin', target: 1, prize: { kind: 'Medals', quantity: 1 } },
  { id: 'moves', kind: 'ExecuteMoves', target: 4, prize: { kind: 'MoveHint', quantity: 1 } },
  { id: 'draw', kind: 'DrawCards', target: 1, prize: { kind: 'Coins', quantity: 10 } },
  { id: 'win', kind: 'CompleteLevels', target: 1, prize: { kind: 'Undo', quantity: 1 } },
];

it('FA-04 saves and restores 210 genuine Undo boards and 29,700 task signals below the native cap', async () => {
  const deal = findDeal(heavyDeal)!;
  let history = profileAt(deal);
  while (history.attempt.board.phase === 'playing') {
    const action = { type: history.attempt.board.stock.length ? 'draw' : 'recycle' } as const;
    const result = dispatch(history, action, deal);
    if (!result.accepted) throw Error(result.reason);
    history = result.next;
  }
  expect(history.attempt.undo).toHaveLength(210);
  const signals = [];
  for (let session = 0; signals.length < 297 && session < 2; session++) {
    let witness = profileAt(deal, `task-witness-${session}`);
    for (const action of deal.winningPath) {
      const result = dispatch(witness, action, deal);
      if (!result.accepted) throw Error(result.reason);
      signals.push(...acceptedTaskSignals(witness, result, action, deal));
      witness = result.next;
    }
  }
  expect(signals.length).toBeGreaterThanOrEqual(297);
  const at = Date.UTC(2026, 0, 1);
  for (let session = 0; session < 100; session++) {
    const date = at + Math.floor(session / 3) * day;
    scheduleTasks(history, date, taskDefinitions);
    for (const [i, signal] of signals.slice(0, 297).entries()) recordTaskSignal(history, date, {
      ...signal, id: `session-${session}:board-event-${i}:${signal.id}`,
    });
  }
  const adapter = memory(history);
  const write = adapter.setItem;
  adapter.setItem = async (key, raw) => {
    if (Buffer.byteLength(raw, 'utf8') > 4_194_304) throw Error(`Native limit: ${Buffer.byteLength(raw, 'utf8')} bytes`);
    await write(key, raw);
  };
  const store = new SaveStore(adapter, findDeal, unavailable);
  await store.open();
  const raw = (await adapter.getItem())!;
  console.info('FA-04 original workload', { bytes: Buffer.byteLength(raw), signals: history.dailyTasks?.seenSignals.length });
  expect(Buffer.byteLength(raw, 'utf8')).toBeLessThan(4_194_304);
  expect(decodeSave((await adapter.getItem())!, findDeal)).toEqual(store.state);
}, 30_000);


it.each(captured)('FA-01 recovers the exact old Hammer position in $id column $column', async ({ id, column, state, changes }) => {
  const prefix = hammerCases.find(row => row[0] === id)![1];
  const { deal, save } = atSocket(id, prefix, column);
  const before = save.attempt.board;
  const damaged = { ...before, ...changes,
    hitapps: { ...state, cards: { ...before.hitapps!.cards, ...state.cards } } } as Board;
  expect(() => assertBoard(damaged, deal)).toThrow('Некорректный Джокер');
  save.attempt.board = damaged;
  save.attempt.undo.push(before);
  const clean = structuredClone(damaged);
  delete clean.joker;
  for (const placement of ['active', 'parked', 'undo'] as const) {
    const payload = structuredClone(save);
    if (placement === 'parked') {
      const daily = dailyForDay('2026-11-27');
      payload.parked = { campaign: payload.attempt };
      payload.attempt = profileAt(daily, 'parked-joker-session').attempt;
    }
    if (placement === 'undo') {
      payload.attempt.undo.push(damaged);
      payload.attempt.board = clean;
    }
    const adapter = memory(payload), store = new SaveStore(adapter, findDeal, unavailable);
    const restored = await store.open();
    const attempt = placement === 'parked' ? restored.parked!.campaign! : restored.attempt;
    expect(attempt.board).toEqual(clean);
    expect(attempt.undo.at(-1)).toEqual(placement === 'undo' ? clean : before);
    expect(restored.profile).toEqual(payload.profile);
    expect(attempt.jokerUsed).toBe(true);
    expect(decodeSave((await adapter.getItem())!, findDeal)).toEqual(restored);
  }
  save.attempt.undo = [];
  const adapter = memory(save), original = await adapter.getItem();
  await expect(new SaveStore(adapter, findDeal, unavailable).open()).rejects.toThrow('Некорректный Джокер');
  expect(await adapter.getItem()).toBe(original);
});

it('FA-02 binds a delayed parked Daily display to its own attempt and preserves monotonic cooldown', () => {
  const deal = findDeal(hammerCases[0][0])!;
  const daily = dailyForDay('2026-11-27'), save = profileAt(deal, 'active-now');
  save.parked = { daily: profileAt(daily, 'parked-daily').attempt };
  save.platform!.winsSinceInterstitial = 4;
  const event = { schema: 1, id: 'parked-shown', attempt: 'parked-daily', dealId: daily.id, mode: 'daily',
    placement: 'ads-break', kind: 'interstitial', shownAt: 320_000 } as const;
  expect(applyFullscreenShown(save, event, undefined, daily)).toBe('applied');
  expect(save.campaignAds?.coffeeDisplays).toMatchObject([{ attemptId: 'parked-daily', count: 1 }]);
  expect(save.platform?.winsSinceInterstitial).toBe(4);
  expect(applyFullscreenShown(save, event, undefined, daily)).toBe('already-applied');
  expect(applyFullscreenShown(save, { ...event, id: 'out-of-order', shownAt: 319_999 }, undefined, daily)).toBe('already-applied');
  expect(save.platform?.lastFullscreenAt).toBe(320_000);
  expect(save.campaignAds?.coffeeDisplays?.[0].count).toBe(1);
});

it('FA-04 upgrades a multiyear save with both 300-frame Undo histories and retains unpaid claims', async () => {
  const deal = findDeal(heavyDeal)!, daily = dailyForDay('2026-11-27');
  const save = profileAt(deal, 'size-campaign'), parked = profileAt(daily, 'size-daily');
  // Scale the budget in the stress fixture so 301 legal stock transitions can
  // exercise the production 300-entry cap on both layouts.
  for (const [profile, source] of [[save, deal], [parked, daily]] as const) {
    let board = { ...profile.attempt.board, movesLeft: 320 };
    for (let move = 0; move < 301; move++) {
      const step = applyBoard(board, { type: board.stock.length ? 'draw' : 'recycle' }, source);
      if (typeof step === 'string') throw Error(step);
      profile.attempt.undo.push(board);
      board = { ...step.board, movesLeft: step.board.movesLeft! };
    }
    profile.attempt.undo.shift();
    profile.attempt.board = board;
  }
  save.parked = { daily: parked.attempt };
  const start = Date.UTC(2026, 0, 1);
  for (let index = 0; index < 1827; index++) {
    scheduleTasks(save, start + index * day, taskDefinitions);
    expect(recordTaskSignal(save, start + index * day, { id: 'visit', kind: 'DailyLogin', amount: 1, channel: 'login' })).toBe(true);
    recordTaskSignal(save, start + index * day, {
      id: `game:size-campaign:${index + 1}:ExecuteMoves`, kind: 'ExecuteMoves', amount: 1, channel: 'board',
    });
  }
  save.platform!.receipts.push('already-earned');
  save.dailyTasks!.seenSignals.push(...Array.from({ length: 29_700 }, (_, i) => `game:old-board:${2000 + i}:DrawCards`));
  delete save.dailyTasks!.signalHistoryVersion;
  delete save.dailyTasks!.retiredGameRevision;
  save.revision = 50_000;
  const adapter = memory(save), legacy = (await adapter.getItem())!;
  const write = adapter.setItem;
  adapter.setItem = async (key, raw) => {
    if (Buffer.byteLength(raw) > 4_194_304) throw Error('storage quota');
    await write(key, raw);
  };
  const store = new SaveStore(adapter, findDeal, unavailable);
  const openedAt = performance.now();
  const restored = await store.open();
  const openMs = Math.round(performance.now() - openedAt);
  expect(restored.attempt.undo).toEqual(save.attempt.undo);
  expect(restored.parked?.daily?.undo).toEqual(parked.attempt.undo);
  expect(restored.platform?.receipts).toEqual(['already-earned']);
  expect(restored.dailyTasks?.seenSignals).toEqual([]);
  expect(restored.dailyTasks?.weeks.flatMap(week => week.days)).toHaveLength(1827);
  const finalUtc = start + 1826 * day;
  const measureAt = performance.now();
  const raw = serializeSave(restored);
  const serializeMs = Math.round(performance.now() - measureAt);
  const writeAt = performance.now();
  expect(await store.mutate(next => claimTask(next, '2026-01-01', 'visit'))).toBe(true);
  const writeMs = Math.round(performance.now() - writeAt);
  expect(await store.mutate(next => claimTask(next, '2026-01-01', 'visit'))).toBe(false);
  expect(await store.mutate(next => recordTaskSignal(next, finalUtc, {
    id: 'game:old-board:2200:DrawCards', kind: 'DrawCards', amount: 1, channel: 'board',
  }))).toBe(false);
  expect(Buffer.byteLength(raw)).toBeLessThan(3_000_000);
  console.info('FA-04 five years, active and parked at 300 Undo', {
    oldBytes: Buffer.byteLength(legacy), bytes: Buffer.byteLength(raw), openMs, serializeMs, writeMs,
    dailyTasksBytes: Buffer.byteLength(JSON.stringify(restored.dailyTasks)),
  });
  const before = await adapter.getItem();
  adapter.setItem = async () => { throw Error('storage quota'); };
  await expect(store.mutate(next => { next.profile.coins++; })).rejects.toThrow('Последняя сохранённая партия');
  expect(await adapter.getItem()).toBe(before);
  expect(store.needsRecovery).toBe(false);
  adapter.setItem = async (key, value) => { await write(key, value); throw Error('response lost'); };
  await store.mutate(next => { next.profile.coins++; });
  expect(decodeSave((await adapter.getItem())!, findDeal)).toEqual(store.state);
}, 30_000);


it('FA-01 and FA-03 retain useful Hammer and Puzzle moves away from the virtual support', () => {
  for (const [id, prefix] of hammerCases) {
    const { save, deal } = atSocket(id, prefix, 0);
    const action = legalCommands(save.attempt.board, deal).find(move => move.type === 'transfer' &&
      move.from.kind === 'waste' && move.to.kind === 'tableau' && move.to.index !== 0);
    expect(action).toBeDefined();
    const moved = dispatch(save, action!, deal);
    expect(moved.accepted).toBe(true);
    expect(moved.next.attempt.board.joker).toEqual(save.attempt.board.joker);
    assertBoard(moved.next.attempt.board, deal);
    expect(moved.next.attempt.undo.at(-1)).toEqual(save.attempt.board);
  }
  for (const [id, prefix, column] of puzzleCases) {
    const deal = findDeal(id)!;
    const save = play(profileAt(deal), deal, deal.winningPath.slice(0, prefix));
    const action = { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'tableau', index: column } } as const;
    const step = dispatch(save, action, deal);
    expect(step.accepted).toBe(true);
    expect(step.events.some(event => event.type === 'assemble')).toBe(true);
    expect(advance(save.attempt.board, action, deal)).toEqual(step.next.attempt.board);
  }
});

it('FA-01 accepted commands keep the Joker invariant across representative special boards', () => {
  const bank = [...hitappsR4Deals()];
  let sockets = 0, attempts = 0;
  for (const level of [17, 19, 24, 26, 27, 28, 32, 66]) {
    const { deal } = bank.find(row => row.record.use === 'campaign' && row.penalty === 0 && row.deal.campaignLevel === level)!;
    let board = deal.initial;
    for (const [index, witness] of deal.winningPath.entries()) {
      if (index % 9 === 0) for (const column of board.tableau.keys()) {
        const withJoker = placeJoker(board, column, deal);
        if (typeof withJoker === 'string') continue;
        sockets++;
        for (const action of legalCommands(withJoker, deal)) {
          const moved = applyBoard(withJoker, action, deal);
          if (typeof moved === 'string') throw Error(`${deal.id} offered a refused move: ${moved}`);
          assertBoard(moved.board, deal);
          attempts++;
        }
      }
      const moved = applyBoard(board, witness, deal);
      if (typeof moved === 'string') throw Error(moved);
      board = moved.board;
    }
    expect(board.phase).toBe('won');
  }
  expect(sockets).toBeGreaterThan(200);
  expect(attempts).toBeGreaterThan(500);
  console.info('FA-01 and FA-03 special card matrix', { sockets, attempts });
}, 30_000);


it('FA-02 a stalled native read defers fullscreen without locking play and permits recovery', async () => {
  vi.useFakeTimers();
  let available = false, requests = 0;
  const blocked: boolean[] = [];
  const bridge = {
    status: async () => ({ banner: false, interstitial: true, rewarded: false, mode: 'test' }),
    addListener: async () => ({ remove: async () => {} }), pending: async () => ({ receipts: [] }),
    pendingShown: () => available ? Promise.resolve({ shown: null }) : new Promise(() => {}),
    show: async () => { requests++; return { shown: false, outcome: 'unavailable' }; },
    dispose: async () => {},
  } as unknown as AdsBridge;
  const ads = createAds({
    activity: { setBlocked: (_reason, value) => blocked.push(value), isBlocked: () => false },
    beforeShow: async () => {}, onStatus() {}, onEvent() {},
    commit: async () => 'already-applied', commitShown: async () => 'already-applied',
  }, bridge);
  const request = { attempt: 'restarted', dealId: heavyDeal, mode: 'campaign', placement: 'level-start', kind: 'interstitial' } as const;
  try {
    await ads.refresh();
    const result = ads.show(request);
    expect(blocked).toEqual([]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(await result).toMatchObject({ shown: false });
    expect(requests).toBe(0);
    expect(blocked).toEqual([]);
    available = true;
    await vi.advanceTimersByTimeAsync(1600);
    await ads.recover();
    await ads.show(request);
    expect(requests).toBe(1);
    expect(blocked).toEqual([true, false]);
  } finally { ads.destroy(); vi.useRealTimers(); }
});
