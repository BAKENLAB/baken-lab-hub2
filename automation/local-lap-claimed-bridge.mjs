/** Never promote a past race's official 200m splits to horse-specific splits.
 * Only link the preclaim snapshot's source-validated race laps to the already
 * independently verified official horse/corner identity and past run.
 * No target result or market, score, rank, save, CLAIM or DB access.
 */
import {checkStoredOfficialNarLaps} from './nar-official-lap-evidence.mjs';
const key=x=>JSON.stringify([x.race_date??x.raceDate,x.track,x.race_no??x.raceNo]);
const empty=(reason='NO_VERIFIED_LAPS')=>({status:reason,prior_races:[],
  race_laps_count:0,horse_specific_sectionals:false,market_used:false,
  target_result_used:false,score_effect:0,rank_effect:false});
export function projectOfficialLapContext({race,runners,cornerSources,packets,now}={}){
 if(!race||!Array.isArray(runners)||!Array.isArray(cornerSources)||
   !Array.isArray(packets)||!Number.isFinite(now)||!Number.isFinite(Date.parse(race.post_time))||
   now>=Date.parse(race.post_time))return empty('PRE_RACE_CONTEXT_REQUIRED');
 if(packets.length>40)return empty('PACKET_TOO_LARGE');
 const used=new Set(),rows=[];
 for(const packet of packets){
  try{
   checkStoredOfficialNarLaps(packet,{targetDate:race.race_date,
     targetPostTime:race.post_time,now});
   const k=key(packet.pastRace);
   if(used.has(k))continue;
   const refs=[];
   for(const source of cornerSources){
    if(key(source?.past_race)!==k ||
       source.official_source_ref!==packet.sourceRef ||
       source.source_checked_at!==packet.sourceCheckedAt ||
       source.verification_scope!=='PRECLAIM_OFFICIAL_PAST_RESULT')continue;
    const h=runners.find(x=>x.horse_no===source.current_horse_no);
    if(!h||!Array.isArray(h.recent_runs))continue;
    const index=h.recent_runs.findIndex(x=>key(x)===k);
    if(index<0)continue;
    if(!refs.some(x=>x.horse_no===h.horse_no))
     refs.push({horse_no:h.horse_no,horse_name:h.horse_name,
       run_ref:'COMPACT_V1.runners[horse_no='+h.horse_no+'].recent_runs['+index+']'});
   }
   if(!refs.length)continue;
   used.add(k);
   rows.push({prior_race:packet.pastRace,source_ref:packet.sourceRef,
    source_checked_at:packet.sourceCheckedAt,distance_m:packet.distance_m,
    winner_time_seconds:packet.winner_time_seconds,segments:packet.segments,
    linked_runners:refs,individual_horse_sectionals:false});
  }catch{/* Optional unverified page laps are not silently inferred. */}
 }
 rows.sort((a,b)=>b.prior_race.raceDate.localeCompare(a.prior_race.raceDate));
 const prior_races=rows.slice(0,20);
 return {status:prior_races.length?'VERIFIED_PAST_RACE_LAPS':'NO_VERIFIED_LAPS',
  prior_races,race_laps_count:prior_races.length,horse_specific_sectionals:false,
  market_used:false,target_result_used:false,score_effect:0,rank_effect:false};
}
