import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { adjustedMoveBudget, C8_DIFFICULTY } from '../../src/domain/difficulty';
import type { BoardCommand, Location } from '../../src/domain/types';
import { authoringHash, hitappsInputHash, rulesSnapshot } from './hitapps-authoring';
import { authorHitappsCandidate } from './hitapps-pipeline';

function encodeRoute(path: readonly BoardCommand[]) {
  const at = (location: Location) => location.kind[0] + location.index;
  return path.map(move => move.type === 'transfer' ? `${at(move.from)}>${at(move.to)}` : move.type[0]).join(' ');
}

const cases = [
  { direction: 'tight', penalty: C8_DIFFICULTY.hardPenalty, previousLosses: 0, reserve: 6 },
  { direction: 'relief', penalty: C8_DIFFICULTY.easyPenalty, previousLosses: 0, reserve: 12 },
  { direction: 'easy', penalty: C8_DIFFICULTY.easyPenalty, previousLosses: C8_DIFFICULTY.lossThreshold - 1, reserve: 18 },
] as const;
const levels = (process.env.HITAPPS_DIRECTOR_LEVELS ?? '').split(',').filter(Boolean).map(Number);
const candidateCap = Number(process.env.HITAPPS_DIRECTOR_CANDIDATES ?? 4);
assert(Number.isSafeInteger(candidateCap) && candidateCap > 0 && candidateCap <= 100);
const suffix = process.env.HITAPPS_DIRECTOR_RUN ?? 'bank';
assert(/^[a-z0-9-]+$/.test(suffix));
const catalog = [];
const audit = [];
for (const base of [...content8Wave, ...content8Late]) {
  const level = base.campaignLevel!;
  if (levels.length && !levels.includes(level)) continue;
  const structureInput = { schema: 'hitapps-authoring-v1', provenance: 'PRODUCT_ADAPTED', layout: 'random',
    cardOrder: Object.keys(base.cards), stableMoves: true, levelPenalty: 0 } as const;
  const structure = { ...structureInput, levelInputHash: hitappsInputHash(base, structureInput) };
  for (const { direction, penalty, previousLosses, reserve } of cases) {
    const budget = adjustedMoveBudget(base.initial.movesLeft!, penalty, true);
    const target = Math.min(base.winningPath.length, budget - reserve);
    const tier = base.difficultyTier ?? 'normal';
    const result = authorHitappsCandidate(base, {
      structure, features: { revision: 'ordinary-product-v1', enabled: [] },
      difficulty: { historyPenalty: penalty, previousLosses, special: false },
      easy: { enabled: true, minLevel: 16, byDifficulty: {
        [tier]: { lossThreshold: C8_DIFFICULTY.lossThreshold, targetSteps: Math.max(1, target - 4) },
      } },
      strategy: { kind: 'Priority', target, tolerancePercent: 0 },
      seeds: Array.from({ length: candidateCap }, (_, i) => 47 + i + (direction === 'easy' ? candidateCap : 0)),
      drawSeed() { throw Error('Expected explicit candidate seed'); },
    });
    const { deal } = result;
    const selection = result.selection;
    const slack = deal ? budget - deal.winningPath.length : null;
    const accepted = deal && slack !== null && slack >= reserve && 'seed' in selection && 'attempts' in selection;
    audit.push({ level, direction, accepted: Boolean(accepted), slack, selection });
    if (!accepted) continue;
    catalog.push({
      baseId: base.id, id: deal.id, direction, initial: deal.initial, route: encodeRoute(deal.winningPath),
      inputHash: structure.levelInputHash, seed: selection.seed, attempts: selection.attempts,
      boardHash: authoringHash(rulesSnapshot(deal)), routeHash: authoringHash(deal.winningPath),
      target: result.evidence.easyTarget ?? target, proof: 'rules3-gameplay-oracle-v1',
    });
  }
}
await mkdir('.authoring/hitapps', { recursive: true });
await writeFile(`.authoring/hitapps/director-${suffix}.json`, JSON.stringify(catalog) + '\n');
await writeFile(`.authoring/hitapps/director-${suffix}-trials.json`, JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ considered: audit.length, certified: catalog.length, levels: [...new Set(catalog.map(row => row.baseId))] }));
