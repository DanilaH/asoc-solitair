import type { BoardCommand, Card, Deal, Location } from '../domain/types';
const cards: Record<string, Card> = {};
const categories = [
  ['fruit', 'Фрукты', ['Яблоко', 'Слива', 'Персик', 'Груша']],
  ['bird', 'Птицы', ['Синица', 'Дятел', 'Скворец', 'Сова']],
  ['tool', 'Инструменты', ['Отвёртка', 'Пила', 'Гаечный ключ', 'Молоток']],
] as const;
for (const [category, title, words] of categories) {
  cards[category] = { id: category, category, text: title, leader: true, explanation: 'Карта категории. Соберите на неё четыре подходящие карты.' };
  words.forEach((text, index) => {
    const id = category + (index + 1);
    cards[id] = { id, category, text, explanation: `${text} — ${category === 'fruit' ? 'съедобный плод фруктового дерева.' : category === 'bird' ? 'птица; относится к группе птиц на этом поле.' : 'ручной инструмент для работы.'}`,
      ...(index === 3 ? { image: `art/${category}.svg` } : {}) };
  });
}
const t = (from: number, to: number, foundation = true): BoardCommand => ({ type: 'transfer', from: { kind: 'tableau', index: from }, to: { kind: foundation ? 'foundation' : 'tableau', index: to } });
const w = (to: number, foundation = true): BoardCommand => ({ type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: foundation ? 'foundation' : 'tableau', index: to } });
const draw: BoardCommand = { type: 'draw' };
export const introDeal: Deal = {
  id: 'intro-001', version: 1, title: 'Найдите общее', cards,
  editorialStatus: 'Самостоятельная редактура: бытовые непересекающиеся категории. Независимый человеческий плейтест ещё не выполнен.',
  initial: {
    tableau: [['fruit3', 'tool2', 'fruit'], ['bird3', 'fruit1', 'bird'], ['tool3', 'bird1', 'tool']],
    foundations: [[], []], stock: ['fruit2', 'bird2', 'tool1', 'fruit4', 'bird4', 'tool4'], waste: [],
    faceUp: ['fruit', 'bird', 'tool'], collected: [], movesLeft: 32, phase: 'playing',
  },
  winningPath: [t(0, 0), t(1, 1), t(0, 2, false), t(0, 0), t(1, 0), t(1, 1), draw, w(0), draw, w(1), draw, w(2, false), draw, w(0), t(2, 0), t(2, 1), t(2, 0), draw, w(1), draw, w(0)],
};
export const locationLabel = (loc: Location) => loc.kind === 'foundation' ? 'верхний слот' : loc.kind === 'waste' ? 'сброс' : 'столбец';
