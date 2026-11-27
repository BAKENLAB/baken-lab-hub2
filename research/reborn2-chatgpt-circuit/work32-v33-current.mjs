// V33 research-only: exact Work32 verified intake -> existing V31/V30/V29/V28/V27 -> common axes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pipeline31,verifier31} from './work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
import {consume32} from './work32-pinned/stage32-verified-common-adapter-v0.1.2.mjs';
import {analyzeV31,compareV31Response,jointClockFeasibility,loadV31} from './work30-v31-integrated.mjs';
import {jointField} from './work29-v30-terminal.mjs';
import {dependencyReader,uniq} from './research-ability-core.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL('./work32-pinned/'+n,import.meta.url));
const manifest=JSON.parse(read('stage32-final-handoff-v0.1.2.json'));
const pins=[...manifest.pins,...manifest.packetFiles,manifest.shaImplementation];
function verifiedFile(n){const p=pins.find(x=>x.path.endsWith('/'+n));assert.ok(p,'PIN_DECLARED');const b=read(n);assert.equal(blob(b),p.blob,'BLOB '+n);assert.equal(sha(b),p.sha256,'SHA '+n);return b;}
const json=n=>JSON.parse(verifiedFile(n));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function loadWork32(){
 for(const p of pins)verifiedFile(p.path.split('/').at(-1));
 for(const p of manifest.codexPins){const b=readFileSync(new URL('./'+p.path.split('/').at(-1),import.meta.url));assert.equal(blob(b),p.blob,'COMMON_BLOB');assert.equal(sha(b),p.sha256,'COMMON_SHA');}
 const text=verifiedFile('stage32-bundles-v0.1.2.json').toString('utf8'),bundle=JSON.parse(text),canonical=loadV31().canonical.map(({item,name})=>({item,name}));
 assert.deepEqual(bundle.canonical,canonical);assert.equal(canonical.length,115);
 return {text,bundle};
}
export function envelope32(n,loaded=loadWork32()){
 const q=loaded.bundle.cases.find(x=>x.n===n);assert.ok(q,'CASE');
 const replay=pipeline31(q.input,q.registry,loaded.bundle.canonical,sha,verifier31);
 assert.equal(replay.digest,q.expectedDigest);
 let candidate;
 if(n===3||n===5)candidate=json('stage32-packet-'+n+'-v0.1.2.json');
 else if(n===12){
  const m=json('stage32-packet-12-meta-v0.1.2.json'),e=json('stage32-packet-12-evidence-v0.1.2.json'),r=json('stage32-packet-12-runners-v0.1.2.json'),c=json('stage32-packet-12-common-v0.1.2.json');
  const values={...m.meta,evidence:e.evidence.map(x=>({...x,receipt:m.receipts[x.receipt]})),runners:r.runners,common:c.common};
  const packet=Object.fromEntries(m.fieldOrder.map(k=>[k,values[k]]));
  candidate={state:m.envelope.state,packet,digest:m.envelope.digest,resultTimestamp:m.envelope.resultTimestamp};
  assert.equal(sha(JSON.stringify(candidate)+'\n'),manifest.transportIndex.fullEnvelopeSha256,'FULL_TRANSPORT');
 }else candidate=replay; // adverse worlds are pinned inputs/digests, not fabricated packets.
 assert.deepEqual(candidate,replay,'COMPLETE_REPLAY');return candidate;
}
function enrich(L,name,withdraw,options){
 const out=analyzeV31(L,name,withdraw,options),p=L.cases.get(name),[target,...history]=p.o.events,roster=out.roster.possible_active,threshold=options.placeThreshold??null;
 const all=new Map(p.o.evidence.map(e=>[e.evidence_id,e])),field=(ev,h,k)=>p.o.evidence.find(e=>e.event_id===ev&&e.subject_id===h&&e.field===k);
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[field(e.event_id,e.subject_id,'id')?.evidence_id,...(e.field==='status'?[]:[field(e.event_id,e.subject_id,'status')?.evidence_id])].filter(Boolean));
 const ok=e=>e&&get(e.evidence_id)&&e.state==='SYNTHETIC_OBSERVATION',val=e=>ok(e)?e.value:null,refs=es=>lineage(es.filter(Boolean).map(e=>typeof e==='string'?e:e.evidence_id)).map(e=>e.evidence_id);
 const contexts=history.map(e=>{
  const tc=val(target.conditions),pc=val(e.conditions),tg=val(target.geometry),pg=val(e.geometry);
  const dims={};for(const k of ['distance_m','venue','surface','going','class_label','class_version'])dims[k]=tc?.[k]!=null&&pc?.[k]!=null?same(tc[k],pc[k]):null;
  for(const k of ['direction','first_turn_m','straight_m','course_version','checkpoints_m'])dims[k]=tg?.[k]!=null&&pg?.[k]!=null?same(tg[k],pg[k]):null;
  const state=Object.values(dims).includes(null)?'MISSING_CONTEXT':Object.values(dims).every(Boolean)?'SAME_REPORTED_RACE_CONTEXT':'DIFFERENT_REPORTED_RACE_CONTEXT';
  // Same label/geometry is not a demonstrated causal response.
  return {event:e.event_id,dims,state,refs:refs([target.conditions,e.conditions,target.geometry,e.geometry]),causal_response:null};
 });
 const known=out.roster.known_active;
 const pairs=roster.flatMap((a,i)=>roster.slice(i+1).map(b=>({a,b})));
 const pairResponse=[];
 // V31's actual comparison function is reused on one representative direct pair per case.
 // Other pairs reuse the already executed common observations without duplicating the engine.
 const representative=pairs.find(q=>known.includes(q.a)&&known.includes(q.b)&&history.filter(e=>out.direct.some(d=>d.event===e.event_id&&[d.a,d.b].includes(q.a)&&[d.a,d.b].includes(q.b))).length>=2);
 let representativeV31=null;
 if(representative){const ev=history.filter(e=>out.direct.some(d=>d.event===e.event_id&&[d.a,d.b].includes(representative.a)&&[d.a,d.b].includes(representative.b)));representativeV31=compareV31Response(L,name,representative.a,representative.b,ev[0].event_id,ev[1].event_id,withdraw);}
 for(const pair of pairs){
  const {a,b}=pair;
  const comparisons=history.flatMap(e=>{
   const d=out.direct.find(q=>q.event===e.event_id&&[q.a,q.b].includes(a)&&[q.a,q.b].includes(b));if(!d)return [];
   const ca=field(e.event_id,a,'finish_ms'),cb=field(e.event_id,b,'finish_ms'),fa=field(e.event_id,a,'final600_ms'),fb=field(e.event_id,b,'final600_ms');
   const xa=val(ca),xb=val(cb),ya=val(fa),yb=val(fb),u=p.r.measurement.clock_uncertainty_ms;
   const gap=Number.isFinite(xa)&&Number.isFinite(xb)?xb-xa:null,final=Number.isFinite(ya)&&Number.isFinite(yb)?yb-ya:null;
   const c=contexts.find(x=>x.event===e.event_id);
   const gateWeight=Object.fromEntries([a,b].map(h=>[h,Object.fromEntries(['gate_number','weight_grams'].map(k=>{const old=field(e.event_id,h,k),now=field(target.event_id,h,k);return [k,{past:val(old),current:val(now),refs:refs([old,now])}]}))]));
   const roots=refs([...d.refs,...c.refs,...Object.values(gateWeight).flatMap(x=>Object.values(x).flatMap(v=>v.refs))]);
   return [{event:e.event_id,order:d.order===a?'AHEAD':'BEHIND',condition:c,gateWeight,rank_refs:refs(d.refs),clock_advantage_ms:gap,clock_bound_ms:gap===null?null:2*u,clock_refs:gap===null?[]:refs([ca,cb]),final600_advantage_ms:final,terminal_refs:final===null?[]:refs([fa,fb]),refs:roots}];
  });
  const aligned=comparisons.filter(x=>x.condition.state==='SAME_REPORTED_RACE_CONTEXT'),different=comparisons.filter(x=>x.condition.state==='DIFFERENT_REPORTED_RACE_CONTEXT');
  const contrast=aligned.flatMap(x=>different.filter(y=>x.order!==y.order).map(y=>({aligned:x.event,other:y.event,aligned_order:x.order,other_order:y.order,clock_change_ms:x.clock_advantage_ms!==null&&y.clock_advantage_ms!==null?x.clock_advantage_ms-y.clock_advantage_ms:null,refs:refs([...x.refs,...y.refs,...x.clock_refs,...y.clock_refs]),causal_response:null})));
  pairResponse.push({...pair,comparisons,contrast,current_response:'UNPROVEN',independent_vote:false});
 }
 // One joint scenario per historical context. Do not select incompatible pair histories to manufacture a winner.
 const scenarios=contexts.map(c=>{
  const relations=pairResponse.map(p=>{
   const x=p.comparisons.find(z=>z.event===c.event);
   const applicable=c.state==='SAME_REPORTED_RACE_CONTEXT'&&x&&p.contrast.some(k=>k.aligned===c.event);
   return {a:p.a,b:p.b,order:applicable?x.order:'UNKNOWN',refs:applicable?refs([...x.refs,...p.contrast.filter(k=>k.aligned===c.event).flatMap(k=>k.refs)]):[]};
  });
  const numeric=pairResponse.flatMap(p=>{const r=relations.find(z=>z.a===p.a&&z.b===p.b),x=p.comparisons.find(z=>z.event===c.event);return r.order!=='UNKNOWN'&&x?.clock_advantage_ms!=null?[{a:p.a,b:p.b,delta:x.clock_advantage_ms,bound:x.clock_bound_ms,refs:x.clock_refs}]:[]});
  const fieldResult=jointField(roster,relations,threshold),clock=jointClockFeasibility(roster,numeric);
  return {event:c.event,kind:'CONDITION_LINKED_CONTRAST',scope:'IF_ALIGNED_HISTORICAL_PAIR_RESPONSE_REPEATS_AND_CHANGED_GATE_WEIGHT_FIELD_PACE_DO_NOT_INVALIDATE_IT',condition:c,relations,field:fieldResult,numeric_feasibility:clock,assumptions:['GATE_WEIGHT_RESPONSE_NOT_IDENTIFIED','CURRENT_PACE_ROLE_AND_OUTSIDE_RIVALS_UNKNOWN','JOINT_HISTORICAL_RESPONSE_REPEAT_NOT_PREDICTION'],actual_current_feasibility:'UNRESOLVED',prediction:false};
 });
 const sourceConflicts=p.packet.conflicts??[];
 // Preserve historical observations; conservatively hold joined leader/individual pace whenever a packet conflict
 // or incompatible measured leader checkpoint exists. No pace result feeds a current conditional edge.
 const paceHold=history.map(e=>{
  const leader=field(e.event_id,null,'leader_crossings'),v=val(leader),problems=[];
  if(v)for(const h of known){const ck=field(e.event_id,h,'checkpoint_ms'),r=field(e.event_id,h,'ranks'),times=val(ck),ranks=val(r),g=val(e.geometry);
   if(!times||!ranks||!g)continue;
   for(let j=0;j<times.length;j++){const i=v.distances_m.indexOf(g.checkpoints_m[j]);if(i<0||ranks[j]!==1)continue;const bound=2*p.r.measurement.clock_uncertainty_ms;if(Math.abs(times[j]-v.elapsed_ms[i])>bound)problems.push({horse:h,checkpoint:g.checkpoints_m[j],individual:times[j],leader:v.elapsed_ms[i],bound,refs:refs([ck,r,leader,e.geometry])});}
  }
  const conflicts=sourceConflicts.filter(x=>p.packet.issuer+'|'+x.event===e.event_id),sourceIssues=(p.packet.issues??[]).filter(x=>p.packet.issuer+'|'+x.event===e.event_id&&x.reason==='LEADER_INDIVIDUAL_CROSSING_CONFLICT');
  return {event:e.event_id,state:problems.length||conflicts.length||sourceIssues.length?'CONFLICT_HOLD_JOINED_PACE_INFERENCE':!v?'MISSING_LEADER_CLOCK':'NO_TESTED_CONFLICT_NOT_TRANSFER_PROOF',problems,conflicts,sourceIssues,refs:uniq(problems.flatMap(x=>x.refs)),current_pace:null};
 });
 const historicalScenarios=out.shared_scenarios_v30.map(s=>({...s,joined_pace_state:paceHold.find(x=>x.event===s.event)?.state??'UNKNOWN',current_pace:null,actual_current_feasibility:'UNRESOLVED'}));
 const runners=out.runners.map(h=>{
  const active=h.identity_known&&h.status==='ACTIVE',response=active?pairResponse.filter(x=>x.a===h.slot||x.b===h.slot):[];
  const paths=active?scenarios.map(s=>({event:s.event,kind:s.kind,scope:s.scope,envelope:s.field.envelopes.find(x=>x.slot===h.slot)??null,refs:uniq(s.relations.flatMap(x=>x.refs)),current_feasibility:'UNRESOLVED'})):[];
  const findings=active?response.flatMap(x=>x.contrast.map(z=>({item:'RANK35',state:'CONDITION_LINKED_OBSERVED_REVERSAL_NOT_CAUSAL',observation:{rival:x.a===h.slot?x.b:x.a,aligned:z.aligned,other:z.other,aligned_order:x.a===h.slot?z.aligned_order:z.aligned_order==='AHEAD'?'BEHIND':'AHEAD'},refs:z.refs,formal:false,current_relevance:'CONDITIONAL_ONLY'}))):[];
  const trace=active?out.trace.filter(x=>x.horse===h.slot&&x.refs?.length):[];
  const axes=[['A',['RANK02','RANK03','RANK05','RANK06']],['B',['RANK43','RANK53','RANK54']],['C',['RANK35','RANK36','RANK37']],['D',['RANK18','RANK19','RANK21']],['E',[]]].map(([axis,items])=>{
   const f=axis==='E'?findings:trace.filter(x=>items.includes(x.item)).map(x=>({item:x.item,state:x.decision,observation:x.observation??null,refs:x.refs}));
   const facts=f.map(x=>({item:x.item,predicate:x.state,evidence_refs:x.refs,root_keys:uniq(x.refs.map(k=>all.get(k)?.root).filter(Boolean)),independent_vote:false,observation:x.observation,applicability:axis==='E'?'CONDITIONAL_ONLY':'HISTORICAL_ONLY'}));
   return {axis,state:!active?'NOT_EVALUATED':facts.length?'OBSERVED_CURRENT_RELEVANCE_UNPROVEN':'MISSING',facts,conditions_or_pace:!active?[]:axis==='B'?h.condition_paths??[]:axis==='D'?(h.pace_paths??[]).map(x=>{const hold=paceHold.find(y=>y.event===x.event);return hold?.state==='CONFLICT_HOLD_JOINED_PACE_INFERENCE'?{...x,literal_observations:x.comparisons,comparisons:[],state:hold.state,current_pace:null}:x}):[],current_support:[],current_counter:[],grade_effect:false};
  });
  const eye=active?(h.eye??[]).map(x=>({item:x.item,targets:x.upstream,refs:uniq(x.observations.flatMap(z=>z.refs)),state:x.observations.length?'HISTORICAL_REVIEW_ONLY':'HELD',returned_to_current_analysis:false,conditional_path_effect:false,independent_vote:false})):[];
  return {slot:h.slot,status:h.status,identity_known:h.identity_known,axes,rival_paths:response,paths,findings_v33:findings,eye_feedback:eye,items:h.items.map(i=>({...i,refs:active?uniq([...i.refs,...findings.filter(f=>f.item===i.item).flatMap(f=>f.refs)]):[],v33_findings:findings.filter(f=>f.item===i.item),grade_effect_proven:false})),WIN:active?{state:'UNRESOLVED',paths}:null,PLACE:active?{state:threshold===null?'THRESHOLD_UNSPECIFIED':'UNRESOLVED',threshold,paths:threshold===null?[]:paths}:null,grade:null,formal:false};
 });
 return {schema:'REBORN2_COMMON_ANALYSIS_TO_CODEX_AXES_V33_RESEARCH',source_digest:null,source_evidence:p.packet.evidence.length,source_item_rows:p.packet.runners.length*115,source_available:p.packet.runners.flatMap(r=>r.items).filter(i=>i.refs.length).length,roster:{...out.roster,unknown_slots:runners.filter(h=>h.status!=='CANCELLED'&&(!h.identity_known||h.status!=='ACTIVE')).map(h=>h.slot)},history:out.historical,direct:out.direct,indirect:out.indirect,followups:out.followups,leaders:out.leaders,contexts,pairResponse,representativeV31,relations:scenarios,checkpoints:[],cross_measurement_review:paceHold,shared_scenarios:[...historicalScenarios,...scenarios],runners,clock_conflicts:sourceConflicts,formal:false,grade:null,core:'consume32->analyzeV31->V30->V29->V28->V27',groups:118,held:826};
}
export function analyzeV33(n,{withdraw=null,placeThreshold=null,candidate=null,loaded=loadWork32()}={}){
 const env=candidate??envelope32(n,loaded),r=consume32(loaded.text,n,env,sha,pipeline31,verifier31,enrich,withdraw,{placeThreshold});
 assert.equal(r.state,'COMMON_ANALYZER_EXECUTED',r.reason);
 return {...r.result,source_digest:r.pack.packet&&env.digest};
}
