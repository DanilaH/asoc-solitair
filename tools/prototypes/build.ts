/** Authoring of an isolated QA catalogue. Never writes the campaign or daily bank. */
import { mkdir, writeFile } from 'node:fs/promises';
import { cardsFor } from '../../src/content/topics';
import { expansionCards } from '../../src/content/expansion-cards';
import { authorInitial, findWitness } from '../content/search';
import { applyBoard } from '../../src/domain/engine';
import { advance, options, search } from '../qa/gameplay-oracle';
import type { Card, Deal, BoardCommand } from '../../src/domain/types';

export interface Prototype extends Deal { family: string; question: string; criterion?: string }
const fixed = (id: string, title: string, family: string, question: string, cards: Record<string, Card>): Prototype => ({ id: 'qa-' + id, version: 1, title, family, question, cards, initial: { tableau: [], foundations: [], stock: [], waste: [], faceUp: [], collected: [], movesLeft: 100, phase: 'playing' }, winningPath: [], editorialStatus: 'QA-only. Semantic agent review; human clarity/enjoyment unverified.' });
function reclassify(category: string, title: string, criterion: string, sources: string[], rest: Record<string, Card>) {
  const bank = cardsFor([{id:'birds',count:5,images:[4]},{id:'insects',count:5},{id:'air',count:5,images:[1]},{id:'appliances',count:5,images:[2]},{id:'computer',count:5,images:[2]},{id:'city',count:5}]);
  const cards = {...rest, [category]: {id:category,category,text:title,leader:true,explanation:criterion}};
  sources.forEach((source,i)=>{const c=bank[source];if(!c)throw Error('Unknown source');const id=category+'_'+(i+1);cards[id]={...c,id,category,explanation:c.explanation+' '+criterion};}); return cards;
}
const prototypes: Prototype[] = [
  fixed('recognition','Знакомые группы','recognition','Достаточно ли приятно обычное узнавание?',cardsFor([{id:'fruit',count:3,images:[1]},{id:'birds',count:3},{id:'tools',count:3,images:[1]}])),
  fixed('wings','Общий признак','property','Обнаруживает ли человек связь между разными привычными классами?',reclassify('qa_wings','Есть крылья','У всех этих существ и машин есть крылья.',['birds_1','insects_2','air_5'],cardsFor([{id:'fruit',count:3,images:[1]},{id:'tools',count:3,images:[1]}]))),
  fixed('electric','Общая потребность','function','Меняет ли общий принцип способ группировки?',reclassify('qa_electric','Электричество','Этим устройствам для работы нужно электричество.',['computer_1','city_5','appliances_1'],cardsFor([{id:'fruit',count:3,images:[1]},{id:'tools',count:3,images:[1]}]))),
  fixed('buffer','Сначала освободить место','buffer','Замечает ли игрок пользу подготовительного объединения?',cardsFor([{id:'fruit',count:3,images:[1]},{id:'birds',count:3},{id:'tools',count:3,images:[1]}])),
  fixed('interval','Собрать часть порядка','interval','Использует ли игрок интервал до появления начала ряда?',expansionCards({topics:[{id:'fruit',count:3,images:[1]},{id:'birds',count:3}],sequence:'seasons'})),
  fixed('keys','Путь к закрытым картам','keys','Меняется ли приоритет раскрытия из-за ключей?',cardsFor([{id:'clothes',count:3,images:[2]},{id:'dishes',count:3,images:[1]},{id:'flowers',count:3,images:[2]},{id:'tools',count:3,images:[1]}])),
];
const reports: unknown[] = [];
for (const [index,d] of prototypes.entries()) {
  let found = false;
  for(let trial=0;trial<30&&!found;trial++) {
    d.initial=authorInitial({columns:4,depth:index===5?3:2,slots:2},d.cards,92001+index*101+trial);
    let prefix: BoardCommand[]=[];
    if(index<=2){const target=['birds','qa_wings','qa_electric'][index];d.initial.tableau=[['fruit_2',target],[target+'_2','fruit'],['tools_1',target+'_1'],[target+'_3','tools']];d.initial.stock=['fruit_1','tools_2','fruit_3','tools_3'];d.initial.faceUp=d.initial.tableau.map(c=>c.at(-1)!);}
    if(index===3){d.initial.tableau=[['birds_1','fruit'],['tools_1','birds'],['tools','fruit_1'],['fruit_2','birds_2','tools_2']];d.initial.stock=['fruit_3','birds_3','tools_3'];d.initial.faceUp=d.initial.tableau.map(c=>c.at(-1)!);}
    if(index===4){d.initial.tableau=[['seasons_1','fruit_2','seasons'],['fruit','seasons_2'],['birds','seasons_3'],['birds_2','fruit_1']];d.initial.stock=['seasons_4','fruit_3','birds_1','birds_3'];d.initial.faceUp=d.initial.tableau.map(c=>c.at(-1)!);prefix=[{type:'transfer',from:{kind:'tableau',index:1},to:{kind:'tableau',index:2}}];}
    if(index===5){const ids=d.initial.tableau.slice(0,3).map(c=>c[0]);Object.values(d.cards).forEach(c=>delete c.keyId);ids.forEach((id,i)=>d.cards[id].keyId='key-'+(i+1));d.lock={column:3,requiredKeys:['key-1','key-2','key-3']};d.initial.faceUp=d.initial.faceUp.filter(id=>!d.initial.tableau[3].includes(id));}
    let start=d.initial;for(const a of prefix){const r=applyBoard(start,a,d);if(typeof r==='string')throw Error(r);start=r.board;}
    const result=findWitness({...d,initial:start},16000);if(!result||result.path.length>34)continue;
    d.winningPath=[...prefix,...result.path];d.initial.movesLeft=d.winningPath.length+10;
    // Independent implementation checks both legal alternatives and the complete route.
    let b=d.initial,compared=0;
    for(const a of d.winningPath){for(const x of options(b,d)){const p=applyBoard(b,x.action,d);if(typeof p==='string'||JSON.stringify(p.board)!==JSON.stringify(x.board))throw Error('Oracle mismatch');compared++;}const next=advance(b,a,d);if(!next)throw Error('Invalid independent replay');b=next;}
    if(b.phase!=='won')throw Error('Not won');
    const alternatives=options(d.initial,d,true).map(x=>({action:x.action,...search(x.board,d,1500)})).map(({action,status,visited})=>({action,status,visited}));
    reports.push({id:d.id,seed:92001+index*101+trial,moves:d.winningPath.length,budget:d.initial.movesLeft,compared,alternatives});found=true;
  }
  if(!found)throw Error('No accepted prototype '+d.id);
}
await mkdir('tools/prototypes',{recursive:true});
await writeFile('tools/prototypes/deals.json',JSON.stringify(prototypes,null,2)+'\n');
await mkdir('docs/qa/prototypes-2026-11-12',{recursive:true});
await writeFile('docs/qa/prototypes-2026-11-12/validation.json',JSON.stringify(reports,null,2)+'\n');
console.info(JSON.stringify(reports.map((r:any)=>({id:r.id,moves:r.moves,compared:r.compared}))));
