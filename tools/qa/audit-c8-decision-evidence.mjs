#!/usr/bin/env node
/**
 * Independent, NON-BLOCKING research audit of already published Content8
 * CORE-3 passport evidence. These are winning witness samples, NOT proof of
 * human difficulty, source-game parity or absence of alternate branches.
 *
 * Designed to catch the choice-auditor's present coverage bias (only a stock
 * draw after the witness could have transferred a waste card).
 *
 * To obtain transfer-choice evidence, author a separate stratified probe and
 * source/recovery trace rather than reinterpreting the existing passports.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function classifyMove(move) {
  if (move === 'd') return 'stock_draw';
  if (move === 'r') return 'stock_recycle';
  if (typeof move === 'string' &&
      /^(t|f|w)\d+>(t|f|w)\d+$/.test(move)) return 'card_transfer';
  return 'unclassified';
}

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
const sorted = values => [...values].sort((a,b)=>a-b);
function rangeStats(values) {
  if (!values.length) return null;
  const nums=sorted(values);
  return { min: nums[0], median: nums[Math.floor((nums.length-1)/2)],
           max: nums.at(-1) };
}
function profile(rows) {
  const alternatives=rows.flatMap(row => row.choices.choices.map(c=>({
    level: row.level, move: c.move, type: classifyMove(c.move),
    extraActions: c.extraActions, missedWaste: c.missedWaste
  })));
  const distribution=Object.fromEntries(['stock_draw','stock_recycle','card_transfer','unclassified']
    .map(kind => [kind, alternatives.filter(x=>x.type===kind).length]));
  return {
    levels: rows.length, levelRange: rows.length?[Math.min(...rows.map(x=>x.level)),
      Math.max(...rows.map(x=>x.level))]:null,
    witnessedRoutes: rows.length,
    witnessRecycles: sum(rows,'recycles'),
    levelsWithWitnessRecycle: rows.filter(x=>x.recycles>0).map(x=>x.level),
    witnessForcedStockActions:sum(rows,'forcedStock'),
    witnessOptionalStockActions:sum(rows,'optionalStock'),
    witnessSteps:sum(rows,'steps'),
    witnessSlack:rangeStats(rows.map(x=>x.slack)),
    choiceProbesTested:rows.reduce((n,r)=>n+r.choices.tested,0),
    choiceProbesUnresolved:rows.reduce((n,r)=>n+r.choices.unresolved,0),
    sourceNamedOtherWins:rows.reduce((n,r)=>n+r.choices.otherWins,0),
    certifiedSelectedAlternatives:alternatives.length,
    alternativesByType:distribution,
    alternativesThatMissWaste: alternatives.filter(c=>c.missedWaste).length,
    shorterAlternatives:alternatives.filter(c=>c.extraActions<0).length,
    longerAlternatives:alternatives.filter(c=>c.extraActions>0).length,
    equalAlternatives:alternatives.filter(c=>c.extraActions===0).length
  };
}
function validate(rows) {
  if (!Array.isArray(rows)||!rows.length)throw Error('No passport rows');
  const seen=new Set();
  for(const row of rows) {
    if (!Number.isInteger(row.level)||seen.has(row.level)) throw Error('Duplicate/invalid passport level: '+row.level);
    seen.add(row.level);
    if (!row.choices || !Array.isArray(row.choices.choices) ||
        !Number.isInteger(row.choices.tested) || !Number.isInteger(row.choices.unresolved) ||
        !Number.isInteger(row.choices.otherWins)) throw Error('Incomplete choice provenance at '+row.level);
    if (!Number.isInteger(row.recycles) || row.recycles<0 ||
        !Number.isInteger(row.steps) || row.steps<=0 ||
        !Number.isInteger(row.slack) || row.slack<0) throw Error('Incomplete winning witness: '+row.level);
    for(const choice of row.choices.choices) {
      if (!Number.isInteger(choice.extraActions) || typeof choice.missedWaste!=='boolean' ||
          classifyMove(choice.move)==='unclassified')
        throw Error('Unclassifiable choice evidence at '+row.level);
    }
  }
}

export function summarize(rows) {
  validate(rows);
  const data=sorted(rows.map(x=>x.level));
  for(let i=1;i<data.length;i++) if(data[i]!==data[i-1]+1)
    throw Error('Noncontiguous passport levels between '+data[i-1]+' and '+data[i]);
  const early=rows.filter(x=>x.level>=16&&x.level<=31);
  const late=rows.filter(x=>x.level>=32&&x.level<=80);
  const all=profile(rows),lateInfo=profile(late);
  const lateProfiles=Object.fromEntries([
    ['rest',44],['standard',64],['hard',78],['peak',96]
  ].map(([label,cards])=>[label,{
    cards, ...profile(late.filter(x=>x.cards===cards))
  }]));
  const warnings=[];
  if (all.alternativesByType.card_transfer===0)
    warnings.push('NO_DIFFERENT_TRANSFER_BRANCH_CERTIFIED');
  if (all.certifiedSelectedAlternatives===all.alternativesThatMissWaste)
    warnings.push('ALL_SELECTED_ALTERNATIVES_ARE_MISSED_WASTE_ACTIONS');
  if (lateInfo.levels && lateInfo.witnessRecycles===0)
    warnings.push('NO_RECYCLE_IN_LATE_RECORDED_WINNING_WITNESSES');
  if (all.choiceProbesUnresolved>0)
    warnings.push('CHOICE_PROBES_UNRESOLVED_ARE_NOT_LOSS_PROOFS');
  return {
    schema:'content8-independent-choice-evidence-audit-v1',
    evidence:'published CORE-3 JSON witness passports only; NOT human gameplay',
    stages:{early:profile(early),late:lateInfo,lateProfiles},
    all,warnings,
    note:'No warning proves missing game mechanics or bad balance. The current authoring gate prioritizes missed-waste draw probes; add stratified different-transfer probes and human replay before difficulty acceptance.'
  };
}
export function loadPublishedPassports() {
  const from = path => JSON.parse(readFileSync(new URL(path, import.meta.url),'utf8'));
  return [...from('../../docs/qa/content-v8/core3-passports.json'),
          ...from('../../docs/qa/content-v8/core3-late-passports.json')]
    .sort((a,b)=>a.level-b.level);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result=summarize(loadPublishedPassports());
  console.log(JSON.stringify(result,null,2));
  if(process.argv.includes('--strict-transfer-coverage') &&
     result.warnings.includes('NO_DIFFERENT_TRANSFER_BRANCH_CERTIFIED'))process.exitCode=2;
}
