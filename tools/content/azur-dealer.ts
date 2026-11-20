/** AZUR 1.3.3.8 uses one descending pass and Unity's exclusive upper bound. */
export type AzurRandomRange = (minInclusive: number, maxExclusive: number) => number;

export function shuffleAzurCards<T>(cards: readonly T[], range: AzurRandomRange): T[] {
  const shuffled = [...cards];
  for (let remaining = shuffled.length; remaining > 1; remaining--) {
    const index = range(0, remaining);
    if (!Number.isInteger(index) || index < 0 || index >= remaining) throw Error('AZUR range result is outside the current shuffle range');
    [shuffled[remaining - 1], shuffled[index]] = [shuffled[index], shuffled[remaining - 1]];
  }
  return shuffled;
}

/** Positive, sufficient-card branch. deckInput preserves the Deck.Initialize input order. */
export function dealAzur<T>(cards: readonly T[], columns: number, firstColumnCards: number, range: AzurRandomRange) {
  if (!Number.isSafeInteger(columns) || columns < 1 || columns > cards.length ||
    !Number.isSafeInteger(firstColumnCards) || firstColumnCards < 1 || firstColumnCards > cards.length)
    throw Error('Invalid AZUR column geometry');
  const required = columns * firstColumnCards + columns * (columns - 1) / 2;
  if (required > cards.length) throw Error('Insufficient cards for the AZUR tableau');

  const shuffled = shuffleAzurCards(cards, range);
  const tableau: T[][] = [];
  const faceUp: T[] = [];
  let start = 0;
  for (let column = 0; column < columns; column++) {
    const end = start + firstColumnCards + column;
    tableau.push(shuffled.slice(start, end));
    faceUp.push(shuffled[end - 1]);
    start = end;
  }
  return { tableau, faceUp, deckInput: shuffled.slice(start) };
}
