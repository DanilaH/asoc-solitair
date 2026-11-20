import type { Card } from '../domain/types';
import { lateTopics } from './content8-late-topics';
import { cardsFor, type TopicSelection } from './topics';

type LateTopicId = keyof typeof lateTopics;
export type Content8TopicSelection = Omit<TopicSelection, 'id'> & { id: TopicSelection['id'] | LateTopicId };
const isLateTopic = (id: Content8TopicSelection['id']): id is LateTopicId => Object.hasOwn(lateTopics, id);

/** New original entries, used by Content 8 only. Existing revisions retain their card sets. */
export const extraWords: Partial<Record<TopicSelection['id'], readonly [string, string][]>> = {
  fruit: [['Айва', 'Плотный ароматный плод, который часто варят для варенья.']],
  vegetables: [['Редька', 'Корнеплод с белой мякотью и острым вкусом.']],
  birds: [['Свиристель', 'Птица с хохолком, зимой питается ягодами.']],
  tools: [['Струбцина', 'Зажим для неподвижного удержания деталей.']],
  flowers: [['Георгин', 'Садовый цветок с крупным соцветием из многих лепестков.']],
  trees: [['Липа', 'Лиственное дерево, чьи душистые цветы собирают для чая.']],
  insects: [['Цикада', 'Насекомое, известное громким стрекотом.']],
  fish: [['Налим', 'Пресноводная рыба из семейства тресковых.']],
  dishes: [['Супница', 'Большая глубокая посуда для подачи супа.']],
  clothes: [['Пиджак', 'Верхняя часть костюма с рукавами и лацканами.']],
  shoes: [['Мокасины', 'Мягкая обувь без жёсткой застёжки.']],
  hats: [['Котелок', 'Жёсткая шляпа с округлой тульей и небольшими полями.']],
  furniture: [['Буфет', 'Шкаф или тумба для хранения и подачи посуды.']],
  lights: [['Прожектор', 'Мощный источник направленного света.']],
  music: [['Кларнет', 'Духовой музыкальный инструмент с одной тростью.']],
  road: [['Самокат', 'Небольшое колёсное средство с площадкой для ног и рулём.']],
  water: [['Баржа', 'Плоскодонное грузовое судно для перевозки по воде.']],
  air: [['Гидросамолёт', 'Самолёт, который может взлетать с воды и садиться на неё.']],
  space: [['Пульсар', 'Звезда, от которой приходят регулярные импульсы излучения.']],
  weather: [['Град', 'Осадки в виде кусочков льда.']],
  office: [['Дырокол', 'Приспособление для отверстий в листах бумаги.']],
  baking: [['Слойка', 'Небольшое изделие из слоёного теста.']],
  soups: [['Солянка', 'Суп с насыщенным бульоном и солёными ингредиентами.']],
  drinks: [['Морс', 'Напиток из ягодного сока, воды и сахара.']],
  appliances: [['Вентилятор', 'Прибор, создающий поток воздуха вращением лопастей.']],
  building: [['Пеноблок', 'Блок из лёгкого ячеистого бетона для стен.']],
  gems: [['Шпинель', 'Минерал, который используют как ограночный камень.']],
  jobs: [['Фармацевт', 'Специалист по изготовлению и отпуску лекарств.']],
  fabrics: [['Фланель', 'Мягкая ткань с небольшим начёсом.']],
  games: [['Регби', 'Командная игра с овальным мячом.']],
};

export function content8Cards(topics: readonly Content8TopicSelection[]) {
  const cards: Record<string, Card> = {};
  for (const { id, count, images } of topics) {
    if (!isLateTopic(id)) {
      Object.assign(cards, cardsFor([{ id, count: Math.min(5, count), images }]));
      continue;
    }
    const [text, entries] = lateTopics[id];
    cards[id] = { id, category: id, text, leader: true, explanation: 'Карта категории. Подберите к ней все подходящие карточки.' };
    for (const [index, entry] of entries.slice(0, count).entries()) {
      const [text, explanation] = entry.split('|'), key = `${id}_${index + 1}`;
      cards[key] = { id: key, category: id, text, explanation };
    }
  }
  for (const { id, count } of topics) {
    if (isLateTopic(id)) continue;
    // Early Content 8 seeds depend on extra members following the base bank.
    for (let n = 6; n <= count; n++) {
      const entry = extraWords[id]?.[n - 6];
      if (!entry) throw Error(`Нет нового слова ${id}_${n}`);
      const key = `${id}_${n}`;
      cards[key] = { id: key, category: id, text: entry[0], explanation: entry[1] };
    }
  }
  return cards;
}
