// SHADOW ONLY. Pure scorer; no DB writes or official publication.
export const WEIGHTS=Object.freeze({recent:0.30,exact:0.17,distance:0.12,track:0.08,going:0.07,transition:0.12,jockey:0.07});
export function combineComponents({components,historyN}) {
  if (!components || !Number.isInteger(historyN) || historyN<0) return {state:'HOLD',reason:'INVALID_INPUT'};
  let weighted=0,weight=0,available=0;
  for(const [key,w] of Object.entries(WEIGHTS)) {
    const v=components[key];
    if(v===null || v===undefined) continue;
    if(typeof v!=='number' || !Number.isFinite(v) || v<0 || v>100) return {state:'HOLD',reason:`INVALID_${key.toUpperCase()}`};
    weighted+=v*w;weight+=w;available++;
  }
  const score=weight>0?Number((weighted/weight).toFixed(6)):null;
  const dataStatus=historyN>=3 && available>=4?'RANKED':historyN>=1 && available>=2?'REFERENCE':'DATA_INSUFFICIENT';
  return {state:'CALCULATED',score,availableComponents:available,historyN,dataStatus};
}
export function rankRaceShadow(horses) {
  if(!Array.isArray(horses)||!horses.length) return {state:'HOLD',reason:'NO_HORSES'};
  const ids=new Set(),scored=[];
  for(const h of horses){
    if(!Number.isInteger(h.horse_no)||h.horse_no<1||ids.has(h.horse_no)) return {state:'HOLD',reason:'DUPLICATE_HORSE'};
    ids.add(h.horse_no);
    const result=combineComponents(h);
    if(result.state!=='CALCULATED') return result;
    scored.push({horse_no:h.horse_no,...result});
  }
  scored.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.horse_no-b.horse_no);
  return {state:'STAGE_ONLY',ranked:scored.map((x,i)=>({...x,shadowOrder:i+1})),eligibleForOfficialPublish:false};
}
