/**
 * JRA CLAIM runner_history + independent (but NOT refetched) live past-run
 * corners/3F -> research-only descriptive full-field overlay.
 *
 * This bridge does not grant "READY" relative rank inputs. The JRA live row's
 * historic URL is recorded, NOT re-fetched; it is NOT enough to certify the
 * corresponding corner as independently official or to apply a rank score.
 *
 * No odds, target results, CLAIM, save or FROZEN operations.
 */
const n=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').trim();
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const validTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const number=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
const noResult=(status)=>({status,runner_evidence:[],source_scope:
 'JRA_RECORDED_PAST_RESULT_NOT_INDEPENDENTLY_REFETCHED',
 rank_effect:false,scoring_permission:false,market_used:false,
 target_result_used:false,production_rank_changed:false,frozen_modified:false});
export function buildJraRecordedCornerResearchOverlay({
 claimedContext,deepHistory,observedAt
}={}){
 const r=claimedContext?.race,base=claimedContext?.relative_condition_evidence;
 if(!day(r?.race_date)||!validTime(r?.post_time)||
    !validTime(observedAt)||Date.parse(observedAt)>=Date.parse(r.post_time)||
    !Array.isArray(base?.runner_evidence)||base.runner_evidence.length<6||
    base.status!=='READY'||base.source_scope!=='JRA_CLAIMED_RUNNER_HISTORY'||
    base.target_date!==r.race_date||base.market_used!==false||
    base.target_result_used!==false||base.rank_effect!==false)
  return noResult('UNVERIFIED_JRA_CLAIM_COMPARISON');
 if(deepHistory?.status!=='SNAPSHOT_MATCHED'||
    deepHistory.source_scope!=='RECORDED_JRA_LIVE_PRIOR_SNAPSHOT_NOT_NEW_OFFICIAL_FETCH'||
    deepHistory.race_date!==r.race_date||
    deepHistory.track!==r.track||deepHistory.race_no!==r.race_no||
    deepHistory.verified_runner_count!==base.runner_evidence.length||
    deepHistory.rank_effect!=='NONE'||deepHistory.market_used!==false||
    deepHistory.target_race_result_used!==false||
    !Array.isArray(deepHistory.runner_history)||
    deepHistory.runner_history.length!==base.runner_evidence.length)
  return noResult('UNVERIFIED_DEEP_RECORDED_SNAPSHOT');
 const deep=new Map(),seen=new Set(),rows=[];
 for(const z of deepHistory.runner_history){
  if(!number(z?.horse_no,1,24)||!n(z.horse_name)||deep.has(z.horse_no)||
     !Array.isArray(z.past_runs)||z.past_runs.length>12)
   return noResult('DEEP_ROSTER_OR_HISTORY_MISMATCH');
  deep.set(z.horse_no,z);
 }
 let joined=0,withCorners=0,with3f=0,ambiguous=0;
 for(const row of base.runner_evidence){
  if(!number(row?.horse_no,1,24)||seen.has(row.horse_no)||
     !Array.isArray(row.supporting_runs)||row.supporting_runs.length>12||
     !deep.has(row.horse_no)||n(row.horse_name)!==n(deep.get(row.horse_no).horse_name))
   return noResult('JRA_FULL_FIELD_IDENTITY_MISMATCH');
  seen.add(row.horse_no);
  const past=deep.get(row.horse_no).past_runs;
  const supporting_runs=[];
  for(const run of row.supporting_runs){
   const date=run?.date??run?.race_date;
   if(!day(date)||date>=r.race_date)
    return noResult('FUTURE_OR_UNVERIFIED_JRA_HISTORY');
   const matches=past.filter(x=>x.race_date===date&&x.surface===run.surface&&
     Number(x.distance)===Number(run.distance)&&x.finish===run.finish&&
     x.early_pos===run.early_pos&&
     x.deep_status==='EXACT_CLAIM_LIVE_HISTORY_MATCH'&&
     x.official_source_scope==='HISTORIC_JRA_RESULT_URL_RECORDED_NOT_REFETCHED'&&
     notCertified(x.historical_source_ref));
   // A JOIN with 2 possible histories is NOT evidence.
   if(matches.length>1)ambiguous++;
   const valid=matches.length===1?matches[0]:null;
   const cs=valid&&Array.isArray(valid.corner_positions)&&valid.corner_positions.length>=1&&
     valid.corner_positions.length<=4&&valid.corner_positions.every(x=>number(x,1,24))&&
    (valid.early_pos==null||valid.corner_positions[0]===valid.early_pos)&&
    (valid.final_turn_pos==null||valid.corner_positions.at(-1)===valid.final_turn_pos)?
     [...valid.corner_positions]:[];
   const last=valid&&typeof valid.final3f==='number'&&
     valid.final3f>=25&&valid.final3f<=65?valid.final3f:null;
   if(valid)joined++;
   if(cs.length)withCorners++;
   if(last!==null)with3f++;
   const safe={
    date,track:valid?.track??run.track??null,surface:run.surface,distance:run.distance,
    class:run.class??null,finish:run.finish,margin:run.margin??null,
    early_pos:run.early_pos??null,
    final_turn_pos:cs.length?cs.at(-1):null,corner_positions:cs,
    final3f:last,provenance:cs.length||last!==null?
     'JRA_RECORDED_HISTORIC_RESULT_URL_NOT_REFETCHED':'NO_DEEP_MATCH',
    result_url_recorded:notCertified(valid?.historical_source_ref),
    independent_official_result_refetch:false,true_loss_cause:'UNPROVEN'
   };
   supporting_runs.push(safe);
  }
  rows.push({horse_no:row.horse_no,horse_name:row.horse_name,supporting_runs});
 }
 if(rows.length!==deep.size)
  return noResult('JRA_FULL_FIELD_IDENTITY_MISMATCH');
 return {status:'DESCRIPTIVE_SHADOW_ONLY',
  source_scope:'JRA_RECORDED_PAST_RESULT_NOT_INDEPENDENTLY_REFETCHED',
  runner_count:rows.length,target_date:r.race_date,
  runner_evidence:rows,joined_history_runs:joined,
  prior_runs_with_corners:withCorners,prior_runs_with_final3f:with3f,
  ambiguous_history_matches:ambiguous,
  rank_effect:false,scoring_permission:false,market_used:false,
  target_result_used:false,production_rank_changed:false,frozen_modified:false};
}
function notCertified(ref){
 // Only report that a prior source URL existed. Do not publish URL or raw data.
 return typeof ref==='string'&&
  /^https:\/\/www\.jra\.go\.jp\/JRADB\/accessS\.html\?CNAME=pw[A-Za-z0-9/]{10,100}$/.test(ref);
}
