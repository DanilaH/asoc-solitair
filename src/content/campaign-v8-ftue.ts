import type { Board, Command, Deal } from '../domain/types';
import { content8Dealer } from './campaign-v8-dealer';
import { decodeLessonRoute, decodeRoute } from './route';
import { coreSpecialDeals } from './campaign-v8-integrated-specials';
import { content8Cards, type Content8TopicSelection } from './content8-words';

/** Own teaching presets. The base bank and all previously issued definitions remain immutable. */
export type PresetSkill = 'planning' | 'joker' | 'ordered-puzzle' | 'frozen' | 'bound' | 'magnet' | 'hammer';
interface TeachingPreset {
  level: number;
  skill: PresetSkill;
  title: string;
  tableau: string[][];
  stock?: string[];
  topics?: Content8TopicSelection[];
  cards?: Deal['cards'];
  route: string;
  tutorial?: string;
  mechanics?: Pick<Deal, 'bound' | 'frozen' | 'puzzle' | 'starter'>;
}
const originals = [...content8Dealer, ...coreSpecialDeals];
const ordered = coreSpecialDeals.find(deal => deal.campaignLevel === 17)!;
const presets: TeachingPreset[] = [
  {
    level: 5, skill: 'planning', title: 'Место для следующей темы',
    topics: [{ id: 'fruit', count: 1 }, { id: 'fish', count: 2 }, { id: 'lights', count: 1 }, { id: 'dishes', count: 2 }],
    tableau: [['fruit_1', 'fruit'], ['lights_1', 'fish'], ['dishes', 'dishes_1', 'lights'], ['fish_2']],
    stock: ['dishes_2', 'fish_1'],
    route: 't0>f0 t1>f1 t2>f2 t3>f1 t2>t3 d d w0>f1 t2>f1 r d w0>f1 t3>f1 t0>f0 t1>f2',
  },
  {
    level: 8, skill: 'joker', title: 'Свободное место с Джокером',
    topics: [{ id: 'sports', count: 1 }, { id: 'tools', count: 2 }, { id: 'gems', count: 2 }],
    tableau: [['sports', 'sports_1'], ['tools_1', 'tools'], ['gems_1'], ['gems', 'tools_2']],
    stock: ['gems_2'],
    route: 't1>f1 t3>f1 t1>f1 t0>t1 t0>f0 t1>f0 t3>f2 t2>f2 d w0>f2',
    tutorial: 'j2 t0>t2 t0>f0 t2>f0 t1>f1 t3>f1 t1>f1 t3>f2 t2>f2 d w0>f2',
  },
  {
    level: 17, skill: 'ordered-puzzle', title: 'Будни и лесные ягоды',
    cards: {
      ...Object.fromEntries(['workdays', 'workdays_1', 'workdays_2', 'workdays_3', 'berries', 'berries_3', 'berries_5']
        .map(id => [id, ordered.cards[id]])),
      ...content8Cards([{ id: 'lights', count: 1 }]),
    },
    tableau: [['workdays_3', 'workdays_1'], ['berries_3', 'workdays_2'], ['berries', 'berries_5', 'workdays']],
    stock: ['lights', 'lights_1'],
    route: 't2>f0 t0>f0 t1>f0 t0>f0 t2>t1 t2>f1 t1>f1 d w0>f2 d w0>f2',
    mechanics: { puzzle: ordered.puzzle },
  },
  {
    level: 19, skill: 'frozen', title: 'Два слоя льда',
    topics: [{ id: 'lights', count: 1 }, { id: 'dishes', count: 1 }, { id: 'air', count: 1 }, { id: 'tools', count: 1 }],
    tableau: [['lights_1', 'lights'], ['dishes_1', 'dishes'], ['air_1'], ['air']],
    stock: ['tools', 'tools_1'],
    route: 't0>f0 t0>f0 t1>f1 t1>f1 t3>f2 t2>f2 d w0>f3 d w0>f3',
    mechanics: { frozen: { version: 1, layers: { air_1: 2 } } },
  },
  {
    level: 24, skill: 'bound', title: 'Ножницы и связанная карта',
    topics: [{ id: 'computer', count: 3 }, { id: 'soups', count: 1 }],
    tableau: [['computer_1', 'computer'], ['soups_1'], ['soups'], ['computer_2']],
    stock: ['computer_3'],
    route: 't0>f0 t3>f0 t2>f1 t1>f1 t0>f0 d w0>f0',
    mechanics: { bound: { version: 1, scissorsByCard: { soups_1: 'computer_2' } } },
  },
  {
    level: 28, skill: 'magnet', title: 'Карта из глубины колоды',
    topics: [{ id: 'kitchen', count: 2 }, { id: 'dishes', count: 2 }, { id: 'lights', count: 1 }],
    tableau: [['kitchen'], ['dishes_1', 'dishes'], ['lights_1'], ['lights']],
    stock: ['kitchen_1', 'dishes_2', 'kitchen_2'],
    route: 't0>f0 d w0>f0 w0>f0 t1>f1 t1>f1 d w0>f1 t3>f2 t2>f2',
    mechanics: { starter: { version: 1, cards: { kitchen_1: 'magnet' } } },
  },
  {
    level: 32, skill: 'hammer', title: 'Карта под рубашкой',
    topics: [{ id: 'boardgames', count: 2 }, { id: 'water', count: 2 }],
    tableau: [['water_1', 'water_2'], ['boardgames'], ['water']],
    stock: ['boardgames_1', 'boardgames_2'],
    route: 't1>f0 d w0>f0 t2>f1 t0>f1 d w0>f0',
    mechanics: { starter: { version: 1, cards: { boardgames_1: 'hammer' } } },
  },
];

export const c8TeachingPresets = presets.map(preset => {
  const base = originals.find(deal => deal.campaignLevel === preset.level)!;
  const winningPath = decodeRoute(preset.route);
  const tutorialPath = preset.tutorial ? decodeLessonRoute(preset.tutorial) : undefined;
  const teachingLength = tutorialPath?.filter(step => step.type !== 'place-joker').length ?? winningPath.length;
  const slack = base.initial.movesLeft === null ? null : base.initial.movesLeft - base.winningPath.length;
  const initial: Board = {
    rulesVersion: 3, phase: 'playing', tableau: preset.tableau,
    foundations: base.initial.foundations.map(() => []), stock: preset.stock ?? [], waste: [],
    faceUp: preset.tableau.flatMap(column => column.slice(-1)), collected: [],
    movesLeft: slack === null ? null : teachingLength + slack,
  };
  const deal: Deal = {
    ...preset.mechanics, id: `campaign-c8-ftue-${String(preset.level).padStart(3, '0')}-r1`, version: 1,
    campaignLevel: preset.level, title: preset.title, initial,
    cards: preset.cards ?? content8Cards(preset.topics!), difficultyTier: base.difficultyTier,
    tags: base.tags, training: base.training, editorialStatus: 'authored-ftue-r1', winningPath, tutorialPath,
  };
  return { deal, base, skill: preset.skill };
});

// The authored core variants demonstrate the one-key lock and golden cards.
export const c8CoreTeachingLevels: ReadonlySet<number> = new Set([26, 27]);
