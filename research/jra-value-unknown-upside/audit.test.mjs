import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLabValue} from "./audit.mjs";

const race={race_date:"2026-11-01",track:"京都",race_no:11,
  post_time:"2026-11-01T15:40:00+09:00",surface:"芝",distance:1400,
  class_name:"オープン",race_type:"平地",field_size:6};
const frozen={status:"FROZEN",frozen_at:"2026-11-01T10:00:00+09:00"};
const at="2026-11-01T13:00:00+09:00";
const histTime="2026-11-01T12:00:00+09:00";
const past=(date,distance,finish,margin,early=7) => ({
  race_date:date,track:"中山",surface:"芝",distance,finish,
  race_class:"未勝利",margin_to_winner:margin,early_pos:early});
function sample(){
 const runners=Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:"馬"+(i+1),rank:i+1,score:95-i,
  history_captured_at:histTime,past_runs:[]}));
 runners[5].past_runs=[past("2026-10-02",1200,1,0.6,2),
   past("2026-09-01",1500,2,0.5,1)];
 return {race:{...race},frozen:{...frozen},runners,as_of:at,
  market:{captured_at:"2026-11-01T12:50:00+09:00",
   runners:runners.map(x=>({horse_no:x.horse_no,win_odds:x.horse_no===6?103.3:5}))}};
}
test("Butterfly-like weapons and big odds are review only",()=>{
 const out=evaluateLabValue(sample());
 assert.equal(out.status,"READY_RESEARCH_ONLY");
 assert.deepEqual(out.price_watch.map(x=>x.horse_no),[6]);
 assert.ok(out.price_watch[0].evidence.includes("DECISIVE_NEAR_DISTANCE_WIN"));
 assert.ok(out.price_watch[0].evidence.includes("PROVEN_EARLY_POSITION"));
 assert.equal(out.price_watch[0].bet_recommendation,null);
 assert.deepEqual(out.bets,[]);
});
test("high odds without a proven weapon is not enough",()=>{
 const data=sample();data.runners[5].past_runs=[];
 assert.equal(evaluateLabValue(data).price_watch.length,0);
});
test("low odds lower price appeal while original rank remains unchanged",()=>{
 const data=sample();data.market.runners[5].win_odds=3.5;
 const out=evaluateLabValue(data);
 assert.equal(out.price_watch.length,0);
 assert.equal(out.no_price_review[0].price_band,"LOW_ODDS_OR_SHORT_PRICE");
 assert.equal(out.no_price_review[0].original_rank,6);
});
test("pre-market candidates exist even without market odds",()=>{
 const data=sample();data.market=null;
 const out=evaluateLabValue(data);
 assert.equal(out.status,"WAIT_MARKET");
 assert.equal(out.pre_market_candidates.length,1);
});
test("one race supporting multiple signals is still insufficient",()=>{
 const data=sample();data.runners[5].past_runs.pop();
 assert.equal(evaluateLabValue(data).pre_market_candidates.length,0);
});
test("recent repeated heavy defeats block candidate",()=>{
 const data=sample();
 data.runners[5].past_runs.unshift(past("2026-10-20",1400,11,2.2));
 data.runners[5].past_runs.unshift(past("2026-10-27",1400,12,2.0));
 assert.equal(evaluateLabValue(data).price_watch.length,0);
});
test("future-dated race history cannot be used",()=>{
 const data=sample();
 data.runners[5].past_runs=[past("2026-11-04",1200,1,0.6),
   past("2026-11-05",1500,2,0.2)];
 assert.equal(evaluateLabValue(data).price_watch.length,0);
});
test("not FROZEN blocks research",()=>{
 const data=sample();data.frozen.status="READY";
 assert.equal(evaluateLabValue(data).reason,"NO_VALID_PRE_RACE_FROZEN");
});
test("a FROZEN captured after evaluation is invalid",()=>{
 const data=sample();data.frozen.frozen_at="2026-11-01T14:00:00+09:00";
 assert.equal(evaluateLabValue(data).reason,"NO_VALID_PRE_RACE_FROZEN");
});
test("missing or post-race market data cannot be used",()=>{
 const data=sample();data.market.captured_at="2026-11-01T16:00:00+09:00";
 assert.equal(evaluateLabValue(data).status,"WAIT_MARKET");
});
test("late history refresh cannot be mistaken for a pre-race snapshot",()=>{
 const data=sample();data.runners[0].history_captured_at="2026-11-01T16:00:00+09:00";
 assert.equal(evaluateLabValue(data).reason,"UNVERIFIED_HISTORY_CAPTURE_TIME");
});
test("race that already started cannot be audited",()=>{
 const data=sample();data.as_of="2026-11-01T15:40:00+09:00";
 assert.equal(evaluateLabValue(data).reason,"POST_TIME_PASSED");
});
test("incomplete field is blocked",()=>{
 const data=sample();data.runners.pop();
 assert.equal(evaluateLabValue(data).reason,"INCOMPLETE_FIELD");
});
test("duplicate ranks are rejected",()=>{
 const data=sample();data.runners[0].rank=6;
 assert.equal(evaluateLabValue(data).reason,"INVALID_FROZEN_RUNNERS");
});
test("immutable input, no predicted win chance or bets",()=>{
 const data=sample(),before=JSON.stringify(data);
 const out=evaluateLabValue(data);
 assert.equal(JSON.stringify(data),before);
 assert.equal(out.original_prediction_unchanged,true);
 assert.equal(out.proposed_scores,null);
 assert.equal(out.price_watch[0].expected_value,null);
});
