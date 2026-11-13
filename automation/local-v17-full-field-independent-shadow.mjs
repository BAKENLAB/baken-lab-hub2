/**
 * BAKEN LAB LOCAL 1.7 (from zero) — independent PRE-RACE shadow prototype.
 *
 * This is NOT a 1.6 re-sort and NOT a 5/6 swap. No baseline rank or score
 * is accepted as input; every horse gets the same scoring features and
 * historical-evidence audit BEFORE the engine determines any rank.
 *
 * Run only against an already officially verified live CLAIM context.
 * Results, payouts, odds, market ranks, target-day outcomes, or data acquired
 * after start are forbidden. Missing facts produce uncertainty, NOT a penalty.
 *
 * UNRELEASED/UNCALIBRATED. No production ranking, FROZEN or EYE mutation.
 */
import {resolveLocalOfficialClassLiteral} from './local-verified-condition-bridge.mjs';
import {HYOGO_ABILITY_SOURCE} from './hyogo-official-ability-evidence.mjs';

const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const isDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'));
const time=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const localDay=x=>Number.isFinite(time(x))?new Date(time(x)+9*3600000).toISOString().slice(0,10):null;
const nr=x=>Number.isInteger(x)&&x>=1&&x<=24;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const validSourceRef=(s,n)=>typeof s==='string'&&
 /^COMPACT_V1\.runners\[horse_no=\d{1,2}\]\.recent_runs\[\d\]$/.test(s)&&
 s.includes('horse_no='+n+']');
const leakKeys=/^(?:win_odds|odds|popularity|market|result|finishers|payouts|target_result|result_finish|baseline_rank|baseline_score)$/i;
const hasLeak=v=>{
 if(!v||typeof v!=='object')return false;
 if(Array.isArray(v))return v.some(hasLeak);
 return Object.entries(v).some(([k,x])=>leakKeys.test(k)||hasLeak(x));
};
const stop=(reason,more={})=>({
 status:'UNVERIFIED',reason,model:'LOCAL_1_7_INDEPENDENT_SHADOW_V0_3',
 version:'1.7-research-v0.3',production_rank_effect:false,production_eye_effect:false,
 frozen_modified:false,market_used:false,target_result_used:false,...more
});
const scoreBound=n=>Math.min(100,Math.max(0,Math.round(n)));
const ageDays=(today,day)=>(Date.parse(today+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/86400000;
// Finishing 6th-or-worse is not automatically a positive ability factor.
const rankWeight=finish=>finish===1?28:finish===2?22:finish===3?16:
 finish<=5?9:0;

/** Independently authenticated NAR historic result, never a market URL. */
const NAR_CODES=Object.freeze({
 '盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20',
 '川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27',
 '姫路':'28','高知':'31','佐賀':'32','門別':'36'
});
const officialCornerUrl=w=>{
 const code=NAR_CODES[w.track];
 return code&&isDay(w.race_date)&&nr(w.race_no)?
  'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?'+
  'k_babaCode='+code+'&k_raceDate='+w.race_date.replaceAll('-','%2F')+
  '&k_raceNo='+w.race_no:null;
};
/** The optional official corner lane is NOT proof on its own. Each
 * accepted historic result must match a distinct, already-authorized
 * COMPACT run by athlete, historical date/venue/race, official URL,
 * exact two turn positions and server-verified pre-post capture time.
 */
function certifiedCornerByRun(comparison,race){
 const scope=comparison?.corner_evidence_scope;
 const witnesses=comparison?.verified_corner_witnesses;
 if(scope===undefined&&witnesses===undefined)
  return {status:'NO_INDEPENDENT_CORNER_WITNESSES',byRef:new Map()};
 if(scope!=='VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY'||
    !Array.isArray(witnesses)||!witnesses.length||
    !Number.isInteger(comparison.corner_enriched_prior_runs)||
    comparison.corner_enriched_prior_runs!==witnesses.length||
    witnesses.length>100)
  return {status:'CORNER_WITNESS_SCOPE_OR_COUNT_UNVERIFIED'};
 const byRef=new Map();
 const runners=new Map(comparison.runner_evidence.map(r=>[r.horse_no,r]));
 for(const w of witnesses){
  const runner=runners.get(w?.horse_no),checked=time(w?.source_checked_at);
  if(!runner||norm(runner.horse_name)!==norm(w?.horse_name)||
     typeof w.evidence_ref!=='string'||
     !validSourceRef(w.evidence_ref,w.horse_no)||byRef.has(w.evidence_ref)||
     w.verification_scope!=='VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT'||
     !Number.isFinite(checked)||checked>time(race.observation_at)||
     checked>=time(race.post_time)||!isDay(w.race_date)||
     w.race_date>=race.race_date||
     !nr(w.early_pos)||!nr(w.final_turn_pos)||!nr(w.race_no)||
     w.official_source_ref!==officialCornerUrl(w)||
     !Array.isArray(runner.context_runs))
   return {status:'CORNER_WITNESS_ASOF_OR_SOURCE_INVALID'};
  const matched=runner.context_runs.filter(h=>h.evidence_ref===w.evidence_ref);
  if(matched.length!==1||matched[0].race_date!==w.race_date||
     matched[0].track!==w.track||matched[0].race_no!==w.race_no||
     matched[0].early_pos!==w.early_pos||
     matched[0].final_turn_pos!==w.final_turn_pos)
   return {status:'CORNER_WITNESS_HISTORIC_IDENTITY_MISMATCH'};
  byRef.set(w.evidence_ref,w);
 }
 return {status:'VERIFIED_PRECLAIM_CORNER_WITNESSES',byRef};
}


/** Simple, interpretable prior-run signals; NO retrospective calibration. */
function evaluateRun(h,conditions,horseNo,usedRefs,cornerWitness=null){
 if(!h||!validSourceRef(h.evidence_ref,horseNo)||usedRefs.has(h.evidence_ref)||
    !isDay(h.race_date)||h.race_date>=conditions.race_date||hasLeak(h)||
    !norm(h.track)||!Number.isInteger(h.finish)||h.finish<1||h.finish>24||
    (h.distance!==null&&!Number.isInteger(h.distance))||
    (h.distance!==null&&(h.distance<800||h.distance>3600))||
    ![null,'ダート','芝'].includes(h.surface??null))
  return null;
 usedRefs.add(h.evidence_ref);
 const days=ageDays(conditions.race_date,h.race_date);
 if(days<0)return null;
 const surfaceMatch=h.surface===conditions.surface;
 const surfaceUnknown=h.surface===null||h.surface===undefined;
 const courseMatch=norm(h.track)===norm(conditions.track);
 const distanceDelta=Number.isInteger(h.distance)?
   Math.abs(h.distance-conditions.distance):null;
 // Official grade can be recorded as C2一3歳以上 or C4-3 rather than C2/C4.
 // The venue-aware parser is required, not raw class-string equality.
 const priorClass=resolveLocalOfficialClassLiteral(h.class??null,h.track);
 const cls=priorClass.class_label;
 const priorSpecialSelection=/特別編成|記者選抜|ファイナル/.test(
   norm(h.race_name)+' '+norm(h.class));
 const sameClass=!conditions.specialSelection&&!priorSpecialSelection&&
   courseMatch&&priorClass.status!=='AMBIGUOUS_CLASS'&&!!cls&&
   conditions.target_class!==null&&cls===conditions.target_class;
 // Even JRA/other-NAR history stays in the evaluation pool.
 // Different venue and distance are NEVER interpreted as poor ability.
 const contextBand=!surfaceMatch?'SURFACE_CHANGED_OR_UNKNOWN':
   !courseMatch?'OTHER_TRACK':
   distanceDelta!==null&&distanceDelta>300?'LONG_DISTANCE_CHANGE':
   conditions.specialSelection||priorSpecialSelection?
     'SPECIAL_SELECTION_CLASS_COMPARABILITY_UNVERIFIED':
   !sameClass?'CLASS_OR_GROUP_UNVERIFIED':'SAME_OFFICIAL_CLASS';
 // CRITICAL: an 8th/10th must not receive +15 to +20 points merely
 // for racing recently on the same course. Those are context facts, not
 // positive performance. Unknown transfer/class never becomes poor ability.
 const positivePerformance=h.finish<=5;
 const freshness=positivePerformance?(days<=45?6:days<=120?4:days<=240?2:
   days<=540?1:0):0;
 const matchBonus=positivePerformance?((surfaceMatch?3:0)+(courseMatch?3:0)+
   (distanceDelta!==null&&distanceDelta<=100?5:
    distanceDelta!==null&&distanceDelta<=300?2:0)+(sameClass?3:0)):0;
 const independentlyComparablePoor=h.finish>=9&&surfaceMatch&&
   courseMatch&&distanceDelta!==null&&distanceDelta<=300&&sameClass;
 const classUncertainty=conditions.specialSelection||priorSpecialSelection||
   conditions.target_class===null||!cls||
   priorClass.status==='AMBIGUOUS_CLASS'||(!courseMatch&&!!cls);
 // Positive run can still be useful after a change. Less directly
 // transferable evidence receives a SMALL bonus, NOT a negative.
 const confirmedPoorOffset=independentlyComparablePoor?3:0;
 // No guessed pace or "lost but ran strongly" without matched official
 // result + podium. No bonus for incidental old profile corner columns.
 const relevantCorner=cornerWitness!==null&&h.finish<=3&&days<=365&&
   sameClass&&surfaceMatch&&distanceDelta!==null&&distanceDelta<=200;
 const lateAdvance=relevantCorner&&h.early_pos>=6&&h.final_turn_pos<=4&&
   h.early_pos-h.final_turn_pos>=3;
 const heldFront=relevantCorner&&h.early_pos<=3&&h.final_turn_pos<=3;
 const cornerBonus=lateAdvance?3:heldFront?2:0;
 const runSignal=rankWeight(h.finish)+freshness+matchBonus-
   confirmedPoorOffset+cornerBonus;
 return {
  evidence_ref:h.evidence_ref,history_date:h.race_date,age_days:days,
  historical_race_no:h.race_no??null,
  finish:h.finish,track:h.track,distance:h.distance,
  surface:h.surface??null,class_literal:h.class??null,
  normalized_historical_class:cls??null,
  historical_class_status:priorClass.status,
  context_band:contextBand,class_equivalence_unverified:Boolean(classUncertainty),
  special_selection_class_match_suppressed:conditions.specialSelection===true||
    priorSpecialSelection,
  distance_delta:distanceDelta,
  score_signal:runSignal,
  performance_band:positivePerformance?'TOP5_POSITIVE_PERFORMANCE':
    independentlyComparablePoor?'SAME_CONDITION_VERIFIED_DEEP_FINISH':
      'NEUTRAL_NON_TOP5_OR_CONDITION_UNVERIFIED',
  contextual_bonus_applied:positivePerformance,
  same_condition_poor_offset:confirmedPoorOffset,
  certified_official_corner_source:cornerWitness?.official_source_ref??null,
  certified_official_corner_checked_at:cornerWitness?.source_checked_at??null,
  corner_verification_status:cornerWitness?
   'EXACT_VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT':'NOT_INDEPENDENTLY_VERIFIED',
  corner_position_bonus:cornerBonus,
  corner_reason:lateAdvance?'VERIFIED_LATE_CORNER_ADVANCE_PLUS_PODIUM':
   heldFront?'VERIFIED_FRONT_HELD_PLUS_PODIUM':
   cornerWitness?'VERIFIED_CORNERS_NO_SCORING_PROOF':'UNVERIFIED',
  finish_proof:h.finish<=3?'WIN_OR_PODIUM':'NO_PODIUM',
  winner_gap:'UNVERIFIED_UNLESS_INDEPENDENTLY_VERIFIED',
  turn_positions:{early:h.early_pos??null,last:h.final_turn_pos??null}
 };
}
/** A verified test is not a completed race; score as limited debut evidence. */
function evaluateDebutAbilityTest(a,r,race) {
 if(!a || r.context_runs.length!==0 || a.source!==HYOGO_ABILITY_SOURCE ||
    a.category!=='能力検査' || a.passed!==true ||
    a.identity_method!=='EXACT_NAME_AGE_TRAINER_NOT_STABLE_HORSE_ID' ||
    a.official_race_result!==false || a.valid_for_provisional_comparison!==true ||
    norm(a.horse_name)!==norm(r.horse_name) ||
    a.horse_no!==r.horse_no || !norm(r.trainer) ||
    norm(a.trainer)!==norm(r.trainer) ||
    !Number.isInteger(a.age) || a.age<2 || a.age>20 ||
    !norm(r.sex_age).endsWith(String(a.age)) ||
    !isDay(a.event_date) || a.event_date>=race.race_date ||
    typeof a.source_ref!=='string' ||
    !a.source_ref.startsWith('https://www.sonoda-himeji.jp/data/ability/detail/') ||
    !Number.isInteger(Number(a.source_ref.split('/').pop())) ||
    !finite(a.time_seconds) || a.time_seconds<40 || a.time_seconds>180 ||
    !Number.isInteger(a.distance) || a.distance<800 || a.distance>1870 ||
    !Number.isInteger(a.same_session_distance_peer_count) ||
    a.same_session_distance_peer_count<1 ||
    a.same_session_distance_peer_count>30 ||
    !Number.isInteger(a.same_session_faster_or_equal_count) ||
    a.same_session_faster_or_equal_count<1 ||
    a.same_session_faster_or_equal_count>a.same_session_distance_peer_count ||
    !Number.isFinite(time(a.as_of)) || time(a.as_of)>time(race.observation_at))
   return null;
 const delta=Math.abs(a.distance-race.distance);
 const fresh=ageDays(race.race_date,a.event_date)<=45;
 // Uncalibrated weak signal, not a race win or class-equivalence proof.
 const signal=8+(a.same_session_distance_peer_count>=3 &&
   a.same_session_faster_or_equal_count===1?4:0)+(delta<=300?2:0)+(fresh?2:0);
 return {evidence_ref:a.source_ref,history_date:a.event_date,
  source:HYOGO_ABILITY_SOURCE,score_signal:signal,category:'OFFICIAL_TEST_NOT_RACE',
  test_distance:a.distance,target_distance:race.distance,time_seconds:a.time_seconds,
  session_peer_count:a.same_session_distance_peer_count,
  best_in_session:a.same_session_faster_or_equal_count===1,
  track_equivalence:'UNPROVEN',class_equivalence:'UNPROVEN',
  race_ability_uncertainty:'DEBUT_NOT_YET_RACE_PROVEN'};
}
export function buildLocalV17IndependentShadow({race,comparison}={}){
 if(!race||race.circuit!=='LOCAL'||!isDay(race.race_date)||
    !norm(race.track)||!nr(race.race_no)||
    !['芝','ダート'].includes(race.surface)||
    !Number.isInteger(race.distance)||race.distance<800||race.distance>3600||
    !Number.isFinite(time(race.observation_at))||
    !Number.isFinite(time(race.post_time))||
    time(race.observation_at)>=time(race.post_time)||
    localDay(race.observation_at)!==race.race_date||hasLeak(race))
  return stop('RACE_OR_ASOF_UNVERIFIED');
 if(!comparison||comparison.status!=='READY'||
    comparison.data_scope!=='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY'||
    comparison.target_date!==race.race_date||
    comparison.market_used!==false||
    comparison.target_result_used!==false||
    comparison.rank_effect!==false||comparison.score_effect!==false||
    !Array.isArray(comparison.runner_evidence)||
    comparison.runner_evidence.length<6||
    comparison.runner_evidence.length>20||hasLeak(comparison))
  return stop('COMPLETE_OFFICIAL_PRE_RACE_PACKET_UNVERIFIED');
 const target=resolveLocalOfficialClassLiteral(race.class_name??race.race_name,race.track);
 const target_class=target.class_label??null;
 const officialCorners=certifiedCornerByRun(comparison,race);
 if(officialCorners.status.startsWith('CORNER_WITNESS_'))
  return stop(officialCorners.status);
 // The current entry's selection condition must not be treated as the
 // same ordinary class simply because both titles contain e.g. C2.
 // Special編成 is not a proven downgrade or an equivalent opponent pool.
 const specialSelection=/特別編成|記者選抜|ファイナル/.test(
  norm(race.race_name)+' '+norm(race.class_name));
 const audit=[],identity=new Set(),evidenceGaps=[];
 for(const r of comparison.runner_evidence){
  if(!nr(r?.horse_no)||!norm(r.horse_name)||identity.has(r.horse_no)||
    !Array.isArray(r.context_runs)||r.context_runs.length>5||
    // Full historical context, not just narrow same-distance subset, REQUIRED.
    !Array.isArray(r.supporting_runs)||r.supporting_runs.length>5||
    hasLeak(r))return stop('WHOLE_FIELD_IDENTITY_OR_HISTORY_UNVERIFIED');
  identity.add(r.horse_no);
  const refs=new Set(),proof=[];
  for(const h of r.context_runs){
   const found=evaluateRun(h,{race_date:race.race_date,track:race.track,
     surface:race.surface,distance:race.distance,target_class,specialSelection},
     r.horse_no,refs,officialCorners.byRef.get(h.evidence_ref)??null);
   if(!found)return stop('HISTORY_IDENTITY_ASOF_OR_PROVENANCE_UNVERIFIED');
   if(found.age_days<=540)proof.push(found);
  }
  const ability=r.ability_test===undefined?null:evaluateDebutAbilityTest(r.ability_test,r,race);
  if(r.ability_test!==undefined && !ability)
   return stop('ABILITY_TEST_IDENTITY_ASOF_OR_PROVENANCE_UNVERIFIED');
  if(proof.length===0 && !ability)evidenceGaps.push({horse_no:r.horse_no,
   horse_name:r.horse_name,reason:'NO_VERIFIED_RACE_OR_OFFICIAL_ABILITY_TEST'});
  // All horses score using EXACTLY the same formula. One poor run cannot
  // erase multiple independent better performances.
  const ordered=proof.slice().sort((a,b)=>b.score_signal-a.score_signal||
    a.age_days-b.age_days||a.evidence_ref.localeCompare(b.evidence_ref));
  const contributions=ordered.slice(0,3)
    .map((x,i)=>({ref:x.evidence_ref,signal:x.score_signal,weight:[0.7,0.35,0.15][i]}));
  if(!proof.length && ability)
   contributions.push({ref:ability.evidence_ref,signal:ability.score_signal,
    weight:1,category:'OFFICIAL_ABILITY_TEST_ONLY_UNCALIBRATED'});
  const base=50;
  const raw=base+contributions.reduce((n,x)=>n+x.signal*x.weight,0);
  // v0.3 adds narrowly gated independent official corner proof; previously
  // v0.2 separated positive finish from conditions. Do not compare these scores
  // to v0.1 or production 1.6 scores as if they used a common scale.
  // Provisional score is NOT a probability and not calibrated against 1.6.
  const score=scoreBound(raw);
  audit.push({horse_no:r.horse_no,horse_name:r.horse_name,
   independent_score:score,base_score:base,
   evidence_runs_checked:r.context_runs.length,
   evidence_runs_used:proof.length,
   independently_verified_corner_runs:proof.filter(x=>
     x.corner_verification_status==='EXACT_VERIFIED_PRECLAIM_OFFICIAL_PAST_RESULT').length,
   corner_bonus_points:proof.reduce((n,x)=>n+x.corner_position_bonus,0),
   official_ability_test_used:Boolean(ability && proof.length===0),
   official_ability_evidence:ability,
   comparable_same_venue:proof.filter(x=>x.track===race.track).length,
   other_condition_runs:proof.filter(x=>x.context_band!=='SAME_OFFICIAL_CLASS').length,
   runs:proof,score_contributions:contributions,
   gaps:proof.length?'NONE':ability?'NO_RACE_HISTORY_ABILITY_TEST_ONLY':'INSUFFICIENT_OFFICIAL_HISTORY',
   missing_information_penalty:0,
   target_class_status:target.status,
   special_selection_class_equivalence: specialSelection?'NOT_VERIFIED':'NOT_APPLICABLE',
   excludes_target_results:true
  });
 }
 if(evidenceGaps.length)return stop('INSUFFICIENT_EVIDENCE_FOR_FAIR_WHOLE_FIELD_RANK',{
  all_runners_checked:audit.length,missing:evidenceGaps,
  observed_runner_data:audit,proposed_top5:null});
 // Rank is decided ONLY AFTER every complete-field assessment.
 const sorted=audit.slice().sort((a,b)=>b.independent_score-a.independent_score||
  b.evidence_runs_used-a.evidence_runs_used||a.horse_no-b.horse_no);
 const equalScores=sorted.filter((v,i)=>i>0&&v.independent_score===sorted[i-1].independent_score);
 // Neither horse number nor evidence-count tiebreaks certify ability.
 const top5BoundaryTied=sorted[4]?.independent_score===sorted[5]?.independent_score;
 // Phase 2 is the DISTINCT LAB EYE mission, after all-horse scores/top5.
 // It never changes the ability order. Multiple independently verified
 // podium races, including an other-condition run, may justify a research
 // EYE case. One old result or rank=6 alone is NOT enough.
 const outsiders=sorted.slice(5);
 const eyeAudit=outsiders.map(a=>{
  const podium=a.runs.filter(x=>x.finish<=3&&x.age_days<=365);
  const current=podium.filter(x=>x.age_days<=180);
  const related=podium.filter(x=>x.surface===race.surface&&
   x.distance_delta!==null&&x.distance_delta<=300);
  const qualifies=podium.length>=2&&current.length>=1&&related.length>=1;
  return {horse_no:a.horse_no,prior_evidence_count:podium.length,
   recent_podium_count:current.length,related_podium_count:related.length,
   independent_podium_refs:podium.map(x=>x.evidence_ref),
   eye_case:qualifies,selection_reason:qualifies?
     'TWO_VERIFIED_INDEPENDENT_PODIUM_RUNS_ONE_RECENT_ONE_SURFACE_DISTANCE_RELATED':
     'INSUFFICIENT_INDEPENDENT_CURRENT_POSITIVE_EVIDENCE',
   baseline_rank_input_used:false
  };
 });
 const qualified=eyeAudit.filter(x=>x.eye_case).sort((a,b)=>
  b.prior_evidence_count-a.prior_evidence_count||
  b.related_podium_count-a.related_podium_count||
  b.recent_podium_count-a.recent_podium_count);
 const leader=qualified[0];
 const runnerup=qualified[1];
 const uniqueLeader=leader&&(!runnerup||
  leader.prior_evidence_count>runnerup.prior_evidence_count||
  leader.prior_evidence_count===runnerup.prior_evidence_count&&
   leader.related_podium_count>runnerup.related_podium_count||
  leader.prior_evidence_count===runnerup.prior_evidence_count&&
   leader.related_podium_count===runnerup.related_podium_count&&
   leader.recent_podium_count>runnerup.recent_podium_count);
 const eyeSelected=uniqueLeader?leader:null;
 return {
  status:'READY_FOR_PROSPECTIVE_PAIRED_TEST',
  model:'LOCAL_1_7_INDEPENDENT_SHADOW_V0_3',
  version:'1.7-research-v0.3',release_status:'RESEARCH_NOT_DEPLOYED',
  observation_at:race.observation_at,
  race_identity:{circuit:'LOCAL',race_date:race.race_date,
   track:race.track,race_no:race.race_no,post_time:race.post_time},
  target_class_status:target.status,
  special_selection_class_equivalence:specialSelection?'NOT_VERIFIED':'NOT_APPLICABLE',
  all_runners_checked:audit.length,
  runners:sorted.map((r,i)=>({rank:i+1,horse_no:r.horse_no,
   horse_name:r.horse_name,score:r.independent_score,
   confidence:r.official_ability_test_used?'ABILITY_TEST_ONLY_UNCALIBRATED':
    r.evidence_runs_used>=3?'HISTORY_AVAILABLE':'LIMITED_HISTORY'})),
  top5:sorted.slice(0,5).map(x=>x.horse_no),
  ability_evidence_audit:audit,
  official_corner_witness_status:officialCorners.status,
  official_corner_witness_count:officialCorners.byRef.size,
  tied_score_runner_count:equalScores.length,
  top5_boundary_score_tie:top5BoundaryTied,
  top5_boundary_confidence:top5BoundaryTied?
    'UNRESOLVED_SCORE_TIE_NO_RANK_CERTIFICATION':
    'INDEPENDENT_SCORE_SEPARATION_UNCALIBRATED',
  rank_tiebreak:'EVIDENCE_COVERAGE_THEN_HORSE_NO_NO_MARKET',
  lab_eye_status:eyeSelected?'EVIDENCE_BACKED_RESEARCH_CANDIDATE':'ABSTAINED',
  eye_candidate:eyeSelected?{horse_no:eyeSelected.horse_no,
    horse_name:audit.find(x=>x.horse_no===eyeSelected.horse_no).horse_name,
    evidence_refs:eyeSelected.independent_podium_refs,
    research_only:true}:null,
  eye_all_outsider_audits:eyeAudit,
  production_rank_effect:false,production_eye_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false,
  safety:'PROSPECTIVE_ONLY; NOT OFFICIALLY SAVED; NO ODDS OR RESULTS'
 };
}
