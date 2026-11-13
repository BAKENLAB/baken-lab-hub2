/**
 * BAKEN LAB — Eval Sign private-snapshot × OWN JRA course-transfer evidence.
 * Public source contains NO licensed/proprietary Eval numbers or rows.
 * Caller injects an approved private snapshot. No RPC, CLAIM, odds or save.
 *
 * A historical podium is the PRIMARY evidence. Course correlation can
 * annotate that existing run, never become an independent extra run.
 * A bounded one-point 100pt scoring assist is allowed only when the user's
 * Eval S/A direction agrees with JRA's own 2023-25 HIGH/MEDIUM n>=120
 * transfer cohort. This is not probability or a multiplied win rate.
 */
const JRA=new Set(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']);
const dateOk=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'));
const time=s=>typeof s==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(s)?
 Date.parse(s):NaN;
const dayAge=(date,prior)=>(Date.parse(date+'T00:00:00Z')-
 Date.parse(prior+'T00:00:00Z'))/86400000;
const no=x=>Number.isInteger(x)&&x>=1&&x<=24;
const norm=x=>String(x??'').normalize('NFKC').trim();
const surf=x=>x==='芝'?'芝':x==='ダート'?'ダート':null;
const K=(a,b,c,d)=>JSON.stringify([a,b,c??'',d]);
const fail=(reason,more={})=>({
 status:'EVAL_TRANSFER_UNAVAILABLE',reason,score_effect:0,
 market_used:false,target_result_used:false,snapshot_republished:false,...more
});
/**
 * Private snapshot shape:
 * {v,targets:[[track,surface,variant,distance]],sources:[[...]],
 *  pairs:[[target_idx,source_idx,tier_rank_1_to_5,multiplier_x100]]}
 * The ratio is a descriptive historical association, NEVER a win-odds
 * multiplier and NEVER directly used in ability points.
 */
function verifiedSnapshot(s){
 if(!s||s.v!=='2026-11-13'||!Array.isArray(s.targets)||
    !Array.isArray(s.sources)||!Array.isArray(s.pairs)||
    s.targets.length!==82||s.sources.length>120||
    s.pairs.length!==246||s.scope!=='NORMAL_TOP3_ONLY')return null;
 const targetKeys=new Map(),sourceKeys=new Map();
 const init=(arr,store)=>{
  for(let i=0;i<arr.length;i++){
   const [t,sw,varn,d]=arr[i];
   if(!JRA.has(t)||!surf(sw)||typeof varn!=='string'||
     !Number.isInteger(d)||d<1000||d>3600)return false;
   const key=K(t,sw,varn,d);
   if(store.has(key))return false;
   store.set(key,i);
  }
  return true;
 };
 if(!init(s.targets,targetKeys)||!init(s.sources,sourceKeys))return null;
 const pairs=new Map();
 for(const p of s.pairs){
  const [a,b,tier,ratio]=p;
  if(!Number.isInteger(a)||a<0||a>=s.targets.length||
     !Number.isInteger(b)||b<0||b>=s.sources.length||
     !Number.isInteger(tier)||tier<1||tier>5||
     !Number.isInteger(ratio)||ratio<20||ratio>400)return null;
  const k=a+'|'+b;if(pairs.has(k))return null;
  pairs.set(k,{tier,ratio});
 }
 const resolve=(rows,t,sw,d,variant)=>{
  const candidates=[];
  for(let i=0;i<rows.length;i++)if(rows[i][0]===t&&rows[i][1]===sw&&rows[i][3]===d)
   candidates.push(i);
  // Multiple inner/out JRA variants are NOT inferred from distance alone.
  if(candidates.length===1)return candidates[0];
  if(candidates.length>1&&variant)return candidates.find(i=>rows[i][2]===variant)??null;
  return null;
 };
 return {targetKeys,sourceKeys,pairs,resolve};
}
const validStat=x=>x&&typeof x==='object'&&
 ['HIGH','MEDIUM'].includes(x.reliability)&&
 Number(x.runners)>=120&&Number(x.top3_lift)>=1.08&&
 x.condition_precision==='COARSE_NO_INNER_OUTER'&&
 String(x.training_to)==='2025-12-31';
const turn=t=>['新潟','東京','中京'].includes(t)?'左':'右';
export function buildEvalTransferForJraClaim({
 context,snapshot,ownedTransferStats=[],observedAt
}={}){
 const race=context?.race,rc=race?.field_payload?.race??{};
 const date=race?.race_date,when=time(observedAt),post=time(race?.post_time);
 if(!JRA.has(race?.track)||!dateOk(date)||!Number.isFinite(post)||
    !Number.isFinite(when)||when>=post||date!==new Date(when+9*3600000).toISOString().slice(0,10)||
    !surf(rc.surface)||!Number.isInteger(Number(rc.distance))||
    rc.race_type==='障害'||context?.stage!=='AWAITING_JRA_FULL_DEPTH_COMPARISON')
  return fail('JRA_OFFICIAL_CLAIM_ASOF_NOT_VERIFIED');
 const validated=verifiedSnapshot(snapshot);
 if(!validated)return fail('PRIVATE_EVAL_SNAPSHOT_NOT_VALIDATED');
 // Snapshot was collected after 2026-11-13 races. It must NEVER be
 // presented as contemporaneous evidence for a race on/before that date.
 if(date<=snapshot.v)return fail('EVAL_SNAPSHOT_NOT_AVAILABLE_ASOF_TARGET_RACE');
 const tid=validated.resolve(snapshot.targets,race.track,rc.surface,
  Number(rc.distance),norm(rc.course_layout));
 if(tid===null)return fail('EVAL_TARGET_NOT_IN_82_NORMAL_COURSES');
 const history=context.runner_history;
 if(!Array.isArray(history)||history.length<6||history.length>24)
  return fail('COMPLETE_JRA_HISTORY_FIELD_UNAVAILABLE');
 const seen=new Set(),stats=new Map();
 if(!Array.isArray(ownedTransferStats)||ownedTransferStats.length>200)return fail('INTERNAL_STATS_UNVERIFIED');
 for(const st of ownedTransferStats){
  if(typeof st.source_course_key==='string'&&typeof st.target_course_key==='string'&&
     st.target_course_key===K_INTERNAL(race.track,rc.surface,rc.distance)){
   stats.set(st.source_course_key,st);
  }
 }
 const evidence=[];
 for(const horse of history){
  if(!no(horse?.horse_no)||!norm(horse?.horse_name)||seen.has(horse.horse_no)||
     !Array.isArray(horse.past_runs)||horse.past_runs.length>6)
   return fail('OFFICIAL_RUNNER_IDENTITY_OR_HISTORY_INCOMPLETE');
  seen.add(horse.horse_no);
  const matches=[],used=new Set();
  for(let i=0;i<horse.past_runs.length;i++){
   const run=horse.past_runs[i];
   if(!dateOk(run?.race_date)||run.race_date>=date||!JRA.has(run.track)||
      !surf(run.surface)||!Number.isInteger(Number(run.distance)))continue;
   const age=dayAge(date,run.race_date);
   if(age<0||age>540||!Number.isInteger(Number(run.finish))||
      Number(run.finish)<1||Number(run.finish)>3)continue;
   const runId=run.race_date+'|'+run.track+'|'+run.surface+'|'+run.distance;
   if(used.has(runId))continue;used.add(runId);
   const sid=validated.resolve(snapshot.sources,run.track,run.surface,
    Number(run.distance),norm(run.course_layout));
   if(sid===null)continue;
   const relation=validated.pairs.get(tid+'|'+sid);
   if(!relation)continue;
   const sourceKey=K_INTERNAL(run.track,run.surface,run.distance);
   const stat=stats.get(sourceKey);
   const credible=relation.tier>=4&&age<=365&&
     run.surface===rc.surface&&validStat(stat);
   matches.push({
    verified_run_ref:`JRA_CLAIMED_CONTEXT.runner_history[horse_no=${horse.horse_no}].past_runs[${i}]`,
    prior_date:run.race_date,prior_track:run.track,
    prior_surface:run.surface,prior_distance:Number(run.distance),
    prior_finish:Number(run.finish),
    prior_early_pos:Number.isInteger(Number(run.early_pos))?
     Number(run.early_pos):null,
    prior_winner_margin_seconds:run.margin_to_winner!==null&&
     Number.isFinite(Number(run.margin_to_winner))?
     Number(run.margin_to_winner):null,
    prior_class:typeof run.race_class==='string'?run.race_class:null,
    eval_tier:({5:'S',4:'A',3:'B',2:'C',1:'E'})[relation.tier],
    internal_stats_reliability:stat?.reliability??'NOT_MATCHED',
    internal_stats_n:stat?Number(stat.runners):null,
    source_period_ended:'2025-12-31',
    direction_corrobated:credible,
    // No raw Eval ratio or data table is emitted.
    agreement:credible?'EVAL_S_A_AND_INTERNAL_RELIABLE_POSITIVE':
     'CORRELATION_NOT_VALIDATED_FOR_100PT',
    review:'EXISTING_PRIOR_RUN_SAME_EVIDENCE_NOT_NEW_INDEPENDENT_FACTOR'
   });
  }
  matches.sort((a,b)=>Number(b.direction_corrobated)-Number(a.direction_corrobated)||
   b.prior_date.localeCompare(a.prior_date));
  const supported=matches.some(x=>x.direction_corrobated);
  evidence.push({horse_no:horse.horse_no,horse_name:horse.horse_name,
   matched_verified_prior_runs:matches.length,
   confirmed_supporting_run_refs:matches.filter(x=>x.direction_corrobated)
    .map(x=>x.verified_run_ref),
   // +1 is a bounded reviewer budget recommendation, not a second podium bonus.
   optional_course_fit_budget_points:supported?1:0,
   should_review_100pt_against_entire_field:supported,
   best_evidence:matches[0]??null,
   no_negative_penalty_for_missing_history:true
  });
 }
 return {status:'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW',
  source:'USER_SUPPLIED_EVAL_SNAPSHOT_PRIVATE_PLUS_OWN_JRA_2023_25_STATS',
  snapshot_date:'2026-11-13',eval_rows_screened:2141,
  eval_normal_rows:1942,eval_prioritized_rows:246,
  eval_reference_rows_excluded:199,
  eval_remaining_normal_rows_not_loaded:1696,
  target_course:jraSafeCourse(race.track,rc.surface,rc.distance),
  field_count:evidence.length,runners:evidence,
  score_budget_max_per_horse:1,
  score_budget_is_calibrated_probability:false,
  course_fit_is_additional_independent_run:false,
  availability:'JRA_FLAT_ONLY_NO_LOCAL_TARGET_COURSES',
  out_of_sample_policy:'NO_BACKTEST_ON_2026-11-13_SNAPSHOT_AS_IF_OLDER',
  licensed_public_redistribution_verified:false,
  raw_data_in_response:false,market_used:false,target_result_used:false,
  authorized_to_save:false,frozen_modified:false};
}
const K_INTERNAL=(t,s,d)=>t+'|'+s+'|'+String(d)+'|'+turn(t);
const jraSafeCourse=(t,s,d)=>({track:t,surface:s,distance:Number(d)});
