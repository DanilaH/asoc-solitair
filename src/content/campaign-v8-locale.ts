import { beyond80Deals } from './campaign-v8-beyond';
import type { Card, Deal, Save } from '../domain/types';

export const LOCALE_PREVIEW = import.meta.env?.VITE_CONTENT8_LOCALE === '1';
export type ContentLanguage = 'ru'|'en';
export const LOCALE_ART_DIGEST = '010f0bd6099afbcd69e42e2f6e63e16c681d9b74567641bd73b6452928da955d';

const translations: Readonly<Record<string, readonly [string, string, readonly string[]]>> = {
  'ru81-1': ['Home lighting', 'A kind or part of a light fixture used in a home.', ['Chandelier', 'Wall sconce', 'Floor lamp', 'Night light', 'Lamp shade']],
  'ru81-2': ['Candle making', 'An object or material used when making or using a candle.', ['Candle', 'Wick', 'Paraffin', 'Candle holder', 'Wax']],
  'ru81-3': ['Optical parts', 'A component that shapes or filters light in an optical instrument.', ['Prism', 'Aperture', 'Lens', 'Optical filter']],
  'ru81-4': ['Ornamental stones', 'A stone used for jewelry, carving, or decoration.', ['Malachite', 'Lapis lazuli', 'Jasper', 'Onyx']],
  'ru81-5': ['Working glass', 'A way to shape or decorate glass.', ['Glass cutting', 'Glass fusing', 'Engraving', 'Etching']],
  'ru81-6': ['Lighting angles', 'A way to position or diffuse a light source.', ['Backlight', 'Diffused light', 'Uplighting', 'Side lighting']],
};

export function localizedBudget(base: number, english: number, local: number, enabled: boolean) {
  if (!Number.isSafeInteger(base) || base < 1) return { moves: 0, origin: 'zero-base' } as const;
  if (!enabled) return { moves: base, origin: 'unadjusted' } as const;
  if (![english, local].every(count => Number.isSafeInteger(count) && count > 0)) return { moves: base, origin: 'product-fallback' } as const;
  const denominator = BigInt(english) * 5n;
  const adjusted = ((BigInt(base) * BigInt(local) + denominator - 1n) / denominator) * 5n;
  return { moves: Number(adjusted > 2_147_483_647n ? 2_147_483_647n : adjusted), origin: 'positive-model' } as const;
}

const root = beyond80Deals[0];
function englishCard(card: Card): Card {
  const [title, explanation, words] = translations[card.category];
  const word = card.leader ? title : words[Number(card.id.split('_').at(-1)) - 1];
  if (!word) throw Error('Incomplete English definition pack');
  return { ...card, text: word, explanation };
}

const englishCards = Object.fromEntries(Object.values(root.cards).map(card => [card.id, englishCard(card)]));
const memberCount = (cards: Record<string, Card>) => Object.values(cards).filter(card => !card.leader).length;
export const englishBeyondDeal: Deal = {
  ...root, id: 'campaign-c8-beyond-81-en-r1', title: 'The Lighting Workshop',
  initial: { ...root.initial, movesLeft: localizedBudget(root.initial.movesLeft!, memberCount(englishCards), memberCount(root.cards), true).moves },
  cards: englishCards, tags: [...root.tags ?? [], 'locale-en', 'definition-pack-en-r1'],
};

export function localizedCampaignDeal(save: Save, base: Deal): Deal {
  return LOCALE_PREVIEW && base.id === root.id && save.settings.contentLanguage === 'en' ? englishBeyondDeal : base;
}
export function sameLocalizedLevel(id: string, base: Deal): boolean {
  return id === englishBeyondDeal.id && base.id === root.id;
}
export function canSwitchCardLanguage(deal: Deal): boolean {
  return deal.id === root.id || deal.id === englishBeyondDeal.id;
}
