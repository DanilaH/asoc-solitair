import { expect, it } from 'vitest';
import { releaseProfile } from '../../src/config/profile';
import { dailyForDay } from '../../src/content/daily';
import { switchMode } from '../../src/domain/sessions';
import { campaignDeals, campaignIssuance, findDeal, selectCampaignDeal } from '../../src/content/campaign';
import { beginDeal } from '../../src/domain/campaign';
import { applyBoard, boardKey, dispatch, freshSave, legalCommands } from '../../src/domain/engine';
import { buyUnlimitedAccess, canBuyUnlimitedAccess, expireUnlimited } from '../../src/domain/campaign-recovery';
import { findContinue } from '../../src/domain/continuation';
import { buyContinue } from '../../src/domain/services';
import { decodeSave, SaveStore } from '../../src/platform/storage';
import type { BoardCommand } from '../../src/domain/types';

it.skipIf(!releaseProfile)('reopens and undoes a legal Unlimited expiry followed by Continue, including a damaged saved board', async () => {
  // Obtain the L16 unlock and wallet entirely through normal first-clear rewards.
  // This fixture never edits boards, coins, difficulty history, or progress.
  let previousDeal = campaignDeals[0], save = freshSave(previousDeal, 'organic-l1');
  for (let level = 1; level <= 15; level++) {
    const current = level === 1 ? previousDeal : selectCampaignDeal(save, campaignDeals[level - 1]);
    if (level > 1) beginDeal(save, current, `organic-l${level}`, previousDeal);
    for (const command of current.winningPath) {
      const result = dispatch(save, command, current);
      expect(result.accepted).toBe(true); save = result.next;
    }
    expect(save.attempt.board.phase).toBe('won');
    previousDeal = current;
  }
  const base = campaignDeals[15], deal = selectCampaignDeal(save, base);
  beginDeal(save, deal, 'audit-unlimited-continue', previousDeal);
  save.attempt.issuance = campaignIssuance(save, base, deal);
  let prefix = -1, pair: BoardCommand[] | undefined;
  const step = (command: BoardCommand) => {
    const result = dispatch(save, command, deal);
    expect(result.accepted, JSON.stringify(command)).toBe(true);
    save = result.next;
  };
  for (let index = 0; index < deal.winningPath.length - 5 && !pair; index++) {
    for (const first of legalCommands(save.attempt.board, deal)) {
      if (first.type !== 'transfer' || first.from.kind !== 'tableau' || first.to.kind !== 'tableau') continue;
      const next = applyBoard(save.attempt.board, first, deal);
      if (typeof next === 'string') continue;
      const second: BoardCommand = { type: 'transfer', from: first.to, to: first.from };
      const restored = applyBoard(next.board, second, deal);
      if (typeof restored !== 'string' && boardKey(restored.board) === boardKey(save.attempt.board)) {
        pair = [first, second]; prefix = index; break;
      }
    }
    if (!pair) step(deal.winningPath[index]);
  }
  expect(pair).toBeDefined();
  while (save.attempt.board.movesLeft! > 2) for (const command of pair!) step(command);
  expect(canBuyUnlimitedAccess(save, deal)).toBe(true);
  expect(buyUnlimitedAccess(save, deal, 'audit-unlimited-right', 1000, { timeline: 'android-1', elapsed: 1000, native: true })).toBe(true);
  for (let i = 0; i < 2; i++) for (const command of pair!) step(command);
  for (const command of deal.winningPath.slice(prefix, -5)) step(command);
  expect(save.attempt.board.retainedMoves).toBe(0);
  expect(expireUnlimited(save, 61000, { timeline: 'android-1', elapsed: 61000, native: true })).toBe(true);
  expect(save.attempt.board.phase).toBe('exhausted');
  save = decodeSave(JSON.stringify(save), findDeal);
  const proof = findContinue(save.attempt, deal);
  expect(proof.status).toBe('PROVEN_RECOVERABLE');
  if (proof.status !== 'PROVEN_RECOVERABLE') return;
  const quote = { attemptId: save.attempt.id, deal, path: proof.path };
  const uiCoinContinueEligible = save.attempt.board.phase === 'exhausted' && !save.attempt.continued && !save.attempt.lostLife &&
    (save.platform?.continueCredits ?? 0) === 0 && proof.status === 'PROVEN_RECOVERABLE' && save.profile.coins >= 120;
  expect(uiCoinContinueEligible).toBe(true);
  const prior = structuredClone(save), exhaustedUndo = save.attempt.undo.filter(board => board.phase === 'exhausted').length;
  expect(exhaustedUndo).toBeGreaterThan(0);
  let raw = JSON.stringify(prior);
  const adapter = { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; }, removeItem: async () => undefined };
  const store = new SaveStore(adapter, findDeal, () => { throw Error('Expected an existing profile'); });
  await store.open();
  expect(await store.mutate(next => buyContinue(next, quote))).toBe(true);
  expect(await store.mutate(next => buyContinue(next, quote))).toBe(false);
  expect(store.state.profile.coins).toBe(prior.profile.coins - 120);
  const healthy = await new SaveStore(adapter, findDeal, () => prior).open();
  expect(healthy.attempt.undo).toHaveLength(prior.attempt.undo.length);
  const undone = dispatch(healthy, { type: 'undo' }, deal);
  expect(undone.accepted).toBe(true);
  expect(undone.next.attempt.board).toMatchObject({ phase: 'playing', movesLeft: 10 });

  const broken = structuredClone(healthy);
  for (const [index, snapshot] of broken.attempt.undo.entries()) {
    if (prior.attempt.undo[index].phase === 'exhausted') snapshot.phase = 'exhausted';
  }
  const repaired = decodeSave(JSON.stringify(broken), findDeal);
  expect(repaired).toEqual(healthy);
  broken.attempt.board = broken.attempt.undo.pop()!;
  const invalidActive = structuredClone(broken);
  delete invalidActive.attempt.unlimited;
  expect(() => decodeSave(JSON.stringify(invalidActive), findDeal)).toThrow(/Несогласованн.*бюджет/);
  expect(decodeSave(JSON.stringify(broken), findDeal).attempt.board).toEqual(undone.next.attempt.board);

  const daily = dailyForDay('2026-11-24');
  switchMode(broken, 'daily', daily, 'park-the-broken-attempt');
  raw = JSON.stringify(broken);
  const parkedStore = new SaveStore(adapter, findDeal, () => prior);
  await parkedStore.open();
  expect(parkedStore.state.attempt).toEqual(broken.attempt);
  await parkedStore.mutate(next => switchMode(next, 'campaign', deal, 'back-to-repaired-attempt'));
  expect(parkedStore.state.attempt).toEqual({ ...healthy.attempt,
    board: undone.next.attempt.board, undo: healthy.attempt.undo.slice(0, -1) });
  expect(parkedStore.state.profile).toEqual(healthy.profile);
}, 30_000);
