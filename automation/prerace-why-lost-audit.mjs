/**
 * BAKEN LAB — pre-race, evidence-only why-lost/why-strong audit.
 *
 * All input must originate from an independently verified pre-race context.
 * No HTTP, no DB, no CLAIM, no betting, no ranking, and no save-gate changes.
 * Do NOT interpret a finish position, lap or margin as a proven cause.
 */
const isoDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const positiveInt=(n,max=24)=>Number.isInteger(n)&&n>=1&&n<=max;
const position=(v,field)=>{
 const n=Number(v);
 return v!==null&&v!==undefined&&v!==''&&Number.isInteger(n)&&n>=1&&n<=(field||24)?n:null;
};
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const dateTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const v=(obj,...keys)=>keys.map(k=>obj?.[k]).find(x=>x!==undefined)??null;
const arr=(obj,...keys)=>v(obj,...keys);
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').trim();
const allowedSource=new Set(['JRA_CLAIMED_CONTEXT','LOCAL_OFFICIAL_PAST_RESULT']);
const byRun=(run,target)=>{
 const raceDate=v(run,'raceDate','race_date');
 if(!isoDate(raceDate)||raceDate>=target.raceDate)return null;
 const track=v(run,'track'),surface=v(run,'surface'),distance=v(run,'distance');
 const finish=position(v(run,'finish'),24);
 const field=position(v(run,'fieldSize','field_size'),24);
 const margin=num(v(run,'marginToWinner','margin_to_winner'));
 const safeMargin=finish===1?0:margin;
 const marginBasis=finish===1?'WINNER_NO_DEFICIT_REPORTED_MARGIN_MAY_BE_LEAD':
  finish===null?'NO_FINISH_CONFIRMED':'RACE_RESULT_REPORTED_DEFICIT';
 const early=position(v(run,'earlyPos','early_pos'),field);
 const last=position(v(run,'finalTurnPos','final_turn_pos'),field);
 const last3f=num(v(run,'last3f','final3f'));
 const cls=v(run,'raceClass','race_class','class_name');
 const clues=[];
 if(safeMargin!==null&&safeMargin>=0&&safeMargin<=0.5&&finish!==null&&finish>1)
  clues.push({code:'CLOSE_FINISH',basis:'FINISH_MARGIN',detail:'着差0.5秒以内の接戦'});
 if(early!==null&&last!==null&&last-early>=4)
  clues.push({code:'LOST_POSITION_BEFORE_FINAL_TURN',basis:'TWO_OFFICIAL_CORNERS',
    detail:'序盤から最終コーナーまで4つ以上順位を落とした'});
 if(early!==null&&last!==null&&early-last>=4)
  clues.push({code:'ADVANCED_BEFORE_FINAL_TURN',basis:'TWO_OFFICIAL_CORNERS',
    detail:'序盤から最終コーナーまで4つ以上順位を上げた'});
 if(early!==null&&early<=3&&last!==null&&last<=3&&finish!==null&&finish>=7)
  clues.push({code:'FADED_FROM_FRONT_AFTER_TURN',basis:'EARLY_LAST_FINISH',
    detail:'コーナー先行後に着順を落とした。原因は未確認'});
 const laps=v(run,'lapTimes','lap_times','laps');
 const officialLapRef=v(run,'lapSourceRef','lap_source_ref');
 const unit=v(run,'lapSegmentMeters','lap_segment_meters');
 const verified=v(run,'lapSourceVerified','lap_source_verified')===true;
 const officialLapUrl=typeof officialLapRef==='string'&&
  /^https:\/\/(?:www\.jra\.go\.jp|www\.keiba\.go\.jp)\//.test(officialLapRef);
 let lapEvidence={status:'LAPS_UNAVAILABLE',first_600m:null,last_600m:null,
  pace_classification:'UNDETERMINED',comparability:'NO_BASELINE'};
 if(Array.isArray(laps)) {
  lapEvidence={...lapEvidence,status:'LAPS_UNVERIFIED_UNIT_OR_SOURCE'};
  // A sequence of unlabeled numbers is NOT a verified 200m split series.
  // For split arithmetic demand official source, unit, and full known distance.
  if(verified&&officialLapUrl&&unit===200&&
    Number.isInteger(distance)&&distance%200===0&&
    laps.length===distance/200&&laps.length>=6&&laps.length<=24&&
    laps.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=8&&x<=30)){
   const rounded=n=>Math.round(n*10)/10;
   lapEvidence={status:'OFFICIAL_200M_SPLITS_PRESENT',
    first_600m:rounded(laps.slice(0,3).reduce((a,b)=>a+b,0)),
    last_600m:rounded(laps.slice(-3).reduce((a,b)=>a+b,0)),
    pace_classification:'UNDETERMINED',
    comparability:'NEEDS_TRACK_DISTANCE_CLASS_REFERENCE'};
  }
 }
 const sameSurface=surface===target.surface&&surface!==null;
 const distanceDelta=Number.isInteger(distance)&&Number.isInteger(target.distance)
  ?Math.abs(distance-target.distance):null;
 const sameTrack=track===target.track&&track!==null;
 const match=sameSurface&&distanceDelta!==null&&distanceDelta<=200;
 const classComparison=cls===null||target.className===null?'NOT_VERIFIABLE'
  :norm(cls)===norm(target.className)?'SAME_LABEL':'DIFFERENT_LABEL_ONLY';
 return {
  race_date:raceDate,track,finish,margin_to_winner:safeMargin,
  margin_source_value:margin,margin_basis:marginBasis,
  surface,distance,early_pos:early,final_turn_pos:last,final3f:last3f,
  class_name:cls,field_size:field,
  clues,lap_evidence:lapEvidence,
  course_match:{same_track:sameTrack,same_surface:sameSurface,
   distance_delta_m:distanceDelta,near_course_distance:match},
  class_comparison:classComparison,
  opponent_level:'UNKNOWN_UNLESS_INDEPENDENT_RIVALS_VERIFIED',
  true_loss_cause:'UNPROVEN',
  missed_facts:[
   ...(early===null||last===null?['CORNER_SEQUENCE_INCOMPLETE']:[]),
   ...(last3f===null?['LAST_3F_MISSING']:[]),
   ...(lapEvidence.status==='LAPS_UNAVAILABLE'?['RACE_LAPS_MISSING']:
      lapEvidence.status==='LAPS_UNVERIFIED_UNIT_OR_SOURCE'?['RACE_LAPS_NOT_OFFICIALLY_VERIFIED']:[]),
   'RIVAL_LEVEL_NOT_INDEPENDENTLY_VERIFIED'
  ]
 };
};
export function auditPreRaceLossEvidence({
 targetRace,runners,source,clock=()=>Date.now(),maxPriorRuns=5
}={}){
 if(!targetRace||!isoDate(targetRace.raceDate)||
    !positiveInt(targetRace.raceNo,14)||!norm(targetRace.track)||
    !['芝','ダート'].includes(targetRace.surface)||
    !Number.isInteger(targetRace.distance)||targetRace.distance<800||
    targetRace.distance>4500||
    !Array.isArray(runners)||!runners.length||runners.length>24||
    !Number.isInteger(maxPriorRuns)||maxPriorRuns<1||maxPriorRuns>8)
  throw new Error('INVALID_OFFICIAL_PRE_RACE_CONTEXT');
 const post=dateTime(targetRace.postTime),now=clock();
 const checked=dateTime(source?.checkedAt);
 if(!allowedSource.has(source?.kind)||source?.verified!==true||
    post===null||!Number.isFinite(now)||now>=post||
    checked===null||checked>now||checked>=post||
    now-checked>24*3600000)
  throw new Error('UNVERIFIED_OR_AFTER_POST_SOURCE');
 const keys=new Set(),names=new Set();
 const result=runners.map(r=>{
  const horseNo=v(r,'horseNo','horse_no'),horseName=norm(v(r,'horseName','horse_name'));
  if(!positiveInt(horseNo)||!horseName||keys.has(horseNo)||names.has(horseName))
    throw new Error('OFFICIAL_ROSTER_IDENTITY_MISMATCH');
  keys.add(horseNo);names.add(horseName);
  const raw=arr(r,'pastRuns','past_runs','verifiedRecentRuns','verified_recent_runs');
  if(!Array.isArray(raw))throw new Error('MISSING_VERIFIED_HISTORY_ARRAY');
  const records=raw.slice(0,maxPriorRuns).map(z=>byRun(z,targetRace)).filter(Boolean);
  const missingFuture=raw.slice(0,maxPriorRuns).length-records.length;
  return {
   horse_no:horseNo,horse_name:horseName,
   past_runs_checked:records.length,excluded_unverified_or_future:missingFuture,
   near_surface_distance_count:records.filter(x=>x.course_match.near_course_distance).length,
   close_finish_count:records.filter(x=>x.clues.some(c=>c.code==='CLOSE_FINISH')).length,
   observed_corners_count:records.filter(x=>x.early_pos!==null&&x.final_turn_pos!==null).length,
   available_laps_count:records.filter(x=>x.lap_evidence.status==='OFFICIAL_200M_SPLITS_PRESENT').length,
   records
  };
 });
 return {
  schema_version:'PRERACE_LOSS_AUDIT_V1',target_race:targetRace.raceDate+'/'+targetRace.track+'/'+targetRace.raceNo,
  source_kind:source.kind,source_checked_at:source.checkedAt,
  verified_runner_count:result.length,
  causal_claims_allowed:false,market_used:false,
  target_result_used:false,ranking_effect:'NONE',save_gate_effect:'NONE',
  status:'EVIDENCE_ONLY_NOT_YET_SCORED',
  runners:result
 };
}
