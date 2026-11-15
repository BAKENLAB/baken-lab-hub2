import {VERSION,prepareJump,finalizeJump} from './jra-jump-k2-adapter.mjs';
import assert from 'node:assert/strict';
const now="2026-01-01T02:00:00Z";
function check(v,msg){if(!v)throw Error("JUMP_"+msg);}
function fixture(){const entries=Array.from({length:7},(_,i)=>({horse_no:i+1,horse_name:"Fixture "+(i+1),jockey:"J "+(i+1),status:"ACTIVE"}));return {race:{circuit:"JRA",race_type:"障害",surface:"障害",race_key:"fixture",race_date:"2026-01-01",class_name:"未勝利",distance:2750,track:"福島",post_time:"2026-01-01T02:30:00Z",field_status:"BASIC_READY",prediction_status:"PENDING"},claim:{status:"CLAIMED",worker_id:"JRA_JUMP_QUEUE",job_id:"fixture-job",race_key:"fixture",lease_until:"2026-01-01T02:15:00Z"},existing_prediction:false,official:{verified:true,basis:"JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1",race_key:"fixture",html_sha256:"a".repeat(64),checked_at:"2026-01-01T01:59:30Z",runner_count:7,active_count:7},entries,history:entries.map(e=>({horse_no:e.horse_no,horse_name:e.horse_name,coverage_verified:true,history_source:"fixture-card",runs:[{verified:true,source_ref:"fixture-"+e.horse_no,race_date:"2025-12-01",race_type:"障害",class_name:"未勝利",track:"福島",distance:2750,field_size:10,finish:e.horse_no,final_turn_pos:e.horse_no,gap_seconds:e.horse_no===7?1:3}],jockey_stats:{verified:true,jockey:e.jockey,as_of_date:"2026-01-01",source_ref:"fixture-rider",n:30,top3:e.horse_no===7?20:8,own_n:0,own_top3:0}}))};}
function reviewFor(c){const p=prepareJump(c,now),o=p.rows.filter(r=>r.rank>5);return {version:VERSION,race_key:"fixture",job_id:"fixture-job",market_used:false,target_result_used:false,runners:p.rows.map(x=>({horse_no:x.horse_no,horse_name:x.horse_name,rank:x.rank,reason:"Verified fixture history",grade:"C"})),eye_audit:o.map(x=>({horse_no:x.horse_no,reason:"Verified fixture outside review"})),eye_pairs:o.flatMap((x,i)=>o.slice(i+1).map(y=>({a:x.horse_no,b:y.horse_no,preferred_horse_no:null,reason:"Verified fixture pair review"}))),eye:null,eye_reason:"No formal candidate selected",summary:"Fixture summary"};}
const cases=[["full field and common seven keys",()=>{const c=fixture(),p=finalizeJump(c,now,reviewFor(c));check(p.runners.length===7&&p.top5.length===5&&Object.keys(p).length===7&&p.bets.length===0,"TEST");},null],
["reject flat",()=>{const c=fixture();c.race.race_type="平地";prepareJump(c,now);},"RACE_TYPE"],
["reject after post",()=>prepareJump(fixture(),"2026-01-01T02:30:01Z"),"WINDOW"],
["reject cutoff",()=>prepareJump(fixture(),"2026-01-01T02:28:00Z"),"WINDOW"],
["reject stale claim",()=>{const c=fixture();c.claim.lease_until=now;prepareJump(c,now);},"CLAIM"],
["reject existing FROZEN",()=>{const c=fixture();c.existing_prediction=true;prepareJump(c,now);},"RACE_STATE"],
["reject missing official",()=>{const c=fixture();c.official.verified=false;prepareJump(c,now);},"OFFICIAL"],
["reject missing history",()=>{const c=fixture();c.history.pop();prepareJump(c,now);},"HISTORY_COVERAGE"],
["reject future history",()=>{const c=fixture();c.history[0].runs[0].race_date="2026-01-01";prepareJump(c,now);},"HISTORY_ASOF"],
["reject ranking drift",()=>{const c=fixture(),r=reviewFor(c);r.runners[0].rank=2;finalizeJump(c,now,r);},"RUNNER_REVIEW_IDENTITY"],
["reject incomplete EYE pairs",()=>{const c=fixture(),r=reviewFor(c);r.eye_pairs=[];finalizeJump(c,now,r);},"EYE_PAIRS"],
["reject unsupported EYE",()=>{const c=fixture(),r=reviewFor(c);r.eye=1;finalizeJump(c,now,r);},"EYE_TWO_FACTORS"],
["reject odds used",()=>{const c=fixture(),r=reviewFor(c);r.market_used=true;finalizeJump(c,now,r);},"REVIEW"],
["reject bad jockey counts",()=>{const c=fixture();c.history[0].jockey_stats.own_top3=90;prepareJump(c,now);},"JOCKEY_STATS"],
["explicit EYE candidate supported",()=>{const c=fixture(),r=reviewFor(c),p=prepareJump(c,now);check(p.eye_candidates.includes(7),"TEST_CANDIDATE");r.eye=7;r.eye_reason="Independent prior close finish and rider record";check(finalizeJump(c,now,r).eye.horse_no===7,"TEST");},null]];
for(const [name,fn,expected] of cases){if(expected)assert.throws(fn,new RegExp('JUMP_'+expected),name);else fn();console.log('PASS',name);}
