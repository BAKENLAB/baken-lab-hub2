// V32: pinned Work31 replay -> existing V27/V28/V29/V30 analysis. Synthetic research only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pipeline31,verifier31} from './work31-pinned/stage31-multifield-pipeline-v0.1.1.mjs';
import {loadV31} from './work30-v31-integrated.mjs';
import {analyzeV30,jointField} from './work29-v30-terminal.mjs';
import {dependencyReader,uniq,signedGap} from './research-ability-core.mjs';
const need=(v,m)=>{if(!v)throw Error(m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const parse=b=>JSON.parse(b.toString('utf8'));
const pins={
 'stage31-multifield-pipeline-v0.1.1.mjs':['370290cbb1b1c2ebb0f5688944c6ce2d19d26eb0','2a90a34871340ff6be8c29f36d6f2911a743827bb98de1198358f77ac9dcefff'],
 'stage31-multifield-bundles-v0.1.1.json':['1a9c3a29484af2135aa39610625263214e5c193d','f9df1d7d76b2c50d94aa3e0587032ebf2867ee52d138a9a8e328e5cfa30c85b6'],
 'stage31-packet-3-v0.1.1.json':['357582695a418e834254c62343dc17cd87e68879','6239357e4557b8fa49c973bb12ec62ecb8dd5bb9d576c3493cbdc003445e4391'],
 'stage31-packet-5-v0.1.1.json':['bb55fc283947664fbc75de9df5b79187bd7fd884','00e048a9670ba3ab5df0c8a02c0f2b9430cb7bcc41e5cf1edfff346144495ce5'],
 'stage31-packet-12-transport-index-v0.1.1.json':['a69ae2eb5ba3c4b3462be0df474d41e909670a45','0c17e79c512c43c7e5526687bf937336e264742d6c3102fae0615fcb45b2184b'],
 'stage31-packet-12-compact-v0.1.1.json':['4d52dd7a0f4cf96867c80b30b9b7ef593cfd66d9','51a7d0c19fe99b8a78faac068c9d411908799abb05aa57e84fd53f66736fac0b'],
 'stage31-packet-12-common-v0.1.1.json':['d1dc31f1e5d815e26099b301a0df99c580ecc6c3','5b603a6b0f0a2e824eec6340e4d5cabbd74dc387bdacbabb74186fbfc297ae50']};
function read(name){const b=readFileSync(new URL('./work31-pinned/'+name,import.meta.url));need(blob(b)===pins[name][0]&&sha(b)===pins[name][1],'PIN '+name);return b;}
function restore12(){
 const i=parse(read('stage31-packet-12-transport-index-v0.1.1.json')),c=parse(read('stage31-packet-12-compact-v0.1.1.json')),m=parse(read('stage31-packet-12-common-v0.1.1.json'));
 const evidence=c.evidence.map(e=>{need(Number.isInteger(e.receipt)&&c.receipts[e.receipt],'RECEIPT_INDEX');return {...e,receipt:c.receipts[e.receipt]};});
 const fields={...c.meta,evidence,runners:c.runners,common:m.common},packet=Object.fromEntries(c.fieldOrder.map(k=>[k,fields[k]]));
 const out={state:c.envelope.state,packet,digest:c.envelope.digest,resultTimestamp:c.envelope.resultTimestamp};
 need(sha(JSON.stringify(packet))===i.packetDigest&&sha(JSON.stringify(out)+'\n')===i.fullOutputSha256,'RESTORE12');return out;
}
function verifyDAG(evidence){
 const all=new Map(evidence.map(e=>[e.evidenceId,e])),roots=new Set(evidence.map(e=>e.root)),done=new Set(),stack=new Set();
 need(all.size===evidence.length&&roots.size===all.size,'DUPLICATE_ROOT');
 const visit=id=>{if(done.has(id))return;need(all.has(id)&&!stack.has(id),'DEPENDENCY_CYCLE_OR_MISSING');stack.add(id);for(const d of all.get(id).dependencies)visit(d);stack.delete(id);done.add(id);};
 for(const id of all.keys())visit(id);
}
function verified(n,candidate=null){
 need([3,5,12].includes(n),'CASE');
 read('stage31-multifield-pipeline-v0.1.1.mjs');
 const b=parse(read('stage31-multifield-bundles-v0.1.1.json')),c=b.cases.find(x=>x.n===n);
 const saved=n===12?restore12():parse(read('stage31-packet-'+n+'-v0.1.1.json'));
 const actual=pipeline31(c.input,c.registry,b.canonical,sha,verifier31);
 assert.deepEqual(actual,saved);if(candidate!==null)assert.deepEqual(candidate,actual);
 const p=actual.packet;need(actual.state==='TEST_PACKET'&&actual.digest===sha(JSON.stringify(p))&&actual.resultTimestamp.digest===actual.digest&&p.formal_admissions===0&&p.scoring_authorized===false,'REPLAY');
 verifyDAG(p.evidence);
 const docs=c.input.documents.map(d=>{const bytes=Buffer.from(d.bytes);need(sha(bytes)===d.digest,'RAW_HASH');return {raw:parse(bytes),digest:d.digest};});
 return {p,docs,canonical:b.canonical,digest:actual.digest,envelope:actual};
}
// No exported bare adapter. Raw-derived aliases depend on the actual replayed row; original roots remain in lineage.
function adapt({p,docs}){
 const ns=x=>p.issuer+'|'+x,orig=new Map(p.evidence.map(e=>[e.evidenceId,e])),evidence=[],events=[];
 const rawByEvent=new Map(docs.map(d=>[d.raw.eventId,d]));
 const conflicts=new Set();
 for(const {raw:x} of docs.filter(d=>d.raw.kind==='HISTORICAL_RESULT')){
  const rows=x.rows.filter(r=>r.status==='FINISHED'&&Number.isFinite(r.finish)&&Number.isFinite(r.clockMs));
  for(const a of rows)for(const b of rows)if(a.finish<b.finish&&a.clockMs-b.clockMs>2*x.precisionMs){conflicts.add(x.eventId+'|'+a.nativeId);conflicts.add(x.eventId+'|'+b.nativeId);}
 }
 const add=(event,subject,field,value,root,pointer,source,depends_on=[],eid=null,state='SYNTHETIC_OBSERVATION')=>{
  const e={evidence_id:eid??sha(JSON.stringify([root,source,pointer])),event_id:ns(event),subject_id:subject===null?null:ns(subject),field,value,root,pointer:ns(event)+'|'+pointer,source_sha256:source,depends_on,state,formal_usable:false};evidence.push(e);return e;
 };
 const packetMap=new Map();
 for(const e of p.evidence){
  let field=e.field,value=e.value,subject=e.subject,state='SYNTHETIC_OBSERVATION';
  if(['current_card_row','historical_row','historical_pair','peer_followup','finish_classification'].includes(field))subject=null;
  if(field==='finish_clock'){field='finish_ms';if(conflicts.has(e.event+'|'+e.subject))state='HELD_CLOCK_RANK_CONTRADICTION';}
  if(field==='individual_final600')field='final600_ms';
  if(field==='race_leader_laps'){field='leader_crossings';let sum=0;value={elapsed_ms:[0,...value.map(v=>sum+=v)],distances_m:e.measurement.boundariesM,uncertainty_ms:null,scope:'RACE_LEADER_EXPLICIT_REPORTED_CLOCK'};}
  if(field==='winner_clock_difference'&&conflicts.has(e.event+'|'+e.subject))state='HELD_CLOCK_RANK_CONTRADICTION';
  const a=add(e.event,subject,field,value,e.root,e.pointer,e.receipt.digest,e.dependencies,e.evidenceId,state);
  packetMap.set(e.evidenceId,a);
 }
 const find=(event,subject,field)=>p.evidence.find(e=>e.event===event&&e.subject===subject&&e.field===field);
 for(const {raw:x,digest} of docs){
  const target=x.kind==='TARGET_CARD',event=x.eventId,raw=(subject,field,value,pointer,deps=[])=>add(event,subject,field,value,JSON.stringify([p.issuer,event,subject,field]),pointer,digest,deps);
  const winner=x.rows.find(r=>r.finish===1),wc=winner&&find(event,winner.nativeId,'finish_clock'),rows=x.rows.map((r,i)=>{
   const row=find(event,r.nativeId,target?'current_card_row':'historical_row');need(row,'RAW_ROW');
   const ptr='/rows/'+i,dep=[row.evidenceId],identity=raw(r.nativeId,'id',ns(r.nativeId),ptr+'/nativeId',dep);
   raw(r.nativeId,'status',r.status,ptr+'/status',dep);
   const number=raw(r.nativeId,'horse_number',r.no,ptr+'/no',dep);
   const gate=r.gate==null?null:raw(r.nativeId,'gate_number',r.gate,ptr+'/gate',dep);
   return {id:ns(r.nativeId),identity_ref:identity.evidence_id,horse_number:number,gate_number:gate,weight:null,margin:{winner_pointer:wc?packetMap.get(wc.evidenceId).pointer:null}};
  });
  if(target){events.push({event_id:ns(event),rows,registered_count:raw(null,'registered_count',rows.length,'/rows'),declared_active_count:raw(null,'declared_active_count',x.rows.filter(r=>r.status==='ACTIVE').length,'/rows/active'),actual_starters:null,conditions:null,geometry:null,relative:[]});}
  else events.push({event_id:ns(event),event_at:x.eventAt,rows,actual_starters:raw(null,'actual_starters',x.actualStarters,'/actualStarters'),conditions:raw(null,'conditions',{distance_m:x.distanceM},'/distanceM'),geometry:null,relative:[]});
 }
 const active=p.runners.filter(r=>r.status==='ACTIVE').map(r=>ns(r.nativeId));
 need(new Set(evidence.map(e=>e.evidence_id)).size===evidence.length,'ALIAS_DUPLICATE');
 const followups=p.followups.map(f=>({subject:ns(f.subject),opponent:ns(f.peer),reference_event:ns(f.priorEvent),followup_event:ns(f.laterEvent),ref:f.ref}));
 return {r:{scope:'WORK31_EXACT_SYNTHETIC_ONLY',cutoff:p.cutoff,measurement:{checkpoint_scope:null,clock_uncertainty_ms:null,snapshot_uncertainty_m:null}},o:{events,evidence,followups,active_ids:active},f:{active_ids:active,pairs:[]},packet:p,conflicts:[...conflicts]};
}
export function inspectV32(n){const v=verified(n);return {digest:v.digest,evidence:v.p.evidence.length,rows:v.p.runners.length,items:v.p.runners.reduce((s,r)=>s+r.items.length,0),available:v.p.runners.flatMap(r=>r.items).filter(i=>i.refs.length).length,packet:structuredClone(v.p),envelope:structuredClone(v.envelope)};}
export function analyzeV32(n,{withdraw=null,placeThreshold=null,candidate=null}={}){
 const v=verified(n,candidate),L=loadV31();assert.deepEqual(v.canonical,L.canonical.map(({item,name})=>({item,name})));
 need(L.diagnostics.groups===118&&L.diagnostics.held===826,'CANONICAL');
 const pack=adapt(v),p=v.p,ns=x=>p.issuer+'|'+x,all=new Map(pack.o.evidence.map(e=>[e.evidence_id,e]));
 need(withdraw===null||all.has(withdraw),'WITHDRAW');
 const {get,lineage}=dependencyReader(all,withdraw),ok=id=>!!get(id),refs=ids=>lineage(ids).map(e=>e.evidence_id);
 // Followup references must survive source dependencies and later classification.
 const classified=event=>p.evidence.find(e=>e.event===event&&e.field==='finish_classification');
 pack.o.followups=pack.o.followups.filter(z=>{const x=p.evidence.find(e=>e.evidenceId===z.ref),late=classified(x.value.laterEvent);return ok(z.ref)&&late&&ok(late.evidenceId);});
 const name='WORK31_'+n;L.cases.set(name,pack);
 const out=analyzeV30(L,name,withdraw,{placeThreshold});
 out.roster.unknown_slots=out.runners.filter(h=>h.status!=='CANCELLED'&&(!h.identity_known||h.status!=='ACTIVE')).map(h=>h.slot);
 const direct=out.direct,history=out.historical;
 const rawFind=(event,subject,field)=>p.evidence.find(e=>e.event===event&&e.subject===subject&&e.field===field);
 const live=e=>e&&ok(e.evidenceId);
 const observed=(event,h)=>history.find(x=>x.event===ns(event)&&x.horse===ns(h));
 const allRelations=fn=>out.roster.possible_active.flatMap((a,i)=>out.roster.possible_active.slice(i+1).map(b=>({a,b,...fn(a,b)})));
 const relations=p.histories.map(e=>{
  const pairs=direct.filter(x=>x.event===ns(e.event));
  const edges=allRelations((a,b)=>{const x=pairs.find(p=>[p.a,p.b].includes(a)&&[p.a,p.b].includes(b));return x?{order:x.order===a?'AHEAD':'BEHIND',refs:x.refs}:{order:'UNKNOWN',refs:[]};});
  return {event:e.event,scope:'HISTORICAL_ORDER_ONLY',field:jointField(out.roster.possible_active,edges,placeThreshold),refs:uniq(pairs.flatMap(x=>x.refs))};
 });
 const checkpoints=p.histories.map(e=>{
  const passing=rawFind(e.event,null,'passing_order'),usable=live(passing);
  const queue=out.roster.possible_active.map(slot=>{const h=out.runners.find(x=>x.slot===slot),native=slot.slice(p.issuer.length+1),card=p.runners.find(x=>x.nativeId===native),row=usable&&passing.measurement.roster.find(r=>r.nativeId===native),i=row&&h.identity_known&&h.status==='ACTIVE'&&live(rawFind(p.targetId,native,'current_card_row'))?passing.value.findIndex(g=>g.includes(row.no)):-1;return {slot,group:i>=0?i+1:null,refs:i>=0?refs([passing.evidenceId,card.cardRef]):[]};});
  const edges=allRelations((a,b)=>{const x=queue.find(x=>x.slot===a),y=queue.find(x=>x.slot===b);return {order:x.group===null||y.group===null||x.group===y.group?'UNKNOWN':x.group<y.group?'AHEAD':'BEHIND',refs:uniq([...x.refs,...y.refs])};});
  return {event:e.event,checkpoint_m:usable?passing.measurement.checkpointM:null,queue,field:jointField(out.roster.possible_active,edges),scope:'HISTORICAL_SINGLE_GROUPED_CHECKPOINT_ONLY',current_pace:null,finish_prediction:false};
 });
 const runnerOutput=out.runners.map(h=>{
  const native=h.slot.slice(p.issuer.length+1),status=h.status,known=h.identity_known&&status==='ACTIVE';
  const past=known?h.historical??[]:[],ownPairs=known?direct.filter(x=>x.a===h.slot||x.b===h.slot):[],findings=[];
  const note=(item,state,observation,ids)=>{const f={item,state,observation,refs:refs(ids),scope:state==='SINGLE_GROUPED_CHECKPOINT_NOT_POSITION_CHANGE'?'CANDIDATE_ONLY':'HISTORICAL_ONLY',formal:false,current_relevance:'UNPROVEN',independent_vote:false};if(f.refs.length)findings.push(f);};
  for(const a of past){
   const event=a.event.slice(p.issuer.length+1),f=rawFind(event,native,'finish'),clock=rawFind(event,native,'finish_clock'),terminal=rawFind(event,native,'individual_final600'),gap=rawFind(event,native,'winner_clock_difference'),passing=rawFind(event,null,'passing_order'),lap=rawFind(event,null,'race_leader_laps');
   if(live(f)&&a.finish!==null)note('RANK02','PAST_FINISH',a.finish,[f.evidenceId]);
   if(live(clock)&&a.clock!==null)note('RANK05','PAST_CLOCK',a.clock,[clock.evidenceId]);
   if(live(terminal)&&a.terminal_ms!==null)note('RANK06','REPORTED_FINAL600',a.terminal_ms,[terminal.evidenceId]);
   if(live(gap)&&a.margin_ms!==null&&a.margin_ms===gap.value)note('RANK03','ROUNDED_WINNER_CLOCK_DIFFERENCE',a.margin_ms,[gap.evidenceId]);
   if(live(lap)&&out.leaders.some(x=>x.event===a.event))note('RANK19','RACE_LEADER_LAPS',out.leaders.find(x=>x.event===a.event).segments,[lap.evidenceId]);
   if(live(passing)){const row=passing.measurement.roster.find(r=>r.nativeId===native),group=passing.value.findIndex(g=>g.includes(row?.no));if(group>=0)note('RANK18','SINGLE_GROUPED_CHECKPOINT_NOT_POSITION_CHANGE',{event,group:group+1,checkpoint_m:passing.measurement.checkpointM},[passing.evidenceId]);}
  }
  const rivalPaths=out.roster.possible_active.filter(s=>s!==h.slot).map(rival=>{
   const comparisons=ownPairs.filter(x=>x.a===rival||x.b===rival).map(x=>{
    const event=x.event.slice(p.issuer.length+1),other=rival.slice(p.issuer.length+1),a=observed(event,native),b=observed(event,other),rawPair=p.evidence.find(e=>e.event===event&&e.field==='historical_pair'&&[e.value.a,e.value.b].includes(native)&&[e.value.a,e.value.b].includes(other));
    const aa=rawFind(event,native,'individual_final600'),bb=rawFind(event,other,'individual_final600'),terminal=live(aa)&&live(bb)?signedGap(a?.terminal_ms,b?.terminal_ms):null;
    const ca=rawFind(event,native,'finish_clock'),cb=rawFind(event,other,'finish_clock');
    const endGap=signedGap(a?.clock,b?.clock),resolution=ca?.measurement?.resolutionMs;
    const sameInterval=live(aa)&&live(bb)&&aa.measurement.fromM===bb.measurement.fromM&&aa.measurement.toM===bb.measurement.toM;
    const startGap=terminal!==null&&endGap!==null&&sameInterval?endGap-terminal:null;
    const interval=startGap===null||!Number.isFinite(resolution)?null:{from_m:aa.measurement.fromM,to_m:aa.measurement.toM,start_advantage_ms:startGap,end_advantage_ms:endGap,reported_change_ms:terminal,conservative_resolution_bound_ms:2*resolution,state:terminal>2*resolution?'REPORTED_RELATIVE_CLOSURE':terminal< -2*resolution?'REPORTED_RELATIVE_LOSS':'WITHIN_REPORTED_RESOLUTION',scope:'DERIVED_FROM_TOTAL_AND_NATIVE_FINAL600_NOT_INDEPENDENT_CROSSING_MEASUREMENT',refs:refs([ca.evidenceId,cb.evidenceId,aa.evidenceId,bb.evidenceId]),pressure:null,current_relevance:'UNPROVEN'};
    const z={event,terminal_interval:interval,relation:x.order===h.slot?'AHEAD':'BEHIND',clock_advantage_ms:signedGap(a?.clock,b?.clock),final600_advantage_ms:terminal,rank_refs:x.refs,packet_pair_ref:live(rawPair)?rawPair.evidenceId:null,terminal_refs:terminal===null?[]:refs([aa.evidenceId,bb.evidenceId]),distance_m:(()=>{const c=pack.o.events.find(e=>e.event_id===x.event)?.conditions;return c&&ok(c.evidence_id)?c.value.distance_m:null;})()};
    note('RANK35','DIRECT_HISTORICAL_ORDER',z,[...x.refs,...(z.packet_pair_ref?[z.packet_pair_ref]:[])]);return z;
   });
   const a=comparisons[0],b=comparisons[1],reversal=!!a&&!!b&&a.relation!==b.relation;
   return {rival,comparisons,observed_reversal:reversal,advantage_change_ms:a?.clock_advantage_ms!=null&&b?.clock_advantage_ms!=null?b.clock_advantage_ms-a.clock_advantage_ms:null,condition_change:{distance:a&&b&&a.distance_m!==null&&b.distance_m!==null?a.distance_m!==b.distance_m:null,weight:null,going:null,class:null,gate:null,course:null,pace_response:null},causal_response:null,current_feasibility:'UNRESOLVED'};
  });
  const common=known?p.common.filter(c=>[c.a,c.b].includes(native)&&c.refs.every(ok)):[],follow=known?out.followups.filter(f=>f.subject===h.slot&&f.root):[];
  for(const c of common){const match=out.indirect.find(z=>z.peer===ns(c.peer)&&((z.a===ns(c.a)&&z.b===ns(c.b)&&z.events[0]===ns(c.eventA)&&z.events[1]===ns(c.eventB))||(z.b===ns(c.a)&&z.a===ns(c.b)&&z.events[1]===ns(c.eventA)&&z.events[0]===ns(c.eventB))));if(match)note('RANK36','COMMON_PEER_LOCATOR_NO_TRANSITIVE_ORDER', {peer:c.peer,events:[c.eventA,c.eventB],relative_finishes:match.a===ns(c.a)?match.relative_finishes:[...match.relative_finishes].reverse()},c.refs);}
  for(const f of follow){const source=pack.o.followups.find(z=>z.subject===f.subject&&z.opponent===f.peer&&z.reference_event===f.reference&&z.followup_event===f.event);if(source)note('RANK37','LATER_PEER_RESULT_NOT_STRENGTH', {peer:f.peer,event:f.event,finish:f.finish},[source.ref,...f.refs]);}
  const contrastFacts=known?rivalPaths.filter(x=>x.observed_reversal).map(x=>({item:'RANK35',state:'HISTORICAL_ORDER_REVERSAL_REFUTES_FIXED_PAIR_ORDER',observation:{rival:x.rival,events:x.comparisons.map(y=>y.event),advantage_change_ms:x.advantage_change_ms,condition_change:x.condition_change},refs:uniq(x.comparisons.flatMap(y=>y.rank_refs)),formal:false,current_relevance:'UNPROVEN'})):[];
  const axes=[['A',['RANK02','RANK03','RANK05','RANK06']],['B',[]],['C',['RANK35','RANK36','RANK37']],['D',['RANK19','RANK18']],['E',[]]].map(([axis,items])=>{
   const observed=known?(axis==='E'?contrastFacts:findings.filter(f=>items.includes(f.item))):[];
   const facts=observed.map(f=>({item:f.item,predicate:f.state,evidence_refs:f.refs,observation:f.observation,applicability:f.state==='SINGLE_GROUPED_CHECKPOINT_NOT_POSITION_CHANGE'?'CANDIDATE_ONLY':'HISTORICAL_ONLY'}));
   return {axis,state:status==='CANCELLED'?'NOT_APPLICABLE':!known?'UNKNOWN_IDENTITY_OR_STATUS':facts.length?'OBSERVED_CURRENT_RELEVANCE_UNPROVEN':'MISSING',facts,conditions_or_pace:known?(axis==='B'?h.condition_paths??[]:axis==='D'?h.pace_paths??[]:[]):[],current_support:[],current_counter:[],grade_effect:false};
  });
  const paths=known?relations.map(r=>({event:r.event,envelope:r.field.envelopes.find(x=>x.slot===h.slot)??null,scope:'IF_HISTORICAL_RELATIVE_ORDER_REPEATS',current_feasibility:'UNRESOLVED'})):[];
  const itemAudit=h.items.map(i=>{const f=known?findings.filter(f=>f.item===i.item):[];return {...i,refs:known?uniq([...i.refs,...f.flatMap(x=>x.refs)]):[],v32_findings:f,grade_effect_proven:false};});
  const eye_feedback=known?(h.review??[]).map(x=>({item:x.item,targets:x.targets,refs:x.refs,state:'HISTORICAL_REVIEW_ONLY',returned_to_current_analysis:false,conditional_path_effect:false,independent_vote:false})):[];
  return {slot:h.slot,status,identity_known:h.identity_known,findings_v32:findings,rival_paths:known?rivalPaths:[],paths,axes,eye_feedback,items:itemAudit,WIN:known?{state:'UNRESOLVED',paths,unknown_rivals:rivalPaths.filter(x=>!x.comparisons.length).map(x=>x.rival)}:null,PLACE:known?{state:placeThreshold===null?'THRESHOLD_UNSPECIFIED':'UNRESOLVED',threshold:placeThreshold,paths:placeThreshold===null?[]:paths}:null,grade:null,formal:false};
 });
 return {schema:'REBORN2_COMMON_ANALYSIS_TO_CODEX_AXES_V32_RESEARCH',source_digest:v.digest,source_evidence:p.evidence.length,source_item_rows:p.runners.length*115,roster:out.roster,history:out.historical,direct:out.direct,leaders:out.leaders,relations,checkpoints,shared_scenarios:out.shared_scenarios_v30,runners:runnerOutput,clock_conflicts:pack.conflicts,formal:false,grade:null,core:'analyzeV30->V29->V28->V27',groups:118,held:826};
}
