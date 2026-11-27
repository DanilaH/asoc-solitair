import { DAILY_CALENDAR, EXTENDED_CHAPTER } from '../config/campaign-meta';
import type { Card, Deal, DifficultyTier } from '../domain/types';
import { beyondCards, beyondRecipes } from './beyond80-topics';
import { imageByCard, topics, cardsFor, type TopicId } from './topics';

const oldTopics = Object.keys(topics) as TopicId[];
const ownTopics: Record<string, Card>[] = [
  ...oldTopics.map(id => cardsFor([{ id, count: 5, images: Object.keys(imageByCard)
    .filter(card => card.startsWith(id + '_')).map(card => Number(card.split('_')[1])) }])),
  ...beyondRecipes.flatMap(recipe => {
    const cards = Object.values(beyondCards(recipe));
    return cards.filter(card => card.leader).map(leader => Object.fromEntries(cards
      .filter(card => card.category === leader.id).map(card => [card.id, card])));
  }),
];

export type RecipeFeature = 'ordered' | 'ice' | 'lock' | 'bound' | 'puzzle' | 'magnet' | 'hammer' | 'gold';
export interface MetaRecipe {
  topics: number[];
  size: number;
  columns: number;
  slots: number;
  budget: number;
  difficulty: DifficultyTier;
  feature?: RecipeFeature;
}

const numberOfTopics = ownTopics.length;
const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();

function recipes(count: number, daily: boolean): MetaRecipe[] {
  const last = new Array<number>(numberOfTopics).fill(-1000);
  const cycles = ['ordered', 'ice', 'lock', 'bound', 'puzzle', 'magnet', 'hammer', 'gold'] as const;
  return Array.from({ length: count }, (_, index) => {
    const group = index % 10;
    const difficulty = daily ? (group === 9 ? 'hard' : 'normal') : group === 9 ? 'superhard' : group === 4 || group === 7 ? 'hard' : 'normal';
    const size = 3 + (daily ? index % 2 : index % 3);
    const topicCount = daily ? 4 + (index % 4 === 3 ? 2 : index % 3 > 0 ? 1 : 0) : 6 + (group >= 4 ? 1 : 0) + (group === 9 ? 1 : 0);
    const columns = daily ? 3 + index % 3 : 4 + Number(group >= 5);
    const slots = daily ? 3 + Number(topicCount === 6) : 4 + Number(group === 9);
    const words = new Set<string>(), selected: number[] = [];
    const rotation = (Math.imul(index + 7, daily ? 71 : 59) >>> 0) % numberOfTopics;
    const ranked = ownTopics.map((_, id) => id).sort((a, b) => last[a] - last[b] ||
      (a + rotation) % numberOfTopics - (b + rotation) % numberOfTopics);
    for (const id of ranked) {
      const labels = Object.values(ownTopics[id]).slice(0, size + 1).map(card => normalize(card.text));
      if (new Set(labels).size !== labels.length || labels.some(label => words.has(label))) continue;
      selected.push(id);
      for (const label of labels) words.add(label);
      last[id] = index;
      if (selected.length === topicCount) break;
    }
    if (selected.length !== topicCount) throw Error('Not enough distinct themes');
    const feature = daily ? index % 9 === 8 ? cycles[index % 2] : undefined : index % 3 === 2 ? cycles[Math.floor(index / 3) % cycles.length] : undefined;
    const budget = daily ? 48 + topicCount * 7 + size * 3 : 54 + topicCount * 8 + size * 4 + (difficulty === 'superhard' ? 5 : 0);
    return { topics: selected, size, columns, slots, budget, difficulty, feature };
  });
}

export const extendedRecipes = recipes(EXTENDED_CHAPTER.count, false);
export const dailyRecipes = recipes(DAILY_CALENDAR.count, true);

export function metaTemplate(recipe: MetaRecipe, id: string, level: number): Deal {
  const cards = Object.assign({}, ...recipe.topics.map(id => Object.fromEntries(Object.entries(ownTopics[id]).slice(0, recipe.size + 1)))) as Deal['cards'];
  const ids = Object.keys(cards);
  const tableau = Array.from({ length: recipe.columns }, (_, column) => ids.splice(0, (recipe.columns < 4 ? 2 : 3) + column % 3));
  return { id, campaignLevel: level, version: 1, title: 'Ассоциации', cards, difficultyTier: recipe.difficulty,
    editorialStatus: 'authored-expansion-v1', winningPath: [], initial: { rulesVersion: 3, phase: 'playing', tableau,
      foundations: Array.from({ length: recipe.slots }, () => []), stock: ids, waste: [], collected: [],
      faceUp: tableau.map(pile => pile.at(-1)!), movesLeft: recipe.budget } };
}
