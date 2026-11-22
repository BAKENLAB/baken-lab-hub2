// Purely synthetic V11 Ed25519 issuer, context and original-body fixtures.
// No live claim/reader, no JRA issuer key, no source authority, no bet, no save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,input} from '../automation/jra-score-ledger/evidence/synthetic-fixture.mjs';
import {sha} from '../automation/jra-score-ledger/evidence/primitives.mjs';
import {scoreVerifiedV11ResearchPacket} from
 '../research/jra-scoring-integrity-20261121/claim-retention/signed-source-score-bridge.mjs';

function sample(){
  const x=fixture();
  // The synthetic fixture is re-signed using its privately owned test-only key;
  // never attach new claims to a previously signed context without re-signing.
  x.context.candidates=[{horse_no:1,horse_name:'架空馬',
    base_rate:0.5,base_rank:1,data_status:'RANKED'}];
  x.contextText=JSON.stringify(x.context);
  x.envelope.context_sha256=sha(x.contextText);
  const policy={
    classification:'UNAPPROVED_RESEARCH_ONLY',
    id:'V11_SYNTHETIC_POINTS_TEST_ONLY',
    base_policy_id:'JRA_RESEARCH_BASE_30PLUS38_V1',
    rules:[
      {kind:'margin',mode:'numeric',
       bands:[{lte:0.4,points:3},{lte:1,points:1}],otherwise_points:-2},
      {kind:'corners',mode:'numeric',
       bands:[{lte:0,points:-2},{lte:3,points:2}],otherwise_points:3},
      {kind:'distance',mode:'numeric',
       bands:[{lte:0,points:2},{lte:300,points:1}],otherwise_points:-1},
      {kind:'rest',mode:'numeric',
       bands:[{lte:30,points:1}],otherwise_points:0},
      {kind:'course',mode:'category',categories:{SAME:1,OTHER:0},
       otherwise_points:0}
    ]
  };
  return {packet:input(x),trust:x.trust,policy};
}
test('signed synthetic original produces real computed research points not caller supplied values',()=>{
 const x=sample(),y=scoreVerifiedV11ResearchPacket(x);
 assert.equal(y.ok,true,JSON.stringify(y));
 assert.equal(y.generated.runners.length,1);
 assert.equal(y.generated.runners[0].base_score,49);
 assert.equal(y.generated.runners[0].research_score,54);
 assert.equal(y.bound_factors,5);
 assert.equal(y.verified_history_slots,1);
 assert.equal(y.generated.runners[0].effects.length,5);
 assert.equal(y.issuer_scope,'SYNTHETIC_TEST');
 assert.equal(y.production_allowed,false);
 assert.equal(y.official_score_approved,false);
 assert.equal(y.actual_official_original_authenticated,false);
 assert.equal(y.real_original_reader_connected,false);
});
test('identical signed body and policy produce bit-for-bit deterministic generated score and policy hash',()=>{
 const x=sample(),a=scoreVerifiedV11ResearchPacket(x),b=scoreVerifiedV11ResearchPacket(x);
 assert.deepEqual(a,b);assert.equal(a.ok,true);
});
test('altered signed envelope without issuer resigning is not accepted',()=>{
 const x=sample();x.packet.envelope.gate_after.checked_at='2026-11-22T00:12:01Z';
 const y=scoreVerifiedV11ResearchPacket(x);
 assert.equal(y.ok,false);assert.equal(y.reason,'SIGNED_OR_GATE_VERIFICATION_FAILED');
});
test('altered original body under retained digest fails JRA-body hash binding',()=>{
 const x=sample(),k=Object.keys(x.packet.bodies)[0];
 x.packet.bodies[k]=Buffer.from('MALICIOUS_SYNTHETIC_NOT_ORIGINAL');
 const y=scoreVerifiedV11ResearchPacket(x);
 assert.equal(y.ok,false);assert.equal(y.reason,'SIGNED_SOURCE_PARTIAL_OR_UNAVAILABLE');
});
test('unsupported class/going/laps or invented extra factor never gets synthetic approval',()=>{
 for(const kind of ['class','going','pace','opponent','race_shape','eval']){
   const x=sample();
   x.policy.rules.push({kind,mode:'category',categories:{X:1},otherwise_points:0});
   const y=scoreVerifiedV11ResearchPacket(x);
   assert.equal(y.ok,false,kind);assert.equal(y.reason,'POLICY_USES_UNSIGNED_OR_UNSUPPORTED_FACTS');
 }
});
test('signed corner source missing required ending position fails no inferred corner effect',()=>{
 const x=sample();
 const k=Object.keys(x.packet.bodies)[0],b=JSON.parse(x.packet.bodies[k].toString('utf8'));
 b.runners[1].corner_positions=[1];
 x.packet.bodies[k]=Buffer.from(JSON.stringify(b));
 const y=scoreVerifiedV11ResearchPacket(x);
 assert.equal(y.ok,false);assert.equal(y.production_allowed,false);
});
test('cannot spoof verified source by setting flags in a caller selected run array',()=>{
 const x=sample();
 x.selectedRuns=[{horse_no:1,run_id:'FAKE',original_bytes_verified:true,
 verified_before_post:true,original_sha256:'a'.repeat(64)}];
 const y=scoreVerifiedV11ResearchPacket(x);
 assert.equal(y.ok,true);
 assert.equal(y.generated.runners[0].source_run_count,1);
 assert.notEqual(y.generated.runners[0].effects[0].run_id,'FAKE');
});

test('signed source-generated rank and signed factor points must match submitted full 100-point record',()=>{
 const x=sample();
 const baseline=scoreVerifiedV11ResearchPacket(x);
 assert.equal(baseline.ok,true);
 const payload={
   runners:baseline.generated.runners.map(r=>({
     horse_no:r.horse_no,horse_name:r.horse_name,
     score:r.research_score,rank:r.research_rank
   })),
   audit:{runner_history_checked:baseline.generated.runners.map(r=>({
     horse_no:r.horse_no,base_score:r.base_score,
     score_after:r.research_score,rank_after:r.research_rank,
     evidence_effects:structuredClone(r.effects)
   }))}
 };
 const matched=scoreVerifiedV11ResearchPacket({...x,payload});
 assert.equal(matched.ok,true,JSON.stringify(matched));
 assert.equal(matched.submitted_points_verified,true);
 assert.equal(matched.submitted_comparison.checked_horses,1);
 assert.equal(matched.production_allowed,false);
 const mispoint=structuredClone(payload);
 mispoint.audit.runner_history_checked[0].evidence_effects[0].points+=1;
 const p=scoreVerifiedV11ResearchPacket({...x,payload:mispoint});
 assert.equal(p.ok,false);
 assert.equal(p.reason,'SIGNED_FACT_TO_POINTS_SUBMISSION_MISMATCH');
 assert.equal(p.detail,'REPLAY_FACTOR_POINTS_OR_PROVENANCE_MISMATCH');
 const misrank=structuredClone(payload);
 misrank.runners[0].rank=2;
 const rank=scoreVerifiedV11ResearchPacket({...x,payload:misrank});
 assert.equal(rank.ok,false);
 assert.equal(rank.detail,'REPLAY_RANK_MISMATCH');
 const wrongBodyHash=structuredClone(payload);
 wrongBodyHash.audit.runner_history_checked[0].evidence_effects[0].original_sha256='e'.repeat(64);
 const y=scoreVerifiedV11ResearchPacket({...x,payload:wrongBodyHash});
 assert.equal(y.ok,false);
 assert.equal(y.detail,'REPLAY_FACTOR_POINTS_OR_PROVENANCE_MISMATCH');
});
