// Research candidate only. No network, DB, model, CLAIM or prediction save API.
import {createHash, randomUUID} from 'node:crypto';
export const hash = x => createHash('sha256').update(x).digest('hex');
const stages = new Set(['initial_raw','initial_scoped','initial_response','eval_materials','preview_raw','preview_scoped','bridge_before','bridge_after','eye_before','eye_after','save_raw','save_scoped','submitted_payload','final_payload','shadow_raw','receipt']);
const secretKey = /(?:authorization|cookie|password|secret|api.?key|claim.?token|worker.?token|access.?token|refresh.?token|service.?role.?key|private.?key)/i;
const secretText = /(?:Bearer\s+[A-Za-z0-9._~-]+|sk-(?:proj-)?[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/;
function cleanCopy(x, started, budget, depth=0, seen=new Set(), counter={n:0}) {
  if(performance.now()-started>budget || ++counter.n>100000 || depth>40)throw Error('CAPTURE_BOUND');
  if(x===null || typeof x==='boolean')return x;
  if(typeof x==='number' && Number.isFinite(x))return x;
  if(typeof x==='string'){if(secretText.test(x) || /"(?:claim_token|api_key|authorization|worker_token|service_role_key)"\s*:/i.test(x))throw Error('SECRET');if(/^[\s]*[\[{]/.test(x)){let parsed;try{parsed=JSON.parse(x);}catch{}if(parsed!==undefined)cleanCopy(parsed,started,budget,depth+1,seen,counter);}return x;}
  if(typeof x!=='object' || seen.has(x))throw Error('NON_JSON');
  if(!Array.isArray(x) && ![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw Error('NON_PLAIN');
  seen.add(x);const out=Array.isArray(x)?[]:Object.create(null);
  for(const k of Object.keys(x)){
    if(secretKey.test(k))throw Error('SECRET');
    const d=Object.getOwnPropertyDescriptor(x,k);
    if(!d || !('value' in d))throw Error('ACCESSOR');
    out[k]=cleanCopy(d.value,started,budget,depth+1,seen,counter);
  }
  seen.delete(x);return out;
}
const requiredGate=['job_id','worker_run_id','trace_id','protocol_version','context_sha256','active_roster_sha256'];
function gateValid(g,now){
  return g && requiredGate.every(k=>typeof g[k]==='string' && g[k].length>0)
    && /^[a-f0-9]{64}$/.test(g.context_sha256) && /^[a-f0-9]{64}$/.test(g.active_roster_sha256)
    && g.ready===true && g.job_status==='CLAIMED' && g.worker_status==='RUNNING'
    && g.worker_id==='JRA_QUEUE_RESCUE' && g.circuit==='JRA'
    && Number.isFinite(Date.parse(g.checked_at)) && Date.parse(g.checked_at)<=now
    && now<Date.parse(g.lease_until) && now<Date.parse(g.post_time)-180000;
}
export function createResearchCapture(options={}) {
  // OFF: don't touch a sink, gate, clock, producer or source object.
  if(options.enabled!==true)return Object.freeze({enabled:false,observe:async()=>({status:'OFF'}),report:()=>({status:'OFF',events:0,production_allowed:false})});
  const {sink,now=()=>Date.now(),maxEvents=32,maxEventBytes=1048576,maxTotalBytes=8388608,totalWaitMs=150,copyBudgetMs=20}=options;
  let gate,invalid=false;
  try{gate=cleanCopy(options.gate,performance.now(),copyBudgetMs);}catch{invalid=true;}
  let count=0,bytes=0,wait=0,previous=null,busy=false,failed=false,terminal=false;
  const session=randomUUID();
  const state=()=>({status:failed?'INCOMPLETE':'OBSERVED_NOT_AUTHENTICATED',events:count,bytes,wait_ms:wait,chain_head:previous,session,production_allowed:false,real_comparison:false});
  return Object.freeze({enabled:true,report:state, async observe(stage,produce){
    if(terminal || busy || invalid || failed || !stages.has(stage))return {status:'SKIPPED'};
    if(typeof sink!=='function') {failed=true;return {status:'DISCONNECTED'};}
    let clock;try{clock=now();}catch{failed=true;return {status:'SKIPPED'};}
    if(!gateValid(gate,clock)){failed=true;return {status:'EXPIRED_OR_UNPROVEN_GATE'};}
    if(count>=maxEvents || wait>=totalWaitMs){failed=true;return {status:'BOUND'};}
    busy=true;const start=performance.now();let timer,controller;
    try{
      const value=cleanCopy(produce(),start,copyBudgetMs);
      const valueText=JSON.stringify(value);
      const event={schema:'V16_USED_INPUT_OBSERVATION_V1',session,seq:count+1,previous_sha256:previous,gate,stage,representation:'INTERNAL_JSON_NOT_HTTP_BYTES',observed_at:new Date(clock).toISOString(),value_sha256:hash(valueText),value,authenticated:false,production_allowed:false};
      // Consumer receives immutable text, never a reference to normal-process objects.
      const text=JSON.stringify(event),size=Buffer.byteLength(text);
      if(size>maxEventBytes || bytes+size>maxTotalBytes)throw Error('BOUND');
      if(!gateValid(gate,now()))throw Error('DEADLINE');
      const remaining=totalWaitMs-wait-(performance.now()-start);
      if(remaining<=0)throw Error('BOUND');
      controller=new AbortController();
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},remaining);});
      await Promise.race([Promise.resolve().then(()=>sink(text,{signal:controller.signal,event_id:session+':'+(count+1)})),timeout]);
      if(!gateValid(gate,now()))throw Error('DEADLINE');
      previous=hash(text);count++;bytes+=size;if(stage==='receipt')terminal=true;
      return {status:'OBSERVED_NOT_AUTHENTICATED',event_sha256:previous};
    }catch{failed=true;controller?.abort();return {status:'CAPTURE_UNAVAILABLE'};}
    finally{clearTimeout(timer);wait+=performance.now()-start;busy=false;}
  }});
}
export function checkRecordedChain(texts){
  let previous=null,session=null,gate=null;
  for(let i=0;i<texts.length;i++){
    const e=JSON.parse(texts[i]);
    if(e.schema!=='V16_USED_INPUT_OBSERVATION_V1' || e.seq!==i+1 || e.previous_sha256!==previous || !stages.has(e.stage) || hash(JSON.stringify(e.value))!==e.value_sha256)throw Error('CHAIN_OR_CONTENT');
    if(i && (session!==e.session || gate!==JSON.stringify(e.gate)))throw Error('TRACE_CHANGED');
    session=e.session;gate=JSON.stringify(e.gate);previous=hash(texts[i]);
  }
  return {events:texts.length,chain_head:previous,authenticity:'UNPROVEN',real_comparison:false};
}
