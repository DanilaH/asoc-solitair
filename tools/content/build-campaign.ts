/** Offline authoring only. Runtime loads fixed orders and witnesses from campaign.json. */
import { writeFile } from 'node:fs/promises';
import { cardsFor, type TopicSelection } from '../../src/content/topics';
import { authorInitial as initial, findWitness as find } from './search';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';

const t = (from: number, to: number): BoardCommand => ({ type: 'transfer', from: { kind: 'tableau', index: from }, to: { kind: 'foundation', index: to } });
const w = (to: number): BoardCommand => ({ type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: to } });
const draw: BoardCommand = { type: 'draw' };
interface Plan { title: string; topics: TopicSelection[]; columns: number; depth: number; slots: number; slack: number | null; tags: string[]; seeds: number[]; minRecycle?: number }
const picks = (ids: TopicSelection['id'][], count: number, images: Record<string, number[]> = {}): TopicSelection[] => ids.map(id => ({ id, count, ...(images[id] ? { images: images[id] } : {}) }));
const plans: Plan[] = [
  { title: 'Найдите общее', topics: picks(['fruit','birds'],2), columns:2,depth:3,slots:2,slack:null,tags:['tutorial-transfer','leader','flip'],seeds:[1] },
  { title: 'Ещё одна карта', topics:picks(['dishes','clothes'],3,{clothes:[2]}),columns:2,depth:2,slots:2,slack:null,tags:['tutorial-stock','images'],seeds:[2] },
  { title: 'Небольшая подсказка', topics:picks(['vegetables','flowers','tools'],3),columns:3,depth:2,slots:2,slack:12,tags:['hint-demo','finite-budget'],seeds:[31,32,33] },
  { title: 'Можно передумать', topics:picks(['shoes','hats','furniture'],3),columns:3,depth:3,slots:2,slack:12,tags:['undo','completion-undo'],seeds:[45,46,47] },
  { title: 'Узнать по картинке', topics:picks(['fruit','birds','tools'],4,{fruit:[1],birds:[4],tools:[1]}),columns:3,depth:3,slots:2,slack:10,tags:['images','packet'],seeds:[51,52,53] },
  { title: 'Домашние мелочи', topics:picks(['kitchen','dishes','lights'],4,{dishes:[1],lights:[4]}),columns:3,depth:3,slots:2,slack:9,tags:['mixed-words','staging'],seeds:[67,68,69] },
  { title: 'За городом', topics:picks(['trees','insects','forest'],4,{trees:[4]}),columns:3,depth:3,slots:2,slack:9,tags:['packet','nature'],seeds:[73,74,75] },
  { title: 'Четыре стопки', topics:picks(['road','water','air','space'],3,{road:[1],water:[3],air:[1]}),columns:4,depth:3,slots:3,slack:12,tags:['four-columns','images'],seeds:[82,83,84] },
  { title: 'На своём месте', topics:picks(['office','music','sports','shapes'],4,{music:[2],sports:[3],office:[1],shapes:[1]}),columns:4,depth:3,slots:3,slack:12,tags:['long-titles','four-columns'],seeds:[91,92,93] },
  { title: 'К чаю', topics:picks(['baking','sweets','drinks','soups'],4,{baking:[1],sweets:[3],drinks:[1]}),columns:4,depth:3,slots:3,slack:10,tags:['four-categories','images'],seeds:[103,104,105] },
  { title: 'Перед прогулкой', topics:picks(['clothes','shoes','hats','weather'],4,{clothes:[2],shoes:[2],hats:[4],weather:[2]}),columns:4,depth:3,slots:2,slack:10,tags:['two-slots','category-queue'],seeds:[116,117,118] },
  { title: 'Не торопитесь', topics:picks(['tools','kitchen','office','music'],5,{tools:[1],office:[1],music:[2]}),columns:4,depth:4,slots:3,slack:12,tags:['long-words','dense-field'],seeds:[123,124,125] },
  { title: 'Живые связи', topics:picks(['birds','fish','insects','forest','flowers'],4,{birds:[4],fish:[2],flowers:[2]}),columns:4,depth:3,slots:3,slack:12,tags:['five-categories','mixed-images'],seeds:[132,133,134] },
  { title: 'Под одной крышей', topics:picks(['furniture','lights','dishes','clothes'],5,{furniture:[1],lights:[4],dishes:[1],clothes:[2]}),columns:4,depth:4,slots:2,slack:12,tags:['dense-field','two-slots'],seeds:[147,148,149] },
  { title: 'Полезные вещи', topics:picks(['office','sports','tools','music'],5,{sports:[3],tools:[1],music:[2]}),columns:4,depth:4,slots:3,slack:9,tags:['long-words','packets'],seeds:[153,154,155] },
  { title: 'Дальняя дорога', topics:picks(['road','water','air','weather','space'],4,{road:[1],water:[3],air:[1],weather:[2]}),columns:4,depth:3,slots:3,slack:12,tags:['five-categories','stock-use'],seeds:[162,163,164] },
  { title: 'Длинные названия', topics:picks(['shapes','office','kitchen','music'],5,{shapes:[1],music:[2]}),columns:4,depth:4,slots:2,slack:12,tags:['long-titles','long-words','dense-field'],seeds:[174,175,176] },
  { title: 'Ещё один круг', topics:picks(['vegetables','flowers','trees','fish','forest'],3,{vegetables:[1],flowers:[2],fish:[2]}),columns:4,depth:1,slots:2,slack:12,tags:['repeated-stock-cycle','images'],seeds:[184,185,186],minRecycle:2 },
  { title: 'Ход в ход', topics:picks(['baking','sweets','soups','drinks','dishes'],5,{baking:[1],sweets:[3],drinks:[1],dishes:[1]}),columns:4,depth:4,slots:3,slack:0,tags:['last-move-win','five-categories'],seeds:[193,194,195] },
  { title: 'Всё сошлось', topics:picks(['tools','furniture','clothes','hats','lights'],5,{tools:[1],furniture:[1],clothes:[2],hats:[4],lights:[4]}),columns:4,depth:4,slots:3,slack:12,tags:['chapter-finale','dense-field','five-categories'],seeds:[203,204,205] },
];
const records=[];
for(const [index,plan]of plans.entries()){
  const level=index+1,cards=cardsFor(plan.topics);let board:Board,path:BoardCommand[],chosenSeed=0,visited=0;
  if(level===1){board={tableau:[['fruit_2','birds_1','fruit'],['birds_2','fruit_1','birds']],foundations:[[],[]],stock:[],waste:[],faceUp:['fruit','birds'],collected:[],movesLeft:null,phase:'playing'};path=[t(0,0),t(1,1),t(0,1),t(0,0),t(1,0),t(1,1)];}
  else if(level===2){board={tableau:[['dishes_1','dishes'],['clothes_1','clothes']],foundations:[[],[]],stock:['dishes_2','clothes_2','dishes_3','clothes_3'],waste:[],faceUp:['dishes','clothes'],collected:[],movesLeft:null,phase:'playing'};path=[t(0,0),t(1,1),t(0,0),t(1,1),draw,w(0),draw,w(1),draw,w(0),draw,w(1)];}
  else if(level===18){
    const [a,b,c,d,e]=plan.topics.map(t=>t.id);
    const stock:string[]=[];
    for(let i=1;i<=3;i++){ stock.push(`${e}_${i}`,`${c}_${i}`,`${d}_${i}`); if(i===3)stock.push(e); stock.push(`${a}_${i}`,`${b}_${i}`); }
    board={tableau:[[a],[b],[c],[d]],foundations:[[],[]],stock,waste:[],faceUp:[a,b,c,d],collected:[],movesLeft:200,phase:'playing'};
    path=[t(0,0),t(1,1)];
    for(const id of stock){path.push(draw);if(id.startsWith(a+'_'))path.push(w(0));else if(id.startsWith(b+'_'))path.push(w(1));}
    path.push(w(0),t(2,1),{type:'recycle'});
    for(let i=1;i<=3;i++){
      path.push(draw,w(0));if(i===3)path.push(t(3,0));
      path.push(draw,w(1),draw);if(i===3)path.push(w(0));
    }
    path.push({type:'recycle'},draw,w(0),draw,w(0));
    board.movesLeft=path.length+plan.slack!;
  }
  else {
    let found:ReturnType<typeof find>=null;board=initial(plan,cards,plan.seeds[0]);path=[];
    for(let attempt=0;attempt<60;attempt++){
      const seed=plan.seeds[attempt%plan.seeds.length]+Math.floor(attempt/plan.seeds.length)*1000;
      const candidate=initial(plan,cards,seed), deal:Deal={id:'draft',version:1,title:plan.title,cards,initial:candidate,winningPath:[],editorialStatus:'draft'};
      found=find(deal);
      if(found&&found.path.filter(c=>c.type==='recycle').length>=(plan.minRecycle??0)){board=candidate;path=found.path;chosenSeed=seed;visited=found.visited;break;}
      found=null;
    }
    if(!found)throw Error(`No suitable witness for level ${level}`);
    board.movesLeft=path.length+plan.slack!;
  }
  records.push({id:`campaign-${String(level).padStart(3,'0')}`,version:1,campaignLevel:level,title:plan.title,topics:plan.topics,initial:board,winningPath:path,tags:plan.tags,authoringSeed:chosenSeed,searchVisited:visited,editorialStatus:'Авторская редактура слов, пояснений и пересечений внутри раздачи; независимый человеческий плейтест ещё не выполнен.'});
  console.info(`${level}: ${path.length} moves, ${path.filter(c=>c.type==='recycle').length} recycle, seed ${chosenSeed}, ${visited} visits`);
}
await writeFile('src/content/campaign.json',JSON.stringify(records,null,2)+'\n');
