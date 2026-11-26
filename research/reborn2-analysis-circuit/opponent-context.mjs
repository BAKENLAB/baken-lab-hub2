const time=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
const valid=(r,cutoff)=>r.identity_verified===true && r.result_verified===true &&
  typeof r.horse_id==='string' && /^\d+$/.test(r.horse_id) && r.race_id && r.result_ref &&
  /^(JRA|LOCAL)$/.test(r.circuit) && Number.isInteger(r.finish)&&r.finish>0 &&
  time(r.started_at)<time(r.published_at)&&time(r.published_at)<=time(r.checked_at)&&time(r.checked_at)<=time(cutoff);

export function compareOpponents({own,field,followups,cutoff}){
  if(!valid(own,cutoff))return [];
  const matches=field.filter(r=>valid(r,cutoff)&&r.circuit===own.circuit&&r.race_id===own.race_id&&
    r.result_ref===own.result_ref&&r.started_at===own.started_at);
  if(matches.filter(r=>r.horse_id===own.horse_id&&r.finish===own.finish).length!==1 ||
      new Set(matches.map(r=>r.horse_id)).size!==matches.length)return [];
  return matches.filter(r=>r.horse_id!==own.horse_id).map(rival=>{
    const later=followups.filter(r=>valid(r,cutoff)&&r.horse_id===rival.horse_id&&
      r.circuit===own.circuit&&r.race_id!==own.race_id&&time(r.started_at)>time(own.started_at));
    return {horse_id:rival.horse_id,order:own.finish<rival.finish?'AHEAD':own.finish>rival.finish?'BEHIND':'SAME_FINISH',
      result_ref:own.result_ref,followups:new Set(later.map(r=>r.race_id)).size===later.length?
        later.map(r=>({race_id:r.race_id,finish:r.finish,result_ref:r.result_ref,published_at:r.published_at})):[],
      opponent_quality:null};
  });
}
