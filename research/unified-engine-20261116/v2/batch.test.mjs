import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readBatch} from './read-batch.mjs';import {verifyBatch} from './verify-batch.mjs';
const path=new URL('../restoration/batches/batch-01.payload.json',import.meta.url);
test('pure Node ZIP reader validates hashes and reads at most five races',()=>{const f=readBatch(path,'features');assert.equal(f.rows.length,63);assert.equal(new Set(f.rows.map(r=>[r.race_date,r.track,r.race_no].join('/'))).size,5);assert.ok(f.rows.every(r=>!('finish' in r)&&!('result_horse_name' in r)))});
test('result member is requested separately and matches field size',()=>{const f=readBatch(path,'features'),r=readBatch(path,'labels');assert.equal(r.rows.length,f.rows.length);assert.equal(r.archive_sha256,f.archive_sha256)});
test('only declared archive roles can be read',()=>assert.throws(()=>readBatch(path,'anything'),/BATCH_ROLE/));
test('first batch selection lock, evidence hashes and all38 audit entries verify',()=>{const r=verifyBatch(1);assert.equal(r.integrity,'PASS');assert.equal(r.audit_items,2394)});
test('saved source is missing race type, no verification flag was invented',()=>{const f=readBatch(path,'features');assert.ok(f.rows.every(r=>r.past_runs.every(h=>!('race_type' in h))));const l=JSON.parse(readFileSync(new URL('validation/batch-01.selection-lock.json',import.meta.url)));assert.ok(l.horse_results.every(h=>h.verified_style==='UNKNOWN'&&h.v2_score===null))});
