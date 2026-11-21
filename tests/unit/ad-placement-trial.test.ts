import { expect, it } from 'vitest';
import { placeEvidence, requestPlacement, type PlacementPolicy, type PlacementsTrial } from '../../tools/content/ad-placement-trial';

const normal = { cooldownMs: 120, levelCap: 2, attemptCap: 1 };
const policy: PlacementPolicy = { version: 1, enabled: true, minLevel: 3, coffeeCoins: 3, requestTimeoutMs: 300,
  rules: { normal, hard: { ...normal, levelCap: 1 }, superhard: { ...normal, levelCap: 0 } } };
const opportunity = { placement: 'ads-break', difficulty: 'normal', mode: 'campaign', attemptId: 'first',
  dealId: 'campaign-q', level: 16, playing: true, clearInput: true, now: 200 } as const;
const blank: PlacementsTrial = { version: 1, lastFullscreenAt: 70, coins: 10, sessions: [] };

it('gates moves in progress and daily and only updates counters on confirmed show', () => {
  expect(requestPlacement(blank, { ...policy, enabled: false }, opportunity, 'first', 'adapter')).toBe(blank);
  expect(requestPlacement(blank, policy, { ...opportunity, mode: 'daily' }, 'first', 'adapter')).toBe(blank);
  expect(requestPlacement(blank, policy, { ...opportunity, clearInput: false }, 'first', 'adapter')).toBe(blank);
  expect(requestPlacement(blank, policy, { ...opportunity, difficulty: 'superhard' }, 'first', 'adapter')).toBe(blank);
  const request = requestPlacement(blank, policy, opportunity, 'first', 'adapter');
  expect(request.lastFullscreenAt).toBe(70);
  expect(requestPlacement(request, policy, opportunity, 'second', 'adapter')).toBe(request);
  expect(requestPlacement(request, policy, { ...opportunity, now: 500 }, 'second', 'adapter')).not.toBe(request);
  expect(placeEvidence(request, { requestId: 'first', provider: 'adapter', type: 'no-fill' })).toEqual(blank);
  const shown = placeEvidence(request, { requestId: 'first', provider: 'adapter', type: 'shown', at: 205 });
  expect(shown.lastFullscreenAt).toBe(205);
  expect(requestPlacement(shown, policy, { ...opportunity, now: 500 }, 'second', 'adapter')).toBe(shown);
  expect(requestPlacement(shown, policy, { ...opportunity, now: 500, attemptId: 'new' }, 'second', 'adapter')).not.toBe(shown);
  expect(requestPlacement(shown, policy, { ...opportunity, now: 500, attemptId: 'new', difficulty: 'hard' }, 'second', 'adapter')).toBe(shown);
});

it('allows a separate banner impression without consuming the fullscreen cadence or inventing revenue', () => {
  const context = { requestId: 'banner', provider: 'adapter' };
  const request = requestPlacement(blank, policy, { ...opportunity, placement: 'banner' }, 'banner', 'adapter');
  const shown = placeEvidence(request, { ...context, type: 'shown', at: 210 });
  expect(shown.lastFullscreenAt).toBe(blank.lastFullscreenAt);
  const revenue = { ...context, type: 'revenue', id: 'rv-1', impression: 'impression-1', amountMicros: 150, currency: 'RUB' } as const;
  expect(placeEvidence(shown, revenue)).toBe(shown);
  const impression = placeEvidence(shown, { ...context, type: 'impression', id: 'impression-1' });
  expect(placeEvidence(impression, { ...revenue, provider: 'other-adapter' })).toBe(impression);
  expect(placeEvidence(impression, { ...revenue, currency: 'bad' })).toBe(impression);
  const posted = placeEvidence(impression, revenue);
  expect(posted.sessions[0].revenue).toMatchObject({ amountMicros: 150, currency: 'RUB' });
  expect(placeEvidence(posted, revenue)).toBe(posted);
  expect(posted.coins).toBe(10);
});

it('credits a Coffee Break only for its earned receipt once after reload', () => {
  const context = { requestId: 'coffee', provider: 'adapter' };
  const request = requestPlacement(blank, policy, { ...opportunity, placement: 'coffee-break' }, 'coffee', 'adapter');
  const earn = { ...context, type: 'earned', receiptId: 'grant-1' } as const;
  expect(placeEvidence(request, earn)).toBe(request);
  const shown = placeEvidence(request, { ...context, type: 'shown', at: 201 });
  expect(shown.coins).toBe(10);
  const restored: PlacementsTrial = JSON.parse(JSON.stringify(shown));
  const credited = placeEvidence(restored, earn);
  expect(credited.coins).toBe(13);
  expect(placeEvidence(credited, earn)).toBe(credited);
});
