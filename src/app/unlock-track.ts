import { CAMPAIGN_CORE_STAGE1 } from '../config/hitapps-r4';
import { completedLevels, dailyModeAvailable, dailyTasksAvailable, HELPER_UNLOCK, RELEASE_UNLOCK } from '../domain/progression';
import type { Save } from '../domain/types';

const historicalUnlocks = [
  { id: 'bonus', at: RELEASE_UNLOCK.bonus - 1, icon: 'gift', name: 'Бонус дня' },
  { id: 'hint', at: HELPER_UNLOCK.hint - 1, icon: 'hint', name: 'Подсказка' },
  { id: 'undo', at: HELPER_UNLOCK.undo - 1, icon: 'undo', name: 'Отмена' },
  { id: 'combo', at: RELEASE_UNLOCK.combo - 1, icon: 'cycle', name: 'Комбо' },
  { id: 'foundation', at: RELEASE_UNLOCK.foundation - 1, icon: 'link', name: 'Дополнительный слот' },
  { id: 'daily', at: RELEASE_UNLOCK.daily - 1, icon: 'dailyDeal', name: 'Ежедневные раздачи и календарь' },
  { id: 'tasks', at: RELEASE_UNLOCK.tasks - 1, icon: 'task', name: 'Задания' },
  { id: 'joker', at: HELPER_UNLOCK.joker - 1, icon: 'joker', name: 'Джокер' },
  { id: 'table', at: 10, icon: 'looks', name: 'Стол «Чернила»' },
  { id: 'tableau', at: RELEASE_UNLOCK.tableau - 1, icon: 'draw', name: 'Дополнительный столбец' },
  { id: 'recovery', at: RELEASE_UNLOCK.recovery - 1, icon: 'joker', name: 'Восстановление колоды и случайный Джокер' },
  { id: 'ordered', at: 16, icon: 'link', name: 'Порядок карт и половинки' },
  { id: 'keys', at: 17, icon: 'key', name: 'Ключи и замки' },
  { id: 'ice', at: 18, icon: 'lock', name: 'Лёд' },
  { id: 'back', at: 20, icon: 'looks', name: 'Рубашка «Ромбы»' },
  { id: 'scissors', at: 23, icon: 'link', name: 'Ножницы' },
  { id: 'single-key', at: 25, icon: 'key', name: 'Замок с одним ключом' },
  { id: 'golden', at: 26, icon: 'coin', name: 'Золотые карты' },
  { id: 'magnet', at: 27, icon: 'link', name: 'Магнит' },
  { id: 'shuffle', at: 29, icon: 'cycle', name: 'Перемешивание' },
  { id: 'hammer', at: 31, icon: 'draw', name: 'Молоток' },
] as const;

type Feature = Pick<(typeof historicalUnlocks)[number], 'id' | 'icon'> & { at: number; name: string };
const contextual = new Set<string>(['hint', 'undo', 'joker', 'recovery', 'shuffle']);
export const unlockCatalog = CAMPAIGN_CORE_STAGE1 ? historicalUnlocks
  .filter(feature => !contextual.has(feature.id))
  .map(feature => feature.id === 'tableau' ? { ...feature, at: RELEASE_UNLOCK.foundation - 1 } :
    feature.id === 'foundation' ? { ...feature, name: 'Дополнительное место для темы' } : feature)
  .sort((left, right) => left.at - right.at) : historicalUnlocks;
export function unlockTrack(save: Save) {
  const wins = completedLevels(save);
  const grandfathered = (feature: Feature) => feature.id === 'daily' ? dailyModeAvailable(save) :
    feature.id === 'tasks' && dailyTasksAvailable(save);
  const next = unlockCatalog.find(feature => feature.at > wins && !grandfathered(feature));
  const features = next ? unlockCatalog.filter(feature => feature.at === next.at && !grandfathered(feature)) : [];
  const previous = next ? Math.max(0, ...unlockCatalog.filter(feature => feature.at < next.at).map(feature => feature.at)) : wins;
  return { features, progress: wins - previous, goal: (next?.at ?? wins) - previous };
}

export function unlockedBetween(before: Save, after: Save) {
  const oldWins = completedLevels(before), newWins = completedLevels(after);
  return unlockCatalog.filter(feature => feature.at > oldWins && feature.at <= newWins &&
    (feature.id !== 'daily' || !dailyModeAvailable(before)) && (feature.id !== 'tasks' || !dailyTasksAvailable(before)));
}
