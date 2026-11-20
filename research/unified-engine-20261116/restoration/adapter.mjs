// Research reconstruction connects to the SAME central fact calculation.
// It never upgrades a reconstructed row to official/frozen-input certification.
import {CONDITIONS,VERSION} from '../catalog.mjs';
import {collectConditionFacts} from '../engine.mjs';
import {digest,forbidMarketsOrTargetResults} from '../input.mjs';
const n=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function auditReconstructedRows(rows){
 forbidMarketsOrTargetResults(rows);
 const byRace=new Map();for(const r of rows){const id=[r.race_date,r.track,r.race_no].join('/');byRace.set(id,(byRace.get(id)||[]).concat(r));}
 const logs=[],cohorts=[];
 for(const [race_id,rs] of byRace){const first=rs[0];const active=rs.map(r=>({horse_id:r.horse_ref,horse_no:r.horse_no,horse_name:r.horse_name}));
  if(active.some(h=>!h.horse_id)||new Set(active.map(h=>h.horse_id)).size!==active.length)throw Error('RECONSTRUCTION_IDENTITY');
  const byHorse=new Map();
  for(const r of rs){if(r.horse_name!==r.frozen_horse_name)throw Error('RECONSTRUCTION_NAME');
   const runs=r.past_runs.filter(h=>h.race_date<r.race_date&&Number.isInteger(n(h.finish))&&n(h.finish)>=1&&n(h.finish)<=n(h.field_size));
   const normalized=runs.map(h=>{const key=[r.horse_ref,h.race_date,h.track,h.source_ref??'UNVERIFIED_PRIOR_ID'].join('/');return {...h,source:{ref:h.source_ref??null},key,dependency:key,evidence_id:'reconstruction:'+digest(key).slice(0,24),distance:n(h.distance),finish:n(h.finish),field_size:n(h.field_size),margin_to_winner:n(h.margin_to_winner),early_pos:n(h.early_pos),final_turn_pos:n(h.final_turn_pos)};}).sort((a,b)=>b.race_date.localeCompare(a.race_date)).slice(0,4);
   byHorse.set(r.horse_ref,normalized);
  }
  const input={race:{race_id,race_date:first.race_date,track:first.track,race_no:first.race_no,post_time:first.post_time,surface:first.conditions.surface,distance:first.conditions.distance},supplemental:[]};
  const facts=collectConditionFacts(input,{active,byHorse});
  for(const r of rs)for(const c of CONDITIONS){const f=facts.get(r.horse_ref)[c.id];logs.push({race_id,horse_no:r.horse_no,horse_name:r.horse_name,criterion:c.id,source_family:c.family,
   acquisition_status:f.status,condition_matched:f.matched,evidence:f.evidence,details:f.details,
   source_checked_at:r.source_checked_at,reference_frozen_at:r.frozen_at,history_updated_at:r.history_updated_at,post_time:r.post_time,
   source_before_post:Date.parse(r.source_checked_at)<Date.parse(r.post_time)&&Date.parse(r.history_updated_at)<Date.parse(r.post_time),
   source_before_reference_freeze:Date.parse(r.source_checked_at)<=Date.parse(r.frozen_at),
   provenance:'MUTABLE_ROW_TIMESTAMP_RECONSTRUCTION_NOT_IMMUTABLE_HISTORICAL_INPUT',
   points:null,score_status:'BLOCKED_NO_ITEM_LEVEL_100_POINT_RUBRIC',formal_eye_status:'NOT_PERFORMED'});}
  cohorts.push({race_id,horses:rs.length,all_history_sources_before_post:rs.every(r=>Date.parse(r.source_checked_at)<Date.parse(r.post_time)&&Date.parse(r.history_updated_at)<Date.parse(r.post_time)),all_sources_before_reference_freeze:rs.every(r=>Date.parse(r.source_checked_at)<=Date.parse(r.frozen_at))});
 }
 return {version:VERSION,mode:'REAL_DATA_RESEARCH_RECONSTRUCTION',races:cohorts.length,horses:rows.length,audit_items:logs.length,
  central_condition_matches:logs.filter(l=>l.condition_matched===true).length,independent_100_point_scoring:'BLOCKED_NO_APPROVED_RUBRIC',
  formal_eye_selection:'NOT_PERFORMED',save_authorized:false,cohorts,logs};
}
