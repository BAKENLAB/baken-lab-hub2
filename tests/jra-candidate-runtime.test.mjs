// Executes complete candidate index and its real domain modules. OAuth/MCP SDK,
// Zod, Supabase transport, private Eval data and optional LOCAL helper are test doubles.
// NOT an HTTP/OAuth/Deno/prod-provider certification. SQL is tested separately in PG17.
import test from 'node:test';
import assert from 'node:assert/strict';
import {saveInIsolatedPostgres} from './jra-real-save-adapter.mjs';
import {stripTypeScriptTypes} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=new URL('../research/jra-scoring-integrity-20261121/',import.meta.url);
const time=process.env.JRA_TEST_REAL_PG==='1'?new Date().toISOString():'2026-11-22T00:00:00Z',job='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002';
function fixture(){
 const rows=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:'馬'+(i+1),past_runs:[{source_ref:'/JRADB/accessS.html?CNAME=synthetic'+i,race_date:'2026-11-01',track:'東京',surface:'芝',distance:1800,race_class:'未勝利',margin_to_winner:0.3,corner_positions:[7,6,4,4],final3f:35.2,going:'良',finish:4}]}));
 const runners=rows.map((h,i)=>({horse_no:h.horse_no,horse_name:h.horse_name,rank:6-i,score:38+i*5,grade:'B',reason:'テスト専用の確認済み項目として合成した根拠記述であり実馬評価ではありません。',status:'ACTIVE'}));
 const context={job_id:job,protocol_version:'SYNTHETIC_PROTOCOL',stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',race:{race_date:'2026-11-22',track:'東京',race_no:1,post_time:'2026-11-22T02:00:00Z',field_payload:{official_status_verification:{verified:true,fixture_only:true},race:{race_type:'平地',surface:'芝',distance:1800},runners}},runner_history:rows,candidates:rows.map((h,i)=>({horse_no:h.horse_no,horse_name:h.horse_name,base_rank:i+1,base_rate:(i*5)/38})),runner_content_status:'READY',runner_content_evidence:rows.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,history:h.past_runs.map(p=>({source_kind:'LIVE',base_facts_available:true,raw_history_match_count:1,prior_date:p.race_date,prior_track:p.track,prior_surface:p.surface,prior_distance:p.distance,finish:p.finish,margin_to_winner:p.margin_to_winner,live_corner_positions:[7,6,4,4],final3f:35.2,final3f_source:'LIVE_PAST_RUN_FALLBACK',live_going:'良',field_size:12}))}))};
 const reason='前走芝1800m4着0.3秒差、通過順7-6-4-4・上がり35.2秒、着順のみでなく位置上昇と脚を確認して相対比較した結果を採点した。';
 const payload={runners,top5:[...runners].sort((a,b)=>a.rank-b.rank).slice(0,5),eye:null,bets:[],summary:'SYNTHETIC_ONLY',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{protocol_version:'SYNTHETIC_PROTOCOL',validated_core:'BASE_CORE_0.1',score_method:'SYNTHETIC_SCORE_CONTRACT_TEST_ONLY',full_depth_comparison:true,all_runners_checked:true,outside_top5_reaudited:true,eye_pool_checked:[1],rank6_auto_selected:false,market_used_for_ranking:false,market_used_for_eye:false,target_result_used:false,market_fields_excluded:true,eval_normal_relations_checked:1942,runner_history_checked:rows.map((h,i)=>({horse_no:h.horse_no,history_count:1,rank_before:i+1,rank_after:6-i,score_after:38+i*5,base_score:30+i*5,reason,source_refs:[h.past_runs[0].source_ref],evidence_effects:['margin','corners','last3f','class','distance','going'].map((kind,j)=>({kind,source_ref:h.past_runs[0].source_ref,points:[2,1,1,1,1,2][j]}))})),rank_review_before_eval:{review_scope:'ALL_6_ACTIVE',base_core_order:[1,2,3,4,5,6],independent_reassessment_order:[6,5,4,3,2,1],reason}}};
 payload.audit.eye_fill_review={version:'JRA_TURF_SHORT_FILL_NULL_20261115',baseline_eye:null,protocol_version:'SYNTHETIC_PROTOCOL',race:{race_date:context.race.race_date,track:'東京',race_no:1,post_time:context.race.post_time},evaluated_at:time,all_runners:runners.map(({horse_no,horse_name,rank,reason})=>({horse_no,horse_name,rank,reason})),outside_top5:[{horse_no:1,horse_name:'馬1',rank:6,positive_factors:[],risks:['合成例では独立肯定因子が足りない'],missing:[],decision_reason:'独立した肯定根拠二件を満たさず未選出',concrete_upside_reason:'合成例に選出を支持する十分な根拠なし'}],comparisons:[],selection_reason:'TOP5外は一頭のみで独立二因子不足により未選出',selected_horse_no:null};
 context.race.race_date=new Date(Date.parse(time)+9*3600000).toISOString().slice(0,10);context.race.post_time=new Date(Date.parse(time)+30*60000).toISOString();payload.audit.eye_fill_review.race={race_date:context.race.race_date,track:'東京',race_no:1,post_time:context.race.post_time};
 return {context,payload};
}
async function execute(x,{denied=false,saveError=false,methodContract='SYNTHETIC_SCORE_CONTRACT_TEST_ONLY',basePolicy='JRA_RESEARCH_BASE_30PLUS38_V1'}={}){
 const dir=mkdtempSync(join(tmpdir(),'jra-runtime-')),calls=[],RealDate=Date;
 try{
  for(const name of readdirSync(new URL('baseline/mcp/',root)).filter(n=>n.endsWith('.mjs.txt')))
   writeFileSync(join(dir,name.slice(0,-4)),readFileSync(new URL('baseline/mcp/'+name,root)));
  writeFileSync(join(dir,'eval-course-transfer-live.mjs'),readFileSync(new URL('integration-validation/eval-course-transfer-candidate.mjs',root)));
  const courses=[['東京','芝','',1800]];
  for(const track of ['札幌','函館','福島','新潟','中山','中京','京都','阪神','小倉'])for(let d=1000;d<=3600;d+=100)courses.push([track,'芝','',d]);
  const fakeCache={v:'2026-11-13',observed_at:'2026-11-13T21:30:21Z',scope:'NORMAL_ALL_1942',targets:courses.slice(0,82),sources:courses.slice(0,94),pairs:[]};
  for(let t=0;t<82;t++)for(let s=0;s<(t<56?24:23);s++)fakeCache.pairs.push([t,s,5,s+1]);
  writeFileSync(join(dir,'eval-course-private-data.mjs'),'export const PRIVATE_EVAL_PRIORITIES='+JSON.stringify(fakeCache)+';'); // Synthetic schema fixture ONLY, no real licensed data.

  writeFileSync(join(dir,'local-verified-condition-bridge.mjs'),"export function resolveLocalOfficialClassLiteral(){throw Error('UNTESTED_LOCAL_PATH');}");
  for(const [to,from] of [['jra-official-queue-read.mjs','official-queue-read.mjs'],['jra-card-observation.mjs','card-observation.mjs']])writeFileSync(join(dir,to),readFileSync(new URL('../automation/jra-score-ledger/'+from,import.meta.url)));
  // Every unapproved call fails closed. No network, actual CLAIM or production write.
  let stored;
  const c={auth:{getUser:async()=>({data:{user:{id:denied?'wrong':user}},error:null})},rpc(name,args){calls.push(name);let data,error=null;
   if(name==='jra_claimed_context')data=structuredClone(x.context);
   else if(name==='jra_save_claimed_prediction_with_shadow_v1'){
    if(saveError)error={message:'SIMULATED_SQL_REJECTION'};
    else if(process.env.JRA_TEST_REAL_PG==='1'){const saved=saveInIsolatedPostgres(args,x.context);stored=saved.stored;data=saved.receipt;}
    else {stored={id:job,status:'FROZEN',payload:structuredClone(args.p_payload)};data={ok:true,prediction_id:job,shadow_status:'NOT_PROVIDED'};}
   }else throw Error('FORBIDDEN_RPC_'+name);
   const value={data,error};return {then:resolve=>Promise.resolve(value).then(resolve),abortSignal:async()=>value};
  },from(table){if(table==='lab_course_jra_transfer_v1'){const q={select:()=>q,eq:()=>q,limit:async()=>({data:x.ownedTransferStats??[],error:null})};return q;}if(table!=='official_predictions')throw Error('FORBIDDEN_TABLE_'+table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:stored,error:null})};return q;}};
  globalThis.__runtime={c,tools:new Map(),handler:null};
  writeFileSync(join(dir,'transport.mjs'),`const h=globalThis.__runtime;
   export class McpServer {registerTool(name,schema,fn){h.tools.set(name,fn)}}
   export const createMcpHandler=init=>{init();return {fetch:async()=>new Response('synthetic transport')}};
   export const pipeline=(middleware,fn)=>fn;
   export const withOAuthProtectedResource=()=>null,withSupabase=()=>null,createClient=()=>h.c;
   const chain=new Proxy(()=>chain,{get:()=>chain,apply:()=>chain}); export const z=chain;
   export const load=()=>{throw Error('NETWORK_HTML_PATH_UNTESTED')};`);
  globalThis.Deno={env:{get:key=>({LOCAL_MCP_ALLOWED_USER_ID:user,SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_NOT_A_KEY',JRA_RESEARCH_SCORE_METHOD_CONTRACT:methodContract,JRA_RESEARCH_BASE_POLICY_ID:basePolicy})[key]},serve:fn=>{globalThis.__runtime.handler=fn;}};
  globalThis.Date=class extends RealDate {constructor(...a){super(...(a.length?a:[time]));}static now(){return RealDate.parse(time);}};
  const candidateIndex=process.env.JRA_TEST_V42_REBASE==='1'
    ?'v42-rebase/candidate-index.ts.txt':'blocker-resolution/candidate-index.ts.txt';
  let source=readFileSync(new URL(candidateIndex,root),'utf8');
  source=source.replace(/^import "jsr:[^\n]+\n/gm,'').replace(/from "npm:[^"]+"/g,'from "./transport.mjs"');
  writeFileSync(join(dir,'index.mjs'),stripTypeScriptTypes(source));
  await import(pathToFileURL(join(dir,'index.mjs')));
  await globalThis.__runtime.handler(new Request('http://localhost.invalid/mcp'),{supabase:c});
  const result=await globalThis.__runtime.tools.get('jra_save_claimed_prediction')({job_id:job,protocol_version:'SYNTHETIC_PROTOCOL',payload:structuredClone(x.payload)});
  return {result,calls,stored,toolCount:globalThis.__runtime.tools.size};
 }finally{globalThis.Date=RealDate;delete globalThis.Deno;delete globalThis.__runtime;rmSync(dir,{recursive:true,force:true});}
}
test('complete candidate index executes full-depth -> actual bridge -> null EYE -> save/readback through synthetic transport',async()=>{
 const x=fixture(),before=structuredClone(x),r=await execute(x);
 assert.equal(r.result.isError,undefined,JSON.stringify(r.result));assert.equal(r.result.structuredContent.ok,true);
 assert.equal(r.result.structuredContent.db_frozen_evidence_verification,'VERIFIED_FROZEN_SCORES_TOP5_AUDIT_EMPTY_BETS');
 assert.equal(r.stored.payload.audit.full_depth_source_review.ok,true);assert.equal(r.stored.payload.eye,null);
 const fields=rows=>rows.map(({horse_no,horse_name,rank,score,grade,reason})=>({horse_no,horse_name,rank,score,grade,reason})).sort((a,b)=>a.horse_no-b.horse_no);
 assert.deepEqual(fields(r.stored.payload.runners),fields(x.payload.runners));assert.deepEqual(x,before);
 assert.equal(r.calls.filter(n=>n==='jra_save_claimed_prediction_with_shadow_v1').length,1);assert.ok(r.toolCount>=6);
});

test('candidate refuses missing method declaration, method drift, and missing full-depth declaration before save',async()=>{
 const noMethod=fixture();delete noMethod.payload.audit.score_method;
 const a=await execute(noMethod);
 assert.equal(a.result.isError,true);assert.equal(a.stored,undefined);
 assert.ok(!a.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
 const drift=fixture();drift.payload.audit.score_method='UNREVIEWED_NEW_METHOD';
 const b=await execute(drift);
 assert.equal(b.result.isError,true);assert.equal(b.stored,undefined);
 assert.ok(!b.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
 const noFullDepth=fixture();delete noFullDepth.payload.audit.full_depth_comparison;
 const c=await execute(noFullDepth);
 assert.equal(c.result.isError,true);assert.equal(c.stored,undefined);
 assert.ok(!c.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
 // Explicitly clear the server-only pin: the request's claimed method cannot authorize itself.
 const unapproved=await execute(fixture(),{methodContract:''});
 assert.equal(unapproved.result.isError,true);assert.equal(unapproved.stored,undefined);
 assert.ok(!unapproved.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
});



test('all 65 real Nov15/21/22 FROZEN method and depth audit records expose historical continuity drift',async()=>{
 const source=readFileSync(new URL('../research/jra-scoring-integrity-20261121/baseline/mcp/jra-score-method-continuity.mjs.txt',import.meta.url),'utf8');
 const {inspectScoreMethodContinuity}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const saved=JSON.parse(readFileSync(new URL('../research/jra-scoring-integrity-20261121/observations/jra-method-drift-nov15-21-22-readonly.json',import.meta.url)));
 assert.equal(saved.classification,'READONLY_HISTORICAL_FROZEN_AUDIT_FIELDS_NOT_SOURCE_AUTHENTICITY_PROOF');
 assert.equal(saved.rows.length,65);
 const byDay={};
 for(const r of saved.rows){
   assert.equal(typeof r.frozen_jst,'string');
   const payload={audit:{score_method:r.declared_method,
     full_depth_comparison:r.legacy_depth_true===true}};
   const decision=inspectScoreMethodContinuity({payload,
     approvedMethod:'MANUAL_WHOLE_FIELD_EVIDENCE_ASSESSMENT'});
   const out=byDay[r.race_date]??{total:0,absentMethod:0,acceptedDeclarationOnly:0};
   out.total++;
   out.absentMethod+=Number(decision.reason==='SCORE_METHOD_MISSING');
   out.acceptedDeclarationOnly+=Number(decision.ok);
   byDay[r.race_date]=out;
   if(r.race_date==='2026-11-22'){
     assert.equal(decision.ok,false);
     assert.equal(decision.reason,'SCORE_METHOD_MISSING');
     assert.equal(r.claimed_source_review_ok,true);
   }
   if(decision.ok){assert.equal(decision.score_reproduced,false);
     assert.equal(decision.formal_scoring_allowed,false);}
 }
 assert.deepEqual(byDay,{
   '2026-11-15':{total:27,absentMethod:0,acceptedDeclarationOnly:26},
   '2026-11-21':{total:20,absentMethod:0,acceptedDeclarationOnly:0},
   '2026-11-22':{total:18,absentMethod:18,acceptedDeclarationOnly:0}
 });
});

test('actual Nov22 morning FROZEN cannot pass research method-continuity gate by claiming full-depth alone',async()=>{
 const source=readFileSync(new URL('../research/jra-scoring-integrity-20261121/baseline/mcp/jra-score-method-continuity.mjs.txt',import.meta.url),'utf8');
 const {inspectScoreMethodContinuity}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const archived=[1,2].flatMap(i=>JSON.parse(readFileSync(new URL('../research/jra-scoring-integrity-20261121/final-provider/morning-20261122-part-'+i+'.json',import.meta.url))).rows);
 assert.equal(archived.length,6,'real archived morning fixture must remain six frozen races');
 for(const frozen of archived){
   assert.equal(frozen.payload.audit.full_depth_source_review.ok,true,'historically claimed full-depth review');
   const decision=inspectScoreMethodContinuity({payload:frozen.payload,approvedMethod:'RESEARCH_PIN_ONLY'});
   assert.equal(decision.ok,false,JSON.stringify({track:frozen.track,race_no:frozen.race_no,decision}));
   assert.equal(decision.reason,'SCORE_METHOD_MISSING');
 }
});

test('candidate refuses even a numerically consistent full-depth payload if CLAIM base rate changes',async()=>{
  const x=fixture();
  x.context.candidates[0].base_rate=0.9;
  const r=await execute(x);
  assert.equal(r.result.isError,true);
  assert.equal(r.stored,undefined);
  assert.ok(!r.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
});
test('candidate refuses absent trusted server base-policy pin before save',async()=>{
  const r=await execute(fixture(),{basePolicy:''});
  assert.equal(r.result.isError,true);
  assert.equal(r.stored,undefined);
  assert.ok(!r.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
});

test('whole candidate rejects missing full-depth audit before any save',async()=>{
 const x=fixture();delete x.payload.audit.runner_history_checked;
 const r=await execute(x);assert.equal(r.result.isError,true);assert.equal(r.stored,undefined);assert.ok(!r.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
});
test('whole candidate auth refusal makes no RPC calls; SQL rejection never retries save',async()=>{
 const denied=await execute(fixture(),{denied:true});assert.equal(denied.result.isError,true);assert.deepEqual(denied.calls,[]);
 const rejected=await execute(fixture(),{saveError:true});assert.equal(rejected.result.isError,true);assert.equal(rejected.stored,undefined);assert.equal(rejected.calls.filter(n=>n==='jra_save_claimed_prediction_with_shadow_v1').length,1);
});

test('actual whole candidate EYE audit omission refuses before save',async()=>{
 const x=fixture();x.payload.audit.eye_fill_review.outside_top5=[];
 const r=await execute(x);assert.equal(r.result.isError,true);assert.ok(!r.calls.includes('jra_save_claimed_prediction_with_shadow_v1'));
});

test('actual whole candidate producer +1 reaches save/readback without changing ranks or grades',async()=>{
 const x=fixture();for(const h of x.context.runner_history)h.past_runs[0].finish=2;
 for(const h of x.context.runner_content_evidence)h.history[0].finish=2;
 x.ownedTransferStats=[{source_course_key:'東京|芝|1800|左',target_course_key:'東京|芝|1800|左',reliability:'HIGH',runners:200,top3_lift:1.2,condition_precision:'COARSE_NO_INNER_OUTER',training_to:'2025-12-31'}];
 const r=await execute(x);assert.equal(r.result.isError,undefined,JSON.stringify(r.result));
 assert.equal(r.result.structuredContent.score_changed_runner_count,6);
 for(const h of x.payload.runners){const after=r.stored.payload.runners.find(a=>a.horse_no===h.horse_no);assert.equal(after.score,h.score+1);assert.equal(after.rank,h.rank);assert.equal(after.grade,h.grade);}
 assert.equal(r.stored.payload.eye,null);
});
