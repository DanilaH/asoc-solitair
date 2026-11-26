import { applyBoard, boardKey, isLocked, placeJoker, sameBoardCommand } from '../domain/engine';
import { isBoundCard } from '../domain/bound-cards';
import { frozenLayers } from '../domain/frozen-cards';
import { isPictureJoined } from '../domain/puzzle-pairs';
import { completedLevels, markTutorial, seenTutorial } from '../domain/progression';
import { decodeLessonRoute } from '../content/route';
import type { Board, BoardCommand, Command, Deal, GameEvent, Save } from '../domain/types';

/** The published C8 opening and rule demonstrations, keyed by immutable deal revision. */
const sequenceR1 = new Set([
  'campaign-c8-dealer-001', 'campaign-c8-dealer-002',
  'campaign-c8-dealer-003', 'campaign-c8-dealer-004',
  'campaign-c8-dealer-005', 'campaign-c8-dealer-008',
  'campaign-c8-special-017', 'campaign-c8-special-017-core-special-r1', 'campaign-c8-special-018',
]);

const byDeal = new WeakMap<Deal, Map<string, BoardCommand>>();

export function usesAuthoredLesson(deal: Deal): boolean {
  return deal.version === 1 && sequenceR1.has(deal.id);
}

/**
 * Index the authored route by the actual pre-action board. Moves remaining are
 * intentionally outside the key: reload and Undo never need a separate cursor.
 * A player who leaves the authored position can still play a legal move.
 */
export function authoredLessonAction(board: Board, deal: Deal): BoardCommand | undefined {
  if (!usesAuthoredLesson(deal)) return;
  let states = byDeal.get(deal);
  if (!states) {
    states = new Map();
    let position = deal.initial;
    for (const action of deal.winningPath) {
      const result = applyBoard(position, action, deal);
      if (typeof result === 'string') break;
      const key = boardKey(position);
      if (!states.has(key)) states.set(key, action);
      position = result.board;
    }
    byDeal.set(deal, states);
  }
  const action = states.get(boardKey(board));
  return action && typeof applyBoard(board, action, deal) !== 'string' ? action : undefined;
}

type Proof =
  | { event: GameEvent['type']; card?: string; amount?: number }
  | { state: 'last-slot' | 'empty-buffer' | 'wildcard' | 'joker-freed' }
  | { state: 'thaw' | 'thawed' | 'cut' | 'cut-card' | 'joined' | 'paired' | 'gold'; card: string; target?: string; remaining?: number }
  | { state: 'unlocked-column'; column: number };

interface Cue {
  copy: string;
  marker?: string;
  proof?: Proof;
}
type TeachingPlan = { cues: readonly Cue[]; route?: string };
const cue = (copy: string, marker?: string, proof?: Proof): Cue => ({ copy, marker, proof });
const moved = (card: string): Proof => ({ event: 'transfer', card });
const drawn = (card?: string): Proof => ({ event: 'draw', card });
const key = (amount: number): Proof => ({ event: 'key', amount });

const plans = new Map<string, TeachingPlan>([
  ['campaign-c8-dealer-001', { cues: [
    cue('Перенесите карту темы в верхний слот.', 'category', { event: 'transfer' }),
    cue('Соедините карты одной темы в столбце.', 'match', { event: 'transfer' }),
    cue('Продолжите собирать открытую тему.'),
    cue('Коснитесь колоды, чтобы открыть карту.', 'open-stock', drawn()),
    cue('У карты из сброса пока нет темы. Откройте следующую.', undefined, drawn()),
    cue('Поставьте открытую тему в свободный слот.', undefined, moved('clothes')),
    cue('Добавьте карту одежды к её теме.'),
    cue('Добавьте ещё одну карту одежды.'),
    cue('Вернитесь к первой карте из сброса и перенесите её в тему.', 'first-stock-used', moved('clothes_1')),
  ] }],
  ['campaign-c8-dealer-002', { cues: [
    cue('Положите тему в верхний слот.'),
    cue('Откройте колоду. Карта появится в сбросе.', undefined, drawn('dishes_1')),
    cue('Перенесите верхнюю карту из сброса.', 'waste', moved('dishes_1')),
  ] }],
  ['campaign-c8-ftue-005-r1', { cues: [
    cue('Положите «Фрукты» в верхний слот.'),
    cue('Положите «Рыбы» в соседний слот.'),
    cue('Займите последний свободный слот темой «Освещение».', 'last-slot', { state: 'last-slot' }),
    cue('Добавьте рыбу к её теме. Внизу освободится столбец.'),
    cue('Отложите посуду в пустой столбец. Под ней лежит тема.', 'buffer', { state: 'empty-buffer' }),
    cue('Все слоты заняты. Откройте карту из колоды.'),
    cue('Для этой посуды ещё нет слота. Откройте следующую карту.'),
    cue('Завершите «Рыбы», чтобы освободить верхний слот.'),
    cue('Теперь поставьте «Посуду» в освободившийся слот.'),
    cue('Коснитесь пустой колоды, чтобы вернуть сброс.', 'recycle', { event: 'recycle' }),
    cue('Откройте возвращённую карту.'),
    cue('Положите возвращённую карту в её тему.', 'reused-waste', moved('dishes_2')),
    cue('Заберите карту из временного столбца и завершите тему.', 'reused-buffer', moved('dishes_1')),
  ] }],
  ['campaign-c8-ftue-008-r1', { cues: [
    cue('Кнопка «Джокер» даст временное место для карты другой темы.'),
    cue('Перенесите спортивную карту на Джокера в столбце с камнем.', 'wildcard', { state: 'wildcard' }),
    cue('Открывшуюся тему «Спорт» перенесите в верхний слот.'),
    cue('Заберите спортивную карту с Джокера в её тему.', 'joker-freed', { state: 'joker-freed' }),
  ] }],
  ['campaign-c8-ftue-017-r1', { cues: [
    cue('Положите «Будни» в верхний слот.'),
    cue('Добавьте «Понедельник», карту №1.'),
    cue('Добавьте «Вторник», карту №2.'),
    cue('Добавьте №3 и завершите тему «Будни».', 'ordered', { event: 'complete', card: 'workdays_3' }),
    cue('Обе половинки открыты. Положите верхнюю на нижнюю.', 'puzzle-joined', { state: 'joined', card: 'berries_5', target: 'berries_3' }),
    cue('Положите открывшуюся тему «Лесные ягоды» в верхний слот.'),
    cue('Перенесите собранную пару в тему.', 'puzzle-used', { state: 'paired', card: 'berries_5', target: 'berries_3' }),
  ] }],
  ['campaign-c8-special-018', { cues: [
    cue('Откройте первый ключ под картой темы.', undefined, key(1)),
    cue('Первый ключ найден. Откройте следующий.', undefined, key(2)),
    cue('Откройте третий ключ, чтобы снять замок.', 'three-unlock', { event: 'unlock' }),
    cue('Перенесите карту из открывшегося столбца.', 'three-key-use', { state: 'unlocked-column', column: 1 }),
  ] }],
  ['campaign-c8-ftue-019-r1', { cues: [
    cue('На карте два слоя льда. Начните соседнюю тему.'),
    cue('Завершите тему, чтобы снять первый слой.', 'ice-first', { state: 'thaw', card: 'air_1', remaining: 1 }),
    cue('Остался один слой. Откройте следующую тему.'),
    cue('Завершите вторую тему, чтобы снять весь лёд.', 'ice-last', { state: 'thaw', card: 'air_1', remaining: 0 }),
    cue('Поставьте тему размороженной карты в верхний слот.'),
    cue('Перенесите размороженную карту в её тему.', 'ice-use', { state: 'thawed', card: 'air_1' }),
  ] }],
  ['campaign-c8-ftue-024-r1', { cues: [
    cue('Откройте тему ножниц в верхнем слоте.'),
    cue('Перенесите ножницы в тему. Они разрежут связь.', 'scissors-cut', { state: 'cut', card: 'soups_1', target: 'computer_2' }),
    cue('Подготовьте верхний слот для освобождённой карты.'),
    cue('Перенесите освобождённую карту в её тему.', 'scissors-use', { state: 'cut-card', card: 'soups_1' }),
  ] }],
  ['campaign-c8-special-026-core-special-r1', { route: 't1>f0 t3>f1', cues: [
    cue('Здесь хватит одного ключа. Откройте его под картой темы.', 'one-unlock', { event: 'unlock' }),
    cue('Замок снят. Перенесите карту из открывшегося столбца.', 'one-key-use', { state: 'unlocked-column', column: 3 }),
  ] }],
  ['campaign-c8-wave-027-core-special-r1', { cues: [
    cue('Откройте тему «Фрукты» для золотых карт.'),
    cue('Перенесите первую золотую карту. Бонус начислится за победу.', 'gold-first', { state: 'gold', card: 'fruit_4' }),
    cue('Одна из двух карт в теме. Перенесите вторую.', 'gold-second', { state: 'gold', card: 'fruit_5' }),
  ] }],
  ['campaign-c8-ftue-028-r1', { cues: [
    cue('Откройте тему «Кухня».'),
    cue('Откройте колоду. Сверху лежит магнит.', undefined, drawn('kitchen_1')),
    cue('Перенесите магнит в тему. Он достанет нужную карту.', 'magnet-pulled', drawn('kitchen_2')),
    cue('Перенесите притянутую карту из сброса в тему.', 'magnet-used', moved('kitchen_2')),
  ] }],
  ['campaign-c8-ftue-032-r1', { cues: [
    cue('Откройте тему молотка.'),
    cue('Откройте колоду. Сверху лежит молоток.', undefined, drawn('boardgames_1')),
    cue('Перенесите молоток в тему. Он откроет карту в столбце.', 'hammer-flip', { event: 'flip', card: 'water_1' }),
    cue('Подготовьте верхний слот для открытой карты.'),
    cue('Перенесите пару с открытой картой в её тему.', 'hammer-used', moved('water_1')),
  ] }],
]);

// These budget-only variants preserve the same authored card positions.
for (const id of ['campaign-c8-special-026-core-special-r1', 'campaign-c8-wave-027-core-special-r1']) {
  const plan = plans.get(id)!;
  plans.set(id + '-tight-r2', plan);
  plans.set(id + '-relief-r2', plan);
}

export const lessonMarker = (skill: string) => `ftue:${skill}:r1`;

interface AuthoredStep extends Cue {
  before: Board;
  command: Command;
}
const teachingSteps = new WeakMap<Deal, AuthoredStep[]>();
export function hasReleaseLesson(deal: Deal): boolean {
  return plans.has(deal.id);
}

/** Exact pre-action state derives the current cue after reload/Undo; the route is optional. */
export function releaseLessonSteps(deal: Deal): readonly AuthoredStep[] {
  const cached = teachingSteps.get(deal);
  if (cached) return cached;
  const plan = plans.get(deal.id);
  if (!plan) return [];
  const route = plan.route ? decodeLessonRoute(plan.route) : deal.tutorialPath ?? deal.winningPath;
  let before = deal.initial;
  const steps = plan.cues.map((cue, index) => {
    const command = route[index];
    const step = { ...cue, command, before };
    const next = applyLessonCommand(before, command, deal);
    if (!next || !eventProvesStep(step, next.board, deal, next.events)) throw Error(`Invalid authoring: ${deal.id} step ${index + 1}`);
    before = next.board;
    return step;
  });
  teachingSteps.set(deal, steps);
  return steps;
}

function applyLessonCommand(before: Board, command: Command, deal: Deal) {
  if (command.type === 'place-joker') {
    const result = placeJoker(before, command.column, deal);
    return typeof result === 'string' ? undefined : { board: result, events: [{ type: 'joker' } as const] };
  }
  if (!isLessonBoardCommand(command)) return;
  const result = applyBoard(before, command, deal);
  return typeof result === 'string' ? undefined : result;
}

export function isLessonBoardCommand(command: Command): command is BoardCommand {
  return command.type === 'transfer' || command.type === 'draw' || command.type === 'recycle';
}

export function eventProvesStep(step: AuthoredStep, after: Board, deal: Deal, events: readonly GameEvent[]) {
  const { before, proof, command } = step;
  if (!proof) return true;
  if ('event' in proof) return events.some(event => event.type === proof.event &&
    (proof.card === undefined || event.cards?.includes(proof.card)) &&
    (proof.amount === undefined || event.amount === proof.amount));

  if (command.type !== 'transfer') return false;
  const transfer = events.find(event => event.type === 'transfer');
  const toFoundation = command.to.kind === 'foundation';
  switch (proof.state) {
    case 'last-slot': return toFoundation && before.foundations.filter(pile => !pile.length).length === 1 && after.foundations.every(pile => pile.length);
    case 'empty-buffer': return command.to.kind === 'tableau' && !before.tableau[command.to.index].length && Boolean(transfer?.cards?.length);
    case 'wildcard': {
      if (!before.joker || command.to.kind !== 'tableau' || command.to.index !== before.joker.column) return false;
      const underlying = before.tableau[command.to.index][before.joker.boundary - 1];
      return Boolean(transfer?.cards?.length && deal.cards[underlying].category !== transfer.category);
    }
    case 'joker-freed': return command.from.kind === 'tableau' && before.joker?.column === command.from.index && !after.joker;
    case 'thaw': return events.some(event => event.type === 'complete') &&
      frozenLayers(before, deal, proof.card) === proof.remaining! + 1 && frozenLayers(after, deal, proof.card) === proof.remaining;
    case 'thawed': return toFoundation && Boolean(deal.frozen?.layers[proof.card]) &&
      !frozenLayers(before, deal, proof.card) && Boolean(transfer?.cards?.includes(proof.card));
    case 'cut': return toFoundation && Boolean(transfer?.cards?.includes(proof.target!)) &&
      isBoundCard(before, deal, proof.card) && !isBoundCard(after, deal, proof.card);
    case 'cut-card': return toFoundation && Boolean(deal.bound?.scissorsByCard[proof.card]) &&
      !isBoundCard(before, deal, proof.card) && Boolean(transfer?.cards?.includes(proof.card));
    case 'joined': return !isPictureJoined(before, { top: proof.card, bottom: proof.target! }) &&
      isPictureJoined(after, { top: proof.card, bottom: proof.target! });
    case 'paired': return toFoundation && Boolean(transfer?.cards?.includes(proof.card) && transfer.cards.includes(proof.target!));
    case 'gold': return toFoundation && Boolean(deal.golden?.ids.includes(proof.card) && transfer?.cards?.includes(proof.card));
    case 'unlocked-column': return command.from.kind === 'tableau' && command.from.index === proof.column &&
      !isLocked(before, proof.column, deal) && Boolean(transfer?.cards?.length);
  }
}

export function releaseLessonStep(save: Save, deal: Deal): AuthoredStep | undefined {
  if (completedLevels(save) >= (deal.campaignLevel ?? 0)) return;
  const all = releaseLessonSteps(deal);
  const markers = all.flatMap(step => step.marker ? [lessonMarker(step.marker)] : []);
  if (markers.length && markers.every(marker => seenTutorial(save, marker))) return;
  const identity = boardKey(save.attempt.board);
  const matching = all.filter(step => boardKey(step.before) === identity &&
    (step.command.type !== 'place-joker' || !save.attempt.jokerUsed) && applyLessonCommand(save.attempt.board, step.command, deal));
  // Recycle and a fresh draw can recreate the same arrangement. The durable
  // recycle marker distinguishes that teaching beat without a separate cursor.
  return matching.find(step => !step.marker || !seenTutorial(save, lessonMarker(step.marker))) ?? matching[0];
}

export function recordReleaseLearning(save: Save, before: Board, command: Command, deal: Deal, events: readonly GameEvent[]) {
  if (deal.id === 'campaign-c8-dealer-004') {
    const opening = deal.winningPath[0];
    if (command.type === 'undo' && boardKey(save.attempt.board) === boardKey(deal.initial)) {
      const forward = applyBoard(save.attempt.board, opening, deal);
      if (typeof forward !== 'string' && boardKey(forward.board) === boardKey(before)) markTutorial(save, lessonMarker('undo-restored'));
    }
    if (isLessonBoardCommand(command) && seenTutorial(save, lessonMarker('undo-restored')) &&
        boardKey(before) === boardKey(deal.initial) && sameBoardCommand(command, opening)) markTutorial(save, lessonMarker('undo-repeated'));
  }
  if (!isLessonBoardCommand(command)) return;
  const step = releaseLessonSteps(deal).find(step => isLessonBoardCommand(step.command) &&
    sameBoardCommand(step.command, command) && boardKey(step.before) === boardKey(before));
  if (!step?.marker || !eventProvesStep(step, save.attempt.board, deal, events)) return;
  const skill = step.marker;
  markTutorial(save, lessonMarker(skill));
  const legacyMarker = legacyMarkers.get(skill);
  if (legacyMarker) markTutorial(save, legacyMarker);
}

const legacyMarkers = new Map([
  ['category', 'learn:category'], ['match', 'learn:match'], ['open-stock', 'learn:stock'], ['waste', 'learn:waste'],
  ['last-slot', 'learn:slots'], ['buffer', 'learn:buffer'], ['recycle', 'learn:recycle'], ['joker-freed', 'joker-buffer'],
  ['ordered', 'learn:ordered'], ['puzzle-used', 'learn:puzzle'], ['three-key-use', 'learn:keys'],
  ['ice-use', 'learn:frozen'], ['scissors-use', 'learn:bound'], ['gold-second', 'learn:golden'],
  ['magnet-used', 'learn:magnet'], ['hammer-used', 'learn:hammer'],
]);
