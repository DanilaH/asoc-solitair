import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { playtestShards } from '../../src/content/playtest246-bank';
import { ownThemeRegistry } from '../content/playtest246-recipes';

const cycles={current:[6,6,6,6,7,7,7,7,7,8],azur:[6,8,8,6,10,8,10],
  hybrid:[6,8,8,6,10,8,12,6,8,8,6,10,8,15,6,8,8,6,10,8,12],
  preservedFiveModel:[12,6,10,10,10,15,6,10,10,10]};
const planning=Object.entries(cycles).flatMap(([model,cycle])=>[1000,2000].map(horizon=>{
  const appearances=Array.from({length:horizon},(_,i)=>cycle[i%cycle.length]).reduce((a,b)=>a+b,0);
  const window=(gap:number)=>Math.max(...cycle.map((_,start)=>Array.from({length:gap},(_,i)=>cycle[(start+i)%cycle.length]).reduce((a,b)=>a+b,0)));
  const unique=Math.max(window(162),Math.ceil(appearances/5)),existing=ownThemeRegistry().size,newTopics=Math.max(0,unique-existing);
  const memberDefinitions=newTopics*5;
  // Explicit planning sensitivities, not observed author/editor/art labor rates.
  const costScenarios=[{editorMinutesPerTopic:40,artMinutesPerImage:15},{editorMinutesPerTopic:80,artMinutesPerImage:30},
    {editorMinutesPerTopic:120,artMinutesPerImage:60}].map(input=>({...input,illustratedShare:.25,
      originalImages:Math.ceil(newTopics*.25)*5,editorHours:newTopics*input.editorMinutesPerTopic/60,
      artHours:Math.ceil(newTopics*.25)*5*input.artMinutesPerImage/60}));
  return{model,horizon,appearances,windowMinimums:Object.fromEntries([13,30,60,100,162].map(gap=>[gap,window(gap)])),
    minimumUniqueAtMost5Uses:Math.ceil(appearances/5),minimumUniqueMeetingBothBounds:unique,existingOwnRegistry:existing,
    additionalTopics:newTopics,additionalMemberDefinitions:memberDefinitions,costScenarios,
    caveat:'arithmetic lower bounds, not sufficient for semantic uniqueness; labor inputs are unmeasured what-if assumptions'};
}));
const payload=playtestShards.join(''),admission=JSON.parse(readFileSync('docs/qa/issue246/admission-v1.json','utf8'));
const wordTopics=new Map<string,Set<string>>();
for(const[id,cards]of ownThemeRegistry())for(const card of Object.values(cards).filter(c=>!c.leader)){
  const label=card.text.normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё','е').trim();
  const owners=wordTopics.get(label)??new Set<string>();owners.add(id);wordTopics.set(label,owners);
}
const lexicalOverlap=[...wordTopics].filter(([,owners])=>owners.size>1).map(([label,owners])=>({label,topicIds:[...owners]}));
const attempts=admission.flatMap((r:{attempts:unknown[]})=>r.attempts)as{status:string}[];
const report={registry:ownThemeRegistry().size,sets:24,uniqueLayouts:72,
  packed:{utf8Bytes:Buffer.byteLength(payload),gzipBytes:gzipSync(payload).length},
  lexicalOverlap,semanticAmbiguity:'exact normalized overlap is measured; semantic equivalence and recognition require human review',
  authoring:{sets:admission.length,seedSelectionMs:admission.reduce((n:number,r:{ms:number})=>n+r.ms,0),
    attemptedSeeds:attempts.length,certified:attempts.filter(a=>a.status==='CERTIFIED').length,
    rejections:Object.fromEntries([...new Set(attempts.map(a=>a.status))].map(status=>[status,attempts.filter(a=>a.status===status).length]))},
  sourceAzur:{distinctIds:4539,occurrences:16062,minimumIdGap:162,confidence:'STATIC_CONFIG_NOT_HUMAN_OPTIMUM'},
  current:{campaignLevels:200,dailyDates:400,topicIds:95,separateCampaignIdGap:13,separateDailyIdGap:18},
  planning,promotion:'NONE;1000/2000 are planning horizons, not authorized bank expansion'};
mkdirSync('.recording/issue246',{recursive:true});writeFileSync('.recording/issue246/capacity.json',JSON.stringify(report,null,2)+'\n');
console.log('PLAYTEST246_CAPACITY '+JSON.stringify({...report,planning:undefined}));
