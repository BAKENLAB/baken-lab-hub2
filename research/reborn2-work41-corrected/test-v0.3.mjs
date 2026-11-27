import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {makeEnvelope,validateEnvelope,validateLeader,eyeSupply,sha} from './supply-v0.3.mjs';
import {analyzeSupply} from './common-adapter-v0.3.mjs';
import {makeValidRace} from './rejected-work41-v0.2.mjs';
import {result as oldResult,laps as oldLaps} from '../reborn2-work40-evidence-completion/synthetic-controls-v0.1.mjs';
const copy=structuredClone,root=resolve(fileURLToPath(new URL('../..',import.meta.url))),dir=mkdtempSync(join(tmpdir(),'work41-sealed-')),pass=[];
const t=(n,f)=>{f();pass.push(n);console.log('WORK41_FIX '+n+' PASS');};
const reject=(n,f,p)=>t(n,()=>assert.throws(f,p));
const raw=readFileSync(new URL('../reborn2-chatgpt-circuit/work34-pinned/stage34-raw-fixtures-v0.2.json',import.meta.url));
const oldSource=readFileSync(new URL('./rejected-work41-v0.2.mjs',import.meta.url));
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const docs=JSON.parse(raw).fixtures.find(f=>f.id==='FK34_FULL').docs;
const env=makeEnvelope(docs);
const altered=(fn)=>{const x=copy(env);fn(x);return x;};
const mutateRaw=(x,i,fn)=>{const d=JSON.parse(x.documents[i].raw);fn(d);x.documents[i].raw=JSON.stringify(d);x.documents[i].sha256=sha(x.documents[i].raw);};
t('EXACT_REJECTED_SOURCE_PIN',()=>assert.equal(blob(oldSource),'56033c2f8319e57759027d4b38218361644c3223'));
const malformed=makeValidRace();
reject('ORIGINAL_1400MS_CONTRADICTION',()=>validateLeader(malformed.result.observations.rows,[200,800,1200],1400,malformed.laps.observations.values_ms,malformed.laps.observations.boundaries_m,'clock_ms','checkpoint_ms'),/LEADER_CROSSING_1200/);
const w40=oldResult('BASE'),w40lap=oldLaps('BASE');
reject('ORIGINAL_WORK40_MALFORMED_SOURCE',()=>validateLeader(w40.observations.rows,[200,800,1200],1400,w40lap.observations.values_ms,w40lap.observations.boundaries_m,'clock_ms','checkpoint_ms'),/LEADER_CROSSING/);
t('ALL_BOUNDARIES_CORRECTED',()=>assert.equal(validateEnvelope(env).docs.length,6));
for(const [i,m] of [200,800,1200,1400].entries())reject('LEADER_'+m,()=>validateEnvelope(altered(x=>mutateRaw(x,1,d=>d.leaderLaps.valuesMs[i]+=1))),new RegExp('LEADER_CROSSING_'+m));
reject('RAW_MUTATION_WITHOUT_HASH',()=>validateEnvelope(altered(x=>x.documents[1].raw+=' ')),/RAW_HASH/);
reject('RAW_OBSERVATION_MISMATCH',()=>validateEnvelope(altered(x=>x.documents[1].observations={clockMs:1})),/SOURCE_FIELDS/);
reject('RAW_IDENTITY_ALIAS',()=>validateEnvelope(altered(x=>x.documents[1].eventId='TEST:ALIEN')),/RAW_IDENTITY_BINDING/);
reject('RAW_ROW_ALIAS',()=>validateEnvelope(altered(x=>mutateRaw(x,1,d=>d.rows[0].horse_id='TEST:ALIEN'))),/ROW_FIELDS/);
reject('RAW_ROW_DUPLICATE',()=>validateEnvelope(altered(x=>mutateRaw(x,1,d=>d.rows[1].nativeId=d.rows[0].nativeId))),/ROSTER/);
reject('RAW_NONCANONICAL_DUPLICATE_KEY',()=>validateEnvelope(altered(x=>{const s=x.documents[1];s.raw=s.raw.replace('"version":1','"version":1,"version":1');s.sha256=sha(s.raw)})),/RAW_CANONICAL_BYTES/);
reject('INVALID_CALENDAR',()=>validateEnvelope(altered(x=>x.cutoff='2026-02-30T00:00:00.000Z')),/INVALID_TIME/);
reject('INVALID_CUTOFF',()=>validateEnvelope(altered(x=>x.cutoff='invalid')),/INVALID_TIME/);
reject('LATE_CAPTURE',()=>validateEnvelope(altered(x=>x.documents[1].capturedAt='1970-01-01T00:01:31.000Z')),/SOURCE_TIME_BOUND/);
reject('UNCERTAINTY_CROSSES_CUTOFF',()=>validateEnvelope(altered(x=>x.documents[1].uncertaintyMs=15000)),/SOURCE_TIME_BOUND/);
reject('FALSE_PUBLICATION',()=>validateEnvelope(altered(x=>x.documents[1].publishedAt='1970-01-01T00:00:01.000Z')),/RAW_TIME_BINDING/);
reject('DUPLICATE_EVENT',()=>validateEnvelope(altered(x=>x.documents.push(copy(x.documents[1])))),/EVENT_DUPLICATE/);
reject('TARGET_OUTCOME_FIELD',()=>validateEnvelope(altered(x=>mutateRaw(x,0,d=>d.rows[0].finish=1))),/ROW_FIELDS/);
reject('TARGET_RESULT_EVENT',()=>validateEnvelope(altered(x=>{mutateRaw(x,1,d=>d.eventId=docs[0].eventId);x.documents[1].eventId=docs[0].eventId;})),/EVENT_DUPLICATE|TARGET_RESULT_LEAK/);
reject('MARKET_ALIAS',()=>validateEnvelope(altered(x=>mutateRaw(x,0,d=>d.rows[0].marketPrice=1))),/ROW_FIELDS/);
const v=validateEnvelope(env),s=eyeSupply(v);
t('ALL_CATEGORY_SPECIFIC_KINDS',()=>{assert.equal(s.length,5);assert.ok(s.every(h=>h.categories.length===15));const kinds=new Set(s.flatMap(h=>h.categories.flatMap(c=>c.observations.map(o=>o.kind))));assert.equal(kinds.size,15);assert.ok(s.some(h=>h.categories.some(c=>c.observations.some(o=>o.direction==='SUPPORTING_OBSERVATION'))));assert.ok(s.some(h=>h.categories.some(c=>c.observations.some(o=>o.direction==='COUNTER_OR_LIMIT'))));assert.ok(s.every(h=>h.categories.some(c=>c.missing.length)));});
t('SOURCE_ROOT_BINDING',()=>{const ids=new Set(v.roots.map(q=>q.id));assert.equal(ids.size,v.roots.length);for(const q of v.roots){const d=v.docs.find(d=>d.eventId===q.eventId);assert.ok(d);if(q.horseId){const r=d.rows[Number(q.pointer.split('/').at(-1))];assert.equal(r.nativeId,q.horseId);assert.equal(r.no,q.no);}assert.ok(q.depends.every(x=>ids.has(x)));}});
function renameSubset(n,issuer='TEST:JRA'){
 const ds=copy(docs);for(const [i,d] of ds.entries()){d.issuer=issuer;d.eventId='TEST:GEN_'+n+'_'+i;d.rows=d.rows.slice(0,n).map((r,j)=>({...r,nativeId:'TEST:OTHER_'+j,no:j+1,gate:j+1}));if(i){d.actualStarters=d.registeredCount=n;for(const r of d.rows){r.finish=1+d.rows.filter(q=>q.clockMs<r.clockMs).length;r.officialMargin=r.finish===1?null:'TEST_LITERAL';r.checkpointRanks=r.checkpointMs.map((v,j)=>1+d.rows.filter(q=>q.checkpointMs[j]<v).length);}const cum=[0,...d.geometry.checkpoints_m.map((_,j)=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...d.rows.map(r=>r.clockMs))];d.leaderLaps.valuesMs=cum.slice(1).map((v,j)=>v-cum[j]);d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);}}
 return ds;
}
const generic=renameSubset(3),genericEnv=makeEnvelope(generic),gv=validateEnvelope(genericEnv);
const changed=copy(generic);changed[0].rows[2].nativeId='TEST:NO_HISTORY';const cv=validateEnvelope(makeEnvelope(changed));const cs=eyeSupply(cv);
t('CHANGED_ROSTER_NO_FALSE_IDENTITY',()=>{const h=cs.find(h=>h.horse==='TEST:NO_HISTORY');assert.ok(h.categories.every(c=>c.missing.includes('NO_HORSE_HISTORY')));assert.ok(h.categories[0].observations.length===0);assert.ok(cs.some(h=>h.categories[10].observations.some(o=>o.direction==='SUPPORTING_ANTECEDENT')));});
const other=copy(docs);other[1].conditions.going='TEST:SOFT';const es=eyeSupply(validateEnvelope(makeEnvelope(other)));
t('OTHER_CONDITION_NOT_SAME_SUPPORT',()=>assert.ok(es.every(h=>h.categories[6].observations.some(o=>o.direction==='OTHER_CONDITION'))));
function worker(envelope,eyeEnabled){
 const exe=new URL('./analysis-worker.mjs',import.meta.url);
 const p=spawnSync(process.execPath,['--experimental-permission','--allow-fs-read='+root,fileURLToPath(exe)],{cwd:root,input:JSON.stringify({envelope,eyeEnabled}),encoding:'utf8',maxBuffer:96*1024*1024,env:{PATH:process.env.PATH??''}});
 assert.equal(p.status,0,JSON.stringify({error:p.error?.message,signal:p.signal,stderr:p.stderr?.slice(-2000),stdoutLength:p.stdout?.length}));return JSON.parse(p.stdout);
}
try{
 const resultFile=join(dir,'target-results.json');
 writeFileSync(resultFile,JSON.stringify({event:docs[0].eventId,finish:[1,2,3,4,5]}));
 const before=sha(readFileSync(resultFile)),a=worker(env,true);
 writeFileSync(resultFile,JSON.stringify({event:docs[0].eventId,finish:[5,4,3,2,1]}));
 const after=sha(readFileSync(resultFile)),b=worker(env,true);
 t('SAME_FLAG_FULL_OUTPUT_RESULT_MUTATION',()=>{assert.notEqual(before,after);assert.deepEqual(a,b);assert.equal(a.evidence.length,537);assert.ok(a.decision.runners.every(h=>h.items.length===115&&h.grade===null));});
 const probe=spawnSync(process.execPath,['--experimental-permission','--allow-fs-read='+root,'-e','require("node:fs").readFileSync(process.argv[1])',resultFile],{encoding:'utf8'});
 t('PHYSICAL_RESULT_READ_DENIED',()=>{assert.notEqual(probe.status,0);assert.match(probe.stderr,/ERR_ACCESS_DENIED/);});
 const g=worker(genericEnv,true),k=worker(makeEnvelope(changed),true);
 t('GENERIC_NEW_ISSUER_EVENT_ROSTER',()=>{assert.equal(g.decision.runners.length,3);assert.equal(k.decision.runners.length,3);assert.ok(g.decision.runners.every(h=>h.horse.startsWith('TEST:JRA|TEST:OTHER_')));assert.ok(k.decision.runners.some(h=>h.horse.endsWith('TEST:NO_HISTORY')));assert.notEqual(g.commonSha256,k.commonSha256);});
 const off=worker(env,false);t('SAME_PACKET_EYE_FLAG',()=>{assert.equal(a.commonSha256,off.commonSha256);assert.deepEqual(a.categories,off.categories);assert.deepEqual(a.evidence,off.evidence);});
 const compact=x=>({analysisSha256:x.analysisSha256,commonSha256:x.commonSha256,groups:x.groups,held:x.held,roots:x.roots.length,evidence:x.evidence.length,runners:x.decision.runners.map(h=>({horse:h.horse,items:h.items.length,eye:h.eye.map(e=>e.item),paths:h.paths.length,current:h.current_grade,conditional:h.conditional_grade})),categories:x.categories.map(h=>({horse:h.horse,categories:h.categories.map(c=>({category:c.category,observations:c.observations.length,directions:[...new Set(c.observations.map(o=>o.direction))],missing:c.missing}))}))});
 const receipt={scope:'SYNTHETIC_ONLY',priorAccepted:778,addedAccepted:0,checks:pass,base:compact(a),generic:compact(g),changed:compact(k),off:compact(off),fullOutputSha256:a.fullOutputSha256,resultBefore:before,resultAfter:after,formal:false};
 console.log('WORK41_FIX_SUMMARY '+JSON.stringify(receipt));
 if(process.env.WORK41_FIX_RECEIPT)writeFileSync(process.env.WORK41_FIX_RECEIPT,JSON.stringify({receipt,base:a,generic:g,changed:k,off},null,2));
}finally{rmSync(dir,{recursive:true,force:true});}
