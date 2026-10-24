/**
 * REBORN v0.7 RESEARCH DIAGNOSTIC: pretarget prior-race class provenance.
 * Resolve named prior races only from exact horse+race archive identity.
 * NO odds, market signals, TARGET race result, or old LAB scores.
 * Never changes a live or previously FROZEN prediction.
 * Different scope from incomplete 2024/2025 GI registry: this resolves
 * broad CLASS level only and does NOT assert verified GI/GII/GIII grades.
 */
export const VERSION = "LAB_REBORN_V07_VERIFIED_PRIOR_CLASS_RESEARCH";
const dateOK=s=>typeof s==="string" && /^20\d{2}-\d\d-\d\d$/.test(s);
const num=x=>x===null||x===undefined||x===""?null:Number.isFinite(+x)?+x:null;
export function classLevel(label){
 if(typeof label!=="string")return null;
 const s=label.trim();
 if(/(?:障害|JRAへ転入|地方転入|取消|除外)/.test(s))return null;
 if(/(?:G[ⅠⅡⅢ123]|オープン|リステッド|L競走)/i.test(s))return 5;
 if(/(?:3勝クラス|1600万下)/.test(s))return 4;
 if(/(?:2勝クラス|1000万下)/.test(s))return 3;
 if(/(?:1勝クラス|500万下)/.test(s))return 2;
 if(/(?:未勝利|新馬)/.test(s))return 1;
 return null; // No name-only inference: named stakes can be any class.
}
const key=e=>[e.race_date,e.track,e.surface,e.distance,e.horse_code,e.finish].join("|");
/**
 * Match a single runner's PRE-TARGET past event.
 * evidence rows must be produced from jra_lab_races JOIN jra_lab_runs
 * on the identity tuple, with one row per unique past race.
 * Unmatched/ambiguous/conflicting records are explicitly unknown.
 */
export function resolvePriorRaceClass({target_date,horse_code,run,evidence=[]}={}){
 const fail=status=>({status,class_level:null,verified_class_name:null,source:null});
 if(!dateOK(target_date)||!/^\d{10}$/.test(String(horse_code||""))||
 !run||!dateOK(run.race_date)||run.race_date>=target_date||
 !["芝","ダート"].includes(run.surface)||num(run.distance)===null||num(run.finish)===null||
 !Number.isInteger(num(run.finish))||num(run.finish)<1||!Array.isArray(evidence))
  return fail("INELIGIBLE_PRIOR");
 const original=classLevel(run.race_class);
 const wanted={race_date:run.race_date,track:run.track,surface:run.surface,distance:num(run.distance),
               horse_code,finish:num(run.finish)};
 const matching=evidence.filter(e=>
  e?.source==="JRA_LAB_ARCHIVE"&&dateOK(e.race_date)&&e.race_date<target_date &&
  e.race_date===wanted.race_date&&e.track===wanted.track &&
  e.surface===wanted.surface&&num(e.distance)===wanted.distance &&
  String(e.horse_code)===wanted.horse_code&&num(e.finish)===wanted.finish &&
  Number.isInteger(num(e.race_no))&&num(e.race_no)>=1&&num(e.race_no)<=12 &&
  typeof e.race_name==="string" && typeof e.class_name==="string");
 if(matching.length>1) return fail("AMBIGUOUS_ARCHIVE");
 if(matching.length===0){
  return original===null?fail("UNKNOWN_NO_VERIFIED_ARCHIVE"):
   {status:"DIRECT_EXPLICIT_UNVERIFIED",class_level:original,
    verified_class_name:null,source:"LOCKED_INPUT"};
 }
 const ref=matching[0],confirmed=classLevel(ref.class_name);
 if(confirmed===null)return fail("ARCHIVE_CLASS_UNKNOWN");
 if(original!==null&&original!==confirmed)return fail("SOURCE_CLASS_CONFLICT");
 return {status:original===null?"VERIFIED_RESOLVED":"VERIFIED_CONFIRMED",
  class_level:confirmed,verified_class_name:ref.class_name,
  source:"JRA_LAB_ARCHIVE",archive_race_no:num(ref.race_no),
  archive_race_name:ref.race_name,archive_race_date:ref.race_date,
  original_class_name:run.race_class??null};
}
/** Pure, non-scoring diagnostic on a locked whole-field pretarget input packet. */
export function auditLockedPriorClasses(packet,evidence=[]){
 const p=packet?.payload??packet;
 const fail=reason=>({status:"AUDIT_REJECTED",reason,production_write:false});
 const target_date=packet?.race_date??p?.race_date;
 if(!dateOK(target_date)||!p||!Array.isArray(p.runners)||p.runners.length!==+p.field_size||p.runners.length<6||
 !Array.isArray(evidence))return fail("INVALID_FIELD");
 const saved=packet?.saved_at??p?.saved_at,post=packet?.source_post_time??p?.source_post_time;
 if(!saved||!post||!(Date.parse(saved)<Date.parse(post)))return fail("NOT_LOCKED_PRESTART");
 const ids=new Set(),records=[];
 for(const horse of p.runners){
  if(!Number.isInteger(+horse.horse_no)||ids.has(+horse.horse_no)||!Array.isArray(horse.history)||
     !/^\d{10}$/.test(String(horse.horse_code||"")))return fail("INVALID_RUNNER");
  ids.add(+horse.horse_no);
  for(const run of horse.history){
   if(!dateOK(run.race_date)||run.race_date>=target_date)return fail("FUTURE_HISTORY");
   const res=resolvePriorRaceClass({target_date,horse_code:horse.horse_code,run,evidence});
   records.push({horse_no:+horse.horse_no,horse_name:horse.horse_name,
    date:run.race_date,track:run.track,prior_label:run.race_class,
    ...res});
  }
 }
 const counts={};
 for(const r of records)counts[r.status]=(counts[r.status]||0)+1;
 return {status:"RESEARCH_CLASS_AUDIT_ONLY",version:VERSION,target_date,
   track:packet.track??p.track,race_no:packet.race_no??p.race_no,
   runner_count:p.runners.length,history_count:records.length,
   counts,records,
   no_retraining:true,rank_or_score_modified:false,production_write:false,
   target_outcomes_used:false,odds_used:false};
}
