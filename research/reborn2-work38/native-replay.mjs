// Work38 research only: exact V42 decision function and verified common producer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadV40} from '../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
import {analyze,admission,leakAudit} from '../reborn2-chatgpt-circuit/work36-v41-local-decision.mjs';
import {run31,pipeline31,verifier31} from '../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL(n,import.meta.url));
const H3='TEST:NAR|TEST:H3',copy=x=>JSON.parse(JSON.stringify(x));
const receipt={scope:'SYNTHETIC_ONLY',priorLedger:699,addedAccepted:0,checks:[],records:[],limitations:['Exact pinned V42 function body loaded without its CLI harness; existing V42 regression is separate.','Historical synthetic controls do not establish current scenario or class strength.','Evidence sufficiency is route/axis specific; no expected SABC label and no formal adoption.','Old Work36 full ZIP not independently rearchived.']};
const check=(id,fn)=>{fn();receipt.checks.push(id);console.log('WORK38 '+id+' PASS');};
const src=read('../reborn2-chatgpt-circuit/work36-v42-propagation.mjs');
const fixed=JSON.parse(read('./antecedents-v0.1.json'));
const old=JSON.parse(read('../reborn2-chatgpt-circuit/work34-pinned/stage34-raw-fixtures-v0.2.json'));
let tmp;
try{
 check('PINNED_SOURCE',()=>{assert.equal(blob(src),'42fd6d42154e1b803be2dcab62296149d071d6c8');assert.equal(blob(read('../reborn2-chatgpt-circuit/work34-pinned/stage34-raw-fixtures-v0.2.json')),fixed.source.blob);});
 const s=src.toString(),marker='const V=await loadV40(),all=[];';
 assert.equal(s.split(marker).length,2);
 tmp=new URL('../reborn2-chatgpt-circuit/.work38-v42-exact-function.mjs',import.meta.url);
 writeFileSync(tmp,s.split(marker)[0]+'\nexport {integrate};\n');
 const {integrate}=await import(tmp.href);
 const V=await loadV40();
 const base=old.fixtures.find(f=>f.id==='FK34_FULL').docs,master={id:'W38_COMPRESSION_MASTER',docs:[...base,...fixed.newDocs]};
 const card=base[0],newIds=fixed.newDocs.map(d=>d.eventId);
 check('NO_TARGET_OUTCOME_AND_PRE_CUTOFF',()=>{assert.equal(master.docs.filter(d=>d.kind==='TARGET_CARD').length,1);assert.ok(card.rows.every(r=>!('finish' in r)&&!('clockMs' in r)));for(const d of fixed.newDocs){assert.ok(d.eventAt<card.scheduledPost&&d.updatedAt<card.scheduledPost);assert.equal(d.rows.length,5);assert.equal(d.leaderLaps.valuesMs.reduce((a,b)=>a+b,0),Math.min(...d.rows.map(r=>r.clockMs)));for(const row of d.rows){assert.equal(row.final600Ms,row.clockMs-row.checkpointMs[1]);assert.ok(row.checkpointMs[0]<row.checkpointMs[1]&&row.checkpointMs[1]<row.checkpointMs[2]&&row.checkpointMs[2]<row.clockMs);}}});
 check('INDEPENDENT_COMPRESSION_BOUNDS',()=>{for(const d of master.docs.slice(1)){const p=fixed.profiles.find(p=>p.event===d.eventId);const spread=j=>Math.max(...d.rows.map(r=>r.checkpointMs[j]))-Math.min(...d.rows.map(r=>r.checkpointMs[j]));assert.equal(spread(0)-spread(1),p.spreadChange);assert.equal(p.measurementErrorBound,4*d.precisionMs);if(newIds.includes(d.eventId))assert.ok(p.spreadChange>p.measurementErrorBound);else assert.ok(p.spreadChange< -p.measurementErrorBound);}});
 const {input,registry,out}=run31(master.docs,V.C.canonical,sha);
 const bundleText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:V.C.canonical,cases:[{n:master.id,input,registry,expectedDigest:out.digest}]})+'\n';
 const bundle=sha(bundleText);
 check('COMMON_PACKET_VERIFIED',()=>{assert.equal(out.state,'TEST_PACKET');assert.equal(out.digest,sha(JSON.stringify(out.packet)));assert.equal(V.C.verify32(bundleText,master.id,out,sha,pipeline31,verifier31,bundle).state,'VERIFIED_SYNTHETIC_ENVELOPE');});
 const pin={id:master.id,source_digest:out.digest,bundle_sha256:bundle,evidence:out.packet.evidence.length,itemRows:575,blob:null};
 const M={...V,master:{f:master,p:pin,out},generated:V.generated.map(g=>g.f.id==='W36_BASE'?{...g,f:{id:'W36_BASE',docs:base}}:g),C:{...V.C,fixtures:[...V.C.fixtures,master],receipt:{summary:[...V.C.receipt.summary,pin]}},fixed:new Map([...V.fixed,[master.id,{raw:{raw:master.docs},pin}] ]])};
 receipt.packet={pin,sourceRoots:out.packet.evidence.map(e=>({id:e.evidenceId,event:e.event,subject:e.subject,field:e.field,root:e.root,dependencies:e.dependencies}))};
 const compact=(x,z)=>({id:z.id,digest:z.digest,groups:x.groups,held:x.held,roster:x.roster,formal:z.formal,grade:z.grade,runners:z.runners.map(h=>({horse:h.horse,conditional:h.conditional_grade,current:h.current_grade,items:h.items.length,eyeCategories:x.runners_v41.find(q=>q.horse===h.horse)?.eye?.length,eye:h.eye,reasons:h.reasons,paths:h.paths.filter(p=>p.checkpoint===800).map(p=>({id:p.id,decision:p.decision,full:p.full,local:p.local,field:p.field,own:p.own,axes:p.axes.map(a=>({axis:a.axis,support:a.support.length,counter:a.counter.length,unknown:a.unknown.length,refs:a.refs}))}))}))});
 const masks=[[],[newIds[0]],[...newIds]].map(a=>{const m=admission(M,a);return {m,z:integrate(m.x,master.docs)};});
 check('IMMUTABLE_MASTER_MASKS',()=>{for(const {m,z} of masks){assert.equal(z.digest,out.digest);assert.equal(z.runners.length,5);assert.equal(m.x.groups,118);assert.equal(m.x.held,826);assert.ok(z.runners.every(h=>h.items.length===115&&h.current_grade===null&&h.grade===null));const a=leakAudit({...m.x,v42:z});assert.equal(a.leaks.length+a.events.length+a.broken.length,0);}assert.throws(()=>admission(M,[newIds[0],newIds[0]]),/DUPLICATE_AVAILABILITY/);});
 check('H3_DIRECT_V42_NUMERIC_CROSS',()=>{const h=masks[2].z.runners.find(q=>q.horse===H3);for(const c of fixed.h3Cross){const p=h.paths.find(p=>p.checkpoint===800&&p.start.endsWith(c.start)&&p.response.endsWith(c.response));assert.ok(p,c.start+' '+c.response);for(const e of c.intervals){const q=p.own.find(q=>q.rival.endsWith(e.rival));assert.deepEqual(q.finish,e.interval);}}});
 for(const {m,z} of masks)receipt.records.push({kind:'COMPRESSION_MASK',admitted:m.admitted,audit:leakAudit({...m.x,v42:z}),result:compact(m.x,z)});
 const controls=['FK34_UNKNOWN','W36_BASE','W36_CONTEXT_WEIGHT','W36_CONTEXT_GATE','W36_CONTEXT_GOING','W36_CONTEXT_COURSE','W36_CONTEXT_DISTANCE','W36_CONTEXT_JOINT','W36_PEER_CLASS','W36_LOCAL_MISSING'];
 for(const id of controls){const x=analyze(V,id),f=V.C.fixtures.find(f=>f.id===id),z=integrate(x,f.docs);check('CONTROL_'+id,()=>{assert.equal(z.digest,V.fixed.get(id).pin.source_digest);assert.equal(x.groups,118);assert.equal(x.held,826);assert.ok(z.runners.every(h=>h.items.length===115&&h.grade===null&&h.current_grade===null));assert.ok(x.runners_v41.every(h=>h.eye.length===15));for(const h of z.runners)for(const p of h.paths)assert.equal(p.axes.length,5);});receipt.records.push({kind:'FIXED_CONTROL',result:compact(x,z),condition:x.history_v41.map(q=>({event:q.event,shared:q.shared,fieldChanged:q.fieldChanged,localEdges:q.edges.filter(e=>e.unaffected).length})),followups:x.source_packet.followups});}
 const bIds=new Set(V.generated.find(g=>g.f.id==='W36_BASE').f.docs.map(d=>d.eventId)),candidate=V.master.f.docs.filter(d=>d.kind==='HISTORICAL_RESULT'&&!bIds.has(d.eventId)).map(d=>d.eventId);
 for(const [name,ids] of [['BASE',[]],['ONE_POS',[candidate[0]]],['POSITIVE',candidate.slice(0,2)],['WITHDRAWN',[]],['MATCHED_COUNTER',candidate.slice(0,3)],['OTHER_COUNTER',[...candidate.slice(0,2),candidate[3]]],['NEGATIVE_ONLY',[candidate[2]]]]){
  const m=admission(V,ids),z=integrate(m.x,V.master.f.docs),a=leakAudit({...m.x,v42:z});
  check('EYE_'+name,()=>{assert.equal(z.digest,V.master.out.digest);assert.equal(a.leaks.length+a.events.length+a.broken.length,0);assert.ok(m.x.runners_v41.every(h=>h.eye.length===15));assert.ok(z.runners.every(h=>h.current_grade===null&&h.grade===null));});
  receipt.records.push({kind:'EYE_MASK',name,admitted:m.admitted,audit:a,result:compact(m.x,z)});
 }
 check('EYE_WITHDRAWAL_SEMANTIC_EQUALITY',()=>{const a=receipt.records.find(q=>q.name==='BASE'),b=receipt.records.find(q=>q.name==='WITHDRAWN');assert.deepEqual(a.result,b.result);});
 receipt.state='EXECUTED';console.log('WORK38_SUMMARY '+JSON.stringify({checks:receipt.checks,records:receipt.records.map(r=>({kind:r.kind,name:r.name??r.result.id,admitted:r.admitted??null,grades:r.result.runners.map(h=>h.conditional),H3:r.kind==='COMPRESSION_MASK'?r.result.runners.find(h=>h.horse===H3).paths.filter(p=>p.id.includes('W38_COMP')&&p.id.includes('CONTEST')).map(p=>({id:p.id,decision:p.decision,field:p.field,full:p.full})):undefined})),newEvidence:pin.evidence,priorLedger:699,addedAccepted:0}));
}catch(e){receipt.state='FAILED';receipt.error=String(e.stack??e);throw e;}finally{if(tmp)unlinkSync(tmp);if(process.env.WORK38_RECEIPT)writeFileSync(process.env.WORK38_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
