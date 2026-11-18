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
export function buildLocal16ContentReview(context,facts=null){
 const runners=context.runners;
 const factByNo=new Map(Array.isArray(facts?.per_runner)?facts.per_runner.map(r=>[r.horse_no,r]):[]);
 const factsReady=facts?.status==='VERIFIED_WHOLE_FIELD_FACTS'&&facts?.runner_count===runners.length&&factByNo.size===runners.length;
 const per=runners.map(r=>{
  const f=factByNo.get(r.horse_no);
  const refs=r.recent_runs.map((_,i)=>'COMPACT_V1.runners[horse_no='+r.horse_no+'].recent_runs['+i+']');
  return {horse_no:r.horse_no,horse_name:r.horse_name,
   verified_history_runs:r.recent_runs.length,
   corner_runs:r.recent_runs.filter(h=>pos(h.early_pos)&&pos(h.final_turn_pos)).length,
   last3f_runs:r.recent_runs.filter(h=>has(h.final3f)).length,
   raw_margin_runs:r.recent_runs.filter(h=>has(h.margin)).length,
   official_history_refs:refs,
   content_fact_refs:factsReady?f.runs.map(x=>x.evidence_ref):[],
   head_to_head_count:factsReady?facts.head_to_head.filter(x=>x.horse_nos.includes(r.horse_no)).length:0,
   course_transition_matches:factsReady?f.runs.filter(x=>x.course_transition_evidence).length:0,
   loss_with_merit_review_candidates:factsReady?f.loss_review_candidate_count:0,
   scoring_reason_contract:'CITE_MATERIAL_FAVORABLE_AND_UNFAVORABLE_VERIFIED_FACTS_OR_EXPLICIT_MISSING_LIMITATION'};
 });
 return {status:factsReady?'READY_FOR_LOCAL_1_6_FULL_FIELD_REVIEW':'CONTENT_FACTS_REQUIRED',
  effective_mode:'LOCAL_1_6_ORIGINAL_PROTOCOL_VERIFIED_CONTENT',
  action:'USE_VERIFIED_FACTS_IN_INDEPENDENT_100_POINT_SCORING_BEFORE_TOP5_EYE',
  decision_contract:'REQUIRED_FOR_LOCAL_1_6_100_POINT_REASON',
  instruction:'Compare every ACTIVE horse equally using original LOCAL_MAIN 1.6. Do not substitute an experimental score or fixed 30/25/20/15/10 rubric. Before fixing ranks, read official_past_content for every runner and cite material favorable and unfavorable facts or an explicit missing-data limitation in that runner scoring reason. Review actual corners, finish, raw margin, last3f, class, course transition evidence, distance, going, weight and verified same-race opponents; treat loss_with_merit entries only as review candidates. Never infer unavailable laps, incidents, opponent follow-up quality, or winner seconds. Independently assign 100-point score and grade, then rank all horses, fix TOP5, and independently review all outsiders under the established 17-item EYE gate. No automatic boost.',
  score_or_rank_override:false,research_model_adopted:false,full_field_count:runners.length,
  equal_depth_required:true,equal_depth_runner_count:per.length,
  official_past_content_required:true,per_runner_coverage:per,
  full_race_laps_available:false,opponent_followup_available:false,
  market_used:false,target_result_used:false,save_authorized:false};
}
export function assertLocal16NoUnauthorizedRubric(protocol,payload){
 const x=payload?.audit?.manual_score_breakdown;
 if(protocol==='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'&&x&&
    Array.isArray(x.maxima)&&JSON.stringify(x.maxima)==='[30,25,20,15,10]')
  throw Error('LOCAL_1_6_UNAPPROVED_FIXED_WEIGHT_RUBRIC');
 return true;
}
