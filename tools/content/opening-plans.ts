import {cardsFor,type TopicSelection} from '../../src/content/topics';
import {modifierDeals} from '../../src/content/modifiers';
import type {Deal,Card} from '../../src/domain/types';
const cases:{name:string;topics:TopicSelection[];table:string[][];slots:number;stock?:string[];open?:boolean;days?:boolean;lock?:number;keys?:string[]}[]=[
{name:'3-merge',topics:[{id:'fruit',count:2,images:[1]},{id:'clothes',count:2,images:[2]}],table:[['a','b1'],['b','a1'],['a2','b2']],slots:2,open:true},
{name:'4-space',topics:[{id:'birds',count:2},{id:'fish',count:2},{id:'flowers',count:2,images:[2]}],table:[['a'],['a1','b','c1'],['c','c2','b1'],['b2','a2']],slots:1,open:true},
{name:'6-joker',topics:[{id:'dishes',count:2,images:[1]},{id:'lights',count:2},{id:'music',count:2,images:[2]}],table:[['c1','b1','a'],['a1','c2','b'],['a2','b2','c']],slots:1,open:true},
{name:'7-priority',topics:[{id:'road',count:2,images:[1]},{id:'air',count:2,images:[1]},{id:'water',count:2}],table:[['c1','b1','a'],['a1','c2','b'],['a2','b2','c']],slots:1,open:true},
{name:'8-reveal',topics:[{id:'furniture',count:3,images:[1]},{id:'lights',count:3},{id:'tools',count:3,images:[1]}],table:[['a','a1','b1'],['b','b2','c1'],['c','c2','a2'],['a3','b3','c3']],slots:2,open:true},
{name:'10-interval',topics:[{id:'fruit',count:3,images:[1]}],days:true,table:[['d7','d'],['a','d1','d3'],['d6','d4','d2'],['a3','a2','a1','d5']],slots:2,open:true},
{name:'12-keys',topics:[{id:'birds',count:3},{id:'trees',count:3}],table:[['a1','a'],['b1','b'],['a2','b2'],['b3','a3']],slots:2,lock:3,keys:['a1','b1','a2']},
{name:'13-keys-plan',topics:[{id:'dishes',count:3,images:[1]},{id:'clothes',count:3,images:[2]},{id:'sweets',count:2}],table:[['c1','a1','a'],['a2','b1','b'],['b2','c'],['c2','b3','a3']],slots:2,lock:3,keys:['c1','a2','b2']},
{name:'15-finale',topics:[{id:'fruit',count:2,images:[1]},{id:'trees',count:2}],days:true,table:[['d7','a1','d'],['a','d1','d3'],['b','d4','d2'],['a2','b2','b1','d6','d5']],slots:2,lock:3,keys:['a1','d1','d4']},
];
export function openingPlans():Deal[]{return cases.map(p=>{
const cards:Record<string,Card>=cardsFor(p.topics);if(p.days)Object.assign(cards,structuredClone(modifierDeals.find(d=>d.id==='campaign-023')!.cards));const decode=(s:string)=>{if(s[0]==='d')return s==='d'?'days':'days_'+s.slice(1);return p.topics[s.charCodeAt(0)-97].id+(s.length>1?'_'+s.slice(1):'');};
const tableau=p.table.map(c=>c.map(decode)),faceUp=p.open?tableau.flat():tableau.filter((_,i)=>i!==p.lock).map(c=>c.at(-1)!);const deal:Deal={id:p.name,version:1,title:p.name,campaignLevel:6,cards,initial:{rulesVersion:3,tableau,foundations:Array.from({length:p.slots},()=>[]),stock:(p.stock??[]).map(decode),waste:[],faceUp,collected:[],movesLeft:null,phase:'playing'},winningPath:[],editorialStatus:'candidate'};if(p.lock!==undefined){deal.lock={column:p.lock,requiredKeys:['key-a','key-b','key-c']};p.keys!.forEach((s,i)=>deal.cards[decode(s)].keyId=deal.lock!.requiredKeys[i]);}
return deal;});}
