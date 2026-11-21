import { expect, it } from 'vitest';
import { content8Wave, content8Late } from '../../src/content/campaign-v8-dealer';
import { content8Special } from '../../src/content/campaign-v8-special';
import { content8BonusDeals } from '../../src/content/campaign-v8-bonus';
import { applyBoard } from '../../src/domain/engine';
import { identity, options } from '../../tools/qa/gameplay-oracle';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

/**
 * Independent PRODUCT LEGAL-ACTION availability sampling, not another
 * original-reference parity claim or human-difficulty measurement.
 *
 * Winning continuation from an alternative state is NOT checked here. Do not
 * describe a legal divergent transfer as a "certified alternate winning route".
 */
type Sample = {
  level: number;
  dealId: string;
  provenance: 'ordinary' | 'special' | 'bonus';
  sampledWitnessStates: number;
  statesWithLegalTransfer: number;
  statesWithTwoDistinctTransfers: number;
  statesWithDifferentTransferWhenWitnessTransferred: number;
  statesWithTransferInsteadOfWitnessDraw: number;
  distinctTransferAlternatives: number;
  rejectedOracleTransferCandidates: number;
  example?: { step: number; witnessType: string; alternativeCount: number };
};

const source = [...content8Wave, ...content8Late];
const byLevel = new Map([...content8Special, ...content8BonusDeals]
  .map(deal => [deal.campaignLevel!, deal]));
const mark = (deal: Deal): Sample['provenance'] =>
  deal.id.includes('-special-') ? 'special' : deal.id.includes('-bonus-') ? 'bonus' : 'ordinary';

function pivotIndexes(pathLength: number): Set<number> {
  // Same positions for each route independent of witness action. Prevent
  // first-missed-waste-only selection bias in the previous authoring tool.
  const indexes = new Set<number>();
  for (let p = 0; p <= 12; p++) indexes.add(Math.floor((pathLength - 1) * p / 12));
  return indexes;
}

function inspect(deal: Deal): Sample {
  const steps=deal.winningPath;
  if (!steps.length) throw Error('Empty winning witness: '+deal.id);
  const sample: Sample = {
    level: deal.campaignLevel!, dealId: deal.id, provenance: mark(deal),
    sampledWitnessStates: 0, statesWithLegalTransfer: 0,
    statesWithTwoDistinctTransfers: 0,
    statesWithDifferentTransferWhenWitnessTransferred: 0,
    statesWithTransferInsteadOfWitnessDraw: 0,
    distinctTransferAlternatives: 0, rejectedOracleTransferCandidates: 0
  };
  let board: Board = deal.initial;
  const pivots=pivotIndexes(steps.length);
  for (const [i, action] of steps.entries()) {
    const next=applyBoard(board,action,deal);
    if (typeof next === 'string') throw Error('Invalid published witness '+deal.id+' step '+i+': '+next);
    if (pivots.has(i)) {
      sample.sampledWitnessStates++;
      const chosen=identity(next.board,deal);
      const transferOutcomes=new Set<string>();
      const otherTransfers=new Set<string>();
      for (const candidate of options(board,deal,true)) {
        if (candidate.action.type !== 'transfer') continue;
        // The independent enumerator is only a candidate source: require
        // actual current product Rules v3 to accept the same transfer.
        const result=applyBoard(board,candidate.action as BoardCommand,deal);
        if (typeof result === 'string') {
          sample.rejectedOracleTransferCandidates++;
          continue;
        }
        const key=identity(result.board,deal);
        transferOutcomes.add(key);
        if (key!==chosen) otherTransfers.add(key);
      }
      if (transferOutcomes.size) sample.statesWithLegalTransfer++;
      if (transferOutcomes.size >= 2) sample.statesWithTwoDistinctTransfers++;
      if (action.type==='transfer' && otherTransfers.size)
        sample.statesWithDifferentTransferWhenWitnessTransferred++;
      if (action.type==='draw' && otherTransfers.size)
        sample.statesWithTransferInsteadOfWitnessDraw++;
      sample.distinctTransferAlternatives+=otherTransfers.size;
      if (otherTransfers.size && !sample.example)
        sample.example={step:i,witnessType:action.type,alternativeCount:otherTransfers.size};
    }
    board=next.board;
  }
  if (board.phase!=='won') throw Error('Published witness does not win: '+deal.id);
  return sample;
}

it('independently samples actual Rules3 transfer options on active C8 levels16–80', () => {
  const active=source.map(d=>byLevel.get(d.campaignLevel!) ?? d);
  expect(active).toHaveLength(65);
  expect(active.map(x=>x.campaignLevel)).toEqual(
    Array.from({length:65},(_,index)=>16+index));
  const results=active.map(inspect);
  const total=(key: keyof Sample) => results.reduce((sum,row)=>sum+
    (typeof row[key]==='number' ? row[key] as number : 0),0);
  const report={
    schema:'content8-transfer-availability-sample-v1',
    scope:'actual fresh CORE4/5 C8 deal identities 16–80, 13 evenly-spaced witness states per level',
    caution:'Measures independent legal alternate transfer states only. Does NOT prove their recovery to victory, human decision quality or original competitor parity.',
    levels:results.length,
    ordinary:results.filter(r=>r.provenance==='ordinary').length,
    special:results.filter(r=>r.provenance==='special').map(r=>r.level),
    bonus:results.filter(r=>r.provenance==='bonus').map(r=>r.level),
    sampledWitnessStates:total('sampledWitnessStates'),
    statesWithLegalTransfer:total('statesWithLegalTransfer'),
    statesWithTwoDistinctTransfers:total('statesWithTwoDistinctTransfers'),
    statesWithDifferentTransferWhenWitnessTransferred:total('statesWithDifferentTransferWhenWitnessTransferred'),
    statesWithTransferInsteadOfWitnessDraw:total('statesWithTransferInsteadOfWitnessDraw'),
    distinctTransferAlternatives:total('distinctTransferAlternatives'),
    rejectedOracleTransferCandidates:total('rejectedOracleTransferCandidates'),
    sampleLevels:[17,18,22,30,38,40,45,66,67,78,80].map(level=>
      results.find(row=>row.level===level))
  };
  console.log('C8_TRANSFER_AVAILABILITY '+JSON.stringify(report));
  expect(report.ordinary).toBe(57);
  expect(report.special).toEqual([17,18,26,45,66]);
  expect(report.bonus).toEqual([22,30,40]);
  expect(report.sampledWitnessStates).toBeGreaterThanOrEqual(650);
  // Never assert there MUST be a transfer option; that is precisely what this
  // independent audit is intended to measure before proposing reauthoring.
}, 120000);
