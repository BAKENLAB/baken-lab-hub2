// REBORN2 partial base ability and historical winning-capacity evidence (01/12).
// Consumes 02–06 actually; not a complete 01 or 12, current prediction, grade, or release permission.
// One prior race is one evidence unit. No additive scoring or assumption that repeated correlated metrics are independent.
const ids=['02','03','04','05','06'],unfinished=['07','08','09','10','11'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const stat=(v)=>v===null||v===undefined?null:v;
function validateMetric(m,n){
 if(!m||!Number.isInteger(m.observed_n)||m.observed_n<0||m.observed_n>n)throw Error('METRIC_COVERAGE');
}
function classifyRelative(s){
 if(!s)return 'UNKNOWN';
 if(!finite(s.min)||!finite(s.max)||!finite(s.median)||s.min>s.median||s.median>s.max)throw Error('RELATIVE_STAT');
 if(s.min<0&&s.max>0)return 'MIXED_FASTER_AND_SLOWER';
 if(s.max<=0&&s.min<0)return 'AT_OR_FASTER_THAN_FIELD_MEDIAN';
 if(s.min>=0&&s.max>0)return 'AT_OR_SLOWER_THAN_FIELD_MEDIAN';
 return 'FIELD_MEDIAN_EQUAL';
}
export function integrateBase0112({profile,roster,targetDate}){
 if(profile?.scoring_authorized!==false||profile?.final_grade_connected!==false||profile?.target_date!==targetDate||!Array.isArray(profile.runners)||!Array.isArray(roster)||roster.length===0||new Set(roster).size!==roster.length||profile.runners.length!==roster.length||new Set(profile.runners.map(h=>h.horse_no)).size!==roster.length||profile.runners.some(h=>!roster.includes(h.horse_no)))throw Error('PROFILE_GATE');
 const runners=profile.runners.map(h=>{
  const cohorts=[...h.visible_condition_profiles,...h.other_condition_profiles],seen=new Set();
  const evidence=cohorts.map(c=>{
   if(!Array.isArray(c.source_refs)||!Number.isInteger(c.history_n)||c.history_n<1||c.source_refs.length!==c.history_n||!Number.isInteger(c.days_since_latest)||c.days_since_latest<=0||!['CARD_ARCHIVE_CROSSCHECK','ARCHIVE_ID_MATCH'].includes(c.tier)||c.current_relevance_validated!==false)throw Error('COHORT_GATE');
   for(const r of c.source_refs){if(typeof r!=='string'||!r||seen.has(r))throw Error('DUPLICATE_RACE_EVIDENCE');seen.add(r);}
   for(const k of ids)validateMetric(c.metrics?.[k],c.history_n);
   const [f,g,n,t,s]=ids.map(k=>c.metrics[k]);
   if(f.observed_n&&(!Number.isInteger(f.wins)||!Number.isInteger(f.top3)||f.wins<0||f.wins>f.top3||f.top3>f.observed_n))throw Error('FINISH_COUNTS');
   const winning=f.observed_n===0?'UNKNOWN':f.wins>0?'WIN_DEMONSTRATED':f.top3>0?'TOP3_DEMONSTRATED_NO_WIN_IN_SAMPLE':'NO_TOP3_OBSERVED_IN_SAMPLE';
   // Winning capacity is only demonstrated historical achievement, not today's probability or a negative inference from sparse data.
   const item12={status:f.observed_n?'HISTORICAL_WIN_EVIDENCE':'MISSING',finding:winning,starts:f.observed_n,wins:stat(f.wins),top3:stat(f.top3),winner_gap_seconds:stat(g.gap_seconds),next_finisher_gap_seconds:stat(n.gap_seconds),opponent_strength:'UNVALIDATED',scenario_fit:'UNVALIDATED',current_win_ability:'UNVALIDATED'};
   const dimensions={
    outcome:{observations:f.observed_n,finish_percentile:stat(f.relative_finish_percentile),winning},
    proximity:{winner_gap_n:g.observed_n,winner_gap_seconds:stat(g.gap_seconds),next_gap_n:n.observed_n,next_gap_seconds:stat(n.gap_seconds)},
    clock:{observations:t.observed_n,relative_field_clock:classifyRelative(t.relative_clock_seconds),relative_clock_seconds:stat(t.relative_clock_seconds),raw_seconds:stat(t.elapsed_seconds),course_benchmark:'MISSING'},
    closing:{observations:s.observed_n,relative_field_final3f:classifyRelative(s.relative_final3f_seconds),relative_final3f_seconds:stat(s.relative_final3f_seconds),relative_final3f_rank_percentile:stat(s.relative_final3f_rank_percentile)}
   };
   // A contradiction is retained rather than averaged away: e.g. no top3 but faster closing section.
   const closingFast=dimensions.closing.relative_field_final3f==='AT_OR_FASTER_THAN_FIELD_MEDIAN';
   const contradiction=winning==='NO_TOP3_OBSERVED_IN_SAMPLE'&&closingFast?'NO_TOP3_BUT_RELATIVE_CLOSING_SPEED_DEMONSTRATED':null;
   return {source_tier:c.tier,conditions:c.conditions,visible_match:c.visible_match,condition_differences:c.condition_differences,history_n:c.history_n,latest_date:c.most_recent_date,days_since_latest:c.days_since_latest,source_refs:c.source_refs,evidence_unit:'ONE_PRIOR_RACE_NO_ADDITIVE_VOTES',consumed_items:ids.filter(k=>c.metrics[k].observed_n>0),dimensions,item12,contradiction,current_relevance:'UNVALIDATED'};
  });
  if(seen.size!==h.historical_runs)throw Error('HISTORY_MISMATCH');
  const consumed=ids.filter(k=>evidence.some(x=>x.consumed_items.includes(k)));
  return {horse_no:h.horse_no,historical_runs:seen.size,item01:{status:evidence.length?'PARTIAL_HISTORICAL_BASE_ABILITY':'MISSING',consumed_items:consumed,missing_items:[...ids.filter(k=>!consumed.includes(k)),...unfinished],item12_status:evidence.some(x=>x.item12.status==='HISTORICAL_WIN_EVIDENCE')?'PARTIAL_HISTORICAL_WIN_EVIDENCE':'MISSING',visible_condition_evidence:evidence.filter(x=>x.visible_match),other_condition_evidence:evidence.filter(x=>!x.visible_match),unresolved:['CURRENT_RELEVANCE','FULL_COURSE_CONDITIONS','OPPONENT_STRENGTH','PACE_SCENARIO','07_TO_11','FINAL_INTEGRATION'],current_ability:null,final_grade_effect:null}};
 });
 return {target_date:targetDate,circuit:profile.circuit,runners,historical_base_horses:runners.filter(h=>h.item01.status==='PARTIAL_HISTORICAL_BASE_ABILITY').length,win_evidence_horses:runners.filter(h=>h.item01.item12_status==='PARTIAL_HISTORICAL_WIN_EVIDENCE').length,win_demonstrated_horses:runners.filter(h=>[...h.item01.visible_condition_evidence,...h.item01.other_condition_evidence].some(x=>x.item12.finding==='WIN_DEMONSTRATED')).length,visible_win_horses:runners.filter(h=>h.item01.visible_condition_evidence.some(x=>x.item12.finding==='WIN_DEMONSTRATED')).length,complete_items:0,scoring_authorized:false,final_grade_connected:false};
}
