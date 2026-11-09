/**
 * Read-only fail-closed gate BEFORE a first official LOCAL MCP save.
 * Never rewrites evidence, scores, EYE, receipts or queue state.
 * A rejected payload must not be sent again through this helper.
 */
import {testLocalPayloadBeforeOfficialMcp} from './local-production-v19-guard-parity.mjs';
import {checkLocalEyeTextBeforeSave} from './local-eye-market-safety-audit.mjs';
const isDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function examineNewLocalSave({
 payload,protocolVersion,verifiedRunners,postTime,now,
 previousGuardRejected=false,deployedValidatorVersion=19
}={}){
 if(previousGuardRejected)return {ok:false,code:'PREVIOUS_GUARD_REJECTION_NO_RESUBMIT'};
 if(!isDate(postTime)||!isDate(now)||Date.parse(postTime)<=Date.parse(now)+180000)
   return {ok:false,code:'NOT_SAFELY_PRE_RACE'};
 if(!Array.isArray(verifiedRunners)||verifiedRunners.length===0)
   return {ok:false,code:'VERIFIED_ROSTER_UNAVAILABLE'};
 const unknown=verifiedRunners.filter(h=>!Number.isInteger(h?.horse_no)||
   !Array.isArray(h?.recent_runs)||h.recent_runs.length===0).map(h=>h?.horse_no??null);
 if(unknown.length>1)
   return {ok:false,code:'MULTIPLE_RUNNERS_WITHOUT_VERIFIED_HISTORY',horse_nos:unknown};
 if(unknown.length===1 &&
    (payload?.audit?.partial_coverage!==true ||
     !payload?.audit?.unrated_runner_nos?.includes(unknown[0])))
   return {ok:false,code:'PARTIAL_COVERAGE_MUST_BE_DECLARED',horse_nos:unknown};
 if(!Array.isArray(payload?.runners)||
    verifiedRunners.length!==payload.runners.length||
    verifiedRunners.some(h=>!payload.runners.some(p=>p.horse_no===h.horse_no&&p.horse_name===h.horse_name)))
   return {ok:false,code:'ROSTER_IDENTITY_MISMATCH'};
 const market=checkLocalEyeTextBeforeSave({payload,protocolVersion});
 if(!market.ok)return {ok:false,code:market.status,issues:market.issues};
 // SQL flag/pool preflight ALONE cannot detect these failures.
 const v19=testLocalPayloadBeforeOfficialMcp({
  payload,protocolVersion,currentDeployedMcpVersion:deployedValidatorVersion
 });
 if(!v19.ok)return {ok:false,code:v19.code};
 return {ok:true,code:'PRE_SUBMIT_V19_PARITY_PASS',scanned_runner_count:verifiedRunners.length};
}
