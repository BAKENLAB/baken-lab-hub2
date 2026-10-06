// No secrets in return values, errors or logs. OAuth authorization is supplied by hosting.
export const WORKER_REGIONS=Object.freeze({LOCAL_QUEUE_WEST:'西日本',LOCAL_QUEUE_KANTO:'関東',LOCAL_QUEUE_CHUBU:'中部',LOCAL_QUEUE_HOKKAIDO_TOHOKU:'北海道東北',LOCAL_QUEUE_RESCUE:'RESCUE'});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const codes=new Set(['WORKER_NOT_ALLOWED','QUEUE_START_FAILED','QUEUE_STATE_UNAVAILABLE','FORBIDDEN','AUTHORIZATION_NOT_CONFIGURED','SERVER_CONFIGURATION_ERROR','CLAIM_UNAVAILABLE','CLAIM_CHANGED','CONTEXT_UNAVAILABLE','CONTEXT_CHANGED','SAVE_REJECTED','SAVE_RESULT_INVALID','SAVE_RETRY_MISMATCH']);
export const publicError=e=>codes.has(e?.message)?e.message:'OPERATION_FAILED';
export async function bounded(fn,ms=14000){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OPERATION_FAILED')),ms);})]);}finally{clearTimeout(timer);}}
export async function queueNext(input,{authorize,client,now=Date.now,timeoutMs=14000}){
 if(!input||Object.keys(input).length!==1||!Object.hasOwn(WORKER_REGIONS,input.worker_id))throw Error('WORKER_NOT_ALLOWED');
 await bounded(authorize,timeoutMs);
 const {data,error}=await bounded(()=>client.rpc('lab_queue_claim_next_v1',{p_worker_id:input.worker_id}).abortSignal(AbortSignal.timeout(timeoutMs)),timeoutMs);
 if(error)throw Error(error.message==='QUEUE_STATE_UNAVAILABLE'?'QUEUE_STATE_UNAVAILABLE':'QUEUE_START_FAILED');
 if(!data||typeof data.claimed!=='boolean'||typeof data.resumed!=='boolean')throw Error('QUEUE_STATE_UNAVAILABLE');
 if(data.claimed===false){if(data.resumed)throw Error('QUEUE_STATE_UNAVAILABLE');return {ok:true,claimed:false,resumed:false};}
 if(!uuid(data.job_id)||!uuid(data.run_id)||data.region!==WORKER_REGIONS[input.worker_id]||typeof data.lease_until!=='string'||!Number.isFinite(Date.parse(data.lease_until))||Date.parse(data.lease_until)<=now())throw Error('QUEUE_STATE_UNAVAILABLE');
 return {ok:true,claimed:true,resumed:data.resumed,job_id:data.job_id,run_id:data.run_id,region:data.region,lease_until:data.lease_until};
}
export async function queueSave({job_id,protocol_version,payload,original_payload},{authorize,client,timeoutMs=14000}){
 const user=await bounded(authorize,timeoutMs);
 if(!uuid(user?.id))throw Error('FORBIDDEN');
 const {data,error}=await bounded(()=>client.rpc('lab_queue_save_prediction_v1',{p_job_id:job_id,p_user_id:user.id,p_protocol_version:protocol_version,p_payload:payload,p_original_payload:original_payload}).abortSignal(AbortSignal.timeout(timeoutMs)),timeoutMs);
 if(error)throw Error('SAVE_REJECTED');
 if(data?.ok!==true||!uuid(data.prediction_id)||typeof data.already_saved!=='boolean')throw Error('SAVE_RESULT_INVALID');
 return {ok:true,prediction_id:data.prediction_id,already_saved:data.already_saved};
}
