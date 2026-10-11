const circuits=['JRA','LOCAL'];
const empty=action=>action==='list'?{races:[],predictions:[]}:{results:[]};
function validate(data,action,date,circuit){
 if(data?.ok!==true||data.date!==date)throw Error('invalid_response');
 if(data.circuit_status?.[circuit]?.state==='ERROR'||data.partial===true)throw Error('partial_response');
 for(const field of Object.keys(empty(action))){
  if(!Array.isArray(data[field])||data[field].some(row=>row.race_date!==date||row.circuit!==circuit))throw Error('wrong_circuit_or_date');
 }
 return data;
}
// Separate generation per screen; late responses cannot replace a newer date.
export function createCircuitLoader(api,timeoutMs=15000){
 const screens=new Map();
 return async function load(action,date,notify){
  let screen=screens.get(action);
  if(!screen||screen.date!==date)screen={date,serial:0,parts:{},statuses:{}};
  screens.set(action,screen);const serial=++screen.serial;
  const current=()=>screens.get(action)===screen&&screen.serial===serial;
  const emit=()=>{if(!current())return;const data=empty(action);for(const c of circuits)for(const field of Object.keys(data))data[field].push(...(screen.parts[c]?.[field]??[]));notify({data,statuses:structuredClone(screen.statuses)})};
  for(const c of circuits)screen.statuses[c]={state:'LOADING',stale:!!screen.parts[c]};emit();
  await Promise.all(circuits.map(async circuit=>{
   let timer;const controller=new AbortController();
   try{
    const raw=await Promise.race([api({action,date,circuit},controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'))},timeoutMs)})]);
    const data=validate(raw,action,date,circuit);if(!current())return;
    screen.parts[circuit]=data;screen.statuses[circuit]={state:'READY',stale:false};
   }catch{if(!current())return;screen.statuses[circuit]={state:'ERROR',stale:!!screen.parts[circuit]}}
   finally{clearTimeout(timer);emit()}
  }));
 };
}
