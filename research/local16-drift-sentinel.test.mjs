import test from "node:test";
import assert from "node:assert/strict";
import {auditLocal16DailyDrift} from "../automation/local16-drift-sentinel.mjs";
const ver="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";
const row=(day,track,no,outsiders,factor_horses,suitability_checked,version=ver)=>({
 race_date:day,track,race_no:no,outsiders,factor_horses,suitability_checked,
 protocol_version:version,scorer_trace_verified:false
});
const yesterday=[9,10,7,7,6,9,9,6,8,9,10].map((out,i)=>
 row("2026-11-17","大井",i<2?i+1:i+2,out,
 [4,3,2,0,1,2,3,1,1,3,5][i],out));
const firstSeven=[7,6,8,8,6,9,9].map((out,i)=>
 row("2026-11-18","大井",i+1,out,0,[6,4,5,8,3,8,9][i]));
const lastFive=[6,7,8,7,8].map((out,i)=>
 row("2026-11-18","大井",i+8,out,[5,1,3,5,6][i],out));
test("Nov 18 Oi 1-7 documented 53 outsiders zero factors is caught",()=>{
 const f={baselineRaces:yesterday,currentRaces:firstSeven},before=structuredClone(f);
 const z=auditLocal16DailyDrift(f);
 assert.equal(z.review_required,true);
 assert.ok(z.alerts.some(a=>a.code==="CONSECUTIVE_EMPTY_POSITIVE_FACTORS_DESPITE_CHECKED_EVIDENCE"));
 assert.ok(z.alerts.some(a=>a.code==="SAME_TRACK_EYE_FACTOR_COVERAGE_COLLAPSE"));
 const streak=z.alerts.find(a=>a.code.startsWith("CONSECUTIVE"));
 assert.equal(streak.outsiders,53);
 assert.equal(streak.suitability_checked,43);
 assert.equal(streak.first_race,1);assert.equal(streak.last_race,7);
 assert.equal(z.results_used,false);assert.equal(z.market_used,false);
 assert.equal(z.rank_changed,false);assert.equal(z.eye_changed,false);assert.equal(z.frozen_modified,false);
 assert.deepEqual(f,before);
});
test("full Nov 18 Oi detects early collapse even if 8-12 improved",()=>{
 const z=auditLocal16DailyDrift({baselineRaces:yesterday,currentRaces:[...firstSeven,...lastFive]});
 assert.equal(z.diagnostics[0].current.positive_horses,20);
 assert.equal(z.diagnostics[0].current.outsiders,89);
 assert.ok(z.alerts.some(x=>x.code==="CONSECUTIVE_EMPTY_POSITIVE_FACTORS_DESPITE_CHECKED_EVIDENCE"));
 assert.equal(z.alerts.some(x=>x.code==="SAME_TRACK_EYE_FACTOR_COVERAGE_COLLAPSE"),false);
});
test("Nov 17 Oi reference has 25/90 factor coverage and doesn't alert on its own",()=>{
 const z=auditLocal16DailyDrift({baselineRaces:[],currentRaces:yesterday});
 assert.equal(z.diagnostics[0].current.positive_horses,25);
 assert.equal(z.diagnostics[0].current.outsiders,90);
 assert.equal(z.diagnostics[0].current.positive_coverage_pct,27.8);
 assert.equal(z.alerts.length,0);
});
test("streak stops on nonzero factors and cannot cross missing race number",()=>{
 const rows=[row("2026-11-18","大井",1,6,0,5),
 row("2026-11-18","大井",2,6,0,5),
 row("2026-11-18","大井",4,6,0,5),
 row("2026-11-18","大井",5,6,0,5)];
 const z=auditLocal16DailyDrift({baselineRaces:[],currentRaces:rows});
 assert.equal(z.review_required,false);
});
test("all-zero factors in three consecutive races require manual review even without baseline",()=>{
 const rows=[1,2,3].map(n=>row("2026-11-18","笠松",n,7,0,5));
 const z=auditLocal16DailyDrift({baselineRaces:[],currentRaces:rows});
 assert.equal(z.review_required,true);
});
test("CHECKED is not asserted as a genuine factor and no EYE is auto-selected",()=>{
 const z=auditLocal16DailyDrift({baselineRaces:yesterday,currentRaces:firstSeven});
 assert.equal(z.diagnostics[0].current.evidence_checked,43);
 assert.equal(z.diagnostics[0].current.positive_horses,0);
 assert.equal(z.eye_changed,false);
});
test("same-track comparison never compares Oi baseline to a different track",()=>{
 const rows=[1,2,3].map(n=>row("2026-11-18","園田",n,8,1,7));
 const z=auditLocal16DailyDrift({baselineRaces:yesterday,currentRaces:rows});
 assert.equal(z.alerts.some(x=>x.code==="SAME_TRACK_EYE_FACTOR_COVERAGE_COLLAPSE"),false);
 assert.equal(z.diagnostics[0].baseline,null);
});
test("version drift explicitly reported without changing any prediction",()=>{
 const rows=[row("2026-11-18","大井",1,8,2,5,"UNAPPROVED_1.7")];
 const z=auditLocal16DailyDrift({baselineRaces:yesterday,currentRaces:rows});
 assert.ok(z.alerts.some(x=>x.code==="PROTOCOL_CHANGED_WITHOUT_APPROVED_BASELINE"));
 assert.equal(z.frozen_modified,false);
});
test("duplicate saved race key cannot be silently counted twice",()=>{
 const rows=[row("2026-11-18","大井",1,8,0,5)];
 const z=auditLocal16DailyDrift({baselineRaces:[],currentRaces:[...rows,...rows]});
 assert.equal(z.code,"SNAPSHOT_DUPLICATE");
});
test("invalid reported factor count fails closed",()=>{
 const z=auditLocal16DailyDrift({baselineRaces:[],currentRaces:[row("2026-11-18","大井",1,8,9,5)]});
 assert.equal(z.code,"SNAPSHOT_INVALID");
});
test("empty current batch is not a healthy result",()=>{
 const z=auditLocal16DailyDrift({baselineRaces:yesterday,currentRaces:[]});
 assert.equal(z.code,"SNAPSHOT_REQUIRED");
});
test("score ledger missing is reported but doesn't invent point differences",()=>{
 const z=auditLocal16DailyDrift({baselineRaces:yesterday,currentRaces:[...firstSeven,...lastFive]});
 assert.equal(z.diagnostics[0].current.score_ledger_missing_races,12);
 assert.match(z.limitations.join(" "),/deterministic 100-point scorer/);
});
