import { dealAzur, type AzurRandomRange } from './azur-dealer';

export interface AzurPresetItem {
  themeId: number;
  wordIndex: number;
}
export interface AzurPreset {
  enabled: boolean;
  columns: readonly { cards: readonly AzurPresetItem[] }[];
  deckCards: readonly AzurPresetItem[];
}
export interface AzurTutorialTheme {
  themeId: number;
  leader: string;
  words: readonly string[];
}
interface TutorialInput {
  level: number;
  tutorialEnabled: boolean;
  columns: number;
  firstColumnCards: number;
  themes: readonly AzurTutorialTheme[];
  preset?: unknown;
}
type Layout = ReturnType<typeof dealAzur<string>>;
type Fallback = 'ineligible-level' | 'tutorial-disabled' | 'preset-absent' | 'preset-disabled' | 'invalid-preset';
type TutorialLayout = Layout & ({ strategy: 'preset' } | { strategy: 'ordinary'; reason: Fallback });

function fields(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
}

function resolveLayout(preset: Record<string, unknown>, columnCount: number,
  themes: ReadonlyMap<number, AzurTutorialTheme>, total: number): Layout | undefined {
  if (!Number.isSafeInteger(columnCount) || columnCount < 1 || preset.enabled !== true ||
    !Array.isArray(preset.columns) || preset.columns.length !== columnCount ||
    !Array.isArray(preset.deckCards)) return;
  const seen = new Set<string>();
  function resolveCards(cards: readonly unknown[]): string[] | undefined {
    const ids: string[] = [];
    for (const item of cards) {
      const ref = fields(item);
      const themeId = ref?.themeId;
      const wordIndex = ref?.wordIndex;
      if (typeof themeId !== 'number' || !Number.isSafeInteger(themeId) ||
        typeof wordIndex !== 'number' || !Number.isSafeInteger(wordIndex)) return;
      const theme = themes.get(themeId);
      const id = wordIndex < 0 ? theme?.leader : theme?.words[wordIndex];
      if (id === undefined || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }
  const tableau: string[][] = [];
  const faceUp: string[] = [];
  for (const column of preset.columns as unknown[]) {
    const cards = fields(column)?.cards;
    if (!Array.isArray(cards) || cards.length === 0) return;
    const ids = resolveCards(cards);
    if (!ids) return;
    tableau.push(ids);
    faceUp.push(ids[ids.length - 1]);
  }
  const deckInput = resolveCards(preset.deckCards);
  // Exact partition, nonempty columns and duplicate rejection are product authoring rules.
  if (deckInput && seen.size === total) return { tableau, faceUp, deckInput };
}

/** Model the preset branch while keeping the ordinary dealer and its injected RNG independent. */
export function dealAzurTutorial(input: TutorialInput, range: AzurRandomRange): TutorialLayout {
  const themes = new Map(input.themes.map(theme => [theme.themeId, theme]));
  const cards = input.themes.flatMap(theme => [theme.leader, ...theme.words]);
  if (themes.size !== input.themes.length || input.themes.some(theme => !Number.isSafeInteger(theme.themeId)) ||
    new Set(cards).size !== cards.length || cards.some(id => typeof id !== 'string' || !id)) {
    throw Error('Invalid AZUR tutorial card catalog');
  }
  const ordinary = (reason: Fallback): TutorialLayout => ({
    ...dealAzur(cards, input.columns, input.firstColumnCards, range), strategy: 'ordinary', reason,
  });
  if (input.level !== 1) return ordinary('ineligible-level');
  if (!input.tutorialEnabled) return ordinary('tutorial-disabled');
  if (input.preset == null) return ordinary('preset-absent');
  const preset = fields(input.preset);
  if (preset?.enabled === false) return ordinary('preset-disabled');
  const layout = preset && resolveLayout(preset, input.columns, themes, cards.length);
  return layout ? { ...layout, strategy: 'preset' } : ordinary('invalid-preset');
}
