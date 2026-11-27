// Research-only canonical supply contract. No official acquisition or grades.
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=m=>{throw Error(m)}, need=(v,m)=>{if(!v)fail(m)}, int=Number.isSafeInteger;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b), unique=a=>new Set(a).size===a.length;
const exact=(o,k,m)=>need(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...k].sort().join('|'),m);
const id=x=>typeof x==='string'&&/^TEST:[A-Za-z0-9_-]+$/.test(x);
const date=x=>{need(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x),'INVALID_TIME');const t=Date.parse(x);need(Number.isFinite(t)&&new Date(t).toISOString()===x,'INVALID_TIME');return t;};
const iso=n=>new Date(n*1000).toISOString();
const base=['kind','issuer','eventId','version','publishedAt','updatedAt','rows','conditions','geometry'];
const conditions=['distance_m','surface','going','venue','class_label','class_version','effective_from','effective_until'];
const geometry=['direction','first_turn_m','straight_m','checkpoints_m','course_version','effective_from','effective_until'];
const safeLabel=x=>typeof x==='string'&&/^(?:TEST:[A-Za-z0-9_-]+|DIRT|TURF|RIGHT|LEFT|STRAIGHT|TEST_LITERAL)$/.test(x);
export function validateLeader(rows,cps,distance,values,boundaries,clockKey='clockMs',cpKey='checkpointMs'){
 need(Array.isArray(rows)&&rows.length>0&&Array.isArray(cps)&&cps.length>0&&cps.every((x,i)=>int(x)&&x>(cps[i-1]??0)&&x<distance),'CHECKPOINT_GEOMETRY');
 need(eq(boundaries,[0,...cps,distance])&&values.length===cps.length+1,'LAP_GEOMETRY');
 let cumulative=0;for(const [i,l] of values.entries()){need(int(l)&&l>0,'LAP_VALUE');cumulative+=l;need(cumulative===Math.min(...rows.map(r=>i===cps.length?r[clockKey]:r[cpKey][i])),'LEADER_CROSSING_'+boundaries[i+1]);}
}
function validateDoc(d){
 const card=d.kind==='TARGET_CARD';
 need(card||d.kind==='HISTORICAL_RESULT','DOCUMENT_KIND');exact(d,card?[...base,'scheduledPost']:[...base,'eventAt','distanceM','registeredCount','actualStarters','precisionMs','leaderLaps','passing'],'DOCUMENT_FIELDS');
 need(['TEST:NAR','TEST:JRA'].includes(d.issuer)&&id(d.eventId)&&d.version===1,'IDENTITY_VERSION');
 need([d.publishedAt,d.updatedAt].every(int)&&0<=d.publishedAt&&d.publishedAt<=d.updatedAt,'SOURCE_TIME');
 const when=card?d.scheduledPost:d.eventAt;
 need(int(when)&&when>=0&&(card?d.updatedAt<when:when<d.publishedAt),'EVENT_TIME');
 exact(d.conditions,conditions,'CONDITIONS_FIELDS');exact(d.geometry,geometry,'GEOMETRY_FIELDS');
 const c=d.conditions,g=d.geometry,cp=g.checkpoints_m;
 need(int(c.distance_m)&&c.distance_m>600&&[c.surface,c.going,c.venue,c.class_label,c.class_version,g.direction,g.course_version].every(safeLabel),'CONDITIONS');
 for(const x of [c,g])need(int(x.effective_from)&&int(x.effective_until)&&x.effective_from<=when&&when<x.effective_until,'CONDITION_EFFECTIVE_TIME');
 need([g.first_turn_m,g.straight_m].every(v=>int(v)&&v>=0&&v<=c.distance_m)&&Array.isArray(cp)&&cp.length>0&&cp.every((v,i)=>int(v)&&v>(cp[i-1]??0)&&v<c.distance_m)&&cp.includes(c.distance_m-600),'GEOMETRY');
 need(Array.isArray(d.rows)&&d.rows.length>=2&&unique(d.rows.map(r=>r.nativeId))&&unique(d.rows.map(r=>r.no)),'ROSTER');
 for(const r of d.rows){
  exact(r,card?['nativeId','no','status','gate','weightG']:['nativeId','no','status','gate','weightG','finish','clockMs','final600Ms','checkpointMs','checkpointRanks','officialMargin'],'ROW_FIELDS');
  need(id(r.nativeId)&&int(r.no)&&r.no>0&&int(r.gate)&&r.gate>0&&r.gate<=d.rows.length&&int(r.weightG)&&r.weightG>0,'ROW_IDENTITY');
  need(card?['ACTIVE','CANCELLED','UNKNOWN'].includes(r.status):r.status==='FINISHED','ROW_STATUS');
  if(!card){need(Array.isArray(r.checkpointMs)&&r.checkpointMs.length===cp.length&&[...r.checkpointMs,r.clockMs].every((v,i,a)=>int(v)&&v>(a[i-1]??0)),'INDIVIDUAL_CLOCK');need(r.clockMs-r.checkpointMs[cp.indexOf(c.distance_m-600)]===r.final600Ms,'FINAL600_MISMATCH');need(r.finish===1+d.rows.filter(q=>q.clockMs<r.clockMs).length,'FINISH_CLOCK_ORDER');need(eq(r.checkpointRanks,r.checkpointMs.map((v,i)=>1+d.rows.filter(q=>q.checkpointMs[i]<v).length)),'CHECKPOINT_RANK');need(r.finish===1?r.officialMargin===null:safeLabel(r.officialMargin),'MARGIN_LITERAL');}
 }
 if(!card){need(d.distanceM===c.distance_m&&d.registeredCount===d.rows.length&&d.actualStarters===d.rows.length&&int(d.precisionMs)&&d.precisionMs>=0,'STARTERS_PRECISION');
  exact(d.leaderLaps,['unit','scope','boundariesM','valuesMs'],'LAP_FIELDS');need(d.leaderLaps.unit==='ms'&&d.leaderLaps.scope==='RACE_LEADER','LAP_SCOPE');validateLeader(d.rows,cp,d.distanceM,d.leaderLaps.valuesMs,d.leaderLaps.boundariesM);
  exact(d.passing,['checkpointM','groups','semantics'],'PASSING_FIELDS');const j=cp.indexOf(d.passing.checkpointM);need(j>=0&&d.passing.semantics==='SOURCE_GROUPED_ORDER'&&Array.isArray(d.passing.groups)&&d.passing.groups.every(a=>Array.isArray(a)&&a.length>0),'PASSING');
  const order=d.passing.groups.flat();need(order.length===d.rows.length&&unique(order)&&order.every(n=>d.rows.some(r=>r.no===n)),'PASSING_ROSTER');const clocks=order.map(n=>d.rows.find(r=>r.no===n).checkpointMs[j]);need(clocks.every((v,i)=>i===0||v>=clocks[i-1]),'PASSING_ORDER');
 }
}
export function source(d,{captureAt=76,uncertaintyMs=1000}={}){
 const bytes=JSON.stringify(d);return {raw:bytes,sha256:sha(bytes),issuer:d.issuer,eventId:d.eventId,version:d.version,publishedAt:iso(d.publishedAt),updatedAt:iso(d.updatedAt),capturedAt:iso(captureAt),uncertaintyMs};
}
export function makeEnvelope(docs){return {schema:'REBORN2_WORK41_SUPPLY_0.3',scope:'SYNTHETIC_ONLY',cutoff:iso(90),scheduledPost:iso(docs[0].scheduledPost),documents:docs.map(d=>source(d))};}
export function validateEnvelope(e){
 exact(e,['schema','scope','cutoff','scheduledPost','documents'],'ENVELOPE_FIELDS');need(e.schema==='REBORN2_WORK41_SUPPLY_0.3'&&e.scope==='SYNTHETIC_ONLY','SCOPE');
 const cut=date(e.cutoff),post=date(e.scheduledPost);
 // Common producer 31 has a fixed synthetic clock; do not pretend it supports real timestamps.
 need(cut===90000&&post===100000&&cut<post,'COMMON_SYNTHETIC_CLOCK');
 need(Array.isArray(e.documents)&&e.documents.length>0,'DOCUMENTS');
 const docs=[],roots=[],seen=new Set();
 for(const s of e.documents){
  exact(s,['raw','sha256','issuer','eventId','version','publishedAt','updatedAt','capturedAt','uncertaintyMs'],'SOURCE_FIELDS');
  need(typeof s.raw==='string'&&/^[\x00-\x7f]+$/.test(s.raw)&&s.raw.length<100000&&sha(s.raw)===s.sha256,'RAW_HASH');
  const d=JSON.parse(s.raw);need(eq(JSON.stringify(d),s.raw),'RAW_CANONICAL_BYTES');validateDoc(d);
  need(s.issuer===d.issuer&&s.eventId===d.eventId&&s.version===d.version,'RAW_IDENTITY_BINDING');
  const p=date(s.publishedAt),u=date(s.updatedAt),a=date(s.capturedAt);need(p===d.publishedAt*1000&&u===d.updatedAt*1000,'RAW_TIME_BINDING');
  need(int(s.uncertaintyMs)&&s.uncertaintyMs>=0&&p<=u&&u<=a&&a+s.uncertaintyMs<=cut&&a+s.uncertaintyMs<post,'SOURCE_TIME_BOUND');
  // The existing producer seals at t=77 with 1 s uncertainty; no silent chronology translation.
  need(a===76000&&s.uncertaintyMs===1000&&u<=75000,'COMMON_CAPTURE_CLOCK');
  need(!seen.has(d.eventId),'EVENT_DUPLICATE');seen.add(d.eventId);docs.push(d);
  const root=sha(JSON.stringify([d.issuer,d.eventId,d.version,s.sha256,'/']));roots.push({id:root,issuer:d.issuer,eventId:d.eventId,version:d.version,pointer:'/',rawSha256:s.sha256,depends:[]});
  for(const [i,r] of d.rows.entries()){const pointer='/rows/'+i;roots.push({id:sha(JSON.stringify([root,pointer,r.nativeId,r.no])),issuer:d.issuer,eventId:d.eventId,horseId:r.nativeId,no:r.no,pointer,rawSha256:s.sha256,depends:[root]});}
 }
 const card=docs[0];need(card.kind==='TARGET_CARD'&&card.scheduledPost*1000===post&&docs.filter(d=>d.kind==='TARGET_CARD').length===1&&docs.every(d=>d.issuer===card.issuer),'TARGET_CARD');
 need(docs.slice(1).every(d=>d.eventId!==card.eventId&&d.eventAt*1000<cut),'TARGET_RESULT_LEAK');
 return {docs,roots,analysisSha256:sha(JSON.stringify(e))};
}
const match=(a,b,keys)=>keys.every(k=>eq(a[k],b[k]));
const conditionKeys=conditions.slice(0,6),courseKeys=geometry.slice(0,5);
const first=r=>r.checkpointRanks[0]<=3;
const sameContext=(a,b)=>match(a.conditions,b.conditions,conditionKeys)&&match(a.geometry,b.geometry,courseKeys);
function metrics(d,r){return {event:d.eventId,finish:r.finish,gap:r.clockMs-Math.min(...d.rows.map(q=>q.clockMs)),early:r.checkpointRanks[0],positions:r.checkpointRanks,late:r.final600Ms,clock:r.clockMs,precision:d.precisionMs,gate:r.gate,weight:r.weightG};}
// Category-specific raw facts, not assertions of benefit. Unknown/contradictory
// conditions remain explicit; labels here never determine a grade.
export function eyeSupply({docs,roots}){
 const card=docs[0],history=docs.slice(1).sort((a,b)=>a.eventAt-b.eventAt),root=(d,h=null)=>roots.find(x=>x.eventId===d.eventId&&(h===null?x.pointer==='/':x.horseId===h))?.id;
 const references=(pairs)=>[...new Set(pairs.flatMap(([d,h])=>[root(d),...(h?[root(d,h)]:[])]).filter(Boolean))].sort();
 const entry=(category,observations,missing)=>({category,observations:[...new Map(observations.map(o=>[JSON.stringify([o.kind,o.refs,o.values]),o])).values()],missing:[...new Set(missing)],formal:false});
 return card.rows.map(target=>{
  const h=target.nativeId, own=history.filter(d=>d.rows.some(r=>r.nativeId===h)),last=own.at(-1),lr=last?.rows.find(r=>r.nativeId===h);
  const currentFront=card.rows.map(r=>({horse:r.nativeId,gate:r.gate,last:history.filter(d=>d.rows.some(q=>q.nativeId===r.nativeId)).at(-1)})).map(q=>({...q,row:q.last?.rows.find(r=>r.nativeId===q.horse)}));
  const fieldRefs=[[card,null],...currentFront.filter(q=>q.last).map(q=>[q.last,q.horse])];
  const o=Array.from({length:15},()=>[]),m=Array.from({length:15},()=>[]);
  const put=(i,kind,values,pairs)=>o[i-1].push({kind,values,refs:references(pairs)});
  const missing=(i,v)=>m[i-1].push(v);
  for(const d of own){const r=d.rows.find(q=>q.nativeId===h),v=metrics(d,r),p=[[d,h]],context=sameContext(d,card);
   put(1,'FINISH_AND_WINNER_CLOCK_GAP',{finish:v.finish,gap_ms:v.gap,error_ms:2*v.precision,context},p);
   put(2,'FINISH_VS_SECTION_CONTENT',{finish:v.finish,late_ms:v.late,field_late_ms:d.rows.map(q=>q.final600Ms),positions:v.positions},p);
   put(3,'BACKWARD_THEN_FORWARD_ORDER',{positions:v.positions,finish:v.finish,recovered:r.finish<Math.max(...r.checkpointRanks)&&r.checkpointRanks.some((x,i)=>i>0&&x>Math.min(...r.checkpointRanks.slice(0,i)))},p);
   for(const peer of d.rows.filter(q=>q.nativeId!==h&&q.clockMs<r.clockMs)){
    const later=history.filter(x=>x.eventAt>d.eventAt&&x.rows.some(q=>q.nativeId===peer.nativeId));
    put(4,'DEFEAT_GAP_AND_PEER_FOLLOWUP',{peer:peer.nativeId,gap_ms:r.clockMs-peer.clockMs,peer_finish:peer.finish,later:later.map(x=>({event:x.eventId,class:x.conditions.class_label,finish:x.rows.find(q=>q.nativeId===peer.nativeId).finish}))},[[d,h],[d,peer.nativeId],...later.map(x=>[x,peer.nativeId])]);
    for(const x of later)put(5,'LATER_PEER_RESULT',{peer:peer.nativeId,prior_event:d.eventId,later_event:x.eventId,finish:x.rows.find(q=>q.nativeId===peer.nativeId).finish,class:x.conditions.class_label},[[d,h],[d,peer.nativeId],[x,peer.nativeId]]);
   }
   put(6,'OBSERVED_EARLY_COMPETITION_AND_LATE_RESPONSE',{early_ms:r.checkpointMs[0],leader_ms:d.leaderLaps.valuesMs[0],close_front:d.rows.filter(q=>q.nativeId!==h&&Math.abs(q.checkpointMs[0]-r.checkpointMs[0])<=2*d.precisionMs).map(q=>q.nativeId),late_ms:r.final600Ms,finish:r.finish},[[d,h],...d.rows.map(q=>[d,q.nativeId])]);
   put(7,'DISTANCE_GOING_RETURN',{past_distance:d.distanceM,current_distance:card.conditions.distance_m,past_going:d.conditions.going,current_going:card.conditions.going,finish:r.finish,gap_ms:v.gap},[[d,h],[card,h]]);
   put(8,'COURSE_GEOMETRY_RESPONSE',{past_course:d.geometry.course_version,current_course:card.geometry.course_version,past_straight:d.geometry.straight_m,current_straight:card.geometry.straight_m,past_venue:d.conditions.venue,current_venue:card.conditions.venue,finish:r.finish},[[d,h],[card,h]]);
   put(11,'PAST_FRONT_RIVALS',{past_front:d.rows.filter(q=>q.nativeId!==h&&first(q)).map(q=>q.nativeId),current_roster:card.rows.filter(q=>q.status==='ACTIVE').map(q=>q.nativeId),finish:r.finish},[[d,h],...d.rows.map(q=>[d,q.nativeId]),[card,null]]);
   put(12,'GATE_AND_OBSERVED_EARLY_ROLE',{past_gate:r.gate,current_gate:target.gate,past_first_rank:r.checkpointRanks[0],past_first_ms:r.checkpointMs[0]},[[d,h],[card,h]]);
   put(14,'CLASS_AND_OPPONENT_MEMBERSHIP',{past_class:d.conditions.class_label,current_class:card.conditions.class_label,past_peers:d.rows.filter(q=>q.nativeId!==h).map(q=>q.nativeId),current_peers:card.rows.filter(q=>q.nativeId!==h).map(q=>q.nativeId)},[[d,h],[card,null]]);
   put(15,'MULTI_CONDITION_MATCH',{dimensions:conditionKeys.filter(k=>eq(d.conditions[k],card.conditions[k])),changed:conditionKeys.filter(k=>!eq(d.conditions[k],card.conditions[k])),course_match:match(d.geometry,card.geometry,courseKeys),weight_match:r.weightG===target.weightG,gate_match:r.gate===target.gate,finish:r.finish},[[d,h],[card,h]]);
  }
  for(const [i,d] of own.entries())for(const later of own.slice(i+1)){if(!sameContext(d,later))continue;const a=d.rows.find(q=>q.nativeId===h),b=later.rows.find(q=>q.nativeId===h);put(13,'MATCHED_SECTION_TIME_CHANGE',{earlier:d.eventId,later:later.eventId,finish_change:b.finish-a.finish,late_delta_ms:b.final600Ms-a.final600Ms,clock_delta_ms:b.clockMs-a.clockMs,error_ms:d.precisionMs+later.precisionMs},[[d,h],[later,h]]);}
  const known=currentFront.filter(q=>q.row&&card.rows.find(r=>r.nativeId===q.horse).status==='ACTIVE'),front=known.filter(q=>first(q.row));
  put(9,'FIELD_EARLY_ROLE_OCCUPANCY',{known:known.length,active:card.rows.filter(q=>q.status==='ACTIVE').length,observed_front:front.map(q=>q.horse),ratio:known.length?front.length/known.length:null},fieldRefs);
  const flank=currentFront.filter(q=>Math.abs(q.gate-target.gate)===1&&card.rows.find(r=>r.nativeId===q.horse).status==='ACTIVE');put(10,'ADJACENT_GATE_EARLY_ROLE',{gate:target.gate,flanks:flank.map(q=>({horse:q.horse,gate:q.gate,front:q.row?first(q.row):null}))},[[card,h],...flank.flatMap(q=>[[card,q.horse],...(q.last?[[q.last,q.horse]]:[])])]);
  for(let i=1;i<=15;i++)if(!o[i-1].length)missing(i,'NO_LINKED_OBSERVATION');
  for(const [i,v] of [[4,'PEER_STRENGTH_SCALE_UNVERIFIED'],[6,'CAUSAL_TROUBLE_AND_CURRENT_RESOLUTION_UNOBSERVED'],[8,'ISOLATED_COURSE_EFFECT_UNPROVEN'],[9,'CURRENT_PACE_AND_BENEFIT_UNOBSERVED'],[10,'CURRENT_FLANK_INTERACTION_UNOBSERVED'],[11,'CURRENT_ROLE_UNOBSERVED'],[12,'CURRENT_POSITION_UNOBSERVED'],[13,'CAUSAL_ABILITY_CHANGE_UNPROVEN'],[14,'CLASS_STRENGTH_ORDER_UNVERIFIED'],[15,'JOINT_CAUSAL_BENEFIT_UNPROVEN']])missing(i,v);
  if(!last)for(let i=1;i<=15;i++)missing(i,'NO_HORSE_HISTORY');
  return {horse:h,status:target.status,categories:o.map((a,i)=>entry('EYE'+String(i+1).padStart(2,'0'),a,m[i]))};
 });
}
