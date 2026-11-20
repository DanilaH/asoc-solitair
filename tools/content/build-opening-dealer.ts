import { createHash, randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { content8Cards, extraWords } from '../../src/content/content8-words';
import type { TopicSelection } from '../../src/content/topics';
import old from '../../src/content/campaign-v8-preview.json';
import source from '../../docs/qa/content-v8/hitapps-local-1-31.json';
import { applyBoard, assertBoard, sourceCards } from '../../src/domain/engine';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';
import { findReferenceRoute, referenceActions } from './reference-route';
import { dealOrdinary } from './plain-dealer';
import { preparePriorityPlan } from './candidate-pipeline';

type Topic = TopicSelection['id'];
const opening: readonly Topic[][] = [
  ['fruit','clothes','tools','birds'],
  ['vegetables','shoes','lights','office','dishes','fish'],
  ['flowers','trees','gems','furniture','books','water','games','metals','birds','tools'],
  ['clothes','sports','drinks','jobs','road','spices','shoes','office','air','trees'],
  ['fruit','fish','lights','dishes','tools','office','gems','furniture','weather','air'],
];
const lessonRamp = [[16,5,4],[28,17,6],[36,22,7],[46,30,8],[60,42,10]] as const;
const labels = ['Первая тема','Карты из колоды','Подсказка в деле','Ход назад','Кому отдать верхний слот'];
const ramp = process.env.C8_RAMP === 'source' ? 'source' : 'lesson';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const transfers = (xs: BoardCommand[]) => xs.filter(x => x.type === 'transfer');
const root = '.authoring/content8-onboarding/'+ramp;
await mkdir(root,{recursive:true});
function topicsFor(ids: readonly Topic[], total: number) {
  const base = Math.min(5, Math.floor((total - ids.length) / ids.length));
  let pending = total - (base + 1) * ids.length;
  const topics = ids.map((id) => ({ id, count: base }));
  for (const topic of topics) if (pending > 0 && (base < 5 || extraWords[topic.id])) { topic.count++; pending--; }
  if (pending) throw Error('Missing original vocabulary');
  return topics;
}
function replay(deal: Deal, path: BoardCommand[], start = deal.initial) {
  let b = start;
  for (const action of path) { const x = applyBoard(b,action,deal); if(typeof x==='string')return; const independent=advance(b,action,deal);
    if (JSON.stringify(independent)!==JSON.stringify(x.board)) throw Error('Oracle mismatch: '+deal.id); b=x.board; }
  return b;
}
function consequences(deal: Deal, path: BoardCommand[], expensive: boolean) {
  let state = deal.initial, forced=0, longest=0, covered=0, buffer=0;
  const misses: {step:number; action:BoardCommand}[] = [];
  const slots: {step:number; action:BoardCommand}[] = [];
  for(const [step,act] of path.entries()){
    const available=referenceActions(state,deal);
    if(act.type==='transfer') {
      forced=0; if(act.to.kind==='tableau' && state.tableau[act.to.index].length===0) buffer++;
      if(act.from.kind==='waste' && act.to.kind==='foundation' && path[step+1]?.type==='draw') misses.push({step,action:act});
      if (state.foundations.filter(a=>!a.length).length===1 && act.to.kind==='foundation' && !state.foundations[act.to.index].length) {
        for(const move of available) if(move.type==='transfer' && move.to.kind==='foundation' && !state.foundations[move.to.index].length &&
          sourceCards(state,move.from,deal)[0]!==sourceCards(state,act.from,deal)[0]) slots.push({step,action:move});
      }
    } else if(!transfers(available).length) longest=Math.max(longest,++forced);
    else { covered++; forced=0; }
    const next=applyBoard(state,act,deal); if(typeof next==='string')throw Error(next); state=next.board;
  }
  const routes: {kind:string;step:number;extra:number;full:BoardCommand[]}[] = [];
  for (const {step,action} of misses.slice().reverse()) {
    const full:BoardCommand[]=[...path.slice(0,step),...path.slice(step+1),{type:'recycle'},{type:'draw'},action];
    if(replay(deal,full)?.phase==='won'){routes.push({kind:'miss-recycle',step,extra:full.length-path.length,full});break;}
  }
  if(expensive) for(const {step,action} of slots.slice(0,5)) {
    const first=[...path.slice(0,step),action], start=replay(deal,first);
    if(!start)continue;
    const repaired=findReferenceRoute(deal,start,300);
    if(repaired.status==='FOUND'){
      const full=[...first,...repaired.path];
      if(replay(deal,full)?.phase==='won') {routes.push({kind:'last-slot',step,extra:full.length-path.length,full});break;}
    }
  }
  return {buffer,longest,chosenStock:covered,competingSlots:slots.length,routes};
}

const from=Number(process.env.C8_FIRST??1), to=Number(process.env.C8_LAST??15);
for(let level=from;level<=to;level++){
  const ref=source[level-1], prev=old.find(row=>row.campaignLevel===level);
  const [total,stockSize,categories]=level===8 ? [34,20,6] : level<=5 && ramp==='lesson' ? lessonRamp[level-1] : [ref.cards,ref.stock,ref.categories];
  const cols=level===8 ? 4 : ref.columns, slots=level===5 || level===8 ? 3 : level<=2 || (level===3 && ramp==='lesson') ? 2 : cols;
  const labels8=level===8?'Место для джокера':prev?.title??labels[level-1];
  const topics=level<=5 ? topicsFor(opening[level-1].slice(0,categories),total) : level===8 ? topicsFor(prev!.topics.slice(0,categories).map(topic=>topic.id as Topic),total) : prev!.topics as TopicSelection[];
  const cards=content8Cards(topics), ids=Object.keys(cards);
  const lengths=prev && level!==8 ? prev.initial.tableau.map(x=>x.length) : Array.from({length:cols},(_,i)=>
    Math.floor((total-stockSize+i)/cols));
  const startLimit=level===1?null:level===8?68:level<=5&&ramp==='lesson'?[null,56,70,86,130][level-1]:prev?.initial.movesLeft??ref.baseMoves;
  const design={id:'campaign-c8-dealer-'+String(level).padStart(3,'0'),title:labels8,campaignLevel:level,version:1,editorialStatus:'playtest',tags:['ordinary-dealer']};
  let count=0;
  const seedOffset=Number(process.env.C8_SEED_OFFSET??0), target=Number(process.env.C8_TARGET??(startLimit===null?total+stockSize:Math.round(startLimit*.89)));
  const tolerance=15;
  const seeds=Array.from({length:100},(_,i)=>level*10000+i+seedOffset+1+(ramp==='source'?2500:0));
  const plan = preparePriorityPlan({
    requests: seeds,
    drawSeed: bound => randomInt(bound),
    target,
    tolerancePercent: tolerance,
    shuffle(seed) {
      const { stock, tableau } = dealOrdinary(ids, stockSize, lengths, seed);
      const faceUp = tableau.flatMap(col => col.slice(-1));
      return { tableau, stock, faceUp, foundations: Array.from({ length: slots }, () => []),
        waste: [], collected: [], movesLeft: startLimit, phase: 'playing', rulesVersion: 3 } satisfies Board;
    },
    digest,
    evaluate({ snapshot: initial }) {
      if (!initial.faceUp.some(id => cards[id].leader)) return;
      if (level >= 5 && initial.tableau.some(col => col.length > 1 && col.every(id => cards[id].category === cards[col[0]].category))) return;
      const deal: Deal = { ...design, initial, cards, winningPath: [] };
      assertBoard(initial, deal);
      const path = findReferenceRoute(deal, initial, level === 5 ? 1500 : 650);
      if (path.status !== 'FOUND' || (startLimit !== null && startLimit - path.path.length < 3)) return;
      if (replay(deal, path.path)?.phase !== 'won') throw Error('Candidate replay');
      const metrics = consequences(deal, path.path, [5, 6, 11, 15].includes(level));
      count++;
      if (level >= 5 && metrics.longest > 9) return;
      if (level === 5 && (!metrics.buffer || !metrics.competingSlots || !metrics.routes.some(x => x.kind === 'miss-recycle'))) return;
      return { steps: path.path.length, value: { witness: path.path, metrics } };
    },
  });
  const auditBase = {
    level, ramp, target, tolerance, limits: startLimit, lengths, auditedWins: count,
    sourceBuild: 'Hitapps 1.26.2/code3742', localLevelPosition: ref.position,
    configDigest: digest({ topics, cards, ids, stockSize, lengths, slots, startLimit, target, tolerance }),
    authoredLevelVersion: design.version, strategy: 'Adapted', candidateCount: plan.attempts,
    selectedBy: plan.reason, moveBudgetBase: startLimit,
  };
  const selected = plan.selected;
  if (!selected) {
    await writeFile(root + '/level-' + level + '.json', JSON.stringify({ record: null, audit: auditBase }) + '\n');
    console.log(level, 'NO WIN IN WINDOW', count);
    continue;
  }
  const { actualSeed, requestedSeed, evaluation, final, afterShuffle } = selected;
  const record = { ...design, initial: final.snapshot, winningPath: evaluation.witness, topics };
  if (replay({ ...record, cards }, record.winningPath)?.phase !== 'won') throw Error('Final candidate replay');
  const audit = {
    ...auditBase, seed: actualSeed, requestedSeed, actualSeed, metrics: evaluation.metrics,
    afterShuffleHash: digest(afterShuffle.snapshot), postFinalHash: digest(final.snapshot),
    appliedFeatureFlags: final.appliedFlags, failedFeatureFlags: final.failedFlags,
    moveBudgetEffective: final.snapshot.movesLeft, independentWinningWitness: digest(record.winningPath),
    evaluatedPolicies: [{ policyId: 'asoc-rules3-reference-route', result: 'WON', steps: selected.steps, terminalReason: 'all-categories-completed' }],
    proofLevel: 'MODEL_CROSSCHECK',
  };
  await writeFile(root + '/level-' + level + '.json', JSON.stringify({ record, audit }) + '\n');
  console.log(level, actualSeed, selected.steps, audit.limits, audit.metrics.longest, audit.metrics.buffer,
    audit.metrics.competingSlots, audit.metrics.routes.map(x => [x.kind, x.extra]));
}
