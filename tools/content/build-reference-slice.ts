import { writeFile, mkdir } from 'node:fs/promises';
import { content8Cards, extraWords } from '../../src/content/content8-words';
import type { TopicSelection } from '../../src/content/topics';
import type { Board, BoardCommand, Deal } from '../../src/domain/types';
import { applyBoard, assertBoard, sourceCards } from '../../src/domain/engine';
import { advance } from '../qa/gameplay-oracle';
import { findReferenceRoute, referenceActions } from './reference-route';
import source from '../../docs/qa/content-v8/hitapps-local-1-31.json';

type Topic = TopicSelection['id'];
const sets: { level: number; title: string; ids: Topic[]; images?: Topic[] }[] = [
  { level: 6, title: 'Очередь в верхние слоты', ids: ['fruit','tools','birds','road','dishes','flowers','shoes','lights','office','gems','music','house'] },
  { level: 7, title: 'Передышка с добором', ids: ['weather','baking','trees','water','pets','fabrics'], images: ['pets'] },
  { level: 8, title: 'Две точки сборки', ids: ['vegetables','tools','gems','sports','drinks','appliances','shoes','birds','building','air'] },
  { level: 9, title: 'Подождать нужную карту', ids: ['fruit','fish','office','road','dishes','flowers','metals','water','jobs','lights'] },
  { level: 10, title: 'Пропустить или сыграть', ids: ['trees','baking','clothes','music','weather','gems','computer','games','spices','insects'] },
  { level: 11, title: 'Сначала освободить слот', ids: ['vegetables','birds','tools','office','water','dishes','appliances','furniture','air','lights','fabrics','gems'] },
  { level: 12, title: 'Свободный столбец', ids: ['fruit','flowers','pets','baking','road','music'] },
  { level: 13, title: 'Перебросить через стол', ids: ['clothes','trees','sports','fish','drinks','building','jobs','weather','insects','dishes'] },
  { level: 14, title: 'Время для второй группы', ids: ['shoes','gems','vegetables','tools','books','air','games','lights','water','office'] },
  { level: 15, title: 'Колода и очередь тем', ids: ['road','fish','clothes','flowers','music','fruit','space','baking','dishes','jobs'] },
];

function rng(seed: number) {
  let n = seed;
  return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 2 ** 32; };
}
function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const r = [...items];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

function initialFor(d: Pick<Deal, 'cards'>, row: typeof source[number], seed: number, woven: boolean): Board | undefined {
  const next = rng(seed * 65537 + 137), ids = shuffle(Object.keys(d.cards), next);
  const tableau = Array.from({ length: row.columns }, (_, index) => {
    const base = Math.floor((row.cards - row.stock - row.columns * (row.columns - 1) / 2) / row.columns);
    return Array<string>(base + index);
  });
  const remainder = row.cards - row.stock - tableau.reduce((n, col) => n + col.length, 0);
  if (remainder) for (const column of tableau.slice(-remainder)) column.length++;
  const stock = ids.slice(row.cards - row.stock);
  let index = 0;
  for (const col of tableau) for (let i = 0; i < col.length; i++) col[i] = ids[index++];
  if (index + stock.length !== row.cards) throw Error('Нарушено число карт');
  const tops = tableau.map(col => col.at(-1)!);
  const visibleLeaders = tops.filter(id => d.cards[id].leader).length;
  if (!visibleLeaders || visibleLeaders === tops.length) return;
  if (tableau.some(col => col.some((id, i) => i > 0 && d.cards[col[i - 1]].category === d.cards[id].category))) return;
  const stockThemes = new Set(stock.map(id => d.cards[id].category));
  for (const id of tops) if (!stockThemes.has(d.cards[id].category)) return;
  if (row.categories >= 10 && new Set(ids.slice(0, index).map(id => d.cards[id].category)).size < row.categories - 2) return;
  if (woven) {
    const exposure = new Map<string, number>();
    for (const col of tableau) for (const [depth, id] of col.slice().reverse().entries()) {
      const category = d.cards[id].category, early = depth + (d.cards[id].leader ? 0 : .6);
      exposure.set(category, Math.min(exposure.get(category) ?? Infinity, early));
    }
    const order = Object.values(d.cards).filter(card => card.leader).map(card => ({
      id: card.id, rank: (exposure.get(card.id) ?? 2.5) + 2 * next(),
    })).sort((a, b) => a.rank - b.rank).map(x => x.id);
    const width = row.categories === 6 ? 9 : 15;
    const entries = stock.map(id => ({
      id, position: order.indexOf(d.cards[id].category) * 4 + width * next() - (d.cards[id].leader ? 3 : 0),
    })).sort((a, b) => a.position - b.position);
    stock.splice(0, stock.length, ...entries.map(entry => entry.id));
  }
  // Native rules charge each draw separately. On the rest rows the exact
  // source budget left 2–4 moves even on the best audited winning routes.
  const playtestAllowance = row.position === 7 || row.position === 12 ? 5 : 0;
  return { tableau, foundations: Array.from({ length: row.columns }, () => []), stock, waste: [], faceUp: tops,
    collected: [], movesLeft: row.baseMoves + playtestAllowance, phase: 'playing', rulesVersion: 3 };
}

function inspect(d: Deal, path: BoardCommand[]) {
  let board = d.initial, oracle = board, forced = 0, run = 0, maxRun = 0, selectedDraw = 0, lower = 0, emptyBuffer = 0, priority = 0, parked = 0, waste = 0;
  const stockIntoFoundation = new Set<string>();
  const decisions: { step: number; board: Board; choice: BoardCommand; alternatives: BoardCommand[] }[] = [];
  for (const [index, action] of path.entries()) {
    const choices = referenceActions(board, d);
    const transfers = choices.filter(a => a.type === 'transfer');
    const leaders = new Set(transfers.flatMap(a => a.to.kind === 'foundation' && !board.foundations[a.to.index].length
      ? sourceCards(board, a.from, d).filter(id => d.cards[id].leader) : []));
    if (leaders.size > 1) priority++;
    if (transfers.length && choices.length > 1) decisions.push({ step: index, board, choice: action, alternatives: choices.filter(x => JSON.stringify(x) !== JSON.stringify(action)) });
    if (action.type !== 'transfer') {
      if (transfers.length) { selectedDraw++; run = 0; } else { forced++; run++; maxRun = Math.max(run, maxRun); }
    } else {
      run = 0;
      if (action.from.kind === 'waste') waste++;
      if (action.to.kind === 'tableau') {
        lower++; if (!board.tableau[action.to.index].length) emptyBuffer++;
        if (action.from.kind === 'waste') parked++;
      } else {
        for (const id of sourceCards(board, action.from, d)) if (d.initial.stock.includes(id)) stockIntoFoundation.add(id);
      }
    }
    const x = applyBoard(board, action, d), y = advance(oracle, action, d);
    if (typeof x === 'string' || !y || JSON.stringify(x.board) !== JSON.stringify(y)) throw Error(`Расхождение ${d.id}/${index}`);
    board = x.board; oracle = y;
  }
  if (board.phase !== 'won' || stockIntoFoundation.size !== d.initial.stock.length) throw Error(`Неполная партия ${d.id}`);
  return { decisions, forced, maxRun, selectedDraw, lower, emptyBuffer, priority, parked, waste, slack: board.movesLeft };
}

const start = Number(process.env.C8_FIRST ?? 6), end = Number(process.env.C8_LAST ?? 15);
const root = '.authoring/content8';
await mkdir(root, { recursive: true });
for (const plan of sets.filter(x => x.level >= start && x.level <= end)) {
  const row = source[plan.level - 1];
  let cardsLeft = row.cards - plan.ids.length;
  const topics = plan.ids.map((id): TopicSelection => ({ id, count: 5 }));
  cardsLeft -= topics.reduce((n, x) => n + x.count, 0);
  for (const topic of topics) {
    if (cardsLeft > 0 && extraWords[topic.id]) { topic.count++; cardsLeft--; }
    else if (cardsLeft < 0 && topic.count > 4) {
      topic.count--; cardsLeft++;
      if (plan.images?.includes(topic.id)) topic.images = [1];
    }
  }
  if (cardsLeft || topics.length !== row.categories) throw Error(`Неверный набор тем ${plan.level}`);
  const cards = content8Cards(topics);
  if (new Set(Object.values(cards).map(card => card.text.toLowerCase())).size !== Object.keys(cards).length) throw Error(`Дубли названий ${plan.level}`);
  const id = `campaign-c8-${String(plan.level).padStart(3, '0')}`;
  const common = { id, title: plan.title, campaignLevel: plan.level, version: 1, tags: ['reference-slice'], editorialStatus: 'playtest' };
  let found = false;
  const offset = Number(process.env.C8_SEED_OFFSET ?? 0), max = Number(process.env.C8_TRIES ?? 600);
  const diagnostics = { layouts: 0, wins: 0, viable: 0, bestSlack: 0 };
  for (let i = offset + 1; i <= offset + max && !found; i++) {
    const seed = plan.level * 10000 + i;
    const initial = initialFor({ cards }, row, seed, i > 450);
    if (!initial) continue;
    const deal: Deal = { ...common, initial, cards, winningPath: [] };
    assertBoard(initial, deal);
    diagnostics.layouts++;
    const route = findReferenceRoute(deal, initial, 2600);
    if (route.status !== 'FOUND') continue;
    const metrics = inspect(deal, route.path);
    diagnostics.wins++;
    diagnostics.bestSlack = Math.max(diagnostics.bestSlack, metrics.slack!);
    if (!metrics.lower || !metrics.selectedDraw || metrics.maxRun > 7 || metrics.slack! < 5 || (plan.level === 15 && (!metrics.parked || !metrics.priority))) continue;
    diagnostics.viable++;
    const alternatives: { step: number; action: BoardCommand; path: BoardCommand[]; total: number; extraAgainstWitness: number }[] = [];
    for (const choice of metrics.decisions.filter(x => x.step <= route.path.length * .75)) {
      for (const action of choice.alternatives) {
        if (alternatives.some(a => a.step === choice.step)) continue;
        const after = applyBoard(choice.board, action, deal);
        if (typeof after === 'string') throw Error(after);
        const recovery = findReferenceRoute(deal, after.board, 680);
        if (recovery.status !== 'FOUND') continue;
        const full = [...route.path.slice(0, choice.step), action, ...recovery.path];
        inspect(deal, full);
        alternatives.push({ step: choice.step, action, path: recovery.path, total: full.length, extraAgainstWitness: full.length - route.path.length });
      }
      if (alternatives.length >= 4 && alternatives.some(a => a.extraAgainstWitness > 0)) break;
    }
    if (alternatives.length < 2 || !alternatives.some(a => a.extraAgainstWitness > 0)) continue;
    const { decisions, ...counts } = metrics;
    const record = { ...common, topics, initial, winningPath: route.path };
    const chosen = alternatives.filter(a => a.extraAgainstWitness > 0).slice(0, 2);
    chosen.push(...alternatives.filter(a => !chosen.includes(a)).slice(0, 4 - chosen.length));
    const audit = { level: plan.level, seed, ...counts, actions: route.path.length, stock: initial.stock.length, decisionStates: decisions.length,
      draws: route.path.filter(a => a.type === 'draw').length, recycles: route.path.filter(a => a.type === 'recycle').length,
      alternatives: chosen, visited: route.visited };
    await writeFile(`${root}/level-${plan.level}.json`, JSON.stringify({ record, audit }));
    console.log(plan.level, seed, counts, audit.actions, 'alternatives', alternatives.map(a => a.extraAgainstWitness), 'states', route.visited);
    found = true;
  }
  if (!found) throw Error(`Нет подтверждённого варианта ${plan.level}: ${JSON.stringify(diagnostics)}`);
}
