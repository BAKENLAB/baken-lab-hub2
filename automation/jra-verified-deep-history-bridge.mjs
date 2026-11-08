/**
 * BAKEN LAB — JRA deep prior-run evidence rescue (research only).
 *
 * The standard CLAIM context retains recent finish and early position, but
 * jra_live_runners.past_runs can also retain 4-corner positions and 3F.
 * Read them only when the current runner's official horse reference, exact
 * historical race facts and provenance all independently agree. A URL path
 * alone is not proof that a historic result has been re-fetched or verified.
 *
 * Pure, offline, no DB writes, no HTTP, no model rank, CLAIM or FROZEN.
 */
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const int=(x,lo=1,hi=24)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const coreRun=(r)=>[r.race_date,r.track,r.surface,r.distance,r.finish,r.early_pos].join('|');
const cleanPastResultUrl=v=>{
 if(typeof v!=='string')return null;
 try{
  const u=new URL(v,'https://www.jra.go.jp');
  if(u.protocol!=='https:'||u.hostname!=='www.jra.go.jp'||
     u.pathname!=='/JRADB/accessS.html'||u.username||u.password||u.hash||
     u.searchParams.size!==1||
     !/^pw[0-9a-zA-Z/]{10,96}$/.test(u.searchParams.get('CNAME')??''))
   return null;
  return u.href;
 }catch{return null;}
};
const missing=(r,reason)=>({
 race_date:r.race_date,track:r.track,surface:r.surface,distance:r.distance,
 finish:r.finish,margin_to_winner:r.finish===1?0:r.margin_to_winner??null,
 early_pos:r.early_pos??null,final_turn_pos:null,final3f:null,
 corner_positions:[],provenance:'CLAIM_CONTEXT_ONLY',deep_status:reason,
 true_loss_cause:'UNPROVEN'
});
export function rescueJraDeepHistory({
 claimedContext,liveRace,liveRunners,clock=()=>Date.now()
}={}){
 const race=claimedContext?.race,field=race?.field_payload,verified=field?.official_status_verification;
 const now=clock(),post=time(race?.post_time),sourceTime=time(field?.source_checked_at);
 const reject=status=>({status,verified_deep_runs:0,rank_effect:'NONE',
  save_gate_effect:'NONE',market_used:false});
 if(claimedContext?.stage!=='AWAITING_JRA_FULL_DEPTH_COMPARISON'||
    verified?.verified!==true||!(/^[a-f0-9]{64}$/).test(verified.html_sha256??'')||
    !date(race?.race_date)||!race?.track||!int(race?.race_no,1,12)||
    !Array.isArray(field?.runners)||!Array.isArray(claimedContext?.runner_history)||
    !Array.isArray(liveRunners)||!liveRace||
    field.runners.length<1||field.runners.length>24||
    field.runners.length!==claimedContext.runner_history.length||
    field.runners.length!==liveRunners.length||
    !Number.isFinite(now)||post===null||now>=post||
    sourceTime===null||sourceTime>now||sourceTime>=post||
    now-sourceTime>24*3600000||
    liveRace.race_date!==race.race_date||liveRace.track!==race.track||
    liveRace.race_no!==race.race_no||liveRace.cname!==field.race?.cname)
   return reject('CURRENT_RACE_NOT_VERIFIED');
 const cards=new Map(),historic=new Map(),live=new Map();
 for(const h of field.runners){
  if(!int(h.horse_no)||!norm(h.horse_name)||h.status!=='ACTIVE'||
     typeof h.horse_ref!=='string'||!h.horse_ref.startsWith('/JRADB/accessU.html?CNAME=')||
     cards.has(h.horse_no))return reject('CURRENT_ROSTER_UNVERIFIED');
  cards.set(h.horse_no,h);
 }
 for(const r of claimedContext.runner_history){
  if(!int(r.horse_no)||historic.has(r.horse_no)||!cards.has(r.horse_no)||
     norm(r.horse_name)!==norm(cards.get(r.horse_no).horse_name)||
     !Array.isArray(r.past_runs)||r.past_runs.length>5)
   return reject('CLAIM_HISTORY_IDENTITY_MISMATCH');
  historic.set(r.horse_no,r);
 }
 for(const r of liveRunners){
  if(!int(r.horse_no)||live.has(r.horse_no)||!cards.has(r.horse_no)||
     norm(r.horse_name)!==norm(cards.get(r.horse_no).horse_name)||
     r.horse_ref!==cards.get(r.horse_no).horse_ref||
     r.live_race_id!==liveRace.id||
     !Array.isArray(r.past_runs)||r.past_runs.length>30)
   return reject('LIVE_RUNNER_IDENTITY_MISMATCH');
  const checked=time(r.source_checked_at);
  if(checked===null||checked>now||checked>=post||now-checked>24*3600000)
   return reject('LIVE_PRIOR_SNAPSHOT_STALE');
  live.set(r.horse_no,r);
 }
 let verifiedRuns=0,unmatched=0,cornerRuns=0,last3fRuns=0;
 const runnerHistory=field.runners.map(h=>{
  const rows=historic.get(h.horse_no).past_runs;
  const original=live.get(h.horse_no).past_runs;
  const prior=rows.map(run=>{
   if(!date(run.race_date)||run.race_date>=race.race_date)
    return missing(run,'FUTURE_OR_UNVERIFIED_PRIOR_RUN');
   const options=original.filter(o=>coreRun(o)===coreRun(run));
   if(options.length!==1){unmatched++;return missing(run,'HISTORY_MATCH_NOT_UNIQUE');}
   const x=options[0],ref=cleanPastResultUrl(x.source_ref);
   if(!ref){unmatched++;return missing(run,'OFFICIAL_PAST_SOURCE_UNVERIFIED');}
   const span=int(x.field_size,1,24)?x.field_size:24;
   const ps=x.corner_positions;
   const validCorners=Array.isArray(ps)&&ps.length>=1&&ps.length<=4&&
    ps.every(z=>int(z,1,span))&&
    (run.early_pos===null||run.early_pos===undefined||ps[0]===run.early_pos)&&
    (!int(x.final_turn_pos)||ps[ps.length-1]===x.final_turn_pos);
   const corners=validCorners?[...ps]:[];
   const finalTurn=validCorners?ps[ps.length-1]:null;
   const last3f=number(x.final3f);
   const reliable3f=last3f!==null&&last3f>=25&&last3f<=65?last3f:null;
   if(corners.length)cornerRuns++;
   if(reliable3f!==null)last3fRuns++;
   verifiedRuns++;
   return {
    race_date:run.race_date,track:run.track,surface:run.surface,
    distance:run.distance,finish:run.finish,
    margin_to_winner:run.finish===1?0:run.margin_to_winner??null,
    margin_source_value:run.margin_to_winner??null,
    margin_basis:run.finish===1?'WINNER_LEAD_NOT_LOSS':
     'CLAIMED_RESULT_REPORTED_MARGIN',
    early_pos:run.early_pos??null,final_turn_pos:finalTurn,
    final3f:reliable3f,corner_positions:corners,
    historical_source_ref:ref,
    deep_status:'EXACT_CLAIM_LIVE_HISTORY_MATCH',
    official_source_scope:'HISTORIC_JRA_RESULT_URL_RECORDED_NOT_REFETCHED',
    true_loss_cause:'UNPROVEN'
   };
  });
  return {horse_no:h.horse_no,horse_name:h.horse_name,past_runs:prior};
 });
 return {
  status:unmatched?'PARTIAL_SNAPSHOT_MATCH':'SNAPSHOT_MATCHED',
  source_scope:'RECORDED_JRA_LIVE_PRIOR_SNAPSHOT_NOT_NEW_OFFICIAL_FETCH',
  current_official_digest:verified.html_sha256,
  race_date:race.race_date,track:race.track,race_no:race.race_no,
  verified_runner_count:runnerHistory.length,matched_prior_runs:verifiedRuns,
  unmatched_prior_runs:unmatched,corner_runs:cornerRuns,last3f_runs:last3fRuns,
  rank_effect:'NONE',save_gate_effect:'NONE',
  market_used:false,target_race_result_used:false,
  runner_history:runnerHistory
 };
}
