// V25 research-only extension. Reuse V24 exact pinned intake and typed historical analysis.
// Conditional scenarios are not forecasts; no market, score, grade, or official admission.
import {createHash} from 'node:crypto';
import {analyzeWork23} from './work23-v24-bridge.mjs';
const uniq=a=>[...new Set(a)];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireThat=(x,m)=>{if(!x)throw Error(m)};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const keys=['venue','surface','distance_m','going','direction','class_id'];
const rangeOK=(range,t)=>Array.isArray(range)&&range.length===2&&Number.isFinite(t)&&range[0]<=t&&t<=range[1];
export function analyzeCurrentV25(loaded,name,change=null){
 const entry=loaded.packets.get(name);requireThat(entry,'UNKNOWN_PACKET');
 const p=entry.p;
 if(p.status==='HELD'){requireThat(change===null,'HELD_INTERVENTION');return {name,status:'HELD',runners:[],trace:[],grade:null,formal:false};}
 let original=null;
 if(change){
  requireThat(typeof change.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(change.id),'INTERVENTION_ID');
  original=p.evidence.find(e=>e.evidence_id===change.evidence_id);
  requireThat(original,'INTERVENTION_UNKNOWN_EVIDENCE');
  requireThat(['WITHHOLD','CANCEL_CURRENT','SYNTHETIC_FINAL3F_CHANGE'].includes(change.mode),'INTERVENTION_MODE');
  if(change.mode==='CANCEL_CURRENT')requireThat(original.field==='current_runner'&&original.event_id===p.event&&original.value.status==='ACTIVE','CANCEL_SCOPE');
  if(change.mode==='SYNTHETIC_FINAL3F_CHANGE')requireThat(original.field==='individual_final3f'&&Number.isSafeInteger(change.value)&&change.value>0&&change.value< (p.evidence.find(e=>e.field==='finish_clock'&&e.subject_id===original.subject_id&&e.event_id===original.event_id)?.value??0),'FINAL3F_DOMAIN');
  if(change.mode==='WITHHOLD')requireThat(original.field!=='current_runner','USE_EXPLICIT_ROSTER_CHANGE');
 }
 const lineage=change?{id:change.id,mode:change.mode,source_evidence_id:original.evidence_id,source_root:original.root,derived_id:'V25VIEW:'+digest([entry.pin.sha256,change]),authenticated:false}:null;
 const evidence=p.evidence.flatMap(e=>e!==original?[e]:change.mode==='WITHHOLD'?[]:[{...e,value:change.mode==='CANCEL_CURRENT'?{...e.value,status:'CANCELLED'}:change.value,derived:true}]);
 const find=(ev,h,f)=>evidence.find(e=>e.event_id===ev&&e.subject_id===h&&e.field===f);
 const byId=id=>evidence.find(e=>e.evidence_id===id);
 const trace=[];
 const note=(horse,item,decision,es,missing=[])=>{
  const used=es.filter(Boolean);
  const row={horse,item,decision,evidence_ids:uniq(used.filter(e=>!e.derived).map(e=>e.evidence_id)),roots:uniq(used.filter(e=>!e.derived).map(e=>e.root)),derived_ids:used.some(e=>e.derived)?[lineage.derived_id]:[],missing:uniq(missing),formal:false};
  trace.push(row);return row;
 };
 const val=e=>e?.value??null;
 const base=analyzeWork23(loaded,name,change&&change.mode!=='CANCEL_CURRENT'?{mode:change.mode,evidence_id:change.evidence_id,value:change.value}:null);
 const roster=p.runners.map(h=>{const card=find(p.event,h.id,'current_runner');return {...h,currentStatus:card?.value.status??'UNKNOWN',card};});
 const active=roster.filter(h=>h.currentStatus==='ACTIVE'||h.currentStatus==='UNKNOWN');
 const rosterEvidence=roster.map(h=>h.card);
 const scope=(ev,h)=>{
  const old=find(ev,null,'conditions'),now=find(p.event,null,'conditions'),og=find(ev,null,'course_geometry'),ng=find(p.event,null,'course_geometry'),ow=find(ev,h,'weight'),nw=find(p.event,h,'weight');
  const id=find(ev,h,'historical_runner_identity'),finish=find(ev,h,'finish'),clock=find(ev,h,'finish_clock'),end=find(ev,h,'individual_final3f'),pos=find(ev,h,'checkpoint_positions'),lap=find(ev,null,'race_leader_laps');
  const measures=[id,finish,clock,end,pos,lap,find(ev,h,'margin_to_winner'),find(ev,h,'margin_to_next')],diff=Object.fromEntries(keys.map(k=>[k,old?.value[k]===undefined||now?.value[k]===undefined?null:{past:old.value[k],current:now.value[k],same:old.value[k]===now.value[k]}]));
  const classScope=!!(old&&now&&rangeOK(old.value.class_effective,old.event_at)&&rangeOK(now.value.class_effective,now.event_at));
  const geoScope=!!(og&&ng&&rangeOK(og.value.effective,og.event_at)&&rangeOK(ng.value.effective,ng.event_at));
  const observations={finish:val(finish),clock:val(clock),final3f:val(end),positions:val(pos),leader_laps:val(lap)};
  const geometry=geoScope?{same:eq(og.value,ng.value),past:og.value,current:ng.value}:null;
  const historicalGeometry=og&&rangeOK(og.value.effective,og.event_at)?og.value:null;
  const rankChange=Array.isArray(observations.positions)&&observations.positions.length&&historicalGeometry?.checkpoints_m?.length===observations.positions.length?{first:observations.positions[0],last:observations.positions.at(-1),positions_gained:observations.positions[0]-observations.positions.at(-1),last_to_finish:observations.finish===null?null:observations.positions.at(-1)-observations.finish}:null;
  const leader=observations.leader_laps?.scope==='RACE_LEADER'?observations.leader_laps.segments:null;
  const leaderSummary=Array.isArray(leader)&&leader.length?{first_segment:leader[0],last_segment:leader.at(-1),total_ticks:leader.reduce((n,s)=>n+s.ticks,0),scope:'RACE_LEADER_NOT_INDIVIDUAL_LOAD'}:null;
  const weight=ow&&nw?{past:ow.value,current:nw.value,delta_grams:nw.value-ow.value}:null;
  const routes={'RANK33':[old,now],'RANK43':[old,now,...measures],'RANK44':[old,now,...measures],'RANK45':[old,now,og,ng,...measures],'RANK47':[old,now,...measures],'RANK48':[old,now,...measures],'RANK49':[old,now,og,ng,...measures],'RANK50':[og,ng,pos,end,id],'RANK51':[og,ng,end,id],'RANK52':[og,ng,pos,id],'RANK54':[ow,nw,old,now,...measures],'RANK67':[og,ng]};
  for(const [item,es] of Object.entries(routes))note(h,item,'CONTEXT_OBSERVATION:'+ev,es,es.some(x=>!x)?['PARTIAL_CONTEXT']:[]);
  const peers=evidence.filter(e=>e.event_id===ev&&e.field==='historical_runner_identity').map(e=>({id:e.subject_id,identity:e,finish:find(ev,e.subject_id,'finish'),margin:find(ev,e.subject_id,'margin_to_winner'),clock:find(ev,e.subject_id,'finish_clock'),position:find(ev,e.subject_id,'checkpoint_positions'),weight:find(ev,e.subject_id,'weight')}));
  note(h,'RANK34','OBSERVED_PEER_ROWS_NOT_FIELD_STRENGTH',peers.flatMap(q=>[q.identity,q.finish,q.margin,q.clock,q.position,q.weight]),['PRIOR_PEER_ABILITY','FULL_FIELD_COVERAGE']);
  return {event:ev,observations,diff,class_scope_valid:classScope,geometry,historical_geometry:historicalGeometry,rank_change:rankChange,leader_summary:leaderSummary,weight,known_labels_match:classScope&&geoScope&&geometry?.same===true&&Object.values(diff).every(v=>v?.same===true),peer_rows:peers.map(q=>({id:q.id,finish:val(q.finish),margin:val(q.margin),clock:val(q.clock),position:val(q.position),weight:val(q.weight)})),field_strength:null,individual_load:null,individual_checkpoint_clocks:null,es:[old,now,og,ng,ow,nw,...measures]};
 };
 const histories=new Map(roster.map(h=>[h.id,uniq(p.evidence.filter(e=>e.subject_id===h.id&&e.field==='historical_runner_identity').map(e=>e.event_id)).filter(ev=>find(ev,h.id,'historical_runner_identity')).map(ev=>scope(ev,h.id))]));
 const direct=[],seen=new Set();
 for(const r of p.relations.filter(r=>r.type==='DIRECT_CURRENT_RIVALS')){
  const hs=[r.subject_id,r.opponent_id].sort(),ev=r.reference_event,k=JSON.stringify([ev,hs]);if(seen.has(k))continue;seen.add(k);
  const missing=r.evidence_ids.filter(id=>!byId(id)),ctx=hs.map(h=>histories.get(h)?.find(s=>s.event===ev));
  const measured=base.comparisons.find(c=>c.event===ev&&eq(c.pair,hs));
  const row={event:ev,horses:hs,state:missing.length||ctx.some(x=>!x)?'HELD_RELATION_DEPENDENCY':'HISTORICAL_RELATION_OBSERVED',missing_relation_ids:missing,measured:measured??null,contexts:ctx.map(c=>c?{labels_match:c.known_labels_match,weight:c.weight,field_strength:null}:null),current_rivals:hs.every(id=>active.some(h=>h.id===id)),future_order:null};
  direct.push(row);for(const h of hs)note(h,'RANK35','DIRECT_CONTEXT:'+ev,[...r.evidence_ids.map(byId),...ctx.flatMap(c=>c?.es??[])],missing);
 }
 const indirect=p.relations.filter(r=>r.type==='COMMON_OPPONENT_DIFFERENT_EVENTS').map(r=>{
  const missing=r.evidence_ids.filter(id=>!byId(id)),measured=base.indirect.find(c=>c.peer===r.opponent_id&&c.events[0]===r.reference_event&&c.events[1]===r.followup_event);
  const pair=[r.subject_id,r.other_subject_id],events=[r.reference_event,r.followup_event];
  const es=[...r.evidence_ids.map(byId),...events.flatMap((ev,i)=>evidence.filter(e=>e.event_id===ev&&(e.subject_id===pair[i]||e.subject_id===r.opponent_id||e.subject_id===null)))];
  for(const h of pair)note(h,'RANK36','COMMON_PEER_SCOPE_NOT_TRANSITIVE',es,missing);
  return {horses:pair,peer:r.opponent_id,events,state:missing.length?'HELD_RELATION_DEPENDENCY':measured?.state??'UNRESOLVED',missing_relation_ids:missing,measured:measured??null,current_order:null};
 });
 const followups=[];
 for(const r of p.relations.filter(r=>r.type==='OPPONENT_LATER_PRIOR_TO_CUTOFF')){
  const h=r.subject_id,peer=r.opponent_id,ev=r.reference_event,next=r.followup_event;
  const self=find(ev,h,'finish'),oldPeer=find(ev,peer,'finish'),margin=find(ev,h,'margin_to_winner');
  const c1=find(ev,null,'conditions'),c2=find(next,null,'conditions'),g1=find(ev,null,'course_geometry'),g2=find(next,null,'course_geometry');
  const later=find(next,peer,'finish'),lm=find(next,peer,'margin_to_winner'),lc=find(next,peer,'finish_clock'),lf=find(next,peer,'individual_final3f'),lp=find(next,peer,'checkpoint_positions'),lw=find(next,peer,'weight'),ow=find(ev,peer,'weight');
  const laterId=find(next,peer,'historical_runner_identity'),oldId=find(ev,peer,'historical_runner_identity');
  const missing=r.evidence_ids.filter(id=>!byId(id)),validRelation=missing.length===0&&!!laterId&&!!oldId;
  const state=!later||!laterId?'MISSING_LATER_RESULT':!validRelation?'HELD_RELATION_DEPENDENCY':later.value===1?'OBSERVED_WIN':'OBSERVED_NONWIN';
  const same=c1&&c2?keys.every(k=>c1.value[k]===c2.value[k]):null;
  const es=[self,oldPeer,margin,c1,c2,g1,g2,later,lm,lc,lf,lp,lw,ow,laterId,oldId,...r.evidence_ids.map(byId)];
  note(h,'RANK37','GENERAL_LATER_OPPONENT:'+next,es,missing);
  const narrowCandidate=validRelation&&!!self&&!!oldPeer&&self.value>oldPeer.value&&!!margin&&oldPeer.value===1;
  if(narrowCandidate)note(h,'EYE04','NARROWNESS_AND_STRENGTH_REVIEW',es,['NARROWNESS_CONTEXT','STABLE_OPPONENT_STRENGTH']);
  followups.push({horse:h,peer,event:ev,followup:next,state,finish:val(later),margin:val(lm),clock:val(lc),final3f:val(lf),positions:val(lp),weight_delta_grams:lw&&ow?lw.value-ow.value:null,scope_labels_same:same,geometry_same:g1&&g2?eq(g1.value,g2.value):null,relation_missing:missing,large_defeat:null,stable_strength:null,eye04_review:narrowCandidate,eye04_return:false,eye05_return:false});
 }
 const field=active.map(h=>{
  const past=histories.get(h.id)??[];
  const starts=past.filter(s=>s.rank_change&&s.historical_geometry).map(s=>({event:s.event,first_rank:s.rank_change.first,first_checkpoint_m:s.historical_geometry.checkpoints_m[0],positions:s.observations.positions,finish:s.observations.finish,final3f:s.observations.final3f,labels_match:s.known_labels_match}));
  const comparable=starts.filter(s=>s.labels_match);
  const leaderSeen=comparable.some(s=>s.first_rank===1);
  const observedFront=comparable.some(s=>s.first_rank<=3);
  const state=!comparable.length?'UNKNOWN_POSITION_PROFILE':leaderSeen?'PRIOR_FIRST_CHECKPOINT_LEADER':observedFront?'PRIOR_TOP3_AT_FIRST_CHECKPOINT':'OTHER_OBSERVED_POSITION';
  note(h.id,'RANK58','POSITION_PROFILE_NOT_FIXED_STYLE',[h.card,...past.flatMap(s=>s.es)],comparable.length?[]:['MATCHED_POSITION_HISTORY']);
  return {horse:h.id,state,starts,unknown:!comparable.length,leader_seen:leaderSeen,front_seen:observedFront};
 });
 const front=field.filter(h=>h.front_seen).map(h=>h.horse),unknown=field.filter(h=>h.unknown).map(h=>h.horse);
 const branchDefs=[{id:'REPEAT_OBSERVED_FORWARD_POSITIONS',participants:front,condition:'If observed top-three checkpoint positions recur AND horses seek an overlapping slot; historical field size and actual lead/pace unknown',state:front.length>=2?'CONDITIONAL_FORWARD_INTERACTION_NOT_PROVEN':front.length===1?'ONE_OBSERVED_FORWARD_PROFILE_NOT_SOLO_LEAD':'UNRESOLVED'},{id:'UNKNOWN_OR_CHANGED_START',participants:active.map(h=>h.id),condition:'Any active runner may alter early order; unknown histories remain competitors',state:'OPEN_COUNTER_SCENARIO'}];
 // Pair-specific conditional order; a top-three checkpoint alone does not prove a same-style contest.
 for(const d of direct.filter(z=>z.current_rivals&&z.state==='HISTORICAL_RELATION_OBSERVED'&&z.contexts.every(c=>c?.labels_match))){
  const ps=d.measured?.position_ranks;
  if(!ps?.every(a=>Array.isArray(a)&&a.length&&Number.isInteger(a[0])))continue;
  const [a,b]=ps.map(a=>a[0]);
  if(a===b)continue;
  const earlier=a<b?d.horses[0]:d.horses[1],later=a<b?d.horses[1]:d.horses[0];
  branchDefs.push({id:'REPEAT_PAIR_ORDER:'+d.event+':'+earlier+':'+later,participants:d.horses,condition:'If their observed checkpoint order repeats, '+earlier+' is ahead of '+later+' at that point; not a lead or pace prediction',state:'HISTORICAL_PAIR_ORDER_CONDITIONAL',event:d.event,earlier,later,first_ranks:[a,b]});
  branchDefs.push({id:'REVERSE_PAIR_ORDER:'+d.event+':'+earlier+':'+later,participants:d.horses,condition:'If '+later+' takes an earlier position than '+earlier+', this past comparison does not establish the outcome',state:'COUNTER_BRANCH_UNPROVEN',event:d.event,earlier:later,later:earlier,first_ranks:[a,b]});
 }
 const current=roster.map(h=>{
  const historical=histories.get(h.id)??[];
  if(!active.some(a=>a.id===h.id))return {horse:h.id,status:h.currentStatus,historical:historical.map(({es,...s})=>s),WIN:null,PLACE:null,grade:null,branches:[],reason:'NOT_CURRENT_COMPETITOR'};
  const relevant=direct.filter(d=>d.current_rivals&&d.horses.includes(h.id)&&d.state==='HISTORICAL_RELATION_OBSERVED'&&d.measured);
  const ahead=relevant.filter(d=>d.measured.past_order_support===h.id),behind=relevant.filter(d=>d.measured.past_order_support&&d.measured.past_order_support!==h.id);
  const own=field.find(f=>f.horse===h.id),rivals=field.filter(f=>f.horse!==h.id);
  const deps=[...rosterEvidence,...active.flatMap(a=>(histories.get(a.id)??[]).flatMap(s=>s.es))];
  note(h.id,'RANK65','ALL_ACTIVE_POSITION_COMPETITION',deps,unknown.length?['UNKNOWN_RUNNER_POSITION']:[]);
  note(h.id,'RANK68','CONDITIONAL_FIELD_BRANCHES',deps,['BREAK_SPEED','INDIVIDUAL_LOAD','CURRENT_PACE']);
  const missing=['CURRENT_PACE','INDIVIDUAL_LOAD','FIELD_STRENGTH','WINNING_STANDARD','PLACE_STANDARD',...(unknown.length?['UNKNOWN_ACTIVE_RUNNER']:[])];
  const support=ahead.filter(d=>d.contexts.every(c=>c?.labels_match)).map(d=>({event:d.event,rival:d.horses.find(id=>id!==h.id),condition:'If historical relative performance recurs under matched labels',past_gap:d.measured.clock_gap_b_minus_a_tenths,terminal_relation:d.measured.final3f_support===null?'UNKNOWN':d.measured.final3f_support===h.id?'ALIGNED_WITH_PAST_ORDER':'COUNTER_TO_REPEAT',interpretation:d.measured.final3f_support===h.id?'PAST_ORDER_AND_TERMINAL_OBSERVATION_ALIGN':d.measured.final3f_support===null?'PAST_ORDER_ONLY_TERMINAL_MISSING':'PAST_ORDER_SUPPORT_WITH_TERMINAL_COUNTER'}));
  const counter=behind.map(d=>({event:d.event,rival:d.horses.find(id=>id!==h.id),condition:'Historical relative order must be reversed; no established causal improvement',terminal_relation:d.measured.final3f_support===h.id?'TERMINAL_OBSERVATION_SUPPORTS_REVIEW_NOT_REVERSAL':d.measured.final3f_support===null?'UNKNOWN':'TERMINAL_OBSERVATION_DOES_NOT_SUPPORT_REVERSAL'}));
  // All current rivals' contextual later evidence is revisited; no automatic upgrade or downgrade.
  const peerContext=followups.filter(f=>active.some(a=>a.id===f.horse)).map(f=>({horse:f.horse,peer:f.peer,event:f.event,followup:f.followup,state:f.state,margin:f.margin,comparison_scope:f.scope_labels_same,implication:f.state==='OBSERVED_WIN'?'ONE_LATER_POSITIVE_OBSERVATION':f.state==='OBSERVED_NONWIN'?'ONE_LATER_NONWIN_OBSERVATION':'NO_USABLE_LATER_CONCLUSION',stable_strength:null}));
  const decisionReads=trace.filter(t=>active.some(a=>a.id===t.horse)&&['RANK35','RANK36','RANK37'].includes(t.item));
  const decisionDeps=uniq(decisionReads.flatMap(t=>t.evidence_ids)).map(byId);
  if(change&&decisionReads.some(t=>t.derived_ids.includes(lineage.derived_id)))decisionDeps.push(evidence.find(e=>e.derived));

  const changedWeight=historical.filter(s=>s.weight?.delta_grams!==0&&s.weight).map(s=>({event:s.event,delta:s.weight.delta_grams}));
  const eye04Candidates=followups.filter(f=>f.horse===h.id&&f.eye04_review).map(f=>({event:f.event,peer:f.peer,followup:f.followup,state:f.state,return:false}));
  note(h.id,'EYE14','CLASS_LABEL_CHANGE_NOT_RELATIVE_WEAKENING',historical.flatMap(s=>s.es.slice(0,4)),['CLASS_LEVEL','CURRENT_OPPONENT_ABILITY','CROSS_CLASS_OR_TRANSFER_COMPARABILITY']);
  note(h.id,'EYE15','CONDITION_CHANGE_NOT_PROVEN_IMPROVEMENT',historical.flatMap(s=>s.es.slice(0,6)),['INDEPENDENT_FAVORABLE_EFFECTS','SHARED_ROOT_CHECK']);
  const branches=branchDefs.filter(b=>b.participants.includes(h.id)||b.id==='REPEAT_OBSERVED_FORWARD_POSITIONS').map(b=>({...b,rivals:rivals.map(r=>r.horse),support:b.state==='HISTORICAL_PAIR_ORDER_CONDITIONAL'&&b.earlier===h.id?['OBSERVED_RELATIVE_CHECKPOINT_ORDER']:own.front_seen&&b.id==='REPEAT_OBSERVED_FORWARD_POSITIONS'?['PRIOR_TOP3_CHECKPOINT_OBSERVED_NOT_STYLE']:[],counter:rivals.filter(r=>r.front_seen||r.unknown).map(r=>r.horse),missing}));
  note(h.id,'WIN_PLACE','CONDITIONAL_RELATIVE_PATHS',[...deps,...decisionDeps],missing);
  return {horse:h.id,status:h.currentStatus,historical:historical.map(({es,...s})=>s),position_profile:own,branches,WIN:{state:'UNRESOLVED',conditional_relative_support:support,counter,peer_context:peerContext,missing},PLACE:{state:'UNRESOLVED',historical_places:historical.filter(s=>s.observations.finish!==null).map(s=>({event:s.event,finish:s.observations.finish})),conditional_relative_support:support,counter,peer_context:peerContext,missing},weight_changes:changedWeight,eye04:{state:eye04Candidates.length?'REVIEW_ONLY':'NO_SUPPORTED_NARROW_DEFEAT_CANDIDATE',candidates:eye04Candidates,return:false},eye14:{state:'HELD',reason:'NO_PROVEN_CURRENT_FIELD_WEAKENING'},eye15:{state:'HELD',reason:'NO_INDEPENDENT_PROVEN_BENEFITS'},grade:null};
 });
 const runners=current.map(h=>({...h,items:p.runners.find(r=>r.id===h.horse).items.map(i=>{
  const reads=trace.filter(t=>t.horse===h.horse&&t.item===i.item);
  const prev=base.runners.find(r=>r.id===h.horse)?.items.find(a=>a.item===i.item);
  // Preserve V24 historical reads as separately identified baseline, not V25 semantic proofs.
  return {item:i.item,original_material_state:i.state,view_unavailable_ids:i.evidence_ids.filter(id=>!byId(id)),view_derived_ids:i.evidence_ids.filter(id=>byId(id)?.derived).map(()=>lineage.derived_id),view_state:i.evidence_ids.some(id=>!byId(id))?'PARTIAL_VIEW_WITHHELD':i.evidence_ids.some(id=>byId(id)?.derived)?'SYNTHETIC_VIEW':i.state,v24_runtime_read:prev?.runtime_read??false,v25_runtime_read:reads.some(r=>r.evidence_ids.length||r.derived_ids.length),v25_reads:reads,semantic_effect_proven:false,grade_effect_proven:false};
 })}));
 return {name,status:'RESEARCH_PARTIAL',source_sha256:entry.pin.sha256,lineage,roster:roster.map(h=>({horse:h.id,status:h.currentStatus})),field:{active:active.map(h=>h.id),profiles:field,front,unknown,branches:branchDefs,actual_pace:null},direct,indirect,followups,runners,trace,formal:false,grade:null};
}
