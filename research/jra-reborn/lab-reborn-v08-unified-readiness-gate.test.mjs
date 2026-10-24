import test from "node:test";
import assert from "node:assert/strict";
import {auditUnifiedRebornReadiness} from "./lab-reborn-v08-unified-readiness-gate.mjs";

const sourceLock={
 race_date:"2026-10-24",track:"東京",race_no:10,
 saved_at:"2026-10-24T03:21:47Z",source_post_time:"2026-10-24T06:01:00Z",
 payload:{field_size:6,runners:Array.from({length:6},(_,i)=>({
  horse_no:i+1,horse_name:"TEST_"+(i+1),
  history:[{race_date:"2026-09-12",finish:3}]
 }))}
};
const source=sourceLock.payload.runners;
const allAxes=Object.fromEntries(["peak","form","course_fit","race_content","rival_strength"].map(k=>[k,60]));
const complete5={status:"RESEARCH_READY",runners:source.map(h=>({
 horse_no:h.horse_no,horse_name:h.horse_name,score:65,axes:allAxes}))};
const historyAudit={status:"VERIFIED_COMPLETE_AVAILABLE_ASOF",runner_count:6,unresolved_identities:0,gaps_between_recent_and_archive:0};
const gradeAudit={status:"VERIFIED_ASOF",runner_count:6,unknown_used_as_known:0};
const v04={status:"RESEARCH_READY",model:"LAB_REBORN_V04_ASOF_2024_FIT",runners:source};
const v05={status:"RESEARCH_READY",model:"LAB_REBORN_V05_2024_LOCKED_CONTENT",runners:source};
const v06={status:"RESEARCH_READY",model:"LAB_REBORN_0.6_RESEARCH_DIAGNOSTIC",
 runners:source,computed_uplift:true,rank_changes_from_v04:2};
const integrationAudit={status:"FROZEN_PRESTART_UNIFIED",runner_count:6,
 all_axes_in_scoring:true,coefficients_locked_before_holdout:true,
 snapshot_saved_at:"2026-10-24T05:17:02Z"};
const all={sourceLock,fiveAxisOutput:complete5,historyAudit,gradeAudit,
 v04Output:v04,v04Parity:{source_archive_parity:true},v05Output:v05,
 v05Validation:{independent_holdout_supported:true},
 v06Output:v06,v06Validation:{independent_holdout_supported:true},
 integrationAudit};
const j=x=>JSON.parse(JSON.stringify(x));

test("blank input is not a validated integrated model",()=>{
 const r=auditUnifiedRebornReadiness();
 assert.equal(r.status,"INCOMPLETE_REBORN_REBUILD");
 assert.equal(r.top5_publishable_as_full_reborn,false);
});
test("even fully-scored v03 with absent opponent axis is not complete",()=>{
 const r=auditUnifiedRebornReadiness({sourceLock,fiveAxisOutput:{
  status:"RESEARCH_READY",runners:complete5.runners.map(x=>({...x,axes:{...x.axes,rival_strength:null}}))}});
 assert.equal(r.gates.five_axis_sources.ok,false);
 assert.equal(r.evidence_coverage.axis_counts.rival_strength,0);
});
test("v06 research readiness with zero-delta MUST be treated as diagnostic",()=>{
 const r=auditUnifiedRebornReadiness({...all,v06Output:{...v06,computed_uplift:false,rank_changes_from_v04:0}});
 assert.equal(r.gates.clock_rival_integration.ok,false);
 assert.equal(r.comparison_as_full_reborn_allowed,false);
});
test("v04 proxy alone is NOT merged v03/05/06",()=>{
 const r=auditUnifiedRebornReadiness({sourceLock,v04Output:v04,
 v04Parity:{source_archive_parity:true}});
 assert.equal(r.top5_publishable_as_full_reborn,false);
 assert.equal(r.gates.five_axis_sources.ok,false);
});
test("late stored inputs are rejected even with other attestations",()=>{
 const r=auditUnifiedRebornReadiness({...all,sourceLock:{...sourceLock,
 saved_at:"2026-10-24T07:00:00Z"}});
 assert.equal(r.gates.immutable_asof_input.ok,false);
});
test("forward history in a source packet is rejected",()=>{
 const p=j(sourceLock);p.payload.runners[0].history[0].race_date="2026-10-25";
 assert.equal(auditUnifiedRebornReadiness({...all,sourceLock:p}).gates.immutable_asof_input.ok,false);
});
test("missing history verification blocks false complete verdict",()=>{
 const r=auditUnifiedRebornReadiness({...all,historyAudit:{...historyAudit,gaps_between_recent_and_archive:1}});
 assert.equal(r.gates.history_complete.ok,false);
});
test("unverified GI/GII/GIII tiers block full model claim",()=>{
 const r=auditUnifiedRebornReadiness({...all,gradeAudit:{...gradeAudit,unknown_used_as_known:1}});
 assert.equal(r.gates.graded_race_provenance.ok,false);
});
test("model-specific v05 unvalidated uplift cannot masquerade as integrated",()=>{
 const r=auditUnifiedRebornReadiness({...all,v05Validation:{independent_holdout_supported:false}});
 assert.equal(r.gates.content_v05_validated.ok,false);
});
test("rank snapshot computed after the off is not prospective",()=>{
 const r=auditUnifiedRebornReadiness({...all,integrationAudit:{...integrationAudit,
 snapshot_saved_at:"2026-10-24T07:00:00Z"}});
 assert.equal(r.gates.unified_scoring.ok,false);
});
test("all 8 separate provenance and validation guards needed",()=>{
 const r=auditUnifiedRebornReadiness(all);
 assert.equal(r.failures.length,0);
 assert.equal(r.status,"VERIFIED_UNIFIED_REBORN_RESEARCH");
 assert.equal(r.official_production_write,false);
});
test("target result, old ranks, and odds are irrelevant to the gate",()=>{
 const base=auditUnifiedRebornReadiness(all);
 const altered=auditUnifiedRebornReadiness({...all,old_lab_rank:1,
  odds:{one:1.1},actual_result:{winner:1}});
 assert.deepEqual(base,altered);
});
