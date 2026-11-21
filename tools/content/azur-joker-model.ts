import type { AzurRandomRange } from './azur-dealer';

export interface AzurJokerBoard<Undo> {
  version: 1;
  cardIds: readonly string[];
  tableau: readonly (readonly string[])[];
  faceUp: readonly string[];
  undo?: readonly Undo[];
}

/** Isolated native-static insertion model. The caller supplies RNG state and a newly constructed card identity. */
export function modelAzurRandomJoker<Undo>(state: AzurJokerBoard<Undo>, configuredBound: number,
  range: AzurRandomRange, createId: () => string | undefined) {
  if (!Number.isSafeInteger(configuredBound) || configuredBound <= 0 || state.version !== 1) {
    return { status: 'INVALID_CONFIG', state } as const;
  }
  const upperExclusive = Math.min(configuredBound, state.tableau.length);
  if (!upperExclusive) return { status: 'NO_COLUMN', state } as const;
  const index = range(0, upperExclusive);
  if (!Number.isSafeInteger(index) || index < 0 || index >= upperExclusive || !state.tableau[index]) {
    return { status: 'INVALID_TARGET', state } as const;
  }
  const id = createId();
  if (!id || state.cardIds.includes(id) || state.faceUp.includes(id) || state.tableau.some(column => column.includes(id))) {
    return { status: 'INVALID_CARD', state } as const;
  }

  const next: AzurJokerBoard<Undo> = {
    ...state,
    cardIds: [...state.cardIds, id],
    tableau: state.tableau.map((column, columnIndex) => columnIndex === index ? [...column, id] : column),
    faceUp: [...state.faceUp, id],
    ...(state.undo === undefined ? {} : { undo: [] }),
  };
  return {
    status: 'INSERTED', state: next,
    card: { id, nativeType: 2, column: index, faceUp: true },
    event: 'JOKER_USED',
  } as const;
}
