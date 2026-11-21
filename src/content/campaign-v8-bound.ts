import { decodeRoute } from './campaign-v8-dealer';
import type { Card, Deal } from '../domain/types';

const categories = [
  ['post', 'Почта', 'Марка'],
  ['tools', 'Инструменты', 'Ножницы'],
  ['garden', 'Сад', 'Яблоня'],
] as const;
const cards = Object.fromEntries(categories.flatMap(([id, title, word]): [string, Card][] => [
  [id, { id, category: id, leader: true, text: title, explanation: title }],
  [id + '-word', { id: id + '-word', category: id, text: word, explanation: title }],
]));

export const content8BoundDeal: Deal = {
  id: 'campaign-c8-bound-024-r1', version: 1, campaignLevel: 24, title: 'Связанные карты',
  cards, editorialStatus: 'product-adapted-preview', tags: ['bound'],
  bound: { version: 1, scissorsByCard: { 'post-word': 'tools-word' } },
  initial: {
    rulesVersion: 3, tableau: [['post'], ['post-word'], ['garden'], ['garden-word'], []],
    foundations: [[], []], stock: ['tools', 'tools-word'], waste: [], faceUp: ['post', 'post-word', 'garden', 'garden-word'],
    collected: [], movesLeft: 26, phase: 'playing',
  },
  winningPath: decodeRoute('d w0>f0 d w0>f0 t0>f0 t1>f0 t2>f0 t3>f0'),
  recoveryPaths: [decodeRoute('t0>f1 d w0>f0 d w0>f0 t1>f1 t2>f0 t3>f0')],
};
