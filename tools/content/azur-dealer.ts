/** AZUR 1.3.3.8 uses one descending pass and Unity's exclusive upper bound. */
export type AzurRandomRange = (minInclusive: number, maxExclusive: number) => number;

interface AzurThemeInput { themeId: number; wordCount: number }
type AzurCardRef = { themeId: number; kind: 'category' } |
  { themeId: number; kind: 'word'; memberOrdinal: number; wordIndex: number };

/** Positive source count override comes from a successful art load, supplied by the caller. */
export function generateAzurCards(themes: readonly AzurThemeInput[], loadedCounts?: ReadonlyMap<number, number>): AzurCardRef[] {
  const ids = new Set<number>();
  return themes.flatMap<AzurCardRef>(({ themeId, wordCount }) => {
    if (!Number.isSafeInteger(themeId) || ids.has(themeId) || !Number.isSafeInteger(wordCount) || wordCount < 0) {
      throw Error('Invalid AZUR theme input');
    }
    ids.add(themeId);
    const loaded = loadedCounts?.get(themeId);
    if (loaded !== undefined && !Number.isSafeInteger(loaded)) throw Error('Invalid loaded AZUR card count');
    const count = wordCount === 0 ? 0 : loaded !== undefined && loaded > 0 ? loaded : wordCount;
    const cards: AzurCardRef[] = [{ themeId, kind: 'category' }];
    for (let memberOrdinal = 0; memberOrdinal < count; memberOrdinal++) {
      cards.push({ themeId, kind: 'word', memberOrdinal, wordIndex: memberOrdinal % wordCount });
    }
    return cards;
  });
}

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

export function traceAzurDeal(cards: readonly AzurCardRef[], columns: number, firstColumnCards: number, range: AzurRandomRange) {
  const managerOrder = [...cards];
  const draws: { minInclusive: number; maxExclusive: number; result: number }[] = [];
  const layout = dealAzur(managerOrder, columns, firstColumnCards, (minInclusive, maxExclusive) => {
    const result = range(minInclusive, maxExclusive);
    draws.push({ minInclusive, maxExclusive, result });
    return result;
  });
  return { managerOrder, shuffledOrder: [...layout.tableau.flat(), ...layout.deckInput], draws, ...layout };
}
