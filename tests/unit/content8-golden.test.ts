import { expect, it } from 'vitest';
import { content8GoldenDeal as deal } from '../../src/content/campaign-v8-golden';
import { dispatch, freshSave } from '../../src/domain/engine';
import { claimGoldenCards, collectedGold, goldenRewardKey, prepareGoldenDeal } from '../../src/domain/golden-cards';
import { decodeSave } from '../../src/platform/storage';
import { advance } from '../../tools/qa/gameplay-oracle';

it('leaves the authored base unchanged when the gate skips or a requested marker is invalid', () => {
  const base = { ...deal, id: 'golden-authoring-control', golden: undefined };
  expect(prepareGoldenDeal(base, deal.id, { enabled: false, count: 2 }, ['beach', 'pumpkin'], 5)).toEqual({ status: 'SKIPPED', deal: base });
  expect(prepareGoldenDeal(base, deal.id, { enabled: true, count: 2 }, ['beach', 'beach'], 5)).toEqual({ status: 'FAILED', deal: base });
  expect(prepareGoldenDeal(base, deal.id, { enabled: true, count: 1 }, ['unknown'], 5)).toEqual({ status: 'FAILED', deal: base });
});

it('records partial gold, settles only a verified win and deduplicates across reload and replay', () => {
  const preview = { ...deal, id: 'golden-receipt-control' };
  let save = freshSave(preview, 'golden-win');
  const initialCoins = save.profile.coins;
  for (const [index, action] of preview.winningPath.entries()) {
    const expected = advance(save.attempt.board, action, preview);
    const next = dispatch(save, action, preview);
    expect(next.accepted).toBe(true);
    expect(next.next.attempt.board).toEqual(expected);
    save = next.next;
    if (index === 1) {
      expect(collectedGold(save.attempt.board, preview)).toBe(1);
      expect(claimGoldenCards(save, preview)).toBeUndefined();
      expect(save.profile.coins).toBe(initialCoins);
    }
  }
  const key = goldenRewardKey(preview);
  expect(save.attempt.board.phase).toBe('won');
  expect(save.attempt.payout?.find(reward => reward.key === key)).toMatchObject({ reason: 'golden_cards', coins: 10 });
  save = decodeSave(JSON.stringify(save), preview);
  expect(claimGoldenCards(save, preview)).toBeUndefined();
  save = dispatch(save, { type: 'restart', attemptId: 'golden-replay' }, preview).next;
  for (const action of preview.recoveryPaths![0]) save = dispatch(save, action, preview).next;
  expect(save.profile.rewards.filter(value => value === key)).toEqual([key]);
  expect(save.attempt.payout?.find(reward => reward.key === key)).toBeUndefined();
});
