/**
 * Research-only comparison of horses in today's verified official field who
 * previously met in the SAME JRA race.
 *
 * Source ownership must be checked by a separate official-card-to-live-horse-ref
 * gate. This function refuses any mismatch and returns observations only.
 * It DOES NOT independently fetch official historic results, make a pace
 * classification, score, CLAIM, bet or save a prediction.
 */
const noMarket=true;
const raceRef=ref=>{
 if(typeof ref!=='string'||!ref.startsWith('/JRADB/accessS.html?CNAME='))return null;
 try{
  const u=new URL(ref,'https://www.jra.go.jp');
  if(u.origin!=='https://www.jra.go.jp'||u.pathname!=='/JRADB/accessS.html'||
      u.searchParams.size!==1||u.hash||
      !/^[sp]w[A-Za-z0-9/]{12,100}$/.test(u.searchParams.get('CNAME')??''))return null;
  return u.pathname+'?CNAME='+u.searchParams.get('CNAME');
 }catch{return null;}
};
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
export function buildJraSameRacePeerEvidence({
 targetRaceDate,targetPostTime,officialRunners,liveRunners,
 clock=()=>Date.now(),minimumRunners=2
}={}){
 const empty=(status)=>({status,groups:[],market_used:false,
  score_change:false,rank_change:false,prediction_saved:false});
 const now=clock(),post=Date.parse(targetPostTime??'');
 if(!date(targetRaceDate)||!Number.isFinite(post)||!Number.isFinite(now)||
    now>=post||!Array.isArray(officialRunners)||!Array.isArray(liveRunners)||
    minimumRunners<2||minimumRunners>20)
   return empty('UNVERIFIED_PRE_RACE_INPUT');
 const official=new Map();
 for(const h of officialRunners){
  if(h?.status!=='ACTIVE'||!Number.isInteger(h.horse_no)||
     typeof h.horse_ref!=='string'||!h.horse_name||
     official.has(h.horse_no))return empty('OFFICIAL_CURRENT_ROSTER_UNVERIFIED');
  official.set(h.horse_no,h);
 }
 if(official.size!==liveRunners.length)return empty('OFFICIAL_LIVE_RUNNER_COUNT_MISMATCH');
 const groups=new Map();
 for(const h of liveRunners){
  const o=official.get(h.horse_no);
  if(!o||o.horse_ref!==h.horse_ref||o.horse_name!==h.horse_name||
      !Array.isArray(h.past_runs))
   return empty('OFFICIAL_CURRENT_HORSE_IDENTITY_MISMATCH');
  for(const run of h.past_runs){
   const ref=raceRef(run.source_ref);
   if(!ref||!date(run.race_date)||run.race_date>=targetRaceDate||
      typeof run.track!=='string'||typeof run.distance!=='number'||
      !['芝','ダート'].includes(run.surface))continue;
   const key=[ref,run.race_date,run.track,run.surface,run.distance].join('|');
   if(!groups.has(key))groups.set(key,{race_date:run.race_date,
    track:run.track,surface:run.surface,distance:run.distance,
    source_ref:ref,runners:[]});
   const corners=Array.isArray(run.corner_positions)&&
    run.corner_positions.every(x=>Number.isInteger(x)&&x>=1)?
     run.corner_positions:null;
   const margin=typeof run.margin_to_winner==='number'&&
    Number.isFinite(run.margin_to_winner)?run.margin_to_winner:null;
   groups.get(key).runners.push({
    horse_no:h.horse_no,horse_name:h.horse_name,
    finish:Number.isInteger(run.finish)?run.finish:null,
    winner_margin_seconds:Number.isInteger(run.finish)&&run.finish>1?margin:
      run.finish===1?0:null,
    reported_margin_when_winner:run.finish===1?margin:null,
    corners,final3f_seconds:typeof run.final3f==='number'&&
       Number.isFinite(run.final3f)?run.final3f:null
   });
  }
 }
 const matched=[...groups.values()].filter(g=>
  new Set(g.runners.map(r=>r.horse_no)).size>=minimumRunners)
 .map(g=>({...g,runners:g.runners.sort((a,b)=>
   (a.finish??999)-(b.finish??999)||a.horse_no-b.horse_no),
  source_status:'OFFICIAL_HORSE_REF_MATCHED_LIVE_HISTORIC_SNAPSHOT',
  independently_refetched:false,
  race_laps_checked:false,loss_cause:'UNPROVEN'}))
 .sort((a,b)=>b.runners.length-a.runners.length||
   b.race_date.localeCompare(a.race_date));
 return {status:'SAME_RACE_PEERS_GROUPED',groups:matched,
  market_used:false,score_change:false,rank_change:false,prediction_saved:false};
}
