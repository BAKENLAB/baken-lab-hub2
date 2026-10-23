/**
 * BAKEN LAB JRA / modular evidence features, experimental shadow 0.6.
 *
 * Input is ONLY the target's pre-race entry and the private.jra_v07_evidence_packet_v1
 * read-only bundle (pre-target historical records). No target outcome, betting market,
 * current-race results, FROZEN mutation, or public live-rank change.
 *
 * Components kept separate: historical peak, repeated recent performance,
 * same-course/distance, proven current class; race pace and opponent links are
 * descriptive only until predictive validation proves their direction.
 * Missing features = UNKNOWN, not zero. All weights are hypothetical.
 */
const number=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):null;
const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"));
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const r3=x=>Math.round(x*1000)/1000;
const DAYS=86400000;
const daysBetween=(start,end)=>Math.round((Date.parse(end+"T00:00:00Z")-Date.parse(start+"T00:00:00Z"))/DAYS);
const classLevel=x=>{
 if(typeof x!=="string")return null;
 if(/未勝利/.test(x))return 0;
 if(/1勝/.test(x))return 1;
 if(/2勝/.test(x))return 2;
 if(/3勝/.test(x))return 3;
 if(/オープン|重賞|[GＧ][ⅠⅡⅢ123]|リステッド/.test(x))return 4;
 return null;
};
const strength=(finish,gap)=>{
 if(finish===1)return 1;
 // Older archived results sometimes have verified finish but no numeric margin.
 // Retain lower-resolution positive evidence WITHOUT inventing a beaten gap.
 if(gap===null)return finish<=3?0.60:finish<=6?0.25:finish<=10?0.10:0.02;
 if(gap<0)return null;
 if(finish<=3)return gap<=0.2?0.94:gap<=0.5?0.81:gap<=1?0.65:0.40;
 if(finish<=6)return gap<=0.2?0.74:gap<=0.5?0.60:gap<=1?0.38:0.10;
 if(finish<=10)return gap<=0.2?0.59:gap<=0.5?0.44:gap<=1?0.24:0.06;
 return gap<=0.5?0.23:0.02;
};
function normalizeRun(run,older,ctx){
 const date=older?run.date:run.prior_date;
 if(!day(date)||date>=ctx.date)return null;
 const surface=older?run.surface:run.prior_surface;
 const distance=number(older?run.distance:run.prior_distance);
 const finish=number(run.finish);
 const gap=older?null:number(run.margin_to_winner);
 if(!Number.isInteger(finish)||finish<1||distance===null||surface!==ctx.surface)return null;
 const distanceDifference=Math.abs(distance-ctx.distance);
 const allowed=clamp(ctx.distance*0.18,200,400);
 if(distanceDifference>allowed)return null;
 const age=daysBetween(date,ctx.date);
 const level=classLevel(older?run.class_name:run.prior_class),current=classLevel(ctx.className);
 const cls=level===null||current===null?1:level<current?Math.max(0.52,1-0.18*(current-level)):1;
 const distanceFactor=1-0.50*distanceDifference/allowed;
 const ageFactor=Math.max(older?0.58:0.72,1-age/1000);
 const raw=strength(finish,gap);
 const adjusted=raw===null?null:clamp(raw*cls*distanceFactor*ageFactor,0,1);
 const course=older?run.track:run.prior_track;
 const exactCourse=course===ctx.track&&distanceDifference<=Math.max(100,ctx.distance*0.1);
 const archived=older||number(run.archive_match_count)===1;
 const final3fRank=number(run.final3f_rank);
 const corners=older?run.corners:run.corner_positions;
 const pace=older?null:run.race_halons;
 const fractions=typeof pace==="string"?
  pace.split(/\s*-\s*/).map(x=>Number(x)):[];
 const validPace=fractions.length>=6 && fractions.every(n=>Number.isFinite(n)&&n>=8&&n<=20);
 return {date,older,track:course,finish,beaten_seconds:gap,
  surface,distance,class_name:older?run.class_name:run.prior_class,
  age_days:age,relative_distance_diff:r3(distanceDifference/ctx.distance),
  same_course:exactCourse,comparable_current_class:current!==null&&level!==null&&level>=current,
  adjusted_strength:adjusted===null?null:r3(adjusted),
  raw_strength:raw,
  detail_source:older?"JRA_ARCHIVED_OLDER":run.final3f_source??"UNKNOWN",
  final3f_rank:archived?final3fRank:null,
  positions:corners??null,
  race_first600:validPace?r3(fractions.slice(0,3).reduce((a,b)=>a+b,0)):null,
  race_last600:validPace?r3(fractions.slice(-3).reduce((a,b)=>a+b,0)):null};
}
const average=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const max=xs=>xs.length?Math.max(...xs):null;
function metrics(recent,older,ctx){
 const candidates=[...recent.map(x=>normalizeRun(x,false,ctx)),
   ...older.map(x=>normalizeRun(x,true,ctx))].filter(Boolean);
 const unique=new Map();
 for(const v of candidates){
   const key=[v.date,v.track,v.surface,v.distance].join("|");
   const prev=unique.get(key);
   if(!prev||(!v.older&&prev.older))unique.set(key,v);
 }
 const runs=[...unique.values()].sort((a,b)=>b.date.localeCompare(a.date));
 const scoring=runs.filter(x=>x.adjusted_strength!==null);
 const pastRecent=scoring.filter(x=>!x.older);
 const peaks=scoring.map(x=>x.adjusted_strength);
 const recentStrengths=pastRecent.map(x=>x.adjusted_strength).sort((a,b)=>b-a);
 const fit=scoring.filter(x=>x.same_course).map(x=>x.adjusted_strength);
 const provenClass=scoring.filter(x=>x.comparable_current_class).map(x=>x.adjusted_strength);
 const peak=max(peaks);
 // Separate high-water mark and repeated ability. Never average in distant turf
 // or unrelated races. Older record can demonstrate peak but not recent consistency.
 const repeatability=recentStrengths.length>=2 ?
   average(recentStrengths.slice(0,Math.min(3,recentStrengths.length))):null;
 const courseFit=max(fit);
 const classProven=max(provenClass);
 const pacing=runs.filter(x=>x.final3f_rank!==null||x.race_first600!==null);
 const last3fFast=pacing.filter(x=>x.final3f_rank!==null&&x.final3f_rank<=3);
 const moves=runs.filter(x=>Array.isArray(x.positions)&&x.positions.length>=2);
 return {
   historical_peak:peak===null?null:r3(peak),
   recent_repeatability:repeatability===null?null:r3(repeatability),
   course_distance_proof:courseFit===null?null:r3(courseFit),
   current_class_proof:classProven===null?null:r3(classProven),
   context_only:{past_runs_with_pace_or_3f:pacing.length,
     last3f_top3_runs:last3fFast.length,
     runs_with_corners:moves.length},
   eligible_runs:runs.length,
   older_runs_eligible:runs.filter(x=>x.older).length,
   unknown_components:[
     ...(peak===null?["historical_peak"]:[]),
     ...(repeatability===null?["recent_repeatability"]:[]),
     ...(courseFit===null?["course_distance_proof"]:[]),
     ...(classProven===null?["current_class_proof"]:[])],
   evidence:runs.slice(0,12)
 };
}
export function buildJra06FeaturePanel(baseRunners,packet,ctx){
 const unavailable=reason=>({status:reason,runners:[],ranking_unchanged:true,
   frozen_write:false,feature_weights_are_validated:false});
 if(!Array.isArray(baseRunners)||!packet||!day(packet.race_date)||
  packet.race_date!==ctx?.date||packet.track!==ctx.track||
  !["芝","ダート"].includes(ctx.surface)||!(ctx.distance>0))
  return unavailable("INVALID_RACE_PACKET");
 const recent=packet.recent_evidence?.runners,
       older=packet.older_same_course_evidence;
 if(!Array.isArray(recent)||!Array.isArray(older)||
    recent.length!==baseRunners.length||older.length!==baseRunners.length)
  return unavailable("INCOMPLETE_ALL_RUNNER_PACKET");
 const rmap=new Map(recent.map(x=>[Number(x.horse_no),x]));
 const omap=new Map(older.map(x=>[Number(x.horse_no),x]));
 const ranks=baseRunners.map(x=>Number(x.rank)).sort((a,b)=>a-b);
 if(new Set(ranks).size!==baseRunners.length ||
    ranks.some((x,i)=>x!==i+1) || rmap.size!==baseRunners.length ||
    omap.size!==baseRunners.length)return unavailable("INVALID_ROSTER_OR_RANKS");
 const runners=baseRunners.map(r=>{
   const id=Number(r.horse_no),rs=rmap.get(id),os=omap.get(id);
   if(!rs||!os||rs.horse_name!==r.horse_name||os.horse_name!==r.horse_name)
    return null;
   const dates=(os.older_same_surface_near_distance??[]);
   const m=metrics(rs.past_race_content??[],dates,ctx);
   // Rival info counts are *context*, not a reward for having more available
   // data or media mentions. Only evidence temporally prior to target.
   const rivals=(rs.opponent_followups??[]).filter(x=>day(x.later_date)
     &&x.later_date<ctx.date&&day(x.historical_race_date)
     &&x.later_date>x.historical_race_date);
   m.context_only.known_rival_followup_results=rivals.length;
   m.context_only.distinct_rivals=[...new Set(rivals.map(x=>x.rival_name))].length;
   return {horse_no:id,horse_name:r.horse_name,baseline_rank:Number(r.rank),
     validated_core_base_rate:number(r.validated_core_base_rate),
     metrics:m};
 });
 if(runners.some(x=>x===null))return unavailable("HORSE_IDENTITY_MISMATCH");
 return {status:"READY",date:ctx.date,track:ctx.track,race_no:ctx.raceNo,
  target_surface:ctx.surface,target_distance:ctx.distance,
  context_class:ctx.className??null,runners,
  ranking_unchanged:true,frozen_write:false,feature_weights_are_validated:false};
}

/**
 * Shadow-only exploratory ranker, fixed before first multi-race trial.
 * Baseline rank accounts for 90% and separately available quality 10%.
 * Unknown signal is neutral, not a negative; pace and rival count effect=0.
 */
export function rankJra06Shadow(panel,{signalScale=10}={}){
 if(panel?.status!=="READY")return {status:"NOT_READY",runners:[],changes:[]};
 const N=panel.runners.length;
 const result=panel.runners.map(r=>{
  const q=r.metrics;
  const weights=[["historical_peak",0.50],
    ["recent_repeatability",0.25],
    ["course_distance_proof",0.15],["current_class_proof",0.10]];
  const known=weights.filter(([key])=>q[key]!==null);
  const composite=known.length?
    known.reduce((a,[key,w])=>a+w*q[key],0)/known.reduce((a,[,w])=>a+w,0):null;
  const baseNormalized=N<=1?100:100*(N-r.baseline_rank)/(N-1);
  const delta=composite===null?0:(composite-0.5)*signalScale;
  return {...r,quality_composite:composite===null?null:r3(composite),
    baseline_position_score:r3(baseNormalized),
    experimental_score:r3(baseNormalized+delta),
    experimental_shift:r3(delta)};
 });
 const order=[...result].sort((a,b)=>b.experimental_score-a.experimental_score||
    a.baseline_rank-b.baseline_rank);
 order.forEach((r,i)=>r.shadow_rank=i+1);
 const changes=result.filter(r=>r.baseline_rank!==r.shadow_rank);
 return {status:"SHADOW_READY",rank_effect_on_official:false,
  score_calibrated:false,signal_scale:signalScale,changes:changes.map(r=>({
    horse_no:r.horse_no,horse_name:r.horse_name,baseline_rank:r.baseline_rank,shadow_rank:r.shadow_rank})),
  runners:result.sort((a,b)=>a.baseline_rank-b.baseline_rank)};
}
