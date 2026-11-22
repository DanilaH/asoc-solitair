import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { hitappsInputHash, prepareHitappsBoard, prepareHitappsInput, replayAuthoredRoute } from '../../tools/content/hitapps-authoring';

const base = content8Wave[0];
const input = {
  schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'random',
  cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0,
} as const;
const structure = { ...input, levelInputHash: hitappsInputHash(base, input) };

it('binds card order, base geometry and the effective rules3 move budget', () => {
  const prepared = prepareHitappsInput(base, structure, -5);
  expect(prepared).toMatchObject({ baseBudget: 164, effectiveBudget: 156 });
  expect(() => prepareHitappsInput(base, { ...structure, cardOrder: [...input.cardOrder].reverse() }, -5)).toThrow('structural input');
  expect(() => prepareHitappsInput({ ...base, initial: { ...base.initial, movesLeft: 162 } }, structure, -5)).toThrow('structural input');
  const first = prepared.deal(42);
  expect(prepared.deal(42)).toEqual(first);
  expect(prepared.deal(43).initial.stock).not.toEqual(first.initial.stock);
  expect(first.initial.movesLeft).toBe(156);
  expect(first.winningPath).toEqual([]);
  expect(base.initial.movesLeft).toBe(164);
});

it('distinguishes fresh, simulated and unchanged authored presets', () => {
  const prepared = prepareHitappsInput(base, structure, 10);
  const calls: string[] = [];
  const options: Parameters<typeof prepareHitappsBoard>[1] = {
    mode: 'fresh', seedRequest: -7, drawSeed: () => 42,
    features: { revision: 'qa-phases-v1', enabled: ['ordered', 'frozen', 'golden'], appliers: {
      ordered: state => { calls.push('initial'); return state; },
      frozen: state => { calls.push('shuffle'); return state; },
      golden: state => { calls.push('final'); return state; },
    } },
  };
  expect(prepareHitappsBoard(prepared, options)).toMatchObject({ requestedSeed: -7, seed: 42 });
  expect(calls.splice(0)).toEqual(['initial', 'shuffle', 'final']);
  expect(prepareHitappsBoard(prepared, { ...options, mode: 'simulated' }).levelShuffled).toBe(true);
  expect(calls).toEqual(['shuffle']);
  expect(() => prepareHitappsBoard(prepared, { ...options, features: { revision: 'unknown', enabled: ['ordered'] } })).toThrow('feature gates');
  const preset = { ...input, layout: 'fixed' as const };
  const fixed = prepareHitappsInput(base, { ...preset, levelInputHash: hitappsInputHash(base, preset) }, 0);
  expect(fixed.deal(42)).toEqual(fixed.deal(43));
  expect(replayAuthoredRoute(fixed.deal(42), base.winningPath).phase).toBe('won');
});
