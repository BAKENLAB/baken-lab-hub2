// The first verified field must still match the DB's current field.
// A refresh race is recoverable only by restarting the entire verification
// with the same live claim, same race/time and exact same approved protocol.
// Never reuse a claimed context produced for a changed field.
import {assertLiveClaim,ContextError} from './local-worker-data.mjs';
function sameBoundary(a,b,now){
  assertLiveClaim(a,now);assertLiveClaim(b,now);
  if(a.run.id!==b.run.id||a.run.worker_id!==b.run.worker_id||
     a.job.id!==b.job.id||a.job.claim_token!==b.job.claim_token||
     a.job.lease_until!==b.job.lease_until||
     ['race_date','track','race_no','circuit','post_time'].some(k=>a.race[k]!==b.race[k])||
     a.protocol.version!==b.protocol.version||
     a.protocol.protocol_key!==b.protocol.protocol_key||
     a.protocol.is_active!==true||b.protocol.is_active!==true||
     JSON.stringify(a.protocol.content)!==JSON.stringify(b.protocol.content))
    throw new ContextError('CONTEXT_CHANGED');
}
function sameField(a,b){return JSON.stringify(a.race.field_payload)===JSON.stringify(b.race.field_payload);}
export async function collectStableClaimContext({load,collect,now=Date.now}) {
  const started=now();
  let state=await load();
  assertLiveClaim(state,now());
  let context=await collect(state,Infinity);
  let fresh=await load();
  sameBoundary(state,fresh,now());
  if(sameField(state,fresh))return {context,fresh,restarts:0};
  // The enclosing MCP has a 30 s timeout. Use one bounded full restart only
  // after an early field refresh, leaving time for fresh state and optional
  // evidence reads. If it changes again, fail closed as before.
  if(now()-started>8000||now()<started)throw new ContextError('CONTEXT_CHANGED');
  state=fresh;
  context=await collect(state,started+22000);
  fresh=await load();
  sameBoundary(state,fresh,now());
  if(!sameField(state,fresh))throw new ContextError('CONTEXT_CHANGED');
  return {context,fresh,restarts:1};
}
