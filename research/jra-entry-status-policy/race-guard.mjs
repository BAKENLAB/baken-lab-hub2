// SHADOW ONLY. Rejects incomplete fields and mixed-race score rows.
// This module performs no SQL and never publishes predictions.
export function assessRace({race,runners,verifiedStatuses,scoringRows}) {
 if(!race?.id||race.race_type!=='平地'||!['芝','ダート'].includes(race.surface)) return {state:'HOLD',reason:'RACE_NOT_VERIFIED_FLAT'};
 if(!Array.isArray(runners)||!runners.length||!Array.isArray(verifiedStatuses)||!Array.isArray(scoringRows)) return {state:'HOLD',reason:'MISSING_FIELD'};
 const horseNos=new Set(),runnerIds=new Set();
 for(const r of runners) {
  if(!Number.isInteger(r.horse_no)||r.horse_no<1||!r.id||horseNos.has(r.horse_no)||runnerIds.has(r.id)) return {state:'HOLD',reason:'INVALID_RUNNER_IDENTITY'};
  horseNos.add(r.horse_no);runnerIds.add(r.id);
 }
 if(verifiedStatuses.length!==runners.length) return {state:'HOLD',reason:'STATUS_COUNT_MISMATCH'};
 const statusMap=new Map();
 for(const s of verifiedStatuses) {
  if(!horseNos.has(s.horse_no)||statusMap.has(s.horse_no)||s.scope!=='CURRENT_RACE'||s.verified!==true||!['ACTIVE','CANCELLED','EXCLUDED'].includes(s.status)) return {state:'HOLD',reason:'UNVERIFIED_STATUS'};
  statusMap.set(s.horse_no,s.status);
 }
 const active=runners.filter(r=>statusMap.get(r.horse_no)==='ACTIVE');
 if(!active.length) return {state:'HOLD',reason:'NO_ACTIVE_RUNNERS'};
 if(scoringRows.length!==active.length) return {state:'HOLD',reason:'SCORING_COUNT_MISMATCH'};
 const scores=new Map();
 for(const row of scoringRows) {
  if(row.live_race_id!==race.id||!runnerIds.has(row.live_runner_id)||scores.has(row.live_runner_id)||!Number.isFinite(row.score)||row.score<0||row.score>100) return {state:'HOLD',reason:'INVALID_SCORE_SCOPE'};
  scores.set(row.live_runner_id,row);
 }
 if(active.some(r=>!scores.has(r.id))||runners.some(r=>statusMap.get(r.horse_no)!=='ACTIVE'&&scores.has(r.id))) return {state:'HOLD',reason:'SCORING_FIELD_MISMATCH'};
 return {state:'STAGE_ONLY',raceId:race.id,activeCount:active.length,excludedCount:runners.length-active.length,eligibleForOfficialPublish:false};
}
