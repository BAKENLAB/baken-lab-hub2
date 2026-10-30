import test from 'node:test';import assert from 'node:assert/strict';
import {createBoundedNarResultReader} from './nar-result-bounded-reader.mjs';
const current={circuit:'LOCAL',race_date:'2026-10-21',track:'笠松',race_no:11};
const past=(day,no)=>({circuit:'LOCAL',race_date:day,track:'笠松',race_no:no});
test('two distinct official result pages maximum, same page hits cache',async()=>{
 let calls=0;const reader=createBoundedNarResultReader({readPage:async url=>{calls++;return {verified:true,url,document:'test'}}});
 await reader.read(current,past('2026-08-14',5));await reader.read(current,past('2026-09-09',9));
 await reader.read(current,past('2026-08-14',5));
 assert.equal(calls,2);assert.deepEqual(reader.statistics(),{requests:2,cached:2,remaining:0});
 await assert.rejects(reader.read(current,past('2026-08-27',12)),/BUDGET_EXCEEDED/);
 assert.equal(calls,2);
});
test('same-day / future race cannot be requested',async()=>{const reader=createBoundedNarResultReader({readPage:async()=>{throw Error('MUST_NOT_CALL')}});
 await assert.rejects(reader.read(current,past('2026-10-21',1)),/NOT_HISTORICAL/);
 await assert.rejects(reader.read(current,past('2026-10-22',1)),/NOT_HISTORICAL/);
 assert.equal(reader.statistics().requests,0);
});
test('unsupported track is rejected before network',async()=>{
 const reader=createBoundedNarResultReader({readPage:async()=>{throw Error('MUST_NOT_CALL')}});
 await assert.rejects(reader.read(current,{...past('2026-08-14',5),track:'INVALID'}),/NOT_HISTORICAL/);
});
test('unverified source cannot be returned as historical evidence',async()=>{
 const reader=createBoundedNarResultReader({readPage:async url=>({verified:false,url,document:'untrusted'})});
 await assert.rejects(reader.read(current,past('2026-08-14',5)),/SOURCE_UNVERIFIED/);
 assert.equal(reader.statistics().cached,0);
});
