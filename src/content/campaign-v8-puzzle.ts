import { decodeRoute } from './campaign-v8-dealer';
import type { Card, Deal } from '../domain/types';

const cards: Record<string, Card> = {
  kite: { id: 'kite', category: 'kite', leader: true, text: 'Воздушный змей', explanation: 'Детали воздушного змея' },
  'kite-top': { id: 'kite-top', category: 'kite', text: 'Купол', explanation: 'Верхняя половина воздушного змея' },
  'kite-bottom': { id: 'kite-bottom', category: 'kite', text: 'Хвост', explanation: 'Нижняя половина воздушного змея' },
  winter: { id: 'winter', category: 'winter', leader: true, text: 'Зима', explanation: 'Зимние явления' },
  snow: { id: 'snow', category: 'winter', text: 'Снег', explanation: 'Зимние осадки' },
};

export const content8PuzzleDeal: Deal = {
  id: 'campaign-c8-puzzle-025-r1', version: 1, campaignLevel: 25, title: 'Две половины',
  cards, editorialStatus: 'product-adapted-preview', tags: ['puzzle-pair'],
  puzzle: { version: 1, pairs: [{ top: 'kite-top', bottom: 'kite-bottom' }] },
  initial: {
    rulesVersion: 3, tableau: [['kite'], ['kite-bottom'], ['winter'], ['snow'], []], foundations: [[], []],
    stock: ['kite-top'], waste: [], faceUp: ['kite', 'kite-bottom', 'winter', 'snow'], collected: [], movesLeft: 22, phase: 'playing',
  },
  winningPath: decodeRoute('t0>f0 d w0>t1 t1>f0 t2>f0 t3>f0'),
  recoveryPaths: [decodeRoute('t2>f1 t3>f1 d w0>t1 t0>f0 t1>f0')],
};
