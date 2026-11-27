// Research only: no database, deployment, odds, official acquisition or grading engine.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]??'.');
const work='60e8e255abffe45a725654eae75140014ef67c62', parent='e193a22a0d6f36020dffbc96fd4b518f64d802b8';
const refs={v34:'4fe9d2adcca979d91000e5f671e1725beb382445',v35:'1c765f3918905445fd90e7bfb9e6f985bde26627',v37:'00c34ce1b0214021394d8d13c613ba82a543d601'};
const dir='research/reborn2-official-sources/', base='research/reborn2-chatgpt-circuit/';
const git=(...a)=>execFileSync('git',a,{cwd:root,maxBuffer:64*1024*1024});
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const show=(ref,path)=>git('show',ref+':'+path);
const checked=(p)=>{const b=show(p.ref,p.path);assert.equal(blob(b),p.blob,p.path);assert.equal(sha(b),p.sha256,p.path);return b;};
const json=b=>JSON.parse(b.toString('utf8'));
const mBytes=show(work,dir+'stage35-final-handoff-v0.2.json');
assert.equal(blob(mBytes),'e01b7936b78c9b348fb8478ce7d9eec5573f067d');
const m=json(mBytes);
assert.equal(m.parent,parent);assert.equal(m.canonical,115);assert.equal(m.groups,118);assert.equal(m.held,826);
assert.equal(m.upstream_pins.length,18);assert.equal(m.files.length,6);
const allPins=[...m.upstream_pins,...m.files];
const pinned=new Map(allPins.map(p=>[p.path+'@'+p.ref,checked(p)]));
const f=name=>{const p=m.files.find(x=>x.path.endsWith('/'+name));assert.ok(p);return pinned.get(p.path+'@'+p.ref);};
const oldBytes=show(parent,dir+'stage34-final-handoff-v0.2.json');
assert.equal(blob(oldBytes),'8615fcf19e2de1002200a43c5c668a16162b9403');
const old=json(oldBytes);
for(const p of [...old.files,...old.source_pins])checked(p);
const fixed=json(f('stage35-fixed-replay-summary-v0.1.json'));
assert.equal(fixed.independent_handoff.ref,parent);assert.equal(fixed.independent_handoff.blob,blob(oldBytes));assert.equal(fixed.independent_handoff.sha256,sha(oldBytes));
const receipts=['stage35-fixed-replay-summary-v0.1.json','stage35-missing-context-receipt-v0.2.json','stage35-eye-admission-compact-v0.2.json','stage35-eye-counter-receipt-v0.2.json'].map(n=>json(f(n)));
const expected=receipts.flatMap(x=>x.summary), expectedChecks=receipts.flatMap(x=>x.checks);
assert.equal(expected.length,10);assert.equal(new Set(expected.map(x=>x.id)).size,10);
assert.equal(expectedChecks.length,72);assert.equal(new Set(expectedChecks.map(x=>x.name)).size,72);assert.ok(expectedChecks.every(x=>x.pass===true));
assert.deepEqual(expected.map(x=>x.id),m.cases.map(x=>x.id));
for(const e of expected){const p=m.cases.find(x=>x.id===e.id);assert.equal(e.source_digest,p.source_digest);assert.equal(e.bundle_sha256,p.bundle_sha256);assert.equal(e.evidence,p.evidence);}
const rawPin=fixed.pins[17],raw=json(checked(rawPin));
assert.equal(raw.fixtures.length,5);
const native=mkdtempSync(join(tmpdir(),'work36-'));
const outPath=resolve(process.env.WORK36_RECEIPT??join(root,'work36-native-receipt.json'));
const report={scope:'SYNTHETIC_ONLY',work,parent,refs,manifest_sha256:sha(mBytes),parent_sha256:sha(oldBytes),verifiedPins:allPins.length+old.files.length+old.source_pins.length,checks:[],cases:[],latest:[],controls:[],formal:false};
const wt={};
try{
 for(const [key,ref] of Object.entries(refs)){
  const p=join(native,key);git('worktree','add','--detach',p,ref);wt[key]=p;
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:p}).toString().trim(),ref);
  assert.equal(execFileSync('git',['status','--porcelain'],{cwd:p}).toString(),'');
  // All tracked research files from the exact tree, including transitive imports.
  // Store hashes for the actual native tree, not just the named top-level modules.
  const paths=execFileSync('git',['ls-files','-z','research'],{cwd:p,maxBuffer:64*1024*1024}).toString().split('\0').filter(Boolean);
  const hashes=paths.map(path=>{const b=readFileSync(join(p,path));assert.equal(blob(b),git('rev-parse',ref+':'+path).toString().trim());return {path,sha256:sha(b)};});
  report[key+'_research_tree']={files:hashes.length,hashes};
 }
 const module=async(p)=>import(pathToFileURL(p).href);
 const producerPath=join(native,'producer.mjs'),adapterPath=join(native,'adapter.mjs'),harnessPath=join(native,'harness.mjs');
 writeFileSync(producerPath,checked(fixed.pins[1]));writeFileSync(adapterPath,Buffer.concat([checked(fixed.pins[3]),Buffer.from('\nexport {verify32,adapt32};\n')]));
 writeFileSync(harnessPath,f('stage35-current-evidence-v0.2.mjs'));
 const producer=await module(producerPath),adapter=await module(adapterPath),harness=await module(harnessPath);
 const v34=await module(join(wt.v34,base+'work33-v34-synthesis.mjs'));
 const v35=await module(join(wt.v35,base+'work33-v34-synthesis.mjs'));
 const latest=await module(join(wt.v37,base+'work34-v37-completion.mjs'));
 const latest34=await module(join(wt.v37,base+'work33-v34-synthesis.mjs'));
 const {loadV36}=await module(join(wt.v37,base+'work34-v36-current.mjs'));
 const normal=await loadV36();assert.equal(normal.fixed.size,5);assert.deepEqual(normal.C.canonical,raw.canonical);
 const variants=harness.fixtures35(raw);
 for(const x of receipts.slice(1).flatMap(x=>x.fixtures??[])){
  const actual=variants.find(y=>y.id===x.id);assert.ok(actual);assert.deepEqual(actual.docs,x.docs);assert.deepEqual(harness.branches35(actual),x.branches);
 }
 const fixtureMap=new Map([...raw.fixtures,...variants].map(x=>[x.id,x]));assert.equal(fixtureMap.size,10);
 const summarizeScenarios=x=>x.map(s=>({id:s.id,complete:s.complete,comparable:s.comparable,roleConflicts:s.roleConflicts.length,envelopes:s.envelopes.map(q=>[q.min,q.max])}));
 for(const e of expected){
  const variantsOnly=e.id.startsWith('FK35_');
  const run=harness.run35({raw,independent:{cases:variantsOnly?[]:old.cases,rawBlob:rawPin.blob},canonical:raw.canonical,sha,producer,adapter,v34,v35,variantsOnly,caseIds:[e.id]});
  assert.equal(run.results.length,1);assert.equal(run.results[0].id,e.id);
  const expectedNames=expectedChecks.filter(c=>c.name.startsWith(e.id+':'));
  assert.ok(expectedNames.length);assert.deepEqual(run.checks,expectedNames);assert.ok(run.checks.every(c=>c.pass===true));
  const r=run.results[0];assert.equal(r.source_digest,e.source_digest);assert.equal(r.bundle_sha256,e.bundle_sha256);assert.equal(r.evidence,e.evidence);
  assert.deepEqual(r.v34.grades,e.v34);assert.deepEqual(r.v35.grades,e.v35);assert.deepEqual(r.eyeOff.grades,e.eyeOff);
  assert.deepEqual(summarizeScenarios(r.v35.scenarios),e.scenarios);
  if(e.withdraw_id){assert.equal(r.withdraw_id,e.withdraw_id);assert.deepEqual(r.withdraw.grades,e.withdraw);}
  report.checks.push(...run.checks);report.cases.push({id:e.id,digest:r.source_digest,bundle:r.bundle_sha256,checks:run.checks.length,grades:r.v35.grades});
  for(const c of run.checks)console.log('WORK36_NATIVE '+c.name+' PASS');
  const fixture=fixtureMap.get(e.id),pin=m.cases.find(x=>x.id===e.id);
  const C={...normal.C,fixtures:[fixture],receipt:{summary:[{...pin,itemRows:575}]}};
  const V={C,fixed:new Map([[e.id,{raw:{raw:fixture.docs},pin:{...pin,blob:rawPin.blob}}]])};
  // Actual V37 analyzer, with latest common input and frozen independent packet/bundle expected digests.
  const z=latest.analyzeV37(V,e.id,{omitStart:'TEST:NAR|TEST:H5'});
  assert.equal(z.source_digest,pin.source_digest);assert.equal(z.roster.possible_active.length,5);assert.equal(z.runners.length,5);assert.ok(z.runners.every(h=>h.items.length===115&&h.grade===null));assert.equal(z.formal,false);
  report.latest.push({id:e.id,digest:z.source_digest,routes:z.routes.length,discovery:z.discovery.length,known:z.roster.known_active,possible:z.roster.possible_active,formal:z.formal,candidates:z.runners.map(h=>h.research_grade),missing:z.routes.filter(r=>r.kind==='MISSING_START_STRESS').map(r=>({horse:r.horse,envelope:r.envelope,possible_winner:r.possible_winner}))});
  console.log('WORK36_V37 '+e.id+' PASS routes='+z.routes.length);
 }
 assert.equal(report.checks.length,72);assert.deepEqual([...report.checks].sort((a,b)=>a.name.localeCompare(b.name)),[...expectedChecks].sort((a,b)=>a.name.localeCompare(b.name)));
 assert.equal(report.latest.length,10);
 report.native_pass=true;
 console.log('WORK36_NATIVE_COMPLETE 72/72 cases=10 latest=10 pins='+report.verifiedPins);
}finally{
 mkdirSync(dirname(outPath),{recursive:true});writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
 for(const p of Object.values(wt))try{git('worktree','remove','--force',p)}catch{}
 rmSync(native,{recursive:true,force:true});
}
