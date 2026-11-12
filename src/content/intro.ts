import type { BoardCommand, Card, Deal, Location } from '../domain/types';
const cards: Record<string, Card> = {};
const explanations: Record<string, string> = {
  'Яблоко': 'Плод яблони с сочной мякотью и семенами внутри.',
  'Слива': 'Небольшой сочный плод с гладкой кожицей и одной косточкой.',
  'Персик': 'Сочный плод с бархатистой кожицей и крупной косточкой.',
  'Груша': 'Сладкий плод грушевого дерева, обычно расширенный у основания.',
  'Синица': 'Небольшая певчая птица. У большой синицы жёлтая грудка и чёрная полоса на ней.',
  'Дятел': 'Птица с крепким клювом, которой она долбит древесину в поисках пищи.',
  'Скворец': 'Певчая птица с тёмным переливчатым оперением, часто селится в скворечниках.',
  'Сова': 'Хищная птица с крупными глазами; многие виды охотятся ночью.',
  'Отвёртка': 'Инструмент, которым закручивают и откручивают винты и шурупы.',
  'Пила': 'Инструмент с зубчатым полотном для разрезания древесины и других материалов.',
  'Гаечный ключ': 'Инструмент для затягивания и отворачивания гаек и болтов.',
  'Молоток': 'Ручной ударный инструмент, например для забивания гвоздей.',
};
const categories = [
  ['fruit', 'Фрукты', ['Яблоко', 'Слива', 'Персик', 'Груша']],
  ['bird', 'Птицы', ['Синица', 'Дятел', 'Скворец', 'Сова']],
  ['tool', 'Инструменты', ['Отвёртка', 'Пила', 'Гаечный ключ', 'Молоток']],
] as const;
for (const [category, title, words] of categories) {
  cards[category] = { id: category, category, text: title, leader: true, explanation: 'Карта категории. Соберите на неё четыре подходящие карты.' };
  words.forEach((text, index) => {
    const id = category + (index + 1);
    cards[id] = { id, category, text, explanation: explanations[text],
      ...(index === 3 ? { image: `art/${category}.svg` } : {}) };
  });
}
const t = (from: number, to: number, foundation = true): BoardCommand => ({ type: 'transfer', from: { kind: 'tableau', index: from }, to: { kind: foundation ? 'foundation' : 'tableau', index: to } });
const w = (to: number, foundation = true): BoardCommand => ({ type: 'transfer', from: { kind: 'waste', index: 0 }, to: { kind: foundation ? 'foundation' : 'tableau', index: to } });
const draw: BoardCommand = { type: 'draw' };
/** Legacy control deal, never selected for a new normal campaign/daily attempt. */
export const introDeal: Deal = {
  id: 'intro-001', version: 1, title: 'Найдите общее', cards,
  editorialStatus: 'Самостоятельная редактура: бытовые непересекающиеся категории. Независимый человеческий плейтест ещё не выполнен.',
  initial: {
    rulesVersion: 2,
    tableau: [['fruit3', 'tool2', 'fruit'], ['bird3', 'fruit1', 'bird'], ['tool3', 'bird1', 'tool']],
    foundations: [[], []], stock: ['fruit2', 'bird2', 'tool1', 'fruit4', 'bird4', 'tool4'], waste: [],
    faceUp: ['fruit', 'bird', 'tool'], collected: [], movesLeft: 32, phase: 'playing',
  },
  winningPath: [t(0, 0), t(1, 1), t(0, 2, false), t(0, 0), t(1, 0), t(1, 1), draw, w(0), draw, w(1), draw, w(2, false), draw, w(0), t(2, 0), t(2, 1), t(2, 0), draw, w(1), draw, w(0)],
};
export const locationLabel = (loc: Location) => loc.kind === 'foundation' ? 'верхний слот' : loc.kind === 'waste' ? 'сброс' : 'столбец';
