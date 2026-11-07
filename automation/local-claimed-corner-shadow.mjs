/**
 * Research-only LOCAL CLAIM context overlay. No sources are fetched here.
 * Inputs: authenticated finalContext's verified, unredacted runner witnesses,
 * its compact output runners, and a separately authorized pre-CLAIM packet.
 * The existing ranked input remains unchanged: result is shadow-only.
 */
import {bridgeLocalOfficialCorners} from './local-corner-pace-bridge.mjs';
import {buildLocalFieldPaceEvidence} from './local-field-pace.mjs';
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const raceKey=r=>[String(r.race_date),r.track,Number(r.race_no)].join('/');
const copy=o=>structuredClone(o);
export function buildLocalClaimedCornerShadow({
 targetRace,verifiedRunners,compactRunners,cornerPacket,conditions={},clock=()=>Date.now()
}){
 if(!Array.isArray(verifiedRunners)||!Array.isArray(compactRunners)||
    verifiedRunners.length!==compactRunners.length||verifiedRunners.length<1)
   throw new TypeError('CLAIM_ROSTER_MISMATCH');
 const compactByNo=new Map(compactRunners.map(r=>[r.horse_no,r]));
 if(compactByNo.size!==compactRunners.length||verifiedRunners.some(r=>
   !compactByNo.has(r.horse_no)||
   norm(r.horse_name)!==norm(compactByNo.get(r.horse_no).horse_name)))
   throw new TypeError('CLAIM_ROSTER_MISMATCH');
 const enriched=bridgeLocalOfficialCorners({
  targetRace,officialRunners:verifiedRunners,cornerPacket,conditions,clock
 });
 const shadowRunners=copy(compactRunners);
 const verifiedByNo=new Map(enriched.runners.map(r=>[r.horse_no,r]));
 const audits=[];
 let inserted=0;
 for(const runner of shadowRunners){
  const rich=verifiedByNo.get(runner.horse_no);
  if(!Array.isArray(runner.recent_runs)||!Array.isArray(rich?.recent_runs))
   throw new TypeError('CLAIM_RUNS_MISSING');
  for(const h of runner.recent_runs){
   const matches=rich.recent_runs.filter(x=>raceKey(x)===raceKey(h));
   if(matches.length!==1)continue;
   const full=matches[0];
   // Only corner facts may be overlaid, never finish/class/market/identity.
   for(const field of ['early_pos','final_turn_pos']){
    if(h[field]===null||h[field]===undefined){
     if(Number.isInteger(full[field])&&full[field]>=1&&full[field]<=24){
      h[field]=full[field];inserted++;
     }
    }else if(full[field]!=null&&full[field]!==h[field]){
     throw new TypeError('CORE_POSITION_MISMATCH');
    }
   }
  }
 }
 const pace=buildLocalFieldPaceEvidence(shadowRunners,conditions);
 for(const item of enriched.reports)audits.push(item);
 return {
  status:enriched.status,source:'NAR_OFFICIAL_PRECLAIM_CORNERS',
  use_for_rank:false,use_for_save_gate:false,market_used:false,
  race:{race_date:targetRace.raceDate,track:targetRace.track,
   race_no:Number(targetRace.raceNo)},
  applied_prior_runs:enriched.applied,ignored_prior_runs:enriched.ignored,
  inserted_corner_fields:inserted,field_pace_evidence:pace,
  runners:shadowRunners,reports:audits
 };
}
