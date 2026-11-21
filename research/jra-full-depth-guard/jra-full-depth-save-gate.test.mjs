import test from "node:test";
import assert from "node:assert/strict";
import {inspectJraFullDepthSave} from "./jra-full-depth-save-gate.mjs";
const source=()=>{const priorDate="2026-11-01";
 const rows=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:"馬"+(i+1),past_runs:[{
  source_ref:"/JRADB/accessS.html?CNAME=pw01sde"+i,
  race_date:priorDate,surface:"芝",distance:1800,race_class:"未勝利",margin_to_winner:0.3,
  corner_positions:[7,6,4,4],final3f:35.2,going:"良",finish:4
 }]}));
 const candidates=rows.map((x,i)=>({horse_no:x.horse_no,horse_name:x.horse_name,base_rank:i+1,base_rate:.6}));
 const runners=rows.map((x,i)=>({horse_no:x.horse_no,horse_name:x.horse_name,
  rank:6-i,score:38+i*5,status:"ACTIVE"}));
 const base=["margin","corners","last3f","class","distance","going"];
 const reviews=rows.map((x,i)=>({horse_no:x.horse_no,history_count:1,
  rank_before:i+1,rank_after:6-i,score_after:38+i*5,base_score:30+i*5,
  reason:"前走芝1800m4着0.3秒差、通過順7-6-4-4・上がり35.2秒、着順のみでなく位置上昇と脚を確認して相対比較した結果を採点した。",
  source_refs:[x.past_runs[0].source_ref],
  evidence_effects:base.map((kind,j)=>({kind,source_ref:x.past_runs[0].source_ref,points:[2,1,1,1,1,2][j]}))}));
 const payload={runners,top5:[...runners].sort((a,b)=>a.rank-b.rank).slice(0,5),
  bets:[],eye:null,audit:{market_used_for_ranking:false,market_used_for_eye:false,target_result_used:false,market_fields_excluded:true,
  eval_normal_relations_checked:1942,runner_history_checked:reviews,
  rank_review_before_eval:{review_scope:"ALL_6_ACTIVE",base_core_order:[1,2,3,4,5,6],
   independent_reassessment_order:[6,5,4,3,2,1],
   reason:"6頭全頭の前走着差・通過位置の変化・上がり・近走クラス・距離適性を比較し、基礎順と独立再評価順の相違の原因を確認した。"}}};
 const context={race:{race_date:"2026-11-21",track:"福島",race_no:6,field_payload:{race:{race_type:"平地"}}},
  candidates,runner_history:rows};
 const evalInput={status:"READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW",eval_normal_rows:1942,
   runners:rows.map(x=>({horse_no:x.horse_no}))};
 return {context,payload,evalInput};
};
const run=x=>inspectJraFullDepthSave(x);
test("verified sourced full-field reassessment is eligible",()=>{
 const v=run(source());assert.equal(v.ok,true,JSON.stringify(v));
 assert.equal(v.prior_run_rows,6);assert.equal(v.corner_rows,6);
 assert.equal(v.last3f_rows,6);assert.equal(v.horses_with_scored_evidence,6);
 assert.deepEqual(v.base_core_order,[1,2,3,4,5,6]);assert.deepEqual(v.independent_reassessment_order,[6,5,4,3,2,1]);
});
test("legacy shallow save is blocked before FROZEN",()=>{
 const x=source();delete x.payload.audit.runner_history_checked;
 assert.equal(run(x).reason,"PER_HORSE_EVIDENCE_REVIEW_REQUIRED");
});
test("omitted last3f, despite stored official data, is blocked",()=>{
 const x=source();x.payload.audit.runner_history_checked[0].evidence_effects=
 x.payload.audit.runner_history_checked[0].evidence_effects.filter(a=>a.kind!=="last3f");
 assert.match(run(x).reason,/AVAILABLE_FEATURE_NOT_ASSESSED_last3f/);
});
test("omitted corner progression is blocked",()=>{
 const x=source();x.payload.audit.runner_history_checked[0].evidence_effects=
 x.payload.audit.runner_history_checked[0].evidence_effects.filter(a=>a.kind!=="corners");
 assert.match(run(x).reason,/AVAILABLE_FEATURE_NOT_ASSESSED_corners/);
});
test("unverified official reference and invented prior race blocked",()=>{
 const x=source();x.payload.audit.runner_history_checked[0].source_refs=["FAKE"];
 assert.equal(run(x).reason,"RECENT_OFFICIAL_HISTORY_NOT_FULLY_REVIEWED");
});
test("score must numerically equal evidenced point effects",()=>{
 const x=source();x.payload.audit.runner_history_checked[0].evidence_effects[0].points=5;
 assert.equal(run(x).reason,"EVIDENCE_POINTS_NOT_REFLECTED_IN_SCORE");
});
test("base versus independent re-ranking is audited and must match",()=>{
 const x=source();x.payload.audit.rank_review_before_eval.base_core_order=[6,5,4,3,2,1];
 assert.equal(run(x).reason,"INDEPENDENT_WHOLE_FIELD_REASSESSMENT_NOT_EVIDENCED");
});
test("target-day historical row is refused",()=>{
 const x=source();x.context.runner_history[2].past_runs[0].race_date="2026-11-21";
 assert.equal(run(x).reason,"HISTORY_NOT_AS_OF_RACE");
});
test("market, bets, or target results are refused",()=>{
 for(const [path,val]of [["market_used_for_ranking",true],["target_result_used",true]]){
  const x=source();x.payload.audit[path]=val;assert.equal(run(x).ok,false);
 }
 const z=source();z.payload.bets=[{horse_no:1}];assert.equal(run(z).ok,false);
});
test("unsupported opponent claim is rejected instead of hallucinated",()=>{
 const x=source();x.payload.audit.runner_history_checked[0].evidence_effects.push({
  kind:"opponent",source_ref:x.context.runner_history[0].past_runs[0].source_ref,points:5
 });
 assert.equal(run(x).reason,"OPPONENT_OR_PACE_INTERPRETATION_NOT_SOURCE_VERIFIED");
});
test("missing verified Eval source blocks official save",()=>{
 const x=source();x.evalInput.status="EVAL_TRANSFER_UNAVAILABLE";
 assert.equal(run(x).reason,"EVAL_1942_CURRENT_FIELD_UNVERIFIED");
});

