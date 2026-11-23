import { legalCommands, sameBoardCommand, sourceCards } from '../domain/engine';
import { knownContinuation } from '../domain/solver';
import { completedLevels, freeHintDemo, markTutorial, seenTutorial } from '../domain/progression';
import { bonusKinds, bonusOffer, pilesFor } from '../domain/bonus-slots';
import type { Board, BoardCommand, Command, Deal, Save } from '../domain/types';

type Skill = 'category' | 'match' | 'stock';
const marker = (skill: Skill) => `learn:${skill}`;
function skillFor(board: Board, action: BoardCommand, deal: Deal): Skill {
  if (action.type !== 'transfer') return 'stock';
  return action.to.kind === 'foundation' && sourceCards(board, action.from, deal).some(id => deal.cards[id].leader) ? 'category' : 'match';
}
/** Called inside the accepted SaveStore transition; Undo does not erase a learned skill. */
export function coversPlayableWaste(board: Board, action: BoardCommand, deal: Deal): boolean {
  return deal.training === 'planning' && action.type === 'draw' && board.waste.length > 0 &&
    legalCommands(board, deal).some(move => move.type === 'transfer' && move.from.kind === 'waste' && move.to.kind === 'foundation');
}

export function recordLearning(save: Save, before: Board, action: BoardCommand, deal: Deal): void {
  if (action.type === 'transfer' && action.to.kind !== 'waste' &&
    action.to.index === bonusOffer(deal, action.to.kind)?.index) markTutorial(save, `learn:bonus-${action.to.kind}`);
  if (action.type === 'recycle' && deal.training) markTutorial(save, 'learn:recycle');
  if (action.type === 'transfer' && action.from.kind === 'waste' && deal.training === 'stock') markTutorial(save, 'learn:waste');
  if (action.type === 'transfer' && action.to.kind === 'tableau' && before.tableau[action.to.index].length === 0 && deal.training === 'planning')
    markTutorial(save, 'learn:buffer');
  if (deal.training === 'planning' && action.type === 'transfer' && action.to.kind === 'foundation' &&
    before.foundations.filter(pile => !pile.length).length === 1 && !before.foundations[action.to.index].length)
    markTutorial(save, 'learn:slots');
  if (deal.training === 'ordered' && action.type === 'transfer' && action.to.kind === 'foundation' &&
    sourceCards(before, action.from, deal).some(id => deal.cards[id].rank === 1))
    markTutorial(save, 'learn:ordered');
  if (deal.training === 'keys' && deal.lock?.requiredKeys.every(key => save.attempt.board.keys?.includes(key)))
    markTutorial(save, 'learn:keys');
  if (deal.campaignLevel && deal.campaignLevel <= 2) markTutorial(save, marker(skillFor(before, action, deal)));
}
export type RuleIntro = 'joker' | 'ordered' | 'keys';
export function ruleIntroMarker(rule: RuleIntro, deal: Deal): string {
  const keys = deal.lock?.requiredKeys.length;
  return rule === 'keys' && keys !== undefined && keys !== 3 ? `intro:keys:${keys}` : `intro:${rule}`;
}
const isJokerLesson = (deal: Deal) => deal.tags?.includes('joker') && deal.tags.includes('teaching');
export function ruleIntroduction(save: Save, deal: Deal): RuleIntro | undefined {
  if (deal.daily || save.attempt.board.phase !== 'playing') return;
  const rules: RuleIntro[] = [];
  if (isJokerLesson(deal)) rules.push('joker');
  if (Object.values(deal.cards).some(card => card.ordered)) rules.push('ordered');
  if (deal.lock) rules.push('keys');
  return rules.find(rule => !seenTutorial(save, ruleIntroMarker(rule, deal)) &&
    (rule !== 'joker' || !seenTutorial(save, 'joker-used')));
}
export interface Guidance {
  action?: BoardCommand;
  delay?: number;
  attention?: 'hint' | 'undo' | 'joker';
  copy?: string;
  accepts?: (command: Command) => boolean;
}

function openingLesson(save: Save, deal: Deal): Guidance | undefined {
  const board = save.attempt.board;
  const seen = (key: string) => seenTutorial(save, key);
  const step = () => knownContinuation(board, deal)?.[0];
  const exact = (copy: string, action: BoardCommand): Guidance =>
    ({ copy, action, accepts: command => isBoardCommand(command) && sameBoardCommand(action, command) });
  const guide = (copy: string, accepts: (action: BoardCommand) => boolean) => {
    const preferred = step();
    const action = preferred && accepts(preferred) ? preferred : legalCommands(board, deal).find(accepts);
    return action ? exact(copy, action) : undefined;
  };
  const button = (copy: string, attention: NonNullable<Guidance['attention']>, type: Command['type']): Guidance =>
    ({ copy, attention, accepts: command => command.type === type });
  switch (deal.training) {
    case 'first':
      if (!seen('learn:category')) return guide('Положите карту темы в верхний слот.', action => skillFor(board, action, deal) === 'category');
      if (!seen('learn:match')) return guide('Соедините показанные карты одной темы.', action => skillFor(board, action, deal) === 'match');
      if (!seen('learn:stock')) {
        const next = step();
        if (next?.type === 'transfer') return exact('Сделайте показанный перенос. Затем откроем колоду.', next);
        return guide('Нажмите на колоду, чтобы открыть карту.', action => action.type === 'draw');
      }
      break;
    case 'stock': {
      if (seen('learn:waste')) break;
      const next = step();
      if (!board.waste.length && next && skillFor(board, next, deal) === 'category')
        return exact('Положите тему в верхний слот.', next);
      if (!board.waste.length) return guide('Откройте колоду. Карта появится в сбросе.', action => action.type === 'draw');
      if (next?.type === 'draw') return exact('Откройте следующую карту.', next);
      return guide('Перенесите верхнюю карту из сброса.', action => action.type === 'transfer' && action.from.kind === 'waste')
        ?? guide('Откройте следующую карту.', action => action.type === 'draw');
    }
    case 'hint':
      if (seen('hint-practiced')) break;
      if (save.attempt.lessonHint) {
        const action = save.attempt.lessonHint;
        return exact(action.type === 'transfer' ? 'Сделайте показанный перенос.' : 'Нажмите на показанную колоду.', action);
      }
      return button('Нажмите «Подсказка». Первый раз бесплатно.', 'hint', 'hint');
    case 'undo':
      if (seen('undo-used')) break;
      if (!save.attempt.undo.length) return guide('Сделайте показанный ход.', () => true);
      return button(save.profile.undos
        ? 'Нажмите «Отмена», чтобы вернуть ход. Расходуется 1 отмена.'
        : 'Нажмите «Отмена», чтобы вернуть ход. Учебное действие бесплатно.', 'undo', 'undo');
    case 'planning': {
      if (seen('learn:slots') && seen('learn:buffer') && seen('learn:recycle')) break;
      const action = step();
      if (!board.stock.length && board.waste.length && !seen('learn:recycle') &&
        (action?.type === 'recycle' || board.waste.length === 1))
        return exact('Нажмите на пустую колоду, чтобы начать новый круг.', { type: 'recycle' });
      if (action?.type !== 'transfer') break;
      if (!seen('learn:slots') && action.to.kind === 'foundation' &&
        !board.foundations[action.to.index].length && board.foundations.filter(pile => !pile.length).length === 1)
        return exact('Остался один слот. Положите в него показанную тему.', action);
      if (!seen('learn:buffer') && action.to.kind === 'tableau' && !board.tableau[action.to.index].length)
        return exact('Положите группу в пустой столбец. Здесь она может подождать.', action);
      break;
    }
    case 'joker': {
      if (seen('joker-buffer')) break;
      const joker = board.joker;
      if (joker) {
        const usesJoker = (command: Command) => command.type === 'transfer' && command.to.kind === 'tableau' && command.to.index === joker.column;
        const action = legalCommands(board, deal).find(usesJoker);
        if (action) return { copy: 'Положите карту или группу на Джокера.', action, accepts: usesJoker };
      } else if (!save.attempt.jokerUsed && board.tableau.some(column => column.length)) {
        return button('Нажмите «Джокер» и выберите непустой столбец.', 'joker', 'place-joker');
      }
      break;
    }
    case 'ordered': {
      if (seen('learn:ordered')) break;
      const action = step();
      if (!action) break;
      const opening = action.type === 'transfer' && sourceCards(board, action.from, deal).some(id => deal.cards[id].ordered);
      return exact(opening ? 'Положите «Будни» в верхний слот.' : 'Начните с понедельника, карты №1.', action);
    }
    case 'keys': {
      if (seen('learn:keys')) break;
      const action = step();
      if (!action) break;
      return exact(`Сделайте отмеченный ход. Найдено ${board.keys?.length ?? 0} из ${deal.lock?.requiredKeys.length ?? 3}.`, action);
    }
  }
}

function isBoardCommand(command: Command): command is BoardCommand {
  return command.type === 'transfer' || command.type === 'draw' || command.type === 'recycle';
}

/** Observe accepted state: teaching never moves cards or spends resources. */
export function lesson(save: Save, deal: Deal): Guidance | undefined {
  if (save.attempt.board.phase !== 'playing') return;
  const board = save.attempt.board;
  for (const kind of bonusKinds) {
    const offer = bonusOffer(deal, kind);
    if (!offer || pilesFor(board, kind).length <= offer.index || seenTutorial(save, `learn:bonus-${kind}`)) continue;
    const action = legalCommands(board, deal).find(step => step.type === 'transfer' &&
      step.to.kind === kind && step.to.index === offer.index);
    if (action) return { action, copy: kind === 'foundation'
      ? 'Поставьте тему в новый слот.' : 'Переложите карту в столбец.' };
  }
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
