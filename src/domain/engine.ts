import { BALANCE_VERSION, CONTENT_VERSION, RULES_VERSION } from './types';
import { BALANCE } from './balance';
import { freeHintDemo, helperUnlocked, markTutorial } from './progression';
import type { Attempt, Board, BoardCommand, Command, Deal, GameEvent, Location, Result, Save } from './types';

import { abandonCampaign, dailyRewardEligible, finishDaily } from './meta';
import { markCampaignWin } from './services';

export const STREAK = BALANCE.streak;
export function freshAttempt(deal: Deal, id: string): Attempt {
  return { id, dealId: deal.id, ...(deal.daily ? { daily: { dayId: deal.daily.dayId, contentVersion: deal.daily.contentVersion } } : {}), board: structuredClone(deal.initial), undo: [], streak: { tier: 0, progress: 0, coins: 0, counted: [] } };
}
export function freshSave(deal: Deal, id: string): Save {
  return { schema: 1, rulesVersion: RULES_VERSION, contentVersion: CONTENT_VERSION, balanceVersion: BALANCE_VERSION,
    revision: 0, profile: { coins: BALANCE.initialCoins, hints: BALANCE.initialHints, undos: BALANCE.initialUndos, jokers: BALANCE.initialJokers, rewards: [], wins: 0 },
    meta: { version: 1, winCycle: 0, cycles: 0, dailyDates: [], dailyStreak: 0 }, attempt: freshAttempt(deal, id), settings: { sfx: true, haptics: true, reducedMotion: false } };
}
export function packet(board: Board, index: number, deal: Deal): string[] {
  const col = board.tableau[index];
  if (!col?.length || isLocked(board, index, deal)) return [];
  const boundary = board.joker?.column === index ? board.joker.boundary : 0;
  if (col.length === boundary) return [];
  const last = col.at(-1)!;
  if (!board.faceUp.includes(last)) return [];
  let start = col.length - 1;
  while (start > boundary && board.faceUp.includes(col[start - 1]) && deal.cards[col[start - 1]].category === deal.cards[last].category && !orderError(col.slice(start - 1), deal)) start--;
  return col.slice(start);
}
export function sourceCards(board: Board, loc: Location, deal: Deal): string[] {
  if (loc.kind === 'tableau') return packet(board, loc.index, deal);
  if (loc.kind === 'waste') return board.waste.length ? [board.waste.at(-1)!] : [];
  return [];
}
const sameLocation = (a: Location, b: Location) => a.kind === b.kind && (a.kind === 'waste' || a.index === b.index);
const normalize = (ids: string[], deal: Deal) => [...ids.filter(id => !deal.cards[id].leader).sort((a, b) => (deal.cards[a].rank ?? 0) - (deal.cards[b].rank ?? 0)), ...ids.filter(id => deal.cards[id].leader)];
export function isLocked(board: Board, index: number, deal: Deal): boolean {
  return deal.lock?.column === index && !deal.lock.requiredKeys.every(key => board.keys?.includes(key));
}
/** An ordered group is one interval; its category card requires a prefix starting at one. */
function orderError(ids: string[], deal: Deal): string | undefined {
  if (!ids.length || !Object.values(deal.cards).some(c => c.category === deal.cards[ids[0]].category && c.ordered)) return;
  const ranks = ids.filter(id => !deal.cards[id].leader).map(id => deal.cards[id].rank!).sort((a, b) => a - b);
  if (ids.some(id => deal.cards[id].leader) && ranks.length && ranks[0] !== 1) return 'Сначала нужен элемент №1';
  for (let i = 1; i < ranks.length; i++) if (ranks[i] !== ranks[i - 1] + 1) return `Нужен элемент №${ranks[i - 1] + 1} — порядок без пропусков`;
}
export function placeJoker(board: Board, column: number, deal: Deal): Board | string {
  if (board.phase !== 'playing' || board.joker) return 'Джокер уже на поле';
  if (!Number.isInteger(column) || !board.tableau[column]?.length || isLocked(board, column, deal)) return 'Выберите непустой открытый столбец';
  const next = structuredClone(board);
  next.joker = { column, boundary: board.tableau[column].length };
  assertBoard(next, deal); return next;
}
function reveal(board: Board, id: string | undefined, deal: Deal, events: GameEvent[]): void {
  if (!id || board.faceUp.includes(id)) return;
  board.faceUp.push(id); events.push({ type: 'flip', cards: [id] });
  const key = deal.cards[id].keyId;
  if (key && !(board.keys ??= []).includes(key)) {
    board.keys.push(key); events.push({ type: 'key', cards: [id], amount: board.keys.length });
    if (deal.lock && !isLocked(board, deal.lock.column, deal)) {
      events.push({ type: 'unlock', amount: 3 });
      reveal(board, board.tableau[deal.lock.column].at(-1), deal, events);
    }
  }
}


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
      const error = orderError([...target, ...moving], deal); if (error) return error;
      board.foundations[cmd.to.index] = normalize([...target, ...moving], deal);
    } else if (cmd.to.kind === 'tableau') {
      const target = board.tableau[cmd.to.index];
      if (!target) return 'Здесь нет столбца';
      if (isLocked(board, cmd.to.index, deal)) return 'Нужны все три ключа';
      const available = packet(board, cmd.to.index, deal);
      const support = board.joker?.column === cmd.to.index;
      if (support && target.length > board.joker!.boundary) return 'Джокер держит только одну группу';
      if (!support && target.length && (!available.length || deal.cards[available[0]].category !== category)) return 'Это другая категория';
      const error = orderError([...available, ...moving], deal); if (error) return error;
      board.tableau[cmd.to.index] = [...target.slice(0, target.length - available.length), ...normalize([...available, ...moving], deal)];
    } else return 'В сброс переносить нельзя';
    if (cmd.from.kind === 'tableau') {
      const source = board.tableau[cmd.from.index];
      source.splice(source.length - moving.length, moving.length);
      const exposed = source.at(-1);
      if (board.joker?.column === cmd.from.index && source.length === board.joker.boundary) delete board.joker;
      reveal(board, exposed, deal, events);
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

export function dispatch(input: Save, cmd: Command, deal: Deal, today = ''): Result {
  const next = structuredClone(input);
  const attempt = next.attempt;
  let events: GameEvent[] = [];
  const refuse = (reason: string, reset = false): Result => {
    if (reset && attempt.streak.progress) { attempt.streak.progress = 0; next.revision++; }
    return { next, accepted: false, events: [{ type: 'invalid', reason }], reason };
  };
  if (cmd.type === 'restart') {
    if (cmd.attemptId === attempt.id) return refuse('Для повтора нужен новый номер попытки');
    abandonCampaign(next);
    next.attempt = freshAttempt(deal, cmd.attemptId); events = [{ type: 'restart' }];
  } else if (cmd.type === 'undo') {
    if (!helperUnlocked(next, 'undo', deal) || attempt.board.phase === 'won' || !attempt.undo.length || next.profile.undos <= 0) return refuse('Нет доступной отмены');
    attempt.board = attempt.undo.pop()!; if (attempt.telemetry && attempt.board.phase === 'playing') attempt.telemetry.finished = false; next.profile.undos--; markTutorial(next, 'undo-used'); events = [{ type: 'undo' }];
  } else if (cmd.type === 'place-joker') {
    if (!helperUnlocked(next, 'joker', deal) || attempt.jokerUsed || next.profile.jokers <= 0) return refuse('В этой попытке Джокер недоступен');
    const placed = placeJoker(attempt.board, cmd.column, deal);
    if (typeof placed === 'string') return refuse(placed);
    attempt.undo.push(attempt.board); attempt.board = placed; attempt.jokerUsed = true; next.profile.jokers--;
    markTutorial(next, 'joker-used'); events = [{ type: 'joker' }];
  } else if (cmd.type === 'hint') {
    const demo = freeHintDemo(input, deal);
    if (!helperUnlocked(next, 'hint', deal) || cmd.revision !== input.revision || (!demo && next.profile.hints <= 0) || typeof applyBoard(attempt.board, cmd.action, deal) === 'string') return refuse('Подсказка больше не подходит');
    if (demo) markTutorial(next, 'hint-demo'); else next.profile.hints--; events = [{ type: 'hint' }];
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
          const amount = !attempt.daily || dailyRewardEligible(next, today) ? tier.coins : 0;
          next.profile.coins += amount; attempt.streak.coins += amount; attempt.streak.progress = 0;
          attempt.streak.tier = Math.min(3, attempt.streak.tier + 1);
          if (amount) events.push({ type: 'coins', amount });
        }
      }
    }
    if (attempt.board.phase === 'won') {
      if (attempt.daily) {
        const rewards = finishDaily(next, today);
        attempt.payout = rewards; if (rewards.length) next.profile.wins++;
        events.push({ type: 'win', amount: rewards.reduce((n, r) => n + r.coins, 0) });
        events.push(...rewards.map(r => ({ type: 'meta-reward' as const, amount: r.coins, reason: r.reason })));
      } else {
        const rewardKey = `win:${attempt.id}`;
        if (!next.profile.rewards.includes(rewardKey)) {
          const amount = BALANCE.winCoins + BALANCE.coinsPerRemainingMove * (attempt.board.movesLeft ?? 0);
          next.profile.coins += amount; next.profile.wins++; next.profile.rewards.push(rewardKey);
          attempt.payout = [{ key: rewardKey, reason: 'win', label: 'За победу и оставшиеся ходы', coins: amount }, ...markCampaignWin(next, deal.id, deal.campaignLevel)];
          events.push({ type: 'win', amount });
          events.push(...attempt.payout.filter(r => r.reason !== 'win').map(r => ({ type: 'meta-reward' as const, amount: r.coins, reason: r.reason })));
        }
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
  return JSON.stringify([board.tableau, board.foundations, board.stock, board.waste, [...board.faceUp].sort(), [...board.collected].sort(), board.joker ?? null, [...(board.keys ?? [])].sort()]);
}
export function assertBoard(board: Board, deal: Deal): void {
  if (board.tableau.length !== deal.initial.tableau.length || board.foundations.length !== deal.initial.foundations.length) throw Error('Неверное число столбцов');
  if (board.joker) {
    const j = board.joker;
    if (!Number.isInteger(j.column) || !Number.isInteger(j.boundary) || j.boundary < 1 || !board.tableau[j.column] || j.boundary > board.tableau[j.column].length || isLocked(board, j.column, deal)) throw Error('Некорректный Джокер');
    const held = board.tableau[j.column].slice(j.boundary);
    if (held.some(id => !board.faceUp.includes(id)) || new Set(held.map(id => deal.cards[id]?.category)).size > 1 || orderError(held, deal)) throw Error('Некорректная группа Джокера');
  }
  for (const leader of Object.values(deal.cards).filter(c => c.ordered)) {
    const ranks = Object.values(deal.cards).filter(c => c.category === leader.category && !c.leader).map(c => c.rank).sort((a, b) => (a ?? 0) - (b ?? 0));
    if (!leader.leader || !ranks.length || ranks.some((rank, i) => rank !== i + 1)) throw Error('Некорректный порядок категории');
  }
  const keys = board.keys ?? [];
  if (new Set(keys).size !== keys.length || keys.some(key => !deal.lock?.requiredKeys.includes(key))) throw Error('Некорректные ключи');
  if (deal.lock) {
    if (deal.lock.requiredKeys.length !== 3 || new Set(deal.lock.requiredKeys).size !== 3 || !board.tableau[deal.lock.column]) throw Error('Некорректный замок');
    for (const key of deal.lock.requiredKeys) {
      const card = Object.values(deal.cards).find(c => c.keyId === key);
      if (!card || Object.values(deal.cards).filter(c => c.keyId === key).length !== 1 || deal.initial.faceUp.includes(card.id) || deal.initial.tableau[deal.lock.column].includes(card.id) || !deal.initial.tableau.some(col => col.includes(card.id))) throw Error('Некорректная карта ключа');
      if (board.faceUp.includes(card.id) !== keys.includes(key)) throw Error('Ключ не согласован с открытием карты');
    }
    if (isLocked(board, deal.lock.column, deal) && board.tableau[deal.lock.column].some(id => board.faceUp.includes(id))) throw Error('Закрытый столбец открыт');
  }
  const ids = [...board.tableau.flat(), ...board.foundations.flat(), ...board.stock, ...board.waste, ...board.collected];
  const expected = Object.keys(deal.cards);
  if (ids.length !== expected.length || new Set(ids).size !== ids.length || ids.some(id => !deal.cards[id])) throw Error('Нарушена целостность карт');
  if (new Set(board.faceUp).size !== board.faceUp.length || board.faceUp.some(id => !deal.cards[id]) || board.stock.some(id => board.faceUp.includes(id))) throw Error('Некорректная открытая карта');
  if (board.movesLeft !== null && (!Number.isInteger(board.movesLeft) || board.movesLeft < 0)) throw Error('Некорректный бюджет');
  if ((board.phase === 'playing' && board.movesLeft === 0) || (board.phase === 'exhausted' && board.movesLeft !== 0)) throw Error('Несогласованный бюджет');
  if (!['playing', 'exhausted', 'won'].includes(board.phase)) throw Error('Некорректная фаза');
  if ((board.collected.length === expected.length) !== (board.phase === 'won')) throw Error('Некорректная победа');
}
