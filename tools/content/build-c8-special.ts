import { isDeepStrictEqual } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { content8Late, content8Wave } from '../../src/content/campaign-v8-dealer';
import { applyBoard, assertBoard, sourceCards } from '../../src/domain/engine';
import type { BoardCommand, Deal, Location } from '../../src/domain/types';
import { advance } from '../qa/gameplay-oracle';

const encodeLocation = (location: Location) =>
  ({ tableau: 't', foundation: 'f', waste: 'w' })[location.kind] + location.index;
const encodePath = (path: BoardCommand[]) => path.map(move => {
  if (move.type === 'transfer') return encodeLocation(move.from) + '>' + encodeLocation(move.to);
  return move.type === 'draw' ? 'd' : 'r';
}).join(' ');

const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
const plans = [
  { level: 17, feature: 'ordered', category: 'building', training: 'ordered', phase: 'Initial' },
  { level: 18, feature: 'keys', column: 1, keys: ['books_2', 'kitchen_2', 'appliances_1'], training: 'keys', phase: 'Shuffle' },
  { level: 26, feature: 'keys', column: 3, keys: ['soups_3', 'jobs_5', 'clothes_2'], phase: 'Shuffle' },
  { level: 45, feature: 'ordered', category: 'weeks', phase: 'Initial' },
  { level: 66, feature: 'keys', column: 4, keys: ['movies_4', 'pasta_3', 'sewing_4'], phase: 'Shuffle' },
] as const;

function rankOrder(base: Deal, category: string): string[] {
  const members: string[] = [];
  let board = base.initial;
  for (const action of base.winningPath) {
    if (action.type === 'transfer' && action.to.kind === 'foundation') {
      members.push(...sourceCards(board, action.from, base)
        .filter(id => base.cards[id].category === category && !base.cards[id].leader));
    }
    const next = applyBoard(board, action, base);
    if (typeof next === 'string') throw Error(next);
    board = next.board;
  }
  return members;
}

function verify(deal: Deal, path: BoardCommand[]): boolean {
  let board = deal.initial;
  for (const action of path) {
    const applied = applyBoard(board, action, deal), independent = advance(board, action, deal);
    if (typeof applied === 'string') {
      if (independent) throw Error('Game rejected an independently accepted action: ' + deal.id);
      return false;
    }
    if (!isDeepStrictEqual(applied.board, independent)) throw Error('Independent transition mismatch: ' + deal.id);
    board = applied.board;
  }
  return board.phase === 'won';
}

function parkingRoute(deal: Deal): BoardCommand[] | undefined {
  let board = deal.initial;
  for (const [index, move] of deal.winningPath.entries()) {
    const empty = board.tableau.findIndex(column => !column.length);
    if (empty >= 0 && move.type === 'transfer' && move.from.kind === 'waste' && move.to.kind === 'foundation') {
      const parking = { kind: 'tableau', index: empty } as const;
      const route: BoardCommand[] = [
        ...deal.winningPath.slice(0, index),
        { type: 'transfer', from: move.from, to: parking },
        { type: 'transfer', from: parking, to: move.to },
        ...deal.winningPath.slice(index + 1),
      ];
      if (verify(deal, route)) return route;
    }
    const next = applyBoard(board, move, deal);
    if (typeof next === 'string') throw Error(next);
    board = next.board;
  }
}

const records = [], provenance = [];
for (const plan of plans) {
  const base = [...content8Wave, ...content8Late].find(deal => deal.campaignLevel === plan.level);
  if (!base) throw Error('Missing base deal for ' + plan.level);
  const deal = structuredClone(base);
  deal.id = 'campaign-c8-special-' + String(plan.level).padStart(3, '0');
  deal.title = plan.feature === 'ordered' ? 'Тема по порядку' : 'Столбец под замком';
  deal.tags = ['content8-special', plan.feature];
  if ('training' in plan) deal.training = plan.training;

  if (plan.feature === 'ordered') {
    const members = rankOrder(base, plan.category);
    if (members.length !== weekdays.length || new Set(members).size !== members.length) throw Error('Invalid ordered topic');
    const map = new Map(members.map((id, index) => [id, 'workdays_' + (index + 1)]));
    map.set(plan.category, 'workdays');
    for (const id of map.keys()) delete deal.cards[id];
    deal.cards.workdays = {
      id: 'workdays', category: 'workdays', leader: true, ordered: true, text: 'Будни',
      explanation: 'Соберите будние дни по порядку, начиная с понедельника.',
    };
    weekdays.forEach((text, index) => {
      const id = 'workdays_' + (index + 1);
      deal.cards[id] = {
        id, category: 'workdays', rank: index + 1, text,
        explanation: `${text} — день №${index + 1} в рабочей неделе.`,
      };
    });
    const replace = (id: string) => map.get(id) ?? id;
    deal.initial.tableau = deal.initial.tableau.map(column => column.map(replace));
    deal.initial.stock = deal.initial.stock.map(replace);
    deal.initial.faceUp = deal.initial.faceUp.map(replace);
  } else {
    const requiredKeys = plan.keys.map((cardId, index) => {
      const key = 'key-' + (index + 1);
      deal.cards[cardId].keyId = key;
      return key;
    });
    deal.lock = { column: plan.column, requiredKeys };
    deal.initial.faceUp = deal.initial.faceUp.filter(id => !deal.initial.tableau[plan.column].includes(id));
  }

  assertBoard(deal.initial, deal);
  if (!verify(deal, deal.winningPath)) throw Error('Main proof failed: ' + deal.id);
  deal.recoveryPaths = base.recoveryPaths?.filter(path => verify(deal, path)) ?? [];
  if (!deal.recoveryPaths.length) {
    const alternative = parkingRoute(deal);
    if (!alternative) throw Error('No alternative proof for ' + deal.id);
    deal.recoveryPaths.push(alternative);
  }
  records.push({ ...deal, winningPath: encodePath(deal.winningPath), recoveryPaths: deal.recoveryPaths.map(encodePath) });
  provenance.push({ ...plan, baseId: base.id, steps: deal.winningPath.length, alternatives: deal.recoveryPaths?.length ?? 0 });
}

await mkdir('.authoring/c8-special', { recursive: true });
await writeFile('.authoring/c8-special/deals.json', '[\n' + records.map(record => '  ' + JSON.stringify(record)).join(',\n') + '\n]\n');
console.log(JSON.stringify(provenance, null, 2));
