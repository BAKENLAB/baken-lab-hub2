import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,LEGACY_VERSION,GUARD,CHECKS,selectLocalEye,assertLocalEyeForSave,assertLocalSaveDuringTransition} from './candidate/local-claimed-mcp/local-eye.mjs';
import {readFileSync} from 'node:fs';
function fixture(best=8,n=12){
 const runners=Array.from({length:n},(_,i)=>({horse_no:i+1,horse_name:'fixture馬'+(i+1),rank:i+1,grade:'C'}));
 const outside=runners.slice(5),candidates=outside.map(r=>({horse_no:r.horse_no,rank:r.rank,
  upside_trigger:`馬${r.horse_no}は1600mから勝利実績のある1400mへ短縮`,
  hidden_evidence:`馬${r.horse_no}は前々走1400mで0.2秒差、通過順5-4-2`,
  finish_path:`馬${r.horse_no}は同型の先行馬が少ない条件で距離適性を再現`,
  risk:`馬${r.horse_no}は休み明けのため再現性に不確実性`,eye_case:best!==null,
  evidence_refs:[`fixture:horse:${r.horse_no}:run:1`],
  review_checks:Object.fromEntries(CHECKS.map(k=>[k,{status:'CHECKED',
    finding:`fixture馬${r.horse_no}の${k}を公式出馬表と前走で確認`,
    evidence_refs:[`fixture:horse:${r.horse_no}:run:1`]}]))}));
 const pairs=[];for(let i=0;i<outside.length;i++)for(let j=i+1;j<outside.length;j++){
  const pair=[outside[i].horse_no,outside[j].horse_no];pairs.push({horse_nos:pair,
   preferred_horse_no:pair.includes(best)?best:null,criterion:'CURRENT_UPSIDE_OVER_BASELINE',
   reason:`馬${pair[0]}と馬${pair[1]}の距離適性回復と不発リスクを比較したfixture判断`,
   evidence_refs:pair.map(n=>`fixture:horse:${n}:run:1`)});
 }
 const eye=best===null?null:{...runners[best-1],reason:`馬${best}は1400mで0.2秒差実績へ条件戻りし、全候補との比較で最も確かな反転筋`};
 return {circuit:'LOCAL',protocol_version:VERSION,payload:{runners,top5:runners.slice(0,5),eye,bets:[],
  summary:'fixture only',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{protocol_version:VERSION,
   eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',rank6_auto_selected:false,market_used_for_eye:false,
   eye_selection_method:GUARD,eye_pool_checked:outside.map(r=>r.horse_no),eye_candidate_audit:candidates,
   eye_pairwise_comparison:pairs,eye_selected_rank:best,eye_abstention_reason:best===null?'十分な上振れ根拠を確認できない':null}}};
}
for(const [label,best]of [['A rank6',6],['B rank8',8],['C last',12],['D abstain',null]]){
 test(label,()=>{const x=fixture(best);assert.equal(selectLocalEye(x),best);assert.equal(assertLocalEyeForSave(x),true);});
}
test('rank ordered inputs do not default to sixth; permutation invariant',()=>{
 for(const best of [6,8,12,null]){const x=fixture(best);for(let i=0;i<12;i++){
  x.payload.runners.reverse();x.payload.audit.eye_pool_checked.reverse();x.payload.audit.eye_candidate_audit.reverse();
  x.payload.audit.eye_pairwise_comparison.reverse();
  x.payload.audit.eye_pairwise_comparison.forEach(c=>c.horse_nos.reverse());
  assert.equal(selectLocalEye(x),best);assert.equal(assertLocalEyeForSave(x),true);
 }}
});
test('normal ranks TOP5 bets and original payload are never mutated',()=>{
 const x=fixture(8),before=structuredClone(x);selectLocalEye(x);assertLocalEyeForSave(x);assert.deepEqual(x,before);
});
const rejects=[
 ['E missing candidate',x=>x.payload.audit.eye_candidate_audit.pop()],
 ['F auto rank6',x=>x.payload.audit.rank6_auto_selected=true],
 ['G odds evidence',x=>x.payload.audit.eye_candidate_audit[0].win_odds=4.5],
 ['G popularity reason',x=>x.payload.audit.eye_pairwise_comparison[0].reason='人気薄だから浮上'],
 ['G market use admitted',x=>x.payload.audit.market_used_for_eye=true],
 ['duplicate candidate',x=>x.payload.audit.eye_candidate_audit[1]=structuredClone(x.payload.audit.eye_candidate_audit[0])],
 ['missing pool',x=>x.payload.audit.eye_pool_checked.pop()],
 ['duplicate pool',x=>x.payload.audit.eye_pool_checked[1]=6],
 ['missing comparison',x=>x.payload.audit.eye_pairwise_comparison.pop()],
 ['duplicate comparison',x=>x.payload.audit.eye_pairwise_comparison[1]=structuredClone(x.payload.audit.eye_pairwise_comparison[0])],
 ['rank6 fallback',x=>{x.payload.eye={...x.payload.runners[5],reason:'6位だから'};x.payload.audit.eye_selected_rank=6;}],
 ['rank only criterion',x=>x.payload.audit.eye_pairwise_comparison[0].criterion='MINIMUM_RANK'],
 ['first reason',x=>x.payload.audit.eye_pairwise_comparison[0].reason='候補の先頭だから'],
 ['top5 selected',x=>x.payload.eye={...x.payload.runners[0],reason:'1400mに戻る'}],
 ['missing reason',x=>x.payload.eye.reason=''],
 ['candidate rank mismatch',x=>x.payload.audit.eye_candidate_audit[0].rank=7],
 ['missing draw check',x=>delete x.payload.audit.eye_candidate_audit[0].review_checks.draw],
 ['invented missing evidence',x=>{const c=x.payload.audit.eye_candidate_audit[0].review_checks.draw;c.status='MISSING';}],
 ['unlinked pair evidence',x=>x.payload.audit.eye_pairwise_comparison[0].evidence_refs=['unknown fact']],
 ['unapproved protocol',x=>x.protocol_version='CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930'],
 ['JRA rejected',x=>x.circuit='JRA'],
 ['unknown circuit',x=>x.circuit=undefined],
 ['null is not missing eye',x=>delete x.payload.eye],
 ];
for(const [name,change]of rejects)test(name,()=>{const x=fixture();change(x);assert.throws(()=>assertLocalEyeForSave(x),/^Error: LOCAL_EYE_/);});
test('all candidates tied abstains instead of first',()=>{
 const x=fixture();x.payload.audit.eye_pairwise_comparison.forEach(c=>c.preferred_horse_no=null);
 x.payload.eye=null;x.payload.audit.eye_selected_rank=null;x.payload.audit.eye_abstention_reason='比較で優劣を確定できない';
 assert.equal(selectLocalEye(x),null);assert.equal(assertLocalEyeForSave(x),true);
});
test('circular comparisons abstain',()=>{
 const x=fixture(null,8);x.payload.audit.eye_candidate_audit.forEach(c=>c.eye_case=true);
 const winner={'6:7':6,'6:8':8,'7:8':7};x.payload.audit.eye_pairwise_comparison.forEach(c=>c.preferred_horse_no=winner[c.horse_nos.join(':')]);
 assert.equal(selectLocalEye(x),null);assert.equal(assertLocalEyeForSave(x),true);
});
test('missing source data explicitly recorded; not silently invented',()=>{
 const x=fixture();x.payload.audit.eye_candidate_audit.forEach(c=>c.review_checks.draw={status:'MISSING',finding:'公式で取得不能',evidence_refs:[]});
 assert.equal(assertLocalEyeForSave(x),true);
});
test('five runners permits no EYE',()=>{const x=fixture(null,5);assert.equal(assertLocalEyeForSave(x),true);});
test('all 17 items missing across all outside horses allows explicit null without invented facts',()=>{
 const x=fixture(null);for(const c of x.payload.audit.eye_candidate_audit){
  c.evidence_refs=[];for(const key of CHECKS)c.review_checks[key]={status:'MISSING',finding:'公式contextに取得可能な情報なし',evidence_refs:[]};
  for(const key of ['upside_trigger','hidden_evidence','finish_path','risk'])c[key]='取得情報不足のため具体的上振れを確認不能';
 }
 x.payload.audit.eye_pairwise_comparison.forEach(c=>{c.evidence_refs=[];c.reason='両馬の確認可能な情報が不足し、優劣を判定できない';});
 assert.equal(selectLocalEye(x),null);assert.equal(assertLocalEyeForSave(x),true);
});
test('missing candidates never gain unsupported EYE preference',()=>{
 const x=fixture(8);const c=x.payload.audit.eye_candidate_audit.find(c=>c.horse_no===8);
 c.evidence_refs=[];for(const key of CHECKS)c.review_checks[key]={status:'MISSING',finding:'取得不能',evidence_refs:[]};
 assert.throws(()=>assertLocalEyeForSave(x));
});
test('sole outside candidate supported or abstain',()=>{
 assert.equal(assertLocalEyeForSave(fixture(6,6)),true);assert.equal(assertLocalEyeForSave(fixture(null,6)),true);
});
// Execute the actual patched save callback with local SDK/auth/claim/RPC stubs.
// This exercises guard placement before any credential/claim lookup or save RPC.
function savedCallback({activeVersion=VERSION}={}){
 const s=readFileSync(new URL('./candidate/local-claimed-mcp/index.ts',import.meta.url),'utf8');
 const start=s.indexOf('async({job_id,protocol_version,payload})=>',s.indexOf('s.registerTool("lab_save_claimed_prediction"'));
 const end=s.indexOf('});\n return s',start);
 assert.ok(start>0 && end>start);
 const src=s.slice(start,end+1);let rpcCount=0,adminCount=0,authorized=true;
 const c={rpc:async(name,args)=>{rpcCount++;assert.equal(name,'lab_save_claimed_prediction');
  if(args.p_protocol_version!==activeVersion)return {data:null,error:{message:'SAVE_PROTOCOL_MISMATCH'}};
  return {data:'11111111-1111-4111-8111-111111111111',error:null};}};
 const fn=Function('auth','admin','claim','uuid','err','assertLocalSaveDuringTransition','return ('+src+')')(
  async()=>{if(!authorized)throw Error('FORBIDDEN');},()=>{adminCount++;return {c};},
  async()=>({r:{id:'fixture-run'},j:{id:'fixture-job',claim_token:'fixture-internal-claim'}}),
  v=>typeof v==='string',e=>e.message,assertLocalSaveDuringTransition);
 return {fn,get calls(){return {rpcCount,adminCount};},deny(){authorized=false;}};
}
test('actual LOCAL save callback accepts valid comparison then invokes guarded RPC once',async()=>{
 const f=savedCallback(),x=fixture(8),before=structuredClone(x.payload);
 const out=await f.fn({job_id:'fixture-job',protocol_version:VERSION,payload:x.payload});
 assert.equal(out.structuredContent.ok,true);assert.deepEqual(f.calls,{rpcCount:1,adminCount:1});assert.deepEqual(x.payload,before);
});
for(const [name,change]of rejects.filter(([n])=>!['JRA rejected','unknown circuit','unapproved protocol'].includes(n))){
 test('save boundary rejects before RPC: '+name,async()=>{const f=savedCallback(),x=fixture();change(x);
  const out=await f.fn({job_id:'fixture-job',protocol_version:VERSION,payload:x.payload});
  assert.equal(out.isError,true);assert.deepEqual(f.calls,{rpcCount:0,adminCount:0});
  assert.ok(!JSON.stringify(out).includes('fixture-internal-claim'));
 });
}
test('actual save callback keeps auth before validation',async()=>{
 const f=savedCallback();f.deny();const out=await f.fn({job_id:'fixture-job',protocol_version:VERSION,payload:{}});
 assert.equal(out.content[0].text,'FORBIDDEN');assert.deepEqual(f.calls,{rpcCount:0,adminCount:0});
});
test('protocol diff changes only EYE sections and EYE workflow step',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./baseline/local-protocol.json',import.meta.url),'utf8'));
 const candidate=JSON.parse(readFileSync(new URL('./candidate/local-protocol.json',import.meta.url),'utf8'));
 for(const key of Object.keys(baseline.content).filter(k=>!['lab_eye','output','workflow'].includes(k)))
  assert.deepEqual(candidate.content[key],baseline.content[key],key);
 assert.deepEqual(candidate.content.output.top5_format,baseline.content.output.top5_format);
 assert.deepEqual(candidate.content.output.top_level_keys,baseline.content.output.top_level_keys);
 assert.equal(candidate.content.output.frozen_market_fields.bets,baseline.content.output.frozen_market_fields.bets);
 assert.equal(candidate.content.output.frozen_market_fields.bet_strategy,'SUSPENDED_FOR_ABILITY_STABILITY');
 const b=baseline.content.workflow.filter(s=>s!=='LAB EYEを1頭選定（6頭以上の場合）');
 const c=candidate.content.workflow.filter(s=>s!=='全候補を独立した上振れ根拠で比較し、最優位1頭またはEYE=nullを確定');assert.deepEqual(c,b);
});
test('actual LOCAL MCP context/auth/resolver are identical to production baseline',()=>{
 const b=readFileSync(new URL('./baseline/local-claimed-mcp-index.ts',import.meta.url),'utf8');
 let c=readFileSync(new URL('./candidate/local-claimed-mcp/index.ts',import.meta.url),'utf8');
 c=c.replace('import {assertLocalSaveDuringTransition} from "./local-eye.mjs";\n','')
  .replace('assertLocalSaveDuringTransition({circuit:"LOCAL",protocol_version,payload});','');
 assert.equal(c.trimEnd(),b.trimEnd());
});
function legacyFixture(){
 const x=fixture(6);x.protocol_version=LEGACY_VERSION;x.payload.audit.protocol_version=LEGACY_VERSION;
 delete x.payload.audit.eye_pairwise_comparison;delete x.payload.audit.eye_selection_method;
 delete x.payload.audit.market_used_for_eye;
 return x;
}
test('1.4 remains savable with 1.4 active before new guard rollout',async()=>{
 const x=legacyFixture(),before=structuredClone(x);assert.equal(assertLocalSaveDuringTransition(x),true);
 const f=savedCallback({activeVersion:LEGACY_VERSION});const out=await f.fn({job_id:'fixture-job',...x});
 assert.equal(out.structuredContent.ok,true);assert.deepEqual(x,before);
});
test('1.5 prepared but inactive cannot save through active-version RPC',async()=>{
 const x=fixture(),f=savedCallback({activeVersion:LEGACY_VERSION});
 const out=await f.fn({job_id:'fixture-job',...x});assert.equal(out.isError,true);assert.equal(out.content[0].text,'SAVE_REJECTED');
});
test('1.5 active permits valid 1.5 null',async()=>{
 const x=fixture(null),f=savedCallback();const out=await f.fn({job_id:'fixture-job',...x});assert.equal(out.structuredContent.ok,true);
});
test('stale 1.4 cannot save after active changes to 1.5',async()=>{
 const x=legacyFixture(),f=savedCallback();const out=await f.fn({job_id:'fixture-job',...x});assert.equal(out.isError,true);
});
for(const version of [LEGACY_VERSION,VERSION]){
 test('MARKET_SEPARATE rejected for '+version,()=>{const x=version===VERSION?fixture():legacyFixture();
  x.payload.bet_strategy='MARKET_SEPARATE';assert.throws(()=>assertLocalSaveDuringTransition(x),/BET_CONTRACT/);});
 test('non-empty bets rejected for '+version,()=>{const x=version===VERSION?fixture():legacyFixture();
  x.payload.bets=['buy'];assert.throws(()=>assertLocalSaveDuringTransition(x),/BET_CONTRACT/);});
}
test('unknown protocol rejected before claim lookup',async()=>{
 const x=legacyFixture();x.protocol_version='unknown';const f=savedCallback();
 const out=await f.fn({job_id:'fixture-job',...x});assert.equal(out.isError,true);assert.deepEqual(f.calls,{rpcCount:0,adminCount:0});
});
test('transition guard rejects non-seven-key payload',()=>{
 const x=legacyFixture();x.payload.extra=true;assert.throws(()=>assertLocalSaveDuringTransition(x),/PAYLOAD_KEYS/);
});
test('transition guard never accepts JRA',()=>{
 const x=legacyFixture();x.circuit='JRA';assert.throws(()=>assertLocalSaveDuringTransition(x),/LOCAL_ONLY/);
});
test('RPC SQL adds only supported version check; active and existing bet guards unchanged',()=>{
 const base=readFileSync(new URL('./baseline/lab_save_claimed_prediction.sql',import.meta.url),'utf8');
 let candidate=readFileSync(new URL('./review/local-save-rpc-transition-candidate.sql',import.meta.url),'utf8');
 candidate=candidate.replace('-- REVIEW ONLY. NOT APPLIED. No claim/deadline/FROZEN/bet guard is removed.\nBEGIN;\n','')
  .replace("  -- Both LOCAL contracts are prepared; active-version equality above stays mandatory.\n  IF v_protocol NOT IN ('CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930',\n    'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004') THEN\n    RAISE EXCEPTION 'SAVE_PROTOCOL_UNSUPPORTED';\n  END IF;\n",'')
  .replace(/\nCOMMIT;\n$/,'');
 assert.equal(candidate,base);
});
test('SQL trigger has version restriction and unchanged LOCAL early return',()=>{
 const s=readFileSync(new URL('./review/db-insert-guard-candidate.sql',import.meta.url),'utf8');
 assert.ok(s.includes("WHEN (NEW.circuit = 'LOCAL' AND NEW.protocol_version = '"+VERSION+"')"));
 assert.ok(s.includes("IF NEW.circuit IS DISTINCT FROM 'LOCAL' THEN RETURN NEW; END IF;"));
 assert.ok(s.includes("IF NEW.protocol_version IS DISTINCT FROM '"+VERSION+"' THEN\n  RETURN NEW;"));
});
