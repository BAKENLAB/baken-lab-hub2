// LOCAL 1.6: verified facts, not research scores or an alternative fixed rubric.
const key=r=>JSON.stringify([r.race_date,r.track,Number(r.race_no)]);
const pos=x=>Number.isInteger(x)&&x>=1&&x<=24;
const has=x=>x!==null&&x!==undefined&&x!=='';
export function mergeVerifiedLocalCornerFacts(original,shadow,targetDate){
 if(!Array.isArray(original)||!original.length||shadow?.status!=='DESCRIPTIVE_SHADOW_ONLY'||
    shadow.use_for_rank!==false||shadow.market_used!==false||
    !Array.isArray(shadow.runners)||shadow.runners.length!==original.length||
    !Array.isArray(shadow.verified_corner_sources))throw Error('UNVERIFIED_CORNER_OVERLAY');
 const sources=new Map(),byNo=new Map(shadow.runners.map(r=>[r.horse_no,r]));
 if(byNo.size!==original.length)throw Error('CORNER_ROSTER_MISMATCH');
 for(const e of shadow.verified_corner_sources){
  if(!e||!pos(e.early_pos)||!pos(e.final_turn_pos)||
     typeof e.past_race?.race_date!=='string'||e.past_race.race_date>=targetDate||
     !e.official_source_ref||e.verification_scope!=='PRECLAIM_OFFICIAL_PAST_RESULT')
    throw Error('INVALID_CORNER_SOURCE');
  const k=e.current_horse_no+'|'+key(e.past_race);
  if(sources.has(k))throw Error('DUPLICATE_CORNER_SOURCE');sources.set(k,e);
 }
 const covered=new Set();let linked=0;
 const runners=original.map(r=>{
  const rich=byNo.get(r.horse_no);
  if(!rich||rich.horse_name!==r.horse_name||
     !Array.isArray(r.recent_runs)||!Array.isArray(rich.recent_runs)||
     r.recent_runs.length!==rich.recent_runs.length)throw Error('CORNER_ROSTER_MISMATCH');
  return {...r,recent_runs:r.recent_runs.map(h=>{
   const e=sources.get(r.horse_no+'|'+key(h));if(!e)return {...h};
   const matches=rich.recent_runs.filter(x=>key(x)===key(h));
   if(matches.length!==1||h.race_date>=targetDate||
      matches[0].early_pos!==e.early_pos||matches[0].final_turn_pos!==e.final_turn_pos||
      (has(h.early_pos)&&h.early_pos!==e.early_pos)||
      (has(h.final_turn_pos)&&h.final_turn_pos!==e.final_turn_pos))
    throw Error('CORNER_IDENTITY_OR_POSITION_CONFLICT');
   linked++;covered.add(r.horse_no);
   return {...h,early_pos:e.early_pos,final_turn_pos:e.final_turn_pos};
  })};
 });
 if(linked!==sources.size||linked!==shadow.applied_prior_runs)throw Error('CORNER_COVERAGE_MISMATCH');
 return {runners,coverage:{verified_corner_runs:linked,horses_with_new_verified_corner_facts:covered.size,active_horses:runners.length,automatic_score_effect:0}};
}
export function buildLocal16ContentReview(context){
 const runners=context.runners;
 const per=runners.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
  verified_history_runs:r.recent_runs.length,
  corner_runs:r.recent_runs.filter(h=>pos(h.early_pos)&&pos(h.final_turn_pos)).length,
  last3f_runs:r.recent_runs.filter(h=>has(h.final3f)).length,
  raw_margin_runs:r.recent_runs.filter(h=>has(h.margin)).length,
  official_history_refs:r.recent_runs.map((_,i)=>'COMPACT_V1.runners[horse_no='+r.horse_no+'].recent_runs['+i+']')}));
 return {status:'READY_FOR_LOCAL_1_6_FULL_FIELD_REVIEW',
  effective_mode:'LOCAL_1_6_ORIGINAL_PROTOCOL_VERIFIED_CONTENT',
  action:'USE_VERIFIED_FACTS_IN_INDEPENDENT_100_POINT_SCORING_BEFORE_TOP5_EYE',
  instruction:'Compare every ACTIVE horse equally using original LOCAL_MAIN 1.6. Do not substitute an experimental score or fixed 30/25/20/15/10 rubric. Review actual corners, finish, raw margin, last3f, class, course, distance, going, weight, transfer and same-race opponents from official as-of facts; never treat NAR preceding-horse margins as winner seconds, or infer unavailable laps, incidents or opponent quality. Independently assign 100-point score and grade, document individual material and limitations, then rank all horses, fix TOP5, and independently review all outsiders under the established 17-item EYE gate. No automatic boost.',
  score_or_rank_override:false,research_model_adopted:false,full_field_count:runners.length,
  per_runner_coverage:per,full_race_laps_available:false,market_used:false,target_result_used:false,save_authorized:false};
}
export function assertLocal16NoUnauthorizedRubric(protocol,payload){
 const x=payload?.audit?.manual_score_breakdown;
 if(protocol==='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'&&x&&
    Array.isArray(x.maxima)&&JSON.stringify(x.maxima)==='[30,25,20,15,10]')
  throw Error('LOCAL_1_6_UNAPPROVED_FIXED_WEIGHT_RUBRIC');
 return true;
}
