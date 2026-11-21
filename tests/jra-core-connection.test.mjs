import test from 'node:test';import assert from 'node:assert/strict';
import {recoveredDiagnosis,AXES,WEIGHTS} from '../automation/jra-score-ledger/recovered-diagnosis.mjs';
import {resolveFactorEvidence} from '../automation/jra-score-ledger/evidence/factor-resolver.mjs';
import {readOfficialEvidence} from '../automation/jra-score-ledger/evidence/reader.mjs';
import {fixture,input} from '../automation/jra-score-ledger/evidence/synthetic-fixture.mjs';
const axes=v=>Object.fromEntries(AXES.map(k=>[k,v]));
const component=(kind='margin',horse_no=1)=>({horse_no,kind,source_ref:`JRA_CLAIMED_CONTEXT.runner_history[horse_no=${horse_no}].past_runs[0]`});
const resolve=(f,components=[component()])=>resolveFactorEvidence(input(f),{trust:f.trust,components});
test('recovered all-present constant score unchanged for every segment',()=>{for(const segment of Object.keys(WEIGHTS)){const r=recoveredDiagnosis({segment,axes:axes('80')});assert.equal(r.diagnostic_value,80);assert.equal(r.formal_score,null);assert.equal(r.production_allowed,false);}});
test('recovered class1 exact weighted decimal, no binary arithmetic in ledger',()=>{const r=recoveredDiagnosis({segment:'CLASS1',axes:{today_ability:'70.1',win_power:'60.2',top3_stability:'50.3',pace_fit:'40.4',change_score:'30.5'}});assert.deepEqual(r.exact,{numerator:'54953',denominator:'1000'});});
test('recovered null renormalization is documented; missing is not assigned neutral',()=>{const a=axes(null);a.today_ability='80';const r=recoveredDiagnosis({segment:'CLASS1',axes:a});assert.equal(r.diagnostic_value,80);assert.equal(r.weights_denominator,32);assert.equal(recoveredDiagnosis({axes:axes(null)}).diagnostic_value,null);});
test('recovered positive class delta and >120 rest subtract exactly seven',()=>{assert.equal(recoveredDiagnosis({segment:'CLASS1',axes:axes('80'),class_delta:1,days_since_last:121}).diagnostic_value,73);assert.equal(recoveredDiagnosis({segment:'CLASS1',axes:axes('80'),class_delta:1,days_since_last:120}).diagnostic_value,80);});
test('recovered SQL neither clamps nor assigns official grades or ties',()=>{const r=recoveredDiagnosis({axes:axes('2'),class_delta:1,days_since_last:121});assert.equal(r.diagnostic_value,-5);assert.equal(r.formal_score,null);assert(!('rank' in r));});
test('explicit decimal inputs and explicit null required; no rate conversion',()=>{assert.throws(()=>recoveredDiagnosis({axes:axes(80)}),/EXACT_DECIMAL/);assert.throws(()=>recoveredDiagnosis({axes:{}}),/EXPLICIT_NULL/);assert.equal(recoveredDiagnosis({segment:'unknown',axes:axes('80')}).segment,'STANDARD');});
test('signed synthetic body binds margin, distance, course, corners and rest but never real proof',()=>{const f=fixture();const r=resolve(f,['margin','distance','course','corners','rest'].map(k=>component(k)));assert.equal(r.status,'SYNTHETIC_ONLY');assert.equal(r.real_verified_histories,0);assert.equal(r.provenance_verified,false);assert.equal(r.bindings.length,5);assert(r.bindings.every(b=>b.run_id&&b.race_id&&b.horse_id&&b.body_sha256&&b.fetched_at));});
test('unknown issuer cannot authenticate even otherwise matching signed source',()=>{const f=fixture();f.trust.authorities={};assert.equal(resolve(f).status,'UNRESOLVED');});
test('signature mutation cannot claim READY or exact source',()=>{const f=fixture(),p=input(f);p.envelope.gate_after.ready=false;const r=resolveFactorEvidence(p,{trust:f.trust,components:[component()]});assert.equal(r.status,'UNRESOLVED');assert(r.errors.includes('SIGNATURE_INVALID'));});
test('tampered body is rejected, matching reference string alone is insufficient',()=>{const f=fixture();const hash=f.envelope.entries[0].document.body_sha256;f.bodies[hash]=Buffer.from('TAMPERED');assert.equal(resolve(f).status,'UNRESOLVED');});
test('missing original body and missing archive run ID are both rejected',()=>{for(const mutate of [f=>f.bodies={},f=>delete f.envelope.entries[0].archive.run_id]){const f=fixture();mutate(f);assert.equal(resolve(f).status,'UNRESOLVED');}});
test('wrong horse or wrong selected prior cannot bind a factor',()=>{const f=fixture();assert.equal(resolve(f,[component('margin',2)]).status,'UNRESOLVED');assert.equal(resolve(f,[{...component(),source_ref:'CLAIMED_CONTEXT_RUN:1:1'}]).status,'UNRESOLVED');});
test('duplicate factor on the same source is rejected rather than double counted',()=>{const f=fixture();assert.equal(resolve(f,[component(),component()]).status,'UNRESOLVED');});
test('missing class/laps/Eval evidence is never supplied from archive flags',()=>{for(const kind of ['class','pace','eval','opponent'])assert.equal(resolve(fixture(),[component(kind)]).status,'UNRESOLVED');});
test('context byte mutation cannot reuse an original signed snapshot',()=>{const f=fixture(),p=input(f);p.contextText+=' ';assert.equal(resolveFactorEvidence(p,{trust:f.trust,components:[component()]}).status,'UNRESOLVED');});
test('ambiguous archive selection and future document time refuse adoption',()=>{for(const mutate of [f=>f.envelope.entries[0].archive_match_count=2,f=>f.envelope.entries[0].document.fetched_at='2026-11-22T03:00:00Z']){const f=fixture();mutate(f);assert.equal(resolve(f).status,'UNRESOLVED');}});
test('unapproved parser hash cannot emit verified facts',()=>{const f=fixture();f.trust.extractors['synthetic-json'].source_sha256='b'.repeat(64);assert.equal(resolve(f).status,'UNRESOLVED');});
test('synthetic fixture cannot be relabelled FUTURE under its test authority',()=>{const f=fixture();f.envelope.phase='FUTURE';assert.equal(resolve(f).status,'UNRESOLVED');});
test('reader has no fallback DB route and respects lease before source call',async()=>{assert.equal((await readOfficialEvidence({})).status,'READER_DISCONNECTED');const f=fixture();let calls=0;const r=await readOfficialEvidence({contextText:f.contextText,job_id:f.context.job_id,lease_until:'2026-11-22T00:00:00Z',post_time:f.context.race.post_time},{now:()=>Date.parse('2026-11-22T00:10:03Z'),authorizedRead:()=>{calls++;}});assert.equal(r.status,'EXPIRED');assert.equal(calls,0);});

test('claimed-factor integration reads once and emits synthetic-only bound factors',async()=>{
 const {readClaimedFactorEvidence}=await import('../automation/jra-score-ledger/evidence/claimed-factor-reader.mjs');
 const f=fixture();let calls=0;const r=await readClaimedFactorEvidence({contextText:f.contextText,job_id:f.context.job_id,lease_until:f.envelope.gate_after.lease_until,post_time:f.context.race.post_time},{authorizedRead:async req=>{calls++;assert.equal(req.operation,'EXACT_SELECTED_CLAIM_EVIDENCE');return input(f);},trust:f.trust,now:()=>Date.parse(f.trust.now()),components:[component()]});
 assert.equal(calls,1);assert.equal(r.status,'SYNTHETIC_ONLY');assert.equal(r.bindings.length,1);assert.equal(r.production_allowed,false);
});
test('claimed-factor integration refuses missing provider without CLAIM or fallback',async()=>{
 const {readClaimedFactorEvidence}=await import('../automation/jra-score-ledger/evidence/claimed-factor-reader.mjs');
 const r=await readClaimedFactorEvidence({});assert.equal(r.code,'READER_DISCONNECTED');assert.equal(r.real_verified_histories,0);
});

test('new aggregation proposal is explicitly unapproved and not an official fact scorer',async()=>{const {proposedAggregate}=await import('../automation/jra-score-ledger/proposed-aggregate.mjs');const r=proposedAggregate({segment:'CLASS1',axes:axes('80')});assert.equal(r.score,80);assert.equal(r.formal_score,null);assert.equal(r.approval_status,'PENDING');assert.equal(r.input_provenance_verified,false);});
test('new proposal rejects missing axes instead of legacy null renormalization',async()=>{const {proposedAggregate}=await import('../automation/jra-score-ledger/proposed-aggregate.mjs');const a=axes('80');a.win_power=null;assert.throws(()=>proposedAggregate({axes:a}),/FIVE_COMPLETE/);});
test('new rounding and clamp are declared differences, never attributed to old SQL',async()=>{const {proposedAggregate}=await import('../automation/jra-score-ledger/proposed-aggregate.mjs');assert.equal(proposedAggregate({axes:axes('80.5')}).score,81);assert.equal(proposedAggregate({axes:axes('2'),class_delta:1,days_since_last:121}).score,0);});
test('new tie order is deterministic and labelled research, no rank to grade conversion',async()=>{const {proposedOrder}=await import('../automation/jra-score-ledger/proposed-aggregate.mjs');const rows=[3,1,2].map(horse_no=>({horse_no,axes:axes('80')}));const a=proposedOrder(rows);assert.deepEqual(a,proposedOrder([...rows].reverse()));assert.deepEqual(a.map(x=>x.horse_no),[1,2,3]);assert(a.every(x=>x.formal_rank===null&&x.rounded_score_tie&&!('grade' in x)));});
test('new proposal rejects duplicate horses and cannot repair out-of-range scores',async()=>{const {proposedOrder,proposedAggregate}=await import('../automation/jra-score-ledger/proposed-aggregate.mjs');assert.throws(()=>proposedOrder([{horse_no:1},{horse_no:1}]),/FIELD_INVALID/);assert.throws(()=>proposedAggregate({axes:axes('101')}),/FIVE_COMPLETE/);});

test('recovered internal order retains insufficient-last then exact-score/status/horse tie rules',async()=>{
 const {recoveredInternalOrder}=await import('../automation/jra-score-ledger/recovered-diagnosis.mjs');
 const rows=[{horse_no:1,data_status:'DATA_INSUFFICIENT',axes:axes('100')},{horse_no:3,data_status:'REFERENCE',axes:axes('80')},{horse_no:2,data_status:'RANKED',axes:axes('80')}];
 const a=recoveredInternalOrder(rows);assert.deepEqual(a.map(x=>x.horse_no),[2,3,1]);assert.deepEqual(a,recoveredInternalOrder([...rows].reverse()));assert(a.every(x=>x.formal_rank===null));
});
