import { BALANCE_VERSION, CONTENT_VERSION, RULES_VERSION } from './types';
import type { Attempt, Board, BoardCommand, Command, Deal, GameEvent, Location, Result, Save } from './types';

export const STREAK = [{ count: 4, coins: 2 }, { count: 5, coins: 3 }, { count: 6, coins: 4 }, { count: 7, coins: 5 }];
export function freshAttempt(deal: Deal, id: string): Attempt {
  return { id, dealId: deal.id, board: structuredClone(deal.initial), undo: [], streak: { tier: 0, progress: 0, coins: 0, counted: [] } };
}
export function freshSave(deal: Deal, id: string): Save {
  return { schema: 1, rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION, balanceVersion: BALANCE_VERSION,
    revision: 0, profile: { coins: 100, hints: 3, undos: 5, rewards: [], wins: 0 },
    attempt: freshAttempt(deal, id), settings: { sfx: true, haptics: true, reducedMotion: false } };
}
export function packet(board: Board, index: number, deal: Deal): string[] {
  const col = board.tableau[index];
  if (!col?.length) return [];
  const last = col.at(-1)!;
  if (!board.faceUp.includes(last)) return [];
  let start = col.length - 1;
  while (start > 0 && board.faceUp.includes(col[start - 1]) && deal.cards[col[start - 1]].category === deal.cards[last].category) start--;
  return col.slice(start);
}
export function sourceCards(board: Board, loc: Location, deal: Deal): string[] {
  if (loc.kind === 'tableau') return packet(board, loc.index, deal);
  if (loc.kind === 'waste') return board.waste.length ? [board.waste.at(-1)!] : [];
  return [];
}
const sameLocation = (a: Location, b: Location) => a.kind === b.kind && (a.kind === 'waste' || a.index === b.index);
const normalize = (ids: string[], deal: Deal) => [...ids.filter(id => !deal.cards[id].leader), ...ids.filter(id => deal.cards[id].leader)];

/** Pure board transition, shared by play and validation. Never mutates the supplied board. */
export function applyBoard(input: Board, cmd: BoardCommand, deal: Deal): { board: Board; events: GameEvent[] } | string {
  if (input.phase !== 'playing') return 'Попытка уже завершена';
  const board = structuredClone(input);
  const events: GameEvent[] = [];
  if (cmd.type === 'transfer') {
    if (sameLocation(cmd.from, cmd.to)) return 'Выберите другое место';
    const moving = sourceCards(board, cmd.from, deal);
    if (!moving.length) return 'Эти карты пока недоступны';
    const category = deal.cards[moving[0]].category;
    const hasLeader = moving.some(id => deal.cards[id].leader);
    if (cmd.to.kind === 'foundation') {
      const target = board.foundations[cmd.to.index];
      if (!target) return 'Здесь нет слота';
      if (!target.length && !hasLeader) return 'Сначала нужна карта категории';
      if (target.length && (deal.cards[target[0]].category !== category || hasLeader)) return 'Это другая категория';
      board.foundations[cmd.to.index] = normalize([...target, ...moving], deal);
    } else if (cmd.to.kind === 'tableau') {
      const target = board.tableau[cmd.to.index];
      if (!target) return 'Здесь нет столбца';
      const available = packet(board, cmd.to.index, deal);
      if (target.length && (!available.length || deal.cards[available[0]].category !== category)) return 'Это другая категория';
      board.tableau[cmd.to.index] = [...target.slice(0, target.length - available.length), ...normalize([...available, ...moving], deal)];
    } else return 'В сброс переносить нельзя';
    if (cmd.from.kind === 'tableau') {
      const source = board.tableau[cmd.from.index];
      source.splice(source.length - moving.length, moving.length);
      const exposed = source.at(-1);
      if (exposed && !board.faceUp.includes(exposed)) {
        board.faceUp.push(exposed); events.push({ type: 'flip', cards: [exposed] });
      }
    } else board.waste.pop();
    events.unshift({ type: 'transfer', cards: moving, category });
    if (cmd.to.kind === 'foundation') {
      const members = Object.values(deal.cards).filter(c => c.category === category);
      const target = board.foundations[cmd.to.index];
      if (target.length === members.length) {
        board.collected.push(...target); board.foundations[cmd.to.index] = [];
        events.push({ type: 'complete', cards: target, category });
      }
    }
  } else if (cmd.type === 'draw') {
    const id = board.stock.shift();
    if (!id) return 'Колода пуста';
    board.waste.push(id); board.faceUp.push(id); events.push({ type: 'draw', cards: [id] });
  } else {
    if (board.stock.length || !board.waste.length) return 'Повтор доступен после конца колоды';
    const closing = new Set(board.waste);
    board.stock = board.waste.slice(); board.waste = [];
    board.faceUp = board.faceUp.filter(id => !closing.has(id)); events.push({ type: 'recycle' });
  }
  if (board.movesLeft !== null) board.movesLeft--;
  board.phase = board.collected.length === Object.keys(deal.cards).length ? 'won' : board.movesLeft === 0 ? 'exhausted' : 'playing';
  assertBoard(board, deal);
  return { board, events };
}

export function dispatch(input: Save, cmd: Command, deal: Deal): Result {
  const next = structuredClone(input);
  const attempt = next.attempt;
  let events: GameEvent[] = [];
  const refuse = (reason: string, reset = false): Result => {
    if (reset && attempt.streak.progress) { attempt.streak.progress = 0; next.revision++; }
    return { next, accepted: false, events: [{ type: 'invalid', reason }], reason };
  };
  if (cmd.type === 'restart') {
    if (cmd.attemptId === attempt.id) return refuse('Для повтора нужен новый номер попытки');
    next.attempt = freshAttempt(deal, cmd.attemptId); events = [{ type: 'restart' }];
  } else if (cmd.type === 'undo') {
    if (attempt.board.phase === 'won' || !attempt.undo.length || next.profile.undos <= 0) return refuse('Нет доступной отмены');
    attempt.board = attempt.undo.pop()!; next.profile.undos--; events = [{ type: 'undo' }];
  } else if (cmd.type === 'hint') {
    if (cmd.revision !== input.revision || next.profile.hints <= 0 || typeof applyBoard(attempt.board, cmd.action, deal) === 'string') return refuse('Подсказка больше не подходит');
    next.profile.hints--; events = [{ type: 'hint' }];
  } else {
    const result = applyBoard(attempt.board, cmd, deal);
    if (typeof result === 'string') return refuse(result, cmd.type === 'transfer' && attempt.board.phase === 'playing');
    attempt.undo.push(attempt.board); attempt.board = result.board; events = result.events;
    if (cmd.type === 'transfer') {
      // Route identity excludes the budget/economy and survives Undo. Reversing the same group is the same edge.
      const endpoints = [cmd.from.kind + cmd.from.index, cmd.to.kind + cmd.to.index].sort().join(':');
      const key = `${events[0].cards!.slice().sort().join(',')}@${endpoints}`;
      if (!attempt.streak.counted.includes(key)) {
        attempt.streak.counted.push(key); attempt.streak.progress++;
        const tier = STREAK[attempt.streak.tier];
        if (attempt.streak.progress >= tier.count) {
          next.profile.coins += tier.coins; attempt.streak.coins += tier.coins; attempt.streak.progress = 0;
          attempt.streak.tier = Math.min(3, attempt.streak.tier + 1);
          events.push({ type: 'coins', amount: tier.coins });
        }
      }
    }
    if (attempt.board.phase === 'won') {
      const rewardKey = `win:${attempt.id}`;
      if (!next.profile.rewards.includes(rewardKey)) {
        const amount = 25 + 2 * (attempt.board.movesLeft ?? 0);
        next.profile.coins += amount; next.profile.wins++; next.profile.rewards.push(rewardKey);
        events.push({ type: 'win', amount });
      }
    }
  }
  next.revision++;
  return { next, accepted: true, events };
}

export function legalCommands(board: Board, deal: Deal): BoardCommand[] {
  const commands: BoardCommand[] = [];
  const sources: Location[] = board.tableau.map((_, index) => ({ kind: 'tableau', index }));
  sources.push({ kind: 'waste', index: 0 });
  const targets: Location[] = [...board.foundations.map((_, index): Location => ({ kind: 'foundation', index })),
    ...board.tableau.map((_, index): Location => ({ kind: 'tableau', index }))];
  for (const from of sources) for (const to of targets) {
    const cmd: BoardCommand = { type: 'transfer', from, to };
    if (typeof applyBoard(board, cmd, deal) !== 'string') commands.push(cmd);
  }
  const stockCmd: BoardCommand = { type: board.stock.length ? 'draw' : 'recycle' };
  if (typeof applyBoard(board, stockCmd, deal) !== 'string') commands.push(stockCmd);
  return commands;
}

export function boardKey(board: Board): string {
  return JSON.stringify([board.tableau, board.foundations, board.stock, board.waste, [...board.faceUp].sort(), [...board.collected].sort()]);
}
export function assertBoard(board: Board, deal: Deal): void {
  const ids = [...board.tableau.flat(), ...board.foundations.flat(), ...board.stock, ...board.waste, ...board.collected];
  const expected = Object.keys(deal.cards);
  if (ids.length !== expected.length || new Set(ids).size !== ids.length || ids.some(id => !deal.cards[id])) throw Error('Нарушена целостность карт');
  if (new Set(board.faceUp).size !== board.faceUp.length || board.faceUp.some(id => !deal.cards[id]) || board.stock.some(id => board.faceUp.includes(id))) throw Error('Некорректная открытая карта');
  if (board.movesLeft !== null && (!Number.isInteger(board.movesLeft) || board.movesLeft < 0)) throw Error('Некорректный бюджет');
  if (!['playing', 'exhausted', 'won'].includes(board.phase)) throw Error('Некорректная фаза');
  if ((board.collected.length === expected.length) !== (board.phase === 'won')) throw Error('Некорректная победа');
}
