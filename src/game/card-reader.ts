import type { Board, Card, Deal } from '../domain/types';
import { cardArtwork } from './art';
import { puzzleHalf } from '../domain/puzzle-pairs';

const categoryNotes: Record<string, string> = {
  music: 'Предметы, на которых играют музыку.',
  drinks: 'Сами напитки. Чашка и другая посуда — это сосуды для них.',
  computer: 'Устройства для работы с компьютером. Мышь здесь — устройство для управления указателем.',
  books: 'Виды литературных произведений. Роман здесь — литературная форма.',
  portable: 'Электронные устройства, которые можно брать с собой.',
};
/** Presentation only: full names and boundaries never change published memberships. */
export function cardReader(card: Card, deal: Deal, board?: Board): { title: string; description?: string } {
  let description = cardArtwork(card, deal) ? undefined : card.explanation;
  if (card.leader && !card.ordered) {
    const categories = new Set(Object.values(deal.cards).map(c => c.category));
    if (card.category === 'kitchen') {
      description = 'Приспособления, которыми готовят еду.' + (categories.has('dishes') ? ' В этой раздаче посуда для подачи еды и напитков собрана отдельно.' : '');
    } else if (card.category === 'dishes') {
      description = 'Посуда для подачи еды и напитков.' + (categories.has('kitchen') ? ' Приспособления для приготовления еды здесь относятся к кухонной утвари.' : '');
    } else description = categoryNotes[card.category] ?? description;
  }
  const status = board?.hitapps?.cards[card.id];
  const notes = [
    status?.lock && status.lock.collected < status.lock.required && `Замок. Ключи: ${status.lock.collected} из ${status.lock.required}.`,
    status?.key && !status.key.used && `Ключи: ${status.key.amount}.`,
    status?.ice && `Лёд. Слоёв: ${status.ice}.`,
    status?.bound === 2 && 'Карта связана. Для разрезания нужны ножницы.',
    status?.scissors && 'Ножницы разрезают связку.',
    status?.order && `Позиция в теме: ${status.order}.`,
    status?.gold?.health && `Золотая карта. Зарядов: ${status.gold.health}.`,
    puzzleHalf(deal, card.id) && 'Половинка. Найдите вторую часть.',
  ].filter(Boolean);
  description = [description, ...notes].filter(Boolean).join(' ') || undefined;
  return { title: card.text, description };
}
