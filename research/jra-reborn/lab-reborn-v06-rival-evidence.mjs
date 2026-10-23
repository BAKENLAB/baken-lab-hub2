import {official2026Grade} from "./jra-official-2026-grade-registry.mjs";

/**
 * LAB REBORN 0.6 research-only opponent evidence.
 * REQUIRE stable 10-digit JRA horse codes; NO names-only matching.
 * Meeting < rival followup < target, all times strictly earlier than target.
 * Distinguish Grade-confirmed rivals from unverified OP/low class opponents.
 * Never award a score from these counts before out-of-time calibration.
 */
const date=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const code=s=>typeof s==="string"&&/^[0-9]{10}$/.test(s);
const int=n=>n!==null&&n!==undefined&&Number.isInteger(+n)?+n:null;
export function auditOpponentEvidence(rows,targetDate,horseCode){
 if(!date(targetDate)||!code(horseCode)||!Array.isArray(rows))
  return {status:"INVALID_TARGET",evidence:[],scored:false};
 const evidence=[],skipped={identity:0,date:0,finish:0,duplicate:0};
 const fingerprints=new Set(),creditedGraded=new Set(),creditedOpenUnconfirmed=new Set();
 for(const v of rows){
  if(!code(v.target_horse_code)||v.target_horse_code!==horseCode||
    !code(v.rival_horse_code)||v.rival_horse_code===horseCode){
   skipped.identity++;continue;
  }
  if(v.target_date!==targetDate||!date(v.meeting_date)||!date(v.later_date)||
      !(v.meeting_date<v.later_date&&v.later_date<targetDate)){
   skipped.date++;continue;
  }
  const own=int(v.own_finish),rival=int(v.rival_finish),later=int(v.later_finish);
  if(own===null||rival===null||later===null||own<1||rival<1||
    later<1||later>3||own>rival+2){
   skipped.finish++;continue;
  }
  const fingerprint=[v.target_horse_code,v.meeting_date,v.meeting_track,
     v.meeting_no,v.rival_horse_code,v.later_date,v.later_track,
     v.later_no].join("|");
  if(fingerprints.has(fingerprint)){skipped.duplicate++;continue;}
  fingerprints.add(fingerprint);
  const verified=official2026Grade(v.later_date,v.later_track,v.later_name);
  const grade=verified?.level??null;
  const classOfLater=String(v.later_class??"");
  const classCertainty=grade!==null?"OFFICIAL_GRADED":
    /オープン/.test(classOfLater)?"OP_GRADE_UNKNOWN":"NON_GRADED_OR_UNKNOWN";
  if(grade!==null)creditedGraded.add(v.rival_horse_code);
  else if(classCertainty==="OP_GRADE_UNKNOWN")
    creditedOpenUnconfirmed.add(v.rival_horse_code);
  evidence.push({meeting_date:v.meeting_date,
    meeting_track:v.meeting_track,meeting_no:int(v.meeting_no),
    horse_finish:own,rival_finish:rival,
    rival_code:v.rival_horse_code,rival_name:v.rival_horse,
    later_date:v.later_date,later_track:v.later_track,
    later_race:v.later_name,later_finish:later,
    later_grade:grade,later_class_status:classCertainty,
    grade_provenance:verified?.evidence_kind??"UNCONFIRMED",
    supportive_not_causal:true});
 }
 evidence.sort((a,b)=>(b.later_grade??-1)-(a.later_grade??-1)||
  b.later_date.localeCompare(a.later_date)||a.rival_code.localeCompare(b.rival_code));
 return {status:"RESEARCH_OPPONENT_EVIDENCE_READY",horse_code:horseCode,
  target_date:targetDate,matched_prior_followups:evidence.length,
  graded_future_podium_rival_count:creditedGraded.size,
  open_unknown_grade_future_podium_rival_count:
    [...creditedOpenUnconfirmed].filter(x=>!creditedGraded.has(x)).length,
  evidence,skipped,scored:false,score_delta:0,
  winner_predicted:false,production_write:false};
}
