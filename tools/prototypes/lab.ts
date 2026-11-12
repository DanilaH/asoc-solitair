import Phaser from 'phaser';
import { BoardScene } from '../../src/game/BoardScene';
import { cardReader } from '../../src/game/card-reader';
import { illustrationUrl } from '../../src/game/art';
import { dispatch, freshSave } from '../../src/domain/engine';
import type { Command } from '../../src/domain/types';
import type { Prototype } from './build';
import data from './deals.json' with { type: 'json' };
import './style.css';
const deals=data as unknown as Prototype[], $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
let index=0,deal=deals[0],save=freshSave(deal,crypto.randomUUID()),scene:BoardScene,ready=false;
const choices=$<HTMLSelectElement>('#choose');deals.forEach((d,i)=>choices.add(new Option(`Раздача ${i+1}`,String(i))));
function hud(){ $('#lab').dataset.revision=String(save.revision);$('#undo').textContent='Отмена · '+save.profile.undos; $('#moves').textContent=`Ходы: ${save.attempt.board.movesLeft}`;$('#status').textContent=save.attempt.board.phase==='won'?'Всё сошлось!':save.attempt.board.phase==='exhausted'?'Ходы закончились':'';$('#lab').dataset.phase=save.attempt.board.phase;$<HTMLButtonElement>('#undo').disabled=!save.attempt.undo.length||save.attempt.board.phase==='won'; }
function command(c:Command){const result=dispatch(save,c,deal);save=result.next;if(result.accepted)scene.sync(result.events,false,['transfer','draw','recycle'].includes(c.type)?c as any:undefined);else $('#status').textContent=result.reason??'';if(result.accepted)hud();}
function select(i:number){index=i;deal=deals[i];save=freshSave(deal,crypto.randomUUID());choices.value=String(i);scene.setDeal(deal);hud();}
const root=$('#field');scene=new BoardScene({deal,getSave:()=>save,command,sound(){},praise(){},inspect(id){const c=deal.cards[id],r=cardReader(c,deal);$('#title').textContent=r.title;$('#description').textContent=r.description??'';const img=$<HTMLImageElement>('#image');img.hidden=!c.image;if(c.image){img.src=illustrationUrl(c.image);img.alt=c.text;}scene.setInspect(false);scene.setEnabled(false);$<HTMLDialogElement>('#reader').showModal();},ready(s){scene=s;ready=true;scene.setEnabled(true);hud();$('#lab').dataset.ready='true';}});
await document.fonts.ready;
const game=new Phaser.Game({type:Phaser.AUTO,parent:root,width:root.clientWidth,height:root.clientHeight,transparent:true,banner:false,audio:{noAudio:true},scene:[scene]});
new ResizeObserver(()=>{if(ready)game.scale.resize(root.clientWidth,root.clientHeight)}).observe(root);
choices.onchange=()=>select(Number(choices.value));$('#restart').onclick=()=>select(index);$('#next').onclick=()=>select((index+1)%deals.length);$('#undo').onclick=()=>command({type:'undo'});$('#inspect').onclick=()=>scene.setInspect(true);$('#close').onclick=()=>{$<HTMLDialogElement>('#reader').close();scene.setEnabled(true)};
$('#reader').addEventListener('close',()=>scene.setEnabled(true));
// Deliberately no localStorage, campaign registration, SDK, analytics, monetization or production route.
