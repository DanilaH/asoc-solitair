import { cardsFor } from './topics';
import { withCurrentRules } from './current-rules';
import type { BoardCommand, Card, Command, Deal } from '../domain/types';

const move = (from: number, to: number, foundation = true): BoardCommand => ({ type: 'transfer', from: { kind: 'tableau', index: from }, to: { kind: foundation ? 'foundation' : 'tableau', index: to } });
const make = (level: number, title: string, cards: Record<string, Card>, tableau: string[][], path: BoardCommand[], options: Partial<Deal> = {}): Deal => ({
  id: `campaign-${String(level).padStart(3, '0')}`, version: 1, campaignLevel: level, title, cards,
  initial: { tableau, foundations: [[], []], stock: [], waste: [], faceUp: tableau.map(c => c.at(-1)!).filter(Boolean), collected: [], movesLeft: path.length + 6, phase: 'playing' },
  winningPath: path, editorialStatus: 'Authored development teaching chapter; rules/witness verified, release pacing pending.', ...options,
});
const jokerLesson = make(21, 'Место для манёвра', cardsFor([{ id: 'fruit', count: 2, images: [1] }, { id: 'birds', count: 2 }]),
  [['birds_2', 'fruit'], ['fruit_2', 'birds'], ['birds_1', 'fruit_1']],
  [move(0, 0), move(1, 1), move(2, 0), move(2, 1), move(0, 1), move(1, 0)], { tags: ['joker', 'teaching'] });
jokerLesson.tutorialPath = [
  { type: 'place-joker', column: 0 }, move(2, 0, false), move(2, 1, false), move(1, 1),
  move(1, 2, false), move(0, 2, false), move(0, 0), move(2, 0), move(0, 1),
] satisfies Command[];
const jokerApply = make(22, 'Свободная опора', cardsFor([{ id: 'flowers', count: 2, images: [2] }, { id: 'trees', count: 2 }, { id: 'fish', count: 2, images: [2] }]),
  [['trees_2', 'flowers'], ['flowers_2', 'trees'], ['fish_2', 'trees_1', 'flowers_1']],
  [move(0, 0), move(1, 1), move(2, 0), move(2, 1), move(0, 1), move(1, 0), { type: 'draw' }, { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: 0 } }, move(2, 0), { type: 'draw' }, { type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: 'foundation', index: 0 } }], { tags: ['joker', 'application'] });
jokerApply.initial.stock = ['fish', 'fish_1'];

function ordered(category: string, title: string, entries: string[]): Record<string, Card> {
  const cards: Record<string, Card> = { [category]: { id: category, category, text: title, leader: true, ordered: true, explanation: `Карта порядка. Соберите ${entries.length} элементов, начиная с №1, без пропусков.` } };
  entries.forEach((text, i) => { const id = `${category}_${i + 1}`; cards[id] = { id, category, text, rank: i + 1, explanation: `${text} — элемент №${i + 1} из ${entries.length} в категории «${title}».` }; });
  return cards;
}
const days = make(23, 'По порядку', ordered('days', 'Дни недели', ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']),
  [['days_7', 'days'], ['days_5', 'days_3', 'days_1'], ['days_6', 'days_4', 'days_2']],
  [move(0, 0), ...[1, 2, 1, 2, 1, 2, 0].map(i => move(i, 0))], { tags: ['ordered', 'teaching'] });
const months = make(24, 'Круглый год', ordered('months', 'Месяцы', ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']),
  [['months_12', 'months_9', 'months_6', 'months_3', 'months'], ['months_10', 'months_7', 'months_4', 'months_1'], ['months_11', 'months_8', 'months_5', 'months_2']],
  [move(0, 0), ...Array.from({ length: 12 }, (_, i) => move((i + 1) % 3, 0))], { tags: ['ordered', 'application'] });
const lockLesson = make(25, 'Три ключа', cardsFor([{ id: 'dishes', count: 3, images: [1] }, { id: 'clothes', count: 3, images: [2] }]),
  [['dishes_1', 'dishes'], ['clothes_1', 'clothes'], ['dishes_2', 'clothes_2'], ['clothes_3', 'dishes_3']],
  [move(0, 0), move(1, 1), move(2, 1), move(0, 0), move(2, 0), move(3, 0), move(1, 1), move(3, 1)], { tags: ['keys', 'teaching'], lock: { column: 3, requiredKeys: ['key-a', 'key-b', 'key-c'] } });
const lockApply = make(26, 'За последним замком', cardsFor([{ id: 'office', count: 3, images: [1] }, { id: 'baking', count: 3, images: [1] }, { id: 'sweets', count: 2 }]),
  [['sweets_1', 'office_1', 'office'], ['office_2', 'baking_1', 'baking'], ['baking_2', 'sweets'], ['sweets_2', 'baking_3', 'office_3']],
  [move(0, 0), move(1, 1), move(2, 2), move(0, 0), move(1, 1), move(0, 2), move(1, 0), move(3, 0), move(3, 1), move(3, 2), move(2, 1)], { tags: ['keys', 'application'], lock: { column: 3, requiredKeys: ['key-a', 'key-b', 'key-c'] } });
lockApply.initial.foundations.push([]);
for (const [deal, ids] of [[lockLesson, ['dishes_1', 'clothes_1', 'dishes_2']], [lockApply, ['sweets_1', 'office_2', 'baking_2']]] as const) {
  ids.forEach((id, i) => { deal.cards[id].keyId = deal.lock!.requiredKeys[i]; });
  deal.initial.faceUp = deal.initial.faceUp.filter(id => !deal.initial.tableau[deal.lock!.column].includes(id));
}
export const modifierDeals: readonly Deal[] = [jokerLesson, jokerApply, days, months, lockLesson, lockApply].map(withCurrentRules);
