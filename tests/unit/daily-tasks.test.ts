import { expect, it } from 'vitest';
import source from '../../docs/qa/content-v8/f-source-event-matrix.json' with { type: 'json' };
import { introDeal } from '../../src/content/intro';
import { dispatch, freshSave } from '../../src/domain/engine';
import { acceptedTaskSignals, claimTask, claimTaskMilestone, openTaskChest, purchaseTaskSignal, recordTaskSignal,
  RewardKind, scheduleTasks, TaskKind, useTaskCharge, validDailyTasks, type TaskSignal, type TaskTarget } from '../../src/domain/events/daily-tasks';

const day = '2026-11-21', monday = '2026-11-16', at = Date.parse(day);
const kinds = Object.keys(TaskKind).filter(kind => kind !== 'Unknown') as TaskSignal['kind'][];
const prizes = Object.keys(RewardKind) as TaskTarget['prize']['kind'][];
const channels: TaskSignal['channel'][] = ['board', 'board', 'board', 'helper', 'board', 'board', 'login', 'daily-bonus',
  'helper', 'helper', 'helper', 'helper', 'wallet', 'continue', 'wallet', 'purchase'];
const definitions = kinds.map((kind, index): TaskTarget => ({ id: kind, kind, target: 1, prize: { kind: prizes[index % prizes.length], quantity: 1 } }));

it('matches all native enum values and has a separate checked signal for every active kind', () => {
  expect(Object.entries(TaskKind).map(([name, value]) => ({ name, value }))).toEqual(source.azurDailyTasks.taskEnum);
  expect(Object.entries(RewardKind).map(([name, value]) => ({ name, value }))).toEqual(source.azurDailyTasks.rewardEnum);
  const save = freshSave(introDeal, 'tasks');
  expect(scheduleTasks(save, at, definitions)).toBe(true);
  for (const [index, kind] of kinds.entries()) {
    const signal = { id: `signal:${kind}`, kind, channel: channels[index], amount: 1, attemptId: kind === 'WinNoHints' ? 'independent' : 'real' };
    expect(recordTaskSignal(save, at, signal)).toBe(true);
    expect(recordTaskSignal(save, at, signal)).toBe(false);
  }
  for (const kind of kinds) expect(claimTask(save, day, kind)).toBe(true);
  expect(save.dailyTasks?.inventory).toMatchObject({ definitions: 2, shuffles: 2, cardBack: true });
  const chest = save.dailyTasks!.inventory.chestKeys[0];
  expect(openTaskChest(save, chest)).toBeDefined();
  expect(openTaskChest(save, chest)).toBeUndefined();
  expect(useTaskCharge(save, 'definitions')).toBe(true);
  expect(save.dailyTasks?.inventory.definitions).toBe(1);
  expect(claimTask(save, day, kinds[0])).toBe(false);
  expect(validDailyTasks(JSON.parse(JSON.stringify(save.dailyTasks)))).toBe(true);
});

it('keeps earned tasks through rollover and rejects false paid and hinted wins', () => {
  const save = freshSave(introDeal, 'rollback');
  const target = [{ id: 'login', kind: 'DailyLogin', target: 1, prize: { kind: 'Medals', quantity: 2 } }, definitions[4]] as const;
  scheduleTasks(save, at, target, [{ id: 'first', medals: 2, prize: { kind: 'Coins', quantity: 20 } }]);
  expect(recordTaskSignal(save, at, { id: 'raw-order', kind: 'MakePurchase', amount: 1, channel: 'wallet' })).toBe(false);
  expect(recordTaskSignal(save, at, { id: 'hinted', kind: 'UseHints', amount: 1, channel: 'helper', attemptId: 'played' })).toBe(true);
  expect(recordTaskSignal(save, at, { id: 'won', kind: 'WinNoHints', amount: 1, channel: 'board', attemptId: 'played' })).toBe(false);
  expect(recordTaskSignal(save, at, { id: 'session', kind: 'DailyLogin', amount: 1, channel: 'login' })).toBe(true);
  expect(recordTaskSignal(save, at, { id: 'session-2', kind: 'DailyLogin', amount: 1, channel: 'login' })).toBe(false);
  expect(scheduleTasks(save, at + 2 * 86_400_000, target)).toBe(true);
  expect(scheduleTasks(save, at, target)).toBe(false);
  expect(claimTask(save, day, 'login')).toBe(true);
  expect(claimTaskMilestone(save, monday, 'first')).toBe(true);
  expect(claimTaskMilestone(save, monday, 'first')).toBe(false);
  expect(save.profile.coins).toBe(120);
  expect(save.dailyTasks?.weeks).toHaveLength(2);
  expect(purchaseTaskSignal({ status: 'refunded' } as never, 'actual-merchant')).toBeUndefined();
});

it('emits move objectives only for an accepted game action', () => {
  const save = freshSave(introDeal, 'action'), draw = { type: 'draw' } as const;
  const result = dispatch(save, draw, introDeal);
  expect(result.accepted).toBe(true);
  expect(acceptedTaskSignals(save, result, draw, introDeal).map(signal => signal.kind)).toEqual(['ExecuteMoves', 'DrawCards']);
  expect(acceptedTaskSignals(save, { ...result, accepted: false }, draw, introDeal)).toEqual([]);
});
