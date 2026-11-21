import { decodeRoute } from './campaign-v8-dealer';
import type { Card, Deal } from '../domain/types';

const categories = [
  ['spring', 'Весна', 'Капель'],
  ['space', 'Космос', 'Орбита'],
  ['bread', 'Хлеб', 'Мякиш'],
] as const;
const cards = Object.fromEntries(categories.flatMap(([id, title, word]): [string, Card][] => [
  [id, { id, category: id, leader: true, text: title, explanation: title }],
  [id + '-word', { id: id + '-word', category: id, text: word, explanation: title }],
]));

export const content8FrozenDeal: Deal = {
  id: 'campaign-c8-frozen-023-r1', version: 1, campaignLevel: 23, title: 'Карты во льду',
  cards, editorialStatus: 'product-adapted-preview', tags: ['frozen'],
  frozen: { version: 1, layers: { 'space-word': 1, 'bread-word': 2 } },
  initial: {
    rulesVersion: 3, tableau: [['spring'], ['spring-word'], ['space-word'], ['bread-word']],
    foundations: [[], []], stock: ['space', 'bread'], waste: [], faceUp: ['spring', 'spring-word', 'space-word', 'bread-word'],
    collected: [], movesLeft: 24, phase: 'playing',
  },
  winningPath: decodeRoute('t0>f0 t1>f0 d w0>f0 t2>f0 d w0>f0 t3>f0'),
  recoveryPaths: [decodeRoute('d w0>f1 t0>f0 t1>f0 t2>f1 d w0>f0 t3>f0')],
};
