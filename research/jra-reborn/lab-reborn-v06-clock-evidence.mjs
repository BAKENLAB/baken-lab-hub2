/**
 * LAB REBORN 0.6 | READ-ONLY condition-normalized historical evidence.
 *
 * A winner-clock reference is fitted to 2023/2024 historical winners only,
 * by exact track x surface x distance x going x class segment (n>=10).
 * Allowed target race date >= 2025-01-01. No target-run or future data.
 *
 * IMPORTANT: diagnostic speed/pace features only, NEVER a calculated
 * win probability, never points added to an official or REBORN rank.
 */
const num=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(+x)?+x:null;
const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const fix=(x,d=3)=>Math.round(x*10**d)/10**d;
const key=o=>[o.track,o.surface,+o.distance,o.going,o.segment].join("|");
/** Stable JRA horse reference code. CNAME URL's leading mode/trailing token
 * may change between live cards and archive; the ten digit horse code does not.
 * Do not fall back to Japanese name or an unverified URL.
 */
export function canonicalHorseId(ref){
 if(typeof ref!=="string")return null;
 const m=ref.match(/([0-9]{10})\/[A-Za-z0-9]{1,4}(?:[?#].*)?$/);
 return m?m[1]:null;
}
export function parseRaceSeconds(s){
 if(typeof s!=="string"||!/^([0-9]+):([0-5][0-9])\.([0-9])$/.test(s))return null;
 const [minutes,secs]=s.split(":");const v=+minutes*60+Number(secs);
 return v>=40&&v<=380?fix(v,1):null;
}
export function parseVerifiedHalons(halons,distance,winnerSeconds){
 if(typeof halons!=="string"||!Number.isInteger(distance)||
   distance%200!==0||distance<1200||distance>3600||num(winnerSeconds)===null)return null;
 const raw=halons.split(/\s*-\s*/);
 if(raw.length!==distance/200||raw.some(x=>!/^\d{1,2}(?:\.\d)?$/.test(x)))return null;
 const values=raw.map(Number);
 if(values.some(v=>v<8||v>21))return null;
 const sum=values.reduce((a,b)=>a+b,0);
 if(Math.abs(sum-winnerSeconds)>0.7)return null;
 const front=values[0]+values[1]+values[2];
 const back=values.slice(-3).reduce((a,b)=>a+b,0);
 return {first600:fix(front),last600:fix(back),
   splits:values.length,clock_integrity:fix(sum-winnerSeconds),
   front_minus_last:fix(front-back)};
}
export function prepareConditionReference(locked){
 if(!locked||locked.id!=="LAB_REBORN_V06_CONDITION_REFERENCE_2023_2024"||
 locked.frozen_reference_period!=="2023-01-01/2024-12-31"||
 !Array.isArray(locked.groups)||locked.groups.length<100)return null;
 const index=new Map();
 for(const group of locked.groups){
  const k=key(group);
  const median=num(group.median_seconds),q25=num(group.p25_seconds),
     q75=num(group.p75_seconds),n=num(group.n),paceN=num(group.n_pace);
  if(index.has(k)||median===null||q25===null||q75===null||
    n===null||n<10||paceN===null||paceN<0||paceN>n||
    !(q25<=median&&median<=q75)||
    !["芝","ダート"].includes(group.surface)||
    !["MAIDEN","CLASS1","CLASS2_3","OPEN_GRADED"].includes(group.segment))return null;
  index.set(k,group);
 }
 return index;
}
export function assessHistoricalRun(run,target,profile){
 const warnings=[];
 if(!day(target?.date)||target.date<"2025-01-01"||
 !day(run?.date)||run.date>=target.date||
 target.date>"2099-12-31")
 return {status:"INVALID_ASOF",warnings:["INVALID_DATE_OR_FUTURE_RUN"]};
 const expected=canonicalHorseId(target.horse_ref),observed=canonicalHorseId(run.horse_ref);
 if(expected===null||observed===null||expected!==observed)
 return {status:"IDENTITY_MISMATCH",warnings:["MISSING_OR_DIFFERENT_CANONICAL_HORSE_CODE"]};
 const finish=num(run.finish),distance=num(run.distance),raceWinnerTime=
 parseRaceSeconds(run.winner_time);
 const runnerTime=parseRaceSeconds(run.runner_time);
 if(finish===null||finish<1||!Number.isInteger(distance)||!run.track||
 !run.surface||!run.going||!run.segment||runnerTime===null||raceWinnerTime===null)
 return {status:"INCOMPLETE_CLOCK",warnings:["MISSING_VERIFIED_RACE_TIME"]};
 const lag=runnerTime-raceWinnerTime;
 if(lag<-.2||lag>40)return {status:"INVALID_TIMING",warnings:["RUNNER_FASTER_THAN_WINNER"]};
 const reference=profile?.get(key(run));
 if(!reference)return {status:"NO_MATCHED_REFERENCE",
   warnings:["NO_EXACT_HISTORICAL_CONDITION_BASELINE"],
   race_date:run.date,horse_ref:run.horse_ref??null,
   gap_to_winner:fix(Math.max(0,lag))};
 const pace=parseVerifiedHalons(run.halon_times,distance,raceWinnerTime);
 if(!pace)warnings.push("RACE_PACE_NOT_VERIFIED");
 const iqr=+reference.p75_seconds-+reference.p25_seconds;
 const scale=Math.max(.5,iqr/1.349);
 const residual=+reference.median_seconds-runnerTime;
 // This speed Z compares winning-class clock with actual runner clock,
 // NOT course variant, run style, sectional speed, pace-adjusted figure.
 const z=clamp(residual/scale,-4,4);
 const paceDifference=pace&&reference.median_first600!==null?
     +reference.median_first600-pace.first600:null;
 const f3=num(run.final3f);
 const verifiedF3=f3!==null&&f3>25&&f3<60?f3:null;
 const firstPos=num(run.early_pos),lastTurn=num(run.final_turn_pos);
 const projectedFront=paceDifference!==null&&firstPos!==null&&firstPos<=3&&
   paceDifference>=.6&&finish<=5&&lag<=1;
 const recovered=lastTurn!==null&&lastTurn-finish>=3&&
   verifiedF3!==null&&finish>=2&&lag<=1.0;
 return {status:"CONDITION_EVIDENCE_READY",race_date:run.date,
  horse_ref:run.horse_ref??null,race_ref:run.race_ref??null,
  clock:{finish,runner_seconds:runnerTime,winner_seconds:raceWinnerTime,
    gap_to_winner:fix(Math.max(0,lag)),
    condition_median_winner:+reference.median_seconds,
    condition_iqr:fix(iqr),
    comparative_seconds:fix(residual),
    robust_z:fix(z)},
  pace:pace?{...pace,
    matched_condition_first600:+reference.median_first600||null,
    early_speed_ahead_of_reference:paceDifference===null?null:fix(paceDifference),
    front_under_faster_than_reference_pace:projectedFront,
    gained_three_places_with_verified_last3f:recovered}:null,
  sample:{reference_races:+reference.n,reference_pace_races:+reference.n_pace,
    reference_years:"2023_2024",
    matched_reference_dimensions:["track","surface","distance","going","segment"],
    metadata_condition_group_matched:true,
    course_geometry_verified:false,exact_condition:false},
  source_only:true,score_delta:0,used_target_result:false,
  warnings};
}
export function buildRebornV06Evidence(packet,locked){
 const index=prepareConditionReference(locked);
 if(!index)return {status:"INVALID_CLOCK_REFERENCE",runners:[],production_write:false};
 if(!day(packet?.date)||packet.date<"2025-01-01"||
 !Array.isArray(packet?.runners)||packet.runners.length<5)
 return {status:"INVALID_PACKET",runners:[],production_write:false};
 const seen=new Set(),runners=[];
 for(const horse of packet.runners){
  const canonical=canonicalHorseId(horse?.horse_ref);
  if(!canonical||!Array.isArray(horse.history)||seen.has(canonical))
    return {status:"DUPLICATE_OR_MISSING_HORSE_REF",runners:[],production_write:false};
  seen.add(canonical);
  const entries=horse.history.map(run=>assessHistoricalRun(
   run,{date:packet.date,horse_ref:horse.horse_ref},index));
  // Fail closed when a future run or mismatched identity appears. No sorting
  // of post-target facts, race results, LAB base model fields or odds.
  if(entries.some(x=>["INVALID_ASOF","IDENTITY_MISMATCH"].includes(x.status)))
   return {status:"ASOF_OR_IDENTITY_REJECTED",runners:[],production_write:false};
  runners.push({horse_ref:horse.horse_ref,horse_id:canonical,horse_no:horse.horse_no,
   horse_name:horse.horse_name,
   runs_checked:entries.length,
   usable_runs:entries.filter(x=>x.status==="CONDITION_EVIDENCE_READY").length,
   history_evidence:entries,
   best_speed_z:entries.filter(x=>x.status==="CONDITION_EVIDENCE_READY")
      .reduce((best,x)=>Math.max(best,x.clock.robust_z),-Infinity)});
 }
 for(const x of runners)if(x.best_speed_z===-Infinity)x.best_speed_z=null;
 return {status:"RESEARCH_EVIDENCE_READY",model:"LAB_REBORN_0.6_CONDITION_EVIDENCE",
  runners,production_write:false,score_weights_fitted:false,
  actual_rank_modified:false,official_frozen_modified:false};
}
