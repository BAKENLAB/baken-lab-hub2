/**
 * BAKEN LAB LOCAL: official pre-race runner history -> relative factual comparison.
 * Not a scorer. No market, target results, CLAIM, DB or FROZEN writes.
 * Call only after finalContext() validated exact official identity, source and as-of.
 */
import {resolveLocalHistoricalSurface,resolveLocalOfficialClassLiteral} from './local-verified-condition-bridge.mjs';
const safeNumber=x=>{
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(typeof x==='string'&&/^[0-9]+(?:\.[0-9]{1,3})?$/.test(x.trim()))return Number(x.trim());
  return null;
};
const int=(x,lo=1,hi=24)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const recentDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'));

// NAR results typically express a runner's margin to the PRECEDING horse in
// horse LENGTHS, not seconds to the winner. Only 2nd-place horse has the
// preceding WINNER, so its short literal margin can establish a close second.
// No numerical conversion to seconds, and NEVER use the 3rd horse's margin
// as a confirmed winner-relative time gap. Other runs stay unverified.
export function confirmedNarSecondPlaceMargin(h){
 const finish=safeNumber(h?.finish);
 if(finish===1)return {margin:0,margin_unit:'LENGTHS_TO_WINNER',margin_basis:'WINNER'};
 if(finish!==2)return {margin:null,margin_unit:null,margin_basis:'UNVERIFIED_WINNER_GAP'};
 const literal=typeof h.margin==='string'?h.margin.trim().normalize('NFKC'):null;
 const short={
  'ハナ':0.05,'アタマ':0.15,'クビ':0.30,
  '1/4':0.25,'1/2':0.50,'同着':0
 };
 if(literal!==null&&Object.hasOwn(short,literal))
   return {margin:short[literal],margin_unit:'LENGTHS_TO_WINNER',
    margin_basis:'NAR_SECOND_PLACE_PRECEDING_IS_WINNER'};
 return {margin:null,margin_unit:null,margin_basis:'UNVERIFIED_WINNER_GAP'};
}
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
  const prepared=r.recent_runs.map((h,i)=>{
    const resolution=resolveLocalHistoricalSurface(h);
    // Official source verified by finalContext prior to this pure comparison.
    const cls=resolveLocalOfficialClassLiteral(h.race_class??h.class_name??h.race_name,h.track);
    return {h,i,resolution,cls};
  });
  // Preserve EVERY verified pre-race past run in a separate descriptive lane.
  // Supporting runs keep their legacy narrow same-surface/near-distance
  // semantics; cross-condition/JRA-transfer history is NOT thrown away.
  // No result, odds, popularity or market attributes are ever projected.
  const project=({h,i,resolution,cls})=>({
      race_date:h.race_date,track:h.track,race_name:h.race_name,
      class:cls.class_label,class_provenance:cls.status,
      surface:resolution.surface,surface_provenance:resolution.provenance,
      surface_source_ref:resolution.source_ref,
      distance:safeNumber(h.distance),finish:safeNumber(h.finish),
      ...confirmedNarSecondPlaceMargin(h),raw_margin:h.margin??null,
      early_pos:safeNumber(h.early_pos),final_turn_pos:safeNumber(h.final_turn_pos),
      evidence_ref:`COMPACT_V1.runners[horse_no=${r.horse_no}].recent_runs[${i}]`
  });
  const contextRuns=prepared.map(project);
  const similar=prepared.filter(({h,resolution})=>
    resolution.surface===surface && Number.isInteger(safeNumber(h.distance)) &&
    Math.abs(safeNumber(h.distance)-distance)<=200);
  const close=similar.filter(({h})=>{
    const f=safeNumber(h.finish),g=confirmedNarSecondPlaceMargin(h);
    return f===1||(f===2&&g.margin!==null&&g.margin<=0.5);
  }).length;
  const podium=similar.filter(({h})=>int(safeNumber(h.finish))&&safeNumber(h.finish)<=3).length;
  const front=similar.filter(({h})=>int(safeNumber(h.early_pos))&&safeNumber(h.early_pos)<=3).length;
  // A gap to the preceding horse cannot prove a 1.5-length defeat by the
  // winner. Unknown deep-loss magnitude is not fabricated.
  const deep=0;
  return {horse_no:r.horse_no,horse_name:r.horse_name,
    // Preserve strictly pre-validated optional debut evidence for v1.7.
    // Missing history is not evidence of weak ability.
    trainer:r.trainer??null,sex_age:r.sex_age??null,
    ...(r.ability_test?{ability_test:r.ability_test}:{}),
    comparable_runs:similar.length,close_runs:close,podium_runs:podium,
    front3_runs:front,decisive_defeats:deep,
    class_comparison:'EXPLICIT_OFFICIAL_TITLE_ONLY_SAME_DISTRICT_GUARDED_BY_SCORER',
    surface_unknown_runs:prepared.filter(x=>x.resolution.surface===null).length,
    surface_recovered_from_track:prepared.filter(x=>x.resolution.provenance==='NAR_OFFICIAL_SINGLE_SURFACE_TRACK_CAPABILITY').length,
    supporting_runs:similar.map(project),
    // Distinct from legacy supporting_runs: includes other verified distances,
    // districts and class histories for full-field condition-change audit.
    // A different condition is a REVIEW LEAD, not matched scoring proof.
    context_runs:contextRuns,
    cross_condition_run_count:contextRuns.length-similar.length,
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
   recovered_surface_run_count:perRunner.reduce((n,r)=>n+r.surface_recovered_from_track,0),
   comparable_runner_count:perRunner.filter(r=>r.comparable_runs>0).length,
   comparisons,comparison_count:comparisons.length,
   data_scope:'ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY',
   class_scope:'DISTINCT_RACE_CLASS_NOT_NORMALIZED'});
}
