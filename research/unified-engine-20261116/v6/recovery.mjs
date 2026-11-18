import{digest}from'../v5/allocator.mjs';import{horseId,raceCname}from'../v3/query.mjs';import{matchPrior}from'../v3/enrich.mjs';import{deriveExclusiveFlat}from'../v4/type-repair.mjs';
const before=(x,t)=>Number.isFinite(Date.parse(x))&&Date.parse(x)<Date.parse(t);
export function proofGate(r,baseline,candidate,{conflict_unresolved=false}={}){
 const fail=[];if(!candidate)return{admissible:false,reasons:['MISSING_VERIFIED_RACE']};const a=candidate;if(!a.run_id||!a.race_id)fail.push('MISSING_RUN_RACE_ID');
 if(conflict_unresolved)fail.push('SOURCE_DISAGREEMENT_UNRESOLVED');if(horseId(a.horse_ref)!==horseId(r.horse_ref)||!horseId(r.horse_ref)||a.horse_name!==r.horse_name)fail.push('IDENTITY_MISMATCH');
 if(!raceCname(baseline.source_ref)||a.race_date!==baseline.race_date||a.track!==baseline.track||a.surface!==baseline.surface||a.distance!==baseline.distance||a.source_ref!==raceCname(baseline.source_ref))fail.push('RACE_IDENTITY_OR_OFFICIAL_REF');
 if(a.race_type!=='平地'||(a.horse_runs_race_types??[]).some(t=>!['平地','FLAT'].includes(t)))fail.push('EXPLICIT_FLAT_PROOF_MISSING');
 if(![a.source_checked_at,a.created_at,a.updated_at,r.source_checked_at,r.history_updated_at].every(t=>before(t,r.post_time))||a.race_date>=r.race_date)fail.push('TIMESTAMP_ISSUE');
 const age=(Date.parse(r.race_date)-Date.parse(a.race_date))/86400000;if(!Number.isFinite(age)||age<0||age>540)fail.push('OUTSIDE_EXISTING_HISTORY_WINDOW');
 if(!Number.isInteger(a.finish)||a.finish<1||a.finish>a.field_size||a.finish!==baseline.finish||a.field_size!==baseline.field_size||a.final3f!==baseline.final3f)fail.push('PERFORMANCE_SOURCE_DISAGREEMENT');
 return {admissible:fail.length===0,reasons:fail,source_sha256:digest(a),strict_frozen_input_proven:false};
}
export function auditUnrated(r,f,inputs){
 const es=inputs.base.rows.filter(e=>e.target_date===r.race_date&&e.target_track===r.track&&e.target_no===r.race_no&&e.target_horse_no===r.horse_no),entries=[];
 for(let i=0;i<r.past_runs.length;i++){const b=r.past_runs[i],rows=es.filter(e=>e.prior_index===i),e=rows.length===1?rows[0]:null,matched=deriveExclusiveFlat(matchPrior(r,b,e,i)),candidates=(e?.candidates??[]).map(a=>({raw:a,gate:proofGate(r,b,a,{conflict_unresolved:matched.match_status==='CONFLICT'}),existing_match_status:matched.match_status,existing_match_reason:matched.reason,classification_as_saved:a.race_type,horse_runs_types_as_saved:a.horse_runs_race_types??null,official_run_ref:a.source_ref,horse_id:horseId(a.horse_ref),race_id:a.race_id,run_id:a.run_id,source_clocks_before_post:[a.source_checked_at,a.created_at,a.updated_at].every(t=>before(t,r.post_time)),within_existing_540_days:(Date.parse(r.race_date)-Date.parse(b.race_date))/86400000<=540,existing_flat_status:matched.flat,existing_eligible:matched.evaluation_eligible}));
  entries.push({prior_index:i,baseline:b,source_checked_at:r.source_checked_at,live_version_matched:e?.baseline_live_version_matched??false,prior_class_detail:e?.prior_class_detail??null,candidate_count:candidates.length,candidates,reason:!candidates.length?'ARCHIVE_NOT_FOUND':matched.match_status==='CONFLICT'?matched.reason:matched.race_type_status??'UNKNOWN',historical_program_scope:!matched.flat&&b.race_date.startsWith('2025-')&&candidates.some(c=>['1勝クラス','2勝クラス','3勝クラス'].includes(c.raw.class_name))?'2025_CONDITION_DOCUMENT_REQUIRED_2026_RULE_NOT_EXTENDED':null});
 }
 const extra=inputs.extra.rows.filter(a=>a.race_key===[r.race_date,r.track,r.race_no].join('/')&&a.horse_no===r.horse_no),actualNewProof=[];
 const ready=entries.flatMap(e=>e.live_version_matched?e.candidates.filter(c=>c.gate.admissible&&c.within_existing_540_days).map(c=>({prior_index:e.prior_index,run_id:c.run_id})):[]);
 if(ready.length)throw Error('QUALIFYING_PROOF_FOUND_REBUILD_AND_REFREEZE_REQUIRED:'+JSON.stringify(ready));
 // No new online source packet returned; fixed data were already considered by
 // V4 recover(). A valid-looking candidate without matched live version or with
 // an unresolved source conflict cannot be silently promoted.
 return {race_id:[r.race_date,r.track,r.race_no].join('/'),horse_no:r.horse_no,horse_name:r.horse_name,horse_id:horseId(r.horse_ref),horse_ref:r.horse_ref,post_time:r.post_time,candidates:entries,separate_archive_candidates:extra,verified_adopted_count:f.scoring_priors.length,new_accepted_proofs:actualNewProof,recovered:false,actual_career_count:null,current_database_rechecked:false,blocker:'NEW_DATABASE_QUERY_NO_RESPONSE_NO_NEW_OFFICIAL_SOURCE',strict_frozen_input_proven:false};
}
