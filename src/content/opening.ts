import data from './opening-v6.json' with {type:'json'};
import type {Deal} from '../domain/types';
/** Revision-specific IDs keep old active/parked attempts on their original definitions. */
export const openingDeals:readonly Deal[]=data as unknown as Deal[];
