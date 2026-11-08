/**
 * JRA official-card acquisition planner for later explicit authorization.
 * This module DOES NOT fetch, publish, claim, save, schedule or mutate DB.
 * JRA live snapshots are candidates, NEVER independently sufficient for READY.
 */
const tracks=new Set(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']);
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const number=x=>Number.isInteger(x)&&x>=1&&x<=24;
export const jraPostTimeJst=(raceDate,postTime)=>{
 if(!iso(raceDate)||typeof postTime!=='string')return null;
 const m=postTime.match(/^([0-9]{1,2})時([0-9]{2})分$/);
 if(!m||Number(m[1])>23||Number(m[2])>59)return null;
 const t=Date.parse(raceDate+'T'+m[1].padStart(2,'0')+':'+m[2]+':00+09:00');
 return Number.isFinite(t)?t:null;
};
/**
 * liveRaces: read-only rows from jra_live_races, with verified-current
 * field independently stored as officialRaces from official_races.
 * runnerRows: candidate JRA live runners, not yet official verified.
 * frozenKeys: read-only list of previous official-prediction race keys.
 */
export function planJraOfficialCardAcquisition({
 raceDate,liveRaces,runnerRows,officialRaces=[],frozenKeys=[],
 clock=()=>Date.now(),reserveMs=5*60*1000
}){
 if(!iso(raceDate)||!Array.isArray(liveRaces)||!Array.isArray(runnerRows)||
    !Array.isArray(officialRaces)||!Array.isArray(frozenKeys)||
    !Number.isInteger(reserveMs)||reserveMs<180000||reserveMs>900000)
  throw new TypeError('INVALID_JRA_CARD_PLAN');
 const key=r=>[r.race_date,r.track,r.race_no].join('/');
 const records=new Map(),official=new Map(),frozen=new Set(frozenKeys);
 for(const r of officialRaces){
  if(r.race_date!==raceDate)continue;
  const k=key(r);
  if(official.has(k))throw new Error('DUPLICATE_OFFICIAL_RACE');
  official.set(k,r);
 }
 for(const r of runnerRows){
  if(r.race_date!==raceDate)continue;
  const k=key(r);
  if(!records.has(k))records.set(k,[]);
  records.get(k).push(r);
 }
 const seen=new Set();
 const items=liveRaces.filter(r=>r.race_date===raceDate).map(r=>{
  const k=key(r);
  if(seen.has(k))throw new Error('DUPLICATE_LIVE_RACE');
  seen.add(k);
  const post=jraPostTimeJst(r.race_date,r.post_time);
  const rows=records.get(k)||[];
  const full=official.get(k);
  let status;
  if(!tracks.has(r.track)||!number(r.race_no)||r.race_no>12||post===null)
   status='INVALID_RACE_METADATA';
  else if(frozen.has(k)||full?.prediction_status==='DONE'||full?.prediction_status==='FROZEN')
   status='PREVIOUS_FROZEN';
  else if(full&&['READY','BASIC_READY'].includes(full.field_status))
   status='ALREADY_OFFICIAL_READY';
  else if(r.race_type!=='平地'||!['芝','ダート'].includes(r.surface))
   status='EXCLUDED_NOT_FLAT';
  else if(post<=clock()+reserveMs)status='TOO_LATE_FOR_SAFE_VERIFICATION';
  else if(!number(r.field_size)||!r.cname||
    rows.length!==r.field_size ||
    new Set(rows.map(h=>h.horse_no)).size!==rows.length||
    rows.some(h=>!number(h.horse_no)||!h.horse_name||!h.horse_ref))
   status='LIVE_CANDIDATE_UNVERIFIED';
  else status='NEEDS_FRESH_JRA_OFFICIAL_CARD';
  return {race_date:raceDate,track:r.track,race_no:r.race_no,
   race_type:r.race_type,post_time:r.post_time,post_ms:post,
   live_runner_count:rows.length,live_field_size:r.field_size,
   status,needsOfficialFullField:status==='NEEDS_FRESH_JRA_OFFICIAL_CARD'};
 });
 return {date:raceDate,complete:false,scoringAllowed:false,
  claimStarted:false,predictionSaved:false,
  items:items.sort((a,b)=>(a.post_ms??Infinity)-(b.post_ms??Infinity)||
    a.track.localeCompare(b.track)||a.race_no-b.race_no)};
}
/** Only the subsequent explicitly authorised acquisition phase may invoke
 * the protected official publisher. Never auto-publish or retry safety errors.
 */
export async function runAuthorizedJraOfficialCardAcquisition({
 plan,assertAuthorized,publishOfficial,clock=()=>Date.now(),
 reserveMs=5*60*1000,maxRaces=12
}){
 if(typeof assertAuthorized!=='function')throw new TypeError('AUTHORIZATION_REQUIRED');
 await assertAuthorized('AUTHORIZED_JRA_OFFICIAL_CARD_ACQUISITION');
 if(!plan||!Array.isArray(plan.items)||
    typeof publishOfficial!=='function'||!Number.isInteger(maxRaces)||
    maxRaces<1||maxRaces>36||!Number.isInteger(reserveMs)||reserveMs<180000)
  throw new TypeError('INVALID_JRA_PUBLISH_PLAN');
 const reports=[];
 for(const r of plan.items){
  if(reports.length>=maxRaces)break;
  if(!r.needsOfficialFullField){reports.push({track:r.track,race_no:r.race_no,status:r.status});continue;}
  if(r.post_ms<=clock()+reserveMs){
   reports.push({track:r.track,race_no:r.race_no,status:'TOO_LATE_FOR_SAFE_VERIFICATION'});continue;
  }
  try{
   const published=await publishOfficial({race_date:r.race_date,track:r.track,race_no:r.race_no});
   reports.push({track:r.track,race_no:r.race_no,status:
    published?.ok===true&&published.field_status==='BASIC_READY'&&
    published.official_status_verified===true?'OFFICIALLY_VERIFIED':'OFFICIAL_SOURCE_OR_GUARD_REJECTED'});
  }catch{
   reports.push({track:r.track,race_no:r.race_no,status:'OFFICIAL_SOURCE_UNAVAILABLE'});
  }
 }
 return {reports,claimStarted:false,predictionSaved:false};
}
