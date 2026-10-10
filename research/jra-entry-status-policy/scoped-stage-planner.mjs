// SHADOW ONLY: produces a plan, never changes a database.
import {gateFlatRace} from './flat-race-gate.mjs';
import {planScopedRefresh} from './incremental-gates.mjs';
export function planFlatRaceStage({race,runners,verifiedStatuses,sourceSignature,previousSignature}) {
  const gate=gateFlatRace(race);
  if(gate.state!=='ELIGIBLE') return gate;
  const plan=planScopedRefresh({race,runners,verifiedStatuses,sourceSignature,previousSignature});
  if(plan.state!=='STAGE_ONLY') return plan;
  if(plan.activeHorseNos.length===0) return {state:'HOLD',reason:'NO_ACTIVE_RUNNERS'};
  return {...plan,model:'JRA_FLAT_ONLY',eligibleForOfficialPublish:false};
}
