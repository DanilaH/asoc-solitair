import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, renameSync, rmSync, symlinkSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const baseline = '5039f1fbafcfebc399e36141826cc9ca6a59fe5d';
const temp = mkdtempSync(join(tmpdir(), 'asoc-ui205-'));
const worktree = join(temp, 'baseline'), candidateDist = join(temp, 'candidate-dist');
const dist = resolve(root, 'dist'), output = resolve(root, 'test-results/ui-205-before');
const env = {...process.env,VITE_ASOC_PROFILE:'c8-release-v1',ASOC_AD_MODE:'disabled',ASOC_UI_205_BASELINE:'1',ASOC_MVP_DEMO:'1'};
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,env,stdio:'inherit'});
if(!existsSync(dist))throw Error('Build candidate before baseline comparison');
let worktreeAdded=false,distMoved=false;
try {
  run('git',['fetch','--no-tags','--depth=1','origin',baseline]);
  run('git',['worktree','add','--detach',worktree,baseline]);worktreeAdded=true;
  symlinkSync(resolve(root,'node_modules'),join(worktree,'node_modules'),'dir');
  run('npm',['run','build'],worktree);
  const manifest=JSON.parse(readFileSync(join(worktree,'dist/release-manifest.json'),'utf8'));
  if(manifest.commit!==baseline||manifest.id!=='c8-release-v1')throw Error('Baseline manifest mismatch');
  renameSync(dist,candidateDist);distMoved=true;
  cpSync(join(worktree,'dist'),dist,{recursive:true});
  run('npx',['playwright','test','tests/browser/integrated-release.spec.ts','--grep','205 capture L(16 320x480|30 360x640)','--project','compact','--output',output]);
  mkdirSync(output,{recursive:true});cpSync(join(dist,'release-manifest.json'),join(output,'baseline-manifest.json'));
}finally{
  if(distMoved){rmSync(dist,{recursive:true,force:true});renameSync(candidateDist,dist);}
  if(worktreeAdded){rmSync(join(worktree,'node_modules'),{force:true});run('git',['worktree','remove','--force',worktree]);}
  rmSync(temp,{recursive:true,force:true});
}
