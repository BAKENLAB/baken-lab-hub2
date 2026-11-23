import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {auditArchiveLineage} from '../research/jra-scoring-integrity-20261121/remaining-blockers/archive-lineage-audit.mjs';
const root=new URL('../research/jra-scoring-integrity-20261121/remaining-blockers/',import.meta.url);
const sample=()=>JSON.parse(readFileSync(new URL('archive-lineage.json',root),'utf8'));
test('real readonly sample resolves four archive counterpart IDs, never claims source/HTML/signature proof',()=>{
 const x=sample(),before=structuredClone(x),r=auditArchiveLineage(x);
 assert.equal(r.selected_history_rows,4);assert.equal(r.unique_archive_counterparts,4);
 assert.equal(r.actual_selected_sources_proven,0);assert.equal(r.real_verified_histories,0);assert.equal(r.formal_scoring_allowed,false);
 assert.deepEqual(x,before);assert.ok(r.rows.every(h=>h.actual_selected_source_id===null&&!h.claim_bound&&!h.official_body_verified&&!h.signature_verified));
});
test('duplicate archive candidates never arbitrarily select a run ID',()=>{
 const x=sample();x.rows[0].exact_archive_candidates.push(structuredClone(x.rows[0].exact_archive_candidates[0]));
 const r=auditArchiveLineage(x);assert.equal(r.rows[0].lineage_status,'AMBIGUOUS_ARCHIVE_COUNTERPART');assert.equal(r.rows[0].archive_counterpart,null);
});
test('wrong horse ID/name or missing run/race ID/source time never joins by horse name alone',()=>{
 for(const [key,value] of [['horse_id','0000000000'],['horse_name','別馬'],['run_id',null],['race_id',null],['source_checked_at',null]]){
  const x=sample();x.rows[0].exact_archive_candidates[0][key]=value;
  assert.equal(auditArchiveLineage(x).rows[0].archive_counterpart,null);
 }
});
test('target-card evidence IDs and hashes cannot become official history receipts',()=>{
 const x=sample();assert.ok(x.target_card_metadata_only.length>0);
 const r=auditArchiveLineage(x);assert.ok(r.rows.every(h=>!Object.hasOwn(h,'evidence_id')&&!Object.hasOwn(h,'html_sha256')));assert.equal(r.real_verified_histories,0);
});
test('posthoc audit refuses a claimed-context packet or duplicate history slot',()=>{
 const x=sample();x.mode='CLAIM_PROVIDER';assert.throws(()=>auditArchiveLineage(x),/ARCHIVE_AUDIT_INPUT_REQUIRED/);
 const y=sample();y.rows.push(structuredClone(y.rows[0]));assert.throws(()=>auditArchiveLineage(y),/DUPLICATE_SELECTED_HISTORY/);
});
