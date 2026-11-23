// READ-ONLY RESEARCH: deterministic, zero-point factual pre-race matrix.
// Combines captured target conditions, independent BASE_CORE, and as-of past
// runs. NO point weights, official source receipts or actual CLAIM authority.
// Never promote fact fingerprints to verified original run IDs.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('RESEARCH_PRERACE_FACT_MATRIX_'+x)};
const iso=x=>{if(typeof x!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/.test(x))fail('BAD_LOCAL_TIME');const v=Date.parse(x.slice(0,19)+'+09:00');if(!Number.isFinite(v))fail('BAD_LOCAL_TIME');return v};
const date=x=>{if(typeof x!=='string'||!/^20\d\d-\d\d-\d\d$/.test(x)||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x)fail('BAD_DATE');return Date.parse(x+'T00:00:00Z')};
const nt=(a,b)=>a<b?-1:a>b?1:0;
const norm=x=>typeof x==='string'?x.normalize('NFKC').trim():null;
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const integer=x=>Number.isSafeInteger(x)?x:null;
const ordered=x=>x.slice().sort((a,b)=>nt(JSON.stringify(a),JSON.stringify(b)));
const label=(r)=>r.track+'|'+r.race_no;
function factsOfPrior(run,target,targetDate){
  const days=run.prior_date?Math.round((date(targetDate)-date(run.prior_date))/86400000):null;
  if(days!==null&&days<=0)fail('POST_RACE_HISTORY_LEAK');
  const corners=Array.isArray(run.live_corner_positions)&&
    run.live_corner_positions.length>=2&&run.live_corner_positions.every(x=>integer(x)!==null&&x>0)?
    run.live_corner_positions.slice():null;
  const f={
    past_date:run.prior_date??null,rest_days:days,
    prior_track:norm(run.prior_track),prior_class:norm(run.prior_class),
    prior_surface:norm(run.prior_surface),prior_distance:integer(run.prior_distance),
    prior_going:norm(run.live_going)??norm(run.race_going),
    finish:integer(run.finish),field_size:integer(run.field_size),
    winner_margin_seconds:num(run.margin_to_winner),
    final_3f_seconds:num(run.final3f),
    prior_corners:corners,
    early_position:corners?.[0]??integer(run.early_pos),
    final_turn_position:corners?.at(-1)??(run.live_final_turn_pos&&/^\d+$/.test(run.live_final_turn_pos)?Number(run.live_final_turn_pos):null),
    archive_detail_claimed:run.detail_available===true,
    raw_history_match_count:integer(run.raw_history_match_count),
    source_kind:run.source_kind??null,
    surface_match:run.prior_surface&&target.surface?norm(run.prior_surface)===norm(target.surface):null,
    track_match:run.prior_track&&target.track?norm(run.prior_track)===norm(target.track):null,
    distance_change_metres:integer(run.prior_distance)!==null&&integer(target.distance)!==null?
       target.distance-run.prior_distance:null,
    // Cross-distance 3f comparisons and pace points require an approved
    // context model. Do not infer a fact or weight from the raw values.
    pace_adjustment_points:null,opponent_followon_points:null,
    effect_points:null,
  };
  if(f.field_size!==null&&(f.field_size<1||f.field_size>30))fail('FIELD_SIZE_INVALID');
  if(f.winner_margin_seconds!==null&&f.winner_margin_seconds < -30)fail('MARGIN_INVALID');
  return f;
}
export function buildPreRaceFactualMatrix({baseSnapshot,sourceSnapshots,targetSnapshot}={}){
  const b=baseSnapshot,t=targetSnapshot,ss=sourceSnapshots;
  if(b?.classification!=='PRE_RACE_READONLY_BASE_CORE_OBSERVATION_NOT_FROZEN_NOT_FULL_100_POINT_GENERATOR'||
    t?.classification!=='READ_ONLY_PRE_RACE_TARGET_CONDITIONS_NOT_OFFICIAL_ORIGINAL_SIGNED'||
    !Array.isArray(ss)||ss.length!==2||b?.race_count!==23||t?.race_count!==23)
    fail('UNSUPPORTED_INPUT_SNAPSHOTS');
  const sourceMap=new Map();
  for(const s of ss) {
    if(s.classification!=='READONLY_PREPOST_HISTORICAL_FACTS_NOT_SIGNED_OFFICIAL_OR_CLAIM_CONTEXT'||
       !Array.isArray(s.races)||!s.captured_at_jst)fail('HISTORICAL_SNAPSHOT_INVALID');
    for(const r of s.races) {
      const id=label(r);if(sourceMap.has(id))fail('DUPLICATE_HISTORY_RACE');
      sourceMap.set(id,{race:r,capturedAt:iso(s.captured_at_jst)});
    }
  }
  const targetMap=new Map(t.races.map(r=>[label(r),r]));
  if(targetMap.size!==23||sourceMap.size!==23||new Set(b.races.map(label)).size!==23)
    fail('RACE_COVERAGE_MISSING');
  const rows=[];let runs=0,ranked=0,unsupported=0;
  for(const bRace of b.races.slice().sort((a,b)=>nt(label(a),label(b)))) {
    const id=label(bRace),entry=sourceMap.get(id),targetRow=targetMap.get(id);
    if(!entry||!targetRow)fail('RACE_NOT_IN_ALL_THREE_SNAPSHOTS');
    const conditions=targetRow.race_conditions;
    if(!conditions||conditions.cname!==undefined&&!conditions.cname||
      !integer(conditions.distance)||!norm(conditions.surface))fail('TARGET_CONDITIONS_INCOMPLETE');
    const post=iso(targetRow.post_at_jst);
    if(post<=Math.max(iso(b.captured_at_jst),iso(t.captured_at_jst),entry.capturedAt))
      fail('SOURCE_CAPTURE_AFTER_POST');
    if(targetRow.race_date!=='2026-11-23'||bRace.race_date!==targetRow.race_date)
      fail('RACE_DATE_MISMATCH');
    const hRace=entry.race;
    if(hRace.horses?.length!==bRace.runners?.length)fail('FIELD_SIZE_DRIFT');
    const baseline=new Map(bRace.runners.map(h=>[h.horse_no,h]));
    const roster=new Set();
    const target={race_date:bRace.race_date,track:bRace.track,
      race_no:bRace.race_no,surface:norm(conditions.surface),
      distance:conditions.distance,going:norm(conditions.going),race_class:norm(conditions.class_name)};
    for(const horse of hRace.horses){
      const bHorse=baseline.get(horse.horse_no);
      if(!bHorse||bHorse.horse_name!==horse.horse_name||roster.has(horse.horse_no))
        fail('ROSTER_IDENTITY_DRIFT');
      roster.add(horse.horse_no);
      if(!Array.isArray(horse.history))fail('PAST_HISTORY_MISSING');
      const features=ordered(horse.history.map(run=>factsOfPrior(run,target,bRace.race_date)));
      runs+=features.length;
      const isRanked=bHorse.data_status==='RANKED';
      if(!isRanked&&bHorse.data_status!=='UNSUPPORTED_SEGMENT')fail('UNKNOWN_BASE_RANK_STATUS');
      if(isRanked)ranked++;else unsupported++;
      const feature={race_key:id,horse_no:horse.horse_no,horse_name:horse.horse_name,
        baseline_model:bHorse.model_version,baseline_status:bHorse.data_status,
        baseline_rank:isRanked?bHorse.base_rank:null,
        baseline_rate:isRanked?bHorse.base_rate:null,
        target,history_observations:features,
        history_observation_count:features.length,
        observation_hash:hash({target,horse_no:horse.horse_no,horse_name:horse.horse_name,features}),
        actual_run_original_sha256_available:false,
        authentic_original_run_id_available:false,
        authorized_claim_context_bound:false,
        submitted_evidence_points:null,
        formal_100pt_score:null,
        certified_rank:null,eye_audit_complete:false};
      rows.push(feature);
    }
  }
  if(rows.length!==345||runs!==995||ranked!==302||unsupported!==43)
    fail('FULL_FIELD_COUNTS_DRIFT');
  const canonical=rows.slice().sort((a,b)=>nt(a.race_key,b.race_key)||a.horse_no-b.horse_no);
  return {classification:'UNSIGNED_READONLY_FACT_MATRIX_NO_NUMERIC_POLICY',date:'2026-11-23',
    races:23,horses:rows.length,historical_run_observations:runs,
    ranked_baseline_horses:ranked,unsupported_baseline_horses:unsupported,
    input_receipts:{baseline_sha256:hash(b),conditions_sha256:hash(t),
      source_snapshots_sha256:ss.map(s=>hash(s)).sort()},
    fact_matrix_sha256:hash(canonical),
    scorer_policy_sha256:null,original_historic_run_issuer_verified:false,
    full_factor_coverage:false,formal_scoring_allowed:false,
    production_allowed:false,rows:canonical};
}
