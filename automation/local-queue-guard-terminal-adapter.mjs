/**
 * Staging-only adapter for proposed lab_queue_save_prediction_v2 RPC.
 * Not wired to the deployed LOCAL MCP v19.
 *
 * Never retries a previously rejected payload. If the official save guard
 * rejects during the one allowed attempt, v2 atomically terminalizes the job
 * so unrelated regional queue races can advance. Failures outside the
 * allowlisted production guard codes are NEVER classified as terminal.
 */
import {examineNewLocalSave} from './local-guarded-save-readiness.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const terminalCodes=new Set(['LOCAL_EYE_MARKET_EVIDENCE','LOCAL_EYE_CHECK_EVIDENCE']);
export async function saveWithAtomicGuardTerminal({
 jobId,userId,protocolVersion,payload,originalPayload,verifiedRunners,
 postTime,now,previousGuardRejected=false,deployedValidatorVersion=19
},{client}={}){
 const ready=examineNewLocalSave({payload,protocolVersion,verifiedRunners,
  postTime,now,previousGuardRejected,deployedValidatorVersion});
 if(!ready.ok)return {ok:false,skipped:true,code:ready.code};
 if(!uuid(jobId)||!uuid(userId)||!client||typeof client.rpc!=='function')
  return {ok:false,skipped:true,code:'SAVE_AUTH_OR_CLIENT_MISSING'};
 const {data,error}=await client.rpc('lab_queue_save_prediction_v2',{
  p_job_id:jobId,p_user_id:userId,p_protocol_version:protocolVersion,
  p_payload:payload,p_original_payload:originalPayload
 });
 if(error)throw Error('OFFICIAL_SAVE_RPC_FAILED');
 if(data?.ok===true&&uuid(data.prediction_id))
  return {ok:true,prediction_id:data.prediction_id,already_saved:data.already_saved===true};
 if(data?.ok===false&&data.terminal===true&&data.saved===false&&
    data.job_id===jobId&&terminalCodes.has(data.reason))
  return {ok:false,terminal:true,code:data.reason};
 throw Error('UNVERIFIED_QUEUE_SAVE_RESULT');
}
