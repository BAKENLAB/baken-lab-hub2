import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha,validateEnvelope} from './validate-v0.4.mjs';
const canon=JSON.parse(readFileSync(new URL('./canonical-eye.json',import.meta.url)));
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const groups=[[2,3,28,29],range(17,32),[18,21,22,24,27],[3,28,29,33,34,38],[34,37,38,40],[20,...range(23,27),31,65,...range(69,75),96],[...range(43,57),93,95,99],[45,46,...range(49,53),93],[...range(58,65),69,...range(73,75)],[59,60,64,...range(66,70),73],[...range(60,65),...range(68,75)],[...range(58,75),53,67,93],[...range(13,15),...range(17,32),98,99],[...range(33,42),93,95],range(93,99)];
export const definitions=canon.eye.items.map((v,i)=>({category:'EYE'+v.id,name:v.name,upstream_item_ids:[...new Set(groups[i])].sort((a,b)=>a-b).map(n=>'RANK'+String(n).padStart(2,'0'))}));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),finite=Number.isFinite,sort=x=>[...new Set(x)].sort();
const rows=(d,h)=>d?.rows.find(r=>r.nativeId===h);
const cond=['distance_m','surface','going','venue','class_label','class_version'];
const geo=['direction','first_turn_m','straight_m','checkpoints_m','course_version'];
const compare=(a,b,keys)=>!a||!b||keys.some(k=>a[k]==null||b[k]==null)?'UNKNOWN':keys.every(k=>eq(a[k],b[k]))?'MATCHED':'CHANGED';
const role=r=>!r?.checkpointRanks?'UNKNOWN':r.checkpointRanks.some(x=>x<=3)?'FRONT_OBSERVED':'NON_FRONT_OBSERVED';
const gap=(d,r)=>!finite(r?.clockMs)||!d.rows.every(q=>finite(q.clockMs))?null:r.clockMs-Math.min(...d.rows.map(q=>q.clockMs));
const context=(a,b)=>{const v=[compare(a.conditions,b.conditions,cond),compare(a.geometry,b.geometry,geo)];return v.includes('UNKNOWN')?'UNKNOWN':v.includes('CHANGED')?'CHANGED':'MATCHED';};
const stance=(p,c)=>p?'SUPPORT_ANTECEDENT':c?'COUNTER_ANTECEDENT':'NEUTRAL';
// Enumerate only feasible count ranges, no assigning UNKNOWN to cancelled/non-front.
export function frontBounds(roster){
 const a=roster.filter(r=>r.status==='ACTIVE'),u=roster.filter(r=>r.status==='UNKNOWN');
 const af=a.filter(r=>r.role==='FRONT_OBSERVED').length,ax=a.filter(r=>r.role==='UNKNOWN').length;
 const uf=u.filter(r=>r.role==='FRONT_OBSERVED').length,un=u.filter(r=>r.role==='NON_FRONT_OBSERVED').length,ux=u.filter(r=>r.role==='UNKNOWN').length;
 const lowN=a.length+un+ux,highN=a.length+uf+ux;
 return {knownActive:a.length,possibleActive:a.length+u.length,frontCount:[af,af+ax+uf+ux],ratioBounds:[lowN?af/lowN:0,highN?(af+ax+uf+ux)/highN:0],statusUnknown:u.map(r=>r.horse),roleUnknown:roster.filter(r=>r.status!=='CANCELLED'&&r.role==='UNKNOWN').map(r=>r.horse),emptyPossible:a.length===0};
}
export function flankState(roster,subject){
 if(subject.status!=='ACTIVE'||subject.gate===null)return {state:'UNKNOWN',flanks:[],missing:['SUBJECT_STATUS_OR_GATE']};
 const possible=roster.filter(r=>r.status!=='CANCELLED'&&r.horse!==subject.horse);
 const unknownGate=possible.filter(r=>r.gate===null);
 const flanks=[-1,1].map(delta=>possible.filter(r=>r.gate===subject.gate+delta));
 const state=unknownGate.length||flanks.some(g=>g.some(r=>r.status==='UNKNOWN'||r.role==='UNKNOWN')||g.length>1)?'UNKNOWN':flanks.every(g=>g.length===1&&g[0].role==='FRONT_OBSERVED')?'BOTH_FRONT_OBSERVED':'NOT_BOTH_FRONT';
 return {state,flanks,missing:state==='UNKNOWN'?['FLANK_STATUS_ROLE_OR_GATE_UNRESOLVED']:[]};
}
export function rivalBounds(previous,now,subject){
 const old=previous.filter(r=>r.horse!==subject),cur=now.filter(r=>r.horse!==subject);
 const oldMin=old.filter(r=>r.role==='FRONT_OBSERVED').length,oldMax=oldMin+old.filter(r=>r.role==='UNKNOWN').length;
 const newMin=cur.filter(r=>r.status==='ACTIVE'&&r.role==='FRONT_OBSERVED').length,newMax=cur.filter(r=>r.status!=='CANCELLED'&&r.role!=='NON_FRONT_OBSERVED').length;
 return {previous:[oldMin,oldMax],current:[newMin,newMax],unknown:cur.filter(r=>r.status==='UNKNOWN'||r.status==='ACTIVE'&&r.role==='UNKNOWN').map(r=>r.horse),newPossible:cur.filter(r=>r.status!=='CANCELLED'&&r.role!=='NON_FRONT_OBSERVED'&&!old.some(o=>o.horse===r.horse&&o.role==='FRONT_OBSERVED')).map(r=>r.horse),reduction:newMax<oldMin?'PROVEN_COUNT_REDUCTION':newMin>=oldMax?'NO_COUNT_REDUCTION':'UNRESOLVED'};
}
export function sectionContrast(a,b,h){
 const x=rows(a,h),y=rows(b,h),c=context(a,b),samePeers=eq(sort(a.rows.map(r=>r.nativeId)),sort(b.rows.map(r=>r.nativeId)));
 const fieldKnown=x&&y&&x.gate!==null&&y.gate!==null&&x.weightG!==null&&y.weightG!==null;
 const personal=fieldKnown?(x.gate===y.gate&&x.weightG===y.weightG?'MATCHED':'CHANGED'):'UNKNOWN';
 const pace=a.leaderLaps&&b.leaderLaps?{a:a.leaderLaps.valuesMs,b:b.leaderLaps.valuesMs}:null;
 const delta=finite(x?.final600Ms)&&finite(y?.final600Ms)?y.final600Ms-x.final600Ms:null,u=a.precisionMs+b.precisionMs;
 const rankDelta=finite(x?.finish)&&finite(y?.finish)?y.finish-x.finish:null;
 const section=delta===null?'UNKNOWN':delta< -u?'IMPROVED':delta>u?'WORSENED':'WITHIN_UNCERTAINTY';
 const placing=rankDelta===null?'UNKNOWN':rankDelta<0?'IMPROVED':rankDelta>0?'WORSENED':'UNCHANGED';
 const comparable=c==='MATCHED'&&samePeers&&personal==='MATCHED'&&pace!==null;
 const status=!comparable?(c==='CHANGED'||!samePeers||personal==='CHANGED'?'IRRELEVANT_CONDITION':'UNKNOWN'):section==='IMPROVED'&&['WORSENED','UNCHANGED'].includes(placing)?'SUPPORT_ANTECEDENT':section==='WORSENED'?'COUNTER_ANTECEDENT':section==='UNKNOWN'||placing==='UNKNOWN'?'UNKNOWN':'NEUTRAL';
 return {section,placing,section_delta_ms:delta,rank_delta:rankDelta,bound_ms:u,context:c,samePeers,personal,pace,comparable,status};
}
// Native evidence identities are field-specific and retain upstream dependency closure.
export function buildSupply(envelope,packet){
 const validated=validateEnvelope(envelope),{docs,roots}=validated,card=docs[0],history=docs.slice(1).sort((a,b)=>a.eventAt-b.eventAt);
 const ev=new Map(packet.evidence.map(e=>[e.evidenceId,e]));assert.equal(ev.size,packet.evidence.length);
 const allIds=new Set(ev.keys());
 const closure=ids=>{const found=new Set();function visit(id){if(found.has(id))return;assert.ok(ev.has(id),'UNBOUND_NATIVE_ID');found.add(id);for(const d of ev.get(id).dependencies)visit(d);}ids.forEach(visit);return [...found].sort();};
 const native=(d,h,fields)=>packet.evidence.filter(e=>e.event===d.eventId&&e.subject===h&&fields.includes(e.field)).map(e=>e.evidenceId);
 const rref=(d,h)=>roots.find(r=>r.eventId===d.eventId&&(h===null?r.pointer==='/':r.horseId===h))?.id;
 const current=card.rows.map(r=>{const last=history.filter(d=>rows(d,r.nativeId)).at(-1);return {horse:r.nativeId,status:r.status,gate:r.gate,role:role(rows(last,r.nativeId)),last};});
 const pfield=['checkpoint_ms','ranks','finish','finish_clock','individual_final600','winner_clock_difference','historical_row','gate_number','weight_grams'];
 const dfield=['conditions','geometry','race_leader_laps','passing_order','finish_classification'];
 const fieldSpec=d=>[[d,null,dfield],...d.rows.map(r=>[d,r.nativeId,pfield])];
 const cardSpec=()=>[[card,null,['conditions','geometry']],...card.rows.map(r=>[card,r.nativeId,['current_card_row','gate_number','weight_grams']])];
 const roleSpec=()=>[...cardSpec(),...current.filter(r=>r.last).flatMap(r=>[[r.last,r.horse,['ranks','checkpoint_ms','historical_row']]])];
 const mk=(h,i,mechanism,values,status,spec,missing=[],scenario_conditions=[])=>{
  const refs=sort(spec.flatMap(([d,horse,fields])=>native(d,horse,fields))),sourceRefs=sort(spec.map(([d,horse])=>rref(d,horse)).filter(Boolean)),evidence_ids=closure(refs);
  const category=definitions[i-1],claim_id=sha(JSON.stringify([h,category.category,mechanism,sourceRefs,values]));
  const cardBound=spec.some(([d])=>d===card);
  return {claim_id,eye_item_id:category.category,horse_id:card.issuer+'|'+h,upstream_item_ids:category.upstream_item_ids,mechanism_group:mechanism,observed_facts:values,evidence_ids,source_root_ids:sourceRefs,current_relevance:status==='IRRELEVANT_CONDITION'?'OTHER_CONTEXT':cardBound?'CARD_LINKED_ANTECEDENT_NOT_CURRENT_OUTCOME':'HISTORICAL_ONLY',status:refs.length?status:'UNKNOWN',support:status==='SUPPORT_ANTECEDENT'?refs:[],counter:status==='COUNTER_ANTECEDENT'?refs:[],unknowns:missing,scenario_conditions,independent_vote:false,grade_effect:false,formal:false};
 };
 const roster=current.map(({last,...r})=>r);
 const runners=card.rows.map(t=>{
  const h=t.nativeId,own=history.filter(d=>rows(d,h)),last=own.at(-1),claims=Array.from({length:15},()=>[]);
  const put=(i,m,v,s,spec,missing=[],scenario=[])=>claims[i-1].push(mk(h,i,m,v,s,spec,missing,scenario));
  for(const d of own){
   const r=rows(d,h),g=gap(d,r),ctx=context(d,card),spec=fieldSpec(d),linked=[...spec,...cardSpec()];
   const base={event:d.eventId,finish:r.finish,fieldSize:d.rows.length,gap_ms:g,error_ms:2*d.precisionMs,context:ctx};
   // No canonical fixed narrow-gap threshold: observed gap only, overlapping clocks are not proof.
   put(1,'FINISH_MARGIN_RELATION',base,g===null||r.finish===null?'UNKNOWN':r.finish===1?'NOT_APPLICABLE':g<=2*d.precisionMs?'SUPPORT_ANTECEDENT':'RELEVANT_FACT',spec,['SAME_CLASS_GAP_DISTRIBUTION_AND_FIELD_STRENGTH_REQUIRED']);
   const lateRank=finite(r.final600Ms)&&d.rows.every(q=>finite(q.final600Ms))?1+d.rows.filter(q=>q.final600Ms<r.final600Ms).length:null;
   put(2,'RESULT_VS_SECTION',{...base,lateRank,positions:r.checkpointRanks},lateRank===null||r.finish===null?'UNKNOWN':stance(lateRank<r.finish,lateRank>r.finish),spec,['TROUBLE_AND_LOAD_NOT_OBSERVED']);
   const ranks=r.checkpointRanks,back=ranks?.some((v,i)=>i>0&&v>Math.min(...ranks.slice(0,i))),rec=!!(back&&finite(r.finish)&&r.finish<Math.max(...ranks));
   put(3,'BACKWARD_AND_RECOVERY',{...base,positions:ranks,back:back??null,recovered:rec},!ranks||r.finish===null?'UNKNOWN':stance(rec,back&&!rec),spec,['CAUSE_AND_CURRENT_REPEAT_UNPROVEN']);
   for(const p of d.rows.filter(q=>q.nativeId!==h)){
    const later=history.filter(x=>x.eventAt>d.eventAt&&rows(x,p.nativeId));
    const diff=finite(r.clockMs)&&finite(p.clockMs)?r.clockMs-p.clockMs:null;
    if(diff!==null&&diff>0)put(4,'PEER_DEFEAT_AND_LEVEL',{event:d.eventId,peer:p.nativeId,gap_ms:diff,peer_finish:p.finish,later:later.map(x=>({event:x.eventId,finish:rows(x,p.nativeId).finish,class:x.conditions?.class_label??null}))},'UNKNOWN',[...spec,...later.flatMap(fieldSpec)],['INDEPENDENT_PEER_STRENGTH_AND_GAP_DISTRIBUTION_REQUIRED']);
    for(const x of later){const q=rows(x,p.nativeId);put(5,'PEER_LATER_RESULT',{event:d.eventId,peer:p.nativeId,prior_finish:p.finish,own_finish:r.finish,later_event:x.eventId,later_finish:q.finish,class:x.conditions?.class_label??null},q.finish===null?'UNKNOWN':stance(q.finish===1,q.finish>1),[...spec,...fieldSpec(x)],['CURRENT_RELEVANCE_NOT_ESTABLISHED']);}
   }
   if(d===last){const close=finite(r.checkpointMs?.[0])?d.rows.filter(q=>q.nativeId!==h&&finite(q.checkpointMs?.[0])&&Math.abs(q.checkpointMs[0]-r.checkpointMs[0])<=2*d.precisionMs).map(q=>q.nativeId):null;put(6,'LAST_EARLY_CONTEST_AND_CURRENT_ALTERNATIVES',{event:d.eventId,close,late:r.final600Ms,roster},'UNKNOWN',[...linked,...roleSpec()],['OBSERVED_TROUBLE_OR_CAUSAL_LOAD_AND_CURRENT_PACE_REQUIRED']);}
   const dc=compare(d.conditions,card.conditions,['distance_m','surface','going']),gc=compare(d.geometry,card.geometry,geo);
   put(7,'RETURN_CONDITION_RESPONSE',{...base,distanceGoing:dc,prior_to_current:last?compare(last.conditions,card.conditions,['distance_m','surface','going']):'UNKNOWN'},dc==='UNKNOWN'?'UNKNOWN':dc==='CHANGED'?'IRRELEVANT_CONDITION':r.finish===1?'SUPPORT_ANTECEDENT':'RELEVANT_FACT',linked,['RETURN_AND_CONTRAST_REQUIRED']);
   put(8,'COURSE_GEOMETRY_RESPONSE',{...base,course:gc,prior_to_current:last?compare(last.geometry,card.geometry,geo):'UNKNOWN'},gc==='UNKNOWN'?'UNKNOWN':gc==='CHANGED'?'IRRELEVANT_CONDITION':r.finish===1?'SUPPORT_ANTECEDENT':'RELEVANT_FACT',linked,['COURSE_CHANGE_CAUSAL_EFFECT_UNPROVEN']);
   put(12,'OBSERVED_POSITION_AND_CURRENT_GATE',{event:d.eventId,priorGate:r.gate,currentGate:t.gate,positions:ranks,context:ctx},!ranks||t.gate===null||ctx==='UNKNOWN'?'UNKNOWN':ctx==='CHANGED'?'IRRELEVANT_CONDITION':'RELEVANT_FACT',linked,['CURRENT_QUEUE_ALTERNATIVES_REQUIRED']);
   put(14,'CLASS_AND_PEER_MEMBERSHIP',{event:d.eventId,priorClass:d.conditions?.class_label??null,currentClass:card.conditions?.class_label??null,priorPeers:d.rows.filter(q=>q.nativeId!==h).map(q=>q.nativeId),currentPeers:roster.filter(q=>q.status!=='CANCELLED'&&q.horse!==h)},'UNKNOWN',linked,['FORMAL_CLASS_RULE_AND_CURRENT_PEER_STRENGTH_REQUIRED']);
   put(15,'COMBINED_CONDITIONS',{...base,course:gc,weight:r.weightG===t.weightG,gate:r.gate===t.gate},ctx==='UNKNOWN'?'UNKNOWN':ctx==='CHANGED'?'IRRELEVANT_CONDITION':'RELEVANT_FACT',linked,['INDEPENDENT_BENEFICIAL_MECHANISMS_REQUIRED']);
  }
  const bounds=frontBounds(roster);
  put(9,'FRONT_OCCUPANCY_RANGE',{...bounds,subjectRole:roster.find(r=>r.horse===h).role},bounds.statusUnknown.length||bounds.roleUnknown.length?'UNKNOWN':'RELEVANT_FACT',roleSpec(),['BENEFIT_AND_CURRENT_PACE_NOT_OBSERVED']);
  const flank=flankState(roster,roster.find(r=>r.horse===h));
  put(10,'ADJACENT_FRONT_ROLE',flank,flank.state==='UNKNOWN'?'UNKNOWN':stance(flank.state==='BOTH_FRONT_OBSERVED',flank.state==='NOT_BOTH_FRONT'),roleSpec(),[...flank.missing,'TRAFFIC_BENEFIT_UNPROVEN']);
  if(last){const old=last.rows.map(r=>({horse:r.nativeId,role:role(r)})),b=rivalBounds(old,roster,h);put(11,'SAME_ROLE_RIVAL_COUNT_RANGE',b,b.reduction==='UNRESOLVED'?'UNKNOWN':stance(b.reduction==='PROVEN_COUNT_REDUCTION',b.reduction==='NO_COUNT_REDUCTION'),[...fieldSpec(last),...roleSpec()],['CURRENT_ROLE_REPRODUCTION_AND_BENEFIT_UNPROVEN']);}
  // Adjacent actual history only; a missing run is not skipped.
  for(let i=1;i<own.length;i++){const a=own[i-1],b=own[i],v=sectionContrast(a,b,h);put(13,'CONSECUTIVE_SECTION_VS_FINISH',{earlier:a.eventId,later:b.eventId,...v},v.status,[...fieldSpec(a),...fieldSpec(b)],['CLOCK_STANDARD_AND_CURRENTABILITY_REQUIRED']);}
  return {horse_id:card.issuer+'|'+h,status:t.status,history_events:own.map(d=>d.eventId),categories:definitions.map((d,i)=>({...d,claims:claims[i],missing:!claims[i].length?['NO_LINKED_OBSERVATION',...(!own.length?['NO_HORSE_HISTORY']:[])]:[],formal:false}))};
 });
 const missing=[];
 for(const r of current){if(r.status==='UNKNOWN')missing.push({type:'CURRENT_START_STATUS_UNKNOWN',horse:r.horse,scope:'CURRENT_FIELD',materialTo:['EYE09','EYE10','EYE11','FULL_FIELD_TRANSFER'],notTo:['OTHER_HORSE_HISTORICAL_MEASUREMENTS'],reason:'possible starter, not absent'});if(!r.last)missing.push({type:'NO_HORSE_HISTORY',horse:r.horse,scope:'INDIVIDUAL',materialTo:['OWN_HISTORY','CURRENT_FIELD'],notTo:['OTHER_HORSE_HISTORICAL_MEASUREMENTS']});}
 for(const d of docs){if(!d.conditions||!d.geometry)missing.push({type:'CONDITION_OR_GEOMETRY_MISSING',event:d.eventId,scope:'EVENT',materialTo:['CONTEXT_TRANSFER'],notTo:['RAW_FINISH_CLOCKS_IF_PRESENT']});for(const r of d.rows)if(d!==card&&[r.checkpointMs,r.checkpointRanks,r.clockMs,r.final600Ms,r.finish].some(v=>v===null))missing.push({type:'PARTIAL_HISTORICAL_ROW',event:d.eventId,horse:r.nativeId,scope:'ROW',materialTo:['ROW_DEPENDENT_COMPARISON','FULL_FIELD_IF_REQUIRED'],notTo:['UNRELATED_RAW_ROWS']});}
 return {schema:'WORK42_EYE_SUPPLY_0.4',analysisSha256:validated.analysisSha256,commonSha256:sha(JSON.stringify(packet)),definitions,runners,missing,rootIds:roots.map(r=>r.id),nativeIds:[...allIds].sort(),formal:false};
}
// Same trusted fact inventory, no extra evidence or votes. Consumers receive
// claim-specific native IDs and dependency closure, not user-authored verdicts.
export function selectClaims(supply,horse,category,requested){
 const c=supply.runners.find(r=>r.horse_id===horse)?.categories.find(q=>q.category===category);assert.ok(c,'UNKNOWN_HORSE_CATEGORY');
 const known=new Map(c.claims.map(q=>[q.claim_id,q])),seen=new Set(),accepted=[],rejected=[];
 for(const id of requested){if(!known.has(id)){rejected.push({id,reason:'IRRELEVANT_OR_UNVERIFIED_CLAIM'});continue;}if(seen.has(id)){rejected.push({id,reason:'DUPLICATE_CLAIM'});continue;}seen.add(id);accepted.push(known.get(id));}
 return {accepted,rejected,independent_vote:false};
}
