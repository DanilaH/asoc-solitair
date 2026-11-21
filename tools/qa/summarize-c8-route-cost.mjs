/**
 * Q1b evidence interpretation, deliberately separate from the bounded search.
 * Counts cost of a REPLAYED winning continuation relative to the published
 * witness suffix. No minimum/optimality, player error, or original parity claim.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const transferKinds = ['other-leader','other-transfer','other-target','transfer-vs-stock'];
export const kinds = [...transferKinds,'skip-waste','draw','recycle'];
export const banks = ['campaign','archived','director','bonus-open'];
const phases = ['early','middle','late'];
const countActions = value => !value?.trim() ? 0 : value.trim().split(/\s+/).length;

function describe(rows) {
  const win = rows.filter(x => x.outcome === 'WIN');
  const unknown = rows.filter(x => x.outcome === 'UNKNOWN');
  const noWin = rows.filter(x => x.outcome === 'NO_WIN');
  const deltas = win.map(x => x.actionsVsWitness).sort((a,b)=>a-b);
  const median = values => values.length ? values[Math.floor((values.length-1)/2)] : null;
  const finite = win.map(x => x.movesLeft).filter(Number.isInteger).sort((a,b)=>a-b);
  return {
    probes: rows.length, WIN: win.length, UNKNOWN: unknown.length, NO_WIN: noWin.length,
    foundPathsWithExtraActions: deltas.filter(x=>x>0).length,
    foundPathsWithFewerActions: deltas.filter(x=>x<0).length,
    foundPathsWithEqualActions: deltas.filter(x=>x===0).length,
    routeDeltaRange: deltas.length ? {min:deltas[0], median:median(deltas),max:deltas.at(-1)} : null,
    demonstratedWinsWith0to2MovesLeft: finite.filter(x=>x<=2).length,
    demonstratedWinsThatLoopToPivot: win.filter(x=>x.loopsBack).length,
    demonstratedWinsWithoutLoop: win.filter(x=>!x.loopsBack).length
  };
}

export function summarizeRouteCosts(input,{allowPartial=false}={}) {
  assert(input && input.schema === 1 && Array.isArray(input.rows),'Q1 full audit schema 1 required');
  const rows=input.rows;
  const campaign=rows.filter(x=>x.bank==='campaign');
  assert(campaign.length === (allowPartial ? 1 : 80),'Unexpected main campaign count');
  const canonical=new Set(campaign.map(x=>x.level));
  assert(canonical.size===campaign.length,'Duplicate main campaign level');
  if(!allowPartial)assert.deepEqual([...canonical].sort((a,b)=>a-b),
    Array.from({length:80},(_,i)=>i+1),'Full 1..80 main catalog required');
  for(const row of rows){
    assert(banks.includes(row.bank) && row.dealId && row.dealDigest && Array.isArray(row.probes),'Malformed deal row');
    for(const probe of row.probes){
      assert(kinds.includes(probe.kind) && phases.includes(probe.phase),'Unknown action or phase');
      assert(['WIN','UNKNOWN','NO_WIN'].includes(probe.outcome),'Invalid solver result');
      assert(Number.isInteger(probe.step) && probe.step>=1 && Number.isInteger(probe.witnessRemainingActions),'Missing pivot route metadata');
      if(probe.outcome!=='WIN')continue;
      assert(typeof probe.route==='string' && typeof probe.prefix==='string' && typeof probe.action==='string','Missing winning proof route');
      assert(Number.isInteger(probe.alternativeActions) && Number.isInteger(probe.actionsVsWitness),'Missing Q1b continuation cost');
      assert.equal(probe.alternativeActions,countActions(probe.prefix)+1+countActions(probe.route),
        row.dealId+' full alternative route length');
      assert.equal(probe.actionsVsWitness,probe.alternativeActions-probe.witnessRemainingActions,
        row.dealId+' witness relative cost');
      if(probe.budget!==null){
        assert.equal(probe.movesLeft,probe.budget-probe.alternativeActions,
          row.dealId+' budget from pivot to actual win');
        assert.equal(probe.witnessMovesLeft,probe.budget-probe.witnessRemainingActions,
          row.dealId+' witness budget');
      } else {
        assert.equal(probe.movesLeft,null);
        assert.equal(probe.witnessMovesLeft,null);
      }
    }
  }
  const select = chosen => chosen.flatMap(row=>row.probes.map(probe=>({
    ...probe, bank:row.bank, level:row.level, dealId:row.dealId, slots:row.slots??[]
  })));
  const active=select(campaign);
  const all=select(rows);
  const routeExample = probe => ({
    level:probe.level,dealId:probe.dealId,step:probe.step,phase:probe.phase,kind:probe.kind,
    witness:probe.witness,action:probe.action,prefix:probe.prefix,
    alternativesActions:probe.alternativeActions,witnessRemainingActions:probe.witnessRemainingActions,
    actionsVsWitness:probe.actionsVsWitness,movesLeft:probe.movesLeft,
    proof:probe.proof,loopsBack:probe.loopsBack
  });
  const ranked=[...active].filter(x=>x.outcome==='WIN');
  const worstCost=[...ranked].filter(x=>x.actionsVsWitness>0)
    .sort((a,b)=>b.actionsVsWitness-a.actionsVsWitness || a.movesLeft-b.movesLeft)
    .slice(0,8).map(routeExample);
  const tighter=[...ranked].filter(x=>Number.isInteger(x.movesLeft))
    .sort((a,b)=>a.movesLeft-b.movesLeft || b.actionsVsWitness-a.actionsVsWitness)
    .slice(0,8).map(routeExample);
  const earlyUnknown=active.filter(x=>x.outcome==='UNKNOWN'&&transferKinds.includes(x.kind))
    .sort((a,b)=>a.step-b.step || a.level-b.level).slice(0,10).map(x=>({
      level:x.level,dealId:x.dealId,step:x.step,kind:x.kind,
      phase:x.phase,action:x.action,remainingBudget:x.budget
    }));
  return {
    schema:'content8-q1b-route-cost-v1',
    status:'PRODUCT_MODEL_REPLAY_ONLY',
    caution:'Positive actionsVsWitness measures ONE independently verified winning route relative to ONE authored witness suffix, never the minimum penalty for a mistaken move. UNKNOWN is not unwinnable; sampling follows winning witness states rather than actual users. No original Hitapps/AZUR runtime or Android human evidence.',
    rows:rows.length,mainLevels:campaign.length,
    all:describe(all),main:describe(active),
    mainTransfers:describe(active.filter(x=>transferKinds.includes(x.kind))),
    byKind:Object.fromEntries(kinds.map(k=>[k,describe(active.filter(x=>x.kind===k))])),
    byPhase:Object.fromEntries(phases.map(p=>[p,describe(active.filter(x=>x.phase===p))])),
    byBank:Object.fromEntries(banks.map(b=>[b,describe(all.filter(x=>x.bank===b))])),
    demonstratedExpensiveExamples:worstCost,
    demonstratedTightBudgetExamples:tighter,
    unresolvedEarlyTransferExamples:earlyUnknown
  };
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const source=process.argv[2]??'.authoring/content8/campaign-decisions.json';
  const bytes=readFileSync(source);
  const data=JSON.parse(bytes.toString('utf8'));
  const stats=summarizeRouteCosts(data,{allowPartial:process.argv.includes('--allow-partial')});
  console.log('Q1B_ROUTE_COST '+JSON.stringify({
    ...stats,rawReportSha256:createHash('sha256').update(bytes).digest('hex'),source
  }));
}
