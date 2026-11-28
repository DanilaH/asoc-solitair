import { content8Cards, extraWords, type Content8TopicSelection } from '../../src/content/content8-words';
import { topics, imageByCard } from '../../src/content/topics';
import subjectArt from '../../src/game/subject-art.json' with { type: 'json' };
import { lateTopics } from '../../src/content/content8-late-topics';
import { beyondCards, beyondRecipes } from '../../src/content/beyond80-topics';
import type { Card, Deal, DifficultyTier } from '../../src/domain/types';
import type { RecipeFeature } from '../../src/content/campaign-meta-recipes';

export const PLAYTEST246 = 'campaign-playtest246-v1';
export const azurWave = [[3,3,3,1],[3,4,3,2],[4,4,4,3],[3,4,3,2],[5,5,5,4],[4,4,4,3],[5,5,5,4]] as const;
export const normalizeLabel = (s: string) => s.normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё','е').trim().replace(/\s+/g,' ');

/** Own registry, including existing early/late and beyond80 words. No vendor vocabulary. */
export function ownThemeRegistry() {
  const categories = new Map<string, Record<string, Card>>();
  for (const id of [...Object.keys(topics), ...Object.keys(lateTopics)] as Content8TopicSelection['id'][]) {
    const all = content8Cards([{ id, count: Object.hasOwn(lateTopics,id) || Object.hasOwn(extraWords,id) ? 6 : 5 }]);
    for (const card of Object.values(all)) {
      const art=(subjectArt as Record<string,string>)[card.text];
      if (!card.leader && art) card.image='art/generated/'+art+'.webp';
    }
    categories.set(id, all);
  }
  for (const recipe of beyondRecipes) {
    const all = Object.values(beyondCards(recipe));
    for (const card of all.filter(c => c.leader)) categories.set(card.category,
      Object.fromEntries(all.filter(c => c.category === card.category).map(c => [c.id,c])));
  }
  return categories;
}

export interface PlaytestRecipe {
  key: string; level: number; dealer: 'azur-exclusive-fy-v1' | 'hitapps-ten-pass-v1';
  groups: number; physical: number; slots: number; columns: number[]; displayTier: number;
  feature?: RecipeFeature; cards: Record<string, Card>; topics: string[];
  source: string;
}
const normalSizes = [36,48,48,36,64,48,64];
const normalGroups = [6,8,8,6,10,8,10];
const kinds: RecipeFeature[] = ['ordered','ice','lock','bound','puzzle','magnet','hammer','gold'];

/** Least-recent scheduling and collision rejection are explicit own policies. */
export function playtestRecipes(): PlaytestRecipe[] {
  const registry = ownThemeRegistry(), last = new Map<string, number>(), rows: PlaytestRecipe[] = [];
  function population(groups: number, total: number, level: number) {
    const base = Math.floor(total/groups)-1, extra = total%groups;
    const cards: Record<string,Card> = {}, selected: string[] = [], labels = new Set<string>();
    for (let group = 0; group < groups; group++) {
      const count = base + Number(group < extra);
      const ranked = [...registry].sort((a,b) => (last.get(a[0]) ?? -1000)-(last.get(b[0]) ?? -1000) ||
        (([...registry.keys()].indexOf(a[0])+level*17)%registry.size)-(([...registry.keys()].indexOf(b[0])+level*17)%registry.size));
      const needImage = group === groups-1;
      let chosen: [string, Card[]] | undefined;
      for (const [id, full] of ranked) {
        if (selected.includes(id)) continue;
        const values = Object.values(full), leader = values.find(c=>c.leader)!;
        const members = values.filter(c=>!c.leader).slice(0,count);
        if (members.length!==count || needImage && !members.every(c=>c.image)) continue;
        const row = [leader,...members], names = row.map(c=>normalizeLabel(c.text));
        if (new Set(names).size!==names.length || names.some(s=>labels.has(s))) continue;
        // Complete image categories, never a missing sixth illustration or false picture.
        const illustrated = members.every(c=>c.image) && (needImage || group%4===0);
        chosen = [id,row.map(c=>{ const {image,...plain}=c; return illustrated && image ? {...plain,image} : plain; })];
        break;
      }
      if (!chosen) throw Error(`Own topic capacity: L${level}, members${count}, image${needImage}`);
      selected.push(chosen[0]); chosen[1].forEach(c=>{cards[c.id]=c;labels.add(normalizeLabel(c.text));});
      last.set(chosen[0],level);
    }
    return { cards, topics: selected };
  }
  for (let index=0;index<21;index++) {
    const level=81+index, pos=index%7, [slots,columns,depth,displayTier]=azurWave[pos];
    const feature = index%2===1 ? kinds[Math.floor(index/2)%kinds.length] : undefined;
    const base: PlaytestRecipe = { key:`azur-${level}`, level, slots, columns:Array.from({length:columns},(_,j)=>depth+j),
      groups:normalGroups[pos], physical:normalSizes[pos], displayTier, feature, dealer:'azur-exclusive-fy-v1',
      ...population(normalGroups[pos],normalSizes[pos],level),
      source:'AZUR static551–2000 geometry; own counts, words, features, RNG adapter and certified budgets' };
    rows.push(base);
    if (pos===6) {
      const peak=index===13 ? {groups:15,physical:98,slots:5,columns:[5,6,7,8,9]} : {groups:12,physical:82,slots:4,columns:[5,6,7,8]};
      rows.push({...base,...peak,key:`hybrid-${level}`,dealer:'hitapps-ten-pass-v1',
        ...population(peak.groups,peak.physical,level),
        source:'Hitapps numeric web geometry THIRD_PARTY_WEB_UNVERIFIED; foundation count ASSUMED; own G12/G15/G12 cadence'});
    }
  }
  return rows;
}

export function playtestTemplate(recipe: PlaytestRecipe): Deal {
  const ids = Object.keys(recipe.cards), tableau = recipe.columns.map(n=>ids.splice(0,n));
  const difficulty: DifficultyTier = recipe.displayTier===4?'superhard':recipe.displayTier===3?'hard':'normal';
  return { id:`playtest246-source-${recipe.key}`, version:1, campaignLevel:recipe.level, title:'Ассоциации',
    cards:recipe.cards, difficultyTier:difficulty, editorialStatus:PLAYTEST246, winningPath:[],
    shufflePolicy:'hidden-pool-r1',shuffleCost:'charge', randomJokerPreview:1,
    extraHelpers:{version:1,randomJokerCoins:300,unlimitedCoins:800,unlimitedMs:60000},
    recovery:{version:1,freeRecycles:2,restoreBase:100,restoreIncrement:50},
    initial:{rulesVersion:3,phase:'playing',tableau,foundations:Array.from({length:recipe.slots},()=>[]),
      stock:ids,waste:[],collected:[],faceUp:tableau.map(p=>p.at(-1)!),movesLeft:450,recyclesLeft:2} };
}
