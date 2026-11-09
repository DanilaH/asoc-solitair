/** Offline authored release candidate. Runtime never shuffles these orders. */
import { writeFile } from 'node:fs/promises';
import { cardsFor, imageByCard, type TopicId, type TopicSelection } from '../../src/content/topics';
import { expansionCards, sequences } from '../../src/content/expansion-cards';
import { authorInitial, findWitness } from './search';
import type { Deal } from '../../src/domain/types';
const pairs: TopicId[][] = [
 ['pets','building','spices'],['sea','appliances','books'],['reptiles','computer','grains'],['berries','bath','jobs'],
 ['nuts','house','genres'],['dairy','portable','dances'],['cutlery','gems','games'],['metals','fabrics','city'],
 ['pets','cutlery','music'],['sea','fabrics','flowers'],['building','dairy','birds'],['books','appliances','trees'],
 ['genres','grains','tools'],['games','bath','fish'],['dances','computer','fruit'],['city','nuts','insects'],
 ['house','spices','water'],['gems','portable','vegetables'],
];
const titles = ['На знакомых местах','Новые соседи','Собрать по смыслу','Дом и природа','Найти свою полку','Среди предметов','В нужном кругу','Одна за другой','Связи рядом','Знакомые формы','Всему своё место','Тихая партия','Точные совпадения','Большая уборка','Поймать ритм','Из разных миров','Почти собрано','Последняя связь'];
const records = [], started = performance.now();
for (let i = 0; i < 54; i++) {
  const level = i + 27, block = Math.floor(i / 18), local = i % 18;
  const mode = i === 53 ? 'keys' : [3,8,13,17].includes(local) ? 'ordered' : [5,10,15].includes(local) || i === 53 ? 'keys' : 'ordinary';
  const ids = pairs[local], count = 3 + (block > 0 && local % 2 === 0 ? 1 : 0);
  const pick = (id: TopicId): TopicSelection => ({ id, count, images: Object.keys(imageByCard).filter(k => k.startsWith(`${id}_`)).map(k => Number(k.split('_').at(-1))).filter(n => n <= count) });
  const sequence = mode === 'ordered' ? Object.keys(sequences)[(block * 4 + [3,8,13,17].indexOf(local)) % 6] as keyof typeof sequences : undefined;
  const topics = (sequence ? ids.slice(0, block === 0 ? 1 : 2) : mode === 'keys' ? [...ids, (['shoes','hats','weather'][block] as TopicId)] : ids).map(pick);
  const baseCards = expansionCards({ topics, sequence }); let record;
  for (let attempt = 0; attempt < 50; attempt++) {
    const seed = 80001 + i * 977 + attempt;
    const columns = mode === 'ordinary' && block === 0 && local % 2 ? 3 : 4;
    const initial = authorInitial({ columns, slots: columns === 3 ? 2 : 3, depth: block === 2 ? 3 : 2 }, baseCards, seed);
    const keyCards = mode === 'keys' ? initial.tableau.slice(0, 3).map(col => col[block === 2 ? 0 : col.length - 2]) : undefined;
    const cards = keyCards ? expansionCards({ topics, keyCards }) : baseCards;
    const lock = keyCards ? { column: 3, requiredKeys: ['key-1','key-2','key-3'] } : undefined;
    if (lock) initial.faceUp = initial.faceUp.filter(id => !initial.tableau[3].includes(id));
    const deal: Deal = { id: `campaign-${String(level).padStart(3,'0')}`, version: 1, campaignLevel: level, title: i === 53 ? 'Всё на своих местах' : `${mode === 'keys' ? 'За тремя ключами' : sequence ? sequences[sequence][0] : titles[local]}${block ? ` · ${block + 1}` : ''}`, cards, initial, lock, winningPath: [], editorialStatus: 'Original fixed release-candidate puzzle; witness/semantic edit verified; independent human difficulty session pending.' };
    const found = findWitness(deal, 12000);
    if (!found || found.path.length > 62 || found.path.filter(c => c.type === 'recycle').length > 1) continue;
    initial.movesLeft = found.path.length + (block === 0 ? 12 : block === 1 ? 10 : 8);
    record = { ...deal, cards: undefined, topics, ...(sequence ? { sequence } : {}), ...(keyCards ? { keyCards } : {}), winningPath: found.path, authoringSeed: seed, searchVisited: found.visited, tags: [mode, `chapter-${Math.floor((level-1)/20)+1}`] }; break;
  }
  if (!record) throw Error(`No witness for ${level} (${mode})`);
  records.push(record); console.info(`${level}: ${mode}, ${record.winningPath.length} moves, seed ${record.authoringSeed}`);
}
await writeFile('src/content/expansion.json', JSON.stringify(records, null, 2) + '\n');
console.info(`Authored ${records.length} candidates in ${Math.round(performance.now()-started)} ms. Human difficulty not measured.`);
