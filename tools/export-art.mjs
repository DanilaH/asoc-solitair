// Reproducible slicing/export only. Artwork is authored with image generation;
// this tool does not draw, repaint or remove backgrounds.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const input = process.argv[2], cols = Number(process.argv[3]), rows = Number(process.argv[4]), names = process.argv[5]?.split(',');
if (!input || !names || names.length > cols * rows) throw Error('Usage: node tools/export-art.mjs INPUT COLS ROWS NAMES');
await mkdir('public/art/generated', { recursive: true });
await mkdir('docs/art/masters', { recursive: true });
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const records = [];
for (const [i, name] of names.entries()) {
 if (name === '-') continue;
 const x0 = Math.round(i % cols * info.width / cols), y0 = Math.round(Math.floor(i / cols) * info.height / rows);
 const x1 = Math.round((i % cols + 1) * info.width / cols), y1 = Math.round((Math.floor(i / cols) + 1) * info.height / rows);
 let left=x1, top=y1, right=x0, bottom=y0, opaque=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);opaque++;}
 // Optional crop bounds ignore tiny disconnected atlas debris. No pixel is
 // repainted/masked: the source rectangle is exported with its original alpha.
 if (process.argv[6] === '--clean-bounds') {
  const w=x1-x0,h=y1-y0,seen=new Uint8Array(w*h),components=[];
  for(let start=0;start<w*h;start++){
   const solid=i=>data[((y0+Math.floor(i/w))*info.width+x0+i%w)*4+3]>100;
   if(seen[start]||!solid(start))continue;
   const todo=[start];seen[start]=1;let count=0,l=w,r=0,t=h,b=0;
   while(todo.length){const i=todo.pop(),x=i%w,y=Math.floor(i/w);count++;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&solid(j)){seen[j]=1;todo.push(j);}
   }
   components.push({count,l,r,t,b});
  }
  const largest=Math.max(...components.map(c=>c.count)),kept=components.filter(c=>c.count>=Math.max(40,largest*.025));
  left=x0+Math.min(...kept.map(c=>c.l));right=x0+Math.max(...kept.map(c=>c.r));top=y0+Math.min(...kept.map(c=>c.t));bottom=y0+Math.max(...kept.map(c=>c.b));
 }
 if (opaque < 100) throw Error('Empty cell: '+name);
 const card = name.startsWith('card-');
 const padding = card ? 1 : 3;
 left=Math.max(x0,left-padding);top=Math.max(y0,top-padding);right=Math.min(x1-1,right+padding);bottom=Math.min(y1-1,bottom+padding);
 const rect={left,top,width:right-left+1,height:bottom-top+1};
 const path='public/art/generated/'+name+'.webp';
 await sharp(input).extract(rect).resize(card?384:192,card?512:192,{fit:'contain',background:'#00000000'}).webp({quality:92,alphaQuality:100}).toFile(path);
 records.push({name,source:basename(input),rect,path});
}
const hash=createHash('sha256').update(await readFile(input)).digest('hex');
const master='docs/art/masters/'+names[0]+'.webp';
await sharp(input).webp({quality:96,alphaQuality:100}).toFile(master);
await writeFile(master+'.json',JSON.stringify({sourceSha256:hash,columns:cols,rows,records},null,2)+'\n');
console.info('Exported '+records.length+' assets from '+basename(input));
