// Server-only candidate; inject authenticated client and direct official evidence readers.
// Never instantiate with a browser client. No table-write methods are provided.
const need=(b,c)=>{if(!b)throw Error('JUMP_'+c)};
async function one(q,code,optional=false){const {data,error}=await q.maybeSingle();need(!error&&(optional||data),code);return data??null}
async function many(q,code){const {data,error}=await q;need(!error&&Array.isArray(data),code);return data}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);need(!error,'RPC_'+name);return data}
function key(r){return r.race_date.replaceAll('-','')+'_'+r.track+'_'+r.race_no+'R'}
const scope=(q,r)=>q.eq('race_date',r.race_date).eq('track',r.track).eq('race_no',r.race_no);
export function makeSupabaseJumpPorts({client,authorize,officialReader,historyReader,clock=()=>new Date().toISOString(),digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('')}){
 need(client&&typeof authorize==='function'&&typeof officialReader==='function'&&typeof historyReader==='function','SERVER_DEPENDENCIES');
 return {
  authorize,clock,digest,
  async protocolActive(version){const rows=await many(client.from('lab_prediction_protocols').select('version').eq('protocol_key','JRA_JUMP').eq('is_active',true),'PROTOCOL_READ');return rows.length===1&&rows[0].version===version},
  async fetchOfficialProof(race){const q=await one(scope(client.from('jra_live_queue').select('race_date,track,race_no,cname,status'),race),'LIVE_QUEUE');need(q.status==='done'&&typeof q.cname==='string'&&q.cname,'LIVE_CAPTURE');return officialReader({...race,cname:q.cname})},
  async publishVerified(proof){const row=await rpc(client,'jra_jump_publish_verified_card_v1',{p_proof:proof});need(row?.ok===true&&row.status==='BASIC_READY','PUBLISH_RECEIPT');return row},
  async claimNext(){return rpc(client,'jra_jump_manual_claim_next_v1',{})},
  async readClaimBundle(job_id){
   const job=await one(client.from('jra_prediction_jobs').select('id,race_date,track,race_no,job_status,claimed_by,claimed_at,claim_token,lease_until,worker_run_id').eq('id',job_id),'CLAIM_READ');
   need(job.job_status==='CLAIMED'&&job.claimed_by==='JRA_JUMP_QUEUE'&&job.worker_run_id&&Date.parse(job.lease_until)>Date.parse(clock()),'CLAIM_READ_STATE');
   const worker=await one(client.from('jra_prediction_worker_runs').select('id,worker_id,status').eq('id',job.worker_run_id),'WORKER_READ');
   const race=await one(scope(client.from('official_races').select('race_date,track,race_no,circuit,race_name,post_time,source,field_status,field_payload,prediction_status'),job).eq('circuit','JRA'),'RACE_READ');
   need(race.source==='JRA_OFFICIAL_VERIFIED_GATE_V1'&&race.field_payload?.race?.race_type==='障害','JUMP_READY_ONLY');
   const live=await one(scope(client.from('jra_live_races').select('id,race_date,track,race_no,cname,race_type,surface,distance,field_size'),job),'LIVE_READ');
   const live_runners=await many(client.from('jra_live_runners').select('horse_no,horse_name,horse_ref,draw,jockey,weight_carried,past_runs').eq('live_race_id',live.id),'RUNNERS_READ');
   const official_html=await one(client.from('jra_html_evidence').select('race_key,cname,html_sha256,official_status_verified,runner_count').eq('race_key',key(race)).eq('html_sha256',race.field_payload.official_status_verification?.html_sha256),'OFFICIAL_HTML_RECEIPT');
   const prior=await many(scope(client.from('official_predictions').select('id'),job),'PRIOR_PREDICTION_READ');
   const legacy=await many(scope(client.from('chappy_predictions').select('race_no'),job),'LEGACY_PREDICTION_READ');
   return {job,worker,race,live,live_runners,official_html,existing_prediction:prior.length>0||legacy.length>0};
  },
  async getVerifiedHistory(raw){return historyReader(raw)},
  async saveClaimed({job_id,expected_claim_token,protocol_version,payload}){
   const id=await rpc(client,'jra_jump_save_claimed_prediction_v1',{p_job_id:job_id,p_expected_claim_token:expected_claim_token,p_protocol_version:protocol_version,p_payload:payload});
   need(typeof id==='string'&&id,'SAVE_ID_MISSING');return id;
  },
  async readReceipt(id,job_id){
   const p=await one(client.from('official_predictions').select('id,race_date,track,race_no,circuit,post_time,protocol_version,status,frozen_at,payload').eq('id',id),'FROZEN_READ');
   const j=await one(client.from('jra_prediction_jobs').select('id,race_date,track,race_no,job_status').eq('id',job_id),'DONE_READ');
   const r=await one(scope(client.from('official_races').select('race_date,track,race_no,circuit,prediction_status,post_time'),p).eq('circuit','JRA'),'REGISTRY_READ');
   need(p.circuit==='JRA'&&r.prediction_status==='FROZEN'&&key(j)===key(p)&&key(r)===key(p)&&r.post_time===p.post_time,'REGISTRY_RECEIPT');
   return {...p,job_status:j.job_status,race_key:key(p)};
  }
 };
}
