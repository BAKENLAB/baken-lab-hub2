import fs from 'node:fs';
import {buildEyeAdditionalAudit} from '../../automation/jra-eye-additional-audit.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./comparison-input.json',import.meta.url)));
const group=r=>r.surface==='芝'?(Number(r.distance)<=1400?'turf_le1400':Number(r.distance)<=1800?'turf_1401_1800':'turf_gt1800'):r.surface==='ダート'?'dirt':'unknown';
const raceKey=r=>`${r.race_date}/${r.track}/${r.race_no}`;
const no=x=>x===null||x===undefined?null:Number(x.horse_no);
const finish=(r,n)=>n===null?null:Number(r.finishers?.find(x=>Number(x.horse_no)===n)?.finish)||null;
function stats(rows,choice){let n=0,w=0,t=0;for(const r of rows){const id=choice(r);if(id===null)continue;n++;const f=finish(r,id);if(f===1)w++;if(f!==null&&f<=3)t++;}return {selected:n,wins:w,top3:t,win_rate:n?w/n:null,top3_rate:n?t/n:null};}
const eligible=[],excluded=[];
for(const s of data.snapshots){
 const p=data.frozen.find(p=>raceKey(p)===raceKey(s));let reason=null;
 const captured=Date.parse(s.saved_at),source=Date.parse(s.payload.source_checked_at),frozen=Date.parse(p?.frozen_at),post=Date.parse(s.source_post_time);
 if(!p)reason='NO_MATCHING_FROZEN';
 else if(![captured,source,frozen,post].every(Number.isFinite)||captured>frozen||source>frozen||frozen>=post||post!==Date.parse(p.post_time))reason='NOT_PROVEN_AVAILABLE_AT_FROZEN';
 else if(!Array.isArray(s.payload.runners)||s.payload.runners.length!==p.runners.length||s.payload.runners.some(h=>!/^\d{10}$/.test(h.horse_code??'')||!p.runners.some(r=>r.horse_no===h.horse_no&&r.horse_name===h.horse_name))||new Set(s.payload.runners.map(h=>h.horse_code)).size!==s.payload.runners.length)reason='ROSTER_OR_IDENTITY_MISMATCH';
 if(reason){excluded.push({race:raceKey(s),reason});continue;}
 const input={race:{race_date:p.race_date,post_time:p.post_time,surface:s.payload.surface,distance:Number(s.payload.distance)},observedAt:p.frozen_at,
  finalizedRanking:p.runners.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,rank:r.rank})),
  runnerHistory:s.payload.runners.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,past_runs:h.history.map(r=>({...r,early_pos:Array.isArray(r.corner_positions)?r.corner_positions[0]:null}))}))};
 try{
  // Extract first; target results never enter the extractor input.
  const review=buildEyeAdditionalAudit(input),candidate=review.candidates[0]?.horse_no??null,current=no(p.eye);
  eligible.push({...p,surface:s.payload.surface,distance:Number(s.payload.distance),candidate,
   replacement_raw:review.segment==='TURF_LE_1800'?candidate??current:current??candidate,
   fill_null_raw:current??candidate,review_status:review.status,source_saved_at:s.saved_at,
   source_checked_at:s.payload.source_checked_at,candidates:review.candidates.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,rank:r.rank,mean_early_position:r.mean_early_position,front_good_count:r.front_good_count,stamina_good_count:r.stamina_good_count})),formal_audit:'NOT_PERFORMED_COUNTERFACTUALLY'});
 }catch(e){excluded.push({race:raceKey(s),reason:e.message});}
}
const groups=['turf_le1400','turf_1401_1800','turf_gt1800','dirt','unknown'];
const baseline=Object.fromEntries(groups.map(g=>[g,{races:data.frozen.filter(r=>group(r)===g).length,...stats(data.frozen.filter(r=>group(r)===g),r=>no(r.eye))}]));
const comparison={};
for(const mode of ['replacement_raw','fill_null_raw']){
 const changes=eligible.filter(r=>r[mode]!==no(r.eye));
 const lost=changes.filter(r=>{const f=finish(r,no(r.eye));return f!==null&&f<=3});
 comparison[mode]={warning:'UNAUDITED_CANDIDATE_COMPARISON_NOT_FORMAL_EYE_PERFORMANCE',
  by_segment:Object.fromEntries(groups.map(g=>{const rows=eligible.filter(r=>group(r)===g);return[g,{races:rows.length,old:stats(rows,r=>no(r.eye)),candidate_only:stats(rows,r=>r[mode])}]})),
  new_captures:changes.filter(r=>{const f=finish(r,r[mode]);return f!==null&&f<=3}).map(r=>({race:raceKey(r),horse_no:r[mode],finish:finish(r,r[mode])})),
  lost_existing_good_horses:lost.map(r=>({race:raceKey(r),old_horse_no:no(r.eye),old_finish:finish(r,no(r.eye)),new_horse_no:r[mode],new_finish:finish(r,r[mode]),race_top3_hit_preserved:(finish(r,r[mode])??99)<=3})),
  lost_race_top3_hits:lost.filter(r=>(finish(r,r[mode])??99)>3).length,
  dirt_changes:changes.filter(r=>r.surface==='ダート').length,rank_changes:0,top5_changes:0};
}
const output={status:'PARTIAL_ASOF_RESEARCH_NOT_MODEL_APPROVAL',window:['2026-10-17','2026-11-14'],frozen_races:data.frozen.length,
 result_matched_races:data.frozen.filter(r=>Array.isArray(r.finishers)).length,immutable_input_snapshots:data.snapshots.length,
 eligible_at_frozen:eligible.length,excluded_snapshots:excluded,unavailable_other_frozen:data.frozen.length-eligible.length,
 frozen_input_not_exact_claim_context:true,identity_basis:'Archived horse_code present, race/horse_no/exact name matched; target FROZEN lacks full archived horse-ID binding',
 provided_research_rates_independently_reproduced:false,baseline_all_races:baseline,comparison,
 per_race:eligible.map(r=>({race:raceKey(r),surface:r.surface,distance:r.distance,current_eye:no(r.eye),candidate:r.candidate,replacement_raw:r.replacement_raw,fill_null_raw:r.fill_null_raw,candidates:r.candidates,formal_audit:r.formal_audit})),
 deployment_decision:{automatic_eye_selection:'NO',optional_audit_evidence:'TEST_REQUIRED',preserve_existing_eye:true,dirt_unchanged:true,rank_top5_unchanged:true},
 limitations:['Only 2026-10-24 immutable pre-race inputs were located; other dates not reconstructed from latest data.','Snapshots captured after FROZEN excluded even if before post time.','Candidate extraction is not the required two-independent-factor formal audit.','No forward holdout validation.','No original research extraction code/horse-level list was supplied.']};
fs.writeFileSync(new URL('./comparison-results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
