/**
 * BAKEN LAB — Eval Sign private-snapshot × OWN JRA course-transfer evidence.
 * Public source contains NO licensed/proprietary Eval numbers or rows.
 * Caller injects an approved private snapshot. No RPC, CLAIM, odds or save.
 *
 * A historical podium is the PRIMARY evidence. Course correlation can
 * annotate that existing run, never become an independent extra run.
 * A bounded one-point 100pt scoring review is allowed when Eval S/A
 * direction agrees with JRA's own 2023-25 HIGH/MEDIUM n>=120
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
 * User-supplied private, rank-only Eval snapshot. No historical rate, market
 * edge or source URL is shipped into the public repo or output.
 * Exactly all 1,942 NORMAL rows across 82 JRA target courses are indexed;
 * 199 REF rows across 14 unsupported targets are never admitted.
 *
 * {v,observed_at,scope:'NORMAL_ALL_1942',targets:[...],sources:[...],
 *  pairs:[[target_index,source_index,tier_1_to_5,rank_1_to_39],...]}
 */
const variant=x=>{
 const s=norm(x).toUpperCase();
 if(['OUTER','外','外回り'].includes(s))return '外';
 if(['INNER','内','内回り'].includes(s))return '内';
 if(['STRAIGHT','直','直線'].includes(s))return '直';
 return s===''?'':s;
};
function verifiedSnapshot(s){
 if(!s||s.v!=='2026-11-13'||
    s.scope!=='NORMAL_ALL_1942'||
    s.observed_at!=='2026-11-13T21:30:21Z'||
    !Array.isArray(s.targets)||!Array.isArray(s.sources)||
    !Array.isArray(s.pairs)||s.targets.length!==82||
    s.sources.length!==94||s.pairs.length!==1942)return null;
 const targetKeys=new Map(),sourceKeys=new Map();
 const init=(rows,keys)=>{
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   if(!Array.isArray(row)||row.length!==4) return false;
   const [t,sw,varn,d]=row;
   if(!JRA.has(t)||!surf(sw)||typeof varn!=='string'||
      !['','内','外','直'].includes(varn)||
      !Number.isInteger(d)||d<1000||d>3600)return false;
   const key=K(t,sw,varn,d);
   if(keys.has(key))return false;
   keys.set(key,i);
  }
  return true;
 };
 if(!init(s.targets,targetKeys)||!init(s.sources,sourceKeys))return null;
 const pairs=new Map(),ranks=new Map();
 for(const p of s.pairs){
  if(!Array.isArray(p)||p.length!==4)return null;
  const [a,b,tier,rank]=p;
  if(!Number.isInteger(a)||a<0||a>=s.targets.length||
     !Number.isInteger(b)||b<0||b>=s.sources.length||
     !Number.isInteger(tier)||tier<1||tier>5||
     !Number.isInteger(rank)||rank<1||rank>39)return null;
  const k=a+'|'+b;if(pairs.has(k))return null;
  pairs.set(k,{tier,rank});
  const order=ranks.get(a)??new Set();
  if(order.has(rank))return null;
  order.add(rank);ranks.set(a,order);
 }
 // No substituted data, missing target, duplicate or skipped rankings.
 if(ranks.size!==82||[...ranks.values()].some(group=>
    [...group].sort((a,b)=>a-b).some((n,i)=>n!==i+1)))return null;
 const resolve=(rows,t,sw,d,layout)=>{
  const candidates=[];
  for(let i=0;i<rows.length;i++)
   if(rows[i][0]===t&&rows[i][1]===sw&&rows[i][3]===d)
    candidates.push(i);
  if(candidates.length===1)return candidates[0];
  if(candidates.length>1&&layout){
   const found=candidates.filter(i=>rows[i][2]===variant(layout));
   if(found.length===1)return found[0];
  }
  // Never guess inner/outer or a source course absent from official history.
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
 if(date<=snapshot.v||!Number.isFinite(time(snapshot.observed_at))||
    when<time(snapshot.observed_at)||post<=time(snapshot.observed_at))
   return fail('EVAL_SNAPSHOT_NOT_AVAILABLE_ASOF_TARGET_RACE');
 const tid=validated.resolve(snapshot.targets,race.track,rc.surface,
  Number(rc.distance),variant(rc.course_layout));
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
 // Content evidence was already acquired by the official, guarded JRA CLAIM.
 // Cross-link exact archived race identity, never name-only or result-time data.
 const content=new Map();
 if(context.runner_content_status==='READY'&&
    Array.isArray(context.runner_content_evidence)&&
    context.runner_content_evidence.length===history.length){
   const names=new Map(history.map(x=>[x.horse_no,norm(x.horse_name)]));
   let valid=true;
   for(const c of context.runner_content_evidence){
     if(!Number.isInteger(c?.horse_no)||names.get(c.horse_no)!==norm(c.horse_name)||
        content.has(c.horse_no)||!Array.isArray(c.history)||c.history.length>12){
       valid=false;break;
     }
     content.set(c.horse_no,c.history);
   }
   if(!valid||content.size!==history.length)content.clear();
 }
 const fieldPace=new Map();
 if(context.field_pace_status==='READY'&&
    Array.isArray(context.field_pace_evidence?.runners)){
   const names=new Map(history.map(x=>[x.horse_no,norm(x.horse_name)]));
   for(const x of context.field_pace_evidence.runners)
     if(Number.isInteger(x?.horse_no)&&names.get(x.horse_no)===norm(x.horse_name))
       fieldPace.set(x.horse_no,{
         comparable_position_runs:x.comparable_position_runs??0,
         repeated_front_evidence:x.repeated_front_evidence===true
       });
 }
 const evidence=[];
 let prior_runs_examined=0,prior_run_course_matches=0,archive_detail_matches=0;
 for(const horse of history){
  if(!no(horse?.horse_no)||!norm(horse?.horse_name)||seen.has(horse.horse_no)||
     !Array.isArray(horse.past_runs)||horse.past_runs.length>6)
   return fail('OFFICIAL_RUNNER_IDENTITY_OR_HISTORY_INCOMPLETE');
  seen.add(horse.horse_no);
  const matches=[],used=new Set();
  for(let i=0;i<horse.past_runs.length;i++){
   const run=horse.past_runs[i];
   prior_runs_examined++;
   if(!dateOk(run?.race_date)||run.race_date>=date||!JRA.has(run.track)||
      !surf(run.surface)||!Number.isInteger(Number(run.distance)))continue;
   const age=dayAge(date,run.race_date);
   if(age<0||age>540||!Number.isInteger(Number(run.finish))||
      Number(run.finish)<1||Number(run.finish)>24)continue;
   const runId=run.race_date+'|'+run.track+'|'+run.surface+'|'+run.distance;
   if(used.has(runId))continue;used.add(runId);
   const sid=validated.resolve(snapshot.sources,run.track,run.surface,
    Number(run.distance),variant(run.course_layout));
   if(sid===null)continue;
   const relation=validated.pairs.get(tid+'|'+sid);
   if(!relation)continue;
   prior_run_course_matches++;
   const sourceKey=K_INTERNAL(run.track,run.surface,run.distance);
   const stat=stats.get(sourceKey);
   const archived=(content.get(horse.horse_no)??[]).filter(x=>
     x.prior_date===run.race_date&&x.prior_track===run.track&&
     x.prior_surface===run.surface&&
     Number(x.prior_distance)===Number(run.distance)&&
     Number(x.finish)===Number(run.finish));
   const verifiedArchived=archived.length===1&&archived[0].detail_available===true&&
     archived[0].archive_full_field===true&&
     archived[0].archive_match_count===1&&
     archived[0].raw_history_match_count===1;
   if(verifiedArchived)archive_detail_matches++;
   const archive=verifiedArchived?archived[0]:null;
   const officialCorners=archive&&typeof archive.corner_positions==='string'?
     archive.corner_positions:null;
   const officialLaps=archive&&typeof archive.race_halons==='string'&&
     archive.race_halons.length<=256?archive.race_halons:null;
   const final3f=archive&&Number.isFinite(Number(archive.final3f))&&
     archive.final3f!==null?Number(archive.final3f):null;
   const final3fRank=archive&&Number.isInteger(Number(archive.final3f_rank))&&
     archive.final3f_rank!==null?Number(archive.final3f_rank):null;
   const margin=run.margin_to_winner!==null&&
     Number.isFinite(Number(run.margin_to_winner))?
     Number(run.margin_to_winner):null;
   const podium=Number(run.finish)<=3;
   const closeLossReview=!podium&&Number(run.finish)<=6&&
     margin!==null&&margin>=0&&margin<=0.6&&
     final3fRank!==null&&final3fRank<=3;
   const credible=relation.tier>=4&&age<=365&&podium&&
     run.surface===rc.surface&&validStat(stat);
   matches.push({
    verified_run_ref:`JRA_CLAIMED_CONTEXT.runner_history[horse_no=${horse.horse_no}].past_runs[${i}]`,
    prior_date:run.race_date,prior_track:run.track,
    prior_surface:run.surface,prior_distance:Number(run.distance),
    prior_finish:Number(run.finish),
    eval_rank_among_all_conditions:relation.rank,
    eval_relation_all_1942_checked:true,
    age_days:Math.round(age),
    official_archive_detail_verified:!!archive,
    official_corner_positions:officialCorners,
    official_race_halon_laps:officialLaps,
    official_final3f_seconds:final3f,
    official_final3f_rank:final3fRank,
    previous_race_content_assessment:podium?
      (archive?'VERIFIED_PODIUM_WITH_ARCHIVE_PACE':'VERIFIED_PODIUM_RESULT'):
      closeLossReview?'CLOSE_LOSS_AND_VERIFIED_FAST_FINAL3F_REVIEW':
      'NON_PODIUM_NO_AUTOMATIC_NEGATIVE',
    verified_close_loss_review:closeLossReview,
    prior_result_is_independent_of_eval:true,
    prior_early_pos:Number.isInteger(Number(run.early_pos))?
     Number(run.early_pos):null,
    prior_winner_margin_seconds:run.margin_to_winner!==null&&
     Number.isFinite(Number(run.margin_to_winner))?
     Number(run.margin_to_winner):null,
    prior_class:typeof run.race_class==='string'?run.race_class:null,
    eval_tier:({5:'S',4:'A',3:'B',2:'C',1:'E'})[relation.tier],
    eval_tier_numeric:relation.tier,
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
   Number(b.verified_close_loss_review)-Number(a.verified_close_loss_review)||
   b.eval_tier_numeric-a.eval_tier_numeric||
   a.eval_rank_among_all_conditions-b.eval_rank_among_all_conditions||
   b.prior_date.localeCompare(a.prior_date));
  const supported=matches.some(x=>x.direction_corrobated);
  evidence.push({horse_no:horse.horse_no,horse_name:horse.horse_name,
   matched_verified_prior_runs:matches.length,
   all_eval_correlated_past_runs:matches,
   official_field_pace_context:fieldPace.get(horse.horse_no)??null,
   verified_close_loss_reassessment_refs:matches.filter(x=>x.verified_close_loss_review)
     .map(x=>x.verified_run_ref),
   confirmed_supporting_run_refs:matches.filter(x=>x.direction_corrobated)
    .map(x=>x.verified_run_ref),
   // +1 is a bounded reviewer budget recommendation, not a second podium bonus.
   optional_course_fit_budget_points:supported?1:0,
   full_100pt_content_reassessment_is_not_limited_by_eval_point_budget:true,
   should_review_100pt_against_entire_field:supported,
   best_evidence:matches[0]??null,
   no_negative_penalty_for_missing_history:true
  });
 }
 return {status:'READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW',
  source:'USER_SUPPLIED_EVAL_SNAPSHOT_PRIVATE_PLUS_OWN_JRA_2023_25_STATS',
  snapshot_date:'2026-11-13',snapshot_observed_at:snapshot.observed_at,
  dataset_scope:'NORMAL_ALL_1942_82_JRA_TARGETS_94_SOURCES',
  eval_rows_screened:2141,
  eval_normal_rows:1942,eval_prioritized_rows:1942,
  eval_reference_rows_excluded:199,
  eval_remaining_normal_rows_not_loaded:0,
  official_prior_runs_examined:prior_runs_examined,
  source_course_relation_matches:prior_run_course_matches,
  official_one_to_one_archive_pace_matches:archive_detail_matches,
  full_field_content_rank_instruction:'REVIEW_OLD_CORRELATED_COURSE_AND_ACTUAL_CORNER_LAP_LAST3F_WINNER_MARGIN_OPPONENT_CLASS_RACE_CONDITIONS_BEFORE_FINAL_100PT_TOP5; DO_NOT_AUTOMATICALLY_BONUS_NONPODIUM_OR_LOW_TIER; NO_DOUBLE_COUNT;',

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
