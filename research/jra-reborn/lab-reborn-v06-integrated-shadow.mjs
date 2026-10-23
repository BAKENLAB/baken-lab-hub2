import {rankRebornV04} from "./lab-reborn-v04-independent-learned.mjs";
import {buildRebornV06Evidence,canonicalHorseId}
 from "./lab-reborn-v06-clock-evidence.mjs";
import {auditOpponentEvidence} from "./lab-reborn-v06-rival-evidence.mjs";

/**
 * LAB REBORN 0.6 integrated shadow diagnostics.
 * Ranking source is INDEPENDENT 2024-fitted v04 (not old LAB).
 * v06 clock & opponent evidence attached with ZERO rank/score modification
 * until 2025/2026 independent historical validation proves added value.
 * Only run with full as-of candidate field, archived history and frozen
 * 2023/2024 reference; NEVER writes official FROZEN.
 */
export function buildRebornV06Research(baseRows,clockPacket,rivalRows,
  locked2024Model,lockedConditionReference){
 const fail=(status)=>({status,model:"LAB_REBORN_0.6_RESEARCH",
   runners:[],top5:[],production_write:false});
 if(!Array.isArray(baseRows)||baseRows.length<6||!clockPacket||
    !Array.isArray(clockPacket.runners)||!Array.isArray(rivalRows))
  return fail("INCOMPLETE_INPUT");
 const baseline=rankRebornV04(baseRows,locked2024Model);
 if(baseline.status!=="RESEARCH_READY")return fail("BASE_"+baseline.status);
 const track=baseRows[0].track,raceNo=baseRows[0].race_no,date=baseRows[0].race_date;
 if(clockPacket.date!==date||clockPacket.track!==track||
    +clockPacket.race_no!==+raceNo||clockPacket.runners.length!==baseRows.length)
  return fail("TARGET_OR_ROSTER_MISMATCH");
 const clock=buildRebornV06Evidence(clockPacket,lockedConditionReference);
 if(clock.status!=="RESEARCH_EVIDENCE_READY")
  return fail("CLOCK_"+clock.status);
 const byNumber=new Map(clock.runners.map(x=>[+x.horse_no,x]));
 if(byNumber.size!==baseRows.length)return fail("DUPLICATE_CLOCK_ROSTER");
 const codes=new Set(clock.runners.map(x=>x.horse_id));
 if(codes.size!==baseRows.length)return fail("DUPLICATE_HORSE_ID");
 const expanded=[];
 for(const horse of baseline.runners){
  const c=byNumber.get(+horse.horse_no);
  if(!c||c.horse_name!==horse.horse_name)
   return fail("HORSE_IDENTITY_MISMATCH");
  const rivalSubset=rivalRows.filter(x=>x.target_horse_code===c.horse_id);
  const evidence=auditOpponentEvidence(rivalSubset,date,c.horse_id);
  if(evidence.status!=="RESEARCH_OPPONENT_EVIDENCE_READY")
   return fail("OPPONENT_PACKET_ERROR");
  // No silent access to actual target results (baseline feature extract only).
  expanded.push({...horse,
   condition_clock:{runs_checked:c.runs_checked,usable_runs:c.usable_runs,
      best_speed_z:c.best_speed_z,
      prior_examples:c.history_evidence.slice(0,4)},
   opponents:{confirmed_grade_rivals:evidence.graded_future_podium_rival_count,
      unconfirmed_open_rivals:evidence.open_unknown_grade_future_podium_rival_count,
      examples:evidence.evidence.filter(x=>x.later_grade).slice(0,4)},
   v06_score_delta:0,reborn_rank_before_v06:horse.reborn_rank});
 }
 const top5=expanded.filter(x=>x.reborn_rank<=5);
 return {status:"RESEARCH_READY",model:"LAB_REBORN_0.6_RESEARCH_DIAGNOSTIC",
  race_date:date,track,race_no:+raceNo,runners:expanded,top5,
  source_model:locked2024Model.id,
  rank_changes_from_v04:0,computed_uplift:false,
  future_outcomes_used:false,production_write:false,
  official_frozen_modified:false};
}
