import {VERSION} from './jra-jump-k2-adapter.mjs';
import {buildJumpContext,createJumpWorkflow} from './jra-jump-workflow.mjs';
import {reconcileToday,predictionSnapshot,validatePrediction} from './hub-prediction-contract.mjs';
import assert from 'node:assert/strict';
const day='2026-01-01',at=day+'T02:00:00Z',post=day+'T02:30:00Z',key='20260101_福島_5R';
const copy=x=>JSON.parse(JSON.stringify(x));
const expect=(v,m='fixture assertion')=>{if(!v)throw Error(m)};
const make=()=>{
 const entries=Array.from({length:8},(_,i)=>({horse_no:i+1,horse_name:'Fixture '+(i+1),status:i===7?'CANCELLED':'ACTIVE',draw:i+1,horse_ref:'/JRADB/accessU.html?CNAME=pw01dud00202000000'+(i+1)+'/AA',jockey:'Fixture J '+(i+1),weight_carried:60}));
 // Format horse IDs as exactly ten digits, as in JRA CNAME.
 const id=e=>'202000000'+e.horse_no;
 entries.forEach(e=>e.horse_ref='/JRADB/accessU.html?CNAME=pw01dud00'+id(e)+'/AA');
 const rc={race_type:'障害',surface:'障害',distance:2750,class_name:'未勝利',cname:'fixture-card'};
 const stamp={verified:true,basis:'JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1',html_sha256:'a'.repeat(64),verified_at:day+'T01:59:30Z',runner_count:8,active_count:7};
 const raw={job:{id:'fixture-job',race_date:day,track:'福島',race_no:5,job_status:'CLAIMED',claimed_by:'JRA_JUMP_QUEUE',claimed_at:at,claim_token:'fixture-token',lease_until:day+'T02:15:00Z',worker_run_id:'fixture-worker'},worker:{id:'fixture-worker',worker_id:'JRA_JUMP_QUEUE',status:'RUNNING'},race:{race_date:day,track:'福島',race_no:5,circuit:'JRA',post_time:post,field_status:'BASIC_READY',prediction_status:'PENDING',field_payload:{race:rc,runners:entries,official_status_verification:stamp}},live:{...rc,id:'live',race_date:day,track:'福島',race_no:5,field_size:8},live_runners:entries.map(e=>({...e,past_runs:e.horse_no<=7?[{race_class:'障害未勝利',race_date:'2025-12-01',track:'福島',finish:e.horse_no}]:[]})),official_html:{race_key:key,cname:rc.cname,html_sha256:stamp.html_sha256,official_status_verified:true,runner_count:8},existing_prediction:false};
 const evidence={race_key:key,as_of_date:day,horses:entries.slice(0,7).map(e=>({horse_no:e.horse_no,horse_name:e.horse_name,horse_id:id(e),profile_verified:true,profile_complete:true,as_of_date:day,profile_source:'fixture-profile-'+e.horse_no,jump_start_count:1,runs:[{verified:true,source_ref:'fixture-result-'+e.horse_no,horse_id:id(e),race_date:'2025-12-01',race_type:'障害',track:'福島',class_name:'未勝利',distance:2750,field_size:10,finish:e.horse_no,result_status:'FINISHED',final_turn_pos:e.horse_no,gap_seconds:e.horse_no===7?1:3}],jockey:{name:e.jockey,verified:true,complete_365day_schedule:true,as_of_date:day,source_ref:'fixture-jockey-'+e.horse_no,starts:Array.from({length:30},(_,i)=>({verified:true,source_ref:'fixture-jockey-start-'+i,horse_id:'2021000'+String(i).padStart(3,'0'),race_type:'障害',race_date:'2025-11-01',jockey:e.jockey,result_status:'FINISHED',finish:i<(e.horse_no===7?20:8)?2:7}))}}))};
 const state={now:at,active:true,authorized:true,raw,evidence,calls:[],stored:null,ready:false,claimed:false,badReceipt:false};
 const proof={race_date:day,track:'福島',race_no:5,post_time:post,checked_at:stamp.verified_at,html_sha256:stamp.html_sha256,all_rows_reviewed:true,verification_basis:stamp.basis,race:rc,runners:entries};
 // Deterministic fixture hash, NOT a production implementation.
 const digest=async s=>{let h=2166136261;for(const ch of s) h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0').repeat(8)};
 const ports={authorize:async()=>{state.calls.push('auth');if(!state.authorized)throw Error('FORBIDDEN')},protocolActive:async()=>state.active,clock:()=>state.now,digest,
 fetchOfficialProof:async()=>{state.calls.push('official fetch');return copy(state.proof??proof)},
 publishVerified:async p=>{state.calls.push('READY');state.ready=true;return {ok:true,status:'BASIC_READY'}},
 claimNext:async()=>{expect(state.ready,'no READY');state.calls.push('CLAIM');state.claimed=true;return {claimed:true,job_id:raw.job.id}},
 readClaimBundle:async()=>{expect(state.claimed,'no CLAIM');state.calls.push('context');return copy(raw)},
 getVerifiedHistory:async()=>{state.calls.push('history');return copy(evidence)},
 saveClaimed:async a=>{expect(!state.stored,'immutable');expect(a.expected_claim_token===raw.job.claim_token,'token mismatch');expect(Date.parse(post)-Date.parse(state.now)>180000,'cutoff');expect(a.protocol_version===VERSION);state.calls.push('SAVE');state.stored={id:'fixture-prediction',race_key:key,status:'FROZEN',job_status:'DONE',protocol_version:VERSION,frozen_at:state.now,payload:copy(a.payload)};raw.job.job_status='DONE';raw.existing_prediction=true;return state.stored.id},
 readReceipt:async()=>{state.calls.push('receipt');return state.badReceipt?null:copy(state.stored)}
 };
 return {state,ports,w:createJumpWorkflow(ports),proof};
};
async function start(f){await f.w.publish({race_date:day,track:'福島',race_no:5});const c=await f.w.claim();return f.w.preview({job_id:c.job_id})}
function review(p){const o=p.rows.filter(r=>r.rank>5);return {version:VERSION,race_key:key,job_id:'fixture-job',market_used:false,target_result_used:false,runners:p.rows.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,rank:r.rank,reason:'Verified fixture horse history',grade:'C'})),eye_audit:o.map(r=>({horse_no:r.horse_no,reason:'Verified independent factors review'})),eye_pairs:o.flatMap((a,i)=>o.slice(i+1).map(b=>({a:a.horse_no,b:b.horse_no,preferred_horse_no:null,reason:'Verified fixture comparison'}))),eye:null,eye_reason:'No official candidate selected',summary:'Verified fixture evaluation'};}
const save=(f,p,r=review(p))=>f.w.save({job_id:'fixture-job',review_binding:p.review_binding,review:r});
const cases=[
 ['READY → CLAIM → all history → save → receipt → HUB',async()=>{const f=make(),p=await start(f);assert.equal(p.rows.length,7);assert.equal(typeof p.review_binding,'string');assert.ok(!JSON.stringify(p).includes('fixture-token'));const rec=await save(f,p);assert.equal(rec.confirmed,true);const payload=f.state.stored.payload;assert.equal(payload.top5.length,5);assert.equal(payload.bets.length,0);const row={id:rec.id,race_date:day,track:'福島',race_no:5,circuit:'JRA',protocol_version:VERSION,payload,integrity:{version:1,prediction_id:rec.id,saved:predictionSnapshot(payload)}};validatePrediction(row);const result=reconcileToday({date:day,predictions:[row],races:[{key:day+'|福島|5|JRA',race_date:day,track:'福島',race_no:5,circuit:'JRA',prediction_status:'FROZEN',prediction:row}]},day);assert.equal(result.races[0].prediction_status,'FROZEN');assert.deepEqual(result.races[0].prediction.payload.top5,payload.top5);assert.equal(f.state.calls.filter(x=>x==='history').length,2);assert.equal(f.state.calls.filter(x=>x==='SAVE').length,1);}],
 ['no authorization, no READY',async()=>{const f=make();f.state.authorized=false;await assert.rejects(()=>start(f),/FORBIDDEN/);assert.equal(f.state.ready,false)}],
 ['inactive JUMP protocol blocks all writes',async()=>{const f=make();f.state.active=false;await assert.rejects(()=>start(f),/PROTOCOL_INACTIVE/);assert.equal(f.state.ready,false)}],
 ['flat proof blocked before publish',async()=>{const f=make();f.state.proof={...f.proof,race:{...f.proof.race,race_type:'平地',surface:'芝'}};await assert.rejects(()=>start(f),/PUBLISH_PROOF/);assert.equal(f.state.ready,false)}],
 ['post deadline blocks before READY',async()=>{const f=make();f.state.now=day+'T02:30:01Z';await assert.rejects(()=>start(f),/PUBLISH_PROOF/);assert.equal(f.state.ready,false)}],
 ['unverified history is not first-time history',async()=>{const f=make();f.state.evidence.horses[0].profile_complete=false;await assert.rejects(()=>start(f),/PROFILE_COVERAGE/);assert.equal(f.state.stored,null)}],
 ['missing rider archive coverage',async()=>{const f=make();f.state.evidence.horses[0].jockey.complete_365day_schedule=false;await assert.rejects(()=>start(f),/JOCKEY_COVERAGE/)}],
 ['missing live entry',async()=>{const f=make();f.state.raw.live_runners.pop();await assert.rejects(()=>start(f),/FIELD_COUNT/)}],
 ['mismatched horse ID',async()=>{const f=make();f.state.evidence.horses[0].horse_id='wrong';await assert.rejects(()=>start(f),/PROFILE_COVERAGE/)}],
 ['series includes current race result',async()=>{const f=make();f.state.evidence.horses[0].runs[0].race_date=day;await assert.rejects(()=>start(f),/RUN_PROOF/)}],
 ['missing current card historical run',async()=>{const f=make();const h=f.state.evidence.horses[0];h.runs=[];h.jump_start_count=0;await assert.rejects(()=>start(f),/CARD_HISTORY_MISMATCH/)}],
 ['official hash mismatch',async()=>{const f=make();f.state.raw.official_html.html_sha256='b'.repeat(64);await assert.rejects(()=>start(f),/OFFICIAL_RECEIPT/)}],
 ['renewed claim invalidates old approved ranking',async()=>{const f=make(),p=await start(f);f.state.raw.job.claim_token='new-token';await assert.rejects(()=>save(f,p),/REVIEW_STALE/);assert.equal(f.state.stored,null)}],
 ['changed history invalidates old review',async()=>{const f=make(),p=await start(f);f.state.evidence.horses[0].runs[0].gap_seconds=4;await assert.rejects(()=>save(f,p),/REVIEW_STALE/);assert.equal(f.state.stored,null)}],
 ['expired claim stops save',async()=>{const f=make(),p=await start(f);f.state.raw.job.lease_until=at;await assert.rejects(()=>save(f,p),/CLAIM/);assert.equal(f.state.stored,null)}],
 ['after cutoff stops save',async()=>{const f=make(),p=await start(f);f.state.raw.job.lease_until=post;f.state.now=day+'T02:27:01Z';await assert.rejects(()=>save(f,p),/WINDOW/);assert.equal(f.state.stored,null)}],
 ['no rewrite after saved',async()=>{const f=make(),p=await start(f);await save(f,p);await assert.rejects(()=>save(f,p),/CLAIM_SOURCE/);assert.equal(f.state.calls.filter(x=>x==='SAVE').length,1)}],
 ['receipt missing not reported as success',async()=>{const f=make(),p=await start(f);f.state.badReceipt=true;await assert.rejects(()=>save(f,p),/RECEIPT_UNCONFIRMED/);assert.equal(f.state.calls.filter(x=>x==='SAVE').length,1)}],
 ['verified first-time profile distinct from missing coverage',async()=>{const f=make();const h=f.state.evidence.horses[0];h.runs=[];h.jump_start_count=0;f.state.raw.live_runners[0].past_runs=[];const p=await start(f);assert.equal(p.rows.find(r=>r.horse_no===1).observed_history,0)}]
];
for(const [name,fn] of cases){await fn();console.log('PASS',name);}
