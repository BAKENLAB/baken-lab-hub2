// Native Node reproducibility entry, NOT executed in Work35 isolate.
// Usage: node stage35-native-replay-v0.1.mjs <work35-root> <v34-root> <v35-root> [case-id]
// Require clean detached worktrees at the exact saved commits; no network or production access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [workArg,v34Arg,v35Arg,caseId]=process.argv.slice(2);
assert.ok(workArg&&v34Arg&&v35Arg,'Three checked-out research roots required');
const work=resolve(workArg),a=resolve(v34Arg),b=resolve(v35Arg),root='research/reborn2-official-sources/';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,maxBuffer:32*1024*1024});
for(const [dir,expected] of [[a,'4fe9d2adcca979d91000e5f671e1725beb382445'],[b,'1c765f3918905445fd90e7bfb9e6f985bde26627']]){
 assert.equal(git(dir,'rev-parse','HEAD').toString().trim(),expected);
 assert.equal(git(dir,'status','--porcelain').toString(),'','Dirty Codex worktree');
}
const load=p=>JSON.parse(readFileSync(join(work,root,p),'utf8'));
const manifest=load('stage35-final-handoff-v0.2.json');
for(const p of [...manifest.upstream_pins,...manifest.files]){
 const bytes=git(work,'show',p.ref+':'+p.path);
 assert.equal(sha(bytes),p.sha256,p.path);assert.equal(blob(bytes),p.blob,p.path);
}
const fixed=load('stage35-fixed-replay-summary-v0.1.json');
const rawPin=fixed.pins[17],rawBytes=git(work,'show',rawPin.ref+':'+rawPin.path);
assert.equal(sha(rawBytes),rawPin.sha256);
const raw=JSON.parse(rawBytes),old=JSON.parse(git(work,'show',fixed.independent_handoff.ref+':'+root+'stage34-final-handoff-v0.2.json'));
const producerPin=fixed.pins[1],adapterPin=fixed.pins[3];
const producerText=git(work,'show',producerPin.ref+':'+producerPin.path).toString('utf8');
const adapterText=git(work,'show',adapterPin.ref+':'+adapterPin.path).toString('utf8');
const asModule=x=>import('data:text/javascript;base64,'+Buffer.from(x).toString('base64'));
const producer=await asModule(producerText),adapter=await asModule(adapterText+'\nexport {verify32,adapt32};\n');
const v34=await import(pathToFileURL(join(a,'research/reborn2-chatgpt-circuit/work33-v34-synthesis.mjs')));
const v35=await import(pathToFileURL(join(b,'research/reborn2-chatgpt-circuit/work33-v34-synthesis.mjs')));
const harness=manifest.files.find(x=>x.path.endsWith('stage35-current-evidence-v0.2.mjs'));
const {run35}=await asModule(git(work,'show',harness.ref+':'+harness.path).toString('utf8'));
const expected=[...fixed.summary,...load('stage35-missing-context-receipt-v0.2.json').summary,...load('stage35-eye-admission-receipt-v0.2.json').summary,...load('stage35-eye-counter-receipt-v0.2.json').summary];
const chosen=caseId?expected.filter(x=>x.id===caseId):expected;
assert.ok(chosen.length,'Unknown case');
for(const e of chosen){
 const variantsOnly=e.id.startsWith('FK35_');
 const run=run35({raw,independent:{cases:variantsOnly?[]:old.cases,rawBlob:rawPin.blob},canonical:raw.canonical,sha,producer,adapter,v34,v35,variantsOnly,caseIds:[e.id]});
 const r=run.results[0];assert.equal(r.source_digest,e.source_digest);assert.equal(r.bundle_sha256,e.bundle_sha256);
 assert.deepEqual(r.v34.grades,e.v34);assert.deepEqual(r.v35.grades,e.v35);assert.deepEqual(r.eyeOff.grades,e.eyeOff);
 assert.deepEqual(r.v35.scenarios.map(s=>({id:s.id,complete:s.complete,comparable:s.comparable,roleConflicts:s.roleConflicts.length,envelopes:s.envelopes.map(q=>[q.min,q.max])})),e.scenarios);
 assert.ok(run.checks.every(x=>x.pass));console.log(e.id+' NATIVE_REPLAY_PASS '+run.checks.length);
}
console.log('Native research-only replay complete. No formal grade or CI claim.');
