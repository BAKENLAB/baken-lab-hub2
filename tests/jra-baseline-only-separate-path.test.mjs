import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectResearchBaselineOnly} from '../research/jra-scoring-integrity-20261121/claim-retention/baseline-only-separate-path.candidate.mjs';
const root=new URL('../research/jra-scoring-integrity-20261121/observations/',import.meta.url);
const base=JSON.parse(readFileSync(new URL('jra-20261123-basecore-prerace-readonly.json',root)));
const target=JSON.parse(readFileSync(new URL('jra-20261123-target-conditions-prerace-readonly.json',root)));
const date='2026-11-23';
const version='JRA_REBUILD_0.4_CONTENT_EVIDENCE_20261023';
function fixture(baseRace){
 const t=target.races.find(x=>x.track===baseRace.track&&x.race_no===baseRace.race_no);
 assert.ok(t);
 return {
  context:{
   race:{race_date:baseRace.race_date,track:baseRace.track,race_no:baseRace.race_no,
    post_time:t.post_at_jst+'+09:00',
    field_payload:{race:t.race_conditions,
      runners:baseRace.runners.map(h=>({...h,status:'ACTIVE'}))}},
   candidates:baseRace.runners.map(h=>({
      horse_no:h.horse_no,horse_name:h.horse_name,base_rank:h.base_rank,
      base_rate:h.base_rate,data_status:h.data_status,model_version:h.model_version
   }))
  },
  nowIso:target.captured_at_jst+'+09:00',protocolVersion:version
 };
}
test('real Nov23 20 BASE_CORE-ranked races allow honest explicitly unenhanced preview; 3 unsupported races refuse',()=>{
 let accepted=0,unsupported=0,horses=0;
 for(const r of base.races){
  const x=inspectResearchBaselineOnly(fixture(r));
  if(r.runners[0].data_status==='UNSUPPORTED_SEGMENT'){
    assert.equal(x.ok,false);
    assert.equal(x.reason,'UNSUPPORTED_BASE_CORE_SEGMENT');
    unsupported++;continue;
  }
  assert.equal(x.ok,true,JSON.stringify(x));
  accepted++;horses+=x.candidate_count;
  assert.equal(x.classification,'BASE_CORE_ONLY_UNENRICHED');
  assert.equal(x.full_100pt_complete,false);
  assert.equal(x.official_save_allowed,false);
  assert.equal(x.production_release_allowed,false);
  assert.equal(x.optional_content_scored,false);
  assert.equal(x.separate_mode_requires_explicit_operator_approval,true);
  assert.equal(x.cannot_be_passed_to_existing_full_depth_guard,true);
  assert.equal(x.preview_runners.every(y=>y.full_100pt_score===null&&y.evidence_effects.length===0),true);
  assert.deepEqual(x.preview_top5,x.preview_runners.slice(0,5).map(y=>y.horse_no));
 }
 assert.equal(accepted,20);
 assert.equal(unsupported,3);
 assert.equal(horses,302);
});
test('same field and BASE_CORE candidates in changed order keep ranks and preview unchanged',()=>{
 const x=fixture(base.races.find(y=>y.track==='福島'&&y.race_no===1));
 const before=inspectResearchBaselineOnly(x);
 const y=structuredClone(x);
 y.context.candidates.reverse();y.context.race.field_payload.runners.reverse();
 const after=inspectResearchBaselineOnly(y);
 assert.deepEqual(after,before);
});
test('changed, unsupported or invented baseline records fail without a saved prediction',()=>{
 const x=fixture(base.races.find(y=>y.track==='福島'&&y.race_no===1));
 let a=structuredClone(x);a.context.candidates[0].data_status='UNSUPPORTED_SEGMENT';
 assert.equal(inspectResearchBaselineOnly(a).reason,'UNSUPPORTED_BASE_CORE_SEGMENT');
 a=structuredClone(x);a.context.candidates[0].base_rank=2;
 assert.equal(inspectResearchBaselineOnly(a).reason,'BASE_CORE_RANK_DUPLICATED');
 a=structuredClone(x);a.context.candidates[0].horse_name='相違名';
 assert.equal(inspectResearchBaselineOnly(a).reason,'CANDIDATE_IDENTITY_MISMATCH');
 a=structuredClone(x);a.context.candidates[0].base_rate='not a probability';
 assert.equal(inspectResearchBaselineOnly(a).reason,'BASE_CORE_RATE_MISSING');
 a=structuredClone(x);a.nowIso=a.context.race.post_time;
 assert.equal(inspectResearchBaselineOnly(a).reason,'OUTSIDE_PREPOST_SAFETY_WINDOW');
 a=structuredClone(x);a.protocolVersion='JRA_MAIN_FAKE';
 assert.equal(inspectResearchBaselineOnly(a).reason,'OPERATOR_PROTOCOL_NOT_PINNED');
});
