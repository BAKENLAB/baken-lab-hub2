import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
if(process.argv[2]==='worker'){
 const [analysis,result]=process.argv.slice(3);
 const observed=JSON.parse(readFileSync(analysis,'utf8'));
 let blocked=false;
 try{readFileSync(result,'utf8');}catch(e){assert.equal(e.code,'ERR_ACCESS_DENIED');blocked=true;}
 assert.ok(blocked,'sealed result readable');
 console.log(JSON.stringify({analysis:observed,denied:blocked}));
}else{
 const dir=mkdtempSync(join(tmpdir(),'main48-'));
 try{
  const allowed=join(dir,'analysis'),sealed=join(dir,'sealed');mkdirSync(allowed);mkdirSync(sealed);
  const a=join(allowed,'card.json'),r=join(sealed,'result.json');
  writeFileSync(a,JSON.stringify({scope:'SYNTHETIC',target:'T',horse:['A','B']}));
  const outputs=[];
  for(const finish of [['A','B'],['B','A']]){
   writeFileSync(r,JSON.stringify({target:'T',finish}));
   assert.deepEqual(JSON.parse(readFileSync(r,'utf8')).finish,finish);
   const self=fileURLToPath(import.meta.url);
   const p=spawnSync(process.execPath,['--permission','--allow-fs-read='+self,'--allow-fs-read='+allowed,self,'worker',a,r],{encoding:'utf8',env:{}});
   assert.equal(p.status,0,p.stderr);outputs.push(JSON.parse(p.stdout));
  }
  assert.deepEqual(outputs[0],outputs[1]);
  console.log(JSON.stringify({status:'PASS',scope:'TRUSTED_CHILD_FILESYSTEM_PERMISSION_REFERENCE_ONLY',node:process.version,outputs,limitations:['not V42 engine execution','not a security sandbox for malicious code','network isolation not tested']}));
 }finally{rmSync(dir,{recursive:true,force:true});}
}
