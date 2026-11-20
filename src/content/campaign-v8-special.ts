import records from './campaign-v8-special.json' with { type: 'json' };
import type { Deal } from '../domain/types';
import { decodeRoute } from './campaign-v8-dealer';

type SpecialRecord = Omit<Deal, 'winningPath' | 'recoveryPaths'> & { winningPath: string; recoveryPaths: string[] };

export const content8Special: readonly Deal[] = (records as unknown as SpecialRecord[]).map(record => ({
  ...record, winningPath: decodeRoute(record.winningPath), recoveryPaths: record.recoveryPaths.map(decodeRoute),
}));
