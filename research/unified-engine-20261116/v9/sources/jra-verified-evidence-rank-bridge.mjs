/**
 * JRA0.4 official save bridge — actual score/rank adjustment before NEW FROZEN.
 * Does not CLAIM, save, query a DB, alter previous predictions or infer accidents.
 * Caller supplies only officially validated as-of context and private Eval
 * evidence generated through the already-guarded JRA claimed-context path.
 *
 * Small deterministic addends are intentionally separate from broader model
 * interpretation of old wins, pace, class/opponent quality (not automated).
 */
const MARKS=['◎','○','▲','☆','△'];
const okNo=n=>Number.isInteger(n)&&n>=1&&n<=24;
const clean=x=>String(x??'').normalize('NFKC').trim();
const whole=x=>Number.isInteger(x)&&x>=0&&x<=100;
const boundedResult=(status,reason,extra={})=>({status,reason,
 official_saved:false,mutates_existing_frozen:false,market_used:false,
 target_result_used:false,...extra});
const available=(context,evalInput,now)=>{
 const time=Date.parse(now),post=Date.parse(context?.race?.post_time),
  date=context?.race?.race_date;
 return context?.stage==='AWAITING_JRA_FULL_DEPTH_COMPARISON'&&
   evalInput?.status==='READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW'&&
   evalInput?.market_used===false&&evalInput?.target_result_used===false&&
   evalInput?.authorized_to_save===false&&
   evalInput?.eval_normal_rows===1942&&
   evalInput?.eval_remaining_normal_rows_not_loaded===0&&
   Number.isFinite(time)&&Number.isFinite(post)&&time<post&&
   typeof date==='string'&&date>='2026-11-14'&&
   new Date(time+9*3600000).toISOString().slice(0,10)===date;
};
const sourceRun=run=>run&&typeof run.verified_run_ref==='string'&&
 /^JRA_CLAIMED_CONTEXT\.runner_history\[horse_no=\d{1,2}\]\.past_runs\[\d\]$/.test(run.verified_run_ref);
function scoreProof(h,horseNo){
 const all=h?.all_eval_correlated_past_runs;
 if(!Array.isArray(all)||all.length>6)return null;
 const supporting=all.filter(x=>sourceRun(x)&&
    x.verified_run_ref.includes('horse_no='+horseNo+']')&&
    x.bounded_eval_point_budget_eligible===true&&
    Number(x.prior_finish)<=3&&
    x.independently_corrobated_direction===true&&
    ['HIGH','MEDIUM'].includes(x.independent_JRA_training_reliability)&&
    Number(x.independent_JRA_training_n)>=120);
 const pace=all.filter(x=>sourceRun(x)&&
    x.verified_run_ref.includes('horse_no='+horseNo+']')&&
    x.verified_close_loss_review===true&&
    x.official_archive_detail_verified===true&&
    typeof x.official_corner_positions==='string'&&
    x.official_corner_positions.length>0&&
    typeof x.official_race_halon_laps==='string'&&
    x.official_race_halon_laps.length>0&&
    Number(x.official_final3f_rank)>=1&&
    Number(x.official_final3f_rank)<=3&&
    Number(x.prior_finish)>=4&&Number(x.prior_finish)<=6&&
    Number(x.prior_winner_margin_seconds)>=0&&
    Number(x.prior_winner_margin_seconds)<=0.6);
 const refs=[...new Set([...supporting.slice(0,1),...pace.slice(0,1)].map(x=>x.verified_run_ref))];
 return {
  delta:Math.min(2,Number(supporting.length>0)+Number(pace.length>0)),
  refs,
  correlated_runs_checked:all.length,
  proof:supporting.length>0||pace.length>0?{
    course: supporting[0]?{
      prior_date:supporting[0].prior_date,track:supporting[0].prior_track,
      distance:supporting[0].prior_distance,eval_rank:supporting[0].eval_rank_among_all_conditions,
      eval_grade:supporting[0].eval_tier,source_ref:supporting[0].verified_run_ref
    }:null,
    close_loss:pace[0]?{
      prior_date:pace[0].prior_date,track:pace[0].prior_track,
      winner_gap:pace[0].prior_winner_margin_seconds,
      corners:pace[0].official_corner_positions,
      official_race_laps:pace[0].official_race_halon_laps,
      last3f_rank:pace[0].official_final3f_rank,
      source_ref:pace[0].verified_run_ref
    }:null
  }:null
 };
}
function validDraft(context,evalInput,payload){
 if(!payload||!Array.isArray(payload.runners)||!Array.isArray(payload.top5)||
    payload.runners.length<6||payload.runners.length>24||payload.top5.length!==5||
    !Array.isArray(context.runner_history)||
    !Array.isArray(evalInput.runners)||
    payload.runners.length!==context.runner_history.length||
    payload.runners.length!==evalInput.runners.length)return null;
 const fromContext=new Map(),fromEval=new Map(),rankSet=new Set();
 for(const h of context.runner_history){
  if(!okNo(h?.horse_no)||!clean(h.horse_name)||fromContext.has(h.horse_no))return null;
  fromContext.set(h.horse_no,clean(h.horse_name));
 }
 for(const h of evalInput.runners){
  if(!okNo(h?.horse_no)||fromEval.has(h.horse_no)||
    fromContext.get(h.horse_no)!==clean(h.horse_name))return null;
  fromEval.set(h.horse_no,h);
 }
 const byNo=new Map();
 for(const r of payload.runners){
  if(!okNo(r?.horse_no)||byNo.has(r.horse_no)||!whole(r.score)||
     !Number.isInteger(r.rank)||r.rank<1||r.rank>payload.runners.length||
     rankSet.has(r.rank)||fromContext.get(r.horse_no)!==clean(r.horse_name))
   return null;
  rankSet.add(r.rank);byNo.set(r.horse_no,r);
 }
 if(byNo.size!==fromContext.size||rankSet.size!==byNo.size)return null;
 const ordered=payload.runners.slice().sort((a,b)=>a.rank-b.rank);
 if(ordered.slice(0,5).some((r,i)=>r.horse_no!==payload.top5[i]?.horse_no))
  return null;
 const eye=payload.eye;
 if(eye!==null&&(!okNo(eye?.horse_no)||!byNo.has(eye.horse_no)||
    byNo.get(eye.horse_no).rank<=5))return null;
 return {ordered,fromEval};
}
export function buildJraVerifiedEvidenceRankBridge({context,evalInput,payload,observedAt}={}){
 if(!available(context,evalInput,observedAt))
  return boundedResult('NOT_READY','OFFICIAL_EVAL_OR_CLAIM_CONTEXT_UNAVAILABLE');
 const field=validDraft(context,evalInput,payload);
 if(!field)return boundedResult('REJECTED','OFFICIAL_DRAFT_FIELD_RANK_OR_SCORE_MISMATCH');
 const original=field.ordered.map(x=>x.horse_no),adjusted=[],audit=[];
 for(const r of field.ordered){
  const h=field.fromEval.get(r.horse_no);
  const p=scoreProof(h,r.horse_no);
  if(!p)return boundedResult('REJECTED','INVALID_OFFICIAL_CORRELATION_PROOFS');
  const next=Math.min(100,r.score+p.delta);
  adjusted.push({...r,score:next});
  audit.push({horse_no:r.horse_no,horse_name:r.horse_name,
   score_before:r.score,score_after:next,requested_delta:p.delta,
   applied_delta:next-r.score,rank_before:r.rank,
   correlated_runs_checked:p.correlated_runs_checked,
   verified_run_refs:p.refs,verified_proof:p.proof});
 }
 adjusted.sort((a,b)=>b.score-a.score||
   field.ordered.find(x=>x.horse_no===a.horse_no).rank-
   field.ordered.find(x=>x.horse_no===b.horse_no).rank||
   a.horse_no-b.horse_no);
 for(let i=0;i<adjusted.length;i++){
  adjusted[i].rank=i+1;
  adjusted[i].mark=MARKS[i]??null;
  const proof=audit.find(x=>x.horse_no===adjusted[i].horse_no);
  proof.rank_after=i+1;
  if(proof.applied_delta>0){
   const detail=proof.verified_proof;
   const texts=[];
   if(detail?.course)
     texts.push('Eval相関'+detail.course.eval_rank+'位'+
       '・'+detail.course.eval_grade+'（'+detail.course.track+
       detail.course.distance+'m）');
   if(detail?.close_loss)
     texts.push('公式通過順'+detail.close_loss.corners+
       '、公式上がり順位'+detail.close_loss.last3f_rank+
       '、着差'+detail.close_loss.winner_gap);
   adjusted[i].reason=(clean(adjusted[i].reason)+' 【検証済み追加根拠：'+
     texts.join('／')+'。最大'+proof.applied_delta+
     '点補正、同一走の重複加点なし】').slice(0,3200);
  }
 }
 const after=adjusted.map(r=>r.horse_no),beforeTop5=original.slice(0,5),
  afterTop5=after.slice(0,5);
 const changedTop5=beforeTop5.some((n,i)=>n!==afterTop5[i]);
 const changedTop5Membership=beforeTop5.some(n=>!afterTop5.includes(n));
 const newEye=payload.eye===null?null:
  adjusted.find(x=>x.horse_no===payload.eye.horse_no);
 const eye=(newEye&&newEye.rank>5)?
  {...payload.eye,rank:newEye.rank,score:newEye.score,mark:null,
    reason:newEye.reason}:null;
 const newAudit={...payload.audit,
  evidence_rank_bridge:{
    version:'JRA_EVAL_1942_PACE_SCORE_V1',status:'APPLIED_TO_NEW_PREDICTION',
    used_official_claim_context:true,eval_normal_rows:1942,
    all_runners_checked:true,market_used:false,target_result_used:false,
    old_order:original,new_order:after,top5_changed:changedTop5,
    top5_membership_changed:changedTop5Membership,
    per_runner:audit
  }};
 const outPayload={...payload,runners:adjusted,top5:adjusted.slice(0,5),
  eye,audit:newAudit};
 return boundedResult(changedTop5Membership?'EYE_REAUDIT_REQUIRED':'READY_FOR_OFFICIAL_SAVE',
  changedTop5Membership?'TOP5_MEMBERSHIP_CHANGED_REAUDIT_EYE_AND_RANK_REASONS':
  'FULL_FIELD_EVIDENCE_SCORES_AND_RANKS_APPLIED',{
  full_field_count:adjusted.length,runner_score_changes:audit.filter(x=>x.applied_delta>0).length,
  before_top5:beforeTop5,after_top5:afterTop5,
  score_and_rank_diff:audit,proposed_payload:outPayload,
  needs_eye_reaudit:changedTop5Membership,top5_order_changed:changedTop5,
  existing_frozen_untouched:true
 });
}
export function verifyJraBridgeAlreadyApplied({context,evalInput,payload,observedAt}={}){
 const stamp=payload?.audit?.evidence_rank_bridge;
 if(stamp?.version!=='JRA_EVAL_1942_PACE_SCORE_V1'||
    stamp.status!=='APPLIED_TO_NEW_PREDICTION'||
    !Array.isArray(stamp.per_runner)||!Array.isArray(stamp.old_order))
  return boundedResult('REJECTED','EVIDENCE_BRIDGE_AUDIT_MISSING');
 const rows=new Map(stamp.per_runner.map(x=>[x.horse_no,x]));
 if(rows.size!==payload.runners?.length)
  return boundedResult('REJECTED','EVIDENCE_AUDIT_FIELD_COUNT_MISMATCH');
 const restored=payload.runners.map(r=>{
  const old=rows.get(r.horse_no);
  if(!old||!whole(old.score_before)||!Number.isInteger(old.rank_before))
   return null;
  return {...r,score:old.score_before,rank:old.rank_before};
 });
 if(restored.some(x=>x===null))
  return boundedResult('REJECTED','EVIDENCE_BEFORE_SCORE_UNVERIFIED');
 restored.sort((a,b)=>a.rank-b.rank);
 const synthetic={...payload,runners:restored,top5:restored.slice(0,5),
  eye:null,audit:{...payload.audit,evidence_rank_bridge:undefined}};
 const rebuilt=buildJraVerifiedEvidenceRankBridge({
  context,evalInput,payload:synthetic,observedAt
 });
 if(!['READY_FOR_OFFICIAL_SAVE','EYE_REAUDIT_REQUIRED'].includes(rebuilt.status))
  return boundedResult('REJECTED','EVIDENCE_REBUILD_FAILED');
 if(rebuilt.score_and_rank_diff.some(x=>{
   const old=rows.get(x.horse_no),fin=payload.runners.find(y=>y.horse_no===x.horse_no);
   return !old||!fin||old.score_before!==x.score_before||
    old.score_after!==x.score_after||old.rank_after!==x.rank_after||
    fin.score!==x.score_after||fin.rank!==x.rank_after||
    JSON.stringify(old.verified_run_refs)!==JSON.stringify(x.verified_run_refs);
 }))return boundedResult('REJECTED','EVIDENCE_APPLIED_DIFF_MISMATCH');
 const expectedTop=rebuilt.proposed_payload.top5.map(x=>x.horse_no);
 if(expectedTop.some((v,i)=>payload.top5[i]?.horse_no!==v))
  return boundedResult('REJECTED','EVIDENCE_APPLIED_TOP5_MISMATCH');
 if(rebuilt.needs_eye_reaudit&&payload.audit.eye_reaudited_after_rank_change!==true)
  return boundedResult('REJECTED','EYE_REAUDIT_REQUIRED');
 if(payload.eye&&payload.runners.find(x=>x.horse_no===payload.eye.horse_no)?.rank<=5)
  return boundedResult('REJECTED','EYE_ENTERED_TOP5');
 return boundedResult('VERIFIED','ACTUAL_SCORE_RANK_TOP5_AND_PROOF_REBUILT');
}
