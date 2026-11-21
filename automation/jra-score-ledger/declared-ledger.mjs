// Converts EXISTING numeric audit fields to a ledger. Never invents a score/formula.
import {createHash} from 'node:crypto';
export const canonical=x=>JSON.stringify(sort(x));
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));return x;}
export const sha=x=>createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
export function collectDeclaredLedger({payload,prediction_id=null,race=null}){
 const reviews=Array.isArray(payload?.audit?.runner_history_checked)?payload.audit.runner_history_checked:[];
 const bridge=payload?.audit?.evidence_rank_bridge;
 return {schema:'JRA_DECLARED_SCORE_LEDGER_V1',classification:'DECLARED_AUDIT_NOT_FIXED_COEFFICIENT_ENGINE',prediction_id,race,
  payload_sha256:sha(payload),declared_method:payload?.audit?.score_method??null,
  declared_engine:payload?.audit?.score_engine_id??null,engine_verified:false,provenance_verified:false,
  runners:(payload?.runners??[]).map(r=>{
   const matches=reviews.filter(x=>x.horse_no===r.horse_no),brows=(bridge?.per_runner??[]).filter(x=>x.horse_no===r.horse_no);
   const review=matches.length===1?matches[0]:null,b=brows.length===1?brows[0]:null;
   return {horse_no:r.horse_no,horse_name:r.horse_name,grade:r.grade,rank:r.rank,final_score:r.score,
    review_count:matches.length,bridge_count:brows.length,base:review?.base_score??null,
    components:clone(review?.evidence_effects??[]),review_score:review?.score_after??null,
    review_rank:review?.rank_after??null,bridge:clone(b),
    source_refs:clone(review?.source_refs??[]),source_lineage:'DECLARED_REFS_NOT_IMMUTABLE_SOURCE_PROOF'};
  }),has_bridge:!!bridge,production_allowed:false};
}
