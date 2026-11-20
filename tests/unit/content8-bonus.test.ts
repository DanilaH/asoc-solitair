import { afterAll, expect, it, vi } from 'vitest';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { content8Wave, decodeRoute } from '../../src/content/campaign-v8-dealer';
import { campaignDeals, findDeal } from '../../src/content/campaign';
import { dailyForDay } from '../../src/content/daily';
import { bonusOffer, purchaseBonusSlot } from '../../src/domain/bonus-slots';
import { applyBoard, assertBoard, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { resolveHint } from '../../src/domain/hint';
import { applyReceipt, parseReceipt, platformState, type EarnedReceipt } from '../../src/domain/services';
import { campaignId } from '../../src/domain/progression';
import { switchMode } from '../../src/domain/sessions';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import { lesson, recordLearning } from '../../src/app/tutorial';
import { advance } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

vi.hoisted(() => vi.stubEnv('VITE_CONTENT8_PREVIEW', '1'));
afterAll(() => vi.unstubAllEnvs());

const [upper, lower, both] = content8BonusDeals;
const receipt: EarnedReceipt = { schema: 1, id: 'upper-reward', dealId: both.id, placement: 'bonus-foundation', mode: 'campaign', attempt: 'test-bonus' };

function play(board: Board, action: BoardCommand, deal: Deal): Board {
  const result = applyBoard(board, action, deal);
  if (typeof result === 'string') throw Error(deal.id + ' ' + JSON.stringify(action) + ' ' + result);
  expect(result.board).toEqual(advance(board, action, deal));
  return result.board;
}

it.each(content8BonusDeals)('verifies ordinary and bought-slot winning routes at level $campaignLevel', deal => {
  for (const buy of [false, true]) {
    const save = freshSave(deal, 'win-bonus');
    save.profile.coins = 200;
    const upper = buy && purchaseBonusSlot(save, deal, save.attempt.id, 'foundation');
    const lower = buy && purchaseBonusSlot(save, deal, save.attempt.id, 'tableau');
    let board = save.attempt.board;
    let usedLower = false;
    for (const action of deal.winningPath) {
      if (upper && action.type === 'transfer' && action.to.kind === 'foundation' && action.to.index === 0) {
        board = play(board, { ...action, to: { ...action.to, index: board.foundations.length - 1 } }, deal);
      } else if (lower && !usedLower && action.type === 'transfer' && action.to.kind === 'tableau') {
        const extra = { kind: 'tableau' as const, index: board.tableau.length - 1 };
        board = play(board, { ...action, to: extra }, deal);
        board = play(board, { ...action, from: extra }, deal);
        usedLower = true;
      } else board = play(board, action, deal);
    }
    expect(board.phase).toBe('won');
    if (lower) expect(usedLower).toBe(true);
  }
});

it('uses three and four regular slots, with a distinct eligible row for each offer', () => {
  expect(bonusOffer(upper, 'foundation')).toEqual({ index: 3, coins: 100 });
  expect(bonusOffer(upper, 'tableau')).toBeUndefined();
  expect(bonusOffer(lower, 'tableau')).toEqual({ index: 4, coins: 60 });
  expect(bonusOffer(lower, 'foundation')).toBeUndefined();
  expect(bonusOffer(both, 'foundation')?.index).toBe(4);
  expect(bonusOffer(both, 'tableau')?.index).toBe(4);
  const five = content8Wave.find(deal => deal.campaignLevel === 31)!;
  expect(bonusOffer({ ...five, bonusSlots: both.bonusSlots }, 'foundation')).toBeUndefined();
  expect(bonusOffer({ ...five, bonusSlots: both.bonusSlots }, 'tableau')).toBeUndefined();
  const two = { ...upper, initial: { ...upper.initial, foundations: [[], []] } };
  expect(bonusOffer(two, 'foundation')).toBeUndefined();
  const daily = { ...upper, daily: { dayId: '2026-11-20', poolId: 'day', contentVersion: 8 } };
  expect(bonusOffer(daily, 'foundation')).toBeUndefined();
});

it('opens only the exact paid slot and keeps it through historical Undo and reopen', () => {
  let save = freshSave(both, 'test-bonus');
  platformState(save).completedCampaign = Array.from({ length: 39 }, (_, i) => campaignId(i + 1));
  const first = both.winningPath[0];
  const toUpper = { type: 'transfer', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 4 } } as const;
  expect(legalCommands(save.attempt.board, both)).not.toContainEqual(toUpper);
  expect(purchaseBonusSlot(save, both, save.attempt.id, 'tableau')).toBe(true);
  expect(save.attempt.board.tableau).toHaveLength(5);
  expect(save.attempt.board.foundations).toHaveLength(4);
  expect(purchaseBonusSlot(save, both, save.attempt.id, 'tableau')).toBe(false);
  expect(purchaseBonusSlot(save, both, save.attempt.id, 'foundation')).toBe(false);
  save = dispatch(save, first, both).next;
  save.profile.coins += 100;
  expect(purchaseBonusSlot(save, both, 'other-attempt', 'foundation')).toBe(false);
  const remaining = save.attempt.board.movesLeft;
  expect(purchaseBonusSlot(save, both, save.attempt.id, 'foundation')).toBe(true);
  expect(save.profile.coins).toBe(40);
  expect(save.attempt.board.movesLeft).toBe(remaining);
  expect(save.attempt.undo[0].foundations).toHaveLength(5);
  save = decodeSave(JSON.stringify(save), findDeal);
  const undo = dispatch(save, { type: 'undo' }, both);
  expect(undo.accepted, undo.reason).toBe(true);
  save = undo.next;
  expect(save.attempt.board.foundations).toHaveLength(5);
  expect(save.attempt.board.tableau).toHaveLength(5);
  expect(save.profile.coins).toBe(40);
  expect(save.attempt.board.movesLeft).toBe(both.initial.movesLeft);
  expect(legalCommands(save.attempt.board, both)).toContainEqual(toUpper);
  save = dispatch(save, { type: 'restart', attemptId: 'new-bonus' }, both).next;
  expect(save.attempt.board).toEqual(both.initial);
  expect(save.profile.coins).toBe(40);
});

it('uses the extra upper and lower piles in Hint, and learns only by taking the transfer', () => {
  let save = freshSave(upper, 'upper-practice');
  expect(lesson(save, upper)).toBeUndefined();
  purchaseBonusSlot(save, upper, save.attempt.id, 'foundation');
  const offered = lesson(save, upper)!.action!;
  expect(offered).toMatchObject({ type: 'transfer', to: { kind: 'foundation', index: 3 } });
  let before = save.attempt.board;
  save = dispatch(save, offered, upper).next;
  recordLearning(save, before, offered, upper);
  expect(save.campaign?.tutorials).toContain('learn:bonus-foundation');
  expect(lesson(save, upper)).toBeUndefined();
  const hint = resolveHint(save.attempt.board, upper, 1);
  expect(hint).toMatchObject({ status: 'SOLVED', action: { to: { kind: 'foundation', index: 3 } } });

  save = freshSave(lower, 'lower-practice');
  purchaseBonusSlot(save, lower, save.attempt.id, 'tableau');
  save = dispatch(save, lower.winningPath[0], lower).next;
  const [park, returnToRoute] = decodeRoute('t2>t4 t4>t1');
  expect(legalCommands(save.attempt.board, lower)).toContainEqual(park);
  before = save.attempt.board;
  save = dispatch(save, park, lower).next;
  recordLearning(save, before, park, lower);
  expect(save.campaign?.tutorials).toContain('learn:bonus-tableau');
  expect(resolveHint(save.attempt.board, lower, 1)).toEqual({ status: 'SOLVED', action: returnToRoute });
});

it('applies earned receipts once to their own parked or active slot without a coin charge', () => {
  const save = freshSave(both, 'test-bonus'), daily = dailyForDay('2026-11-20');
  const lowerReceipt = { ...receipt, id: 'lower-reward', placement: 'bonus-tableau' };
  expect(parseReceipt(lowerReceipt).placement).toBe('bonus-tableau');
  expect(() => parseReceipt({ ...lowerReceipt, mode: 'daily' })).toThrow('Invalid receipt');
  switchMode(save, 'daily', daily, 'daily');
  const dailyBefore = structuredClone(save.attempt);
  expect(applyReceipt(save, receipt, both)).toBe('applied');
  expect(applyReceipt(save, receipt, both)).toBe('already-applied');
  expect(save.attempt).toEqual(dailyBefore);
  expect(save.parked?.campaign?.board.foundations).toHaveLength(5);
  expect(save.parked?.campaign?.board.tableau).toHaveLength(4);
  applyReceipt(save, parseReceipt({ ...lowerReceipt, id: 'wrong', attempt: 'old-attempt' }), both);
  applyReceipt(save, parseReceipt({ ...lowerReceipt, id: 'wrong-deal', dealId: upper.id }), upper);
  expect(save.parked?.campaign?.board.tableau).toHaveLength(4);
  const loaded = decodeSave(JSON.stringify(save), findDeal);
  switchMode(loaded, 'campaign', both, 'return');
  applyReceipt(loaded, parseReceipt(lowerReceipt), both);
  applyReceipt(loaded, parseReceipt({ ...lowerReceipt, id: 'second-lower-reward' }), both);
  expect(loaded.attempt.board.tableau).toHaveLength(5);
  expect(loaded.profile.coins).toBe(100);
  expect(loaded.profile.hints).toBe(3);
  expect(loaded.profile.undos).toBe(5);
});

it('cannot spend twice on concurrent purchases or publish an unlock without a durable write', async () => {
  let raw: string | null = null, fail = false;
  const store = new SaveStore({
    getItem: async () => raw,
    setItem: async (_key, value) => { if (fail) throw Error('disk full'); raw = value; },
    removeItem: async () => { raw = null; },
  }, both, () => freshSave(both, 'test-bonus'));
  await store.open();
  const buy = () => store.mutate(next => purchaseBonusSlot(next, both, 'test-bonus', 'tableau'));
  fail = true;
  await expect(buy()).rejects.toThrow();
  expect(store.state.attempt.board.tableau).toHaveLength(4);
  expect(store.state.profile.coins).toBe(100);
  fail = false;
  await expect(Promise.all([buy(), buy()])).resolves.toEqual([true, false]);
  expect(decodeSave(raw!, both)).toEqual(store.state);
  expect(store.state.profile.coins).toBe(40);
  expect(store.state.attempt.board.tableau).toHaveLength(5);
});

it('keeps old level ids and rejects impossible row counts or inconsistent Undo history', () => {
  const previous = content8Wave.find(deal => deal.campaignLevel === 22)!;
  const archived = dispatch(freshSave(previous, 'archived'), previous.winningPath[0], previous).next;
  expect(campaignDeals[21]).toBe(upper);
  expect(campaignDeals[29]).toBe(lower);
  expect(campaignDeals[39]).toBe(both);
  expect(findDeal(previous.id)).toBe(previous);
  expect(decodeSave(JSON.stringify(archived), findDeal).attempt).toEqual(archived.attempt);
  const current = freshSave(upper, 'test-bonus');
  current.attempt.board.tableau.push([]);
  expect(() => assertBoard(current.attempt.board, upper)).toThrow('Неверное число столбцов');
  current.attempt.board.tableau.pop();
  current.attempt.undo.push(structuredClone(current.attempt.board));
  current.attempt.board.foundations.push([]);
  expect(() => decodeSave(JSON.stringify(current), findDeal)).toThrow('Повреждены бонусные места в истории');
});
