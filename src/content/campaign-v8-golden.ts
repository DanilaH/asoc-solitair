import { decodeRoute } from './campaign-v8-dealer';
import { prepareGoldenDeal } from '../domain/golden-cards';
import type { Card, Deal } from '../domain/types';

const cards: Record<string, Card> = {
  sea: { id: 'sea', category: 'sea', leader: true, text: 'Море', explanation: 'Слова о море' },
  beach: { id: 'beach', category: 'sea', text: 'Прибой', explanation: 'Слова о море' },
  garden: { id: 'garden', category: 'garden', leader: true, text: 'Огород', explanation: 'Слова об огороде' },
  pumpkin: { id: 'pumpkin', category: 'garden', text: 'Тыква', explanation: 'Слова об огороде' },
};
const base: Deal = {
  id: 'authoring-c8-027-gold-base-r1', version: 1, campaignLevel: 27, title: 'Золотые карты',
  cards, editorialStatus: 'product-adapted-preview', tags: ['golden-cards'],
  initial: { rulesVersion: 3, tableau: [['sea'], ['beach'], ['garden'], []], foundations: [[], []],
    stock: ['pumpkin'], waste: [], faceUp: ['sea', 'beach', 'garden'], collected: [], movesLeft: 20, phase: 'playing' },
  winningPath: decodeRoute('t0>f0 t1>f0 t2>f0 d w0>f0'),
  recoveryPaths: [decodeRoute('t2>f1 d w0>f1 t0>f0 t1>f0')],
};
const preview = prepareGoldenDeal(base, 'campaign-c8-golden-027-r1', { enabled: true, count: 2 }, ['beach', 'pumpkin'], 5);
if (preview.status !== 'APPLIED') throw Error('Golden card preview fixture failed');
export const content8GoldenDeal = preview.deal;
