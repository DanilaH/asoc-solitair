import { decodeRoute } from '../../src/content/campaign-v8-dealer';
import type { Card, Deal } from '../../src/domain/types';
import { dealAzurTutorial, type AzurPreset, type AzurPresetItem, type AzurTutorialTheme } from './azur-preset';

const topics = [
  { themeId: 1, id: 'tea', title: 'Чай', words: ['Мята', 'Лимон', 'Мёд'] },
  { themeId: 2, id: 'painting', title: 'Рисование', words: ['Мелок', 'Гуашь', 'Бумага', 'Ластик'] },
  { themeId: 3, id: 'camping', title: 'Поход', words: ['Фляга', 'Компас', 'Палатка', 'Фонарь'] },
] as const;
const references = (themeId: number, ...indexes: number[]): AzurPresetItem[] =>
  indexes.map(wordIndex => ({ themeId, wordIndex }));
export const azurTutorialPreset = {
  enabled: true,
  columns: [
    { cards: references(1, 0, -2) },
    { cards: references(2, 0, 1, -1) },
    { cards: references(3, 0, 1, 2, -1) },
  ],
  deckCards: [
    ...references(3, 3), ...references(2, 3, 2), ...references(1, 2, 1),
  ],
} satisfies AzurPreset;

export const azurTutorialThemes: readonly AzurTutorialTheme[] = topics.map(topic => ({
  themeId: topic.themeId, leader: topic.id, words: topic.words.map((_, index) => `${topic.id}-${index + 1}`),
}));

export function buildAzurPresetExample(): Deal {
  const input = {
    level: 1, tutorialEnabled: true, columns: 3, firstColumnCards: 1,
    themes: azurTutorialThemes, preset: azurTutorialPreset,
  };
  const layout = dealAzurTutorial(input, () => { throw Error('Authored preset unexpectedly drew RNG'); });
  if (layout.strategy !== 'preset') throw Error('Authored AZUR example did not pass preset validation');
  const cards: Record<string, Card> = {};
  for (const [index, topic] of topics.entries()) {
    const theme = azurTutorialThemes[index];
    cards[theme.leader] = { id: theme.leader, category: topic.id, text: topic.title, leader: true, explanation: topic.title };
    for (const [wordIndex, id] of theme.words.entries()) {
      cards[id] = { id, category: topic.id, text: topic.words[wordIndex], explanation: topic.title };
    }
  }
  return {
    id: 'authoring-azur-preset-001-r1', version: 1, campaignLevel: 1, title: 'Знакомые темы',
    cards, editorialStatus: 'authoring-preview', tags: ['azur-preset'],
    initial: {
      rulesVersion: 3, tableau: layout.tableau, faceUp: layout.faceUp, foundations: [[], [], []],
      // The native deck draws from the end. Our game draws from the front.
      stock: layout.deckInput.slice().reverse(), waste: [], collected: [], movesLeft: 50, phase: 'playing',
    },
    winningPath: decodeRoute('t0>f0 t1>f1 t2>f2 t0>f0 t1>f1 t1>f1 t2>f2 t2>f2 t2>f2 d w0>f0 d w0>f0 d w0>f1 d w0>f1 d w0>f2'),
  };
}
