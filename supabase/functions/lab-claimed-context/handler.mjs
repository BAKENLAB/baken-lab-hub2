import {assertLiveClaim,collectClaimedContext,ContextError} from '../../../automation/local-worker-data.mjs';
import {createReadOnlyDb} from '../../../automation/local-worker-db.mjs';
import {createNarOfficialReader} from '../../../automation/nar-official-data.mjs';
import {historyBeforeRace} from '../../../automation/history-boundary.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keys=['run_id','job_id','claim_token'];
const select={run:'id,worker_id,status',job:'id,race_date,track,race_no,circuit,job_status,worker_run_id,claim_token,claimed_by,lease_until,attempts,max_attempts',race:'race_date,track,race_no,circuit,race_name,post_time,prediction_status,field_payload',protocol:'protocol_key,version,is_active,content'};
const historyKeys='race_date track race_no race_name surface distance going finish margin time_raw early_pos final_turn_pos final3f weight_carried body_weight jockey trainer horse_no source_ref horse_ref source race_start_at scheduled_start_at result_confirmed_at data_origin identity_source_ref identity_verified_by'.split(' ');
const currentKeys='horse_no horse_name sex_age weight_carried jockey draw trainer sire damsire body_weight body_weight_diff equipment current_source_ref'.split(' ');
const conditionKeys='surface distance going weather turn class_name'.split(' ');
const pick=(o,ks)=>Object.fromEntries(ks.filter(k=>o[k]!==undefined).map(k=>[k,scalar(o[k])]));
function scalar(v){if(v!==null && !['string','number','boolean'].includes(typeof v))throw new ContextError('INVALID_OUTPUT');if(typeof v==='string'&&v.length>2048)throw new ContextError('INVALID_OUTPUT');return v;}
const strings=v=>{if(!Array.isArray(v)||v.length>40||v.some(x=>typeof x!=='string'||x.length>1024))throw new ContextError('INVALID_OUTPUT');return [...v];};
async function rows(q){const {data,error}=await q.abortSignal(AbortSignal.timeout(5000));if(error||!Array.isArray(data))throw new ContextError('CONTEXT_READ_FAILED');return data;}
async function one(q){const r=await rows(q.limit(2));if(r.length!==1)throw new ContextError('CONTEXT_NOT_UNIQUE');return r[0];}
export async function loadState(client,input,now){
 const run=await one(client.from('lab_worker_runs').select(select.run).eq('id',input.run_id));
 const job=await one(client.from('lab_prediction_jobs').select(select.job).eq('id',input.job_id));
 if(job.worker_run_id!==input.run_id||job.claim_token!==input.claim_token)throw new ContextError('STALE_OR_EXPIRED_CLAIM');
 const race=await one(client.from('official_races').select(select.race).eq('race_date',job.race_date).eq('track',job.track).eq('race_no',job.race_no).eq('circuit',job.circuit));
 const protocol=await one(client.from('lab_prediction_protocols').select(select.protocol).eq('protocol_key','LOCAL_MAIN').eq('is_active',true));
 const state={run,job,race,protocol};assertLiveClaim(state,now());
 if(!protocol.content || typeof protocol.content!=='object'||Array.isArray(protocol.content)||JSON.stringify(protocol.content).length>131072)throw new ContextError('ACTIVE_PROTOCOL_REQUIRED');
 return state;
}
// Reject unsafe histories at the last boundary; reconstruct only permitted fields.
export function finalContext(context,state,now=Date.now()){
 assertLiveClaim(state,now);
 if(context.claim.job_id!==state.job.id||context.claim.run_id!==state.run.id||context.claim.claim_token!==state.job.claim_token||context.protocol_version!==state.protocol.version||context.field_integrity_checked!==true||['race_date','track','race_no','circuit','post_time'].some(k=>context.race[k]!==state.race[k]))throw new ContextError('CONTEXT_CHANGED');
 if(!Array.isArray(context.runners)||!context.runners.length||context.runners.length>20)throw new ContextError('INVALID_OUTPUT');
 const seen=new Set();
 const runners=context.runners.map(r=>{
  if(!Number.isInteger(r.horse_no)||seen.has(r.horse_no)||!Array.isArray(r.recent_runs)||r.recent_runs.length>5)throw new ContextError('INVALID_OUTPUT');seen.add(r.horse_no);
  const refs=strings(r.identity_refs);
  const recent_runs=r.recent_runs.map(h=>{
   if(!historyBeforeRace(h,state.race)||!['NAR_OFFICIAL_DEBA','NAR_OFFICIAL_HISTORY','NAR_OFFICIAL_RESCUE','jra_public_reference'].includes(h.source)||!h.source_ref||!h.identity_source_ref||!['OFFICIAL_HORSE_REF','OFFICIAL_RACE_HORSE_NO'].includes(h.identity_verified_by))throw new ContextError('UNSAFE_HISTORY');
   for(const k of ['fetched_at','available_at','observed_at'])if(h[k]!=null&&(!Number.isFinite(Date.parse(h[k]))||Date.parse(h[k])>now||Date.parse(h[k])>=Date.parse(state.race.post_time)))throw new ContextError('UNSAFE_HISTORY');
   return pick(h,historyKeys);
  });
  return {...pick(r,currentKeys),identity_refs:refs,recent_runs,missing_items:strings(r.missing_items)};
 });
 return {race:{...pick(context.race,['race_date','track','race_no','circuit','post_time','race_name']),conditions:pick(context.race.conditions??{},conditionKeys)},protocol:{protocol_key:'LOCAL_MAIN',version:state.protocol.version,content:state.protocol.content},runners,missing_conditions:strings(context.missing_conditions),field_integrity_checked:true,stage:'AWAITING_FULL_DEPTH_COMPARISON',protocol_version:state.protocol.version,
 supplementation_audit:context.supplementation_audit.map(a=>pick(a,['stage','horse_no','outcome','reason']))};
}
function response(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});}
export function createHandler({client,serviceKey,now=Date.now,officialFactory=()=>createNarOfficialReader({now}),collector=collectClaimedContext}){
 return async req=>{
  if(req.method!=='POST')return response(405,{ok:false,error:'POST_REQUIRED'});
  if(!serviceKey)return response(503,{ok:false,error:'AUTH_NOT_CONFIGURED'});
  if(req.headers.get('authorization')!==`Bearer ${serviceKey}`)return response(401,{ok:false,error:'UNAUTHORIZED'});
  try{
   if(!(req.headers.get('content-type')??'').startsWith('application/json'))return response(400,{ok:false,error:'INVALID_REQUEST'});
   const reader=req.body?.getReader();if(!reader)return response(400,{ok:false,error:'INVALID_REQUEST'});
   let text='',size=0;const decoder=new TextDecoder();
   try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048)return response(413,{ok:false,error:'REQUEST_TOO_LARGE'});text+=decoder.decode(value,{stream:true});}}finally{await reader.cancel();}
   let input;try{input=JSON.parse(text+decoder.decode());}catch{return response(400,{ok:false,error:'INVALID_REQUEST'});}
   if(!input||Array.isArray(input)||Object.keys(input).length!==3||keys.some(k=>!uuid.test(input[k]??'')))return response(400,{ok:false,error:'INVALID_REQUEST'});
   const state=await loadState(client,input,now);
   const context=await collector(state,{db:createReadOnlyDb(client),official:officialFactory(),now});
   const fresh=await loadState(client,input,now);
   if(fresh.protocol.content!==state.protocol.content||JSON.stringify(fresh.race.field_payload)!==JSON.stringify(state.race.field_payload))throw new ContextError('CONTEXT_CHANGED');
   return response(200,{ok:true,context:finalContext(context,fresh,now())});
  }catch(e){return response(e instanceof ContextError?409:500,{ok:false,error:e instanceof ContextError?e.code:'CONTEXT_UNAVAILABLE'});}
 };
}
