// Optional evidence review only. No scores, rank changes, EYE assignment or I/O.
export const EYE_REVIEW_VERSION='JRA_TURF_EYE_ADDITIONAL_AUDIT_20261115';
const integer=x=>Number.isInteger(x)&&x>0;
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:
 typeof x==='string'&&/^\d+(?:\.\d+)?$/.test(x)?Number(x):null;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x));
const turf=x=>x==='芝'||x==='turf'||x==='TURF';
const key=r=>JSON.stringify([r.race_date,r.track,r.surface,r.distance]);
function runsFor(horse,race){
 const out=[],seen=new Set();
 for(const [i,r] of (horse.past_runs??[]).slice(0,4).entries()){
  if(!day(r?.race_date)||r.race_date>=race.race_date)continue;
  const finish=number(r.finish),distance=number(r.distance),field=number(r.field_size);
  if(!integer(finish)||!integer(distance))continue; // cancellations/events are not races
  if(field!==null&&(!integer(field)||finish>field))continue;
  const id=key(r);if(seen.has(id))continue;seen.add(id);
  const raw=number(r.early_pos),early=integer(raw)&&raw<=18&&(field===null||raw<=field)?raw:null;
  const margin=number(r.margin_to_winner);
  out.push({race_date:r.race_date,track:r.track??null,surface:r.surface??null,
   distance,finish,early_pos:early,field_size:field,
   margin_to_winner:margin!==null&&margin>=0?margin:null,
   pos_change:number(r.pos_change), // negative values deliberately not interpreted as progress
   source_ref:`JRA_CLAIMED_CONTEXT.runner_history[horse_no=${horse.horse_no}].past_runs[${i}]`});
 }
 return out;
}
function rankMap(ranking,horses){
 if(ranking===null)return null;
 if(!Array.isArray(ranking)||ranking.length!==horses.length)throw Error('EYE_REVIEW_RANK_SET');
 const map=new Map();const ranks=new Set();
 for(const r of ranking){const h=horses.find(x=>x.horse_no===r?.horse_no);
  if(!h||h.horse_name!==r.horse_name||!integer(r.rank)||r.rank>horses.length||map.has(r.horse_no)||ranks.has(r.rank))throw Error('EYE_REVIEW_RANK_IDENTITY');
  map.set(r.horse_no,r.rank);ranks.add(r.rank);
 }
 return map;
}
export function buildEyeAdditionalAudit({race,runnerHistory,observedAt,finalizedRanking=null}){
 if(!race||!day(race.race_date)||!Number.isFinite(Date.parse(race.post_time))||
  !Number.isFinite(Date.parse(observedAt))||Date.parse(observedAt)>=Date.parse(race.post_time))throw Error('EYE_REVIEW_ASOF');
 const common={version:EYE_REVIEW_VERSION,rank_effect:false,top5_effect:false,
  auto_select_eye:false,formal_save_authorized:false,market_used:false,target_result_used:false};
 if(!turf(race.surface))return {...common,status:'DIRT_OR_NON_TURF_UNCHANGED',runners:[],candidates:[]};
 if(!integer(race.distance)||!Array.isArray(runnerHistory)||runnerHistory.length<1||runnerHistory.length>18)throw Error('EYE_REVIEW_FIELD');
 const horses=runnerHistory.filter(h=>h?.status!=='CANCELLED'&&h?.status!=='EXCLUDED');
 if(horses.some(h=>!integer(h.horse_no)||typeof h.horse_name!=='string'||!h.horse_name||!Array.isArray(h.past_runs))||new Set(horses.map(h=>h.horse_no)).size!==horses.length)throw Error('EYE_REVIEW_IDENTITY');
 const ranks=rankMap(finalizedRanking,horses);
 const rows=horses.map(h=>{
  const runs=runsFor(h,race),positions=runs.filter(r=>r.early_pos!==null);
  const matching=runs.filter(r=>turf(r.surface)&&Math.abs(r.distance-race.distance)<=200);
  const frontGood=matching.filter(r=>r.early_pos!==null&&r.early_pos<=3&&(r.finish===1||(r.margin_to_winner!==null&&r.margin_to_winner<=0.6)));
  const staminaGood=runs.filter(r=>turf(r.surface)&&r.distance>=race.distance&&(r.finish<=3||(r.margin_to_winner!==null&&r.margin_to_winner<=0.6)));
  return {horse_no:h.horse_no,horse_name:h.horse_name,rank:ranks?.get(h.horse_no)??null,
   valid_early_count:positions.length,early_sum:positions.reduce((n,r)=>n+r.early_pos,0),
   mean_early_position:positions.length?positions.reduce((n,r)=>n+r.early_pos,0)/positions.length:null,
   dense_early_rank:null,front_good_count:frontGood.length,stamina_good_count:staminaGood.length,
   front_good_runs:frontGood,stamina_good_runs:staminaGood,all_verified_runs:runs,
   draw:integer(h.draw)?h.draw:null,
   missing:['verified_trouble_or_incident','course_geometry_effect','pace_outcome_causality',
    ...(positions.length<2?['two_valid_early_positions']:[]),...(!integer(h.draw)?['draw']:[])]};
 });
 const sorted=rows.filter(r=>r.valid_early_count>=2).slice().sort((a,b)=>a.early_sum*b.valid_early_count-b.early_sum*a.valid_early_count||a.horse_no-b.horse_no);
 let dense=0,prior=null;
 for(const r of sorted){if(!prior||r.early_sum*prior.valid_early_count!==prior.early_sum*r.valid_early_count)dense++;r.dense_early_rank=dense;prior=r;}
 const short=race.distance<=1800;
 const candidates=ranks===null?[]:rows.filter(r=>r.rank>5&&(short?
  r.valid_early_count>=2&&r.dense_early_rank<=3&&r.front_good_count>=1:r.stamina_good_count>=1));
 candidates.sort((a,b)=>short?(b.front_good_count-a.front_good_count||
  a.early_sum*b.valid_early_count-b.early_sum*a.valid_early_count||a.rank-b.rank):
  b.stamina_good_count-a.stamina_good_count||a.rank-b.rank);
 return {...common,status:ranks===null?'FULL_FIELD_REVIEW_AWAITING_FINAL_RANK':'ADDITIONAL_AUDIT_ONLY',
  segment:short?'TURF_LE_1800':'TURF_GT_1800',runners:rows,candidates,
  finalized_rank_used:ranks!==null,position_coverage_complete:rows.every(r=>r.valid_early_count>=2),
  dense_rank_scope:'ALL_ACTIVE_WITH_AT_LEAST_TWO_VALID_EARLY_POSITIONS',
  existing_eye_policy:short?'COMPARE_EXISTING_EYE_AND_FILL_NULL_FIRST':'PRESERVE_CURRENT_EYE_FIRST',
  formal_audit:{all_outside_top5_required:true,minimum_independent_current_factors:2,
   duplicate_evidence_forbidden:true,negative_conditions_required:true,
   compare_with_existing_eye_required:true,maximum_eye:1,
   candidate_filter_alone_is_not_authorization:true},
  instruction:'Candidate evidence is not an EYE decision. Reaudit ALL outside TOP5; verify two independent current factors and risks. Do not double count a run, infer trouble, change rank/TOP5, or use market data. Long turf preserves existing EYE; dirt is unchanged.'};
}
export function reviewClaimContext(context,observedAt,finalizedRanking=null){
 const field=context?.race?.field_payload,official=field?.runners;
 if(context?.stage!=='AWAITING_JRA_FULL_DEPTH_COMPARISON'||!Array.isArray(official)||!Array.isArray(context.runner_history))throw Error('EYE_REVIEW_CONTEXT');
 if(field?.official_status_verification?.verified!==true)throw Error('EYE_REVIEW_OFFICIAL_FIELD');
 const active=official.filter(r=>r.status==='ACTIVE');
 if(official.some(r=>!['ACTIVE','CANCELLED','EXCLUDED'].includes(r.status))||new Set(active.map(r=>r.horse_no)).size!==active.length)throw Error('EYE_REVIEW_OFFICIAL_FIELD');
 const history=active.map(r=>{const found=context.runner_history.filter(h=>h.horse_no===r.horse_no&&h.horse_name===r.horse_name);if(found.length!==1)throw Error('EYE_REVIEW_IDENTITY');return {...found[0],status:'ACTIVE'};});
 return buildEyeAdditionalAudit({race:{race_date:context.race.race_date,post_time:context.race.post_time,surface:field.race?.surface,distance:field.race?.distance},runnerHistory:history,observedAt,finalizedRanking});
}

// Optional and fail-open: never blocks the existing context or save path.
export function safeEyeAdditionalAudit(context,observedAt,ranking=null){
 try{return reviewClaimContext(context,observedAt,ranking)}
 catch{return {version:EYE_REVIEW_VERSION,status:'OPTIONAL_REVIEW_UNAVAILABLE',auto_select_eye:false,rank_effect:false,top5_effect:false,formal_save_authorized:false,candidates:[]}}
}

