/** Independent UI/UX/feel evidence. No runtime changes; actual production inputs. */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { findDeal,campaignDeals } from '../../src/content/campaign';
import { extendedRecords } from '../../src/content/campaign-meta-bank';
import { playtestCore } from '../../src/content/campaign-playtest';
import { dailyForDay } from '../../src/content/daily';
import { openDailyBonusRound } from '../../src/domain/events/daily-bonus';
import { m1WeekRows,scheduleTasks } from '../../src/domain/events/daily-tasks';
import { addWinStreakProgress } from '../../src/domain/events/win-streak';
import { profileAt,play } from '../fixtures/functional-audit-225';
import { applyBoard, dispatch, sourceCards } from '../../src/domain/engine';
import { boardFrame,layout,cardMetrics } from '../../src/game/layout';
import { categoryCaption } from '../../src/game/captions';
import type { Deal,Save,BoardCommand } from '../../src/domain/types';
import { read } from './wallet-fixture';

const mode=process.env.VITE_ASOC_CAMPAIGN_PLAYTEST??'',family=mode||'ordinary';
const now=Date.UTC(2026,10,30,12);
const root=process.env.ASOC_UI250_OUT??'.recording/ui250-before/'+family;
mkdirSync(root,{recursive:true});
const report:Record<string,unknown>[]=[];
const pics:{name:string,path:string}[]=[];
function at(level:number){
  if(mode==='azur21-v1'||mode==='hybrid21-v1'){
    const bank=playtestCore(level,mode,25);
    if(bank&&level>=81&&level<=101){
      const entry=bank.byLevel.get(level)!.find(e=>e.penalty===0)!;
      return bank.byId.get(entry.deal.id+'-m1')!.deal;
    }
  }
  return findDeal(extendedRecords(level)[0].deal.id+'-core-stage1-v1-m1')!;
}
function sample(d:Deal,reduce=false){
  const s=profileAt(d,'ux-audit-'+(d.campaignLevel??'daily'));
  s.contentVersion=8;s.settings.reducedMotion=reduce;s.profile.coins=12345678;
  s.profile.hints=3;s.profile.undos=5;s.profile.jokers=1;
  s.campaign!.tutorials.push('intro:bonus-tableau','intro:bonus-foundation','learn:category','learn:match','learn:stock','hint-demo','undo-used','joker-used','ftue:shuffle-used:r1');
  s.attempt.teachingAds={version:1,ordinary:2};
  s.campaignLives={version:2,remaining:0,observedAt:now,refillAt:now+60000,earnedCredits:0};
  addWinStreakProgress(s,6);
  scheduleTasks(s,now,m1WeekRows(0),[{id:'m1-week-50',medals:50,prize:{kind:'Coins',quantity:15}},
    {id:'m1-week-100',medals:100,prize:{kind:'Definition',quantity:1}},
    {id:'m1-week-300',medals:300,prize:{kind:'Coins',quantity:25}},
    {id:'m1-week-600',medals:600,prize:{kind:'Coins',quantity:30}},
    {id:'m1-week-1000',medals:1000,prize:{kind:'Coins',quantity:30},chest:{kind:'Undo',quantity:1}}],'azur-m1-week-r1');
  s.dailyTasks!.weeks[0].totalMedals=1000;
  s.dailyTasks!.inventory.shuffles=2;
  s.dailyTasks!.inventory.definitions=2;
  return s;
}
async function load(page:Page,s:Save,banner=0){
  if(page.url()==='about:blank'){await page.clock.install({time:new Date(now)});await page.goto('/');}
  await page.evaluate(v=>localStorage.setItem('asoc-solitaire.save.v1',JSON.stringify(v)),s);
  await page.reload();await expect(page.locator('#app')).toHaveAttribute('data-ready','true',{timeout:15000});
  if(banner)await page.locator('#banner-slot').evaluate((n,h)=>{n.removeAttribute('hidden');n.style.height=h+'px'},banner);
  await page.evaluate(()=>document.fonts.ready);
}
async function settle(page:Page){await page.waitForTimeout(260);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
const idFor=(n:HTMLElement)=>n.id||n.tagName;
async function audit(page:Page,name:string,surface:string,shot=true){
  await settle(page);
  const info=await page.locator(surface).evaluate(root=>{
    const epsilon=2;
    const rect=(n:Element)=>n.getBoundingClientRect();
    const visible=(n:HTMLElement)=>{const s=getComputedStyle(n),r=rect(n);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!n.closest('[hidden],.sr-only,[aria-hidden=true].sr-only');};
    const describe=(n:HTMLElement)=>n.id?'#'+n.id:n.tagName.toLowerCase()+'.'+String(n.className).split(' ').slice(0,2).join('.');
    const clip:object[]=[],tiny:object[]=[],buttons:{node:string;name:string;w:number;h:number;hit:boolean;below44:boolean;inScroller:boolean}[]=[],overflows:object[]=[],iconIssues:object[]=[],intersect:object[]=[];
    const nodes=[root as HTMLElement,...root.querySelectorAll<HTMLElement>('*')].filter(visible);
    const clamp=(n:number)=>Math.round(n*10)/10;
    for(const e of nodes){
      const s=getComputedStyle(e),b=rect(e);
      if(e.clientWidth>0&&e.scrollWidth>e.clientWidth+epsilon&&['hidden','clip','auto','scroll'].includes(s.overflowX))
        overflows.push({node:describe(e),overflow:s.overflowX,px:e.scrollWidth-e.clientWidth,text:e.textContent?.trim().slice(0,65)});
      if(e instanceof HTMLImageElement&&(!e.complete||!e.naturalWidth))iconIssues.push({node:describe(e),src:e.getAttribute('src')});
      const walk=[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim());
      if(!walk.length)continue;
      for(const n of walk){
        const r=document.createRange();r.selectNodeContents(n);
        for(const box of Array.from(r.getClientRects())){
          if(!box.width||!box.height)continue;
          let hard:string|undefined;
          // Only count genuine text clipping, not deliberate scrolling. Padding-box clipping.
          for(let parent:HTMLElement|null=e;parent&&parent!==document.body;parent=parent.parentElement){
            const cs=getComputedStyle(parent),p=rect(parent);
            const left=p.left+parent.clientLeft,top=p.top+parent.clientTop,right=left+parent.clientWidth,bottom=top+parent.clientHeight;
            const x=['clip','hidden'].includes(cs.overflowX)&&parent.clientWidth>0&&(box.left<left-epsilon||box.right>right+epsilon);
            const y=['clip','hidden'].includes(cs.overflowY)&&parent.clientHeight>0&&(box.top<top-epsilon||box.bottom>bottom+epsilon);
            if(x||y){hard=describe(parent)+':'+(x?'x':'')+(y?'y':'');break;}
            // Content below a scrollport isn't a hard clipping failure.
            if(['auto','scroll'].includes(cs.overflowY)&&parent.scrollHeight>parent.clientHeight+epsilon)break;
          }
          if(hard)clip.push({node:describe(e),by:hard,text:n.textContent?.trim().slice(0,100),font:s.fontSize});
          if(parseFloat(s.fontSize)<12&&box.top>=0&&box.bottom<=innerHeight&&box.right<=innerWidth)
            tiny.push({node:describe(e),text:n.textContent?.trim().slice(0,65),font:parseFloat(s.fontSize)});
        }
      }
    }
    const hits=nodes.filter(e=>e.matches('button,summary,select,input[type=checkbox]'));
    for(const e of hits){
      const b=rect(e),inView=b.top>=-1&&b.left>=-1&&b.bottom<=innerHeight+1&&b.right<=innerWidth+1;
      const enabled=!e.matches(':disabled,[aria-disabled=true]'),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
      const name=e.getAttribute('aria-label')||e.innerText?.trim()||e.getAttribute('title')||'';
      const click=inView&&!!target&&e.contains(target);
      const inScroller=!!e.closest('.sheet-body,#pause-options,#home,.home-scroll');
      if(inView&&enabled)buttons.push({node:describe(e),name:name.slice(0,70),w:clamp(b.width),h:clamp(b.height),hit:click,below44:b.width<43.5||b.height<43.5,inScroller});
    }
    const label=root.querySelector('h2'),close=root.querySelector('.close');
    if(label&&close&&visible(label as HTMLElement)&&visible(close as HTMLElement)){
      const r=document.createRange();r.selectNodeContents(label);const b=rect(close);
      for(const a of r.getClientRects())if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)
        intersect.push({type:'title-close',title:label.textContent,close:describe(close as HTMLElement)});
    }
    const br=rect(root);
    return{viewport:[innerWidth,innerHeight],surface:[clamp(br.x),clamp(br.y),clamp(br.width),clamp(br.height)],
      outside:br.left< -2||br.top< -2||br.right>innerWidth+2||br.bottom>innerHeight+2,
      clip,overflows,tiny,buttons,intersect,iconIssues,scroll:root.scrollHeight-root.clientHeight,
      dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)};
  });
  // Collapse duplicate text fragments from wrapping, preserve raw geometry for review.
  report.push({family,name,selector:surface,...info});
  if(shot){
    const path=root+'/'+name+'.png';await page.screenshot({path,scale:'css'});pics.push({name,path});
  }
  console.log('UX249_ROW '+JSON.stringify({family,name,surface,outside:info.outside,clip:info.clip,overflows:info.overflows,intersect:info.intersect,iconIssues:info.iconIssues,
    tiny:info.tiny.filter((r,i,a)=>i===a.findIndex(x=>JSON.stringify(x)===JSON.stringify(r))).slice(0,12),
    small:info.buttons.filter(b=>b.below44),blocked:info.buttons.filter(b=>!b.hit&&!b.inScroller)}));
}
async function action(page:Page,selector:string,expected?:string){
  const node=page.locator(selector).first();
  if(!await node.isVisible()||!await node.isEnabled()){report.push({family,unavailable:selector,expected});return false;}
  try{
    await node.tap({timeout:3000});if(expected)await page.locator(expected).waitFor({state:'visible',timeout:4000});
    return true;
  }catch(e){report.push({family,interactionError:selector,expected,message:String(e).slice(0,450)});return false;}
}
async function close(page:Page){
  const d=page.locator('dialog[open]').last();
  if(!await d.count())return;
  const button=d.locator('.close,button[data-close]').first();
  if(await button.isVisible())await button.tap({timeout:3000});
  else await page.keyboard.press('Escape');
  await settle(page);
}
async function openAudit(page:Page,button:string,dialog:string,name:string){
  if(await action(page,button,dialog)){await audit(page,name,dialog);await close(page);}
}
async function touch(page:Page,d:Deal,a:BoardCommand){
  const s=await read(page),board=s.attempt.board,rect=(await page.locator('#game-root').boundingBox())!;
  const f=boardFrame(rect.width,rect.height,s.settings.deckPosition,d),g=layout(board,d,f,s.settings.deckSide,s.settings.deckPosition);
  const tap=(x:number,y:number)=>page.touchscreen.tap(rect.x+f.offsetX+x*f.unit,rect.y+y*f.unit);
  if(a.type!=='transfer')await tap(g.stock.x,g.stock.y);
  else if(a.scissors==='unbind'||a.scissors==='discard')await page.getByRole('button',{name:a.scissors==='unbind'?'Снять связь':'Убрать ножницы',exact:false}).first().tap();
  else{
    const cards=sourceCards(board,a.from,d,a.root),id=a.scissors?board.tableau[a.from.index].at(-1)!:cards[0];
    const src=g.poses.find(p=>p.id===id)!,below=g.poses.filter(p=>p.id!==id&&p.depth>src.depth&&Math.abs(p.x-src.x)<1&&p.y>=src.y&&p.y-src.y<cardMetrics(d).height).sort((a,b)=>a.y-b.y)[0];
    const y=below?(src.y+below.y)/2-cardMetrics(d).height/2:src.y;
    const dest=g.targets.find(t=>t.location.kind===a.to.kind&&t.location.index===a.to.index)!;
    await tap(src.x,y);await tap(dest.x,dest.y);
  }
  const expected=applyBoard(board,a,d);assertTransition(expected);
  await expect.poll(async()=>(await read(page)).attempt.board,{timeout:5000}).toEqual(expected.board);
  function assertTransition(x:ReturnType<typeof applyBoard>):asserts x is Exclude<ReturnType<typeof applyBoard>,string>{if(typeof x==='string')throw Error(x);}
}
async function renderedType(page:Page){
 // DevTools inspects the actual ordinary renderer. No runtime QA export or different build.
 const cdp=await page.context().newCDPSession(page);
 try {
  const proto=await cdp.send('Runtime.evaluate',{expression:'Object.prototype'});
  const objects=await cdp.send('Runtime.queryObjects',{prototypeObjectId:proto.result.objectId!});
  const out=await cdp.send('Runtime.callFunctionOn',{objectId:objects.objects.objectId,returnByValue:true,functionDeclaration:`function(){
   for(const x of this){if(!x||!Object.prototype.hasOwnProperty.call(x,'views')||!(x.views instanceof Map)||!x.options?.deal||!x.world)continue;
    const rows=[];for(const[id,v]of x.views)for(const kind of ['caption','badge','sourceBadge','ice','binding','puzzleLabel']){
     const t=v[kind];if(!t?.text)continue;const m=t.getWorldTransformMatrix();const b=t.getBounds();
     rows.push({id,kind,text:t.text,font:parseFloat(t.style.fontSize)*Math.hypot(m.a,m.b)*x.scale.zoom,visible:v.node.visible&&v.face.visible&&t.visible&&(kind!=='caption'||v.content.visible),bounds:{x:b.x,y:b.y,w:b.width,h:b.height}});
    }return rows;
   }return [];
  }`});
  return out.result.value as {id:string;kind:string;text:string;font:number;visible:boolean;bounds:unknown}[];
 }finally{await cdp.detach();}
}
async function boardAudit(page:Page,name:string,d:Deal){
  await audit(page,name,'#play-screen');
  const current=await read(page),r=(await page.locator('#game-root').boundingBox())!,f=boardFrame(r.width,r.height,current.settings.deckPosition,d),g=layout(current.attempt.board,d,f,current.settings.deckSide,current.settings.deckPosition);
  const labels=Object.values(d.cards).filter(c=>c.leader).map(c=>({id:c.id,label:categoryCaption(c.text),text:c.text}));
  const duplicates=labels.filter((c,i,a)=>i!==a.findIndex(x=>x.label===c.label));
  const glyphs=await renderedType(page);
  report.push({family,name,glyphs,board:{cardsPx:138*f.unit,cardH:166*f.unit,mainWordNominalPx:31*f.unit,categoryNominalPx:30*f.unit,badgeNominalPx:18*f.unit,
    columns:current.attempt.board.tableau.length,deepest:Math.max(...current.attempt.board.tableau.map(p=>p.length)),
    poses:g.poses.length,visibleCards:g.poses.filter(p=>p.faceUp).length,duplicates,canvas:r}});
  console.log('UX249_BOARD '+JSON.stringify(report.at(-1)));
}
test.skip(process.env.ASOC_UI250_BASE!=='1','Exact historical worktree recording only');
test.use({video:'on'});
test('UI250 exact-base current UI surfaces and feel',async({page},info:TestInfo)=>{
  test.setTimeout(420000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const d=at(mode==='hybrid21-v1'?94:100);
  for(const [w,h,banner] of [[320,480,90],[360,640,0],[393,851,60],[768,1024,90],[640,360,0]]){
    await page.setViewportSize({width:w,height:h});
    const tag=w+'x'+h;
    await load(page,sample(d),banner);
    await audit(page,tag+'-home','#app');
    for(const [button,dialog,label] of [['#wallet-open','#coins-dialog','wallet'],['#campaign-lives-open','#campaign-lives','lives'],['#daily-bonus-open','#daily-bonus-dialog','bonus'],
      ['#daily-tasks-open','#daily-tasks-dialog','tasks'],['#calendar-open','#calendar','calendar'],['#win-cycle-open','#cycle-info','streak'],['#appearance-open','#appearance','appearance']]){
      await openAudit(page,button,dialog,tag+'-'+label);
    }
    if(await action(page,'#menu','#settings')){
      await audit(page,tag+'-settings','#settings');
      if(await action(page,'#helpers-open','#helpers')){
        await audit(page,tag+'-helpers','#helpers');
        await page.locator('#helpers .sheet-body').evaluate(e=>e.scrollTop=e.scrollHeight);
        await audit(page,tag+'-helpers-bottom','#helpers');
        if(await action(page,'#helper-return','#settings')){
          report.push({family,name:tag+'-return-helpers',focus:await page.locator('#helpers-open').evaluate(e=>document.activeElement===e)});
        }
      }
      if(await page.locator('#settings').isVisible()){
        if(await action(page,'#privacy-open','#privacy-dialog')){
          await audit(page,tag+'-privacy','#privacy-dialog');
          await close(page);
        }
        if(await page.locator('#settings').isVisible())await close(page);
      }
    }
    if(await page.locator('dialog[open]').count()){await load(page,sample(d),banner);}
    // Lives are zero only for home/life surface; use a valid playing profile for the board.
    const playing=sample(d);playing.campaignLives!.remaining=5;delete playing.campaignLives!.refillAt;
    await load(page,playing,banner);
    if(await action(page,'#home-play','#play-screen')){
      // In non-reduced mode capture deal settle, with bounded wait.
      try{await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0',{timeout:10000});}catch(e){report.push({family,name:tag+'-deal',error:String(e).slice(0,400)});}
      if(await page.locator('#learn-rule').isVisible())await close(page);
      await boardAudit(page,tag+'-board',d);
      if(await action(page,'#hint')){
        await page.waitForTimeout(3400);await boardAudit(page,tag+'-hint',d);
      }
      if(await page.locator('dialog[open]').count())await close(page);
      if(await action(page,'#menu','#settings')){
        await audit(page,tag+'-pause','#settings');
        await close(page);
      }
    }
    // Exhausted snapshot on genuine deal; includes recovery menu controls.
    const exhausted=sample(d,true);exhausted.campaignLives!.remaining=5;delete exhausted.campaignLives!.refillAt;exhausted.attempt.board.phase='exhausted';exhausted.attempt.board.movesLeft=0;
    await load(page,exhausted,banner);
    if(await action(page,'#home-play','#result')){
      await page.waitForTimeout(1600);await audit(page,tag+'-loss','#result');
    }
    // A valid first-clear state immediately before last action; execute actual touch, not synthetic win dialog.
    const winDeal=at(81),before=play(sample(winDeal),winDeal,winDeal.winningPath.slice(0,-1));
    before.campaignLives!.remaining=5;delete before.campaignLives!.refillAt;
    await load(page,before,banner);
    if(await action(page,'#home-play','#play-screen')){
      try{
        await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0',{timeout:12000});
        await touch(page,winDeal,winDeal.winningPath.at(-1)!);
        await page.locator('#result').waitFor({state:'visible',timeout:8000});await audit(page,tag+'-win','#result');
        if(await action(page,'#next-level','#play-screen')){
          await expect(page.locator('#game-root')).toHaveAttribute('data-dealing','0',{timeout:12000});
          await audit(page,tag+'-next','#play-screen');
        }
      }catch(e){report.push({family,name:tag+'-win-flow',error:String(e).slice(0,600)});}
    }
    writeFileSync(root+'/report.json',JSON.stringify({family,errors,report},null,2));
  }
  // Stress actual rendered text, no claim about native OS font settings.
  await page.setViewportSize({width:320,height:568});await load(page,sample(d,true),60);
  if(await action(page,'#campaign-lives-open','#campaign-lives')){
    await page.locator('#campaign-lives').evaluate(root=>{
      const nodes=[...root.querySelectorAll<HTMLElement>('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()));
      const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.fontSize=sizes[i]*1.5+'px');
    });
    await audit(page,'320x568-lives-text150','#campaign-lives');
  }
  writeFileSync(root+'/report.json',JSON.stringify({family,errors,report},null,2));
  console.log('UX249_SUMMARY '+JSON.stringify({family,rows:report.length,errors,interactionErrors:report.filter(x=>x.interactionError||x.error),focus:report.filter(x=>x.focus!==undefined),captures:pics.length}));
  await info.attach('audit-report',{path:root+'/report.json',contentType:'application/json'});
});

