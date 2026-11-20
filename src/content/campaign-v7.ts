import data from './campaign-v7.json' with {type:'json'};
import {expansionCards,type ExpansionSelection} from './expansion-cards';
import type {Board,BoardCommand,Deal} from '../domain/types';
export interface Content7Record extends ExpansionSelection {
 id:string;version:number;campaignLevel:number;title:string;initial:Board;winningPath:BoardCommand[];
 tags:string[];editorialStatus:string;lock?:Deal['lock'];
}
/** Frozen definitions only. Authoring/search and research documents never enter runtime. */
export const content7Records=data as unknown as Content7Record[];
export const content7Deals:readonly Deal[]=content7Records.map(record=>({
 id:record.id,version:record.version,campaignLevel:record.campaignLevel,title:record.title,
 initial:record.initial,winningPath:record.winningPath,cards:expansionCards(record),
 tags:record.tags,editorialStatus:record.editorialStatus,...(record.lock?{lock:record.lock}:{}),
}));
