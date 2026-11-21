/** Pure Q1b analysis of the *recorded* winning alternatives. No solver, no vendor claims. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const BANKS = ['campaign', 'archived', 'director', 'bonus-open'];
const KINDS = ['other-leader','other-transfer','other-target','transfer-vs-stock','skip-waste','draw','recycle'];
const PHASES = ['early','middle','late'];
const countMoves = (s) => s === '' ? 0 : s.trim().split(/\s+/).length;
const int = (value) => Number.isSafeInteger(value) && value >= 0;
const fail = (message) => { throw Error('Q1b source invalid: ' + message); };
function stats(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const percentile = p => a[Math.floor((a.length-1)*p)];
  return { min:a[0], p25:percentile(.25), median:percentile(.5), p75:percentile(.75), max:a.at(-1) };
}
function tally(probes) {
  const wins = probes.filter(p=>p.outcome==='WIN');
  const rated = wins.filter(p=>p.extraMovesVsWitness !== null);
  return {
    probes:probes.length, wins:wins.length, unknown:probes.filter(p=>p.outcome==='UNKNOWN').length,
    noWinProven:probes.filter(p=>p.outcome==='NO_WIN').length,
    nonLoopingWins:wins.filter(p=>p.loopsBack===false).length,
    knownMoveDeltas:rated.length,
    cheaperThanWitness:rated.filter(p=>p.extraMovesVsWitness<0).length,
    equalToWitness:rated.filter(p=>p.extraMovesVsWitness===0).length,
    costlierThanWitness:rated.filter(p=>p.extraMovesVsWitness>0).length,
    costlyAtLeast5:rated.filter(p=>p.extraMovesVsWitness>=5).length,
    costlyAtLeast10:rated.filter(p=>p.extraMovesVsWitness>=10).length,
    deltaMoves:stats(rated.map(p=>p.extraMovesVsWitness)),
    nonLoopingDeltas:stats(rated.filter(p=>!p.loopsBack).map(p=>p.extraMovesVsWitness))
  };
}
/**
 * A win route's extraMovesVsWitness is an observed route-length difference,
 * NOT a globally optimal regret/minimal recovery cost and NOT human difficulty.
 */
export function analyzeQ1Decisions(report) {
  if (!report || report.schema!==1 || !Array.isArray(report.rows)) fail('expected Q1 schema=1, rows[]');
  const identifiers=new Set();
  const probes=[];
  const rows=[];
  for (const row of report.rows) {
    if (!BANKS.includes(row.bank) || !int(row.level) || row.level<1 || row.level>80 ||
        typeof row.dealId!=='string' || !row.dealId ||
        !Array.isArray(row.slots) || !Array.isArray(row.probes) ||
        !(row.budget===null || int(row.budget)) ||
        !int(row.witnessLength) || !row.witnessLength) fail('row identity/witness/budget');
    const id=[row.bank,row.dealId,[...row.slots].sort().join('+')].join(':');
    if (identifiers.has(id)) fail('duplicate scenario '+id);
    identifiers.add(id);
    if (row.budget!==null && row.budget < row.witnessLength) fail('winning witness exceeds budget: '+id);
    const baselineMovesLeft=row.budget===null?null:row.budget-row.witnessLength;
    const perRow=[];
    for (const p of row.probes) {
      if (!p || !KINDS.includes(p.kind) || !PHASES.includes(p.phase) ||
          !['WIN','UNKNOWN','NO_WIN'].includes(p.outcome) ||
          !int(p.step) || p.step<1 || p.step>row.witnessLength ||
          typeof p.action!=='string' || !p.action ||
          typeof p.witness!=='string' || !p.witness ||
          typeof p.prefix!=='string' ||
          !(p.budget===null || int(p.budget))) fail('invalid probe '+id);
      const expectedBudget=row.budget===null?null:row.budget-p.step+1;
      if (p.budget!==expectedBudget) fail('budget inconsistent at '+id+' step='+p.step);
      if (p.outcome==='WIN' &&
          (typeof p.route!=='string' || typeof p.loopsBack!=='boolean' ||
           !(p.movesLeft===null || int(p.movesLeft)))) fail('incomplete WIN '+id);
      if (p.outcome==='WIN' && p.movesLeft!==null && baselineMovesLeft===null) fail('mixed unlimited budget '+id);
      if (p.outcome==='WIN' && p.movesLeft===null && baselineMovesLeft!==null) fail('missing finite winner budget '+id);
      if (p.outcome==='WIN' && row.budget!==null) {
        const expectedLeft=row.budget-(p.step-1)-countMoves(p.prefix)-1-countMoves(p.route);
        if (expectedLeft !== p.movesLeft) fail('winning route move conservation '+id+' step='+p.step);
      }
      const extraMovesVsWitness=p.outcome==='WIN' && baselineMovesLeft!==null ? baselineMovesLeft-p.movesLeft : null;
      const record={bank:row.bank,level:row.level,dealId:row.dealId,slots:row.slots,
        kind:p.kind,phase:p.phase,step:p.step,action:p.action,witness:p.witness,
        outcome:p.outcome,proof:p.proof??null,loopsBack:p.outcome==='WIN'?p.loopsBack:null,
        witnessMovesLeft:baselineMovesLeft,
        alternativeMovesLeft:p.outcome==='WIN'?p.movesLeft:null,extraMovesVsWitness};
      probes.push(record);
      perRow.push(record);
    }
    rows.push({bank:row.bank,level:row.level,dealId:row.dealId,slots:row.slots,
      witnessLength:row.witnessLength,witnessMovesLeft:baselineMovesLeft,
      ...tally(perRow)});
  }
  const primary=rows.filter(r=>r.bank==='campaign');
  if (primary.length!==80 ||
      primary.map(r=>r.level).sort((a,b)=>a-b).some((n,i)=>n!==i+1)) fail('full active 1-80 campaign not present');
  const active=probes.filter(p=>p.bank==='campaign');
  const expensive=active.filter(p=>p.extraMovesVsWitness!==null&&p.extraMovesVsWitness>0)
    .sort((a,b)=>b.extraMovesVsWitness-a.extraMovesVsWitness||a.level-b.level);
  const cheaper=active.filter(p=>p.extraMovesVsWitness!==null&&p.extraMovesVsWitness<0)
    .sort((a,b)=>a.extraMovesVsWitness-b.extraMovesVsWitness||a.level-b.level);
  const unresolved=active.filter(p=>p.outcome==='UNKNOWN');
  const transferKinds=new Set(['other-leader','other-transfer','other-target','transfer-vs-stock']);
  const unknownTransfers=unresolved.filter(p=>transferKinds.has(p.kind));
  return {
    schema:'c8-decision-witness-cost-v1',
    methodology:'Q1 selected winning routes vs authored witness; neither optimal regret nor human error cost.',
    rows:rows.length,
    campaign:tally(active),
    transfers:tally(active.filter(p=>transferKinds.has(p.kind))),
    byBank:Object.fromEntries(BANKS.map(k=>[k,tally(probes.filter(p=>p.bank===k))])),
    byKind:Object.fromEntries(KINDS.map(k=>[k,tally(active.filter(p=>p.kind===k))])),
    byPhase:Object.fromEntries(PHASES.map(k=>[k,tally(active.filter(p=>p.phase===k))])),
    unknownTransfersByKind:Object.fromEntries([...transferKinds].map(k=>[k,unknownTransfers.filter(p=>p.kind===k).length])),
    exampleExpensive:expensive.slice(0,12),
    exampleCheaper:cheaper.slice(0,12),
    exampleUnknownTransfer:unknownTransfers.slice(0,18),
    campaignRows:primary.sort((a,b)=>a.level-b.level),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const src=process.argv[2]??'.authoring/content8/campaign-decisions.json';
  const target=process.argv[3]??'.authoring/content8/campaign-decision-cost.json';
  const original=readFileSync(src,'utf8');
  const report=analyzeQ1Decisions(JSON.parse(original));
  report.inputSha256=createHash('sha256').update(original).digest('hex');
  mkdirSync(resolve(target,'..'),{recursive:true});
  writeFileSync(target,JSON.stringify(report)+'\n');
  const compact={schema:report.schema,inputSha256:report.inputSha256,campaign:report.campaign,
    transfers:report.transfers,byKind:report.byKind,byPhase:report.byPhase,
    unknownTransfersByKind:report.unknownTransfersByKind,
    exampleExpensive:report.exampleExpensive.slice(0,5),
    exampleCheaper:report.exampleCheaper.slice(0,5)};
  console.log('C8_DECISION_COST '+JSON.stringify(compact));
}
