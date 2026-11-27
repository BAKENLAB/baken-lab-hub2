// V48 research candidate. No market, score, quota, future outcome,
// production or formal grade. All observations come from verified pre-race
// packet. Cross-field comparison is a conditional common-peer transfer,
// not an assertion that past rivals reproduce exactly today.
import assert from 'node:assert/strict';
import {jointField} from './work29-v30-terminal.mjs';
import {jointClockFeasibility} from './work30-v31-integrated.mjs';
const id=h=>h.split('|').at(-1),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),finite=Number.isFinite,uniq=a=>[...new Set(a)].sort();
const dims=['distance_m','surface','going','venue','class_label','class_version'],geo=['direction','first_turn_m','straight_m','checkpoints_m','course_version'];
const same=(a,b,keys)=>a&&b&&keys.every(k=>a[k]!=null&&b[k]!=null&&eq(a[k],b[k]));
const row=(d,h)=>d?.rows.find(r=>r.nativeId===id(h));
const matched=(a,b)=>same(a.conditions,b.conditions,dims)&&same(a.geometry,b.geometry,geo);
const sub=(a,b)=>[a[0]-b[1],a[1]-b[0]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const interval=(v,u)=>[v-u,v+u];
const union=xs=>[Math.min(...xs.map(x=>x[0])),Math.max(...xs.map(x=>x[1]))];
const order=v=>!v?'UNKNOWN':v[0]>0?'AHEAD':v[1]<0?'BEHIND':'UNKNOWN';
const intersects=(a,b)=>a[0]<=b[1]&&b[0]<=a[1];
const support=p=>['SUPPORTED_CONDITIONAL_WIN','SUPPORTED_CONDITIONAL_PLACE'].includes(p.state);
function reader(packet){
 const byId=new Map(packet.evidence.map(e=>[e.evidenceId,e])),byKey=new Map(packet.evidence.map(e=>[JSON.stringify([e.event,e.subject,e.field]),e]));
 return requirements=>{
  const roots=[];for(const [d,h,fields] of requirements){if(!d)return null;for(const f of fields){const e=byKey.get(JSON.stringify([d.eventId,h===null?null:id(h),f]));if(!e)return null;roots.push(e);}}
  const seen=new Set();function visit(k){if(seen.has(k))return;const e=byId.get(k);assert.ok(e,'V48_DEPENDENCY');seen.add(k);e.dependencies.forEach(visit);}roots.forEach(e=>visit(e.evidenceId));
  return {refs:uniq([...seen]),roots:uniq(roots.map(e=>e.root))};
 };
}
const req=(d,h,fs)=>[d,h,fs];
const sameIndividual=(a,b)=>a&&b&&a.gate!=null&&a.weightG!=null&&a.gate===b.gate&&a.weightG===b.weightG;
function contextProof(read,c,d){
 return matched(c,d)&&read([req(c,null,['conditions','geometry']),req(d,null,['conditions','geometry','race_leader_laps'])]);
}
const cardProof=(read,c,h)=>read([req(c,h,['current_card_row','gate_number','weight_grams'])]);
function historyProof(read,d,h){
 const r=row(d,h);
 if(r?.status!=='FINISHED'||!finite(r.clockMs)||!Array.isArray(r.checkpointMs)||!Array.isArray(r.checkpointRanks)||!finite(d.precisionMs))return null;
 return read([req(d,h,['historical_row','gate_number','weight_grams','finish','finish_clock','checkpoint_ms','ranks'])]);
}
function prefix(d,k){
 const l=d.leaderLaps;
 if(!l||l.boundariesM[k+1]!==d.geometry.checkpoints_m[k]||!eq(l.boundariesM.slice(1,k+2),d.geometry.checkpoints_m.slice(0,k+1)))return null;
 return l.valuesMs.slice(0,k+1).map((v,i)=>interval(v,(i===0?1:2)*d.precisionMs));
}
function anchorMatch(a,b,h,k){
 const x=row(a,h),y=row(b,h),p=prefix(a,k),q=prefix(b,k);
 if(!sameIndividual(x,y)||!p||!q||!p.every((v,i)=>intersects(v,q[i])))return false;
 // The common peer is a calibration observation, not a timeless rating.
 // Require overlap in its observed prefix and remaining response separately.
 return intersects(interval(x.checkpointMs[k],a.precisionMs),interval(y.checkpointMs[k],b.precisionMs))&&
 intersects(interval(x.clockMs-x.checkpointMs[k],2*a.precisionMs),interval(y.clockMs-y.checkpointMs[k],2*b.precisionMs));
}
function profile(read,c,d,h,anchor,k){
 const t=row(c,h),x=row(d,h),y=row(d,anchor),hp=historyProof(read,d,h),ap=historyProof(read,d,anchor),cp=cardProof(read,c,h),ctx=contextProof(read,c,d);
 if(!ctx||!hp||!ap||!cp||t.status!=='ACTIVE'||!sameIndividual(t,x))return null;
 const initial=h===anchor?[0,0]:interval(x.checkpointMs[k]-y.checkpointMs[k],2*d.precisionMs);
 const response=h===anchor?[0,0]:interval((x.clockMs-x.checkpointMs[k])-(y.clockMs-y.checkpointMs[k]),4*d.precisionMs);
 const finish=h===anchor?[0,0]:interval(x.clockMs-y.clockMs,2*d.precisionMs);
 return {event:d.eventId,horse:h,anchor,initial,response,finish,observedRank:x.finish,observedCheckpointRank:x.checkpointRanks[k],
 refs:uniq([...hp.refs,...ap.refs,...cp.refs,...ctx.refs]),roots:uniq([...hp.roots,...ap.roots,...cp.roots,...ctx.roots])};
}
function rankScenarios(docs,packet,threshold){
 const c=docs[0],roster=c.rows.filter(r=>r.status!=='CANCELLED').map(r=>c.issuer+'|'+r.nativeId),hist=docs.slice(1),read=reader(packet);
 const keys=roster.map(id).sort();
 const changed=hist.filter(d=>!eq(d.rows.map(r=>r.nativeId).sort(),keys));
 if(!changed.length)return {scenarios:[],unresolved:[],scope:'NO_DIFFERENT_HISTORICAL_FIELD'};
 const admissible=hist.filter(d=>contextProof(read,c,d));
 const unresolved=changed.filter(d=>!admissible.includes(d)).map(d=>({event:d.eventId,reason:'CONTEXT_NOT_MATCHED_OR_UNBOUND'}));
 const k=c.geometry?.checkpoints_m?.indexOf(c.conditions?.distance_m-600)??-1;
 if(k<0||roster.length<2)return {scenarios:[],unresolved:[...unresolved,{reason:'NO_COMPARABLE_CHECKPOINT'}],scope:'HELD'};
 const anchors=uniq(admissible.flatMap(d=>d.rows.map(r=>c.issuer+'|'+r.nativeId))).filter(h=>admissible.filter(d=>historyProof(read,d,h)).length>=2);
 const scenarios=[],seen=new Set();
 for(const anchor of anchors)for(const base of admissible.filter(d=>historyProof(read,d,anchor))){
  const aCard=row(c,anchor);
  if(aCard&&(aCard.status!=='ACTIVE'||!sameIndividual(aCard,row(base,anchor))))continue;
  const events=admissible.filter(d=>historyProof(read,d,anchor)&&anchorMatch(base,d,anchor,k));
  if(events.length<2||!events.some(d=>changed.includes(d)))continue;
  const profiles=roster.map(h=>({horse:h,alternatives:events.flatMap(d=>{const p=profile(read,c,d,h,anchor,k);return p?[p]:[];})}));
  if(!profiles.some(h=>h.alternatives.some(p=>changed.some(d=>d.eventId===p.event))))continue;
  const activeProfiles=profiles.filter(h=>h.alternatives.length);
  if(activeProfiles.length<2)continue;
  const represented=uniq(activeProfiles.flatMap(h=>h.alternatives.map(p=>p.event)));
  if(represented.length<2)continue;
  const key=JSON.stringify([anchor,represented,profiles.map(h=>h.alternatives.map(p=>p.event))]);
  if(seen.has(key))continue;seen.add(key);
  // All compatible responses retained. No best-run selection. The joint
  // rank range is a conservative outer bound across their combinations.
  const vector=profiles.map(h=>({horse:h.horse,initial:h.alternatives.length?union(h.alternatives.map(p=>p.initial)):null,response:h.alternatives.length?union(h.alternatives.map(p=>p.response)):null,finish:h.alternatives.length?union(h.alternatives.map(p=>p.finish)):null,refs:uniq(h.alternatives.flatMap(p=>p.refs)),alternatives:h.alternatives}));
  const pairs=[];
  for(let i=0;i<vector.length;i++)for(let j=i+1;j<vector.length;j++){
   const a=vector[i],b=vector[j],known=!!a.finish&&!!b.finish;
   const initial=known?sub(b.initial,a.initial):null,finish=known?sub(b.finish,a.finish):null,response=known?sub(b.response,a.response):null;
   const commonEvents=uniq(a.alternatives.map(p=>p.event).filter(e=>b.alternatives.some(p=>p.event===e)));
   pairs.push({a:a.horse,b:b.horse,initial,finish,response,order:order(finish),refs:uniq([...a.refs,...b.refs]),commonEvents,comparison:!known?'UNRESOLVED':commonEvents.length?'DIRECT_ANTECEDENT_AND_COMMON_PEER_RANGE':'INDIRECT_COMMON_PEER_RANGE',scope:known?'COMMON_PEER_CONDITIONAL_OUTER_BOUND':'UNRESOLVED_COMPARISON'});
  }
  const numeric=jointClockFeasibility(roster,pairs.filter(p=>p.finish).map(p=>({a:p.a,b:p.b,delta:(p.finish[0]+p.finish[1])/2,bound:(p.finish[1]-p.finish[0])/2,refs:p.refs})));
  const field=jointField(roster,pairs,threshold);
  assert.notEqual(numeric.state,'CONTRADICTED_NUMERIC_DIFFERENCES');assert.notEqual(field.state,'CONTRADICTED_SHARED_ORDER');
  const unmeasured=vector.filter(v=>!v.finish).map(v=>v.horse);
  scenarios.push({id:'BRIDGE:'+anchor+':'+represented.join('+'),anchor,events:represented,checkpoint:c.geometry.checkpoints_m[k],remaining:600,vector,pairs,field,numeric,unmeasured,scope:'MATCHED_COMMON_PEER_RESPONSE_CONDITIONAL_NOT_FIELD_DYNAMICS',refs:uniq(vector.flatMap(v=>v.refs)),assumptions:['COMPARABLE_REPORTED_CONTEXT','COMMON_PEER_PREFIX_AND_REMAINING_RESPONSE_OVERLAP','OBSERVED_RESPONSE_RANGE_TRANSFER','NEW_FIELD_INTERACTION_UNOBSERVED']});
 }
 const used=new Set(scenarios.flatMap(s=>s.events));
 for(const d of changed)if(admissible.includes(d)&&!used.has(d.eventId))unresolved.push({event:d.eventId,reason:'NO_COMPATIBLE_COMMON_PEER_BRIDGE'});
 return {scenarios,unresolved,scope:'COMMON_PEER_CONDITIONAL_COMPARISON'};
}
const axis=(name,support,counter,unknown)=>({axis:name,support,counter,unknown,state:support.length?counter.length?'MIXED':'SUPPORTED':counter.length?'COUNTER':unknown.length?'HELD':'NOT_APPLICABLE'});
function bridgeJudgment(h,s,threshold){
 const v=s.vector.find(v=>v.horse===h.horse),bound=s.field.envelopes.find(v=>v.slot===h.horse);
 const own=s.pairs.filter(p=>p.a===h.horse||p.b===h.horse).map(p=>{
  const reverse=a=>a&&[-a[1],-a[0]];
  return {rival:p.a===h.horse?p.b:p.a,initial:p.a===h.horse?p.initial:reverse(p.initial),finish:p.a===h.horse?p.finish:reverse(p.finish),response:p.a===h.horse?p.response:reverse(p.response),refs:p.refs,comparison:p.comparison,commonEvents:p.commonEvents};
 });
 const positive=own.filter(p=>p.finish?.[0]>0),negative=own.filter(p=>p.finish?.[1]<0);
 const recovery=positive.filter(p=>p.initial?.[1]<0&&p.response?.[0]>0),retention=positive.filter(p=>p.initial?.[0]>0),overlap=positive.filter(p=>p.initial&&p.initial[0]<=0&&p.initial[1]>=0&&p.response?.[0]>0);
 const refs=uniq(v.refs.concat(own.flatMap(p=>p.refs))),missing=own.filter(p=>!p.finish).map(p=>p.rival);
 const ability=v.alternatives.length>0&&positive.length>0;
 const response=recovery.length+retention.length+overlap.length>0;
 const win=ability&&response&&bound.max===1,place=ability&&response&&bound.max<=threshold;
 // Missing rival is bounded only for a claim that holds at the worst rank;
 // it remains decisive for any tighter claim whose boundary is crossed.
 const boundary=t=>({threshold:t,rank:[bound.min,bound.max],unknownRivals:missing,status:bound.max<=t?'SUPPORTED_AT_WORST_BOUND':bound.min>t?'COUNTER_AT_BEST_BOUND':'UNRESOLVED_BOUND_CROSSES_THRESHOLD'});
 const winBoundary=boundary(1),placeBoundary=boundary(threshold);
 // EYE05 is not a second vote. Only a selected native claim involving
 // this calibrated peer and two actually included responses can review
 // their range. Both observations remain in the base bound even if omitted.
 const followups=(h.v47.categories.find(c=>c.category==='EYE05')?.facts??[]).flatMap(f=>{
  const q=f.value;
  if(q.peer!==id(s.anchor))return [];
  const a=v.alternatives.find(p=>p.event===q.event),b=v.alternatives.find(p=>p.event===q.laterEvent);
  if(!a||!b||a.event===b.event)return [];
  const proof=uniq([...f.refs,...a.refs,...b.refs]);
  const reversal=a.finish[1]<0&&b.finish[0]>0||a.finish[0]>0&&b.finish[1]<0;
  return [{category:'EYE05',predicate:'CALIBRATED_PEER_FOLLOWUP_RANGE',before:a.finish,after:b.finish,range:v.finish,events:[a.event,b.event],state:reversal?'RELATIVE_RESPONSE_REVERSAL_ALREADY_IN_BOUND':'REVIEWED_RESPONSES_ALREADY_IN_BOUND',refs:proof,independent_vote:false}];
 });
 const axes=[
  axis('A',positive,negative,v.alternatives.length?[]:['NO_SUBJECT_MATCHED_RESPONSE']),
  axis('B',v.alternatives.map(p=>({event:p.event,anchor:p.anchor,refs:p.refs})),[],v.alternatives.length?['NEW_FIELD_INTERACTION_UNOBSERVED']:['NO_MATCHED_CONTEXT']),
  axis('C',win||place?[{rank:[bound.min,bound.max],refs}]:[],bound.min>threshold?[{rank:[bound.min,bound.max],refs}]:[],placeBoundary.status==='UNRESOLVED_BOUND_CROSSES_THRESHOLD'?missing.length?missing:['RELATIVE_CLOCK_OVERLAP']:[]),
  axis('D',[...recovery.map(p=>({...p,kind:'RELATIVE_DEFICIT_OVERTURNED'})),...retention.map(p=>({...p,kind:'RELATIVE_ADVANTAGE_RETAINED'})),...overlap.map(p=>({...p,kind:'RELATIVE_GAIN_FROM_OVERLAP'}))],own.filter(p=>p.initial?.[0]>0&&p.finish?.[1]<0),response?['CAUSAL_LOAD_NOT_OBSERVED']:['NO_SUPPORTED_DIRECTIONAL_RESPONSE']),
  axis('E',followups.filter(q=>q.state==='REVIEWED_RESPONSES_ALREADY_IN_BOUND'),followups.filter(q=>q.state==='RELATIVE_RESPONSE_REVERSAL_ALREADY_IN_BOUND'),followups.length?[]:['NO_ADDITIONAL_EYE_TRANSFER_PROVEN_FOR_NEW_FIELD'])
 ];
 return {id:s.id,kind:'COMMON_PEER',state:win?'SUPPORTED_CONDITIONAL_WIN':place?'SUPPORTED_CONDITIONAL_PLACE':bound.min>threshold&&v.alternatives.length?'OBSERVED_RELATIVE_ADVERSE':'HELD',rank:[bound.min,bound.max],winBoundary,placeBoundary,axes,own,refs,events:s.events,anchor:s.anchor,missing,eyeReviews:followups,assumptions:s.assumptions,scope:s.scope,formal:false};
}
function eyeReasons(h,cross){
 const routes=h.v47.cardRoutes;
 return h.v47.categories.map(c=>{
  const reviews=routes.flatMap(p=>p.eyeReviews.filter(q=>q.category===c.category));
  const nonheld=reviews.filter(q=>!q.state.startsWith('HELD'));
  const material=reviews.filter(q=>['COUNTER_TO_LITERAL_REPLAY','COUNTER_TO_SECTION_ARITHMETIC','MEASURED_PEER_REVERSAL_COUNTER'].includes(q.state));
  const prior=c.category==='EYE03'?h.feedback:c.category==='EYE13'?h.v46.decisionBasis.responseSensitivity:[];
  const crossReviews=cross.flatMap(p=>p.eyeReviews.filter(q=>q.category===c.category));
  const decisionEffects=prior.length?'EXISTING_SHARED_RESPONSE_REVIEW':material.length?'COUNTER_OR_ROBUSTNESS_REVIEW':crossReviews.length?'ALREADY_CONSUMED_IN_COMMON_PEER_RESPONSE_RANGE':nonheld.length?'REVIEWED_NO_NEW_ROUTE_PROOF':c.required.length?'HELD_REQUIRED_EVIDENCE':'NO_QUALIFIED_RELEVANT_MATERIAL';
  return {category:c.category,state:c.state,reason:decisionEffects,required:c.required,reviewStates:c.reviewStates,materialReviews:material.map(q=>({predicate:q.predicate,state:q.state,value:q.value,refs:q.refs})),priorEffects:prior,crossReviews,independent_vote:false};
 });
}
export function candidateV48(docs,packet,runners,decision){
 const bridge=rankScenarios(docs,packet,decision.threshold);
 const out=runners.map(h=>{
  const legacy=h.v47,accepted=new Set([...legacy.decisionBasis.win,...legacy.decisionBasis.place]);
  const prior=legacy.cardRoutes.filter(p=>!p.excluded).map(p=>({id:p.id,kind:'MATCHED_FIELD',state:p.state,rank:p.field?[p.field.min,p.field.max]:null,axes:p.axisJudgments,accepted:accepted.has(p.id),replay:p.replay,decisiveUnknown:p.decisiveUnknown,robustnessCounter:p.robustnessCounter,refs:uniq(p.axisJudgments.flatMap(a=>a.support.concat(a.counter).flatMap(x=>x.refs??[])))}));
  const cross=bridge.scenarios.map(s=>bridgeJudgment(h,s,decision.threshold));
  const paths=[...prior,...cross],wins=paths.filter(p=>p.state==='SUPPORTED_CONDITIONAL_WIN'&&(p.kind==='COMMON_PEER'||p.accepted&&!p.replay)),places=paths.filter(p=>support(p)&&(p.kind==='COMMON_PEER'||p.accepted&&!p.replay));
  const priorGrade=legacy.conditionalCurrentResearchGrade;
  // Bridge is limited conditional evidence. It can establish a specific A/B
  // path but never by itself certify S or global C. No requirement to know
  // future position or form. Uncovered contexts limit the strength claim.
  const strong=priorGrade==='S'&&!cross.some(p=>p.state==='HELD'||p.state==='OBSERVED_RELATIVE_ADVERSE')&&!bridge.unresolved.length;
  const adverse=priorGrade==='C'&&!cross.some(p=>p.state!=='OBSERVED_RELATIVE_ADVERSE')&&!bridge.unresolved.length;
  const grade=strong?'S':wins.length?'A':places.length?'B':adverse?'C':null;
  const held=paths.filter(p=>p.state==='HELD'),counter=paths.filter(p=>['SUPPORTED_ADVERSE_CONDITIONAL','OBSERVED_RELATIVE_ADVERSE'].includes(p.state)||p.robustnessCounter);
  const range=paths.filter(p=>p.rank&&((p.kind==='MATCHED_FIELD'&&p.state!=='HELD')||p.kind==='COMMON_PEER'&&p.refs.length)).map(p=>p.rank);
  const known=row(docs[0],h.horse)?.status==='ACTIVE';
  const finalGrade=known?grade:null;
  const axisJudgments=['A','B','C','D','E'].map(k=>{
   const a=paths.flatMap(p=>(p.axes??[]).filter(a=>a.axis===k).map(a=>({route:p.id,state:a.state,support:a.support,counter:a.counter,unknown:a.unknown})));
   return {axis:k,judgments:a,supportingRoutes:a.filter(x=>x.support.length).map(x=>x.route),counterRoutes:a.filter(x=>x.counter.length).map(x=>x.route),unknownRoutes:a.filter(x=>x.unknown.length).map(x=>x.route)};
  });
  return {horse:h.horse,grade:finalGrade??'UNASSESSED',formalGrade:null,eligibility:!known?'PARTICIPATION_UNRESOLVED':finalGrade?'CONDITIONAL_RESEARCH_ASSESSED':'INSUFFICIENT_DECISION_EVIDENCE',
   ability:{scope:'MEASURED_RELATIVE_RESPONSE_NOT_PHYSIOLOGY',supportedRoutes:wins.concat(places).map(p=>p.id).filter((x,i,a)=>a.indexOf(x)===i),axes:axisJudgments},
   deployment:{scope:'CONDITIONAL_SCENARIO_NOT_FUTURE_OBSERVATION',supported:paths.filter(p=>support(p)).map(p=>p.id),held:held.map(p=>p.id),commonPeer:cross.map(p=>p.id),excluded:legacy.cardRoutes.filter(p=>p.excluded).map(p=>({id:p.id,reasons:p.exclusionReasons}))},
   winPaths:wins.map(p=>p.id),placePaths:places.map(p=>p.id),counterPaths:counter.map(p=>p.id),rankBoundsAcrossReviewedScenarios:range.length?union(range):null,
   coverage:{matchedField:prior.length,commonPeer:cross.length,held:held.length,unresolvedSourceContexts:bridge.unresolved,notFullFutureScenarioCoverage:true},
   missingness:{decisive:!known?['CURRENT_PARTICIPATION']:finalGrade?[]:['NO_SUPPORTED_WIN_OR_PLACE_OR_AFFIRMATIVE_ADVERSE_DECISION'],claimBounds:cross.map(p=>({route:p.id,win:p.winBoundary,place:p.placeBoundary})),futureUncertainty:['FUTURE_PACE','FORM_VARIATION','UNOBSERVED_FIELD_INTERACTION']},
   eye:eyeReasons(h,cross),paths,analysisItems:h.itemConsumption.map(i=>i.item==='RANK36'?{...i,v48:{comparisons:cross.flatMap(p=>p.own.filter(q=>q.comparison==='INDIRECT_COMMON_PEER_RANGE').map(q=>({scenario:p.id,anchor:p.anchor,events:p.events,...q}))),scope:'CONDITIONAL_INDIRECT_RESPONSE'}}:i.item==='RANK100'?{...i,v48:{grade:finalGrade??'UNASSESSED',win:wins.map(p=>p.id),place:places.map(p=>p.id),counter:counter.map(p=>p.id),held:held.map(p=>p.id),formal:false}}:i),decisionReason:finalGrade==='S'?'MULTIPLE_SUPPORTED_ROLE_CONTEXTS':finalGrade==='A'?'SUPPORTED_CONDITIONAL_WIN_PATH':finalGrade==='B'?'SUPPORTED_CONDITIONAL_PLACE_PATH':finalGrade==='C'?'AFFIRMATIVE_ADVERSE_MATCHED_CONTEXTS':'UNRESOLVED_OR_INSUFFICIENT_DECISION_EVIDENCE',formal:false};
 });
 assert.equal(out.length,runners.length);
 return {schema:'REBORN2_V48_RESEARCH_CANDIDATE_V1',scope:'VERIFIED_SYNTHETIC_PRE_RACE_RESEARCH',candidate:true,formal:false,threshold:decision.threshold,thresholdScope:'SYNTHETIC_CONTROL_NOT_CANONICAL',roster:docs[0].rows.map(r=>({horse:docs[0].issuer+'|'+r.nativeId,status:r.status})),runners:out,bridge,limitations:['NO_OFFICIAL_SOURCE_ADMISSION','NO_PROSPECTIVE_ACCURACY_VALIDATION','COMMON_PEER_MATCHED_CONTEXT_ONLY','NO_CAUSAL_LOAD_OR_FUTURE_OUTCOME_ASSERTION','NO_MARKET_OR_FIXED_RANK_QUOTA']};
}
