/** Project official, source-attested opponent later results into LOCAL1.6
 * live CLAIM evidence. No odds/results for target, no name-based horse ID join,
 * no numeric scoring or ranking. Prior source must match an independently
 * accepted official corner witness for the CURRENT runner.
 */
const key=x=>JSON.stringify([x?.race_date??x?.raceDate,x?.track,x?.race_no??x?.raceNo]);
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x);
export function projectOfficialOpponentFollowups({race,runners,cornerSources,packet,now}={}){
 const empty=(status='NO_VERIFIED_OPPONENT_FOLLOWUP')=>({status,rows:[],followup_count:0,
  market_used:false,target_result_used:false,score_effect:0,rank_effect:false});
 if(!race||!Array.isArray(runners)||!Array.isArray(cornerSources)||
  !Array.isArray(packet)||packet.length>80||!Number.isFinite(now)||
  !Number.isFinite(Date.parse(race.post_time))||now>=Date.parse(race.post_time))
  return empty('PRE_RACE_CONTEXT_REQUIRED');
 const rows=[],seen=new Set();
 for(const p of packet){
  const h=runners.find(x=>x.horse_no===p?.horseNo&&x.horse_name===p?.horseName);
  if(!h||!Array.isArray(h.recent_runs)||!date(p.priorRace?.raceDate)||
   !date(p.followupRace?.raceDate)||p.priorRace.raceDate>=p.followupRace.raceDate||
   p.followupRace.raceDate>=race.race_date||
   !/^[0-9]{1,30}$/.test(p.peerOfficialHorseId??'')||
   p.identityMethod!=='EXACT_NAR_OFFICIAL_HORSE_ID_TWO_RESULT_PAGES'||
   p.rankingEffect!=='NONE_UNTIL_REVIEWED'||!Number.isInteger(p.peerPriorFinish)||
   p.peerPriorFinish<1||p.peerPriorFinish>3||
   !Number.isInteger(p.peerFollowupFinish)||p.peerFollowupFinish<1||
   p.peerFollowupFinish>24||!Number.isFinite(Date.parse(p.sourceCheckedAt))||
   !Number.isFinite(Date.parse(p.followupCheckedAt))||
   Date.parse(p.sourceCheckedAt)>now||Date.parse(p.followupCheckedAt)>now)continue;
  const i=h.recent_runs.findIndex(x=>key(x)===key(p.priorRace));
  if(i<0||!cornerSources.some(x=>x.current_horse_no===h.horse_no&&
   key(x.past_race)===key(p.priorRace)&&
   x.official_source_ref===p.sourceRef&&
   x.source_checked_at===p.sourceCheckedAt&&
   x.verification_scope==='PRECLAIM_OFFICIAL_PAST_RESULT'))continue;
  const unique=[h.horse_no,key(p.priorRace),p.peerOfficialHorseId,key(p.followupRace)].join('|');
  if(seen.has(unique))continue;seen.add(unique);
  rows.push({horse_no:h.horse_no,horse_name:h.horse_name,
   original_run_ref:'COMPACT_V1.runners[horse_no='+h.horse_no+'].recent_runs['+i+']',
   prior_race:p.priorRace,peer_official_horse_id:p.peerOfficialHorseId,
   peer_name:p.peerName,peer_finish_in_prior:p.peerPriorFinish,
   followup_race:p.followupRace,peer_finish_in_followup:p.peerFollowupFinish,
   prior_source_ref:p.sourceRef,followup_source_ref:p.followupSourceRef,
   source_checked_at:p.sourceCheckedAt,followup_checked_at:p.followupCheckedAt,
   match_method:'EXACT_NAR_OFFICIAL_HORSE_ID_TWO_RESULT_PAGES'});
 }
 return {status:rows.length?'VERIFIED_PARTIAL_FOLLOWUP':'NO_VERIFIED_OPPONENT_FOLLOWUP',
  rows,followup_count:rows.length,market_used:false,target_result_used:false,
  score_effect:0,rank_effect:false};
}
