// V46 research: recompute category-specific predicates from the verified
// raw source, and use actual V42 joint routes for present-card feasibility.
// No current outcome, physical load, points, independent vote or formal grade.
import assert from 'node:assert/strict';
const id=h=>h.split('|').at(-1),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),finite=Number.isFinite;
const uniq=x=>[...new Set(x)].sort();
const row=(d,h)=>d?.rows.find(r=>r.nativeId===h);
const dims=['distance_m','surface','going','venue','class_label','class_version'],geo=['direction','first_turn_m','straight_m','checkpoints_m','course_version'];
const same=(a,b,ks)=>a&&b&&ks.every(k=>a[k]!=null&&b[k]!=null&&eq(a[k],b[k]));
const matched=(a,b)=>same(a.conditions,b.conditions,dims)&&same(a.geometry,b.geometry,geo);
const role=r=>!Array.isArray(r?.checkpointRanks)?null:r.checkpointRanks.some(v=>v<=3);
const comparison=(a,b)=>a==null||b==null?'UNKNOWN':eq(a,b)?'MATCHED':'CHANGED';
const bound=(v,u)=>[v-u,v+u];
const sign=v=>v[0]>0?'POSITIVE':v[1]<0?'NEGATIVE':'OVERLAP';
const rankBounds=(d,r,key)=>{
 if(!finite(r?.[key]))return null;
 const rivals=d.rows.filter(q=>q!==r),u=2*d.precisionMs;
 return [1+rivals.filter(q=>finite(q[key])&&q[key]<r[key]-u).length,1+rivals.filter(q=>!finite(q[key])||q[key]<=r[key]+u).length];
};
function rootBound(packet,q){
 const m=new Map(packet.evidence.map(e=>[e.evidenceId,e])),seen=new Set(),active=new Set();
 function visit(k){if(seen.has(k))return;assert.ok(m.has(k)&&!active.has(k),'V46_NATIVE_CLOSURE');active.add(k);for(const d of m.get(k).dependencies)visit(d);active.delete(k);seen.add(k);}
 q.direct_evidence_ids.forEach(visit);
 assert.deepEqual(uniq([...seen]),uniq(q.evidence_ids),'V46_CLAIM_CLOSURE');
 return {refs:uniq([...seen]),roots:uniq(q.direct_evidence_ids.map(k=>m.get(k).root))};
}
function analyzeClaim(q,docs,packet,h,strict=false){
 const c=docs[0],hist=docs.slice(1).sort((a,b)=>a.eventAt-b.eventAt),f=q.observed_facts,horse=id(h),own=hist.filter(d=>row(d,horse)),last=own.at(-1);
 const d=hist.find(d=>d.eventId===f.event),r=row(d,horse),t=row(c,horse),b=rootBound(packet,q);
 const has=(e,s,field)=>(strict?q.direct_evidence_ids:q.evidence_ids).some(k=>packet.evidence.some(n=>n.evidenceId===k&&n.event===e&&n.subject===s&&n.field===field));
 const need=(e,s,fields)=>fields.every(k=>has(e,s,k));
 const emit=(item,predicate,state,value,missing=[])=>{
  assert.ok(q.upstream_item_ids.includes(item),'V46_CANONICAL_TARGET');
  return {category:q.eye_item_id,item,predicate,state,value,missing,refs:b.refs,rootKeys:b.roots,...(strict?{directRefs:uniq(q.direct_evidence_ids)}:{}),independent_vote:false};
 };
 const held=(reason)=>({category:q.eye_item_id,state:'INSUFFICIENT_EVIDENCE',reason,refs:b.refs,rootKeys:b.roots});
 const currentRoles=()=>c.rows.map(t=>({horse:t.nativeId,status:t.status,gate:t.gate,role:role(row(hist.filter(d=>row(d,t.nativeId)).at(-1),t.nativeId))}));
 const n=Number(q.eye_item_id.slice(3));
 if(n===3)return held('EYE03_EXECUTED_IN_V33_V34_V42');
 if(!q.direct_evidence_ids.length)return held('NO_BOUND_NATIVE_FACT');
 if(n===1){
  if(!d||!r||!need(d.eventId,horse,['finish','finish_clock'])||!d.rows.every(x=>finite(x.clockMs)))return held('FINISH_CLOCK_INCOMPLETE');
  const g=r.clockMs-Math.min(...d.rows.map(x=>x.clockMs)),v=bound(g,2*d.precisionMs);
  return emit('RANK03','WINNER_MARGIN_INTERVAL',r.finish===1?'NOT_APPLICABLE':v[0]<=0?'CLOCK_OVERLAP':'OBSERVED_DEFEAT_GAP',{event:d.eventId,finish:r.finish,gap:v},['FIELD_STRENGTH_AND_NARROW_GAP_STANDARD']);
 }
 if(n===2){
  if(!d||!r||!need(d.eventId,horse,['finish','individual_final600']))return held('SECTION_OR_FINISH_UNBOUND');
  const a=rankBounds(d,r,'final600Ms');if(!a||!finite(r.finish))return held('SECTION_OR_FINISH_MISSING');
  return emit('RANK25','LATE_SECTION_VS_FINISH',a[1]<r.finish?'SUPPORT_ANTECEDENT':a[0]>r.finish?'COUNTER_ANTECEDENT':'UNRESOLVED',{event:d.eventId,sectionRank:a,finish:r.finish},['UNUSED_ENERGY_NOT_MEASURED']);
 }
 if(n===4)return held('INDEPENDENT_OPPONENT_STRENGTH_AND_MARGIN_STANDARD_REQUIRED');
 if(n===5){
  const later=hist.find(x=>x.eventId===f.later_event),peer=row(later,f.peer),prior=row(d,f.peer);
  if(!prior||!peer||!r||!need(later.eventId,f.peer,['finish'])||!need(d.eventId,horse,['finish']))return held('PEER_RESULT_LINK_UNBOUND');
  return emit('RANK37','PEER_FOLLOWUP_RELATION',peer.finish===1?'OBSERVED_PEER_WIN':finite(peer.finish)?'OBSERVED_PEER_DEFEAT':'UNRESOLVED',{event:d.eventId,peer:f.peer,ownFinish:r.finish,priorPeerFinish:prior.finish,laterEvent:later.eventId,laterFinish:peer.finish},['CURRENT_PEER_STRENGTH_NOT_ESTABLISHED']);
 }
 if(n===6)return held('OBSERVED_CAUSAL_TROUBLE_OR_LOAD_AND_CURRENT_RESOLUTION_REQUIRED');
 if(n===7||n===8){
  const keys=n===7?['distance_m','surface','going']:geo;
  const part=x=>n===7?x.conditions:x.geometry;
  if(!d||!last||!r||!need(d.eventId,horse,['finish','finish_clock']))return held('CONDITION_RESPONSE_UNBOUND');
  const contextKnown=keys.every(k=>part(d)?.[k]!=null&&part(c)?.[k]!=null);
  const match=same(part(d),part(c),keys),changed=keys.filter(k=>comparison(part(last)?.[k],part(c)?.[k])==='CHANGED');
  const laterKnown=keys.every(k=>part(last)?.[k]!=null&&part(c)?.[k]!=null);
  const previous=row(last,horse),g=finite(r.clockMs)&&d.rows.every(x=>finite(x.clockMs))?bound(r.clockMs-Math.min(...d.rows.map(x=>x.clockMs)),2*d.precisionMs):null;
  const state=strict&&(!contextKnown||!laterKnown)?'UNRESOLVED':!match?'OTHER_CONTEXT':!laterKnown||!g?'UNRESOLVED':!changed.length?'NO_RETURN_CHANGE':r.finish===1&&previous?.finish>1?'CONDITION_RETURN_ANTECEDENT':'RETURN_BENEFIT_UNPROVEN';
  return emit(n===7?'RANK95':'RANK45',n===7?'CONDITION_RETURN_CONTRAST':'COURSE_RETURN_CONTRAST',state,{event:d.eventId,last:last.eventId,changed,priorFinish:previous?.finish??null,finish:r.finish,gap:g},['ISOLATED_CONDITION_EFFECT_NOT_PROVEN']);
 }
 if(n===9){
  const rs=currentRoles(),active=rs.filter(x=>x.status==='ACTIVE'),possible=rs.filter(x=>x.status!=='CANCELLED');
  if(!need(c.eventId,horse,['current_card_row']))return held('CURRENT_CARD_UNBOUND');
  const lo=active.filter(x=>x.role===true).length,hi=possible.filter(x=>x.role!==false).length;
  const lowDen=active.length+possible.filter(x=>x.status==='UNKNOWN'&&x.role!==true).length;
  const highDen=active.length+possible.filter(x=>x.status==='UNKNOWN'&&x.role!==false).length;
  return emit('RANK63','HISTORICAL_FRONT_PROXY_RANGE',rs.some(x=>x.status==='UNKNOWN'||x.status==='ACTIVE'&&x.role===null)?'BOUNDED_UNKNOWN':'OBSERVED_ROLE_PROXY',{knownActive:active.length,possibleActive:possible.length,count:[lo,hi],ratio:[lowDen?lo/lowDen:null,highDen?hi/highDen:null],subjectRole:rs.find(x=>x.horse===horse).role},['ROLE_REPRODUCTION_AND_PACE_NOT_PROVEN']);
 }
 if(n===10){
  const rs=currentRoles(),possible=rs.filter(x=>x.status!=='CANCELLED'&&x.horse!==horse),flanks=[-1,1].map(k=>possible.filter(x=>x.gate===t.gate+k));
  if(!need(c.eventId,horse,['gate_number','current_card_row']))return held('CURRENT_GATE_UNBOUND');
  const unknown=t.status!=='ACTIVE'||t.gate==null||possible.some(x=>x.gate==null)||flanks.some(a=>a.length>1||a.some(x=>x.status!=='ACTIVE'||x.role===null));
  return emit('RANK66','ADJACENT_ROLE_PROXY',unknown?'UNRESOLVED':flanks.every(a=>a.length===1&&a[0].role===true)?'BOTH_FRONT_ANTECEDENT':'NOT_BOTH_FRONT',{gate:t.gate,flanks:flanks.map(a=>a.map(x=>[x.horse,x.role,x.status]))},['TRAFFIC_AND_POSITION_BENEFIT_NOT_PROVEN']);
 }
 if(n===11){
  if(!last||!need(c.eventId,horse,['current_card_row']))return held('NO_PREVIOUS_ROLE_COMPARISON');
  const prev=last.rows.filter(x=>x.nativeId!==horse).map(role),now=currentRoles().filter(x=>x.horse!==horse&&x.status!=='CANCELLED');
  const before=[prev.filter(x=>x===true).length,prev.filter(x=>x!==false).length],after=[now.filter(x=>x.status==='ACTIVE'&&x.role===true).length,now.filter(x=>x.role!==false).length];
  return emit('RANK65','RIVAL_ROLE_PROXY_CONTRAST',after[1]<before[0]?'COUNT_REDUCTION_ANTECEDENT':after[0]>=before[1]?'NO_COUNT_REDUCTION':'UNRESOLVED',{previous:before,current:after,event:last.eventId},['CURRENT_ROLE_AND_COMPETITION_EFFECT_NOT_PROVEN']);
 }
 if(n===12){
  if(!d||!r||!need(d.eventId,horse,['ranks'])||!need(c.eventId,horse,['gate_number']))return held('QUEUE_ANTECEDENT_UNBOUND');
  return emit('RANK70','POSITION_GATE_ANTECEDENT',matched(d,c)&&r.gate===t.gate&&r.checkpointRanks?'OBSERVED_QUEUE_ANTECEDENT':'TRANSFER_HELD',{event:d.eventId,priorGate:r.gate,currentGate:t.gate,ranks:r.checkpointRanks},['CURRENT_QUEUE_NOT_OBSERVED']);
 }
 if(n===13){
  const a=hist.find(d=>d.eventId===f.earlier),z=hist.find(d=>d.eventId===f.later),x=row(a,horse),y=row(z,horse);
  if(!a||!z||!x||!y||!need(a.eventId,horse,['individual_final600','finish'])||!need(z.eventId,horse,['individual_final600','finish']))return held('SECTION_CONTRAST_UNBOUND');
  if(own.indexOf(z)!==own.indexOf(a)+1)return held('NONCONSECUTIVE_HISTORY');
  const peerMatch=eq(a.rows.map(r=>[r.nativeId,r.gate,r.weightG]).sort((a,b)=>a[0].localeCompare(b[0])),z.rows.map(r=>[r.nativeId,r.gate,r.weightG]).sort((a,b)=>a[0].localeCompare(b[0])));
  const contextKnown=[a,z].every(d=>dims.every(k=>d.conditions?.[k]!=null)&&geo.every(k=>d.geometry?.[k]!=null)&&d.rows.every(r=>r.gate!=null&&r.weightG!=null));
  const prefix=a.leaderLaps?.valuesMs&&z.leaderLaps?.valuesMs, u=a.precisionMs+z.precisionMs;
  const pace=!!prefix&&a.leaderLaps.valuesMs.slice(0,2).every((v,i)=>Math.abs(v-z.leaderLaps.valuesMs[i])<=(i===0?u:2*u));
  const delta=finite(x.final600Ms)&&finite(y.final600Ms)?bound(y.final600Ms-x.final600Ms,u):null;
  const state=strict&&(!contextKnown||!prefix)?'UNRESOLVED':!matched(a,z)||!peerMatch||!pace?'OTHER_CONTEXT':!delta||!finite(x.finish)||!finite(y.finish)?'UNRESOLVED':sign(delta)==='NEGATIVE'&&y.finish>=x.finish?'SECTION_IMPROVEMENT_ANTECEDENT':sign(delta)==='POSITIVE'?'SECTION_WORSENED':'NO_HIDDEN_SECTION_IMPROVEMENT';
  return emit('RANK32','SECTION_AND_PLACING_CONTRAST',state,{earlier:a.eventId,later:z.eventId,delta,placing:[x.finish,y.finish],peerMatch,pace},['PEER_RESPONSE_AND_CURRENT_FORM_NOT_PROVEN']);
 }
 return held(n===14?'FORMAL_CLASS_AND_CURRENT_PEER_STRENGTH_REQUIRED':'INDEPENDENT_JOINT_BENEFICIAL_MECHANISMS_REQUIRED');
}
// Shared item kernels: canonical target actually recalculated; different
// predicates from same roots remain correlated observations, not votes.
export function semanticItems(compiled,docs,packet,horse,{strict=false}={}){
 const claims=new Map(compiled.items.flatMap(i=>i.claims).map(q=>[q.claim_id,q]));
 const out=new Map(),holds=[];
 for(const q of claims.values()){
  const a=analyzeClaim(q,docs,packet,horse,strict);
  if(!a.item){holds.push(a);continue;}
  const key=JSON.stringify([a.item,a.predicate,a.value,a.rootKeys]);
  if(!out.has(key))out.set(key,a);
 }
 return {items:[...out.values()],holds};
}
// The scenario uses a real historical full-field vector as a conditional
// antecedent, with today's roster/gate/weight/context verified by V41/V42.
// It is NOT an observed current position. Missing participation affects
// the whole-field claim, not the historical pair fact.
export function assessCardRoutes(common,decision,docs,horse,items){
 const card=docs[0],all=common.roster.known_active.length===common.roster.possible_active.length;
 const h=decision.runners.find(r=>r.horse===horse),routeMap=new Map(decision.routes.map(r=>[r.id,r]));
 return h.paths.map(p=>{
  const r=routeMap.get(p.id),a=docs.find(d=>d.eventId===id(p.start)),b=docs.find(d=>d.eventId===id(p.response));
  const sameField=a&&b&&[a,b].every(d=>eq(d.rows.map(r=>r.nativeId).sort(),card.rows.filter(r=>r.status!=='CANCELLED').map(r=>r.nativeId).sort()));
  const matchedCard=!!sameField&&[a,b].every(d=>matched(d,card)&&d.rows.every(v=>{const w=row(card,v.nativeId);return w?.status==='ACTIVE'&&w.gate!=null&&w.weightG!=null&&w.gate===v.gate&&w.weightG===v.weightG;}));
  const k=a?.geometry?.checkpoints_m?.indexOf(p.checkpoint)??-1;
  const complete=k>=0&&a.rows.every(v=>finite(v.checkpointMs?.[k]));
  const observedComplete=!!r?.valid&&r.edges.length>0&&r.edges.every(e=>e.measurement&&e.refs.length);
  const sourceValid=observedComplete&&r.edges.every(e=>e.full);
  const supported=all&&matchedCard&&complete&&sourceValid&&r.pace.state==='OVERLAPPING_OBSERVED_PACE';
  // A fully observed but incompatible transfer is not missing history.
  // Exclusion applies only to this particular cross-event assumption.
  const excluded=all&&matchedCard&&complete&&observedComplete&&!supported&&
   (r.pace.state==='OBSERVED_PACE_DIFFERS'||r.edges.some(e=>e.roleConflict));
  const exclusionReasons=excluded?[...(r.pace.state==='OBSERVED_PACE_DIFFERS'?['MEASURED_PREFIX_PACE_DIFFERS']:[]),...(r.edges.some(e=>e.roleConflict)?['MEASURED_RELATIVE_POSITION_CONFLICT']:[])]:[];
  const own=p.own.map(e=>({rival:e.rival,initial:e.initial,finish:e.finish,relativeGain:e.gain,kind:e.recovered?'DEFICIT_OVERTURNED':e.retained?'ADVANTAGE_RETAINED':e.lost?'ADVANTAGE_LOST':'UNRESOLVED_OR_OVERLAP',physicalLoad:'NOT_OBSERVED'}));
  // Re-evaluate the route's ability claims with only relevant item kernels;
  // a faster final section in another context is not a new current claim.
  const relevant=items.filter(i=>[i.value.event,i.value.later,i.value.earlier].some(e=>e===b?.eventId||e===a?.eventId));
  const recovery=own.some(e=>e.kind==='DEFICIT_OVERTURNED'),retained=own.some(e=>e.kind==='ADVANTAGE_RETAINED');
  const itemReview=relevant.filter(i=>['RANK25','RANK32','RANK95','RANK45'].includes(i.item)).map(i=>({item:i.item,predicate:i.predicate,state:i.state,scope:'ANTECEDENT_ONLY',refs:i.refs}));
  const unresolved=own.filter(e=>!e.initial||!e.finish);
  const materialUnknown=!excluded&&(!supported||unresolved.length>0||p.decision==='HELD');
  const axes={A:p.basis.ability&&sourceValid,B:supported&&p.basis.applicability,C:p.basis.comparison&&sourceValid,D:p.basis.response&&own.every(e=>e.initial&&e.finish),E:p.basis.discovery};
  const adverseAxes={A:sourceValid&&own.some(e=>e.finish?.[1]<0),B:supported,C:sourceValid&&p.field?.min>decision.threshold,D:own.every(e=>e.initial&&e.finish),E:p.basis.discovery};
  const state=excluded?'EXCLUDED_INCOMPATIBLE_HYPOTHESIS':materialUnknown?'HELD':p.decision==='CONDITIONAL_WIN'&&Object.values(axes).every(Boolean)?'SUPPORTED_CONDITIONAL_WIN':p.decision==='CONDITIONAL_PLACE'&&axes.A&&axes.B&&axes.C&&axes.E?'SUPPORTED_CONDITIONAL_PLACE':p.decision==='CONDITIONAL_COUNTER'&&Object.values(adverseAxes).every(Boolean)?'SUPPORTED_ADVERSE_CONDITIONAL':'HELD';
  const first=a?.rows.map(v=>v.checkpointMs?.[0])??[],leader=Math.min(...first.filter(finite)),roleContext=first.length&&first.every(finite)?first.filter(v=>v-leader<=2*a.precisionMs).length>1?'CLOCK_OVERLAP':'CLOCK_SEPARATED':null;
  return {id:p.id,start:p.start,response:p.response,checkpoint:p.checkpoint,remaining:p.remaining,replay:p.replay,state,axes,adverseAxes,matchedCard,sourceValid,observedComplete,excluded,exclusionReasons,roleContext,field:r?.field?.envelopes.find(x=>x.slot===horse)??null,roleVector:complete?a.rows.map(v=>({horse:card.issuer+'|'+v.nativeId,elapsed:v.checkpointMs[k]})):[],own,recovery,retained,itemReview,materialUnknown:materialUnknown||state==='HELD',physicalLoad:'UNOBSERVED_CAUSAL_BURDEN',scope:'PRE_RACE_ANTECEDENT_CONDITIONAL_NOT_CURRENT_OBSERVATION'};
 });
}
// EYE13 compares actual common solver results under the SAME start vector
// and two measured response events. This changes a route's robustness
// judgment, not the literal finish interval of either underlying response.
function sectionSensitivity(routes,items){
 const records=[];
 for(const f of items.filter(i=>i.category==='EYE13'&&['SECTION_IMPROVEMENT_ANTECEDENT','SECTION_WORSENED'].includes(i.state))){
  for(const a of routes.filter(p=>id(p.response)===f.value.earlier&&p.field&&p.sourceValid)){
   const b=routes.find(p=>p.start===a.start&&p.checkpoint===a.checkpoint&&id(p.response)===f.value.later&&p.field&&p.sourceValid);
   if(!b)continue;
   const before=[a.field.min,a.field.max],after=[b.field.min,b.field.max];
   if(eq(before,after)&&a.state===b.state)continue;
   const relevant=a.remaining===600&&b.remaining===600&&a.roleVector.length===b.roleVector.length&&eq(a.roleVector,b.roleVector);
   if(!relevant)continue;
   const adverse=a.state==='SUPPORTED_ADVERSE_CONDITIONAL'||b.state==='SUPPORTED_ADVERSE_CONDITIONAL'||a.state==='HELD'||b.state==='HELD';
   records.push({category:'EYE13',item:'RANK32',start:a.start,checkpoint:a.checkpoint,earlier:a.id,later:b.id,before,after,beforeState:a.state,afterState:b.state,delta:f.value.delta,materialCounter:adverse,verdict:'RESPONSE_SENSITIVE_NOT_ISOLATED_CAUSAL_CHANGE',refs:f.refs,independent_vote:false});
  }
 }
 return [...new Map(records.map(r=>[JSON.stringify([r.earlier,r.later,r.start]),r])).values()];
}
export function refineV46(common,decision,docs,packet,runners,returns){
 return runners.map(h=>{
  const s=semanticItems(returns[h.horse],docs,packet,h.horse);
  const initialRoutes=assessCardRoutes(common,decision,docs,h.horse,s.items);
  const sensitivity=sectionSensitivity(initialRoutes,s.items);
  const cardRoutes=initialRoutes.map(p=>{
   const responseReview=sensitivity.filter(q=>q.earlier===p.id||q.later===p.id);
   return {...p,responseReview,robustAcrossReviewedResponses:responseReview.length?responseReview.every(q=>!q.materialCounter&&q.beforeState===q.afterState):null};
  });
  const accepted=new Set([...h.acceptedWinRoutes,...h.acceptedPlaceRoutes]);
  const win=cardRoutes.filter(p=>!p.replay&&p.state==='SUPPORTED_CONDITIONAL_WIN'&&accepted.has(p.id));
  const place=cardRoutes.filter(p=>!p.replay&&['SUPPORTED_CONDITIONAL_WIN','SUPPORTED_CONDITIONAL_PLACE'].includes(p.state)&&accepted.has(p.id));
  const eligible=cardRoutes.filter(p=>!p.excluded);
  const complete=h.sourceComplete&&eligible.length>0&&cardRoutes.every(p=>p.observedComplete&&p.matchedCard)&&!eligible.some(p=>p.materialUnknown);
  // C is affirmative adverse evidence across the admissible recorded
  // alternatives; absence of a positive path is never enough.
  const C=complete&&eligible.every(p=>p.state==='SUPPORTED_ADVERSE_CONDITIONAL')&&eligible.some(p=>p.replay)&&eligible.some(p=>!p.replay);
  // Distinct supported roles and responses, all admissible recorded
  // alternatives competitive. No quota and no requirement that one horse
  // be the unique winner in every role. This remains a research boundary.
  const roles=new Set(win.map(p=>p.roleContext).filter(Boolean)),starts=new Set(win.map(p=>p.start)),responses=new Set(win.map(p=>p.response));
  const allCompetitive=eligible.every(p=>['SUPPORTED_CONDITIONAL_WIN','SUPPORTED_CONDITIONAL_PLACE'].includes(p.state));
  const S=complete&&roles.has('CLOCK_OVERLAP')&&roles.has('CLOCK_SEPARATED')&&starts.size>1&&responses.size>1&&allCompetitive&&!sensitivity.some(q=>q.materialCounter)&&!h.paths.some(p=>p.materialCounter);
  const conditional=S?'S':win.length?'A':place.length?'B':C?'C':null;
  const items=h.itemConsumption.map(i=>({...i,semanticV46:s.items.filter(q=>q.item===i.item),...(['RANK32','RANK100'].includes(i.item)?{responseSensitivity:sensitivity}:{}),...(i.item==='RANK100'?{currentCardRouteJudgments:cardRoutes.map(p=>({id:p.id,state:p.state,axes:p.axes,adverseAxes:p.adverseAxes,materialUnknown:p.materialUnknown,robustAcrossReviewedResponses:p.robustAcrossReviewedResponses}))}:{})}));
  const categoryReview=Array.from({length:15},(_,i)=>{
   const category='EYE'+String(i+1).padStart(2,'0'),facts=s.items.filter(q=>q.category===category),held=s.holds.filter(q=>q.category===category);
   return {category,state:category==='EYE03'?'EXISTING_SHARED_RECOVERY_KERNEL':facts.length?'RECOMPUTED_ANTECEDENT':held.length?'INSUFFICIENT_EVIDENCE':'NO_SELECTED_CLAIM',facts,held};
  });
  return {...h,itemConsumption:items,v46:{categoryReview,cardRoutes,conditionalCurrentResearchGrade:conditional,scope:'CURRENT_CARD_CONDITIONAL_RESEARCH_NOT_ACTUAL_CURRENT_GRADE',decisionBasis:{win:win.map(p=>p.id),place:place.map(p=>p.id),C,S,roles:[...roles],complete,allCompetitive,excluded:cardRoutes.filter(p=>p.excluded).map(p=>p.id),responseSensitivity:sensitivity,materialUnknown:cardRoutes.filter(p=>p.materialUnknown).map(p=>p.id),unmeasured:['CURRENT_FORM','CURRENT_ROLE_REPRODUCTION','CAUSAL_LOAD','SCENARIO_COVERAGE_OUTSIDE_OBSERVED_ANTECEDENTS']},formal:false}};
 });
}
