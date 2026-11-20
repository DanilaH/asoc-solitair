import { expect, it, vi } from 'vitest';
import { applyBoard } from '../../src/domain/engine';
import { dealAzur } from '../../tools/content/azur-dealer';
import { dealAzurTutorial } from '../../tools/content/azur-preset';
import { azurTutorialPreset, azurTutorialThemes, buildAzurPresetExample } from '../../tools/content/azur-preset-example';

const preset = azurTutorialPreset;
const input = { level: 1, tutorialEnabled: true, columns: 3, firstColumnCards: 1, themes: azurTutorialThemes, preset };
const cards = azurTutorialThemes.flatMap(theme => [theme.leader, ...theme.words]);

it('places the authored deal in order and opens each last card without drawing RNG', () => {
  const range = vi.fn(() => 0);
  const original = structuredClone(input);
  expect(dealAzurTutorial(input, range)).toEqual({
    strategy: 'preset',
    tableau: [['tea-1', 'tea'], ['painting-1', 'painting-2', 'painting'], ['camping-1', 'camping-2', 'camping-3', 'camping']],
    faceUp: ['tea', 'painting', 'camping'],
    deckInput: ['camping-4', 'painting-4', 'painting-3', 'tea-3', 'tea-2'],
  });
  expect(range).not.toHaveBeenCalled();
  expect(input).toEqual(original);
});

it.each([
  ['other level', { level: 2 }, 'ineligible-level'],
  ['disabled tutorial', { tutorialEnabled: false }, 'tutorial-disabled'],
  ['missing preset', { preset: undefined }, 'preset-absent'],
  ['null preset', { preset: null }, 'preset-absent'],
  ['disabled preset', { preset: { enabled: false } }, 'preset-disabled'],
  ['non-boolean flag', { preset: { ...preset, enabled: 1 } }, 'invalid-preset'],
  ['non-object preset', { preset: [] }, 'invalid-preset'],
  ['missing column', { preset: { ...preset, columns: preset.columns.slice(1) } }, 'invalid-preset'],
  ['empty column', { preset: { ...preset, columns: [{ cards: [] }, ...preset.columns.slice(1)] } }, 'invalid-preset'],
  ['null column', { preset: { ...preset, columns: [null, ...preset.columns.slice(1)] } }, 'invalid-preset'],
  ['unknown theme', { preset: { ...preset, deckCards: [...preset.deckCards.slice(1), { themeId: 123, wordIndex: 0 }] } }, 'invalid-preset'],
  ['out-of-range word', { preset: { ...preset, deckCards: [...preset.deckCards.slice(1), { themeId: 1, wordIndex: 3 }] } }, 'invalid-preset'],
  ['fractional index', { preset: { ...preset, deckCards: [...preset.deckCards.slice(1), { themeId: 1, wordIndex: 0.5 }] } }, 'invalid-preset'],
  ['duplicate category alias', { preset: { ...preset, deckCards: [...preset.deckCards.slice(1), { themeId: 1, wordIndex: -5 }] } }, 'invalid-preset'],
  ['incomplete partition', { preset: { ...preset, deckCards: preset.deckCards.slice(1) } }, 'invalid-preset'],
] as const)('uses the ordinary shuffle for %s with exactly the usual RNG calls', (_name, change, reason) => {
  const range = vi.fn((_min: number, max: number) => Math.floor(max / 2));
  expect(dealAzurTutorial({ ...input, ...change }, range)).toEqual({
    ...dealAzur(cards, 3, 1, (_min, max) => Math.floor(max / 2)), strategy: 'ordinary', reason,
  });
  expect(range.mock.calls).toEqual(Array.from({ length: cards.length - 1 }, (_, i) => [0, cards.length - i]));
});

it('rejects an ambiguous card catalog before routing or drawing RNG', () => {
  const range = vi.fn(() => 0);
  const themes = [...input.themes, { themeId: 4, leader: 'tea', words: [] }];
  expect(() => dealAzurTutorial({ ...input, themes }, range)).toThrow('Invalid AZUR tutorial card catalog');
  expect(range).not.toHaveBeenCalled();
});

it('builds a deterministic Rules 3 deal and plays all five stock cards in native draw order', () => {
  const deal = buildAzurPresetExample();
  expect(buildAzurPresetExample()).toEqual(deal);
  let board = deal.initial;
  const draws: (string | undefined)[] = [];
  for (const move of deal.winningPath) {
    const next = applyBoard(board, move, deal);
    if (typeof next === 'string') throw Error(next);
    board = next.board;
    if (move.type === 'draw') draws.push(board.waste.at(-1));
  }
  expect(draws).toEqual(['tea-2', 'tea-3', 'painting-3', 'painting-4', 'camping-4']);
  expect(deal.winningPath).toHaveLength(19);
  expect(board).toMatchObject({ phase: 'won', movesLeft: 31 });
});
