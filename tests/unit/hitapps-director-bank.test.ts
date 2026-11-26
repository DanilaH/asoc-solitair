import { expect, it } from 'vitest';
import { content8Dealer, content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { adaptiveBank, selectAdaptiveDeal } from '../../src/content/campaign-v8-adaptive';
import { hitappsDirectorDeals, hitappsDirectorRecords } from '../../src/content/campaign-v8-hitapps-director';
import { adjustedMoveBudget, C8_DIFFICULTY } from '../../src/domain/difficulty';
import { freshSave } from '../../src/domain/engine';
import { authoringHash, hitappsInputHash, prepareHitappsInput, replayAuthoredRoute, rulesSnapshot } from '../../tools/content/hitapps-authoring';

const bases = new Map([...content8Dealer, ...content8Wave, ...content8Late].map(deal => [deal.id, deal]));

it('reproduces every generated board and wins within its frozen budget using both rule implementations', () => {
  expect(hitappsDirectorRecords.length).toBeGreaterThan(10);
  expect(new Set(hitappsDirectorRecords.map(row => row.id)).size).toBe(hitappsDirectorRecords.length);
  for (const [i, record] of hitappsDirectorRecords.entries()) {
    const variant = hitappsDirectorDeals[i].deal;
    const base = bases.get(record.baseId)!;
    const structure = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'random',
      cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0 } as const;
    expect(hitappsInputHash(base, structure)).toBe(record.inputHash);
    const penalty = record.id.endsWith('-restart-r1') ? 0 : record.direction === 'tight' ? C8_DIFFICULTY.hardPenalty : C8_DIFFICULTY.easyPenalty;
    const prepared = prepareHitappsInput(base, { ...structure, levelInputHash: record.inputHash }, penalty);
    expect(variant.initial).toEqual(prepared.deal(record.seed).initial);
    expect(variant.initial.movesLeft).toBe(adjustedMoveBudget(base.initial.movesLeft!, penalty, true));
    expect(authoringHash(rulesSnapshot(variant))).toBe(record.boardHash);
    expect(authoringHash(variant.winningPath)).toBe(record.routeHash);
    expect(replayAuthoredRoute(variant, variant.winningPath).phase).toBe('won');
  }
}, 30000);

it('chooses from frozen variants on future starts and preserves eligibility for archived exhausted attempts', () => {
  const base = content8Wave[2];
  const bank = adaptiveBank([...bases.values()], hitappsDirectorDeals);
  const save = freshSave(base, 'director');
  save.difficultyPenalty = C8_DIFFICULTY.hardPenalty;
  expect(selectAdaptiveDeal(save, base, bank, undefined, false)).toBe(base);
  expect(selectAdaptiveDeal(save, base, bank, undefined, true).adaptive?.direction).toBe('tight');
  save.difficultyPenalty = C8_DIFFICULTY.easyPenalty;
  expect(selectAdaptiveDeal(save, base, bank, undefined, true)).toBe(bank.get(base.id)?.relief);
  const previous = structuredClone(save.attempt);
  previous.dealId = base.id + '-tight-r2';
  previous.board.phase = 'exhausted';
  previous.board.movesLeft = 0;
  previous.director = { restarts: 2, previousLosses: 2 };
  const easy = bank.get(base.id)?.easy;
  expect(easy).toBeDefined();
  expect(selectAdaptiveDeal(save, base, bank, previous, true)).toBe(easy);
  expect(save.attempt.board).toEqual(base.initial);
});
