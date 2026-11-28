// Independent V44 acceptance preparation. Execute only on a final SHA
// explicitly accepted for testing by Main. No engine edits or grade quotas.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const [dir,sha,workDir,workSha]=process.argv.slice(2);
for(const [d,s] of [[dir,sha],[workDir,workSha]]){
 assert.match(s??'',/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['-C',d,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),s);
}
assert.equal(workSha,'1f185f879bc58ca5d0665d90419981dac9b73bf6','WORK42_EXECUTED_PIN');
const imp=(d,p)=>import(pathToFileURL(resolve(d,p)));
const circuit='research/reborn2-chatgpt-circuit/';
const {loadV40}=await imp(dir,circuit+'work36-v40-integrated.mjs');
const {analyzeControlledWork33}=await imp(dir,circuit+'work32-v33-current.mjs');
const {analyzeV34}=await imp(dir,circuit+'work33-v34-synthesis.mjs');
const {analyze}=await imp(dir,circuit+'work36-v41-local-decision.mjs');
const {integrate}=await imp(dir,circuit+'work36-v42-propagation.mjs');
const V=await loadV40(), result=[];
async function check(id,f){let r;try{r={id,status:'PASS',detail:await f()};}catch(e){r={id,status:e.code==='ERR_ASSERTION'?'FAIL':'EXECUTION_ERROR',error:e.message};}result.push(r);console.log('V44_INDEPENDENT_CHECK '+JSON.stringify(r));}
const H=n=>'TEST:NAR|TEST:H'+n,pairs=[1,2,3,4].flatMap((a,i)=>[1,2,3,4].slice(i+1).map(b=>[H(a),H(b)]));
const docs=id=>V.C.fixtures.find(f=>f.id===id).docs;
const histories=id=>docs(id).filter(d=>d.kind==='HISTORICAL_RESULT');
const observations=q=>q.scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO');
const snapshot={};
function build(id,withdraw=null){
 const base=analyzeControlledWork33(V.C,id,{withdraw,placeThreshold:2,eyeEnabled:false,includePack:true});
 const p=base.loaded.cases.get(id), all=new Map(p.o.evidence.map(e=>[e.evidence_id,e]));
 const q=analyzeV34(V,id,{withdraw,placeThreshold:2,eyeEnabled:false,localize:true});
 const target=p.o.events[0].event_id;
 const data=[];
 for(const d of histories(id))for(const [j,cp] of d.geometry.checkpoints_m.entries())for(const [a,b] of pairs){
  const event=d.issuer+'|'+d.eventId, A=d.rows.find(r=>r.nativeId===a.split('|').at(-1)),B=d.rows.find(r=>r.nativeId===b.split('|').at(-1));
  const s=observations(q).find(s=>s.event===event&&s.checkpoint_m===cp),e=s?.edges.find(e=>e.a===a&&e.b===b);
  const u=p.r.measurement.clock_uncertainty_ms,delta=B.clockMs-A.clockMs,change=delta-(B.checkpointMs[j]-A.checkpointMs[j]);
  // Existing conservative policy, not a claim that all other valid bounds are wrong.
  const refs=e?.historical_refs??e?.refs??[],seen=new Set(),unresolved=new Set();
  function visit(i){if(seen.has(i))return;seen.add(i);const x=all.get(i);if(!x){unresolved.add(i);return;}for(const dep of x.depends_on??[])visit(dep);}
  refs.forEach(visit);
  const closure=[...seen].map(i=>all.get(i)).filter(Boolean);
  const source=(h,k)=>closure.some(x=>x.event_id===event&&x.subject_id===h&&x.field===k);
  const targetRefs=closure.filter(x=>x.event_id===target).map(x=>({id:x.evidence_id,field:x.field,subject:x.subject_id}));
  data.push({event,cp,a,b,u,delta,change,expected:[delta-6*u,delta+6*u],actual:e?.interval_ms??null,actualChange:e?.change_ms??null,required:[a,b].every(h=>source(h,'finish_ms')&&source(h,'checkpoint_ms')),historicalField:s?.historicalField,knownField:s?.knownField,currentRosterCertain:s?.currentRosterCertain,refs,closure:[...seen].sort(),targetRefs,unresolved:[...unresolved]});
 }
 return {q,data,all,target};
}
for(const id of ['FK34_FULL','FK34_UNKNOWN']){
 snapshot[id]=build(id);
 console.log('V44_PAIR90 '+JSON.stringify({id,rows:snapshot[id].data,roster:snapshot[id].q.roster}));
}
const good=r=>JSON.stringify(r.actual)===JSON.stringify(r.expected)&&r.actualChange===r.change&&r.required&&!r.targetRefs.length&&!r.unresolved.length;
await check('V44-P90-FULL',()=>{const a=snapshot.FK34_FULL.data;assert.equal(a.length,90);assert.equal(a.filter(good).length,90);return {records:90};});
await check('V44-P90-UNKNOWN',()=>{const a=snapshot.FK34_UNKNOWN.data;assert.equal(a.length,90);assert.equal(a.filter(good).length,90);return {records:90};});
await check('V44-P90-SAME-HISTORICAL-DEPENDENCIES',()=>{const a=snapshot.FK34_FULL.data,b=snapshot.FK34_UNKNOWN.data;assert.equal(a.length,90);assert.equal(b.length,90);for(const [i,x] of a.entries()){const y=b[i];assert.ok(good(x)&&good(y));assert.deepEqual([x.event,x.cp,x.a,x.b,x.actual,x.actualChange,x.closure],[y.event,y.cp,y.a,y.b,y.actual,y.actualChange,y.closure]);}return {records:90};});
await check('V44-STATUS-UNKNOWN-TRANSFER-BOUNDARY',()=>{const q=analyze(V,'FK34_UNKNOWN',{eyeEnabled:false}),z=integrate(q,docs('FK34_UNKNOWN'),{eyeEnabled:false});assert.equal(q.roster.possible_active.length,5);assert.equal(q.roster.known_active.length,4);assert.ok(q.roster.possible_active.includes(H(5)));assert.equal(q.history_v41.flatMap(s=>s.edges.filter(e=>pairs.some(([a,b])=>e.a===a&&e.b===b)&&e.measured)).length,90);assert.equal(z.routes.flatMap(r=>r.edges).filter(e=>e.full).length,0);return {scope:'fixed fixture full transfer held; not a universal rule for bounded uncertainty'};});
await check('V44-WITHDRAWAL-LOCALITY',()=>{const q=snapshot.FK34_UNKNOWN.q;const root=q.source_packet.evidence.find(e=>e.event==='TEST:CONTEST'&&e.subject==='TEST:H1'&&e.field==='checkpoint_ms');assert.ok(root);const w=build('FK34_UNKNOWN',root.evidenceId).data;
 const depends=w.filter(r=>r.event.endsWith('|TEST:CONTEST')&&(r.a===H(1)||r.b===H(1))),others=w.filter(r=>!depends.includes(r));assert.equal(depends.length,9);assert.ok(depends.every(r=>r.actual===null));assert.equal(others.length,81);assert.ok(others.every(good));return {held:9,unaffected:81};});
await check('V44-WORK42-VERIFIED-SOURCE-CONTRACT',async()=>{
 const {makeEnvelope}=await imp(workDir,'research/reborn2-work42/validate-v0.4.mjs');
 const {prepareSupply,compileReturn}=await imp(workDir,'research/reborn2-work42/codex-contract-v0.4.mjs');
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const {run31}=await imp(dir,circuit+'work32-pinned/stage32-condition-pipeline-v0.1.2.mjs');
 const envelope=makeEnvelope(docs('FK34_FULL')),prepared=await prepareSupply(envelope,{id:'FK34_FULL'});
 const {request,receipt,supply}=prepared;
 const native=run31(docs('FK34_FULL'),V.C.canonical,hash);
 assert.equal(native.out.digest,receipt.source_digest);assert.deepEqual(native.out,request.envelope);
 assert.equal(hash(request.bundleText),receipt.bundle_sha256);assert.equal(supply.commonSha256,receipt.source_digest);
 const pin=V.fixed.get('FK34_FULL').pin;assert.equal(receipt.source_digest,pin.source_digest);assert.equal(receipt.bundle_sha256,pin.bundle_sha256);
 const runner=supply.runners[0],claims=runner.categories.flatMap(c=>c.claims);
 assert.ok(claims.length);const other=supply.runners[1].categories.flatMap(c=>c.claims)[0];assert.ok(other);
 const selected=claims.map(c=>c.claim_id),base=compileReturn(supply,runner.horse_id,selected),contrast=compileReturn(supply,runner.horse_id,[...selected,selected[0],other.claim_id]);
 assert.deepEqual(base.items,contrast.items);assert.deepEqual(contrast.rejected.map(r=>r.reason),['DUPLICATE_CLAIM','IRRELEVANT_OR_UNVERIFIED_CLAIM']);
 for(const item of base.items){assert.equal(new Set(item.semantic_root_keys).size,item.semantic_root_keys.length);assert.ok(item.dependency_ids.every(id=>supply.nativeIds.includes(id)));}
 return {digest:receipt.source_digest,claims:claims.length,items:base.items.length,scope:'source contract compatibility only, integrated consumer still requires final API'};
});
const pending=['current_nonwinner_win','same_condition_peer_strength','measured_load_vs_advantage','multiple_S_and_no_S','current_A_B','current_C_unknown','cross_id_root_dedup_in_consumer','bounded_vs_decisive_unknown','engine_result_isolation','EYE15_common_kernel_causality'];
for(const id of pending)console.log('V44_PENDING '+JSON.stringify({id,status:'NOT_EXECUTED',reason:'Final V44 consumer API, source-bound controls and per-claim semantic assertions required; no grades predetermined'}));
console.log('V44_PREP_RECEIPT '+JSON.stringify({sha,workSha,result,pending,formal:false}));
process.exitCode=result.some(r=>r.status==='EXECUTION_ERROR')?2:result.some(r=>r.status==='FAIL')?1:0;
