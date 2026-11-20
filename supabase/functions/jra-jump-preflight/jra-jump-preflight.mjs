/**
 * Read-only JRA JUMP K2 production bridge preflight.
 * This output is a gate status, NOT an official prediction or score.
 * No unsupported historical coverage claims; no odds, market, results.
 */
export const K2_VERSION = "JRA_JUMP_0.1_K2_20261115";
const validNo=n=>Number.isInteger(n)&&n>=1&&n<=24;
const cardRuns=x=>Array.isArray(x?.past_runs)?x.past_runs:[];
export function assessJraJumpReadiness({race,queue,liveRunners=[],official,protocols=[]}={}){
 const reasons=[],observed={};
 const obstacle=race?.race_type==="障害"&&race?.surface==="障害";
 const field=obstacle&&Number.isInteger(race?.field_size)&&race.field_size>=5&&race.field_size<=24;
 if(!obstacle)reasons.push("NOT_OBSTACLE_RACE");
 if(!field)reasons.push("LIVE_JUMP_RACE_UNVERIFIED");
 if(queue?.status!=="done")reasons.push("OFFICIAL_CAPTURE_NOT_DONE");
 const identity=field&&liveRunners.length===race.field_size&&
 liveRunners.every(r=>validNo(r.horse_no)&&typeof r.horse_name==="string"&&r.horse_name.trim()&&typeof r.horse_ref==="string"&&r.horse_ref.trim())&&
 new Set(liveRunners.map(r=>r.horse_no)).size===liveRunners.length;
 if(!identity)reasons.push("FIELD_IDENTITY_INCOMPLETE");
 const jumpCards=liveRunners.filter(r=>cardRuns(r).some(x=>String(x?.race_class??"").startsWith("障害"))).length;
 const zeroCardJump=liveRunners.filter(r=>!cardRuns(r).some(x=>String(x?.race_class??"").startsWith("障害"))).map(r=>r.horse_no);
 const reviewedRecent=liveRunners.filter(r=>Array.isArray(r.past_runs)).length;
 // Exact official horse IDs encode the birth year. This is a coverage PLAN,
 // never a verified result-history certificate or a prediction input.
 const years=liveRunners.map(h=>({
   horse_no:h.horse_no,
   birth_year:Number(String(h.horse_ref??"").match(/pw01dud[0-9]{2}([0-9]{4})/)?.[1]??NaN)
 }));
 const dayYear=Number(String(race?.race_date??"").slice(0,4));
 const allBirthsVerified=years.length===race?.field_size&&years.every(h=>
   Number.isInteger(h.birth_year)&&h.birth_year>=1986&&h.birth_year<=dayYear);
 if(!allBirthsVerified)reasons.push("HORSE_BIRTH_YEAR_UNVERIFIED");
 const oldest=allBirthsVerified?Math.min(...years.map(x=>x.birth_year)):null;
 const requiredYearWindows=oldest===null?null:dayYear-oldest+1;
 if(requiredYearWindows!==null&&requiredYearWindows>12)
   reasons.push("BIRTH_TO_ASOF_HISTORY_EXCEEDS_ANNUAL_BOUND");
 const asOf=String(race?.race_date??"");
 const parsed=Date.parse(asOf);
 const last365start=Number.isFinite(parsed)?new Date(parsed-365*86400000).toISOString().slice(0,10):null;
 const fieldReady=official?.field_status==="BASIC_READY"||official?.field_status==="READY";
 const officialProof=fieldReady&&official?.field_payload?.race?.race_type==="障害"&&official?.field_payload?.race?.surface==="障害"&&
 official?.field_payload?.official_status_verification?.verified===true;
 if(!officialProof)reasons.push("OFFICIAL_OBSTACLE_FIELD_UNPUBLISHED");
 const protocol=protocols.filter(x=>x.protocol_key==="JRA_JUMP"&&x.is_active===true&&x.version===K2_VERSION);
 if(protocol.length!==1)reasons.push("JUMP_K2_PROTOCOL_INACTIVE");
 // The captured card is only the four most recent races. Full-year obstacle
 // jockey and full horse profiles require a separate independent source audit.
 reasons.push("FULL_OBSTACLE_HISTORY_UNVERIFIED","JOCKEY_365_DAY_OBSTACLE_HISTORY_UNVERIFIED","NUMERIC_K2_RECALCULATION_NOT_CERTIFIED");
 observed.live_runner_count=liveRunners.length;
 observed.recent_card_history_runner_count=reviewedRecent;
 observed.recent_card_jump_runner_count=jumpCards;
 observed.no_obstacle_run_in_recent_card_horse_nos=zeroCardJump;
 observed.current_official_obstacle_ready=Boolean(officialProof);
 observed.active_k2_protocol_count=protocol.length;
 observed.birth_year_evidence=allBirthsVerified?years:null;
 observed.earliest_runner_birth_year=oldest;
 observed.required_annual_calendar_windows=requiredYearWindows;
 observed.official_result_coverage_required_from=oldest===null?null:oldest+"-01-01";
 observed.jockey_complete_year_required_from=last365start;
 observed.historical_full_calendar_certified=false;
 return {
   version:K2_VERSION,scope:"JRA_JUMP_ONLY",mode:"PROTECTED_READONLY_PREFLIGHT",
   date:race?.race_date??null,track:race?.track??null,race_no:race?.race_no??null,
   status:"BLOCKED_PRE_FREEZE",reasons:[...new Set(reasons)],observed,
   full_profile_verified:false,full_jockey_year_verified:false,
   numeric_score_certified:false,ranking_authorized:false,
   claim_authorized:false,save_authorized:false,frozen_written:false,
   flat_jra_changed:false,cron_changed:false,market_used:false,target_result_used:false,
   note:"Recent four-card snippets do not prove all prior obstacle starts. No race predictions are produced."
 };
}
