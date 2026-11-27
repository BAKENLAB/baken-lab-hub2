import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256, validateEvidencePacket, buildTypedObservation} from './stage30-evidence-supply-contract-v0.1.mjs';

const bytes = new TextEncoder().encode('<html>fixture only</html>');
const base = () => ({
  source_url:'https://www.jra.go.jp/JRADB/example', raw_bytes:bytes, raw_sha256:sha256(bytes),
  captured_at:'2026-11-28T01:00:00+09:00', source_published_at:'2026-11-28T00:55:00+09:00',
  source_version:'v1', parser_version:'fixture-1', scope:'HORSE_ROW', material_type:'FINISH_TIME',
  identity:{event_id:'JRA-FIXTURE-R1',horse_id:'JRA-FIXTURE-H1',join_method:'OFFICIAL_LINK'},
  rights:{capture:'ALLOWED',retain:'ALLOWED',cloud_ai:'ALLOWED',derived_publication:'UNCONFIRMED',commercial:'UNCONFIRMED'},
  target_cutoff:'2026-11-28T01:10:00+09:00', mode:'PRE_RACE', contains_target_outcome:false
});

test('narrow internal research packet passes but never becomes formal',()=>{const r=validateEvidencePacket(base());assert.equal(r.ok,true);assert.equal(r.formal,false)});
test('public output needs separately allowed derived publication',()=>{const r=validateEvidencePacket(base(),{purpose:'PUBLIC_DERIVED_OUTPUT'});assert.equal(r.ok,false);assert.ok(r.reasons.includes('RIGHT_DERIVED_PUBLICATION_NOT_ALLOWED'))});
test('commercial output needs explicit commercial right',()=>{const r=validateEvidencePacket(base(),{purpose:'COMMERCIAL_OUTPUT'});assert.equal(r.ok,false);assert.ok(r.reasons.includes('RIGHT_COMMERCIAL_NOT_ALLOWED'))});
test('public visibility does not replace rights matrix',()=>{const p=base();delete p.rights;const r=validateEvidencePacket(p);assert.equal(r.ok,false);assert.ok(r.reasons.includes('RIGHTS_MATRIX_REQUIRED'))});
test('raw bytes are mandatory',()=>{const p=base();delete p.raw_bytes;assert.ok(validateEvidencePacket(p).reasons.includes('RAW_BYTES_REQUIRED'))});
test('raw digest mismatch is rejected',()=>{const p=base();p.raw_sha256='0'.repeat(64);assert.ok(validateEvidencePacket(p).reasons.includes('RAW_SHA256_MISMATCH'))});
test('unapproved host is rejected',()=>{const p=base();p.source_url='https://example.com/data';assert.ok(validateEvidencePacket(p).reasons.includes('SOURCE_NOT_APPROVED_OFFICIAL_HOST'))});
test('name-only identity is forbidden',()=>{const p=base();p.identity.join_method='HORSE_NAME_ONLY';assert.ok(validateEvidencePacket(p).reasons.includes('NAME_ONLY_IDENTITY_FORBIDDEN'))});
test('missing horse ID is rejected for horse row',()=>{const p=base();delete p.identity.horse_id;assert.ok(validateEvidencePacket(p).reasons.includes('HORSE_ID_REQUIRED'))});
test('event-scoped lap can omit horse ID',()=>{const p=base();p.scope='EVENT';p.material_type='RACE_LEADER_LAPS';delete p.identity.horse_id;assert.equal(validateEvidencePacket(p).ok,true)});
test('race leader laps cannot be relabeled individual',()=>{const p=base();p.material_type='RACE_LEADER_LAPS';p.measurement_scope='INDIVIDUAL';assert.ok(validateEvidencePacket(p).reasons.includes('RACE_LAPS_MISLABELED_INDIVIDUAL'))});
test('publication after target cutoff is rejected',()=>{const p=base();p.source_published_at='2026-11-28T01:11:00+09:00';assert.ok(validateEvidencePacket(p).reasons.includes('PUBLISHED_AFTER_TARGET_CUTOFF'))});
test('capture after target cutoff is rejected',()=>{const p=base();p.captured_at='2026-11-28T01:11:00+09:00';assert.ok(validateEvidencePacket(p).reasons.includes('CAPTURED_AFTER_TARGET_CUTOFF'))});
test('target result is forbidden in pre-race packet',()=>{const p=base();p.contains_target_outcome=true;assert.ok(validateEvidencePacket(p).reasons.includes('TARGET_OUTCOME_FORBIDDEN'))});
test('missing official value remains missing and is never guessed',()=>{const r=buildTypedObservation(base(),'individual_lap',null,'ms');assert.equal(r.status,'MISSING');assert.equal(r.value,null)});
test('typed research observation retains provenance and rights',()=>{const r=buildTypedObservation(base(),'finish_time',71200,'ms');assert.equal(r.status,'RESEARCH_ONLY');assert.equal(r.raw_sha256,sha256(bytes));assert.equal(r.formal,false)});
