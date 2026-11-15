// Server-only storage transport, requires the isolated history cache RPCs.
export function makeSupabaseHistoryStore(client){
 if(typeof client?.rpc!=='function')throw Error('JUMP_CACHE_CLIENT');
 return {
  async get(key){const {data,error}=await client.rpc('jra_jump_history_cache_read_v1',{p_key:key});if(error)throw Error('JUMP_CACHE_READ');return data??null},
  async append(record){const {data,error}=await client.rpc('jra_jump_history_cache_append_v1',{p_record:record});if(error||data!==true)throw Error('JUMP_CACHE_APPEND')}
 };
}
