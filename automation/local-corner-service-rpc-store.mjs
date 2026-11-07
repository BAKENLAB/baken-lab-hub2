/**
 * Server-side adapter for the private LOCAL pre-CLAIM snapshot RPCs.
 * The client MUST be authenticated by the host as Supabase service_role.
 * Never initialize with a client key from user input or in a browser.
 * The caller remains responsible for official field validation and stage/lookup.
 */
const ids=Object.freeze({
 insert:'lab_preclaim_local_corner_insert_v1',
 read:'lab_preclaim_local_corner_read_v1'
});
const okText=x=>typeof x==='string'&&x.length>0&&x.length<=160;
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function createLocalCornerServiceRpcStore({client,timeoutMs=180}={}){
 if(typeof client?.rpc!=='function'||!Number.isInteger(timeoutMs)||
    timeoutMs<1||timeoutMs>2000)throw new TypeError('SERVER_RPC_CLIENT_REQUIRED');
 const call=async (name,args)=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('OPTIONAL_RPC_TIMEOUT'),timeoutMs);
  try{
   let query=client.rpc(name,args);
   if(typeof query?.abortSignal==='function')query=query.abortSignal(controller.signal);
   const result=await Promise.race([
    query,
    new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>{
     reject(new Error('OPTIONAL_RPC_TIMEOUT'));
    },{once:true}))
   ]);
   if(result?.error)throw new Error('OPTIONAL_RPC_FAILED');
   return result?.data;
  }finally{clearTimeout(timer);controller.abort();}
 };
 return {
  async insertIfAbsent(record){
   if(!record||record.circuit!=='LOCAL'||
      record.source_kind!=='LOCAL_OFFICIAL_CORNERS'||
      record.source_version!=='LOCAL_CORNER_1'||
      !record.evidence||!iso(record.as_of))throw new TypeError('UNSAFE_RPC_RECORD');
   const data=await call(ids.insert,{p_record:record});
   if(!data||typeof data.inserted!=='boolean')throw new Error('OPTIONAL_RPC_RESULT_INVALID');
   return {inserted:data.inserted};
  },
  async findLatest(conditions){
   if(!conditions||conditions.circuit!=='LOCAL'||
      conditions.source_kind!=='LOCAL_OFFICIAL_CORNERS'||
      !/^\d{4}-\d{2}-\d{2}$/.test(conditions.race_date||'')||
      !okText(conditions.track)||!Number.isInteger(conditions.race_no)||
      conditions.race_no<1||conditions.race_no>14||
      !/^[a-f0-9]{64}$/.test(conditions.official_roster_digest||'')||
      !iso(conditions.before))throw new TypeError('UNSAFE_RPC_LOOKUP');
   const data=await call(ids.read,{
    p_race_date:conditions.race_date,p_track:conditions.track,
    p_race_no:conditions.race_no,
    p_roster_digest:conditions.official_roster_digest,
    p_before:conditions.before
   });
   return data??null;
  }
 };
}
