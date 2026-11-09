import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saveWithAtomicGuardTerminal} from '../automation/local-queue-guard-terminal-adapter.mjs';
import {CHECKS,FACTOR_VERSION} from './local-claimed-prod-guard-v19.mjs';
const uuidA='19ad541f-bdbb-4471-b278-c31811383a6b';
const uuidB='42861ec0-56f2-4191-af00-9b11603f75aa';
const make=()=>{
 const verifiedRunners=Array.from({length:7},(_,i)=>({
  horse_no:i+1,horse_name:'架空馬'+(i+1),
  recent_runs:[{race_date:'2026-10-10',track:'川崎',distance:1400,finish:2}]
 }));
 const runners=verifiedRunners.map((h,i)=>({
  horse_no:h.horse_no,horse_name:h.horse_name,rank:i+1,
  score:90-i*4,grade:'A',running_style_reference:['?'],
  status:'ACTIVE',reason:'同場同距離の結果に基づく評価'
 }));
 const review_checks=Object.fromEntries(CHECKS.map(k=>[k,{
  status:'MISSING',finding:'独立した確認済み資料は未取得',evidence_refs:[]
 }]));
 const outside=[6,7];
 const payload={runners,top5:runners.slice(0,5),eye:null,bets:[],
  bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',summary:'全頭比較',
  audit:{protocol_version:FACTOR_VERSION,
   rank6_auto_selected:false,market_used_for_eye:false,
   eye_selection_method:'LOCAL_EYE_FACTOR_COUNT_V1',
   eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',
   eye_pool_checked:outside,
   eye_candidate_audit:outside.map(n=>({horse_no:n,rank:n,
    upside_trigger:'好走の独立証拠が足りない',hidden_evidence:'現級での情報不足',
    finish_path:'3着圏を支える複数証拠が不足',risk:'近況の敗戦は反証',
    eye_case:false,evidence_refs:[],review_checks:structuredClone(review_checks)})),
   eye_positive_factor_audit:outside.map(horse_no=>({horse_no,positive_factors:[]})),
   eye_pairwise_comparison:[],eye_tie_break:null,eye_selected_rank:null,
   eye_abstention_reason:'今回条件で独立した肯定材料2件以上を確証できない'
  }};
 return {jobId:uuidA,userId:uuidB,protocolVersion:FACTOR_VERSION,
  payload,originalPayload:structuredClone(payload),verifiedRunners,
  postTime:'2026-11-09T15:30:00+09:00',now:'2026-11-09T14:49:00+09:00'};
};
const client=(reply,seen)=>({rpc:async(name,args)=>{seen.push({name,args});return reply;}});
test('staged RPC only receives fully verified first save, no silent mutation',async()=>{
 const a=make(),before=structuredClone(a),seen=[];
 const result=await saveWithAtomicGuardTerminal(a,{client:client({
  data:{ok:true,prediction_id:uuidB,already_saved:false}
 },seen)});
 assert.equal(result.ok,true);
 assert.equal(seen[0].name,'lab_queue_save_prediction_v2');
 assert.deepEqual(seen[0].args.p_payload,before.payload);
 assert.deepEqual(a,before);
});
test('official MARKET_EVIDENCE rejection is terminal, no retry request',async()=>{
 const seen=[],a=make();
 const result=await saveWithAtomicGuardTerminal(a,{client:client({
  data:{ok:false,terminal:true,saved:false,reason:'LOCAL_EYE_MARKET_EVIDENCE',job_id:uuidA}
 },seen)});
 assert.deepEqual(result,{ok:false,terminal:true,code:'LOCAL_EYE_MARKET_EVIDENCE'});
 assert.equal(seen.length,1);
});
test('official CHECK_EVIDENCE rejection is terminal, no retry request',async()=>{
 const seen=[],a=make();
 const result=await saveWithAtomicGuardTerminal(a,{client:client({
  data:{ok:false,terminal:true,saved:false,reason:'LOCAL_EYE_CHECK_EVIDENCE',job_id:uuidA}
 },seen)});
 assert.deepEqual(result,{ok:false,terminal:true,code:'LOCAL_EYE_CHECK_EVIDENCE'});
 assert.equal(seen.length,1);
});
test('two horses without history or prior guard rejection cause ZERO save RPCs',async()=>{
 const seen=[],a=make();a.verifiedRunners[3].recent_runs=[];a.verifiedRunners[4].recent_runs=[];
 const result=await saveWithAtomicGuardTerminal(a,{client:client({data:{}},seen)});
 assert.equal(result.code,'MULTIPLE_RUNNERS_WITHOUT_VERIFIED_HISTORY');
 assert.equal(seen.length,0);
 const b=make();
 const denied=await saveWithAtomicGuardTerminal({...b,previousGuardRejected:true},{client:client({data:{}},seen)});
 assert.equal(denied.code,'PREVIOUS_GUARD_REJECTION_NO_RESUBMIT');
 assert.equal(seen.length,0);
});
test('no unverified terminal response or unknown error is accepted',async()=>{
 const a=make();
 await assert.rejects(saveWithAtomicGuardTerminal(a,{client:client({
  data:{ok:false,terminal:true,saved:false,reason:'SAVE_REJECTED',job_id:uuidA}
 },[])}),/UNVERIFIED_QUEUE_SAVE_RESULT/);
 await assert.rejects(saveWithAtomicGuardTerminal(a,{client:client({
  error:{message:'SQL_ERROR'}
 },[])}),/OFFICIAL_SAVE_RPC_FAILED/);
});
test('staged SQL fails closed and only safe terminalizes authentic guard exceptions',()=>{
 const sql=readFileSync(new URL('./staged-local-terminal-guard-rejection-rpc.sql',import.meta.url),'utf8');
 for(const x of [
  'lab_queue_save_prediction_v1','when raise_exception',
  "'LOCAL_EYE_MARKET_EVIDENCE'","'LOCAL_EYE_CHECK_EVIDENCE'",
  'or v_job.lease_until <= clock_timestamp()',
  "or v_race.post_time <= clock_timestamp() + interval '3 minutes'",
  "and job_status='CLAIMED'",
  'not exists(select 1 from public.lab_prediction_jobs',
  'revoke all on function public.lab_queue_save_prediction_v2'
 ])assert.ok(sql.includes(x),x);
 assert.equal(/update public\.official_predictions/i.test(sql),false);
 assert.equal(/update public\.official_races/i.test(sql),false);
 assert.equal(/update public\.chappy_predictions/i.test(sql),false);
});
