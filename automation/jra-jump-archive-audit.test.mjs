import test from "node:test";
import assert from "node:assert/strict";
import {inventoryJumpArchive} from "../supabase/functions/jra-jump-preflight/jra-jump-archive-audit.mjs";
const day="2026-11-21";
const horse={horse_no:1,horse_name:"Trial",horse_ref:"/JRADB/accessU.html?CNAME=pw01dud002018103590/EC"};
const row=(ref=horse.horse_ref, date="2026-08-29")=>({
  horse_name:"Trial",horse_ref:ref,record_role:"full_runner",
  source_kind:"jra_public_reference",source_ref:"pw01sde1004202603030120260829/2B",finish:1,
  jra_lab_races:{race_date:date,track:"新潟",race_no:1,surface:"障害",full_field:true,
    archive_complete:false,source_ref:"pw01sde1004202603030120260829/2B"}
});
const invoke=rows=>inventoryJumpArchive({race:{race_date:day},liveRunners:[horse],rows});
test("exact official ID match is supported even when checksum suffix differs",()=>{
 const r=invoke([row("/JRADB/accessU.html?CNAME=pw01dud102018103590/XX")]);
 assert.equal(r.exact_id_anchored_jumps,1);
 assert.equal(r.runners[0].full_history_verified,false);
});
test("null horse id is not silently treated as an exact identity",()=>{
 const r=invoke([row(null)]);assert.equal(r.exact_id_anchored_jumps,0);
 assert.equal(r.name_only_ref_missing_jumps,1);
});
test("different horse identity despite same display name is rejected",()=>{
 const r=invoke([row("/JRADB/accessU.html?CNAME=pw01dud102022000001/AA")]);
 assert.equal(r.exact_id_anchored_jumps,0);
 assert.equal(r.runners[0].rejected_or_duplicate_rows,1);
});
test("same-race duplicated archive row cannot count twice",()=>{
 const r=invoke([row(),row()]);
 assert.equal(r.exact_id_anchored_jumps,1);
 assert.equal(r.runners[0].rejected_or_duplicate_rows,1);
});
test("wrong source checksum or unfinished field never counts as a race proof",()=>{
 const p=row();p.jra_lab_races.source_ref="FAKE";
 const r=invoke([p]);
 assert.equal(r.exact_id_anchored_jumps,0);
});
test("today's target result is excluded even if indexed in an untrusted row",()=>{
 const r=invoke([row(horse.horse_ref,day)]);
 assert.equal(r.exact_id_anchored_jumps,0);
});
test("flat source cannot enter obstacle archive",()=>{
 const p=row();p.jra_lab_races.surface="芝";
 assert.equal(invoke([p]).exact_id_anchored_jumps,0);
});
test("unknown complete career never promoted by a single archived win",()=>{
 const r=invoke([row()]);
 assert.equal(r.full_history_verified,false);
});
test("current source maximum is calculated from rows rather than inventing it",()=>{
 const r=invoke([row()]);
 assert.equal(r.latest_observed_archived_jump_date,"2026-08-29");
});
test("unbounded archive pagination fails closed",()=>{
 assert.throws(()=>invoke(Array.from({length:1001},()=>row())),/JUMP_ARCHIVE_SCOPE_UNVERIFIED/);
});
