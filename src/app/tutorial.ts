import { applyBoard, isLocked, legalCommands, sameBoardCommand, sourceCards } from '../domain/engine';
import { knownContinuation } from '../domain/solver';
import { completedLevels, freeHintDemo, freeUndoPractice, markTutorial, seenTutorial } from '../domain/progression';
import { bonusKinds, bonusOffer, pilesFor } from '../domain/bonus-slots';
import type { Board, BoardCommand, Command, Deal, GameEvent, Save } from '../domain/types';
import { authoredLessonAction, hasReleaseLesson, isLessonBoardCommand, lessonMarker, releaseLessonStep, usesAuthoredLesson } from './c8-tutorial';
import { frozenLayers } from '../domain/frozen-cards';
import { isBoundCard } from '../domain/bound-cards';
import { isPictureJoined } from '../domain/puzzle-pairs';
import { hammerCard, matchingStock } from '../domain/starter-boosters';
import { campaignCoreDealId } from '../config/hitapps-r4';
import { releaseProfile } from '../config/profile';
import { canShuffle } from '../domain/proof-shuffle';
import { openingShuffleProof } from '../domain/shuffle-intro-proof';

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

export function recordLearning(save: Save, before: Board, action: BoardCommand, deal: Deal, events: readonly GameEvent[] = []): void {
  if (before.hitapps) {
    const lessons: Partial<Record<GameEvent['type'], string>> = { ice: 'frozen', cut: 'bound', assemble: 'puzzle', unlock: 'keys' };
    for (const event of events) {
      const learned = event.cause ?? lessons[event.type] ??
        (event.type === 'gold' && event.reason === 'activated' ? 'golden' : undefined);
      if (learned) markTutorial(save, `learn:r4-${learned}`);
    }
  }
  if (action.type === 'transfer' && action.to.kind !== 'waste' &&
    action.to.index === bonusOffer(deal, action.to.kind)?.index) markTutorial(save, `learn:bonus-${action.to.kind}`);
  if (releaseProfile && hasReleaseLesson(deal)) return;
  if (action.type === 'recycle' && deal.training) markTutorial(save, 'learn:recycle');
  if (action.type === 'transfer' && action.from.kind === 'waste' &&
      (deal.training === 'stock' || campaignCoreDealId(deal.id) && (deal.campaignLevel ?? 0) <= 2)) markTutorial(save, 'learn:waste');
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
  if (!releaseProfile) return;
  const after = save.attempt.board;
  if (action.type !== 'transfer' || action.to.kind !== 'foundation') return;
  const moved = sourceCards(before, action.from, deal);
  if (moved.some(id => deal.frozen?.layers[id] && !frozenLayers(before, deal, id))) markTutorial(save, 'learn:frozen');
  if (moved.some(id => deal.bound?.scissorsByCard[id] && !isBoundCard(before, deal, id))) markTutorial(save, 'learn:bound');
  if (deal.puzzle?.pairs.some(pair => moved.includes(pair.top) && moved.includes(pair.bottom))) markTutorial(save, 'learn:puzzle');
  if (deal.golden?.ids.every(id => after.collected.includes(id) || after.foundations.some(pile => pile.includes(id))))
    markTutorial(save, 'learn:golden');
  for (const event of events) {
    if (event.cause === 'magnet' || event.cause === 'hammer') markTutorial(save, 'learn:' + event.cause);
  }

}
/** First encounter copy follows the actual exposed card rather than a level number. */
export function specialRuleNote(save: Save, deal: Deal): { kind: string; copy: string } | undefined {
  const board = save.attempt.board;
  if (board.phase !== 'playing') return;
  const visible = (id: string) => board.waste.at(-1) === id || board.tableau.some((pile, index) =>
    !isLocked(board, index, deal) && (pile.at(-1) === id && board.faceUp.includes(id) ||
      sourceCards(board, { kind: 'tableau', index }, deal).includes(id)));
  const seen = (kind: string) => seenTutorial(save, 'learn:' + kind);
  if (board.hitapps) {
    const learned = (kind: string) => seen(`r4-${kind}`);
    for (const [id, card] of Object.entries(board.hitapps.cards)) {
      if (!visible(id)) continue;
      if (card.ice && !learned('frozen')) return { kind: 'r4-frozen', copy: 'Подходящий перенос снимает слой льда.' };
      if (card.lock && card.lock.collected < card.lock.required && !learned('keys')) return { kind: 'r4-keys', copy: 'Соберите ключи нужного типа.' };
      if ((card.scissors || card.bound === 2) && !learned('bound')) return { kind: 'r4-bound', copy: 'Перенесите ножницы на связанную карту.' };
      if (card.puzzle && !learned('puzzle')) return { kind: 'r4-puzzle', copy: 'Соедините половины на поле.' };
      if (card.gold?.health && !learned('golden')) return { kind: 'r4-golden', copy: 'Активируйте золото, пока не кончились отметки.' };
      if (card.kind === 5 && !learned('magnet')) return { kind: 'r4-magnet', copy: 'Магнит притягивает подходящую карту или ключ.' };
      if (card.kind === 6 && !learned('hammer')) return { kind: 'r4-hammer', copy: 'Молоток действует на открытую карту в столбце.' };
    }
  }
  if (!seen('frozen') && Object.keys(deal.frozen?.layers ?? {}).some(id => visible(id) && frozenLayers(board, deal, id)))
    return { kind: 'frozen', copy: 'Соберите тему, чтобы снять слой льда.' };
  if (!seen('bound') && Object.keys(deal.bound?.scissorsByCard ?? {}).some(id => visible(id) && isBoundCard(board, deal, id)))
    return { kind: 'bound', copy: 'Ножницы в верхнем слоте разрежут связь.' };
  if (!seen('puzzle') && deal.puzzle?.pairs.some(({ top, bottom }) =>
    visible(top) && visible(bottom) && legalCommands(board, deal).some(action => action.type === 'transfer' &&
      sourceCards(board, action.from, deal).includes(top) &&
      (action.to.kind === 'tableau' ? board.tableau[action.to.index].at(-1) === bottom : isPictureJoined(board, { top, bottom }))))) {
    return { kind: 'puzzle', copy: 'Соедините половинки в столбце, затем перенесите пару в тему.' };
  }
  if (deal.golden) {
    const placed = deal.golden.ids.filter(id => board.collected.includes(id) || board.foundations.some(pile => pile.includes(id))).length;
    if (placed || deal.golden.ids.some(visible))
      return { kind: 'golden', copy: `Золотые карты: ${placed} из ${deal.golden.ids.length}. Бонус за победу.` };
  }
  const starter = Object.entries(deal.starter?.cards ?? {}).find(([id, kind]) =>
    !seen(kind) && visible(id) && (kind === 'magnet' ? matchingStock(board, deal, deal.cards[id].category) >= 0
      : Boolean(hammerCard(board, deal))));
  if (!starter) return;
  const kind = starter[1];
  return { kind, copy: kind === 'magnet' ? 'Магнит в слоте темы притянет карту из колоды.' :
    'Молоток в слоте темы откроет скрытую карту.' };
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
  jokerColumn?: number;
  authored?: true;
  copy?: string;
  accepts?: (command: Command) => boolean;
}

function openingLesson(save: Save, deal: Deal): Guidance | undefined {
  const board = save.attempt.board;
  const seen = (key: string) => seenTutorial(save, key);
  const authored = usesAuthoredLesson(deal);
  const authoredStep = authoredLessonAction(board, deal);
  const step = () => authored ? authoredStep : knownContinuation(board, deal)?.[0];
  const exact = (copy: string, action: BoardCommand): Guidance =>
    ({ copy, action, accepts: command => isBoardCommand(command) && sameBoardCommand(action, command) });
  const guide = (copy: string, accepts: (action: BoardCommand) => boolean) => {
    const preferred = step();
    const action = preferred && accepts(preferred) ? preferred : authored && preferred ? undefined : legalCommands(board, deal).find(accepts);
    return action ? exact(copy, action) : undefined;
  };
  const button = (copy: string, attention: NonNullable<Guidance['attention']>, type: Command['type']): Guidance =>
    ({ copy, attention, accepts: command => command.type === type });
  switch (deal.training) {
    case 'first':
      if (!seen('learn:category')) return guide('Перетащите карту темы в верхний слот или нажмите на карту, затем на слот.', action => skillFor(board, action, deal) === 'category');
      if (!seen('learn:match')) return guide('Соедините показанные карты одной темы.', action => skillFor(board, action, deal) === 'match');
      if (!seen('learn:stock')) {
        const next = step();
        if (next?.type === 'transfer') return exact('Сделайте показанный перенос. Затем откроем колоду.', next);
        if (next?.type === 'recycle') return exact('Верните сброс в колоду.', next);
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
        if (typeof applyBoard(board, action, deal) !== 'string')
          return exact(action.type === 'transfer' ? 'Сделайте показанный перенос.' : 'Нажмите на показанную колоду.', action);
        return;
      }
      return button('Нажмите «Подсказка». Первый раз бесплатно.', 'hint', 'hint');
    case 'undo':
      if (releaseProfile && deal.id === 'campaign-c8-dealer-004') {
        if (seen(lessonMarker('undo-repeated'))) break;
        if (!save.attempt.undo.length && authoredStep && sameBoardCommand(authoredStep, deal.winningPath[0]))
          return { copy: seen(lessonMarker('undo-restored'))
            ? 'Карта вернулась. Повторите этот ход самостоятельно.' : 'Сделайте показанный ход.', action: authoredStep, authored: true };
        if (save.attempt.undo.length && (save.profile.undos || freeUndoPractice(save, deal)) && !seen(lessonMarker('undo-restored')))
          return { copy: save.profile.undos ? 'Нажмите «Отмена», чтобы вернуть ход. Расходуется 1 отмена.'
            : 'Нажмите «Отмена», чтобы вернуть ход. Учебное действие бесплатно.', attention: 'undo', authored: true };
        break;
      }
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
      if (action.type === 'draw') return exact('Откройте карту из колоды.', action);
      if (action.type === 'recycle') return exact('Верните сброс в колоду.', action);
      const cards = sourceCards(board, action.from, deal).map(id => deal.cards[id]);
      const leader = cards.find(card => card.ordered && card.leader);
      if (leader && action.to.kind === 'foundation') return exact(`Положите «${leader.text}» в верхний слот.`, action);
      const ordered = cards.find(card => card.rank === 1);
      if (ordered && action.to.kind === 'foundation') return exact(`Добавьте «${ordered.text}», карту №1.`, action);
      return exact('Переложите отмеченную карту.', action);
    }
    case 'keys': {
      if (seen('learn:keys')) break;
      const action = step();
      if (!action) break;
      const count = `Ключи: ${board.keys?.length ?? 0} из ${deal.lock?.requiredKeys.length ?? 3}.`;
      if (action.type === 'draw') return exact(`Откройте карту из колоды. ${count}`, action);
      if (action.type === 'recycle') return exact(`Верните сброс в колоду. ${count}`, action);
      return exact(`Переложите отмеченную карту. ${count}`, action);
    }
  }
}

function isBoardCommand(command: Command): command is BoardCommand {
  return command.type === 'transfer' || command.type === 'draw' || command.type === 'recycle';
}

function coreOpeningLesson(save: Save, deal: Deal): Guidance | undefined {
  const board = save.attempt.board, level = deal.campaignLevel!;
  if (completedLevels(save) >= level) return;
  const pending = (id: string) => !seenTutorial(save, id);
  const guide = (copy: string, predicate: (command: BoardCommand) => boolean) => {
    const commands = legalCommands(board, deal);
    const preferred = knownContinuation(board, deal)?.[0];
    const action = preferred && predicate(preferred) ? preferred : commands.find(predicate);
    return action ? { action, copy, authored: true as const } : undefined;
  };
  if (level === 1) {
    if (pending('learn:category')) return guide('Перенесите тему в верхний слот.', action => skillFor(board, action, deal) === 'category');
    if (pending('learn:match')) return guide('Соедините карты одной темы.', action => skillFor(board, action, deal) === 'match');
    if (pending('learn:stock')) return guide('Коснитесь колоды, чтобы открыть карту.', action => action.type === 'draw');
  }
  if (level <= 2 && pending('learn:waste')) return guide('Перенесите открытую карту из сброса.', action => action.type === 'transfer' && action.from.kind === 'waste');
  if (level === 3 || level === 4) {
    const cue = openingLesson(save, deal);
    return cue && { ...cue, accepts: undefined };
  }
  if (level === 5 && !board.stock.length && board.waste.length && pending('learn:recycle'))
    return guide('Коснитесь пустой колоды, чтобы вернуть карты из сброса.', action => action.type === 'recycle');
}

/** Observe accepted state: teaching never moves cards or spends resources. */
export function lesson(save: Save, deal: Deal): Guidance | undefined {
  if (save.attempt.board.phase !== 'playing') return;
  const board = save.attempt.board;
  if (releaseProfile && hasReleaseLesson(deal)) {
    const step = releaseLessonStep(save, deal);
    if (!step) return;
    const { command, copy } = step;
    if (command.type === 'place-joker') return { attention: 'joker', copy, jokerColumn: command.column, authored: true };
    return isLessonBoardCommand(command) ? { action: command, copy, authored: true } : undefined;
  }
  if (releaseProfile && !seenTutorial(save, lessonMarker('shuffle-used')) &&
      canShuffle(save, deal) && openingShuffleProof(board, deal))
    return { copy: 'Можно перемешать скрытые карты. Это потратит один заряд.' };
  for (const kind of bonusKinds) {
    const offer = bonusOffer(deal, kind);
    if (!offer || pilesFor(board, kind).length <= offer.index || seenTutorial(save, `learn:bonus-${kind}`)) continue;
    const action = legalCommands(board, deal).find(step => step.type === 'transfer' &&
      step.to.kind === kind && step.to.index === offer.index);
    if (action) return { action, copy: kind === 'foundation'
      ? 'Поставьте тему в новый слот.' : 'Переложите карту в столбец.' };
  }
  if (campaignCoreDealId(deal.id)) return coreOpeningLesson(save, deal);
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
