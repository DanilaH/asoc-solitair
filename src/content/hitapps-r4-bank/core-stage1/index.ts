import level1 from './001.json' with { type: 'json' };
import level2 from './002.json' with { type: 'json' };
import level3 from './003.json' with { type: 'json' };
import level4 from './004.json' with { type: 'json' };
import level5 from './005.json' with { type: 'json' };
import level6 from './006.json' with { type: 'json' };
import level7 from './007.json' with { type: 'json' };
import level8 from './008.json' with { type: 'json' };
import level9 from './009.json' with { type: 'json' };
import level10 from './010.json' with { type: 'json' };
import level11 from './011.json' with { type: 'json' };
import level12 from './012.json' with { type: 'json' };
import level13 from './013.json' with { type: 'json' };
import level14 from './014.json' with { type: 'json' };
import level15 from './015.json' with { type: 'json' };
import type { SourceRecord } from '../../hitapps-r4-bank';

export const openingSourceRecords = [...level1, ...level2, ...level3, ...level4, ...level5, ...level6, ...level7, ...level8, ...level9, ...level10, ...level11, ...level12, ...level13, ...level14, ...level15] as unknown as readonly SourceRecord[];
