/**
 * JRA whole-field pre-FROZEN historic-source gate (RESEARCH, READ ONLY).
 *
 * The current jra_live_runners rows are mutable and source_checked_at is the
 * last reported fetch. Their historic result URLs have NOT been independently
 * re-fetched. This gate only determines if the *current observed copy* is
 * timestamp-compatible with an actual official FROZEN boundary.
 * Never certify production pre-CLAIM evidence from it.
 *
 * The full official runner identity (number/name/horse URL) must agree. If
 * any one runner was last checked after FROZEN, reject the ENTIRE field.
 * It strips odds, popularity, raw HTML and target results from the output.
 */
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'));
const ms=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const num=(x,l,h)=>Number.isInteger(x)&&x>=l&&x<=h;
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const sourceUrl=x=>typeof x==='string'&&
 /^\/JRADB\/accessS\.html\?CNAME=pw[A-Za-z0-9/]{10,100}$/.test(x);
const stop=(status,more={})=>({status,source_scope:'MUTABLE_JRA_LIVE_ROW_LAST_CHECK_NOT_SEALED',
 certified:false,eligible_for_official_metrics:false,
 rank_effect:false,production_rank_changed:false,frozen_modified:false,
 market_used:false,target_result_used:false,...more});
export function auditJraFrozenAsOfHistory({
 race,officialRunners,liveRunners
}={}){
 const frozen=ms(race?.frozen_at),post=ms(race?.post_time);
 if(race?.circuit!=='JRA'||!day(race?.race_date)||
    !num(race?.race_no,1,12)||!norm(race?.track)||
    !Number.isFinite(frozen)||!Number.isFinite(post)||frozen>=post||
    !race?.official_proof||race.official_proof.verified!==true||
    !/^[a-f0-9]{64}$/.test(race.official_proof.html_sha256??''))
   return stop('OFFICIAL_RACE_OR_FROZEN_GATE_UNVERIFIED');
 if(!Array.isArray(officialRunners)||officialRunners.length<6||
    officialRunners.length>20||!Array.isArray(liveRunners)||
    liveRunners.length!==officialRunners.length)
   return stop('WHOLE_FIELD_UNAVAILABLE');
 const official=new Map(),live=new Map();
 for(const h of officialRunners){
  if(!num(h?.horse_no,1,24)||!norm(h.horse_name)||
     typeof h.horse_ref!=='string'||!h.horse_ref.startsWith('/JRADB/accessU.html?CNAME=')||
     h.status!=='ACTIVE'||official.has(h.horse_no))
   return stop('OFFICIAL_ROSTER_NOT_EXACT');
  official.set(h.horse_no,h);
 }
 for(const h of liveRunners){
  const expected=official.get(h?.horse_no);
  if(!expected||live.has(h.horse_no)||norm(expected.horse_name)!==norm(h.horse_name)||
     expected.horse_ref!==h.horse_ref||!Array.isArray(h.past_runs)||
     h.past_runs.length>30)
   return stop('LIVE_HORSE_IDENTITY_OR_HISTORY_MISMATCH');
  const checked=ms(h.source_checked_at);
  if(!Number.isFinite(checked)||checked>frozen||checked>=post)
   return stop('LIVE_RUNNER_NOT_LAST_CHECKED_BEFORE_FROZEN',{
    rejected_horse_no:h.horse_no});
  live.set(h.horse_no,h);
 }
 if(live.size!==official.size)return stop('WHOLE_FIELD_MISSING');
 let withPrior=0,cornerRuns=0,closingRuns=0,pastUrls=0,missingUrls=0;
 const runners=[...official].sort((a,b)=>a[0]-b[0]).map(([no,h])=>{
  const saved=live.get(no);
  const cleanHistory=[];
  const seen=new Set();
  for(const p of saved.past_runs){
   if(!day(p?.race_date)||p.race_date>=race.race_date||
      typeof p.track!=='string'||!norm(p.track)||
      !num(p.distance,800,3600)||!['芝','ダート'].includes(p.surface))
    continue;
   const key=[p.race_date,p.track,p.distance,p.surface,p.horse_no??''].join('|');
   if(seen.has(key))continue;seen.add(key);
   const priorSource=sourceUrl(p.source_ref);
   if(priorSource)pastUrls++;else missingUrls++;
   const corners=priorSource&&Array.isArray(p.corner_positions)&&
    p.corner_positions.length>=1&&p.corner_positions.length<=4&&
    p.corner_positions.every(v=>num(v,1,num(p.field_size,1,24)?p.field_size:24))&&
    (p.early_pos==null||p.corner_positions[0]===p.early_pos)&&
    (p.final_turn_pos==null||p.corner_positions.at(-1)===p.final_turn_pos)
    ?[...p.corner_positions]:[];
   const last3f=priorSource&&typeof p.final3f==='number'&&
    p.final3f>=25&&p.final3f<=65?p.final3f:null;
   if(corners.length)cornerRuns++;
   if(last3f!==null)closingRuns++;
   cleanHistory.push({
    race_date:p.race_date,track:p.track,surface:p.surface,
    distance:p.distance,finish:num(p.finish,1,24)?p.finish:null,
    early_pos:corners.length?corners[0]:null,
    final_turn_pos:corners.length?corners.at(-1):null,
    corner_positions:corners,final3f:last3f,
    historic_result_ref:priorSource?p.source_ref:null,
    source_status:priorSource?
     'RECORDED_JRA_HISTORIC_RESULT_URL_NOT_REFETCHED':'NO_VERIFIED_HISTORIC_URL',
    true_loss_cause:'UNPROVEN'
   });
  }
  if(cleanHistory.length)withPrior++;
  return {horse_no:no,horse_name:h.horse_name,
   source_checked_at:saved.source_checked_at,
   prior_runs:cleanHistory};
 });
 return stop('WHOLE_FIELD_LAST_CHECK_PRE_FROZEN_NOT_CERTIFIED',{
  race:{race_date:race.race_date,track:race.track,race_no:race.race_no},
  roster_count:runners.length,
  runners_with_prior_history:withPrior,
  prior_corner_runs_with_recorded_url:cornerRuns,
  prior_last3f_runs_with_recorded_url:closingRuns,
  prior_runs_with_recorded_url:pastUrls,
  prior_runs_without_recorded_url:missingUrls,
  runner_history:runners
 });
}
