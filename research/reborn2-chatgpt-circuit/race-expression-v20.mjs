// V20 isolated synthetic research. No production access, formal ranks or market data.
import {analyzeV19} from './field-interaction-v19.mjs';
import {runGenerated} from './v15-research.mjs';
import {validateV16,toCommonV16} from './synthetic-generator-v16.mjs';
const keys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility','first_corner_m'];
const uniq=a=>[...new Set(a)].sort();
const sum=a=>a.reduce((x,y)=>x+y,0);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const family=r=>['FK-GEN-3','FK-GEN-4'].includes(r.id)?'CONTROLLED_CLONE_FK-GEN-3':r.id;
const roots=(r,id)=>['fixture-v2:result:'+r.id+':'+id,'fixture-v2:pos:'+r.id+':'+id,'fixture-v2:lap:'+r.id];
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
 return {race:r.id,scope:'RACE_LEADER_CLOCK_NOT_INDIVIDUAL',conditions:r.conditions,phases:comparisons,reference:{selection:'STRICTLY_PRIOR_SAME_CONDITIONS_AND_SEGMENT_LAYOUT_DEDUP_FAMILY',as_of:r.date+'T'+r.start,ids:candidates.map(q=>q.id),sample_size:candidates.length,clock_tenths:median(candidates.map(q=>sum(q.lap_tenths)))},race_clock_tenths:sum(r.lap_tenths),calibrated_pace:null,roots:['fixture-v2:lap:'+r.id,...candidates.map(q=>'fixture-v2:lap:'+q.id)]};
}
function historicalProfile(p,id,measured){
 const card=p.target.entrants.find(x=>x.id===id);
 return p.history.flatMap(r=>{
  const x=r.rows.find(y=>y.id===id);if(!x)return [];
  const m=measured.find(y=>y.race===r.id),diff=scope(r.conditions,p.target.conditions),weight=card.kg-x.kg;
  const competing=r.rows.filter(y=>y.id!==id&&y.corners[0]<=2).map(y=>({id:y.id,early:y.corners[0],last:y.corners.at(-1),finish:y.finish}));
  return [{race:r.id,family:family(r),finish:x.finish,field:r.field_count,beaten:r.field_count-x.finish,individual_clock:x.clock_tenths,winner_gap:x.margin_tenths,individual_final3f:x.final3f_tenths,positions:x.corners,role:x.corners[0]===1?'EARLY_LEADER':x.corners.at(-1)<x.corners[0]?'ADVANCER':'NONLEAD',position_changes:x.corners.slice(1).map((z,i)=>x.corners[i]-z),observed_companions:competing,observed_race:m,transfer:{...diff,weight_delta_kg:weight,draw:card.draw,first_corner_m:p.target.conditions.first_corner_m,straight_m:null,shape:p.target.conditions.layout,status:diff.missing.length?'UNKNOWN':diff.different.length||weight!==0?'TRANSFER_UNESTABLISHED':'MATCHED_HISTORICAL',adjustment:null},roots:uniq([...roots(r,id),...m.roots]),ability_cause:null}];
 });
}
// Joint hypothetical checkpoint order. No actual predicted rank. Each phase
// is a permutation of the roster, with a single leader and explicit changes.
export function validateScenario(s,ids){
 return ['early','mid','late'].every(k=>Array.isArray(s[k])&&s[k].length===ids.length&&new Set(s[k]).size===ids.length&&s[k].every(x=>ids.includes(x)))&&s.early[0]===s.leader&&s.challengers.every(x=>x!==s.leader&&ids.includes(x))&&new Set(s.challengers).size===s.challengers.length;
}
function makeScenarios(p,profiles){
 const ids=p.target.entrants.map(x=>x.id),byDraw=ids.slice().sort((a,b)=>p.target.entrants.find(x=>x.id===a).draw-p.target.entrants.find(x=>x.id===b).draw||a.localeCompare(b));
 const leads=ids.filter(id=>profiles[id].some(x=>x.role==='EARLY_LEADER')),advance=ids.filter(id=>profiles[id].some(x=>x.role==='ADVANCER'));
 const out=[],seen=new Set(),add=(leader,challengers,mover,kind)=>{
  const early=uniq([leader,...challengers]).length===1+challengers.length?[leader,...challengers,...byDraw.filter(x=>x!==leader&&!challengers.includes(x))]:[];
  if(!early.length)return;
  const mid=early.slice(),late=early.slice();
  if(mover&&mid.indexOf(mover)>0){mid.splice(mid.indexOf(mover),1);mid.unshift(mover);}
  if(mover){late.splice(late.indexOf(mover),1);late.unshift(mover);}
  else if(challengers.length){const ch=challengers[0];late.splice(late.indexOf(ch),1);late.unshift(ch);}
  const key=JSON.stringify([early,mid,late,challengers]);if(seen.has(key))return;seen.add(key);
  const s={id:'V20:'+out.length,kind,leader,challengers,early,mid,late,early_yield:ids.filter(x=>x!==leader&&!challengers.includes(x)&&leads.includes(x)),mover:mover??null,assumption_only:true,pace:null,winner:null,probability:null,geometry:{first_corner_m:p.target.conditions.first_corner_m,layout:p.target.conditions.layout,draw_order:byDraw,straight_m:null,travel_loss:null},unverified:['EARLY_SPEED','ACTUAL_PRESSURE','CURRENT_PACE','FULL_FIELD_RESPONSE']};
  if(!validateScenario(s,ids))throw Error('V20_JOINT_CONSTRAINT');out.push(s);
 };
 for(const l of leads){add(l,[],null,'LEADER_OTHERS_YIELD');const rivals=leads.filter(x=>x!==l);for(const q of rivals)add(l,[q],null,'SUBSET_CHALLENGE');for(const a of advance.filter(x=>x!==l))add(l,rivals.length?[rivals[0]]:[],a,'MID_RACE_ADVANCE');}
 return {scenarios:out,unknown_leader_alternative:true,unknown_profiles:ids.filter(id=>!profiles[id].length),exhaustive:false,actual_pace:null};
}
function pathReview(h,s){
 const early=s.early.indexOf(h.id)+1,mid=s.mid.indexOf(h.id)+1,late=s.late.indexOf(h.id)+1;
 const relevant=h.history.filter(o=>o.transfer.status==='MATCHED_HISTORICAL'&&(early===1?o.role==='EARLY_LEADER':o.role!=='EARLY_LEADER')&&(mid<early||late<early?o.position_changes.some(x=>x>0):true));
 const witness=relevant.map(o=>{
  const rival=s.challengers.find(id=>id!==h.id),shared=rival?o.observed_companions.find(x=>x.id===rival):null;
  return {race:o.race,family:o.family,goals:o.finish===1?['WIN','PLACE']:o.finish<=3&&o.beaten>0?['PLACE']:[],finish:o.finish,beaten:o.beaten,interaction:shared?'SHARED_EARLY_POSITION_OBSERVED':rival?'RIVAL_ROLE_UNESTABLISHED':'NO_CHALLENGER_ASSUMED',race_flow:o.observed_race.phases.map(x=>x.direction),individual_final3f:o.individual_final3f,roots:o.roots,scope:'HISTORICAL_ROLE_WITNESS_NOT_CURRENT_VIABILITY',status:rival&&!shared?'APPLICABILITY_UNESTABLISHED':o.finish===o.field||early===1&&o.finish!==1?'SCOPED_HISTORICAL_COUNTER':'CONDITIONAL_CONTEXT'};
 });
 return {scenario:s.id,subject_role:{early,mid,late},precondition:'Joint hypothetical order and assigned competitor action',witness,missing:['CURRENT_RIVAL_RESPONSE','CURRENT_PACE','INDIVIDUAL_EARLY_SECTIONALS','PHASE_ORDER_REALIZATION'],actual_win_viability:null};
}
function eye01(h,common){
 const out=[];
 const e=common.eye.find(x=>x.horse_id===h.id).items.find(x=>x.eye_item_id==='EYE-01');
 for(const f of e.observed_facts.filter(x=>x.type==='DEFEAT_GAP')){
  const o=h.history.find(x=>x.race===f.value.race_id);if(!o)continue;
  // No universal "small gap": retain measured gap and observed beaten horses.
  const result={race:o.race,finish:o.finish,beaten:o.beaten,gap_tenths:o.winner_gap,clock:o.individual_clock,scope:o.transfer.status,interpretation:o.beaten===0?'COUNTER_TO_COMPETITIVE_PLACING':'NEUTRAL_MEASURED_DEFEAT_CONTEXT',threshold:null,roots:uniq([...o.roots,...f.evidence_ids])};
  out.push(result);
 }
 return out;
}
export function analyzeV20(packet,{disableEye01=false}={}){
 const p=structuredClone(packet);p.target.entrants.sort((a,b)=>a.runner-b.runner);p.history.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));p.history.forEach(r=>r.rows.sort((a,b)=>a.runner-b.runner));
 const v=validateV16(p);if(!v.valid)throw Error('V20_INPUT:'+v.errors.join(','));
 const c=toCommonV16(p),previous=analyzeV19(c),common=runGenerated(c,{versioned:true,allowExternalPeers:true}),measured=p.history.map(r=>measuredRace(r,p.history));
 const profiles=Object.fromEntries(p.target.entrants.map(h=>[h.id,historicalProfile(p,h.id,measured)])),field=makeScenarios(p,profiles);
 const trace=[];
 const decisions=p.target.entrants.map(card=>{
  const id=card.id,history=profiles[id],h={id,history},prior=previous.decisions.find(x=>x.id===id);
  const eye=disableEye01?[]:eye01(h,common);for(const r of eye)trace.push({horse:id,eye:'EYE-01',consumer:'baselineDefeatContext',items:['02','03'],roots:r.roots,judgment:r.interpretation});
  const paths=field.scenarios.map(s=>pathReview(h,s));
  // Evidence families are grouped, not vote weights. A is independent of
  // current-card changes, B expresses only transfer context.
  const baseline=history.map(({transfer,...o})=>o);
  const current=history.map(o=>({race:o.race,role:o.role,transfer:o.transfer,roots:o.roots,pace_context:o.observed_race.phases.map(x=>x.direction),current_effect:null}));
  return {id,history,views:{A:{purpose:'OBSERVED_HISTORICAL_CAPABILITY',observations:baseline,defeat_context:eye},B:{purpose:'CURRENT_CONDITION_TRANSFER',observations:current,actual_effect:null},C:prior.views.C,D:{purpose:'JOINT_ROLE_FEASIBILITY',paths,families:uniq(paths.flatMap(x=>x.witness.map(y=>y.family))),actual_pace:null},E:{...prior.views.E,defeat_context:eye}},prior_eye_returns:previous.returns.filter(x=>x.horse_id===id),rank:null,formal:false};
 });
 return {scope:'SYNTHETIC_RESEARCH_ONLY',measured,field,decisions,trace,prior_traces:previous.traces,audit:previous.audit,actual_pace:null,formal:false,release_eligible:false};
}
