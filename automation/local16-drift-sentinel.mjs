/**
 * LOCAL1.6 day/intra-day quality sentinel (READ ONLY, no outcome information).
 *
 * Design goal: don't silently process a whole meeting with EYE factors
 * omitted in the submitted FROZEN audit, as happened at Oi 1R-7R 2026-11-18.
 * A "CHECKED" flag is NOT a positive factor. Alerts demand independent review,
 * not automatic EYE selection, rank adjustment, replay or retroactive edits.
 * The caller supplies verified, immutable summaries, not any betting results.
 */
export const POLICY="LOCAL16_DAILY_DRIFT_SENTINEL_V1";
const name=x=>typeof x==="string"&&x.length>0;
const int=x=>Number.isInteger(x)&&x>=0;
const fail=(code,detail)=>({
 status:"UNVERIFIED",code,detail,review_required:true,
 rank_changed:false,eye_changed:false,frozen_modified:false
});
const pct=(n,d)=>d?Math.round((n/d)*1000)/10:null;
function analyze(rows){
 const sorted=[...rows].sort((a,b)=>a.race_no-b.race_no);
 let longest=null,streak=[];
 const capture=()=>{if(streak.length>=3&&(!longest||streak.length>longest.races.length)){
  longest={races:streak.map(x=>x.race_no),outsiders:streak.reduce((s,x)=>s+x.outsiders,0),
    suitable_checked:streak.reduce((s,x)=>s+x.suitability_checked,0)};
 }streak=[];};
 for(const r of sorted){
  if(r.factor_horses===0&&r.outsiders>=5&&r.suitability_checked>=1
    &&(!streak.length||streak.at(-1).race_no+1===r.race_no))streak.push(r);
  else{capture();if(r.factor_horses===0&&r.outsiders>=5&&r.suitability_checked>=1)streak=[r];}
 }
 capture();
 const outsiderN=sorted.reduce((s,x)=>s+x.outsiders,0);
 const factors=sorted.reduce((s,x)=>s+x.factor_horses,0);
 return {date:sorted[0]?.race_date,track:sorted[0]?.track,
  races:sorted.length,outsiders:outsiderN,positive_horses:factors,
  positive_coverage_pct:pct(factors,outsiderN),
  evidence_checked:sorted.reduce((s,x)=>s+x.suitability_checked,0),
  zero_factor_races:sorted.filter(x=>x.factor_horses===0).length,
  longest_suspicious_zero_streak:longest,
  score_ledger_missing_races:sorted.filter(x=>x.scorer_trace_verified!==true).length
 };
}
/**
 * @param {{baselineRaces?:any[],currentRaces?:any[],expectedProtocol?:string}} [args]
 */
export function auditLocal16DailyDrift({baselineRaces,currentRaces,expectedProtocol="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013"}={}){
 if(!Array.isArray(baselineRaces)||!Array.isArray(currentRaces)||!currentRaces.length||!name(expectedProtocol))
  return fail("SNAPSHOT_REQUIRED");
 const all=[...baselineRaces,...currentRaces],seen=new Set();
 for(const r of all){
  if(!name(r?.race_date)||!name(r?.track)||!Number.isInteger(r.race_no)||r.race_no<1||r.race_no>24||
     !name(r.protocol_version)||!int(r.outsiders)||!int(r.factor_horses)||
     !int(r.suitability_checked)||r.factor_horses>r.outsiders||
     r.suitability_checked>r.outsiders||typeof r.scorer_trace_verified!=="boolean")
    return fail("SNAPSHOT_INVALID");
  const k=[r.race_date,r.track,r.race_no].join("|");
  if(seen.has(k))return fail("SNAPSHOT_DUPLICATE",{key:k});seen.add(k);
 }
 const groups=new Map();
 for(const r of currentRaces){
  const key=[r.race_date,r.track].join("|");
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 const diagnostics=[],alerts=[];
 for(const [key,rows]of groups){
  const now=analyze(rows);
  const prior=analyze(baselineRaces.filter(x=>x.track===now.track&&x.race_date<now.date));
  const incompatible=rows.filter(x=>x.protocol_version!==expectedProtocol);
  if(incompatible.length)alerts.push({code:"PROTOCOL_CHANGED_WITHOUT_APPROVED_BASELINE",track:now.track,
    race_nos:incompatible.map(x=>x.race_no),expectedProtocol});
  const streak=now.longest_suspicious_zero_streak;
  if(streak)alerts.push({code:"CONSECUTIVE_EMPTY_POSITIVE_FACTORS_DESPITE_CHECKED_EVIDENCE",
   track:now.track,first_race:streak.races[0],last_race:streak.races.at(-1),
   races:streak.races,outsiders:streak.outsiders,suitability_checked:streak.suitable_checked,
   explanation:"CHECKED does not prove positivity; seven consecutive zeros require an explicit omission review"});
  // Comparable track and sufficient historical field coverage ONLY.
  if(prior.races>=7&&prior.outsiders>=40&&prior.positive_coverage_pct>=10&&
     now.outsiders>=20&&now.positive_coverage_pct<5)
    alerts.push({code:"SAME_TRACK_EYE_FACTOR_COVERAGE_COLLAPSE",
      track:now.track,baseline_pct:prior.positive_coverage_pct,current_pct:now.positive_coverage_pct,
      baseline_outsiders:prior.outsiders,current_outsiders:now.outsiders});
  diagnostics.push({key,current:now,baseline:prior.races?prior:null});
 }
 return {status:alerts.length?"REVIEW_REQUIRED":"OBSERVED",
  review_required:alerts.length>0,policy:POLICY,alerts,diagnostics,
  limitations:["Different fields/race classes can alter true factor incidence",
  "CHECKED facts are not automatically favorable",
  "No certified LOCAL1.6 deterministic 100-point scorer ledger is available"],
  recommend:"Audit omissions/inputs and scorer provenance; do not manufacture factors or alter FROZEN",
  rank_changed:false,eye_changed:false,frozen_modified:false,results_used:false,market_used:false};
}
