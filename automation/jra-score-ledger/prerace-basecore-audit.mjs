// Research-only, source-backed pre-race BASE_CORE observation auditor.
// Snapshot source: public.jra_live_base_candidate_v1 read BEFORE first start.
// This is NOT a fixed 100-point scorer, official issuer proof or save gate.
import {createHash} from 'node:crypto';
const text=x=>typeof x==='string'&&x.trim().length>0;
const int=x=>Number.isSafeInteger(x);
const fail=reason=>({ok:false,reason,formal_scoring_allowed:false,production_allowed:false});
const utcJst=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/.test(s)?
 Date.parse(s.slice(0,19)+'+09:00'):NaN;
const id=x=>x.track+'|'+x.race_no;
export function inspectPreRaceBaseCoreSnapshot(snapshot){
 if(snapshot?.classification!=='PRE_RACE_READONLY_BASE_CORE_OBSERVATION_NOT_FROZEN_NOT_FULL_100_POINT_GENERATOR'||
   !Array.isArray(snapshot.races)||!snapshot.races.length||
   !int(snapshot.horse_count)||!int(snapshot.race_count)||
   !text(snapshot.captured_at_jst)||!Number.isFinite(utcJst(snapshot.captured_at_jst)))
   return fail('SNAPSHOT_ENVELOPE_INVALID');
 if(snapshot.race_count!==snapshot.races.length||
   new Set(snapshot.races.map(id)).size!==snapshot.races.length)
   return fail('SNAPSHOT_RACE_DUPLICATED_OR_MISSING');
 const captured=utcJst(snapshot.captured_at_jst);
 let totalHorses=0,rankedHorses=0,unsupportedHorses=0,rankedRaces=0,unsupportedRaces=0;
 for(const race of snapshot.races){
   if(race.race_date!=='2026-11-23'||
    !['東京','福島'].includes(race.track)||!int(race.race_no)||
    race.race_no<1||race.race_no>12||!Array.isArray(race.runners)||
    !race.runners.length||race.runners.length>24)
    return fail('RACE_SCOPE_OR_FIELD_INVALID');
   const post=utcJst(race.post_at_jst);
   if(!Number.isFinite(post)||post<=captured)return fail('POST_TIME_NOT_AFTER_SNAPSHOT');
   totalHorses+=race.runners.length;
   const runnerNos=race.runners.map(r=>r.horse_no);
   if(runnerNos.some(n=>!int(n)||n<1||n>24)||new Set(runnerNos).size!==runnerNos.length)
    return fail('HORSE_NO_DUPLICATED');
   const ranked=race.runners.filter(r=>r.data_status==='RANKED');
   const unsupported=race.runners.filter(r=>r.data_status==='UNSUPPORTED_SEGMENT');
   if(ranked.length>0 && unsupported.length>0 || ranked.length+unsupported.length!==race.runners.length)
    return fail('UNSUPPORTED_FIELD_MIXED_OR_UNRECOGNIZED');
   if(ranked.length){
    rankedHorses+=ranked.length;rankedRaces++;
    const ranks=ranked.map(r=>r.base_rank).sort((a,b)=>a-b);
    if(ranks.some((x,i)=>x!==i+1)||ranked.some(r=>
     !text(r.horse_name)||r.model_version!=='JRA_BASE_CORE_0.1_AB'||
     !text(r.base_rate)||!/^(0|1)(?:\.\d+)?$/.test(r.base_rate)||
     Number(r.base_rate)<0||Number(r.base_rate)>1))
      return fail('BASE_CORE_RANK_OR_RATE_INVALID');
   } else {
    unsupportedHorses+=unsupported.length;unsupportedRaces++;
    if(unsupported.some(r=>r.base_rate!==null||r.base_rank!==null))
      return fail('UNSUPPORTED_SEGMENT_FABRICATED_RANK');
   }
 }
 if(totalHorses!==snapshot.horse_count)return fail('RUNNER_COUNT_MISMATCH');
 const snapshotSha256=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 return {ok:true,reason:'PRE_RACE_BASE_CORE_OBSERVATION_ONLY',
  race_count:snapshot.race_count,horse_count:totalHorses,
  ranked_races:rankedRaces,unsupported_races:unsupportedRaces,
  ranked_horses:rankedHorses,unsupported_horses:unsupportedHorses,
  observation_sha256:snapshotSha256,issuer_authenticated:false,
  same_claim_input_at_freeze_proven:false,formal_scoring_allowed:false,
  production_allowed:false};
}
export function compareFrozenToPreRaceBaseCore({snapshot,track,race_no,payload}={}){
 const verified=inspectPreRaceBaseCoreSnapshot(snapshot);
 if(!verified.ok)return fail('BASE_CORE_SNAPSHOT_UNUSABLE_'+verified.reason);
 const race=snapshot.races.find(r=>r.track===track&&r.race_no===race_no);
 if(!race)return fail('RACE_NOT_IN_EARLY_SNAPSHOT');
 if(race.runners.every(r=>r.data_status==='UNSUPPORTED_SEGMENT'))
  return fail('BASE_CORE_UNSUPPORTED_SEGMENT');
 const runners=payload?.runners;
 if(!Array.isArray(runners)||runners.length!==race.runners.length||
    !runners.every(r=>int(r.horse_no)&&int(r.rank)&&int(r.score)&&r.score>=0&&r.score<=100))
   return fail('FROZEN_FIELD_COUNT_OR_SCORE_INVALID');
 const ids=runners.map(r=>r.horse_no),ranks=runners.map(r=>r.rank).sort((a,b)=>a-b);
 if(new Set(ids).size!==ids.length||ranks.some((r,i)=>r!==i+1))
  return fail('FROZEN_RANK_OR_HORSE_DUPLICATED');
 const base=new Map(race.runners.map(r=>[r.horse_no,r]));
 if(runners.some(r=>!base.has(r.horse_no)||base.get(r.horse_no).horse_name!==r.horse_name))
  return fail('FROZEN_HORSE_IDENTITY_DRIFT');
 const differences=runners.filter(r=>base.get(r.horse_no).base_rank!==r.rank)
  .map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
    base_rank:base.get(r.horse_no).base_rank,submitted_rank:r.rank,
    rank_delta:base.get(r.horse_no).base_rank-r.rank}));
 return {ok:true,reason:'RANK_DIFFERENCES_ONLY_NOT_SCORE_PROOF',
   basecore_snapshot_sha256:verified.observation_sha256,
   field_count:runners.length,changed_runners:differences.length,differences,
   original_claim_context_identical_to_early_snapshot_unverified:true,
   actual_score_policy_verified:false,
   manual_rank_changes_verified:false,
   official_original_verified:false,production_allowed:false,
   formal_scoring_allowed:false};
}
