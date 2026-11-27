// V47: verified source-specific reviews of the existing joint solver.
// A discovery may corroborate or limit a claim; it cannot manufacture a
// pace, a strength rating, a causal load, a new vote or an actual outcome.
import assert from 'node:assert/strict';
import {semanticItems} from './work42-v46-semantic.mjs';
const id=h=>h.split('|').at(-1),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),finite=Number.isFinite,uniq=a=>[...new Set(a)].sort();
const row=(d,h)=>d?.rows.find(r=>r.nativeId===id(h));
const histId=(d)=>d?.eventId??null;
const gradeOf=h=>h.v46.conditionalCurrentResearchGrade;
const supported=p=>['SUPPORTED_CONDITIONAL_WIN','SUPPORTED_CONDITIONAL_PLACE'].includes(p.state);
const axis=(name,support,counter,unknown)=>({axis:name,state:support.length?counter.length?'MIXED':'SUPPORTED':counter.length?'COUNTER':unknown.length?'HELD':'NOT_NEEDED',support,counter,unknown});
function refsFor(packet,f,requirements){
 const m=new Map(packet.evidence.map(e=>[e.evidenceId,e]));
 const direct=(f.directRefs??f.refs).map(k=>m.get(k)).filter(Boolean),found=[];
 for(const [event,subject,fields] of requirements)for(const field of fields){
  const e=direct.find(e=>e.event===event&&e.subject===subject&&e.field===field);
  if(!e)return null;found.push(e.evidenceId);
 }
 const seen=new Set();function visit(k){if(seen.has(k))return;const e=m.get(k);assert.ok(e,'V47_NATIVE_DEPENDENCY');seen.add(k);e.dependencies.forEach(visit);}found.forEach(visit);
 return {refs:uniq([...seen]),roots:uniq(found.map(k=>m.get(k).root))};
}
const req=(d,h,fields)=>[d.eventId,h===null?null:id(h),fields];
function review(h,p,f,docs,packet,routes){
 const card=docs[0],a=docs.find(d=>d.eventId===id(p.start)),b=docs.find(d=>d.eventId===id(p.response)),v=f.value,horse=h.horse;
 if(!a||!b)return null;
 const ar=row(a,horse),br=row(b,horse),t=row(card,horse);
 const k=a.geometry?.checkpoints_m?.indexOf(p.checkpoint)??-1;
 const source=(requirements)=>refsFor(packet,f,requirements);
 const solverSource=(requirements)=>refsFor(packet,{refs:packet.evidence.map(e=>e.evidenceId)},requirements);
 const out=(axis,predicate,state,value,requirements,missing=[],solverRequirements=[])=>{
  const roots=source(requirements);
  if(!roots)return {category:f.category,item:f.item,axis,predicate,state:'HELD_SOURCE_FIELDS',missing:['REQUIRED_NATIVE_FIELDS_NOT_IN_CLAIM'],refs:[],roots:[],independent_vote:false};
  const solver=solverSource(solverRequirements);
  if(!solver)return {category:f.category,item:f.item,axis,predicate,state:'HELD_SOLVER_SOURCE_FIELDS',missing:['SOLVER_NATIVE_FIELDS_MISSING'],refs:roots.refs,roots:roots.roots,independent_vote:false};
  return {category:f.category,item:f.item,axis,predicate,state,value,missing,refs:uniq([...roots.refs,...solver.refs]),roots:roots.roots,solverRoots:solver.roots,independent_vote:false};
 };
 if(f.category==='EYE01'&&v.event===b.eventId){
  const winner=b.rows.find(r=>r.finish===1),pair=p.own.find(e=>id(e.rival)===winner?.nativeId);
  if(!winner||!br||!p.field||!p.sourceValid)return null;
  // Gap is literal response evidence. Cross route may legitimately differ
  // from that result; no contradiction unless comparing replay.
  const g=br.clockMs-winner.clockMs,u=2*b.precisionMs;
  const literal=[Math.max(0,g-u),g+u],replay=p.replay;
  const pairBounds=pair?.finish??(winner.nativeId===id(horse)?[0,0]:null);
  const agrees=!pairBounds?null:winner.nativeId===id(horse)?eq(pairBounds,[0,0]):eq(pairBounds,[-g-u,-g+u]);
  const state=replay?(agrees?'CORROBORATED':'COUNTER_TO_LITERAL_REPLAY'):'HISTORICAL_MARGIN_NOT_CROSS_ROUTE_GATE';
  return out('A','MARGIN_RESPONSE_REVIEW',state,{historicalGapMs:literal,routeAgainstWinner:pairBounds,routeRank:[p.field.min,p.field.max],replay},[req(b,horse,['finish','finish_clock']),req(b,winner.nativeId,['finish','finish_clock'])],['NARROW_GAP_STRENGTH_STANDARD_UNPROVEN']);
 }
 if(f.category==='EYE02'&&v.event===b.eventId&&p.remaining===600&&p.sourceValid&&br){
  const comparisons=p.own.filter(e=>finite(e.relativeGain));
  if(comparisons.length!==b.rows.length-1)return null;
  // Gain is the difference in remaining section clocks, not final rank.
  const u=2*b.precisionMs,lo=1+comparisons.filter(e=>e.relativeGain< -u).length,hi=1+comparisons.filter(e=>e.relativeGain<=u).length;
  const rank=[lo,hi],expected=v.sectionRank;
  const consistent=rank[0]===expected[0]&&rank[1]===expected[1];
  const state=!consistent?'COUNTER_TO_SECTION_ARITHMETIC':hi<br.finish?'SECTION_BETTER_THAN_FINISH':lo>br.finish?'FINISH_BETTER_THAN_SECTION':'SECTION_RANK_OVERLAPS_FINISH';
  return out('D','REMAINING_RESPONSE_VS_PLACING',state,{sectionRank:rank,literalFinish:br.finish,conditionalRank:[p.field.min,p.field.max],gainByPeer:comparisons.map(e=>[e.rival,e.relativeGain])},b.rows.map(r=>req(b,r.nativeId,['individual_final600'])).concat([req(b,horse,['finish'])]),['PHYSICAL_RESERVE_NOT_OBSERVED']);
 }
 if(f.category==='EYE05'&&v.event===b.eventId){
  const later=docs.find(d=>d.eventId===v.laterEvent),peer=row(later,v.peer),old=row(b,v.peer);
  if(!later||!peer||!old)return null;
  const currentPeer=row(card,v.peer),e=p.own.find(e=>id(e.rival)===v.peer);
  const alt=routes.find(q=>q.start===p.start&&q.checkpoint===p.checkpoint&&id(q.response)===v.laterEvent&&q.sourceValid);
  const ae=alt?.own.find(e=>id(e.rival)===v.peer);
  const state=!e?.finish||!ae?.finish||!p.sourceValid?'FOLLOWUP_TRANSFER_UNPROVEN':e.finish[0]>0&&ae.finish[1]<0?'MEASURED_PEER_REVERSAL_COUNTER':e.finish[1]<0&&ae.finish[0]>0?'MEASURED_PEER_REVERSAL_SUPPORT':'NO_DIRECTIONAL_REVERSAL';
  return out('C','SAME_START_PEER_FOLLOWUP',state,{peer:v.peer,priorFinish:old.finish,laterFinish:peer.finish,currentParticipation:currentPeer?.status??'ABSENT',before:e?.finish??null,after:ae?.finish??null,alternative:alt?.id??null,alternativeRank:alt?.field?[alt.field.min,alt.field.max]:null,alternativeState:alt?.state??null},[req(b,v.peer,['finish','finish_clock']),req(later,v.peer,['finish','finish_clock'])],['INDEPENDENT_PEER_STRENGTH_UNPROVEN'],alt?[req(a,horse,['checkpoint_ms']),req(a,v.peer,['checkpoint_ms']),req(b,horse,['checkpoint_ms','finish_clock']),req(b,v.peer,['checkpoint_ms','finish_clock']),req(later,horse,['checkpoint_ms','finish_clock']),req(later,v.peer,['checkpoint_ms','finish_clock'])]:[]);
 }
 if(['EYE07','EYE08'].includes(f.category)&&v.event===b.eventId){
  const n=f.category==='EYE07',field=n?'conditions':'geometry',part=d=>d?.[field],keys=n?['distance_m','surface','going']:['direction','first_turn_m','straight_m','checkpoints_m','course_version'];
  const known=keys.every(k=>part(b)?.[k]!=null&&part(card)?.[k]!=null);
  const diff=known?keys.filter(k=>!eq(part(b)[k],part(card)[k])):[];
  const last=docs.find(d=>d.eventId===v.last);
  const lastKnown=keys.every(k=>part(last)?.[k]!=null&&part(card)?.[k]!=null);
  const lastDiff=lastKnown?keys.filter(k=>!eq(part(last)[k],part(card)[k])):[];
  const state=!known||!lastKnown?'HELD_CONDITION_UNKNOWN':diff.length?'OTHER_CONTEXT_NO_TRANSFER':!lastDiff.length?'NO_CONDITION_RETURN':p.sourceValid&&supported(p)?'MATCHED_CONDITIONAL_RESPONSE_ON_RETURN':'RETURN_RESPONSE_NOT_ESTABLISHED';
  return out('B',n?'RETURN_CONDITION_ROUTE_REVIEW':'RETURN_COURSE_ROUTE_REVIEW',state,{diff,lastDiff,rank:p.field?[p.field.min,p.field.max]:null},[req(b,null,[field]),req(card,null,[field])],['ISOLATED_BENEFIT_NOT_ESTABLISHED']);
 }
 if(['EYE09','EYE10','EYE11'].includes(f.category)&&p.sourceValid){
  // Recompute *observed* role vector from the actual source start event.
  // Compare to last-run proxy. A changed role is an alternative, not a
  // reason to erase observed scenarios or assert future traffic.
  const active=card.rows.filter(r=>r.status==='ACTIVE'),possible=card.rows.filter(r=>r.status!=='CANCELLED');
  if(!active.length||!a.rows.every(r=>Array.isArray(r.checkpointRanks)))return null;
  const role=r=>r?.checkpointRanks?.some(k=>k<=3);
  const front=a.rows.filter(role).map(r=>r.nativeId),ownFront=front.includes(id(horse));
  const requirements=[...possible.map(r=>req(card,r.nativeId,['current_card_row'])),...a.rows.map(r=>req(a,r.nativeId,['ranks']))];
  // Work42 role claims bind last history, not necessarily this start. The
  // start vector must come from the joint solver, not be treated as EYE
  // evidence. Require only the actual EYE inputs here, preserve solver roots separately.
  const latest=possible.map(r=>{const d=docs.slice(1).filter(d=>row(d,r.nativeId)).sort((a,b)=>a.eventAt-b.eventAt).at(-1);return d?req(d,r.nativeId,['ranks']):null;}).filter(Boolean);
  const baseReq=requirements.slice(0,possible.length).concat(latest);
  if(f.category==='EYE09'){
   const count=front.length,ratio=count/a.rows.length,lo=v.ratio?.[0],hi=v.ratio?.[1];
   const state=lo==null||hi==null?'HELD_PROXY_RANGE':ratio<lo||ratio>hi?'OBSERVED_ROLE_ALTERNATIVE_OUTSIDE_LAST_PROXY':'OBSERVED_ROLE_ALTERNATIVE_WITHIN_LAST_PROXY';
   return out('D','FIELD_ROLE_OCCUPANCY_SCENARIO',state,{count,ratio,proxy:v.ratio,ownFront,rank:p.field?[p.field.min,p.field.max]:null},baseReq,['CURRENT_ROLE_REPRODUCTION_UNKNOWN'],a.rows.map(r=>req(a,r.nativeId,['ranks'])));
  }
  if(f.category==='EYE10'){
   if(t?.gate==null)return null;
   const flanks=[-1,1].map(n=>a.rows.filter(r=>r.gate===t.gate+n).map(r=>({horse:r.nativeId,front:role(r)})));
   const both=flanks.every(a=>a.length===1&&a[0].front===true);
   const proxy=f.state==='BOTH_FRONT_ANTECEDENT';
   return out('D','FLANK_ROLE_SCENARIO',f.state==='UNRESOLVED'?'HELD_FLANK_UNKNOWN':both===proxy?'OBSERVED_FLANK_PROXY_AGREES':'OBSERVED_FLANK_ROLE_ALTERNATIVE',{both,proxy,flanks,rank:p.field?[p.field.min,p.field.max]:null},baseReq.concat(possible.map(r=>req(card,r.nativeId,['gate_number']))),['CAUSAL_TRAFFIC_BENEFIT_UNPROVEN'],a.rows.map(r=>req(a,r.nativeId,['ranks','gate_number'])));
  }
  const count=front.filter(x=>x!==id(horse)).length,prev=v.previous;
  const state=count<prev[0]?'OBSERVED_RIVAL_COUNT_LOWER':count>=prev[1]?'OBSERVED_RIVAL_COUNT_NOT_LOWER':'RIVAL_COUNT_OVERLAP';
  return out('D','RIVAL_ROLE_COUNT_SCENARIO',state,{count,previous:prev,proxy:v.current,rank:p.field?[p.field.min,p.field.max]:null},baseReq,['CAUSAL_COMPETITION_BENEFIT_UNPROVEN'],a.rows.map(r=>req(a,r.nativeId,['ranks'])));
 }
 if(f.category==='EYE12'&&v.event===a.eventId&&k>=0&&p.sourceValid&&ar){
  const last=docs.slice(1).filter(d=>row(d,horse)).sort((a,b)=>a.eventAt-b.eventAt).at(-1);
  const j=last?.geometry?.checkpoints_m?.indexOf(p.checkpoint)??-1;
  const own=p.roleVector.find(x=>x.horse===horse),u=2*a.precisionMs;
  if(!own||!finite(own.elapsed))return null;
  const other=p.roleVector.filter(x=>x.horse!==horse),rank=[1+other.filter(x=>x.elapsed<own.elapsed-u).length,1+other.filter(x=>x.elapsed<=own.elapsed+u).length];
  const lastRank=j>=0?row(last,horse)?.checkpointRanks?.[j]:null;
  return out('D','START_VECTOR_POSITION_REVIEW',!finite(lastRank)?'HELD_PRIOR_POSITION':rank[1]<lastRank?'BETTER_OBSERVED_START_ALTERNATIVE':rank[0]>lastRank?'WORSE_OBSERVED_START_ALTERNATIVE':'POSITION_RANGE_OVERLAP',{rank,lastRank,conditionalFinish:p.field?[p.field.min,p.field.max]:null},[req(a,horse,['ranks','checkpoint_ms']),req(card,horse,['gate_number'])],['CURRENT_POSITION_NOT_OBSERVED'],[...a.rows.map(r=>req(a,r.nativeId,['checkpoint_ms'])),...(last?[req(last,horse,['ranks'])]:[])]);
 }
 return null;
}
const missingRequirements={
 EYE04:['DIRECT_OPPONENT_STRENGTH_INDEPENDENT_OF_SAME_FINISH','CONTEXT_MATCHED_MARGIN_DISTRIBUTION'],
 EYE06:['DOCUMENTED_INCIDENT_OR_MEASURED_BURDEN','EVIDENCE_CAUSE_ABSENT_IN_CURRENT_CONTEXT'],
 EYE14:['EFFECTIVE_CLASS_RULE_OR_TRANSFER_LEVEL','INDEPENDENT_CURRENT_PEER_STRENGTH'],
 EYE15:['TWO_DISTINCT_VERIFIED_BENEFICIAL_MECHANISMS','JOINT_FEASIBILITY_WITH_COUNTERS']
};
function judgment(h,p,reviews,base,threshold){
 const positive=p.own.filter(e=>e.finish?.[0]>0),negative=p.own.filter(e=>e.finish?.[1]<0);
 const retained=p.own.filter(e=>['DEFICIT_OVERTURNED','ADVANTAGE_RETAINED'].includes(e.kind));
 const numeric=p.field?[p.field.min,p.field.max]:null;
 const proof=base?.axes??[];
 const raw=(axis)=>proof.find(x=>x.axis===axis)?.refs??[];
 const evidence=(value,refs)=>({value,refs:uniq(refs)});
 const byAxis=k=>reviews.filter(q=>q.axis===k);
 const conflict=reviews.filter(q=>['COUNTER_TO_LITERAL_REPLAY','COUNTER_TO_SECTION_ARITHMETIC'].includes(q.state));
 const reviewCounter=reviews.filter(q=>q.state==='MEASURED_PEER_REVERSAL_COUNTER');
 // A reversal between two competitive horses is a win sensitivity, not
 // a material objection to both being competitive. Only an adverse or
 // unresolved alternative threatens the stronger multi-context claim.
 const materialPeerCounter=reviewCounter.filter(q=>!q.value.alternativeRank||q.value.alternativeRank[1]>threshold||q.value.alternativeState==='HELD');
 const concrete=[
 axis('A',positive.length?[evidence(positive,raw('A'))]:[],negative.length?[evidence(negative,raw('A'))]:[],p.sourceValid?[]:['DEPENDENT_PAIR_MEASUREMENT']),
 axis('B',p.matchedCard&&p.sourceValid?[evidence({checkpoint:p.checkpoint,remaining:p.remaining,context:base?.axes?.[1]?.facts??null},raw('B'))]:[],p.excluded?[evidence(p.exclusionReasons,raw('B'))]:[],p.matchedCard&&p.sourceValid||p.excluded?[]:['CURRENT_FIELD_OR_CONTEXT_TRANSFER']),
 axis('C',numeric&&numeric[1]<=threshold?[evidence(numeric,raw('C'))]:[],numeric&&numeric[0]>threshold?[evidence(numeric,raw('C'))]:[],!p.sourceValid||!numeric||numeric[0]<=threshold&&numeric[1]>threshold?['FIELD_BOUND_UNRESOLVED']:[]),
 axis('D',retained.length?[evidence(retained,raw('D'))]:[],p.own.some(e=>e.kind==='ADVANTAGE_LOST')?[evidence(p.own.filter(e=>e.kind==='ADVANTAGE_LOST'),raw('D'))]:[],p.own.every(e=>e.initial&&e.finish)?[]:['RESPONSE_CLOCK_MISSING']),
 axis('E',reviews.filter(q=>['CORROBORATED','SECTION_BETTER_THAN_FINISH','MEASURED_PEER_REVERSAL_SUPPORT','MATCHED_CONDITIONAL_RESPONSE_ON_RETURN'].includes(q.state)),[...conflict,...reviewCounter,...(p.responseReview??[]).filter(q=>q.materialCounter)],reviews.filter(q=>q.state.startsWith('HELD')).map(q=>q.predicate))
 ].map(q=>({...q,discoveryReview:byAxis(q.axis)}));
 // Directional proof, not a count of axes or an EYE bonus.
 const ability=positive.length>0&&raw('A').length>0,application=p.matchedCard&&p.sourceValid&&raw('B').length>0,field=!!numeric&&numeric[1]<=threshold&&raw('C').length>0,response=retained.length>0&&raw('D').length>0;
 const adverse=p.sourceValid&&negative.length>0&&numeric&&numeric[0]>threshold&&p.own.every(e=>e.initial&&e.finish);
 const state=p.excluded?p.state:p.materialUnknown||conflict.length?'HELD':supported(p)&&ability&&application&&field&&response?p.state:p.state==='SUPPORTED_ADVERSE_CONDITIONAL'&&adverse?p.state:'HELD';
 const decisive=[...(p.materialUnknown?['DEPENDENT_ROUTE_OR_FIELD_BOUND']:[]),...conflict.map(q=>q.predicate),...(state==='HELD'&&!p.materialUnknown&&!conflict.length?['REQUIRED_DIRECTIONAL_PROOF_NOT_ESTABLISHED']:[])];
 return {...p,state,axisJudgments:concrete,eyeReviews:reviews,decisiveUnknown:uniq(decisive),boundedUnknown:['CAUSAL_PHYSICAL_LOAD','FUTURE_ROLE_REPRODUCTION','UNOBSERVED_SCENARIOS'],robustnessCounter:materialPeerCounter.length>0||(p.responseReview??[]).some(q=>q.materialCounter),materialUnknown:state==='HELD'};
}
export function refineV47(common,decision,docs,packet,runners,returns){
 return runners.map(h=>{
  const sem=semanticItems(returns[h.horse],docs,packet,h.horse,{strict:true}),base=decision.runners.find(q=>q.horse===h.horse),prior=h.v46.cardRoutes;
  const cardRoutes=prior.map(p=>{
   const reviews=sem.items.map(f=>review(h,p,f,docs,packet,prior)).filter(Boolean);
   // A mechanism/root/predicate/value is one observation even if multiple
   // claims/target items route to it. Distinct interpretations are not votes.
   const distinct=[...new Map(reviews.map(q=>[JSON.stringify([q.predicate,q.state,q.value??null,q.roots]),q])).values()];
   return judgment(h,p,distinct,base.paths.find(q=>q.id===p.id),decision.threshold);
  });
  const accepted=new Set([...h.acceptedWinRoutes,...h.acceptedPlaceRoutes]),eligible=cardRoutes.filter(p=>!p.excluded);
  const wins=eligible.filter(p=>!p.replay&&p.state==='SUPPORTED_CONDITIONAL_WIN'&&accepted.has(p.id));
  const places=eligible.filter(p=>!p.replay&&supported(p)&&accepted.has(p.id));
  const complete=h.v46.decisionBasis.complete&&eligible.length>0&&!eligible.some(p=>p.materialUnknown);
  const S=complete&&h.v46.decisionBasis.S&&wins.length>0&&!eligible.some(p=>p.robustnessCounter);
  const C=complete&&eligible.every(p=>p.state==='SUPPORTED_ADVERSE_CONDITIONAL')&&eligible.some(p=>p.replay)&&eligible.some(p=>!p.replay);
  const grade=S?'S':wins.length?'A':places.length?'B':C?'C':null;
  const categories=Array.from({length:15},(_,i)=>{
   const category='EYE'+String(i+1).padStart(2,'0'),facts=sem.items.filter(f=>f.category===category),reviews=cardRoutes.flatMap(p=>p.eyeReviews.filter(q=>q.category===category));
   const selected=returns[h.horse].items.some(i=>i.claims.some(q=>q.eye_item_id===category));
   return {category,selected,state:category==='EYE03'?(h.feedback.length?'SHARED_KERNEL_EXECUTED':selected?'NO_QUALIFIED_RECOVERY':'NO_SELECTED_CLAIM'):category==='EYE13'&&h.v46.decisionBasis.responseSensitivity.length?'RESPONSE_SENSITIVITY_EXECUTED':missingRequirements[category]?'INSUFFICIENT_EVIDENCE':reviews.some(q=>!q.state.startsWith('HELD'))?'ROUTE_REVIEW_EXECUTED':facts.length?'RECALCULATED_NO_APPLICABLE_ROUTE':selected?'INSUFFICIENT_EVIDENCE':'NO_SELECTED_CLAIM',facts,reviewStates:uniq(reviews.map(q=>q.state)),required:missingRequirements[category]??[],formal:false};
  });
  return {...h,itemConsumption:h.itemConsumption.map(i=>({...i,semanticV47:sem.items.filter(f=>f.item===i.item),routeReviewV47:i.item==='RANK100'?cardRoutes.map(p=>({id:p.id,state:p.state,axes:p.axisJudgments,decisiveUnknown:p.decisiveUnknown})):cardRoutes.flatMap(p=>p.eyeReviews.filter(q=>q.item===i.item).map(q=>({route:p.id,...q})))})),v47:{categories,cardRoutes,conditionalCurrentResearchGrade:grade,decisionBasis:{S,C,complete,win:wins.map(p=>p.id),place:places.map(p=>p.id),decisiveUnknown:eligible.filter(p=>p.materialUnknown).map(p=>p.id),scope:'RECORDED_ANTECEDENT_CONDITIONAL_ONLY'},formal:false}};
 });
}
