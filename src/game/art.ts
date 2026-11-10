/** Presentation-only resources. Published deal URLs, IDs and save data stay intact. */
export const UI_ART = ['card-face', 'card-category', 'card-back-classic', 'card-back-diamonds', 'hint', 'undo', 'joker', 'coin', 'daily', 'cycle', 'looks', 'milestone', 'key', 'lock', 'spark', 'ribbon'] as const;
export const artUrl = (name: string) => `art/generated/${name}.webp`;
const subjects = new Set(['cat', 'owl', 'octopus', 'turtle', 'pike', 'spruce', 'tulip', 'apple', 'carrot', 'bagel', 'lollipop', 'tea', 'cup', 'shirt', 'boot', 'cap', 'wardrobe', 'candle', 'vacuum', 'keyboard', 'soap', 'brick', 'book', 'eraser', 'drum', 'rope', 'bus', 'sailboat', 'helicopter', 'storm', 'triangle', 'hammer', 'pear']);
/** Legacy fruit/bird/tool images represent pear/owl/hammer, respectively. */
export function illustrationUrl(original: string): string {
  const name = original.split('/').at(-1)!.replace(/\.svg$/, '');
  const subject = ({ fruit: 'pear', bird: 'owl', tool: 'hammer' } as Record<string, string>)[name] ?? name;
  return subjects.has(subject) ? artUrl(subject) : original;
}
