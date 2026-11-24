import type { RandomJokerAccess, Save } from './types';

const natural = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
export function validRandomJokerAccess(value: RandomJokerAccess): boolean {
  return Boolean(value && value.version === 1 && value.source === 'coins' &&
    typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) &&
    natural(value.cost) && natural(value.issuedAt) &&
    (value.consumed === undefined || value.consumed === true));
}

export function validRandomJokerRights(state: NonNullable<Save['randomJokers']>): boolean {
  return Boolean(state && state.version === 1 && Array.isArray(state.grants) &&
    state.grants.every(validRandomJokerAccess) && new Set(state.grants.map(grant => grant.id)).size === state.grants.length);
}

/** Read legacy rights too, until the coordinated migration has been persisted. */
export function unusedRandomJoker(save: Save): RandomJokerAccess | undefined {
  const grants = new Map((save.randomJokers?.grants ?? []).map(grant => [grant.id, grant]));
  for (const attempt of [save.attempt, save.parked?.campaign]) {
    const legacy = attempt?.randomJokerAccess;
    if (legacy && (!grants.has(legacy.id) || legacy.consumed)) grants.set(legacy.id, legacy);
  }
  return [...grants.values()].find(grant => !grant.consumed);
}

export function randomJokerCount(save: Save): number {
  const grants = new Map((save.randomJokers?.grants ?? []).map(grant => [grant.id, grant]));
  for (const attempt of [save.attempt, save.parked?.campaign]) {
    const legacy = attempt?.randomJokerAccess;
    if (legacy && (!grants.has(legacy.id) || legacy.consumed)) grants.set(legacy.id, legacy);
  }
  return [...grants.values()].filter(grant => !grant.consumed).length;
}

/** Called after codec validation, or before an explicit attempt replacement. */
export function migrateRandomJokerRights(save: Save): boolean {
  let changed = false;
  for (const attempt of [save.attempt, save.parked?.campaign]) {
    const legacy = attempt?.randomJokerAccess;
    if (!legacy) continue;
    if (!validRandomJokerAccess(legacy)) throw Error('Повреждён заряд случайного Джокера');
    const rights = save.randomJokers ??= { version: 1, grants: [] };
    const known = rights.grants.find(grant => grant.id === legacy.id);
    if (known) {
      if (known.cost !== legacy.cost || known.issuedAt !== legacy.issuedAt || known.source !== legacy.source)
        throw Error('Противоречивое право случайного Джокера');
      if (legacy.consumed && !known.consumed) { known.consumed = true; changed = true; }
    } else { rights.grants.push({ ...legacy }); changed = true; }
    // Consumed receipts still describe the effect owned by this historical board.
    if (!legacy.consumed) { delete attempt!.randomJokerAccess; changed = true; }
  }
  if (changed) save.revision++;
  return changed;
}
