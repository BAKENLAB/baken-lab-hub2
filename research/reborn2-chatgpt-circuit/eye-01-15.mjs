export function inspectEye15({target,roster,rankAudit,intake,catalog}){
 const defs=catalog.filter(x=>x.id.startsWith("EYE-"));
 if(defs.length!==15||!rankAudit?.runners||rankAudit.runners.length!==roster.length)throw Error("EYE_CONTEXT");
 const byRef=new Map(intake.accepted.flatMap(g=>g.evidence_ids.map(e=>[e,g])));
 const unique=xs=>[...new Set(xs)].sort();
 const list=x=>Array.isArray(x)?x:[];
 const find=(r,id)=>r.items.find(x=>x.item_id===id);
 const facts=x=>{const f=x?.finding;return Array.isArray(f)?f:[...list(f?.facts),...list(f?.hypotheses),...list(f?.counterevidence)];};
 const value=x=>x?.value??x;
 return roster.slice().sort((a,b)=>a.horse_no-b.horse_no).map(h=>{
 const rank=rankAudit.runners.find(x=>x.horse_no===h.horse_no);
 if(!rank||rank.horse_id!==h.horse_id&&rank.horse_id!==null)throw Error("EYE_ROSTER_BINDING");
 const own=intake.accepted.filter(g=>g.record.horse_id===rank.horse_id&&rank.horse_id!==null);
 const results=own.filter(g=>g.record.kind==="RESULT"&&g.record.fact.start_status==="FINISHED");
 const positions=own.filter(g=>g.record.kind==="POSITIONS");
 const rowResults=results.map(g=>({race_id:g.record.race_id,...g.record.fact,event_key:g.event_key,evidence_ids:g.evidence_ids}));
 const current=own.filter(g=>g.record.kind==="CURRENT_CARD"&&g.record.race_id===target.race_id);
 const currentFact=current.length===1?current[0].record.fact:null;
 const fullCond=["course_id","course_version","distance_m","surface","going","class_key"];
 const same=(a,b,keys=fullCond)=>!!a&&!!b&&keys.every(k=>a[k]!=null&&a[k]===b[k]);
 const chronological=own.filter(g=>g.record.kind==="HISTORY"&&g.record.race_id===target.race_id&&g.record.fact.chronology_verified===true&&Array.isArray(g.record.fact.ordered_actual_start_race_ids));
 const lastId=chronological.length===1?chronological[0].record.fact.ordered_actual_start_race_ids[0]:null;
 const last=rowResults.find(r=>r.race_id===lastId);
 const items=defs.map(d=>{
 const n=d.id.slice(-2), upstream=d.upstream_rank_item_ids.map(id=>find(rank,id)).filter(Boolean);
 const observations=[],support=[],counter=[],unknowns=[],scenarios=[];
 const add=(type,v,refs=[],ids=[])=>observations.push({type,value:v,evidence_ids:unique(refs),upstream_item_ids:unique(ids),classification:"RESEARCH_CANDIDATE"});
 const linked=(ids)=>ids.flatMap(id=>facts(find(rank,id)).map(f=>({id,v:value(f),refs:list(f.evidence_ids??(f.evidence_id?[f.evidence_id]:[]))})));
 const use=(ids,type)=>{for(const x of linked(ids))add(type,x.v,x.refs,[x.id]);};
 const rel=(r)=>same(r,currentFact);
 if(n==="01"){
  for(const r of rowResults.filter(r=>r.finish>1&&(r.winner_gap_tenths!=null||r.margin_reference==="WINNER"&&r.official_margin!=null)))add("DEFEAT_GAP",{race_id:r.race_id,finish:r.finish,field_size:r.field_size,winner_gap_tenths:r.winner_gap_tenths??null,official_margin:r.official_margin??null,margin_reference:r.margin_reference??null,condition_match:rel(r),gap_threshold:null},r.evidence_ids,["02","03"]);
  use(["28","29"],"HISTORICAL_DEFEAT_CONTEXT");
 }else if(n==="02"||n==="03"){
  for(const p of positions){const r=rowResults.find(x=>x.race_id===p.record.race_id);if(!r)continue;const q=p.record.fact.positions.slice().sort((a,b)=>a.segment-b.segment);
   const transitions=q.slice(1).flatMap((x,i)=>x.segment===q[i].segment+1?[{from:q[i].segment,to:x.segment,definite_gain:q[i].rank_min-x.rank_max,definite_loss:x.rank_min-q[i].rank_max}]:[]);
   const recoveries=transitions.flatMap((x,i)=>x.definite_loss>0?transitions.slice(i+1).filter(y=>y.definite_gain>0).map(y=>({loss:x,recovery:y})):[]);
   if(n==="02")add("FINISH_POSITION_CONTENT",{race_id:r.race_id,finish:r.finish,transitions,condition_match:rel(r),individual_speed_measured:false},[...r.evidence_ids,...p.evidence_ids],["17","18"]);
   else if(recoveries.length)add("OBSERVED_RANK_RECOVERY",{race_id:r.race_id,recoveries,finish:r.finish,cause:null},[...r.evidence_ids,...p.evidence_ids],["18","21"]);
  }
  use(n==="02"?["25","26","27","29","32"]:["21","22","24","27"],"UPSTREAM_CONTENT");
 }else if(n==="04"){
  use(["28","29","33","34","38"],"OPPONENT_AND_GAP_CONTEXT");
  for(const r of rowResults.filter(r=>r.finish>1&&r.winner_gap_tenths!=null)){
   const peer=linked(["34","38"]).filter(x=>x.v?.prior_race_id===r.race_id||x.v?.performance_ref===r.race_id);
   if(peer.length)add("SAME_RACE_GAP_AND_PEER_CONTEXT",{race_id:r.race_id,finish:r.finish,winner_gap_tenths:r.winner_gap_tenths,peer_context:peer.map(x=>x.v),strong_peer_conclusion:null},[...r.evidence_ids,...peer.flatMap(x=>x.refs)],["03",...peer.map(x=>x.id)]);
  }
  unknowns.push("STRONG_OPPONENT_AND_NARROW_DEFEAT_JOINT_CRITERIA_UNAPPROVED");
 }else if(n==="05"){
  for(const x of linked(["37"])){const v=x.v;if(v&&v.prior_race_id&&v.peer_id&&v.peer_finish!=null)add("PEER_FOLLOWUP",{prior_race_id:v.prior_race_id,peer_id:v.peer_id,later_finish:v.peer_finish,own_finish:v.own_finish??null,shared_followup_key:v.shared_followup_key??null},x.refs,["37"]);}
  use(["34","38","40"],"OPPONENT_CONTEXT");
  const follow=observations.filter(x=>x.type==="PEER_FOLLOWUP");
  const dedup=new Map();for(const x of follow){const k=x.value.shared_followup_key??JSON.stringify([x.value.prior_race_id,x.value.peer_id,x.value.later_finish]);if(!dedup.has(k))dedup.set(k,x);}
  if(dedup.size)add("FOLLOWUP_DISTRIBUTION",{observed_pairs:follow.length,distinct_followup_candidates:dedup.size,wins:[...dedup.values()].filter(x=>x.value.later_finish===1).length,nonwins:[...dedup.values()].filter(x=>x.value.later_finish>1).length,coverage:"INCOMPLETE_POSSIBLE",effect:null},follow.flatMap(x=>x.evidence_ids),["37"]);
 }else if(n==="06"){
  use(["20","23","24","25","26","27","31","65","69","70","72","73","96"],"PRIOR_INCIDENT_OR_SCENARIO");
  if(lastId){const priorIncidents=own.filter(g=>g.record.kind==="INCIDENT"&&g.record.race_id===lastId&&g.record.fact.role==="SUFFERED");
   const future=linked(["69","70","73","96"]);
   if(priorIncidents.length&&future.length)add("LAST_INCIDENT_AND_CURRENT_SCENARIO",{prior_race_id:lastId,incidents:priorIncidents.map(g=>g.record.fact),scenario_context:future.map(x=>x.v),resolved:null},[...priorIncidents.flatMap(g=>g.evidence_ids),...future.flatMap(x=>x.refs)],["26","69","70","73","96"]);}
  unknowns.push("CAUSE_AND_RECURRENCE_NOT_VALIDATED");
 }else if(n==="07"){
  if(last&&currentFact){for(const r of rowResults.filter(r=>r.race_id!==lastId&&same(r,currentFact)&&!same(last,currentFact)))add("RETURN_TO_CONDITION",{race_id:r.race_id,finish:r.finish,prior_race_id:lastId,success_criterion:null},[...r.evidence_ids,...last.evidence_ids,...current[0].evidence_ids],["43","95","99"]);}
  else unknowns.push("IMMEDIATE_ACTUAL_START_OR_CURRENT_CONDITION_UNKNOWN");
  use(["93","95","99"],"CONDITION_CONTEXT");
 }else if(n==="08"){
  use(["45","46","49","50","51","52","53","93"],"COURSE_CHANGE_CONTEXT");
  if(last?.course_id&&currentFact?.course_id&&last.course_id!==currentFact.course_id){
   const directed=linked(["46"]).filter(x=>x.v?.source_course===last.course_id&&x.v?.target_course===currentFact.course_id);
   add("DIRECTIONAL_COURSE_CHANGE",{from:last.course_id,to:currentFact.course_id,matching_studies:directed.map(x=>x.v),improvement:null},[...last.evidence_ids,...current[0].evidence_ids,...directed.flatMap(x=>x.refs)],["45","46","93"]);
  }unknowns.push("VALIDATED_DIRECTIONAL_EFFECT_REQUIRED");
 }else if(n==="09"){
  use(["59","60","61","62","63","65","69","73","74","75"],"FRONT_SHARE_AND_SCENARIO");
  const share=linked(["63"]).filter(x=>Number.isFinite(x.v?.lower)&&Number.isFinite(x.v?.upper)&&x.v.lower>=0&&x.v.upper<=1&&x.v.lower<=x.v.upper);
  const replay=linked(["60","69","73"]);
  for(const x of share)add("SHARE_WITH_STYLE_AND_PACE",{lower:x.v.lower,upper:x.v.upper,style_and_pace:replay.map(y=>y.v),benefit:null},[...x.refs,...replay.flatMap(y=>y.refs)],["60","63","69","73"]);
  unknowns.push("BENEFIT_NOT_INFERRED_FROM_SHARE_ALONE");
 }else if(n==="10"){
  use(["66","67","68","69","70","73"],"SANDWICH_PATTERN_AND_SCENARIO");
  const pat=linked(["66"]).filter(x=>x.v?.pattern==="PATTERN"),distance=linked(["67"]);
  for(const x of pat)add("SANDWICH_WITH_GEOMETRY",{pattern:x.v.pattern,left_right_ids:x.v.left_right_ids,first_turn:distance.map(y=>y.v),realized_benefit:null},[...x.refs,...distance.flatMap(y=>y.refs)],["66","67"]);
  unknowns.push("PATTERN_IS_NOT_REALIZED_ROUTE_BENEFIT");
 }else if(n==="11"){
  use(["60","61","62","64","65","68","70","72"],"COMPETITION_CONTEXT");
  for(const g of own.filter(x=>x.record.kind==="SCENARIO_INPUT"&&x.record.race_id===target.race_id)){
   const v=g.record.fact;
   if(v.subtype!=="SAME_STYLE_POPULATION"||v.prior_race_id!==lastId||!lastId||v.complete_prior!==true||v.complete_current!==true||typeof v.definition_version!=="string"||!Array.isArray(v.prior_peer_ids)||!Array.isArray(v.current_peer_ids))continue;
   const a=unique(v.prior_peer_ids),b=unique(v.current_peer_ids);
   if([...a,...b].some(x=>typeof x!=="string"||x===rank.horse_id))continue;
   add("SAME_STYLE_COMPARISON",{prior_count:a.length,current_count:b.length,removed:a.filter(x=>!b.includes(x)),newly_competing:b.filter(x=>!a.includes(x)),delta:b.length-a.length,benefit:null,definition_version:v.definition_version},g.evidence_ids,["60","65"]);
  }unknowns.push("PRIOR_AND_CURRENT_SAME_DEFINITION_PEER_POPULATION_REQUIRED");
 }else if(n==="12"){
  use(["58","59","64","68","70","73","75","53","93"],"POSITION_SCENARIO");
  const prior=lastId&&positions.find(g=>g.record.race_id===lastId);
  if(prior){const q=prior.record.fact.positions.slice().sort((a,b)=>a.segment-b.segment)[0],ss=linked(["68","70","73"]);if(q&&ss.length)add("EARLY_POSITION_AND_QUEUE_CONTEXT",{prior_race_id:lastId,prior_rank_range:[q.rank_min,q.rank_max],scenario_candidates:ss.map(x=>x.v),position_improvement:null},[...prior.evidence_ids,...ss.flatMap(x=>x.refs)],["58","68","70","73"]);}
  unknowns.push("NO_EXACT_PREDICTED_ORDER");
 }else if(n==="13"){
  use(["13","14","15","25","29","32","98","99"],"COMPARABLE_TREND_CONTEXT");unknowns.push("VALIDATED_BASELINE_AND_CURRENT_RELEVANCE_REQUIRED");
 }else if(n==="14"){
  use(["33","34","35","36","37","38","39","40","41","42","93","95"],"CLASS_AND_FIELD_CONTEXT");
  const comparison=linked(["40"]).filter(x=>Number.isFinite(x.v?.difference_seconds)),transition=linked(["39","42"]),fit=linked(["93","95"]);
  if(comparison.length&&transition.length&&fit.length)add("FIELD_CHANGE_AND_FIT_CONTEXT",{comparisons:comparison.map(x=>x.v),transitions:transition.map(x=>x.v),fit:fit.map(x=>x.v),weaker_field_conclusion:null},[...comparison,...transition,...fit].flatMap(x=>x.refs),["39","40","42","93","95"]);
  unknowns.push("CLASS_CHANGE_ALONE_NOT_WEAKER_FIELD");
 }else if(n==="15"){
  use(["93","94","95","96","97","98","99"],"MECHANISM_CONTEXT");
  for(const x of linked(["97"]).filter(x=>Array.isArray(x.v?.linked_mechanism_groups)))add("COMBINED_MECHANISM_REVIEW",{groups:x.v.linked_mechanism_groups,independence_confirmed:false,joint_scenario:null},x.refs,["97"]);
  unknowns.push("INDEPENDENCE_AND_JOINT_SCENARIO_UNVALIDATED");
 }
 // Raw references are never promoted by the existence of an upstream output.
 const refs=unique(observations.flatMap(x=>x.evidence_ids));
 const roots=unique(refs.map(e=>byRef.get(e)?.event_key).filter(Boolean));
 for(const a of upstream){for(const x of list(a.finding?.counterevidence))counter.push({item_id:a.item_id,observation:x});for(const x of list(a.finding?.hypotheses))scenarios.push({item_id:a.item_id,observation:x});}
 if(!observations.length)unknowns.push("NO_BOUND_ANALYSIS_OUTPUT");
 if(refs.some(e=>!byRef.has(e)))unknowns.push("UPSTREAM_REFERENCE_NOT_ADMITTED_BY_TYPED_GATE");
 unknowns.push("CURRENT_RELEVANCE_AND_SELECTION_RULE_UNAPPROVED");
 return {eye_item_id:d.id,name:d.name,horse_id:rank.horse_id,horse_no:h.horse_no,source_cutoff:target.cutoff,upstream_item_ids:d.upstream_rank_item_ids,evidence_ids:refs,original_event_keys:roots,observed_facts:observations,current_relevance:"UNKNOWN",mechanism_group:null,support,counter,unknowns:unique(unknowns),scenario_conditions:scenarios,status:observations.length?"CANDIDATE_OUTPUT":"UNKNOWN",assessment_consumed:false,release_eligible:false};
 });
 return {horse_no:h.horse_no,horse_id:rank.horse_id,items,discovery_status:"UNAPPROVED_RESEARCH",ability_eligible:null,eye_candidate:null};
 });
}
export function returnToRank({rankAudit,eyeRunners,intake}){
 const rows=rankAudit.runners.map(r=>{
  const eye=eyeRunners.find(x=>x.horse_no===r.horse_no);
  const existing=new Set(r.items.flatMap(x=>x.evidence_ids??[]));
  const existingRoots=new Set(intake.accepted.filter(x=>x.evidence_ids.some(e=>existing.has(e))).map(x=>x.event_key));
  const events=intake.accepted.filter(x=>x.record.horse_id===r.horse_id&&r.horse_id!==null);
  const eventByKey=new Map(events.map(x=>[x.event_key,x]));
  const links=new Map();
  for(const item of eye.items)for(const key of item.original_event_keys){
   const g=eventByKey.get(key);if(!g)continue;
   if(!links.has(key))links.set(key,{event_key:key,evidence_ids:g.evidence_ids,eye_item_ids:[],rank_item_ids:[],kind:existingRoots.has(key)?"SHARED_EVENT_REINTERPRETATION":"NEW_STRUCTURAL_EVENT_CANDIDATE",formal_admission:false});
   const q=links.get(key);q.eye_item_ids.push(item.eye_item_id);q.rank_item_ids.push(...item.upstream_item_ids);
  }
  const returned=[...links.values()].map(x=>({...x,eye_item_ids:[...new Set(x.eye_item_ids)].sort(),rank_item_ids:[...new Set(x.rank_item_ids)].sort()})).sort((a,b)=>a.event_key.localeCompare(b.event_key));
  return {horse_no:r.horse_no,horse_id:r.horse_id,returned,rerun_required_rank_items:[...new Set(returned.filter(x=>x.kind==="NEW_STRUCTURAL_EVENT_CANDIDATE").flatMap(x=>x.rank_item_ids))].sort(),actually_recomputed:[],final_consumption:[],rank_candidate:null};
 });
 return {runners:rows,decision_status:"RESEARCH_HANDOFF_ONLY",market_input:false,release_eligible:false};
}
