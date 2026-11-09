import records from './daily-pool.json' with { type: 'json' };
import { cardsFor, type TopicSelection } from './topics';
import { dayNumber } from '../domain/meta';
import type { Board, BoardCommand, Deal } from '../domain/types';
export const DAILY_CONTENT_VERSION = 1;
export const dailyPool: readonly Deal[] = records.map(r => ({ id: r.id, version: r.version, title: 'Задание дня', cards: cardsFor(r.topics as TopicSelection[]), initial: r.initial as Board, winningPath: r.winningPath as BoardCommand[], editorialStatus: r.editorialStatus, tags: ['daily'] }));
export function dailyForDay(dayId: string, version = DAILY_CONTENT_VERSION): Deal {
  if (version !== 1) throw Error('Неизвестная версия daily');
  const index = ((dayNumber(dayId) - dayNumber('2026-01-01')) % dailyPool.length + dailyPool.length) % dailyPool.length;
  const base = dailyPool[index];
  return { ...base, id: `daily-v${version}-${dayId}`, daily: { dayId, contentVersion: version, poolId: base.id } };
}
export function findDaily(id: string): Deal | undefined {
  const match = /^daily-v(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(id);
  try { return match ? dailyForDay(match[2], Number(match[1])) : undefined; } catch { return; }
}
