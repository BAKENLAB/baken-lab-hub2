// 02–06 current condition bridge: historical ability evidence, NOT prediction grade.
// The visible five-condition match is not full comparability (layout, eligibility, weight, pace remain unresolved).
// Source: upstream verified research packet and read-only prestart card. No market, rank or target result.
const keys=['track','surface','distance','going','class_name'];
const ids=['02','03','04','05','06'];
const time=x=>typeof x==='string'&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(x)?Date.parse(x):NaN;
const horseId=x=>/^\/JRADB\/accessU\.html\?CNAME=pw01dud[01]0(\d{10})\/[0-9A-F]{2}$/.exec(x??'')?.[1];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function reading(id,v){
 if(id==='02'&&Number.isInteger(v.finish)&&Number.isInteger(v.field_size)&&v.finish>=1&&v.finish<=v.field_size)return {type:'FINISH_CONTEXT',finish:v.finish,field_size:v.field_size,won:v.finish===1,top3:v.finish<=3};
 if(id==='03'&&finite(v.rounded_gap_seconds)&&v.rounded_gap_seconds>=0)return {type:'WINNER_CLOCK_PROXIMITY',gap_seconds:v.rounded_gap_seconds};
 if(id==='04'&&finite(v.rounded_gap_to_next_seconds)&&v.rounded_gap_to_next_seconds>=0)return {type:'NEXT_FINISHER_CLOCK_SEPARATION',gap_seconds:v.rounded_gap_to_next_seconds};
 if(id==='05'&&finite(v.elapsed_seconds))return {type:'CLOCK_CONTEXT',seconds:v.elapsed_seconds,same_race_median_residual_seconds:finite(v.within_race_median_residual_seconds)?v.within_race_median_residual_seconds:null,relative_to_median:!finite(v.within_race_median_residual_seconds)?'UNKNOWN':v.within_race_median_residual_seconds<0?'FASTER':v.within_race_median_residual_seconds>0?'SLOWER':'EQUAL',course_benchmark:null};
 if(id==='06'&&finite(v.final3f_seconds))return {type:'FINISHING_SPEED_CONTEXT',seconds:v.final3f_seconds,rank:v.relative_rank??null,compared:v.compared??null,relative_to_median:!finite(v.median_residual_seconds)?'UNKNOWN':v.median_residual_seconds<0?'FASTER':v.median_residual_seconds>0?'SLOWER':'EQUAL'};
 throw Error('UNSUPPORTED_VALUE');
}
export function connectCondition0206({target,packet}){
 const cutoff=time(target?.cutoff),post=time(target?.post_at);
 if(!Number.isFinite(cutoff)||!Number.isFinite(post)||cutoff>=post||target.target_date!==packet?.targetDate||packet.circuit!=='JRA'||packet.scoring_authorized!==false||keys.some(k=>target[k]===null||target[k]===undefined||target[k]==='')||!Array.isArray(target.roster)||target.roster.length!==target.field_size||!Array.isArray(packet.runners)||!Array.isArray(packet.rows))throw Error('TARGET_GATE');
 const roster=new Map(target.roster.map(h=>[h.horse_no,h]));
 if(roster.size!==target.field_size||new Set(target.roster.map(h=>horseId(h.horse_ref))).size!==target.field_size||target.roster.some(h=>!horseId(h.horse_ref)||!(time(h.source_checked_at)<post)))throw Error('ROSTER_GATE');
 if(packet.runners.length!==roster.size||new Set(packet.runners.map(h=>h.horse_no)).size!==roster.size||packet.runners.some(h=>!roster.has(h.horse_no)))throw Error('ROSTER_MISMATCH');
 const seen=new Set();
 const histories=packet.rows.map(r=>{
  const h=roster.get(r.horse_no),key=JSON.stringify([r.horse_no,r.prior_ref]);
  if(!h||horseId(h.horse_ref)!==r.horse_id||!r.prior_ref||r.prior_date>=target.target_date||!(time(r.source_checked_at)<=time(h.source_checked_at))||!(time(r.source_checked_at)<post)||seen.has(key))throw Error('PRIOR_GATE');seen.add(key);
  const differences=keys.filter(k=>r.conditions?.[k]!==target[k]),matching=keys.filter(k=>r.conditions?.[k]===target[k]);
  const exact=differences.length===0;
  const context=exact?'VISIBLE_FIVE_MATCH':r.conditions?.surface===target.surface&&r.conditions?.distance===target.distance&&r.conditions?.class_name===target.class_name?'SURFACE_DISTANCE_CLASS_MATCH':'OTHER_CONDITIONS';
  const days=(Date.parse(target.target_date)-Date.parse(r.prior_date))/86400000;
  if(!Number.isInteger(days)||days<=0)throw Error('PRIOR_DATE');
  const findings={};
  for(const id of ids){const e=r.items?.[id];if(e?.status==='RESEARCH_OBSERVATION'&&r.source_match===true)findings[id]={reading:reading(id,e.value),scope:e.scope,evidence_ref:r.prior_ref,dependency_group:key};}
  return {horse_no:r.horse_no,horse_id:r.horse_id,prior_date:r.prior_date,days_since:days,prior_ref:r.prior_ref,conditions:r.conditions,matching,differences,context,source_match:r.source_match===true,findings,unverified_card:r.source_match!==true&&!!r.card_only};
 });
 const runners=target.roster.map(h=>{
  const history=histories.filter(r=>r.horse_no===h.horse_no).sort((a,b)=>b.prior_date.localeCompare(a.prior_date));
  const assessments=Object.fromEntries(ids.map(id=>{
   const available=history.filter(r=>r.findings[id]);
   const exact=available.filter(r=>r.context==='VISIBLE_FIVE_MATCH');
   const similar=available.filter(r=>r.context==='SURFACE_DISTANCE_CLASS_MATCH');
   const other=available.filter(r=>r.context==='OTHER_CONDITIONS');
   // All source-bound findings are passed to the downstream ability evidence packet,
   // without selecting favorable runs or turning repeated dependent features into votes.
   const pack=a=>a.map(r=>({date:r.prior_date,days_since:r.days_since,ref:r.prior_ref,conditions:r.conditions,matching:r.matching,differences:r.differences,...r.findings[id]}));
   return [id,{status:exact.length?'VISIBLE_CONDITION_EVIDENCE_CONSUMED':similar.length?'PARTIAL_CONDITION_EVIDENCE_CONSUMED':other.length?'HISTORICAL_CONTEXT_ONLY':'MISSING',exact_visible:pack(exact),partial_visible:pack(similar),other:pack(other),unverified_matching_cards:history.filter(r=>r.unverified_card&&r.context==='VISIBLE_FIVE_MATCH').map(r=>r.prior_ref),full_comparability:false,unresolved:['COURSE_LAYOUT','AGE_SEX_ELIGIBILITY','WEIGHT_COMPARISON','CURRENT_RELEVANCE_VALIDATION'],final_grade_effect:null}];
  }));
  return {horse_no:h.horse_no,horse_id:horseId(h.horse_ref),assessments,history_count:history.length};
 });
 const coverage=Object.fromEntries(ids.map(id=>[id,{visible_match:runners.filter(h=>h.assessments[id].exact_visible.length).length,partial_match:runners.filter(h=>h.assessments[id].partial_visible.length).length,historical_only:runners.filter(h=>h.assessments[id].status==='HISTORICAL_CONTEXT_ONLY').length,missing:runners.filter(h=>h.assessments[id].status==='MISSING').length}]));
 return {circuit:'JRA',target_date:target.target_date,track:target.track,race_no:target.race_no,cutoff:target.cutoff,condition_keys:keys,runners,coverage,history_counts:{source_matched:histories.filter(r=>r.source_match).length,visible_match_verified:histories.filter(r=>r.source_match&&r.context==='VISIBLE_FIVE_MATCH').length,visible_match_unverified:histories.filter(r=>r.unverified_card&&r.context==='VISIBLE_FIVE_MATCH').length},full_comparability_verified:false,final_assessment_connected:false,scoring_authorized:false};
}
