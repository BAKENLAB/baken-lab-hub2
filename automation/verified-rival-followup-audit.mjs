/**
 * Independent, as-of official rival follow-up audit for a prior race.
 * A later good result by an opponent is evidence about that past field,
 * not proof of race difficulty, not an excuse for a horse's defeat.
 * Never uses odds, popularity, current results, or prediction rankings.
 */
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'));
const safeNo=n=>Number.isInteger(n)&&n>=1&&n<=24;
const safeId=s=>typeof s==='string'&&/^[a-zA-Z0-9/_:-]{3,96}$/.test(s);
const officialRef=(ref,kind)=>{
 try{
  const u=new URL(ref);
  const host=kind==='JRA_PAST_OFFICIAL'?'www.jra.go.jp':'www.keiba.go.jp';
  return u.protocol==='https:'&&u.hostname===host&&
   !u.username&&!u.password&&!u.hash&&
   (kind==='JRA_PAST_OFFICIAL'?u.pathname.startsWith('/JRADB/'):
    u.pathname.startsWith('/KeibaWeb/'));
 }catch{return false;}
};
export function auditVerifiedRivalFollowUps({
 targetRaceDate,targetPostTime,priorRace,entrants,followUps,
 verifiedSource,clock=()=>Date.now()
}={}){
 const now=clock(),post=Date.parse(targetPostTime);
 const sourceTime=Date.parse(verifiedSource?.checkedAt??'');
 if(!date(targetRaceDate)||!date(priorRace?.raceDate)||
    priorRace.raceDate>=targetRaceDate||
    !safeNo(priorRace.raceNo)||!priorRace.track||
    !Array.isArray(entrants)||entrants.length<2||entrants.length>24||
    !Array.isArray(followUps)||followUps.length>150||
    !['JRA_PAST_OFFICIAL','NAR_PAST_OFFICIAL'].includes(verifiedSource?.kind)||
    verifiedSource?.verified!==true||
    !Number.isFinite(post)||!Number.isFinite(now)||now>=post||
    !Number.isFinite(sourceTime)||sourceTime>now||sourceTime>=post)
  throw new Error('UNVERIFIED_PAST_RACE_OR_AFTER_POST');
 const seen=new Set(),entryIds=new Set(),rivalIds=new Set();
 for(const item of entrants){
  if(!safeId(item.horseId)||!safeNo(item.horseNo)||
     seen.has(item.horseNo)||entryIds.has(item.horseId)||
     !safeNo(item.finish)||item.finish>entrants.length)
    throw new Error('PAST_FIELD_IDENTITY_NOT_VERIFIED');
  seen.add(item.horseNo);entryIds.add(item.horseId);
  // A horse can be a runner under evaluation, not its own rival.
  if(item.isTargetHorse!==true)rivalIds.add(item.horseId);
 }
 if(rivalIds.size<1)throw new Error('NO_COMPARABLE_OPPONENTS');
 const followById=new Map();
 for(const run of followUps){
  if(!safeId(run.horseId)||!rivalIds.has(run.horseId)||
    !date(run.raceDate)||run.raceDate<=priorRace.raceDate||
    run.raceDate>=targetRaceDate||!safeNo(run.finish)||
    run.officialSourceVerified!==true||
    !['JRA_PAST_OFFICIAL','NAR_PAST_OFFICIAL'].includes(run.sourceKind)||
    !officialRef(run.sourceRef,run.sourceKind)||
    !Number.isFinite(Date.parse(run.sourceCheckedAt??''))||
    Date.parse(run.sourceCheckedAt)>now||
    Date.parse(run.sourceCheckedAt)>=post)
    continue;
  if(run.sourceKind!==verifiedSource.kind)continue;
  const known=followById.get(run.horseId);
  if(!known||run.raceDate<known.raceDate)
   followById.set(run.horseId,{
    horseId:run.horseId,raceDate:run.raceDate,
    finish:run.finish,sourceKind:run.sourceKind
   });
 }
 const observed=[...followById.values()].sort((a,b)=>a.horseId.localeCompare(b.horseId));
 const top3=observed.filter(x=>x.finish<=3).length;
 const wins=observed.filter(x=>x.finish===1).length;
 return {
  status:observed.length>=3?'OBSERVED_RIVAL_FOLLOWUPS':'INSUFFICIENT_RIVAL_FOLLOWUPS',
  target_date:targetRaceDate,
  prior_race:{race_date:priorRace.raceDate,track:priorRace.track,race_no:priorRace.raceNo},
  source_kind:verifiedSource.kind,source_checked_at:verifiedSource.checkedAt,
  eligible_rivals:rivalIds.size,observed_rivals:observed.length,
  observed_wins:wins,observed_top3:top3,
  coverage:Math.round(observed.length/rivalIds.size*100)/100,
  follow_up_examples:observed,
  class_strength:'NOT_ESTABLISHED_FROM_FOLLOWUPS_ALONE',
  race_loss_cause:'NOT_DETERMINABLE',
  market_used:false,target_race_result_used:false,
  rank_effect:'NONE',save_gate_effect:'NONE'
 };
}
