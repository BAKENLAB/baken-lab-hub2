const circuits=['JRA','LOCAL'];
// A branch failure never rejects the other branch. No raw error details exposed.
export async function collectCircuitResponses(action,date,selected,read,timeoutMs=12000){
 const requested=selected==='ALL'?circuits:[selected];
 const settled=await Promise.all(requested.map(async circuit=>{
  let timer;try{
   const response=await Promise.race([read(circuit),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),timeoutMs)})]);
   const body=await response.json();
   if(!response.ok||body.ok!==true)throw Error('read_failed');
   return {circuit,body,state:'READY'};
  }catch{return {circuit,state:'ERROR',error:'circuit_read_failed'}}finally{clearTimeout(timer)}
 }));
 const successful=settled.filter(x=>x.state==='READY');
 const circuit_status=Object.fromEntries(settled.map(x=>[x.circuit,{state:x.state,...(x.error?{error:x.error}:{})}]));
 if(!successful.length)return {status:503,body:{ok:false,date,error:'circuit_read_failed',circuit_status}};
 const body={ok:true,date};
 if(action==='list'){
  Object.assign(body,{mode:'DISPLAY_ONLY',excluded_predictions:successful.flatMap(x=>x.body.excluded_predictions),predictions:successful.flatMap(x=>x.body.predictions),races:successful.flatMap(x=>x.body.races)});
  body.races.sort((a,b)=>String(a.circuit).localeCompare(String(b.circuit),'ja')||String(a.track).localeCompare(String(b.track),'ja')||Number(a.race_no)-Number(b.race_no));
  body.counts={races:body.races.length,frozen:body.races.filter(x=>x.prediction_status==='FROZEN').length,pending:body.races.filter(x=>x.prediction_status!=='FROZEN').length,market_ready:body.races.filter(x=>x.market_status==='READY').length,result_ready:body.races.filter(x=>x.result_status==='READY').length};
 }else body.results=successful.flatMap(x=>x.body.results);
 return {status:200,body:{...body,circuit_status,partial:successful.length!==requested.length}};
}
