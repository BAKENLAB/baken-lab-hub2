// Read-only, DOM-bound official profile acquisition. No prediction or DB writes.
import {ContextError} from './local-worker-data.mjs';
const TTL_MS=180000,MAX_ENTRIES=256,MAX_HTML=2097152;
const copy=rows=>rows.map(row=>({...row}));
export function createVerifiedProfileAcquirer({fetchImpl,parseHtml,parseHistory,now=Date.now,cache=new Map(),onEvent=()=>{}}) {
  const checkLive=(race,signal)=>{
    if(signal?.aborted)throw new ContextError('SOURCE_TIMEOUT');
    if(!Number.isFinite(Date.parse(race.post_time))||Date.parse(race.post_time)<=now()+180000)
      throw new ContextError('PRE_RACE_DEADLINE');
  };
  const validTime=(fetched,race,maxAge)=>{
    const t=Date.parse(fetched),clock=now();
    return Number.isFinite(t)&&t<=clock&&clock-t<=maxAge&&t<Date.parse(race.post_time)-180000;
  };
  function put(key,entry){
    for(const [k,e] of cache)if(!validTime(e.fetched_at,e.race,TTL_MS))cache.delete(k);
    while(cache.size>=MAX_ENTRIES)cache.delete(cache.keys().next().value);
    cache.set(key,entry);
  }
  async function direct(ref,race,signal){
    checkLive(race,signal);
    let response;
    try{
      response=await fetchImpl(ref,{method:'GET',signal,redirect:'error',cache:'no-store',
        headers:{'user-agent':'Mozilla/5.0','accept':'text/html'}});
    }catch{
      checkLive(race,signal);
      throw new ContextError('PROFILE_TRANSPORT_FAILED');
    }
    checkLive(race,signal);
    if(response.status===429)throw new ContextError('PROFILE_RATE_LIMITED');
    if(response.status===401||response.status===403)throw new ContextError('PROFILE_ACCESS_DENIED');
    if(!response.ok||!response.body)throw new ContextError('PROFILE_HTTP_FAILED');
    if(response.url!==ref||!/^text\/html\b|^application\/xhtml\+xml\b/i.test(response.headers.get('content-type')??''))
      throw new ContextError('PROFILE_RESPONSE_UNVERIFIED');
    if(Number(response.headers.get('content-length'))>MAX_HTML)throw new ContextError('PROFILE_TOO_LARGE');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{
      while(true){
        checkLive(race,signal);
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>MAX_HTML)throw new ContextError('PROFILE_TOO_LARGE');
        chunks.push(value);
      }
    }finally{await reader.cancel();}
    checkLive(race,signal);
    const bytes=new Uint8Array(size);let offset=0;
    for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const parsed=parseHtml(new TextDecoder().decode(bytes));
    if(!parsed||!Array.isArray(parsed.rows)||parsed.rows.length>500||
       !Number.isInteger(parsed.link_count)||parsed.link_count>500||
       typeof parsed.body!=='string'||parsed.body.length>100000)
      throw new ContextError('PROFILE_TOO_LARGE');
    return {ok:true,diagnostic_only:true,url:ref,fetched_at:new Date(now()).toISOString(),body:parsed.body,rows:parsed.rows};
  }
  return async ({ref,current,race,signal,readFallback})=>{
    checkLive(race,signal);
    if(!/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=\d{1,30}$/.test(ref)||
       current.status!=='ACTIVE'||current.horse_link_evidence?.horse_no!==current.horse_no||
       current.horse_link_evidence?.horse_ref!==ref||!current.identity_refs?.includes(ref))
      throw new ContextError('HORSE_HISTORY_UNVERIFIED');
    // The new official card has already re-established the same horse-cell link.
    // The key includes the exact current race, stable horse ID, number and name.
    const k=JSON.stringify([race.race_date,race.track,race.race_no,race.circuit,race.post_time,current.horse_no,current.horse_name,ref]);
    const cached=cache.get(k);
    if(cached){
      if(validTime(cached.fetched_at,race,TTL_MS)&&cached.rows.length===5){
        onEvent('cache_hit');return copy(cached.rows);
      }
      cache.delete(k);
    }
    let profile,route='direct';
    try{profile=await direct(ref,race,signal);}
    catch(e){
      // One pre-existing fallback only for transport failure. Never retry rate
      // limits, explicit denial, invalid identities or schema/size failures.
      if(e?.code!=='PROFILE_TRANSPORT_FAILED'||typeof readFallback!=='function')throw e;
      checkLive(race,signal);
      profile=await readFallback();route='probe_fallback';
    }
    checkLive(race,signal);
    if(!profile||profile.url!==ref||!validTime(profile.fetched_at,race,60000))
      throw new ContextError('HORSE_HISTORY_UNVERIFIED');
    const rows=parseHistory(profile,current,race);
    checkLive(race,signal);
    if(!Array.isArray(rows)||rows.length>5||rows.some(h=>h.horse_ref!==ref||h.horse_name!==current.horse_name||
      h.source!=='NAR_OFFICIAL_RESCUE'||h.race_date>=race.race_date))
      throw new ContextError('HORSE_HISTORY_UNVERIFIED');
    const verified=rows.map(h=>({...h,fetched_at:profile.fetched_at}));
    // Partial/empty responses remain visible and are never cached as complete.
    if(verified.length===5)put(k,{race:{post_time:race.post_time},fetched_at:profile.fetched_at,rows:copy(verified)});
    onEvent(route);
    return copy(verified);
  };
}
