import type { Card, Deal } from '../domain/types';

const categoryNotes: Record<string, string> = {
  music: 'Предметы, на которых играют музыку.',
  drinks: 'Сами напитки. Чашка и другая посуда — это сосуды для них.',
  computer: 'Устройства для работы с компьютером. Мышь здесь — устройство для управления указателем.',
  books: 'Виды литературных произведений. Роман здесь — литературная форма.',
  portable: 'Электронные устройства, которые можно брать с собой.',
};
/** Presentation only: full names and boundaries never change published memberships. */
export function cardReader(card: Card, deal: Deal): { title: string; description?: string } {
  if (card.image) return { title: card.text };
  let description = card.explanation;
  if (card.leader && !card.ordered) {
    const categories = new Set(Object.values(deal.cards).map(c => c.category));
    if (card.category === 'kitchen') {
      description = 'Приспособления, которыми готовят еду.' + (categories.has('dishes') ? ' В этой раздаче посуда для подачи еды и напитков собрана отдельно.' : '');
    } else if (card.category === 'dishes') {
      description = 'Посуда для подачи еды и напитков.' + (categories.has('kitchen') ? ' Приспособления для приготовления еды здесь относятся к кухонной утвари.' : '');
    } else description = categoryNotes[card.category] ?? description;
  }
  return { title: card.text, description };
}
