import { sourceCards, legalCommands } from '../domain/engine';
import { knownContinuation } from '../domain/solver';
import { freeHintDemo, seenTutorial } from '../domain/progression';
import type { BoardCommand, Deal, Save } from '../domain/types';

/** Event-driven guidance observes accepted board state and never moves cards or spends resources. */
export function lesson(save: Save, deal: Deal): { text: string; action?: BoardCommand; attention?: 'hint' | 'undo' | 'joker' } | undefined {
  if (save.attempt.board.phase !== 'playing') return;
  const board = save.attempt.board;
  if (deal.campaignLevel === 21) return { text: board.joker ? (board.tableau[board.joker.column].length === board.joker.boundary ? 'Положите на золотую опору одну доступную группу любой категории.' : 'Уберите группу с Джокера — опора исчезнет и откроет прежние карты.') : save.attempt.jokerUsed ? 'Джокер использован. Отмена возвращает доску, но не заряд.' : 'Джокер даёт временное место для одной группы. Можно пройти раздачу и без него.', attention: !save.attempt.jokerUsed && save.profile.jokers > 0 ? 'joker' : undefined };
  if (deal.tags?.includes('ordered')) return { text: 'Собирайте соседние номера без пропусков. К категории добавляйте по порядку, начиная с №1.' };
  if (deal.lock) return { text: (board.keys?.length ?? 0) < 3 ? `Ключи ${board.keys?.length ?? 0} из 3: открывайте карты с ключами. Запертый столбец пока недоступен.` : 'Все три ключа найдены — столбец открыт. Отмена возвращает и ключи, и замок.' };
  if (deal.campaignLevel === 3 && freeHintDemo(save, deal)) return { text: 'Попробуйте «Подсказку»: первый показ здесь бесплатный. Ход выполняете вы.', attention: 'hint' };
  if (deal.campaignLevel === 4 && !seenTutorial(save, 'undo-used')) return { text: save.attempt.undo.length ? 'Можно передумать: «Отмена» вернёт доску на один ход назад.' : 'Теперь доступна отмена. Сделайте ход, чтобы попробовать.', attention: save.attempt.undo.length ? 'undo' : undefined };
  if (!deal.campaignLevel || deal.campaignLevel > 2) return;
  const action = knownContinuation(save.attempt.board, deal)?.[0] ?? legalCommands(save.attempt.board, deal)[0];
  if (!action) return;
  if (action.type === 'draw') return { text: 'Нажмите на синюю колоду: она откроет следующую карту.', action };
  if (action.type === 'recycle') return { text: 'Нажмите на пустую колоду, чтобы вернуть оставшиеся карты в том же порядке.', action };
  const ids = sourceCards(save.attempt.board, action.from, deal), card = deal.cards[ids.at(-1)!];
  if (action.from.kind === 'waste') return { text: `Перенесите «${card.text}» из сброса к подходящей категории.`, action };
  if (ids.some(id => deal.cards[id].leader)) return { text: `Перенесите «${card.text}» в свободный верхний слот.`, action };
  return { text: `Добавьте «${card.text}» к своей категории. Под ней откроется следующая карта.`, action };
}
