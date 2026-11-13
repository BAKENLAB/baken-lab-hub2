/**
 * BAKEN LAB LOCAL v1.7 - read-only official intake window advisory.
 * RESEARCH ONLY: never fetches, claims, schedules, scores, bets or saves.
 * Schedule timing is not official field READY, valid CLAIM or save authority.
 *
 * Current official local-data-refresh v14 has a default 07:00-22:00 JST
 * schedule-discovery gate and prioritises details from 240 min before post.
 * These are conservative advisory estimates, not guarantees.
 */
const JST_OFFSET=9*60*60*1000;
const jstDay=(ms)=>new Date(ms+JST_OFFSET).toISOString().slice(0,10);
const jstTime=(ms)=>new Date(ms+JST_OFFSET).toISOString().slice(0,19)+'+09:00';
const refused=(reason)=>Object.freeze({
 status:'UNVERIFIED',reason,may_call_preclaim:false,
 may_call_claim:false,may_save:false,production_rank_effect:false
});
export function localRaceIntakeAdvisory({
 raceDate,track,raceNo,officialPostTime,observedAt,
 registryStatus='UNKNOWN',fieldStatus='UNKNOWN',alreadyFrozen=false
}={}){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(raceDate??'')||
    typeof track!=='string'||track.length<1||track.length>20||
    !Number.isInteger(raceNo)||raceNo<1||raceNo>14||
    typeof officialPostTime!=='string'||typeof observedAt!=='string')
  return refused('OFFICIAL_SCHEDULE_OR_OBSERVATION_MISSING');
 const post=Date.parse(officialPostTime),now=Date.parse(observedAt);
 if(!Number.isFinite(post)||!Number.isFinite(now)||
    jstDay(post)!==raceDate)
  return refused('POST_TIME_JST_RACE_IDENTITY_MISMATCH');
 const registration=Date.parse(raceDate+'T07:00:00+09:00');
 const detailed=Math.max(registration,post-240*60000);
 let status='WAITING_OFFICIAL_READY';
 if(alreadyFrozen===true)status='ALREADY_FROZEN';
 else if(jstDay(now)!==raceDate)status='NOT_RACE_DAY';
 else if(now>=post)status='POST_TIME_PASSED';
 else if(now<registration)status='WAITING_0700_JST_SCHEDULE_DISCOVERY';
 else if(registryStatus!=='REGISTERED')status='WAITING_OFFICIAL_RACE_REGISTRY';
 else if(now<detailed)status='WAITING_FOUR_HOUR_DETAIL_WINDOW';
 else if(fieldStatus!=='READY')status='WAITING_OFFICIAL_FIELD_READY';
 else status='OFFICIAL_READY_STILL_REQUIRES_AUTHORIZED_LIVE_CLAIM';
 return Object.freeze({
  status,race_date:raceDate,track,race_no:raceNo,
  official_post_time_jst:jstTime(post),
  earliest_normal_schedule_discovery_jst:jstTime(registration),
  earliest_normal_detail_attempt_jst:jstTime(detailed),
  observed_at_jst:jstTime(now),
  // These fields NEVER become true in an advisory.
  may_call_preclaim:false,may_call_claim:false,may_save:false,
  production_rank_effect:false,official_ready_verified_by_this_function:false,
  requires_actual_server_ready_and_authorized_claim:true
 });
}
