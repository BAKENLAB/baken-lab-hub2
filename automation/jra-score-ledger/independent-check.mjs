// Independent integer arithmetic. Does not call the collector or any scorer.
const kinds=new Set(['distance','class','margin','corners','last3f','going','rest','course','eval','pace','opponent','race_shape']);
const int=x=>typeof x==='number'&&Number.isSafeInteger(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clamp=n=>n<0?0:n>100?100:n;
const forbidden=/odds|popular|market|target.?result/i;
export function checkDeclaredLedger({ledger,payload,officialActive=null}){
 const errors=[],per_runner=[];const add=(code,no)=>errors.push({code,horse_no:no??null});
 if(!ledger||ledger.schema!=='JRA_DECLARED_SCORE_LEDGER_V1'||!Array.isArray(ledger.runners)||!Array.isArray(payload?.runners))return {ok:false,errors:[{code:'SHAPE'}],per_runner:[],engine_verified:false,provenance_verified:false};
 if(ledger.runners.length!==payload.runners.length)add('COVERAGE');
 const seen=new Set();
 for(const l of ledger.runners){
  const no=l.horse_no,rs=payload.runners.filter(x=>x.horse_no===no);
  if(!int(no)||no<1||no>24||seen.has(no)||rs.length!==1){add('RUNNER_ID',no);continue;}seen.add(no);
  const r=rs[0];if(r.horse_name!==l.horse_name||r.score!==l.final_score||r.rank!==l.rank||r.grade!==l.grade)add('RUNNER_CHANGED',no);
  if(l.review_count!==1){add('REVIEW_MISSING_OR_DUPLICATE',no);continue;}
  if(!int(l.base)||l.base<0||l.base>100){add('BASE_INVALID',no);continue;}
  if(!Array.isArray(l.components)||!l.components.length){add('COMPONENTS_MISSING',no);continue;}
  let sum=BigInt(l.base);const keys=new Set();
  for(const c of l.components){
   if(!c||!kinds.has(c.kind)||forbidden.test(String(c.kind))||!int(c.points)||Math.abs(c.points)>15||typeof c.source_ref!=='string'||!c.source_ref.trim()){add('COMPONENT_INVALID',no);continue;}
   const key=c.kind+'|'+c.source_ref;if(keys.has(key))add('DUPLICATE_COMPONENT',no);keys.add(key);
   if(!l.source_refs.includes(c.source_ref)&&!/^JRA_CLAIMED_CONTEXT\.runner_history\[horse_no=\d+\]\.past_runs\[\d+\]$/.test(c.source_ref))add('UNBOUND_REFERENCE',no);
   sum+=BigInt(c.points);
  }
  const reviewed=Number(sum<0n?0n:sum>100n?100n:sum);
  if(reviewed!==l.review_score)add('REVIEW_SUM_MISMATCH',no);
  let final=reviewed;
  if(ledger.has_bridge){
   const b=l.bridge;
   if(l.bridge_count!==1||!b){add('BRIDGE_MISSING_OR_DUPLICATE',no);continue;}
   if(!int(b.requested_delta)||b.requested_delta<0||b.requested_delta>2||!int(b.applied_delta)||b.applied_delta<0||b.applied_delta>2){add('BRIDGE_DELTA_INVALID',no);continue;}
   if(b.score_before!==reviewed||b.rank_before!==l.review_rank)add('BRIDGE_BEFORE_MISMATCH',no);
   final=clamp(reviewed+b.requested_delta);
   if(b.score_after!==final||b.applied_delta!==final-reviewed||b.rank_after!==l.rank)add('BRIDGE_AFTER_MISMATCH',no);
  }
  if(!int(l.final_score)||l.final_score<0||l.final_score>100||final!==l.final_score)add('FINAL_SUM_MISMATCH',no);
  per_runner.push({horse_no:no,base:l.base,component_sum:Number(sum)-l.base,review_recomputed:reviewed,bridge_applied:final-reviewed,final_recomputed:final});
 }
 const ordered=payload.runners.slice().sort((a,b)=>a.rank-b.rank);
 ordered.forEach((r,i)=>{if(r.rank!==i+1)add('RANK_NOT_CONTIGUOUS',r.horse_no);if(i&&r.score>ordered[i-1].score)add('SCORE_NOT_DESCENDING',r.horse_no);if(!/^[SABCDEF]$/.test(r.grade??''))add('GRADE',r.horse_no);});
 if(!Array.isArray(payload.top5)||payload.top5.length!==5||new Set(payload.top5.map(x=>x.horse_no)).size!==5)add('TOP5_SHAPE');
 else for(let i=0;i<5;i++){const a=ordered[i],b=payload.top5[i];if(!a||['horse_no','horse_name','rank','score','grade'].some(k=>a[k]!==b[k]))add('TOP5_MISMATCH',b.horse_no);}
 if(payload.eye!==null){const e=payload.eye,r=payload.runners.find(x=>x.horse_no===e?.horse_no);if(!r||r.rank<=5||['rank','score','grade','horse_name'].some(k=>r[k]!==e[k]))add('EYE_MISMATCH',e?.horse_no);}
 if(officialActive){const projected=xs=>xs.map(x=>[x.horse_no,x.horse_name]).sort((a,b)=>a[0]-b[0]);if(!same(projected(payload.runners),projected(officialActive)))add('OFFICIAL_ACTIVE_SET_MISMATCH');}
 return {ok:errors.length===0,errors,per_runner,engine_verified:false,provenance_verified:false,production_allowed:false};
}
