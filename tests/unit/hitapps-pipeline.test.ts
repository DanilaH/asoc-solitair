import { expect, it } from 'vitest';
import { content8Wave } from '../../src/content/campaign-v8-dealer';
import { hitappsInputHash, replayAuthoredRoute } from '../../tools/content/hitapps-authoring';
import { authorHitappsCandidate } from '../../tools/content/hitapps-pipeline';
import { isLateLoss } from '../../tools/content/difficulty-selection';

const base = content8Wave[0];
const input = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'fixed',
  cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0 } as const;
const defaults = {
  structure: { ...input, levelInputHash: hitappsInputHash(base, input) },
  features: { revision: 'local-plain-v1', enabled: [] },
  difficulty: { historyPenalty: 0, previousLosses: 0, special: false },
  easy: { enabled: false, minLevel: 16, byDifficulty: {} },
  seeds: [-1, 2],
  drawSeed: () => 42,
} as const;

it('certifies the final None and Priority paths and records the actual seed', () => {
  const none = authorHitappsCandidate(base, { ...defaults, strategy: { kind: 'None', seed: -1 } });
  const priority = authorHitappsCandidate(base, { ...defaults, strategy: { kind: 'Priority', target: 138, tolerancePercent: 0 } });
  expect(none.selection).toMatchObject({ seed: 42, requestedSeed: -1 });
  expect(priority.selection).toMatchObject({ seed: 42, attempts: 1, reason: 'WITHIN_TOLERANCE', winningBotSteps: 138 });
  for (const candidate of [none, priority]) {
    expect(candidate.deal?.id).not.toBe(base.id);
    expect(candidate.evidence.effectiveBudget).toBe(164);
    expect(replayAuthoredRoute(candidate.deal!, candidate.deal!.winningPath).phase).toBe('won');
  }
});

it('uses the adjusted budget in the native-static single-precision late-loss comparison', () => {
  const run = { status: 'LOST', steps: 78 } as const;
  expect(isLateLoss(run, 100)).toBe(false);
  expect(isLateLoss(run, 95)).toBe(true);
  expect(isLateLoss({ ...run, steps: 75 }, 95)).toBe(false);
  expect(isLateLoss({ ...run, steps: 76 }, 95)).toBe(true);
  expect(isLateLoss({ ...run, status: 'WON' }, 95)).toBe(false);
});
