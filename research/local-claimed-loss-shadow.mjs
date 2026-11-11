/**
 * LOCAL pre-CLAIM official corner packet -> descriptive why-lost analysis.
 * Consumes only independently verified CLAIM context and the official source
 * packet that was captured BEFORE CLAIM. Never mutates core input, rank or save.
 */
import {buildLocalClaimedCornerShadow} from '../automation/local-claimed-corner-shadow.mjs';
import {auditPreRaceLossEvidence} from '../automation/prerace-why-lost-audit.mjs';
export function buildLocalClaimedLossShadow({
 targetRace,verifiedRunners,compactRunners,cornerPacket,conditions={},clock=()=>Date.now()
}={}){
 let shadow;
 try{
  shadow=buildLocalClaimedCornerShadow({
   targetRace,verifiedRunners,compactRunners,cornerPacket,conditions,clock
  });
 }catch{
  return {status:'UNVERIFIED_CORNER_CONTEXT',rank_effect:false,save_gate_effect:false};
 }
 if(shadow.status!=='DESCRIPTIVE_SHADOW_ONLY'||shadow.applied_prior_runs<1)
  return {status:'NO_INDEPENDENT_CORNER_PROOF',rank_effect:false,save_gate_effect:false};
 const times=(cornerPacket.evidence||[]).map(e=>e.sourceCheckedAt)
  .filter(s=>typeof s==='string'&&Number.isFinite(Date.parse(s)))
  .sort((a,b)=>Date.parse(b)-Date.parse(a));
 if(!times.length)
  return {status:'UNVERIFIED_SOURCE_TIME',rank_effect:false,save_gate_effect:false};
 const runners=shadow.runners.map(r=>({
  horseNo:r.horse_no,horseName:r.horse_name,
  pastRuns:r.recent_runs.map(h=>({
   raceDate:h.race_date,track:h.track,
   raceNo:h.race_no,surface:h.surface,distance:h.distance,
   finish:h.finish,earlyPos:h.early_pos,finalTurnPos:h.final_turn_pos,
   final3f:h.final3f,
   marginToWinner:typeof h.margin_to_winner==='number'?h.margin_to_winner:
     typeof h.margin==='number'?h.margin:null,
   raceClass:h.race_class??h.class_name??null
  }))
 }));
 try{
  const audit=auditPreRaceLossEvidence({
   targetRace:{...targetRace,surface:conditions.surface,
    distance:conditions.distance,className:conditions.class_name??null},
   runners,source:{kind:'LOCAL_OFFICIAL_PAST_RESULT',verified:true,
    checkedAt:times[0]},clock
  });
  return {status:shadow.ignored_prior_runs>0?'PARTIAL_EVIDENCE':'EVIDENCE_ONLY',
   rank_effect:false,save_gate_effect:false,
   applied_prior_runs:shadow.applied_prior_runs,
   ignored_prior_runs:shadow.ignored_prior_runs,
   audit};
 }catch{
  return {status:'UNVERIFIED_EVIDENCE',rank_effect:false,save_gate_effect:false};
 }
}
