/**
 * LAB REBORN 0.1 | independent JRA ability experiment.
 * INDEPENDENCE: no old BASE CORE rate, stored LAB rank/grade, market odds,
 * target result, winner names or target race outcome anywhere in computation.
 *
 * Historic evidence only, strictly before target date. Archive cannot always
 * reproduce 5-8th old starts, so this is a new independent candidate, not a
 * recalibration of the historical 2025 learned residual model.
 *
 * Five separate ability axes; starting weights are transparent HYPOTHESES.
 * They must be confirmed or rejected in held-out forward evaluations.
 */
const n=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(+x)?+x:null;
const clip=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const r=(x,d=3)=>Math.round(x*10**d)/10**d;
const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const days=(a,b)=>(Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000;
const grade=x=>{
 if(typeof x!=="string")return null;
 if(/未勝利|新馬/.test(x))return 0;
 if(/1勝ク/.test(x))return 1;
 if(/2勝ク/.test(x))return 2;
 if(/3勝ク/.test(x))return 3;
 if(/オープン|リステッド|重賞|[ＧG][ⅠⅡⅢ123]/.test(x))return 4;
 return null;
};
const close=(a,b,max)=>a!==null&&b!==null&&Math.abs(a-b)<=max;
const percent=(x)=>x===null?null:r(x*100,1);
const neutral=(v)=>v===null?0.50:v;
const mean=(a)=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const higher=(a)=>a.length?Math.max(...a):null;
function priorRun(src,old,ctx){
 const date=old?src.date:src.prior_date,finish=n(src.finish),dist=n(old?src.distance:src.prior_distance);
 const surface=old?src.surface:src.prior_surface;
 if(!day(date)||date>=ctx.date||!(finish>0)||!dist)return null;
 const track=old?src.track:src.prior_track;
 const className=old?src.class_name:src.prior_class;
 const level=grade(className),targetLevel=grade(ctx.className);
 const missingGap=old, gap=old?null:n(src.margin_to_winner);
 if(gap!==null&&gap<0)return null;
 const sameSurface=surface===ctx.surface, diff=Math.abs(dist-ctx.distance);
 const classDiff=level!==null&&targetLevel!==null?targetLevel-level:null;
 const classFactor=classDiff===null?0.85:classDiff>0?Math.max(0.40,1-0.23*classDiff):1;
 const distFactor=diff<=100?1:diff<=200?0.91:diff<=400?0.75:0.52;
 const surfaceFactor=sameSurface?1:0.38;
 const age=days(date,ctx.date);
 const ageFactor=clip(1-age/2200,0.56,1);
 // Older archive: verified place, but no exact margin. Do NOT invent 0.0 gap.
 const resultQuality=gap===null?
   (finish===1?0.77:finish===2?0.64:finish===3?0.58:
    finish<=6?0.31:finish<=10?0.18:0.06):
   (gap<=0.1?0.98:gap<=0.3?0.89:gap<=0.5?0.78:
    gap<=0.8?0.64:gap<=1.2?0.46:gap<=1.7?0.31:
    gap<=2.5?0.16:0.05);
 const adjusted=clip(resultQuality*classFactor*distFactor*surfaceFactor*ageFactor);
 const rank=n(src.final3f_rank);
 const corners=old?src.corners:(src.corner_positions??src.live_corner_positions);
 const positions=Array.isArray(corners)?corners.map(n).filter(x=>x!==null):
   typeof corners==="string" && /^\s*\d+(?:[\s-]+\d+)*\s*$/.test(corners)?
    corners.trim().split(/[\s-]+/).map(Number):[];
 const field=n(src.field_size);
 const lateGain=positions.length>=2 && positions[positions.length-1]>finish;
 const pace=old?null:src.race_halons;
 const halons=typeof pace==="string"?pace.split(/\s*-\s*/).map(Number):[];
 const lapValid=halons.length>=6&&halons.every(x=>x>=8&&x<=20);
 const fastFin=rank!==null&&rank<=3; // rank only if archive-confirmed; live raw time cannot infer rank
 const contentQuality=gap!==null && (gap<=1.25||finish<=3)?
   clip(0.35+0.28*(fastFin?1:0)+0.20*(lateGain?1:0)+
       0.12*(lapValid?1:0)+(gap<=0.5?0.05:0)):null;
 return {date,old,track,surface,distance:dist,finish,gap,age,
   class_name:className,grade:level,relclass:classDiff,
   same_surface:sameSurface,matched_distance:diff<=200,
   same_course:track===ctx.track,
   class_factor:r(classFactor),result_quality:r(resultQuality),
   adjusted:r(adjusted),finishing_rank:rank,
   source:old?"OLDER_ARCHIVE":src.final3f_source??"RECENT_UNKNOWN",
   corners:positions,verified_finish_quality:contentQuality,
   lap_verified:lapValid,early_place:positions[0]??null};
}
function evaluate(rec,older,ctx){
 const recent=(Array.isArray(rec.past_race_content)?rec.past_race_content:[])
   .map(x=>priorRun(x,false,ctx)).filter(Boolean);
 const olderRuns=(Array.isArray(older.older_same_surface_near_distance)?
    older.older_same_surface_near_distance:[])
   .map(x=>priorRun(x,true,ctx)).filter(Boolean);
 const records=new Map();
 for(const v of [...olderRuns,...recent]){
  const k=[v.date,v.track,v.surface,v.distance].join("|");
  if(!records.has(k)||(!v.old&&records.get(k).old))records.set(k,v);
 }
 const runs=[...records.values()].sort((a,b)=>b.date.localeCompare(a.date));
 const matched=runs.filter(x=>x.same_surface&&Math.abs(x.distance-ctx.distance)<=400);
 const recentMatch=runs.filter(x=>!x.old&&x.same_surface&&Math.abs(x.distance-ctx.distance)<=400);
 const measured=recentMatch.slice(0,4);
 const peak=higher(matched.map(x=>x.adjusted));
 const top=matched.map(x=>x.adjusted).sort((a,b)=>b-a);
 const bestTwo=top.length>=2?mean(top.slice(0,2)):peak;
 const upper=peak===null?null:clip(0.65*peak+0.35*bestTwo);
 const recentStrength=measured.map(x=>x.adjusted);
 // Recent form reflects *all* applicable recent runs, bad runs included:
 const consistency=mean(recentStrength);
 const newness=measured.length?clip(1-days(measured[0].date,ctx.date)/460,0.72,1):null;
 const form=consistency===null?null:clip(consistency*(newness??1));
 const fit=runs.filter(x=>x.same_surface&&x.same_course&&Math.abs(x.distance-ctx.distance)<=200);
 const otherMatch=runs.filter(x=>x.same_surface&&Math.abs(x.distance-ctx.distance)<=100);
 const courseFit=fit.length?clip(0.8*higher(fit.map(x=>x.adjusted))+0.2*mean(fit.map(x=>x.adjusted))):
   otherMatch.length?clip(0.80*higher(otherMatch.map(x=>x.adjusted))):null;
 // Performance details from verified lap/final3f/corners; no blanket bonus for
 // 3F alone. Must accompany strong race gap or placing.
 const content=measured.filter(x=>x.verified_finish_quality!==null);
 const raceCraft=content.length?
   mean(content.map(x=>x.verified_finish_quality*x.class_factor)):null;
 const rivals=(Array.isArray(rec.opponent_followups)?rec.opponent_followups:[])
   .filter(x=>day(x.later_date)&&x.later_date<ctx.date&&day(x.historical_race_date)
     &&x.historical_race_date<x.later_date&&n(x.later_finish)!==null
     &&n(x.rival_historical_finish)!==null&&n(x.historical_target_finish)!==null);
 // Rival follow-up result does NOT automatically prove this horse's strength:
 // it receives credit only if this horse beat/was close to a later podium rival.
 // Strictly pre-target, cap to two distinct rivals, avoid frequency bias.
 const rivalByName=new Map();
 for(const x of rivals){
  const rel=n(x.historical_target_finish)-n(x.rival_historical_finish);
  const subsequentTop3=n(x.later_finish)<=3;
  const good=subsequentTop3&&(rel<=2);
  if(good)rivalByName.set(x.rival_name,1);
 }
 const rivalry=rivals.length?clip(0.43+0.14*Math.min(2,rivalByName.size)):null;
 const factors={peak:upper,form,course_fit:courseFit,race_content:raceCraft,rival_strength:rivalry};
 const weights={peak:0.30,form:0.27,course_fit:0.21,race_content:0.14,rival_strength:0.08};
 const score=100*Object.keys(weights).reduce((v,k)=>v+weights[k]*neutral(factors[k]),0);
 const usable=matched.length>0;
 return {status:usable?"SCORED":"INSUFFICIENT_HISTORY",
   horse_no:Number(rec.horse_no),horse_name:rec.horse_name,
   score:usable?r(score,2):null,axes:Object.fromEntries(Object.entries(factors)
     .map(([k,v])=>[k,percent(v)])),
   missing_axes:Object.keys(factors).filter(x=>factors[x]===null),
   history:{recent:recent.length,older:olderRuns.length,
    comparable:matched.length,matched_recent:measured.length,
    verified_content:content.length,followup_rivals:rivals.length,
    credited_rivals:rivalByName.size},
   evidence:matched.slice(0,6).map(x=>({
    date:x.date,track:x.track,finish:x.finish,gap:x.gap,
    class_name:x.class_name,source:x.source,adjusted:x.adjusted
   }))};
}
export function buildRebornPrediction(packet,ctx){
 if(!packet||!ctx||!day(ctx.date)||packet.race_date!==ctx.date||
   packet.track!==ctx.track||+packet.race_no!==+ctx.raceNo||
   !["芝","ダート"].includes(ctx.surface)||!(+ctx.distance>0))
  return {status:"INVALID_INPUT",runners:[],production_write:false};
 const a=packet.recent_evidence?.runners,
       b=packet.older_same_course_evidence;
 if(!Array.isArray(a)||!Array.isArray(b)||!a.length||a.length!==b.length)
  return {status:"INCOMPLETE_ROSTER",runners:[],production_write:false};
 const byNo=new Map(b.map(x=>[+x.horse_no,x]));
 if(byNo.size!==a.length||new Set(a.map(x=>+x.horse_no)).size!==a.length)
  return {status:"DUPLICATE_ROSTER",runners:[],production_write:false};
 const scored=a.map(x=>{
  const older=byNo.get(+x.horse_no);
  if(!older||older.horse_name!==x.horse_name)return null;
  return evaluate(x,older,ctx);
 });
 if(scored.some(x=>x===null))
  return {status:"IDENTITY_MISMATCH",runners:[],production_write:false};
 scored.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.horse_no-b.horse_no);
 scored.forEach((x,i)=>{x.reborn_rank=x.score===null?null:i+1;});
 const complete=scored.every(x=>x.score!==null);
 return {status:complete?"RESEARCH_READY":"PARTIAL_HISTORY",
   model:"LAB_REBORN_0.1_INDEPENDENT",runners:scored,
   // Incomplete fields may be inspected, but must NOT be treated as
   // complete-field predictions or scored against official FROZEN.
   top5:complete?scored.slice(0,5):[],
   provisional_top5:complete?[]:scored.filter(x=>x.reborn_rank!==null).slice(0,5),
   eligible_top5:complete&&scored.length>=5,
   evaluation_policy:"independent 5-axis quality; no old LAB score/rank or odds",
   weights_are_validated:false,production_write:false,no_result_leak:true,
   no_frozen_change:true};
}
