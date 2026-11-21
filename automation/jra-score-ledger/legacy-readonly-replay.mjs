// Replays recovered legacy numeric CTE in an EPHEMERAL DB only. No transport/save API.
import {createHash} from 'node:crypto';
const sourceHash='46327c30e09c3071b59bb60f57fd9b826cf720be167e31434e14215e3f0ac2ba';
export function legacyReadonlyQuery(source,{cohorts=false}={}){
 if(createHash('sha256').update(source).digest('hex')!==sourceHash)throw Error('LEGACY_SOURCE_DRIFT');
 const start=source.indexOf('with target as ('),end=source.indexOf('  select\n    s.live_runner_id',start);
 if(start<0||end<start)throw Error('LEGACY_QUERY_BOUNDARY');
 let sql=source.slice(start,end)+'SELECT s.*, round(s.score::numeric,2) AS legacy_score FROM scored s';
 if(cohorts){
  const a=sql.indexOf('  trans as ('),b=sql.indexOf('  comps as (',a);
  if(a<0||b<a)throw Error('COHORT_CTE_BOUNDARY');
  sql=sql.slice(0,a)+`  trans as (select live_runner_id,n,wins,top3s from pg_temp.replay_transition_cohorts),
  jockey_stats as (select live_runner_id,n,wins,top3s from pg_temp.replay_jockey_cohorts),
`+sql.slice(b);
 }
 for(const name of ['jra_live_runners','jra_live_races','jra_transition_daily_stats','jra_jockey_daily_stats'])sql=sql.replaceAll('public.'+name,'pg_temp.'+name);
 if(/\b(?:insert|update|delete|truncate|create|alter|drop|copy|execute|call|do)\b|public\.|private\.|;/i.test(sql))throw Error('NOT_ISOLATED_SELECT');
 return sql;
}
const validDate=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
export function validateLegacyReplayInput(input){
 if(input?.scope!=='POSTHOC_RECONSTRUCTION_NOT_OFFICIAL_EVIDENCE'||!Array.isArray(input.rows)||!input.rows.length)throw Error('RECONSTRUCTION_SCOPE_REQUIRED');
 const seen=new Set();for(const r of input.rows){
  if(Object.keys(r).some(k=>/odds|popularity|market|target_result|finishers|frozen_runner/i.test(k)))throw Error('TARGET_OR_MARKET_INPUT');
  if(!validDate(r.race_date)||!r.live_runner_id||!r.live_race_id||!Number.isInteger(r.horse_no)||r.horse_no<1||r.horse_no>24||r.card_horse_ref!==r.live_horse_ref||!r.live_horse_ref)throw Error('IDENTITY_OR_RACE');
  const k=r.live_race_id+'/'+r.horse_no;if(seen.has(k))throw Error('DUPLICATE_RUNNER');seen.add(k);
  if(!Number.isFinite(Date.parse(r.post_time))||!Number.isFinite(Date.parse(r.source_checked_at))||!Number.isFinite(Date.parse(r.updated_at))||Date.parse(r.source_checked_at)>=Date.parse(r.post_time)||Date.parse(r.updated_at)>=Date.parse(r.post_time))throw Error('SOURCE_TIME_NOT_PRESTART');
  if(!Array.isArray(r.past_runs)||r.past_runs.length>5)throw Error('HISTORY_SHAPE');
  for(const h of r.past_runs){
   if(!validDate(h.race_date)||h.race_date>=r.race_date)throw Error('NON_PRIOR_HISTORY');
   if(h.finish!==null&&(!Number.isInteger(h.finish)||h.finish<1))throw Error('INVALID_FINISH');
   // Missing field_size remains NULL: recovered SQL cannot score that run.
   if(h.field_size!==null&&(!Number.isInteger(h.field_size)||h.field_size<2||h.finish!==null&&h.finish>h.field_size))throw Error('INVALID_FINISH');
   if(h.margin_to_winner!==null&&(typeof h.margin_to_winner!=='number'||!Number.isFinite(h.margin_to_winner)||h.margin_to_winner<0))throw Error('MARGIN_INVALID');
   if(Object.keys(h).some(k=>/odds|popularity|market|raw|result|label/i.test(k)))throw Error('UNSCOPED_MARKET_OR_RESULT');
  }
 }
 return {status:'RECONSTRUCTION_VALIDATED_ONLY',runners:input.rows.length,production_allowed:false,official_evidence_verified:false};
}

// Date-filtered sums returned by the existing DB tables are reconstruction data,
// not signed official evidence. Exact daily sum was executed read-only outside CI.
export function validateReplayCohorts(packet,input){
 if(packet?.scope!=='DB_ASOF_DATE_COHORT_RECONSTRUCTION_NOT_ORIGINAL_FORECAST_EVIDENCE')throw Error('COHORT_SCOPE');
 for(const kind of ['transition','jockey']){
  if(!Array.isArray(packet[kind]))throw Error('COHORT_ARRAY');const seen=new Set();
  for(const row of packet[kind]){
   const runner=input.rows.find(r=>r.live_runner_id===row.live_runner_id);
   if(!runner||seen.has(row.live_runner_id))throw Error('COHORT_RUNNER');seen.add(row.live_runner_id);
   if(!validDate(row.first_date)||!validDate(row.last_date)||row.first_date>row.last_date||row.last_date>=runner.race_date)throw Error('COHORT_ASOF');
   if([row.n,row.wins,row.top3s].some(v=>!Number.isSafeInteger(v)||v<0)||row.n<=0||row.wins>row.top3s||row.top3s>row.n)throw Error('COHORT_COUNTS');
  }
 }
 return {production_allowed:false,official_evidence_verified:false};
}
