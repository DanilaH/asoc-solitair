/** Presentation-only resources. Published deal URLs, IDs and save data stay intact. */
import type { Card, Deal } from '../domain/types';
import subjectsByText from './subject-art.json' with { type: 'json' };
export const UI_ART = ['card-face', 'card-category', 'card-back-classic', 'card-back-diamonds', 'hint', 'undo', 'joker', 'coin', 'daily', 'cycle', 'looks', 'milestone', 'key', 'lock', 'spark', 'ribbon'] as const;
export const artUrl = (name: string) => `art/generated/${name}.webp`;
const subjects = new Set(['cat', 'owl', 'octopus', 'turtle', 'pike', 'spruce', 'tulip', 'apple', 'carrot', 'bagel', 'lollipop', 'tea', 'cup', 'shirt', 'boot', 'cap', 'wardrobe', 'candle', 'vacuum', 'keyboard', 'soap', 'brick', 'book', 'eraser', 'drum', 'rope', 'bus', 'sailboat', 'helicopter', 'storm', 'triangle', 'hammer', 'pear']);
/** Legacy fruit/bird/tool images represent pear/owl/hammer, respectively. */
export function illustrationUrl(original: string): string {
  const name = original.split('/').at(-1)!.replace(/\.svg$/, '');
  const subject = ({ fruit: 'pear', bird: 'owl', tool: 'hammer' } as Record<string, string>)[name] ?? name;
  return subjects.has(subject) ? artUrl(subject) : original;
}
const categoryArt = new WeakMap<Deal, Map<string, string>>();
/** Frozen memberships retain their original image metadata; the view is homogeneous. */
export function cardArtwork(card: Card, deal: Deal): string | undefined {
  let art = categoryArt.get(deal);
  if (!art) {
    art = new Map();
    const wordsOnly = new Set(['books', 'building', 'drinks', 'weather']);
    for (const category of new Set(Object.values(deal.cards).map(c => c.category))) {
      const members = Object.values(deal.cards).filter(c => c.category === category && !c.leader);
      if (wordsOnly.has(category) || !members.some(c => c.image) || !members.every(c => (subjectsByText as Record<string, string>)[c.text])) continue;
      for (const member of members) art.set(member.id, artUrl((subjectsByText as Record<string, string>)[member.text]));
    }
    categoryArt.set(deal, art);
  }
  return card.leader ? undefined : art.get(card.id);
}
