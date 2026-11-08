/**
 * Join a VERIFIED pre-race JRA runner's past corner/3F snapshot with the
 * separately fetched official race-wide 200m lap series.
 * The exact past JRA result URL is the only join key accepted. No market
 * information and no inference that a slower final section CAUSED defeat.
 *
 * Research-only observation, no scoring, CLAIM, bet or FROZEN effect.
 */
const parse=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const sourceKey=s=>{
 try{
  const u=new URL(s,'https://www.jra.go.jp');
  if(u.protocol!=='https:'||
     !['www.jra.go.jp','app.jra.jp','sp.jra.jp','own.jra.jp'].includes(u.hostname)||
     u.pathname!=='/JRADB/accessS.html'||u.searchParams.size!==1||
     !/^[sp]w[A-Za-z0-9/]{12,100}$/.test(u.searchParams.get('CNAME')??''))
   return null;
  return u.pathname+'?CNAME='+u.searchParams.get('CNAME');
 }catch{return null;}
};
export function joinVerifiedJraCornerAndRaceLaps({
 targetRace,pastRun,officialRaceLaps,clock=()=>Date.now()
}={}){
 const reject=status=>({status,observation:null,
  market_used:false,rank_effect:false,save_gate_effect:false});
 const now=clock(),post=parse(targetRace?.postTime),checked=parse(officialRaceLaps?.source_checked_at);
 if(!Number.isFinite(now)||post===null||now>=post||checked===null||
    checked>now||checked>=post||
    !targetRace?.raceDate||!pastRun?.race_date||
    pastRun.race_date>=targetRace.raceDate)
  return reject('AFTER_POST_OR_UNVERIFIED_TIME');
 const a=sourceKey(pastRun.historical_source_ref),b=sourceKey(officialRaceLaps?.source_ref);
 if(!a||a!==b||pastRun.deep_status!=='EXACT_CLAIM_LIVE_HISTORY_MATCH'||
    officialRaceLaps?.status!=='OFFICIAL_RACE_LAPS_VERIFIED'||
    officialRaceLaps?.verified!==true||
    officialRaceLaps.race_date!==pastRun.race_date||
    officialRaceLaps.track!==pastRun.track||
    officialRaceLaps.surface!==pastRun.surface||
    officialRaceLaps.distance!==pastRun.distance)
  return reject('OFFICIAL_PAST_RACE_IDENTITY_MISMATCH');
 const early=pastRun.early_pos,final=pastRun.final_turn_pos;
 const movement=Number.isInteger(early)&&Number.isInteger(final)?
  {from_early:early,to_final_turn:final,positions_gained:early-final}:null;
 return {
  status:'EVIDENCE_ONLY_MATCHED',
  market_used:false,rank_effect:false,save_gate_effect:false,
  observation:{
   race_date:pastRun.race_date,track:pastRun.track,
   race_no:officialRaceLaps.race_no,
   surface:pastRun.surface,distance:pastRun.distance,
   finish:pastRun.finish,position_change:movement,
   runner_last_3f:pastRun.final3f??null,
   race_first_600m:officialRaceLaps.first_600m_seconds??null,
   race_last_600m:officialRaceLaps.last_600m_seconds??null,
   official_lap_segments:officialRaceLaps.lap_seconds.length,
   race_pace_class:'UNDETERMINED_WITHOUT_PEER_REFERENCE',
   true_loss_cause:'UNPROVEN',
   caveat:'RACE_LAPS_ARE_FIELD_WIDE_NOT_INDIVIDUAL_SECTION_TIMES',
   source_ref:officialRaceLaps.source_ref,
   source_checked_at:officialRaceLaps.source_checked_at
  }
 };
}
