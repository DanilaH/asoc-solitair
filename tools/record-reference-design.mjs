import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
const pageName=process.argv[2]??'reference-prototype.html';
if(!['reference-prototype.html','identity-prototype.html'].includes(pageName))throw Error('Unknown design page');
const root=resolve('.'), output=resolve(pageName==='identity-prototype.html'?'.recording/identity-evidence':'.recording/design-evidence'), fonts=resolve('.recording/design-fonts');
await mkdir(output,{recursive:true});await mkdir(fonts,{recursive:true});
// Preview-only fonts. Shipping the font in the actual offline app is a separate asset step.
const css=execFileSync('curl',['-fLsS','--max-time','20','https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap'],{encoding:'utf8'});
const fontMap=new Map();
for(const match of css.matchAll(/font-weight:\s*(\d+);[\s\S]*?url\(([^)]+)\)/g)){const [,weight,url]=match,path=resolve(fonts,weight+'.ttf');execFileSync('curl',['-fLsS','--max-time','20',url,'-o',path]);fontMap.set(url,path);}
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+'/'))throw Error('path');const body=await readFile(path);const mime={'.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.ttf':'font/ttf'}[extname(path)]??'application/octet-stream';res.writeHead(200,{'Content-Type':mime});res.end(body)}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(r=>server.listen(4192,'127.0.0.1',r));const browser=await chromium.launch();const errors=[];
try{
const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:css,contentType:'text/css'}));
await page.route('https://fonts.gstatic.com/**',route=>{const path=fontMap.get(route.request().url());return path?route.fulfill({path,contentType:'font/ttf'}):route.abort()});
for(const view of ['home','game','pause']){await page.goto(`http://127.0.0.1:4192/docs/design/${pageName}?view=${view}&bare=1`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);await page.screenshot({path:resolve(output,view+'.png'),scale:'css'});}
await page.locator('.resume').tap();await page.locator('#hint-demo').tap();await page.waitForTimeout(200);if(await page.locator('#hint-arrow').isHidden())throw Error('Hint preview did not respond');
await page.locator('.menu-icon').tap();await page.locator('[data-view=home]').last().tap();if(await page.locator('#home-view').isHidden())throw Error('Home navigation failed');
await page.locator('.levels-link').tap();if(await page.locator('.level-grid button').count()!==20)throw Error('Level picker missing');await page.locator('[data-level="17"]').tap();if(await page.locator('#game-view').isHidden())throw Error('Level selection failed');
if(pageName==='identity-prototype.html'){
await page.locator('.menu-icon').tap();if(!await page.locator('#hint-arrow').isHidden())throw Error('Hint stayed visible under identity menu');await page.locator('#pause-view [data-open=looks]').tap();await page.locator('[data-look=ink]').tap();await page.locator('#sub-view .play[data-sub-close]').tap();await page.locator('.resume').tap();if(!await page.locator('#game-view').evaluate(e=>e.classList.contains('ink')))throw Error('Identity palette did not change');await page.screenshot({path:resolve(output,'ink.png'),scale:'css'});
}
await page.setViewportSize({width:320,height:568});await page.goto(`http://127.0.0.1:4192/docs/design/${pageName}?view=game&bare=1`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
const bounds=await page.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};return {piles:b('.tableau'),cards:[...document.querySelectorAll('.tableau .playing-card')].map(e=>e.getBoundingClientRect().bottom),dock:b('.helper-dock'),ad:b('.ad-reserve'),body:document.documentElement.scrollWidth,width:innerWidth}});
if(bounds.body>bounds.width||Math.max(...bounds.cards)>bounds.dock.top||bounds.dock.bottom>bounds.ad.top)throw Error('Compact overlap '+JSON.stringify(bounds));
const wraps=await page.locator('.word').evaluateAll(es=>es.filter(e=>!e.innerHTML.includes('<br>')).filter(e=>e.getBoundingClientRect().height>parseFloat(getComputedStyle(e).lineHeight)*1.15).map(e=>e.textContent));if(wraps.length)throw Error('Unexpected word wrapping: '+wraps.join(', '));const overflow=await page.locator('.word').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect(),p=e.closest('.playing-card').getBoundingClientRect();return r.left<p.left+2||r.right>p.right-2}).map(e=>e.textContent));if(overflow.length)throw Error('Word overflow: '+overflow.join(', '));
await page.screenshot({path:resolve(output,'compact.png'),scale:'css'});
await page.locator('.menu-icon').tap();const panel=await page.locator('.pause-card').evaluate(e=>({height:e.clientHeight,content:e.scrollHeight}));if(panel.content>panel.height+1)throw Error('Pause needs scrolling');await page.screenshot({path:resolve(output,'pause-compact.png'),scale:'css'});
let homeBounds;
if(pageName==='identity-prototype.html'){
await page.goto(`http://127.0.0.1:4192/docs/design/${pageName}?view=home&bare=1`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
homeBounds=await page.evaluate(()=>{const logo=document.querySelector('.brand-main'),hero=document.querySelector('.linked-emblem').getBoundingClientRect(),cta=document.querySelector('.home-cta').getBoundingClientRect();return{logoWidth:logo.clientWidth,logoContent:logo.scrollWidth,heroCentre:(hero.left+hero.right)/2,phoneCentre:innerWidth/2,logoBottom:logo.getBoundingClientRect().bottom,ctaTop:cta.top}});
if(homeBounds.logoContent>homeBounds.logoWidth+1||Math.abs(homeBounds.heroCentre-homeBounds.phoneCentre)>2||homeBounds.logoBottom>homeBounds.ctaTop)throw Error('Compact identity home '+JSON.stringify(homeBounds));
await page.screenshot({path:resolve(output,'home-compact.png'),scale:'css'});
}
if(errors.length)throw Error(errors.join('\n'));
await writeFile(resolve(output,'checks.json'),JSON.stringify({passed:true,compact:bounds,pause:panel,home:homeBounds,errors},null,2));
execFileSync('convert',[resolve(output,'home.png'),resolve(output,'game.png'),resolve(output,'pause.png'),'+append',resolve(output,'reference-layout.png')]);
console.info('PASS: three screens, menu/level/hint preview and compact card/dock/banner bounds.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
