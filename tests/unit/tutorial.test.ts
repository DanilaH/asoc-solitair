import { describe, expect, it } from 'vitest';
import { campaignDeals } from '../../src/content/campaign';
import { dispatch, freshSave } from '../../src/domain/engine';
import { lesson } from '../../src/app/tutorial';

describe('action-based teaching', () => {
  it('observes the first two deals without changing them and advances after actual actions', () => {
    const actions = new Set<string>();
    for (const deal of campaignDeals.slice(0, 2)) {
      let save = freshSave(deal, 'teaching');
      for (const action of deal.winningPath) {
        const before = structuredClone(save), guidance = lesson(save, deal);
        expect(save).toEqual(before);
        expect(guidance?.action).toBeDefined();
        expect(dispatch(save, guidance!.action!, deal).accepted).toBe(true);
        actions.add(guidance!.action!.type);
        save = dispatch(save, action, deal).next;
      }
      expect(lesson(save, deal)).toBeUndefined();
    }
    expect(actions.has('transfer')).toBe(true); expect(actions.has('draw')).toBe(true);
  });
  it('does not turn ordinary or modifier levels into a free automatic hint stream', () => {
    for (const index of [4, 16, 22, 25, 29, 79]) {
      const deal = campaignDeals[index];
      expect(lesson(freshSave(deal, 'ordinary'), deal)).toBeUndefined();
    }
  });
});
