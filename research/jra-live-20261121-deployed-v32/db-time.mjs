// Diagnostics are not authentication. Signature/time validation stays server-side.
export function jwtTimes(value, now=Date.now()) {
  try {
    const parts=value.split('.'); if(parts.length!==3)return {format:'opaque',utc_ms:now};
    const p=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    const number=k=>Number.isFinite(p[k])?p[k]:null;
    return {format:'jwt',utc_ms:now,iat:number('iat'),nbf:number('nbf'),exp:number('exp')};
  } catch { return {format:'unreadable',utc_ms:now}; }
}
export function dbTimeFetch(key, transport=fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms)), report=console.info) {
  return async (input, init) => {
    const request=new Request(input,init);
    const metadata={...jwtTimes(key),authorization_matches_service_key:request.headers.get('authorization')===`Bearer ${key}`,apikey_matches_service_key:request.headers.get('apikey')===key};
    const response=await transport(request);
    report('JRA_DB_TIME',JSON.stringify({...metadata,status:response.status,server_date:response.headers.get('date')}));
    // Only the idempotent read can be replayed. All writes and other auth failures fail closed.
    if(request.method!=='GET'||response.status!==401)return response;
    let body;try{body=await response.clone().json()}catch{return response;}
    if(body.message!=='JWT issued at future')return response;
    await sleep(1100);
    const retry=await transport(request.clone());
    report('JRA_DB_TIME_RETRY',JSON.stringify({utc_ms:Date.now(),status:retry.status,server_date:retry.headers.get('date')}));
    return retry;
  };
}
