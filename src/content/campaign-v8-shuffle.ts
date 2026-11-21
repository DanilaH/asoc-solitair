import { decodeRoute } from './campaign-v8-dealer';
import type { Card, Deal } from '../domain/types';

const cards: Record<string, Card> = {
  trees: { id: 'trees', category: 'tree', leader: true, text: 'Деревья', explanation: 'Названия деревьев' },
  birch: { id: 'birch', category: 'tree', text: 'Берёза', explanation: 'Лиственное дерево' },
  maple: { id: 'maple', category: 'tree', text: 'Клён', explanation: 'Лиственное дерево' },
  rocks: { id: 'rocks', category: 'rock', leader: true, text: 'Минералы', explanation: 'Горные породы и минералы' },
  quartz: { id: 'quartz', category: 'rock', text: 'Кварц', explanation: 'Минерал' },
  mica: { id: 'mica', category: 'rock', text: 'Слюда', explanation: 'Минерал' },
};
export const content8ShuffleDeal: Deal = {
  id: 'campaign-c8-shuffle-029-r1', version: 1, campaignLevel: 29, title: 'Новый порядок колоды',
  cards, editorialStatus: 'product-adapted-preview', tags: ['stock-shuffle'], shufflePreview: 1,
  initial: { rulesVersion: 3, tableau: [['trees'], ['rocks'], [], []], foundations: [[], []],
    stock: ['birch', 'quartz', 'maple', 'mica'], waste: [], faceUp: ['trees', 'rocks'], collected: [], movesLeft: 30, phase: 'playing' },
  winningPath: decodeRoute('t0>f0 t1>f1 d w0>f0 d w0>f1 d w0>f0 d w0>f1'),
};
