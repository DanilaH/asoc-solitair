import part1 from './late-1.json' with { type: 'json' };
import part2 from './late-2.json' with { type: 'json' };
import part3 from './late-3.json' with { type: 'json' };
import part4 from './late-4.json' with { type: 'json' };
import part5 from './late-5.json' with { type: 'json' };
import part6 from './late-6.json' with { type: 'json' };
import part7 from './late-7.json' with { type: 'json' };
import type { SourceRecord } from '../../hitapps-r4-bank';

export const lateSourceRecords = [...part1, ...part2, ...part3, ...part4, ...part5, ...part6, ...part7] as unknown as readonly SourceRecord[];
