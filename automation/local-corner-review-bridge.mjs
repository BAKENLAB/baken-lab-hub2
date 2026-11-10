/**
 * LOCAL official pre-CLAIM corner packet -> shared JRA/LOCAL historical review.
 * This adapter is pure. It neither performs an official fetch nor scores/ranks.
 * It does not treat corner movements as proven victory/defeat causes.
 */
import {prepareHistoricalRaceReview} from './historical-race-review-handoff.mjs';
const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
export function bridgeLocalCornerEvidenceToReview({targetRace,runners,cornerPacket,otherEvidence=[]}){
 if(targetRace?.circuit!=='LOCAL'||!Array.isArray(runners)||!Array.isArray(otherEvidence)||
    cornerPacket?.status!=='PREFETCH_ONLY'||cornerPacket.raceDate!==targetRace.race_date||
    cornerPacket.raceTrack!==targetRace.track||cornerPacket.raceNo!==targetRace.race_no||
    !Array.isArray(cornerPacket.evidence))throw new Error('CORNER_PACKET_RACE_MISMATCH');
 const active=new Map(runners.filter(r=>r.status==='ACTIVE').map(r=>[r.horse_no,r]));
 const converted=[],excluded=[];
 for(const e of cornerPacket.evidence){
   const horse=active.get(e?.horseNo),past=e?.pastRace;
   if(!horse||clean(horse.horse_name)!==clean(e.horseName)||
      !past||!Number.isInteger(e.pastHorseNo)||e.pastHorseNo<1||
      e.source!=='NAR_OFFICIAL_PAST_RACE_RESULT'||
      !Array.isArray(e.corners)||e.corners.length===0||
      !e.corners.every(c=>Number.isInteger(c.corner)&&c.corner>=1&&c.corner<=4&&
        Number.isInteger(c.position)&&c.position>=1)||
      e.earlyPos!==e.corners[0].position||
      e.finalTurnPos!==e.corners.at(-1).position){
     excluded.push('UNVERIFIED_RUNNER_CORNER_LINK');continue;
   }
   converted.push({
     horse_no:e.horseNo,horse_name:e.horseName,
     past_race_date:past.raceDate,
     past_race:{race_date:past.raceDate,track:past.track,race_no:past.raceNo},
     early_pos:e.earlyPos,final_turn_pos:e.finalTurnPos,
     source:e.source,source_ref:e.sourceRef,source_checked_at:e.sourceCheckedAt
   });
 }
 const review=prepareHistoricalRaceReview({
   targetRace,runners,evidence:[...converted,...otherEvidence]
 });
 return {...review,bridge:{converted:converted.length,excluded:excluded.length,
   original_corner_evidence:cornerPacket.evidence.length,
   status:'RESEARCH_ONLY_NO_SCORING',causal_inference_performed:false,
   ranking_changed:false,claim_started:false,save_authorized:false}};
}
