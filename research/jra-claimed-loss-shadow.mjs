/**
 * JRA claimed-context -> read-only prior-run diagnostic bridge.
 * Every source field must come from the verified JRA CLAIMED context; never
 * pass user-edited runners to this bridge or use its output for score/save.
 */
import {auditPreRaceLossEvidence} from '../automation/prerace-why-lost-audit.mjs';
const checksum=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function buildJraClaimedLossShadow(context,{clock=()=>Date.now()}={}){
 const race=context?.race,field=race?.field_payload;
 const proof=field?.official_status_verification;
 const horseRows=field?.runners;
 if(context?.stage!=='AWAITING_JRA_FULL_DEPTH_COMPARISON'||
    !race||!field?.race||!proof||proof.verified!==true||
    !checksum(proof.html_sha256)||
    !Array.isArray(horseRows)||!Array.isArray(context.runner_history)||
    horseRows.length!==context.runner_history.length||
    !horseRows.length||horseRows.some(x=>x.status!=='ACTIVE')||
    new Set(horseRows.map(x=>x.horse_no)).size!==horseRows.length)
  return {status:'UNVERIFIED_CONTEXT',rank_effect:false,save_gate_effect:false};
 const names=new Map(horseRows.map(x=>[x.horse_no,x.horse_name]));
 const seen=new Set();
 if(context.runner_history.some(h=>{
  if(seen.has(h.horse_no)||names.get(h.horse_no)!==h.horse_name||
     !Array.isArray(h.past_runs))return true;
  seen.add(h.horse_no);return false;
 }))return {status:'UNVERIFIED_RUNNER_LINKAGE',rank_effect:false,save_gate_effect:false};
 try{
  const audit=auditPreRaceLossEvidence({
   targetRace:{
    raceDate:race.race_date,track:race.track,raceNo:race.race_no,
    postTime:race.post_time,surface:field.race.surface,
    distance:field.race.distance,className:field.race.class_name
   },
   runners:context.runner_history,
   source:{kind:'JRA_CLAIMED_CONTEXT',verified:true,
    checkedAt:field.source_checked_at??proof.verified_at},
   clock,maxPriorRuns:4
  });
  return {status:'EVIDENCE_ONLY',rank_effect:false,save_gate_effect:false,
   audit};
 }catch{
  return {status:'UNVERIFIED_EVIDENCE',rank_effect:false,save_gate_effect:false};
 }
}
