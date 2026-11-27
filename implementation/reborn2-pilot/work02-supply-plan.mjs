// Source mapping only. Work02 current metadata/code/aggregate audit.
import assert from 'node:assert/strict';
import {inspectRealSupply,ENGINE} from './adapter.mjs';
export const WORK02='75372fd85c3eccc602b663af45ddc4ff11c4fd85';
export const mappings=[
 ['JRA','jra_live_races','race_key/date/track/no/conditions/post','race identity, context, scheduled post','native race identity + verified version/time'],
 ['JRA','jra_live_runners','horse_ref/no/draw/weight/sex_age/equipment/body_weight','identity, gate, weight, literal profile','verified horse_ref and full card incl cancellation'],
 ['JRA','official_races.field_payload','official_status_verification/runners.status','current status','official status proof; unknown otherwise'],
 ['JRA','jra_html_evidence','hash/byte_count/source URL/parser/fetched_at/recorded_at','source custody metadata','metadata is not original bytes'],
 ['JRA','jra_live_runners.past_runs + jra_lab_runs','horse_ref/source_ref/date/finish/margin/time_raw/final3f/corner_positions/surface/distance/going/race_class/weight/field_size','finish, literal margin/time, individual final600 only verified units, literal corner groups','native event/horse join + before cutoff, independent rights'],
 ['JRA','jra_lab_races','halon_times/source_ref','race-level leader lap literal slots','not individual elapsed clock; units/boundaries required'],
 ['LOCAL','official_races','race key/post/field_fetched_at/runners.no/status/weight','target card, status, weight','NAR official native ID + row and race key; no name join'],
 ['LOCAL','lab_preclaim_evidence_snapshots_v1','linkedRunEvidence/officialRaceLaps/opponentFollowups/as_of/captured_at/roster and payload digests','prior evidence, race lap literals, peer followup','verify original roots, roster/payload digest, cutoff, rights; no CLAIM'],
 ['LOCAL','horse_runs','finish/margin/time_raw/final3f/early_pos/final_turn_pos','partial historical fields only','no horse_ref column: hold without independent native identity link']
].map(([circuit,source,fields,target,required])=>({circuit,source,fields:fields.split('/'),target,required,admission:'HELD'}));
export const held=['individual checkpointMs','exact-distance checkpointRanks','normalized clockMs unless certified','geometry effective version','status unless proven','class equivalence','rating/incident/training/pedigree unless separately verified','EYE04/06/14/15 unless sufficient evidence'];
export function prepareSupplyPlan(manifest){
 const inspection=inspectRealSupply(manifest);
 return {schema:'REBORN2_WORK02_SUPPLY_PLAN_1',work02Commit:WORK02,engineCommit:ENGINE,inspection,fields:mappings.filter(x=>x.circuit===manifest.circuit),held,exclude:['market','odds','popularity','target result','old score/mark/rank/TOP5','unfiltered raw text'],targetContract:'WORK44_PARTIAL_OBSERVATIONS_0.2 semantics only; no relabeling',realAdmission:false,engineInput:null,projectionAllowed:false};
}
