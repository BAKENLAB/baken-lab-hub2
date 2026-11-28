import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const [eng,engSha,work,workSha]=process.argv.slice(2);
for(const [dir,sha] of [[eng,engSha],[work,workSha]])assert.equal(execFileSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha);
const imp=(dir,path)=>import(pathToFileURL(resolve(dir,path)));
const circuit='research/reborn2-chatgpt-circuit/';
const v43=await imp(eng,'research/reborn2-independent-engine/main47-integration/v43-generic.mjs');
const {analyzeControlledWork33}=await imp(eng,circuit+'work32-v33-current.mjs');
const {analyzeV34}=await imp(eng,circuit+'work33-v34-synthesis.mjs');
const {analyze}=await imp(eng,circuit+'work36-v41-local-decision.mjs');
const {integrate}=await imp(eng,circuit+'work36-v42-propagation.mjs');
const V=await v43.loadV40(), rows=[];
async function probe(id,f){let r;try{r={id,status:'PASS',detail:await f()};}catch(e){r={id,status:e.code==='ERR_ASSERTION'?'FAIL':'EXECUTION_ERROR',message:e.message};}rows.push(r);console.log('FINAL_PROBE '+JSON.stringify(r));}
const H=n=>'TEST:NAR|TEST:H'+n, pairs=[1,2,3,4].flatMap((a,i)=>[1,2,3,4].slice(i+1).map(b=>[H(a),H(b)]));
const fixture=id=>V.C.fixtures.find(f=>f.id===id);
const history=id=>fixture(id).docs.filter(d=>d.kind==='HISTORICAL_RESULT');
const checks={};
for(const id of ['FK34_FULL','FK34_UNKNOWN']){
 const base=analyzeControlledWork33(V.C,id,{placeThreshold:2,eyeEnabled:false,includePack:true});
 const p=base.loaded.cases.get(id), byId=new Map(p.o.evidence.map(e=>[e.evidence_id,e]));
 const v=analyzeV34(V,id,{placeThreshold:2,eyeEnabled:false,localize:true}), x=analyze(V,id,{eyeEnabled:false}), z=integrate(x,fixture(id).docs,{eyeEnabled:false});
 const out=[];
 for(const d of history(id))for(const [j,cp] of d.geometry.checkpoints_m.entries())for(const [a,b] of pairs){
  const A=d.rows.find(r=>r.nativeId===a.split('|').at(-1)),B=d.rows.find(r=>r.nativeId===b.split('|').at(-1));
  const sc=v.scenarios.find(s=>s.event===d.issuer+'|'+d.eventId&&s.checkpoint_m===cp);
  const e=sc?.edges.find(e=>e.a===a&&e.b===b), u=p.r.measurement.clock_uncertainty_ms;
  const center=B.clockMs-A.clockMs, change=center-(B.checkpointMs[j]-A.checkpointMs[j]);
  const wanted=[center-6*u,center+6*u];
  const refs=new Set(e?.refs??[]),found=[...refs].map(i=>byId.get(i)).filter(Boolean);
  const typed=(horse,field)=>found.some(q=>q.event_id===d.issuer+'|'+d.eventId&&q.subject_id===horse&&q.field===field);
  const required=[a,b].every(h=>typed(h,'checkpoint_ms')&&typed(h,'finish_ms'));
  const unresolved=[...refs].filter(i=>!byId.has(i));
  const currentStatusRefs=found.filter(q=>q.event_id===p.o.events[0].event_id&&q.field==='status').map(q=>q.subject_id);
  const local=x.history_v41.find(s=>s.event===d.issuer+'|'+d.eventId&&s.checkpoint===cp)?.edges.find(q=>q.a===a&&q.b===b);
  out.push({event:d.eventId,cp,a,b,center,change,wanted,actual:e?.interval_ms??null,actualChange:e?.change_ms??null,u,required,unresolved,currentStatusRefs,measured:local?.measured??false,local:local?.unaffected??false});
 }
 checks[id]={out,roster:x.roster,fullCurrent:z.routes.flatMap(r=>r.edges).filter(e=>e.full).length,currentGrades:z.runners.map(h=>h.current_grade)};
 console.log('PAIR90 '+JSON.stringify({id,...checks[id]}));
}
await probe('P90-full-literal-clock-bound',()=>{const a=checks.FK34_FULL.out;assert.equal(a.length,90);assert.ok(a.every(r=>JSON.stringify(r.actual)===JSON.stringify(r.wanted)&&r.actualChange===r.change&&r.required&&!r.unresolved.length));return {records:a.length,policy:'V34 conservative 6u; no claim this is only valid uncertainty convention'};});
await probe('P90-unknown-history-preserved',()=>{const a=checks.FK34_UNKNOWN.out;assert.equal(a.length,90);const good=a.filter(r=>JSON.stringify(r.actual)===JSON.stringify(r.wanted)&&r.actualChange===r.change&&r.required&&!r.unresolved.length);assert.equal(good.length,90,'historical valid comparisons restored '+good.length+'/90');return {records:good.length};});
await probe('P90-unknown-current-hold',()=>{const a=checks.FK34_UNKNOWN;assert.equal(a.roster.possible_active.length,5);assert.equal(a.roster.known_active.length,4);assert.equal(a.fullCurrent,0);assert.ok(a.currentGrades.every(g=>g===null));return 'historical preservation separately checked; no current full transfer';});
const results={};
for(const id of ['FK34_FULL','FK34_UNKNOWN','FK34_DISCOVERY','W36_POSITIVE']){
 try{
  const {request,receipt}=v43.acceptedRequest(V,id);
  const on=await v43.analyzeVerified(V,request,receipt,{eyeEnabled:true}), off=await v43.analyzeVerified(V,request,receipt,{eyeEnabled:false});
  assert.equal(on.digest,off.digest);assert.equal(on.groups,118);assert.equal(on.held,826);
  const summary=(h)=>({horse:h.horse,research:h.research_grade,current:h.current_grade,formal:h.grade,axes:h.axes.map(a=>({axis:a.axis,state:a.state,support:a.support.length,counter:a.counter.length})),roots:h.rootGroups.length,unresolved:h.unresolvedLineage,feedback:h.feedback.length,items:h.itemConsumption.length,reasons:h.gradeReasons,paths:h.paths.length});
  const changes=on.runners.map(h=>{const b=off.runners.find(r=>r.horse===h.horse);return {horse:h.horse,grade:[b.research_grade,h.research_grade],changedAxes:h.axes.filter(a=>JSON.stringify(a)!==JSON.stringify(b.axes.find(q=>q.axis===a.axis))).map(a=>a.axis),semanticItems:h.itemConsumption.filter(i=>JSON.stringify(i.semantic)!==JSON.stringify(b.itemConsumption.find(q=>q.item===i.item)?.semantic)).map(i=>i.item),changedRoute:h.paths.filter(p=>{const q=b.paths.find(q=>q.id===p.id);return q&&[q.decision,q.materialCounter,q.review].join('|')!==[p.decision,p.materialCounter,p.review].join('|')}).length}});
  results[id]={on:on.runners.map(summary),off:off.runners.map(summary),changes,digest:on.digest};console.log('V43_INDEPENDENT '+JSON.stringify({id,...results[id]}));
 }catch(e){console.log('V43_ERROR '+JSON.stringify({id,message:e.message}));}
}
await probe('V43-fixed-execution',()=>{assert.equal(Object.keys(results).length,4);assert.ok(Object.values(results).every(x=>x.on.every(h=>h.items===115&&h.formal===null&&h.axes.length===5)));return {cases:4};});
await probe('V43-current-grade-completion',()=>{assert.ok(Object.values(results).some(x=>x.on.some(h=>h.current!==null)),'No actual current grade witness; research candidate is distinct');});
await probe('V43-root-resolution',()=>{assert.ok(Object.values(results).length>0);assert.ok(Object.values(results).every(x=>x.on.every(h=>h.unresolved.length===0)),'Unresolved root lineage');});
await probe('WORK41-native-to-v43',async()=>{
 const supply=await imp(work,'research/reborn2-work41-corrected/supply-v0.3.mjs');
 const adapter=await imp(work,'research/reborn2-work41-corrected/common-adapter-v0.3.mjs');
 const {run31}=await imp(eng,circuit+'work32-pinned/stage32-condition-pipeline-v0.1.2.mjs');
 const envelope=supply.makeEnvelope(fixture('FK34_FULL').docs), validated=supply.validateEnvelope(envelope);
 const old=await adapter.analyzeSupply(envelope,{eyeEnabled:true});
 const {request,receipt}=v43.acceptedRequest(V,'FK34_FULL');
 const sha=x=>createHash('sha256').update(x).digest('hex');
 const {input,registry,out}=run31(validated.docs,V.C.canonical,sha);
 const text=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:V.C.canonical,cases:[{n:'FK34_FULL',input,registry,expectedDigest:out.digest}]})+'\n';
 assert.equal(out.digest,old.commonSha256);assert.equal(out.digest,receipt.source_digest);assert.equal(sha(text),receipt.bundle_sha256);
 const actual=await v43.analyzeVerified(V,{id:'FK34_FULL',bundleText:text,envelope:out},receipt,{eyeEnabled:true});
 assert.equal(actual.digest,old.commonSha256);assert.equal(actual.runners.length,5);
 return {nativeEvidence:old.evidence.length,roots:validated.roots.length,categories:old.categories.map(h=>h.categories.length),digest:actual.digest,scope:'independent test adapter from Work validated docs to V43; category-specific supply not consumed by V43 API, not development integration'};
});
console.log('FINAL_RECEIPT '+JSON.stringify({engSha,workSha,rows,formal:false}));
process.exitCode=rows.some(r=>r.status==='EXECUTION_ERROR')?2:rows.some(r=>r.status==='FAIL')?1:0;
