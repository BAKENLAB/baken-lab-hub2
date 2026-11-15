// Isolated candidate adapter; no I/O, no DB writes. Requires server-verified context.
export const VERSION="JRA_JUMP_0.1_K2_20261115";
const MARKS=["◎","○","▲","☆","△"];
function check(v,msg){if(!v)throw Error("JUMP_"+msg);}
function mean(a,d=.5){return a.length?a.reduce((x,y)=>x+y,0)/a.length:d;}
function rankQuality(r){return 1-(r.finish-1)/(r.field_size-1);}
function daysBefore(a,b){return (Date.parse(b)-Date.parse(a))/86400000;}
export function prepareJump(ctx, now){
 const race=ctx?.race,claim=ctx?.claim,stamp=ctx?.official;
 const at=Date.parse(now),post=Date.parse(race?.post_time);
 check(Number.isFinite(at)&&Number.isFinite(post)&&post-at>180000&&post-at<=4200000,"WINDOW");
 check(race?.circuit==="JRA"&&race.race_type==="障害"&&race.surface==="障害"&&Number.isInteger(race.distance)&&race.distance>0,"RACE_TYPE");
 check(["READY","BASIC_READY"].includes(race.field_status)&&["PENDING","RETRY"].includes(race.prediction_status)&&ctx.existing_prediction===false,"RACE_STATE");
 check(claim?.status==="CLAIMED"&&claim.worker_id==="JRA_JUMP_QUEUE"&&typeof claim.job_id==="string"&&claim.job_id&&claim.race_key===race.race_key&&Date.parse(claim.lease_until)>at,"CLAIM");
 check(stamp?.verified===true&&stamp.basis==="JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1"&&stamp.race_key===race.race_key&&/^[a-f0-9]{64}$/.test(stamp.html_sha256??"")&&Date.parse(stamp.checked_at)<=at&&Date.parse(stamp.checked_at)<post,"OFFICIAL");
 check(Array.isArray(ctx.entries)&&ctx.entries.length===stamp.runner_count&&new Set(ctx.entries.map(x=>x.horse_no)).size===ctx.entries.length,"ENTRIES");
 check(ctx.entries.every(x=>Number.isInteger(x.horse_no)&&x.horse_no>0&&typeof x.horse_name==="string"&&x.horse_name.trim()&&["ACTIVE","CANCELLED","EXCLUDED"].includes(x.status)),"ENTRY_IDENTITY");
 const act=ctx.entries.filter(x=>x.status==="ACTIVE");
 check(act.length>=5&&act.length===stamp.active_count,"ACTIVE_COUNT");
 check(Array.isArray(ctx.history)&&ctx.history.length===act.length&&new Set(ctx.history.map(x=>x.horse_no)).size===act.length,"HISTORY_COVERAGE");
 const rows=act.map(e=>{
  const h=ctx.history.find(x=>x.horse_no===e.horse_no);
  check(h?.horse_name===e.horse_name&&h.coverage_verified===true&&Array.isArray(h.runs)&&typeof h.history_source==="string"&&h.history_source.trim(),"HISTORY_IDENTITY");
  check(h.runs.every(x=>x.verified===true&&typeof x.source_ref==="string"&&x.source_ref.trim()&&typeof x.race_date==="string"&&x.race_date<race.race_date&&Number.isFinite(Date.parse(x.race_date))&&x.race_type==="障害"&&Number.isInteger(x.field_size)&&x.field_size>1&&(x.finish===null||(Number.isInteger(x.finish)&&x.finish>=1&&x.finish<=x.field_size))&&Number.isInteger(x.distance)&&x.distance>0&&(x.gap_seconds===null||(Number.isFinite(x.gap_seconds)&&x.gap_seconds>=0))&&(x.final_turn_pos===null||(Number.isInteger(x.final_turn_pos)&&x.final_turn_pos>=1&&x.final_turn_pos<=x.field_size))),"HISTORY_ASOF");
  check(new Set(h.runs.map(x=>x.source_ref)).size===h.runs.length,"DUPLICATE_HISTORY");
  const completed=h.runs.filter(x=>x.finish!==null).sort((a,b)=>b.race_date.localeCompare(a.race_date)||a.source_ref.localeCompare(b.source_ref));
  const recent=completed.slice(0,3),same=completed.slice(0,8).filter(r=>r.class_name===race.class_name);
  const f=mean(recent.map(rankQuality)),g=mean(recent.filter(r=>r.gap_seconds!==null).map(r=>Math.max(0,1-r.gap_seconds*1000/r.distance/5))),p=mean(recent.filter(r=>r.final_turn_pos!==null).map(r=>1-(r.final_turn_pos-1)/(r.field_size-1))),c=mean(recent.filter(r=>r.track===race.track).map(rankQuality)),cl=(same.reduce((a,r)=>a+rankQuality(r),0)+1)/(same.length+2);
  const j=h.jockey_stats;
  check(j?.verified===true&&j.jockey===e.jockey&&j.as_of_date===race.race_date&&typeof j.source_ref==="string"&&j.source_ref.trim()&&[j.n,j.top3,j.own_n,j.own_top3].every(x=>Number.isInteger(x)&&x>=0)&&j.top3<=j.n&&j.own_n<=j.n&&j.own_top3<=j.top3&&j.own_top3<=j.own_n&&j.top3-j.own_top3<=j.n-j.own_n,"JOCKEY_STATS");
  const js=(j.top3+5)/(j.n+15), independentN=j.n-j.own_n, independentJ=(j.top3-j.own_top3+5)/(independentN+15);
  const raw=100*(.55*f+.25*g+.10*p+.10*c+.20*(js-1/3)+.10*(cl-.5));
  const score=Math.round(Math.min(100,Math.max(0,raw))*10000)/10000;
  const close=recent.filter(r=>daysBefore(r.race_date,race.race_date)<=180&&r.class_name===race.class_name&&Math.abs(r.distance-race.distance)<=200&&r.gap_seconds!==null&&r.gap_seconds*1000/r.distance<=.7);
  return {horse_no:e.horse_no,horse_name:e.horse_name,status:"ACTIVE",score,raw_score:raw,features:{f,g,p,c,cl,js},observed_history:completed.length,history_source:h.history_source,prior_refs:recent.map(r=>r.source_ref),close_refs:close.map(r=>r.source_ref),independent_n:independentN,independent_j:independentJ,jockey_source:j.source_ref};
 }).sort((a,b)=>b.raw_score-a.raw_score||a.horse_no-b.horse_no).map((r,i)=>({...r,rank:i+1}));
 return {version:VERSION,race_key:race.race_key,job_id:claim.job_id,created_at:now,rows,eye_candidates:rows.filter(r=>r.rank>5&&r.close_refs.length>=1&&r.independent_n>=15&&r.independent_j>=.4).map(r=>r.horse_no)};
}
export function finalizeJump(ctx, now, review){
 const p=prepareJump(ctx,now);
 check(review?.version===VERSION&&review.race_key===p.race_key&&review.job_id===p.job_id&&review.market_used===false&&review.target_result_used===false,"REVIEW");
 check(Array.isArray(review.runners)&&review.runners.length===p.rows.length&&new Set(review.runners.map(r=>r.horse_no)).size===p.rows.length,"RUNNER_REVIEW");
 const rows=p.rows.map(r=>{
  const a=review.runners.find(x=>x.horse_no===r.horse_no);
  check(a?.horse_name===r.horse_name&&a.rank===r.rank&&typeof a.reason==="string"&&a.reason.trim().length>=8&&/^[SABCDEF]$/.test(a.grade??""),"RUNNER_REVIEW_IDENTITY");
  return {horse_no:r.horse_no,horse_name:r.horse_name,status:"ACTIVE",rank:r.rank,score:r.score,grade:a.grade,reason:a.reason,mark:r.rank<=5?MARKS[r.rank-1]:null};
 });
 const outside=p.rows.filter(r=>r.rank>5);
 check(Array.isArray(review.eye_audit)&&review.eye_audit.length===outside.length&&new Set(review.eye_audit.map(a=>a.horse_no)).size===outside.length,"EYE_COVERAGE");
 check(outside.every(r=>review.eye_audit.some(a=>a.horse_no===r.horse_no&&typeof a.reason==="string"&&a.reason.trim().length>=8)),"EYE_REASON");
 check(Array.isArray(review.eye_pairs)&&review.eye_pairs.length===outside.length*(outside.length-1)/2,"EYE_PAIRS");
 const keys=new Set();
 for(const a of review.eye_pairs){
  check(outside.some(x=>x.horse_no===a.a)&&outside.some(x=>x.horse_no===a.b)&&a.a!==a.b&&typeof a.reason==="string"&&a.reason.trim().length>=8&&[null,a.a,a.b].includes(a.preferred_horse_no),"EYE_PAIR");
  const k=[a.a,a.b].sort((x,y)=>x-y).join(":");check(!keys.has(k),"EYE_DUPLICATE_PAIR");keys.add(k);
 }
 check(typeof review.eye_reason==="string"&&review.eye_reason.trim().length>=8,"EYE_DECISION");
 check(review.eye===null||p.eye_candidates.includes(review.eye),"EYE_TWO_FACTORS");
 const eye=review.eye===null?null:{...rows.find(r=>r.horse_no===review.eye),concrete_upside_reason:review.eye_reason};
 const summary=review.summary;
 check(typeof summary==="string"&&summary.trim(),"SUMMARY");
 return {runners:rows,top5:rows.slice(0,5),eye,bets:[],summary:{text:summary,market_used:false},bet_strategy:"SUSPENDED_FOR_ABILITY_STABILITY",audit:{protocol_version:VERSION,validated_core:"JUMP_K2_RESEARCH_0.1",race_key:p.race_key,job_id:p.job_id,all_runners_checked:true,official_full_field_verified:true,market_used_for_ranking:false,market_used_for_eye:false,target_result_used:false,rank6_auto_selected:false,outside_top5_reaudited:true,eye_pool_checked:outside.map(r=>r.horse_no),eye_review:review.eye_audit,eye_pairs:review.eye_pairs,eye_decision:review.eye_reason,score_evidence:p.rows,official_evidence:ctx.official,generated_at:now}};
}
