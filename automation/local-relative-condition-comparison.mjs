/**
 * BAKEN LAB LOCAL: official pre-race runner history -> relative factual comparison.
 * Not a scorer. No market, target results, CLAIM, DB or FROZEN writes.
 * Call only after finalContext() validated exact official identity, source and as-of.
 */
const safeNumber=x=>{
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(typeof x==='string'&&/^[0-9]+(?:\.[0-9]{1,3})?$/.test(x.trim()))return Number(x.trim());
  return null;
};
const int=(x,lo=1,hi=24)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const recentDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'));
const status=(status,info={})=>({
  status,model_status:'FACTUAL_COMPARISON_ONLY_NOT_AN_ADOPTED_SCORER',
  rank_effect:false,score_effect:false,market_used:false,target_result_used:false,...info
});
export function buildLocalRelativeConditionComparison(runners,conditions={},targetDate){
 if(!recentDate(targetDate)||!Array.isArray(runners)||runners.length<2||runners.length>20)
   return status('CONDITIONS_OR_ROSTER_UNAVAILABLE');
 const distance=safeNumber(conditions?.distance),surface=conditions?.surface;
 if(!Number.isInteger(distance)||distance<800||distance>3600||
   typeof surface!=='string'||!surface.trim())
   return status('CONDITIONS_OR_ROSTER_UNAVAILABLE');
 const seen=new Set();
 for(const r of runners){
  if(!int(r?.horse_no,1,24)||typeof r?.horse_name!=='string'||!r.horse_name.trim()||
     seen.has(r.horse_no)||!Array.isArray(r.recent_runs)||r.recent_runs.length>5)
   return status('UNVERIFIED_ROSTER');
  seen.add(r.horse_no);
  if(r.recent_runs.some(h=>!recentDate(h?.race_date)||h.race_date>=targetDate))
   return status('HISTORICAL_ASOF_REJECTED');
 }
 const perRunner=runners.map(r=>{
  const similar=r.recent_runs.filter(h=>
    h.surface===surface && Number.isInteger(safeNumber(h.distance)) &&
    Math.abs(safeNumber(h.distance)-distance)<=200);
  const close=similar.filter(h=>{
    const f=safeNumber(h.finish),m=safeNumber(h.margin);
    return f===1||(int(f)&&f<=3&&m!==null&&m<=0.5);
  }).length;
  const podium=similar.filter(h=>int(safeNumber(h.finish))&&safeNumber(h.finish)<=3).length;
  const front=similar.filter(h=>int(safeNumber(h.early_pos))&&safeNumber(h.early_pos)<=3).length;
  const deep=similar.filter(h=>safeNumber(h.finish)>=8&&safeNumber(h.margin)>=1.5).length;
  return {horse_no:r.horse_no,horse_name:r.horse_name,
    comparable_runs:similar.length,close_runs:close,podium_runs:podium,
    front3_runs:front,decisive_defeats:deep,
    class_comparison:'NOT_ESTABLISHED_FROM_THIS_SIGNAL',
    supporting_runs:similar.map(h=>({
      race_date:h.race_date,track:h.track,race_name:h.race_name,
      class:h.race_class??h.class_name??h.race_name??null,
      surface:h.surface,distance:h.distance,finish:h.finish,
      margin:h.margin,early_pos:h.early_pos,final_turn_pos:h.final_turn_pos
    })),
    comparison_status:similar.length>=2?'REPEATED_COMPARABLE_RUNS':
       similar.length===1?'SINGLE_COMPARABLE_RUN':'NO_COMPARABLE_RUN'};
 });
 const comparisons=[];
 for(let i=0;i<perRunner.length;i++)for(let j=i+1;j<perRunner.length;j++){
   const a=perRunner[i],b=perRunner[j];
   if(!a.comparable_runs||!b.comparable_runs||
     (a.comparable_runs<2&&b.comparable_runs<2)||a.close_runs===b.close_runs)continue;
   comparisons.push({a_horse_no:a.horse_no,b_horse_no:b.horse_no,
     a_comparable_runs:a.comparable_runs,b_comparable_runs:b.comparable_runs,
     a_close_runs:a.close_runs,b_close_runs:b.close_runs,
     a_decisive_defeats:a.decisive_defeats,b_decisive_defeats:b.decisive_defeats,
     close_evidence_leader:a.close_runs>b.close_runs?a.horse_no:b.horse_no,
     disclaimer:'COUNTS_ONLY_NOT_PROOF_OF_OVERALL_SUPERIORITY'});
 }
 return status('READY',{target_date:targetDate,present_conditions:{surface,distance},
   runner_count:perRunner.length,runner_evidence:perRunner,
   comparisons,comparison_count:comparisons.length,
   data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
   class_scope:'DISTINCT_RACE_CLASS_NOT_NORMALIZED'});
}
