import { legalCommands, sourceCards } from '../domain/engine';
import { knownContinuation } from '../domain/solver';
import { completedLevels, freeHintDemo, markTutorial, seenTutorial } from '../domain/progression';
import type { Board, BoardCommand, Deal, Save } from '../domain/types';

type Skill = 'category' | 'match' | 'stock';
const marker = (skill: Skill) => `learn:${skill}`;
function skillFor(board: Board, action: BoardCommand, deal: Deal): Skill {
  if (action.type !== 'transfer') return 'stock';
  return action.to.kind === 'foundation' && sourceCards(board, action.from, deal).some(id => deal.cards[id].leader) ? 'category' : 'match';
}
/** Called inside the accepted SaveStore transition; Undo does not erase a learned skill. */
export function recordLearning(save: Save, before: Board, action: BoardCommand, deal: Deal): void {
  if (action.type === 'recycle' && deal.training) markTutorial(save, 'learn:recycle');
  if (action.type === 'transfer' && action.from.kind === 'waste' && deal.training === 'stock') markTutorial(save, 'learn:waste');
  if (action.type === 'transfer' && action.to.kind === 'tableau' && before.tableau[action.to.index].length === 0 && deal.training === 'planning')
    markTutorial(save, 'learn:buffer');
  if (deal.training === 'planning' && action.type === 'transfer' && action.to.kind === 'foundation' &&
    before.foundations.filter(pile => !pile.length).length === 1 && !before.foundations[action.to.index].length)
    markTutorial(save, 'learn:slots');
  if (deal.campaignLevel && deal.campaignLevel <= 2) markTutorial(save, marker(skillFor(before, action, deal)));
}
export type RuleIntro = 'joker' | 'ordered' | 'keys';
const isJokerLesson = (deal: Deal) => deal.tags?.includes('joker') && deal.tags.includes('teaching');
export function ruleIntroduction(save: Save, deal: Deal): RuleIntro | undefined {
  if (deal.daily || save.attempt.board.phase !== 'playing') return;
  const rules: RuleIntro[] = [];
  if (isJokerLesson(deal)) rules.push('joker');
  if (Object.values(deal.cards).some(card => card.ordered)) rules.push('ordered');
  if (deal.lock) rules.push('keys');
  return rules.find(rule => !seenTutorial(save, `intro:${rule}`) &&
    (rule !== 'joker' || !seenTutorial(save, 'joker-used')));
}
export interface Guidance {
  action?: BoardCommand;
  delay?: number;
  attention?: 'hint' | 'undo' | 'joker';
  copy?: string;
}

function openingLesson(save: Save, deal: Deal): Guidance | undefined {
  const board = save.attempt.board;
  const seen = (marker: string) => seenTutorial(save, marker);
  const step = () => knownContinuation(board, deal)?.[0];
  const guide = (copy: string) => ({ copy, action: step(), delay: 950 });
  switch (deal.training) {
    case 'first':
      if (!seen('learn:category')) return guide('Положите карту с названием темы в пустой верхний слот.');
      if (!seen('learn:match')) return guide('Добавляйте подходящие карты к теме сверху.');
      if (!seen('learn:stock')) return guide('Нажмите на закрытую колоду, чтобы открыть карту.');
      break;
    case 'stock':
      if (!seen('learn:waste') && !board.waste.length) return guide('Нажмите на колоду. Открытая карта появится рядом, в сбросе.');
      if (!seen('learn:waste')) return guide('Из сброса можно взять верхнюю карту. Следующий добор накроет её.');
      break;
    case 'hint':
      if (seen('hint-practiced')) break;
      if (save.attempt.lessonHint) return { copy: 'Перенесите показанную карту или нажмите на показанную колоду.', action: save.attempt.lessonHint };
      if (freeHintDemo(save, deal)) return { copy: 'Нажмите «Подсказка». Она бесплатно покажет ход, который вы сможете сделать сами.', attention: 'hint' };
      if (save.profile.hints) return { copy: 'Подсказка показывает ход. Выполните его на поле, чтобы закончить обучение.', attention: 'hint' };
      break;
    case 'undo':
      if (seen('undo-used') || !save.profile.undos) break;
      if (!save.attempt.undo.length) return guide('Сделайте ход, чтобы попробовать «Отмену».');
      return { copy: 'Нажмите «Отмена». Карты и счётчик вернутся на шаг назад. Расходуется 1 отмена.', attention: 'undo' };
    case 'planning': {
      const action = step();
      if (!board.stock.length && board.waste.length && !seen('learn:recycle')) return {
        copy: 'Нажмите на пустую колоду. Оставшиеся карты вернутся из сброса на новый круг.',
        action: action?.type === 'recycle' ? action : undefined,
      };
      if (board.foundations.filter(pile => pile.length).length >= board.foundations.length - 1 && !seen('learn:slots')) return {
        copy: 'Верхних слотов мало. Оставьте место для темы, которую сможете собрать раньше.',
      };
      if (!seen('learn:buffer') && board.tableau.some(pile => !pile.length)) return {
        copy: 'В пустом столбце можно временно оставить карту или группу.',
        action: action?.type === 'transfer' && action.to.kind === 'tableau' && !board.tableau[action.to.index].length ? action : undefined,
      };
      if (!seen('learn:recycle')) return { copy: 'Пропущенную карту можно вернуть. Дойдите до конца колоды и начните новый круг.' };
      break;
    }
    case 'joker':
      if (seen('joker-buffer')) break;
      if (board.joker) return {
        copy: 'Перенесите карту или группу на Джокера. Под ним останутся прежние карты.',
        action: legalCommands(board, deal).find(command => command.type === 'transfer' &&
          command.to.kind === 'tableau' && command.to.index === board.joker?.column),
      };
      if (!seen('joker-used') && save.profile.jokers) return {
        copy: 'Нажмите «Джокер» и выберите непустой столбец. Он даст временное место для одной группы. Расходуется 1 джокер.',
        attention: 'joker',
      };
  }
}

/** Observe accepted state: teaching never moves cards or spends resources. */
export function lesson(save: Save, deal: Deal): Guidance | undefined {
  if (save.attempt.board.phase !== 'playing') return;
  if (deal.training) {
    if (completedLevels(save) >= (deal.campaignLevel ?? Infinity) && !save.attempt.lessonHint) return;
    return openingLesson(save, deal);
  }
  if (isJokerLesson(deal) && !save.attempt.jokerUsed && save.profile.jokers > 0) return { attention: 'joker' };
  if (deal.campaignLevel === 3 && freeHintDemo(save, deal)) return { attention: 'hint' };
  if (deal.campaignLevel === 4 && !seenTutorial(save, 'undo-used') && save.attempt.undo.length) return { attention: 'undo' };
  if (!deal.campaignLevel || deal.campaignLevel > 2 || completedLevels(save) >= deal.campaignLevel) return;
  if ((['category', 'match', 'stock'] as const).every(skill => seenTutorial(save, marker(skill)))) return;
  const action = knownContinuation(save.attempt.board, deal)?.[0] ?? legalCommands(save.attempt.board, deal)[0];
  return action ? { action, delay: seenTutorial(save, marker(skillFor(save.attempt.board, action, deal))) ? 6000 : 650 } : undefined;
}
