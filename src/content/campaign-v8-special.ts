import restart from './campaign-v8-special-restart.json' with { type: 'json' };
import records from './campaign-v8-special.json' with { type: 'json' };
import type { Deal } from '../domain/types';
import { decodeRoute } from './campaign-v8-dealer';

type SpecialRecord = Omit<Deal, 'winningPath' | 'recoveryPaths'> & { winningPath: string; recoveryPaths: string[] };

const decode = (bank: unknown): readonly Deal[] => (bank as SpecialRecord[]).map(record => ({
  ...record, winningPath: decodeRoute(record.winningPath), recoveryPaths: record.recoveryPaths.map(decodeRoute),
}));

export const content8Special = decode(records);
export const content8SpecialRestart = decode(restart);
