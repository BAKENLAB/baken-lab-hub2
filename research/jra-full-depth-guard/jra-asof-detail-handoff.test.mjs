import test from "node:test";
import assert from "node:assert/strict";
import {restoreJraClaimedRunDetails} from "./jra-asof-detail-handoff.mjs";
function fixture(){
 const race={race_date:"2026-11-21"};
 const runner_history=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:"馬"+(i+1),
 past_runs:[{race_date:"2026-11-01",track:"東京",surface:"芝",distance:1800,finish:3,
 margin_to_winner:0.2,early_pos:4,field_size:12}]}));
 const runner_content_evidence=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:"馬"+(i+1),
 history:[{prior_date:"2026-11-01",prior_track:"東京",prior_surface:"芝",prior_distance:1800,
 finish:3,margin_to_winner:0.2,field_size:12,source_kind:"LIVE",base_facts_available:true,
 raw_history_match_count:1,live_corner_positions:[4,3,2],final3f:34.7,
 final3f_source:"LIVE_PAST_RUN_FALLBACK",live_going:"良"}]}));
 return{race,runner_history,runner_content_evidence};
}
test("six LIVE official past-runs aligned and scored feature payload retained",()=>{
 const r=restoreJraClaimedRunDetails(fixture());
 assert.equal(r.source_evidence_handoff.official_past_runs,6);
 assert.equal(r.source_evidence_handoff.corners,6);
 assert.equal(r.source_evidence_handoff.final3f,6);
 assert.equal(r.source_evidence_handoff.going,6);
 assert.deepEqual(r.runner_history[0].past_runs[0].corner_positions,[4,3,2]);
 assert.equal(r.runner_history[0].past_runs[0].final3f,34.7);
 assert.equal(r.runner_history[0].past_runs[0].going,"良");
 assert.equal(r.source_evidence_handoff.market_used,false);
});
test("matched independent DB archive is accepted without pretending LIVE provenance",()=>{
 const x=fixture(),a=x.runner_content_evidence[0].history[0];
 Object.assign(a,{source_kind:"DB",raw_history_match_count:0,detail_available:true,
 archive_full_field:true,archive_match_count:1,live_corner_positions:null,
 corner_positions:"4 3 2",live_going:null,race_going:"稍重",
 final3f:35.2,final3f_source:"VERIFIED_ARCHIVE",
 race_halons:"7.0 - 11.2 - 12.7"});
 const r=restoreJraClaimedRunDetails(x),p=r.runner_history[0].past_runs[0];
 assert.deepEqual(p.corner_positions,[4,3,2]);
 assert.equal(p.final3f,35.2);
 assert.equal(p.going,"稍重");
 assert.equal(r.source_evidence_handoff.verified_archive_laps,1);
});
test("date, distance, outcome and margin mismatch fail closed",()=>{
 for(const [key,value] of [["prior_date","2026-11-02"],["prior_distance",1600],["finish",4],["margin_to_winner",1.3]]){
  const x=fixture();x.runner_content_evidence[1].history[0][key]=value;
  assert.throws(()=>restoreJraClaimedRunDetails(x),/JRA_ASOF_DETAIL_HANDOFF_RUN_IDENTITY/);
 }
});
test("future history, lost row coverage, unverified source fail closed",()=>{
 const a=fixture();a.runner_history[0].past_runs[0].race_date="2026-11-21";
 assert.throws(()=>restoreJraClaimedRunDetails(a),/JRA_ASOF_DETAIL_HANDOFF_RUN_IDENTITY/);
 const b=fixture();b.runner_content_evidence.pop();
 assert.throws(()=>restoreJraClaimedRunDetails(b),/JRA_ASOF_DETAIL_HANDOFF_FIELD_COVERAGE/);
 const c=fixture();c.runner_content_evidence[0].history[0].raw_history_match_count=0;
 assert.throws(()=>restoreJraClaimedRunDetails(c),/JRA_ASOF_DETAIL_HANDOFF_RUN_IDENTITY/);
 const d=fixture();d.runner_content_evidence[0].history[0].source_kind="DB";
 assert.throws(()=>restoreJraClaimedRunDetails(d),/JRA_ASOF_DETAIL_HANDOFF_RUN_IDENTITY/);
});
test("removed market, raw and original source URL not reintroduced",()=>{
 const r=restoreJraClaimedRunDetails(fixture());
 const p=r.runner_history[0].past_runs[0];
 for(const key of ["popularity","win_odds","raw","source_ref"])assert.equal(Object.hasOwn(p,key),false);
});
