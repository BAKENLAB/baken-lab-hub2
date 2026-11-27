// V20 isolated synthetic research. No production access, formal ranks or market data.
import {analyzeV19} from './field-interaction-v19.mjs';
import {runGenerated} from './v15-research.mjs';
import {validateV16,toCommonV16} from './synthetic-generator-v16.mjs';
const keys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility','first_corner_m'];
const uniq=a=>[...new Set(a)].sort();
const sum=a=>a.reduce((x,y)=>x+y,0);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const family=r=>['FK-GEN-3','FK-GEN-4'].includes(r.id)?'CONTROLLED_CLONE_FK-GEN-3':r.id;
const roots=(r,id)=>['fixture-v2:result:'+r.id+':'+id,'fixture-v2:pos:'+r.id+':'+id,'fixture-v2:laps:'+r.id];
const median=a=>{const x=a.slice().sort((a,b)=>a-b),n=x.length;return n?(x[(n-1)>>1]+x[n>>1])/2:null;};
const clock=r=>r.date+'T'+r.published;
const scope=(a,b)=>({missing:keys.filter(k=>a[k]==null||b[k]==null),different:keys.filter(k=>a[k]!=null&&b[k]!=null&&a[k]!==b[k])});
const same=(a,b)=>{const x=scope(a,b);return !x.missing.length&&!x.different.length;};
function phases(r){
 const n=r.lap_tenths.length,k=Math.floor(n/3);
 if(k===0||r.lap_kind!=='synthetic_race_leader')throw Error('V20_LAP_SCOPE');
 const ix=[[0,k],[k,n-k],[n-k,n]];
 return ix.map(([a,b],i)=>({phase:['EARLY','MID','LATE'][i],meters:sum(r.lap_segment_m.slice(a,b)),tenths:sum(r.lap_tenths.slice(a,b))}));
}
export function measuredRace(r,history){
 const obs=phases(r),seen=new Set();
 const candidates=history.filter(q=>q.id!==r.id&&family(q)!==family(r)&&clock(q)<r.date+'T'+r.start&&same(q.conditions,r.conditions)&&equal(q.lap_segment_m,r.lap_segment_m)).sort((a,b)=>clock(a).localeCompare(clock(b))||a.id.localeCompare(b.id)).filter(q=>{const k=family(q);if(seen.has(k))return false;seen.add(k);return true;});
 const comparisons=obs.map((x,i)=>{
  const sample=candidates.map(q=>phases(q)[i].tenths),reference=median(sample);
  return {...x,reference_tenths:reference,reference_range:sample.length?[Math.min(...sample),Math.max(...sample)]:null,delta_tenths:reference===null?null:x.tenths-reference,direction:reference===null?'UNKNOWN_NO_REFERENCE':x.tenths<reference?'FASTER_THAN_SAMPLE_MEDIAN':x.tenths>reference?'SLOWER_THAN_SAMPLE_MEDIAN':'EQUAL_TO_SAMPLE_MEDIAN'};
 });
 return {race:r.id,scope:'RACE_LEADER_CLOCK_NOT_INDIVIDUAL',conditions:r.conditions,phases:comparisons,reference:{selection:'STRICTLY_PRIOR_SAME_CONDITIONS_AND_SEGMENT_LAYOUT_DEDUP_FAMILY',as_of:r.date+'T'+r.start,ids:candidates.map(q=>q.id),sample_size:candidates.length,clock_tenths:median(candidates.map(q=>sum(q.lap_tenths)))},race_clock_tenths:sum(r.lap_tenths),calibrated_pace:null,roots:['fixture-v2:laps:'+r.id,...candidates.map(q=>'fixture-v2:laps:'+q.id)]};
}
function historicalProfile(p,id,measured){
 const card=p.target.entrants.find(x=>x.id===id);
 return p.history.flatMap(r=>{
  const x=r.rows.find(y=>y.id===id);if(!x)return [];
  const m=measured.find(y=>y.race===r.id),diff=scope(r.conditions,p.target.conditions),weight=card.kg-x.kg;
  const competing=r.rows.filter(y=>y.id!==id).map(y=>({id:y.id,early:y.corners[0],mid:y.corners[2],last:y.corners.at(-1),finish:y.finish,clock_tenths:y.clock_tenths,roots:roots(r,y.id)}));
  return [{race:r.id,family:family(r),finish:x.finish,field:r.field_count,beaten:r.field_count-x.finish,individual_clock:x.clock_tenths,winner_gap:x.margin_tenths,individual_final3f:x.final3f_tenths,final3f_field_rank:1+r.rows.filter(y=>y.final3f_tenths<x.final3f_tenths).length,clock_minus_reference_tenths:m.reference.clock_tenths===null?null:x.clock_tenths-m.reference.clock_tenths,positions:x.corners,role:x.corners[0]===1?'EARLY_LEADER':x.corners.at(-1)<x.corners[0]?'ADVANCER':'NONLEAD',position_changes:x.corners.slice(1).map((z,i)=>x.corners[i]-z),observed_companions:competing,observed_race:m,transfer:{...diff,weight_delta_kg:weight,draw:card.draw,first_corner_m:p.target.conditions.first_corner_m,straight_m:null,shape:p.target.conditions.layout,first_checkpoint_vs_current_first_turn:p.target.conditions.first_corner_m==null?'UNKNOWN':200<p.target.conditions.first_corner_m?'CHECKPOINT_BEFORE_TURN':200>p.target.conditions.first_corner_m?'CHECKPOINT_AFTER_TURN':'CHECKPOINT_AT_TURN',status:diff.missing.length?'UNKNOWN':diff.different.length||weight!==0?'TRANSFER_UNESTABLISHED':'MATCHED_HISTORICAL',adjustment:null},roots:uniq([...roots(r,id),...m.roots]),ability_cause:null}];
 });
}
// Joint hypothetical checkpoint order. No actual predicted rank. Each phase
// is a permutation of the roster, with a single leader and explicit changes.
export function validateScenario(s,ids){
 return ['early','mid','late'].every(k=>Array.isArray(s[k])&&s[k].length===ids.length&&new Set(s[k]).size===ids.length&&s[k].every(x=>ids.includes(x)))&&s.early[0]===s.leader&&s.challengers.every(x=>x!==s.leader&&ids.includes(x))&&new Set(s.challengers).size===s.challengers.length;
}
function makeScenarios(p,profiles){
 const ids=p.target.entrants.map(x=>x.id),byDraw=ids.slice().sort((a,b)=>p.target.entrants.find(x=>x.id===a).draw-p.target.entrants.find(x=>x.id===b).draw||a.localeCompare(b));
 const leads=ids.filter(id=>profiles[id].some(x=>x.role==='EARLY_LEADER')),forward=ids.filter(id=>profiles[id].some(x=>x.positions[0]<=3&&x.positions[0]<x.field)),advance=ids.filter(id=>profiles[id].some(x=>x.role==='ADVANCER'));
 const out=[],seen=new Set(),add=(leader,challengers,mover,kind)=>{
  const early=uniq([leader,...challengers]).length===1+challengers.length?[leader,...challengers,...byDraw.filter(x=>x!==leader&&!challengers.includes(x))]:[];
  if(!early.length)return;
  const mid=early.slice(),late=early.slice();
  if(mover&&mid.indexOf(mover)>0){mid.splice(mid.indexOf(mover),1);mid.unshift(mover);}
  if(mover){late.splice(late.indexOf(mover),1);late.unshift(mover);}
  else if(challengers.length){const ch=challengers[0];late.splice(late.indexOf(ch),1);late.unshift(ch);}
  const key=JSON.stringify([early,mid,late,challengers]);if(seen.has(key))return;seen.add(key);
  const s={id:'V20:'+out.length,kind,leader,challengers,early,mid,late,early_yield:ids.filter(x=>x!==leader&&!challengers.includes(x)&&leads.includes(x)),mover:mover??null,assumption_only:true,pace:null,winner:null,probability:null,geometry:{first_corner_m:p.target.conditions.first_corner_m,layout:p.target.conditions.layout,draw_order:byDraw,draw_order_scope:'ASSUMED_TIE_BREAK_NOT_SPEED_OR_POSITION_PREDICTION',straight_m:null,travel_loss:null},unverified:['EARLY_SPEED','ACTUAL_PRESSURE','CURRENT_PACE','FULL_FIELD_RESPONSE']};
  if(!validateScenario(s,ids))throw Error('V20_JOINT_CONSTRAINT');out.push(s);
 };
 for(const l of leads){add(l,[],null,'LEADER_OTHERS_YIELD');const rivals=uniq([...leads,...forward]).filter(x=>x!==l);for(const q of rivals)add(l,[q],null,'SUBSET_CHALLENGE');for(const a of advance.filter(x=>x!==l))add(l,rivals.length?[rivals[0]]:[],a,'MID_RACE_ADVANCE');}
 return {scenarios:out,forward_candidates:forward,unknown_leader_alternative:true,unknown_profiles:ids.filter(id=>!profiles[id].length),exhaustive:false,actual_pace:null};
}
function pathReview(h,s,eyePosition){
 const early=s.early.indexOf(h.id)+1,mid=s.mid.indexOf(h.id)+1,late=s.late.indexOf(h.id)+1;
 const relevant=h.history.filter(o=>o.transfer.status==='MATCHED_HISTORICAL'&&(early===1?o.role==='EARLY_LEADER':o.role!=='EARLY_LEADER'));
 const actualRivals=uniq([s.leader,...s.challengers,...(s.mover?[s.mover]:[])].filter(id=>id!==h.id));
 const witness=relevant.map(o=>{
  const observed=[o.positions[0],o.positions[2],o.positions[3]],hyp=[early,mid,late],direction=a=>[Math.sign(a[1]-a[0]),Math.sign(a[2]-a[1])];
  const ownFit=equal(direction(observed),direction(hyp));
  const pair=actualRivals.map(rival=>{
   const z=o.observed_companions.find(x=>x.id===rival);
   if(!z)return {rival,status:'NO_SHARED_RACE',roots:[]};
   const order=ph=>Math.sign(s[ph].indexOf(h.id)-s[ph].indexOf(rival));
   const observedOrder=[Math.sign(observed[0]-z.early),Math.sign(observed[1]-z.mid),Math.sign(observed[2]-z.last)];
   const assumedOrder=['early','mid','late'].map(order);
   return {rival,observedOrder,assumedOrder,status:equal(observedOrder,assumedOrder)?'OBSERVED_RELATIVE_ORDER_COMPATIBLE':'OBSERVED_RELATIVE_ORDER_DIFFERS',roots:z.roots};
  });
  const historicalCounter=o.finish===o.field?'NO_BEATEN_RIVAL':early===1&&o.finish!==1?'EARLY_LEAD_DID_NOT_WIN':null;
  return {race:o.race,family:o.family,goals:o.finish===1?['WIN','PLACE']:o.finish<=3&&o.beaten>0?['PLACE']:[],finish:o.finish,beaten:o.beaten,
   historicalCounter,own_phase_direction:{observed:direction(observed),assumed:direction(hyp),compatible:ownFit},
   interaction:pair.length?pair.every(x=>x.status==='OBSERVED_RELATIVE_ORDER_COMPATIBLE')?'SHARED_RELATIVE_ORDER_OBSERVED':'RIVAL_ROLE_UNESTABLISHED':'NO_SPECIFIC_RIVAL_ASSUMED',pair,
   race_flow:o.observed_race.phases.map(x=>({phase:x.phase,direction:x.direction,delta_tenths:x.delta_tenths})),individual_final3f:o.individual_final3f,final3f_field_rank:o.final3f_field_rank,individual_clock:o.individual_clock,winner_gap:o.winner_gap,observed_position_changes:o.position_changes,
   roots:uniq([...o.roots,...pair.flatMap(x=>x.roots)]),scope:'HISTORICAL_ROLE_WITNESS_NOT_CURRENT_VIABILITY',
   status:!ownFit?'PATH_MOVEMENT_DIFFERS_NOT_ABILITY_COUNTER':pair.some(x=>x.status!=='OBSERVED_RELATIVE_ORDER_COMPATIBLE')?'APPLICABILITY_UNESTABLISHED':historicalCounter?'SCOPED_HISTORICAL_COUNTER':'CONDITIONAL_CONTEXT'};
 });
 const eyeReview=eyePosition.map(x=>({race:x.race,prior_early_normalized:x.prior_early_normalized,assumed_early_normalized:s.early.length>1?(early-1)/(s.early.length-1):null,comparison:'HYPOTHESIS_ONLY',actual_improvement:null,roots:x.roots}));
 return {scenario:s.id,subject_role:{early,mid,late},precondition:'Joint hypothetical order and assigned competitor action',witness,eyeReview,missing:['CURRENT_RIVAL_RESPONSE','CURRENT_PACE','INDIVIDUAL_EARLY_SECTIONALS','PHASE_ORDER_REALIZATION'],actual_win_viability:null};
}
function positionEye(h,common){
 const item=common.eye.find(x=>x.horse_id===h.id).items.find(x=>x.eye_item_id==='EYE-12');
 return item.observed_facts.filter(f=>f.type==='EARLY_POSITION_AND_QUEUE_CONTEXT').flatMap(f=>{
  const o=h.history.find(x=>x.race===f.value.prior_race_id);
  if(!o||o.field<2)return [];
  return [{race:o.race,prior_early_normalized:(o.positions[0]-1)/(o.field-1),roots:uniq([...o.roots,...f.evidence_ids]),interpretation:'NEUTRAL_ASSUMED_QUEUE_COMPARISON'}];
 });
}
function baselineDefeatContext(h,common){
 const out=[];
 const e=common.eye.find(x=>x.horse_id===h.id).items.find(x=>x.eye_item_id==='EYE-01');
 for(const f of e.observed_facts.filter(x=>x.type==='DEFEAT_GAP')){
  const o=h.history.find(x=>x.race===f.value.race_id);if(!o)continue;
  // No universal "small gap": retain measured gap and observed beaten horses.
  const result={race:o.race,finish:o.finish,beaten:o.beaten,gap_tenths:o.winner_gap,clock:o.individual_clock,scope:'HISTORICAL_OBSERVATION_ONLY',interpretation:o.beaten===0?'COUNTER_TO_BEATING_A_RIVAL':'NEUTRAL_MEASURED_DEFEAT_CONTEXT',threshold:null,roots:uniq([...o.roots,...f.evidence_ids])};
  out.push(result);
 }
 return out;
}
export function analyzeV20(packet,{disableEye01=false,disableEye12=false}={}){
 const p=structuredClone(packet);p.target.entrants.sort((a,b)=>a.runner-b.runner);p.history.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));p.history.forEach(r=>r.rows.sort((a,b)=>a.runner-b.runner));
 const v=validateV16(p);if(!v.valid)throw Error('V20_INPUT:'+v.errors.join(','));
 const c=toCommonV16(p),previous=analyzeV19(c),common=runGenerated(c,{versioned:true,allowExternalPeers:true}),measured=p.history.map(r=>measuredRace(r,p.history));
 const profiles=Object.fromEntries(p.target.entrants.map(h=>[h.id,historicalProfile(p,h.id,measured)])),field=makeScenarios(p,profiles);
 const trace=[];
 const decisions=p.target.entrants.map(card=>{
  const id=card.id,history=profiles[id],h={id,history},prior=previous.decisions.find(x=>x.id===id);
  const eye=disableEye01?[]:baselineDefeatContext(h,common);for(const r of eye)trace.push({horse:id,eye:'EYE-01',consumer:'baselineDefeatContext',items:['02','03'],roots:r.roots,judgment:r.interpretation});
  const position=disableEye12?[]:positionEye(h,common);
  const paths=field.scenarios.map(s=>pathReview(h,s,position));
  for(const path of paths)for(const x of path.eyeReview)trace.push({horse:id,eye:'EYE-12',consumer:'pathReview',items:['58','68','70','73'],roots:x.roots,judgment:x.comparison,scenario:path.scenario});
  // Evidence families are grouped, not vote weights. A is independent of
  // current-card changes, B expresses only transfer context.
  const baseline=history.map(({transfer,...o})=>o);
  const current=history.map(o=>({race:o.race,role:o.role,transfer:o.transfer,roots:uniq([...o.roots,'fixture-v2:card:'+id]),pace_context:o.observed_race.phases.map(x=>x.direction),phase_comparison:o.observed_race.phases.map(x=>({phase:x.phase,tenths:x.tenths,reference_tenths:x.reference_tenths,delta_tenths:x.delta_tenths})),current_effect:null}));
  return {id,history,views:{A:{purpose:'OBSERVED_HISTORICAL_CAPABILITY',observations:baseline,defeat_context:eye},B:{purpose:'CURRENT_CONDITION_TRANSFER',observations:current,actual_effect:null},C:prior.views.C,D:{purpose:'JOINT_ROLE_FEASIBILITY',paths,families:uniq(paths.flatMap(x=>x.witness.map(y=>y.family))),actual_pace:null},E:{...prior.views.E,defeat_context:eye}},prior_eye_returns:previous.returns.filter(x=>x.horse_id===id),rank:null,formal:false};
 });
 const evidence=new Set(common.evidence_index.map(x=>x.evidence_id));
 const referenced=uniq([...measured.flatMap(x=>x.roots),...decisions.flatMap(h=>[...h.history.flatMap(x=>x.roots),...h.views.B.observations.flatMap(x=>x.roots),...h.views.D.paths.flatMap(p=>p.witness.flatMap(w=>w.roots))]),...trace.flatMap(x=>x.roots)]);
 const unresolved=referenced.filter(x=>!evidence.has(x));if(unresolved.length)throw Error('V20_UNBOUND_ROOT:'+unresolved.join(','));
 return {scope:'SYNTHETIC_RESEARCH_ONLY',measured,field,decisions,trace,prior_traces:previous.traces,audit:previous.audit,root_check:{distinct:referenced.length,unbound:unresolved},actual_pace:null,formal:false,release_eligible:false};
}
