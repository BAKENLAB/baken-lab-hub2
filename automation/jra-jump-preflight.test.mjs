import test from "node:test";
import assert from "node:assert/strict";
import {assessJraJumpReadiness as run,K2_VERSION} from "../supabase/functions/jra-jump-preflight/jra-jump-preflight.mjs";
import {VERSION as ADAPTER_VERSION} from "./jra-jump-k2-adapter.mjs";
test("preflight protocol matches isolated real K2 adapter",()=>assert.equal(K2_VERSION,ADAPTER_VERSION));
const horses=(n=13,j=9)=>Array.from({length:n},(_,i)=>({
 horse_no:i+1,horse_name:"Runner "+(i+1),horse_ref:"pw01dud00"+(i<3?"2018":"2023")+"1000"+String(i+1).padStart(2,"0")+"/AA",
 past_runs:Array.from({length:4},(_,k)=>({race_class:i<j?"障害未勝利":"平地未勝利"}))
}));
const race={race_type:"障害",surface:"障害",race_date:"2026-11-21",track:"福島",race_no:4,distance:2770,field_size:13};
const good={race,queue:{status:"done"},liveRunners:horses(),official:null,protocols:[]};
test("today's 13 runners are counted from read-only JRA capture",()=>{
 const s=run(good);assert.equal(s.observed.live_runner_count,13);
 assert.equal(s.observed.recent_card_jump_runner_count,9);
 assert.deepEqual(s.observed.no_obstacle_run_in_recent_card_horse_nos,[10,11,12,13]);
});
test("no official dedicated receipt is never claimed as ready",()=>{
 const s=run(good);assert(s.reasons.includes("OFFICIAL_OBSTACLE_FIELD_UNPUBLISHED"));
 assert.equal(s.observed.current_official_obstacle_ready,false);
});
test("JRA_MAIN never counts as JRA_JUMP",()=>{
 const s=run({...good,protocols:[{protocol_key:"JRA_MAIN",version:K2_VERSION,is_active:true}]});
 assert(s.reasons.includes("JUMP_K2_PROTOCOL_INACTIVE"));
});
test("wrong profile version cannot grant proof",()=>{
 const s=run({...good,protocols:[{protocol_key:"JRA_JUMP",version:"OLD",is_active:true}]});
 assert(s.reasons.includes("JUMP_K2_PROTOCOL_INACTIVE"));
});
test("even apparently valid official and protocol cannot manufacture 365 day history",()=>{
 const s=run({...good,protocols:[{protocol_key:"JRA_JUMP",version:K2_VERSION,is_active:true}],
 official:{field_status:"BASIC_READY",field_payload:{race:{race_type:"障害",surface:"障害"},official_status_verification:{verified:true}}}});
 assert.equal(s.status,"BLOCKED_PRE_FREEZE");
 assert.equal(s.full_jockey_year_verified,false);
 assert.equal(s.numeric_score_certified,false);
});
test("flat race never enters jump workflow",()=>{
 const s=run({...good,race:{...race,race_type:"平地",surface:"芝"}});
 assert(s.reasons.includes("NOT_OBSTACLE_RACE"));
});
test("duplicate horse identity is flagged instead of silently accepted",()=>{
 const h=horses();h[12].horse_no=1;
 const s=run({...good,liveRunners:h});assert(s.reasons.includes("FIELD_IDENTITY_INCOMPLETE"));
});
test("all mutation and market claims remain false",()=>{
 const s=run(good);
 for(const key of ["ranking_authorized","claim_authorized","save_authorized","frozen_written","flat_jra_changed","cron_changed","market_used","target_result_used"])
  assert.equal(s[key],false,key);
});
test("cancellation or incomplete fetch remains unready",()=>{
 const s=run({...good,liveRunners:horses(11)});
 assert(s.reasons.includes("FIELD_IDENTITY_INCOMPLETE"));
});

test("real 2018-born obstacle horse requires birth-to-race annual calendar",()=>{
 const s=run(good);
 assert.equal(s.observed.earliest_runner_birth_year,2018);
 assert.equal(s.observed.required_annual_calendar_windows,9);
 assert.equal(s.observed.official_result_coverage_required_from,"2018-01-01");
 assert.equal(s.observed.jockey_complete_year_required_from,"2025-11-21");
 assert.equal(s.observed.historical_full_calendar_certified,false);
});
test("unsupported horse identity never produces a fabricated birth-year certificate",()=>{
 const h=horses();h[0].horse_ref="INVALID";
 const s=run({...good,liveRunners:h});
 assert(s.reasons.includes("HORSE_BIRTH_YEAR_UNVERIFIED"));
 assert.equal(s.observed.required_annual_calendar_windows,null);
});
