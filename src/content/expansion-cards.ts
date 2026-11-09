import { cardsFor, type TopicSelection } from './topics';
import type { Card } from '../domain/types';
export const sequences = {
  rainbow: ['Цвета радуги', ['Красный','Оранжевый','Жёлтый','Зелёный','Голубой','Синий','Фиолетовый']],
  seasons: ['Времена года', ['Зима','Весна','Лето','Осень']],
  numbers: ['Числа по порядку', ['Один','Два','Три','Четыре','Пять','Шесть']],
  roman: ['Римские числа', ['I','II','III','IV','V','VI']],
  week: ['Дни недели', ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']],
  year: ['Месяцы', ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']],
} as const;
export interface ExpansionSelection { topics: TopicSelection[]; sequence?: keyof typeof sequences; keyCards?: string[] }
export function expansionCards(selection: ExpansionSelection): Record<string, Card> {
  const cards = cardsFor(selection.topics);
  if (selection.sequence) {
    const category = selection.sequence, [title, words] = sequences[category];
    cards[category] = { id: category, category, text: title, leader: true, ordered: true, explanation: `Соберите элементы по номерам от 1 до ${words.length}.${category === 'seasons' ? ' Год начинаем с зимы: январь — зимний месяц.' : ''}` };
    words.forEach((text, i) => { const id = `${category}_${i + 1}`; cards[id] = { id, category, text, rank: i + 1, explanation: `${text} — №${i + 1} в порядке категории «${title}».` }; });
  }
  selection.keyCards?.forEach((id, i) => { if (!cards[id]) throw Error('Unknown key card'); cards[id].keyId = `key-${i + 1}`; });
  return cards;
}
