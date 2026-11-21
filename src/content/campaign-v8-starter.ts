import { decodeRoute } from './campaign-v8-dealer';
import type { Card, Deal } from '../domain/types';

const cards: Record<string, Card> = {
  metal: { id: 'metal', category: 'metal', leader: true, text: 'Металлы', explanation: 'Названия металлов' },
  iron: { id: 'iron', category: 'metal', text: 'Железо', explanation: 'Название металла' },
  copper: { id: 'copper', category: 'metal', text: 'Медь', explanation: 'Название металла' },
  repair: { id: 'repair', category: 'repair', leader: true, text: 'Ремонт', explanation: 'Инструменты и материалы' },
  'hammer-word': { id: 'hammer-word', category: 'repair', text: 'Молоток', explanation: 'Инструмент для ремонта' },
  nail: { id: 'nail', category: 'repair', text: 'Гвоздь', explanation: 'Крепёж' },
  'sweet-words': { id: 'sweet-words', category: 'sweet', leader: true, text: 'Десерты', explanation: 'Сладкие блюда' },
  cake: { id: 'cake', category: 'sweet', text: 'Торт', explanation: 'Сладкое блюдо' },
};

export const content8StarterDeal: Deal = {
  id: 'campaign-c8-starter-028-r1', version: 1, campaignLevel: 28, title: 'Стартовые усилители',
  cards, editorialStatus: 'product-adapted-preview', tags: ['starter-tools'],
  starter: { version: 1, cards: { iron: 'magnet', 'hammer-word': 'hammer' } },
  initial: {
    rulesVersion: 3, tableau: [['metal'], ['repair'], ['nail', 'sweet-words'], ['cake'], []],
    foundations: [[], []], stock: ['iron', 'hammer-word', 'copper'], waste: [],
    faceUp: ['metal', 'repair', 'sweet-words', 'cake'], collected: [], movesLeft: 24, phase: 'playing',
  },
  winningPath: decodeRoute('t0>f0 d w0>f0 w0>f0 t1>f1 d w0>f1 t2>f0 t2>f1 t3>f0'),
  recoveryPaths: [decodeRoute('t1>f1 t0>f0 d w0>f0 w0>f0 d w0>f1 t2>f0 t3>f0 t2>f1')],
};
