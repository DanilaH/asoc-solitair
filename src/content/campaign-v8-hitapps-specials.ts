import { LEGACY_OWNER_PREVIEW } from '../domain/types';
import { decodeRoute } from './campaign-v8-dealer';
import type { Card, Deal } from '../domain/types';

export const HITAPPS_SPECIALS_PREVIEW = LEGACY_OWNER_PREVIEW === 'specials';
const card = (id: string, category: string, text: string, extra: Partial<Card> = {}): Card =>
  ({ id, category, text, explanation: text, ...extra });

export const oneKeyDeal: Deal = {
  id: 'campaign-c8-one-key-018-r1', version: 1, campaignLevel: 18, title: 'Один ключ',
  editorialStatus: 'product-adapted-preview', tags: ['keys'],
  cards: {
    birds: card('birds', 'birds', 'Птицы', { leader: true }),
    owl: card('owl', 'birds', 'Сова', { keyId: 'single-key' }),
    wood: card('wood', 'wood', 'Деревья', { leader: true }),
    spruce: card('spruce', 'wood', 'Ель'),
  },
  lock: { version: 2, column: 2, requiredKeys: ['single-key'] },
  initial: { rulesVersion: 3, tableau: [['owl', 'birds'], ['wood'], ['spruce']], foundations: [[], []],
    stock: [], waste: [], faceUp: ['birds', 'wood'], collected: [], movesLeft: 12, phase: 'playing' },
  winningPath: decodeRoute('t0>f0 t0>f0 t1>f1 t2>f1'),
};

export const picturedSpecialsDeal: Deal = {
  id: 'campaign-c8-pictured-specials-026-r1', version: 1, campaignLevel: 26, title: 'Картинка и порядок',
  cards: {
    shore: card('shore', 'shore', 'Берег', { leader: true }),
    sand: card('sand', 'shore', 'Песок'),
    turtle: card('turtle', 'turtle', 'Черепаха', { leader: true }),
    'shell-top': card('shell-top', 'turtle', 'Верх рисунка'),
    'shell-bottom': card('shell-bottom', 'turtle', 'Низ рисунка'),
    days: card('days', 'days', 'Будни', { leader: true, ordered: true }),
    monday: card('monday', 'days', 'Понедельник', { rank: 1 }),
    forest: card('forest', 'forest', 'Лес', { leader: true }),
    pines: card('pines', 'forest', 'Сосны'),
  },
  editorialStatus: 'product-adapted-preview', tags: ['puzzle-pair', 'frozen', 'bound', 'ordered'],
  frozen: { version: 1, layers: { 'shell-bottom': 2 } },
  bound: { version: 1, scissorsByCard: { pines: 'monday', 'shell-bottom': 'sand' } },
  puzzle: { version: 1, pairs: [{ top: 'shell-top', bottom: 'shell-bottom', illustration: 'art/generated/turtle.webp' }] },
  initial: {
    rulesVersion: 3, tableau: [['shore'], ['sand'], ['days'], ['pines'], ['shell-bottom']],
    foundations: [[], [], [], []], stock: ['monday', 'shell-top', 'turtle', 'forest'], waste: [],
    faceUp: ['shore', 'sand', 'days', 'pines', 'shell-bottom'], collected: [], movesLeft: 24, phase: 'playing',
  },
  winningPath: decodeRoute('t0>f0 t1>f0 t2>f1 d w0>f1 d w0>t4 d w0>f2 t4>f2 d w0>f3 t3>f3'),
};
