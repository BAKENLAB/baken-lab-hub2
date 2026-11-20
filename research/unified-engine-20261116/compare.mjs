// Results are admitted ONLY here, after the inference artifacts are finalized.
import {digest,fail,sourceOK,setEqual,verifyRecord} from './input.mjs';
import {REFERENCE} from './catalog.mjs';
export function unavailableReport(reason='REFERENCE_COHORT_ARTIFACTS_NOT_FOUND'){
 return {status:'UNMEASURED',reference:REFERENCE,reason,real_races_measured:0,
  metrics:{condition_matches:null,score_changed_horses:null,rank_changed_horses:null,eye_changed_races:null,new_captures:null,lost_captures:null,baseline_captures:null,after_captures:null},
  inference_uses_results:false,production_changed:false};
}
export function compareCohort(evaluations,officialResults,{captureDefinition=null,referenceRaceIds=null}={}){
 if(!Array.isArray(evaluations)||!evaluations.length)return unavailableReport();
 const byId=new Map();for(const r of officialResults??[]){if(byId.has(r.race_id))fail('DUPLICATE_RESULT_RACE');byId.set(r.race_id,r);}
 if(new Set(evaluations.map(e=>e.race.race_id)).size!==evaluations.length)fail('DUPLICATE_EVALUATION_RACE');
 const missing=[],rows=[];let matches=0,scoreChanges=0,rankChanges=0,eyeChanges=0,oldCount=0,newCount=0;const added=[],lost=[],lostEye=[];
 for(const e of evaluations){
  const result=byId.get(e.race.race_id),b=e.baseline;
  if(e.status!=='EVALUATED_RESEARCH_ONLY'||!b||e.completion?.all_eye_audits_complete!==true){missing.push({race:e.race.race_id,reason:'BLOCKED_INCOMPLETE_EYE_OR_MISSING_BASELINE'});continue;}
  if(!result||result.status!=='OFFICIAL_FINAL'||(!sourceOK(result.source,Infinity)||!verifyRecord(result,Infinity))||Date.parse(result.source.known_at)<Date.parse(e.race.post_time)||!Array.isArray(result.runners)||!setEqual(result.runners.map(r=>r.horse_id),e.runners.map(r=>r.horse_id))){missing.push({race:e.race.race_id,reason:'UNVERIFIED_FINAL_RESULT_OR_FIELD'});continue;}
  if(result.runners.some(r=>r.finish!==null&&(!Number.isInteger(r.finish)||r.finish<1)))fail('RESULT_FINISH');
  const podium=result.runners.filter(r=>r.finish!==null&&r.finish<=3).map(r=>r.horse_id);
  const old=new Set([...b.top5,...(b.eye?[b.eye]:[])].filter(h=>podium.includes(h)));
  const after=new Set([...e.top5,...(e.eye.horse_id?[e.eye.horse_id]:[])].filter(h=>podium.includes(h)));
  const newIds=[...after].filter(h=>!old.has(h)),lostIds=[...old].filter(h=>!after.has(h));
  for(const h of newIds)added.push({race:e.race.race_id,horse_id:h});for(const h of lostIds)lost.push({race:e.race.race_id,horse_id:h});
  if(b.eye&&podium.includes(b.eye)&&e.eye.horse_id!==b.eye)lostEye.push({race:e.race.race_id,horse_id:b.eye,still_captured_by_top5:e.top5.includes(b.eye)});
  oldCount+=old.size;newCount+=after.size;matches+=e.condition_matches;
  scoreChanges+=e.runners.filter(h=>h.score!==b.runners.find(x=>x.horse_id===h.horse_id).score).length;
  rankChanges+=e.runners.filter(h=>h.rank!==b.runners.find(x=>x.horse_id===h.horse_id).rank).length;
  if((e.eye.horse_id??null)!==(b.eye??null))eyeChanges++;
  rows.push({race_id:e.race.race_id,horses:e.runners.length,baseline_captures:old.size,after_captures:after.size,new_ids:newIds,lost_ids:lostIds,race_hit_preserved:old.size===0||after.size>0,eye_audit_status:e.eye.status,
   turf_or_dirt:e.race.surface,distance:e.race.distance,inference_sha256:digest({input:e.input_sha256,runners:e.runners,eye:e.eye}),official_result_sha256:result.source.sha256});
 }
 if(!rows.length)return {...unavailableReport('NO_COMPARABLE_LOCKED_RACES'),unmeasured:missing};
 const horseCount=rows.reduce((s,r)=>s+r.horses,0),allTurf=rows.every(r=>r.turf_or_dirt==='芝');
 const scopeMatches=rows.length===REFERENCE.races&&horseCount===REFERENCE.horses&&allTurf&&captureDefinition==='TOP5_OR_EYE_TOP3_UNIQUE'&&Array.isArray(referenceRaceIds)&&setEqual(referenceRaceIds,rows.map(r=>r.race_id));
 return {status:missing.length?'PARTIAL_MEASUREMENT':'MEASURED_SUPPLIED_COHORT',reference:REFERENCE,real_races_measured:rows.filter(r=>evaluations.find(e=>e.race.race_id===r.race_id).mode!=='SYNTHETIC_TEST').length,
  cohort_races:rows.length,cohort_horses:horseCount,synthetic:evaluations.some(e=>e.mode==='SYNTHETIC_TEST'),capture_definition:'TOP5_OR_EYE_TOP3_UNIQUE',
  reference_cohort_membership_verified:scopeMatches,reference_46_623_92_verified:scopeMatches&&oldCount===REFERENCE.old_captures&&newCount===REFERENCE.good_horse_captures&&added.length===REFERENCE.new_captures&&lost.length===REFERENCE.lost_captures&&!missing.length&&evaluations.every(e=>e.mode!=='SYNTHETIC_TEST'),
  metrics:{condition_matches:matches,score_changed_horses:scoreChanges,rank_changed_horses:rankChanges,eye_changed_races:eyeChanges,new_captures:added.length,lost_captures:lost.length,baseline_captures:oldCount,after_captures:newCount},
  new_capture_horses:added,lost_capture_horses:lost,lost_existing_good_eye_horses:lostEye,races:rows,unmeasured:missing,
  independent_future_validation:false,inference_uses_results:false,production_changed:false};
}
