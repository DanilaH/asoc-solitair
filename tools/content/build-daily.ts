/** Offline authoring: freezes 28 new orders and helper-free witnesses. No runtime shuffle. */
import { writeFile } from 'node:fs/promises';
import { cardsFor, imageByCard, type TopicSelection } from '../../src/content/topics';
import { authorInitial, findWitness } from './search';
import type { Deal } from '../../src/domain/types';
const groups: TopicSelection['id'][][] = [
  ['fruit','vegetables','flowers'], ['birds','fish','insects'], ['tools','office','kitchen'], ['dishes','baking','drinks'],
  ['clothes','shoes','hats'], ['trees','forest','weather'], ['road','water','air'], ['furniture','lights','shapes'],
  ['music','sports','office'], ['soups','sweets','baking'], ['space','weather','air'], ['flowers','trees','fruit'],
  ['fish','water','road'], ['tools','furniture','clothes'],
];
const records = [];
for (let i = 0; i < 28; i++) {
  const topics = groups[i % groups.length].map(id => ({ id, count: i % 3 === 0 ? 4 : 3, images: Object.keys(imageByCard).filter(key => key.startsWith(`${id}_`)).map(key => Number(key.split('_').at(-1))).filter(n => n <= (i % 3 === 0 ? 4 : 3)) }));
  const cards = cardsFor(topics), columns = i % 4 === 0 ? 4 : 3;
  let record;
  for (let attempt = 0; attempt < 40; attempt++) {
    const seed = 24001 + i * 701 + attempt;
    const initial = authorInitial({ columns, slots: 2, depth: 2 + i % 2 }, cards, seed);
    const deal: Deal = { id: `daily-pool-${String(i + 1).padStart(2, '0')}`, version: 1, title: 'Задание дня', cards, initial, winningPath: [], editorialStatus: 'Own fixed daily bank; independent human difficulty playtest pending.' };
    const found = findWitness(deal, 12000); if (!found) continue;
    initial.movesLeft = found.path.length + 10;
    record = { id: deal.id, version: 1, topics, initial, winningPath: found.path, authoringSeed: seed, searchVisited: found.visited, editorialStatus: deal.editorialStatus }; break;
  }
  if (!record) throw Error(`No daily witness ${i + 1}`);
  records.push(record); console.info(`${record.id}: ${record.winningPath.length} moves, seed ${record.authoringSeed}`);
}
await writeFile('src/content/daily-pool.json', JSON.stringify(records, null, 2) + '\n');
