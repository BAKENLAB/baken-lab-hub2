import test from 'node:test';
import assert from 'node:assert/strict';
import '../manual-batch.js';
const B=globalThis.BAKENManualBatch;
const now=new Date('2026-10-22T00:15:00Z');
const base={race_date:'2026-10-22',circuit:'LOCAL',track:'笠松',
 race_no:1,race_name:'test',post_time:'2026-10-22T01:30:00Z',
 field_status:'READY',prediction_status:'PENDING',prediction:null};
test('JST date not user browser timezone',()=>{assert.equal(B.jstDate(now),'2026-10-22')});
test('all venues sorted regardless of current UI circuit/venue',()=>{
 const r=[{...base,track:'浦和',race_no:2,post_time:'2026-10-22T04:30:00Z'},base,{...base,track:'園田',race_no:1,post_time:'2026-10-22T01:40:00Z'}];
 const x=B.selectEligible({date:'2026-10-22',races:r,now});
 assert.deepEqual(x.eligible.map(z=>z.track),['笠松','園田','浦和']);assert.equal(x.count,3);
});
test('FROZEN or saved race excluded',()=>{
 const x=B.selectEligible({date:'2026-10-22',races:[{...base,prediction_status:'FROZEN'},
   {...base,track:'園田',prediction:{id:'saved'}}],now});
 assert.equal(x.count,0);assert.equal(x.skipped.savedOrClosed,2);
});
test('PENDING field excluded and READY/RETRY counted',()=>{
 const r=[{...base,field_status:'PENDING'},
  {...base,track:'園田',prediction_status:'RETRY'}];
 assert.equal(B.selectEligible({date:'2026-10-22',races:r,now}).count,1);
});
test('after start or inside three minute LOCAL reserve cannot enter batch',()=>{
 const r=[{...base,post_time:'2026-10-22T00:14:00Z'},
 {...base,track:'園田',post_time:'2026-10-22T00:18:00Z'},
 {...base,track:'浦和',post_time:'2026-10-22T00:18:01Z'}];
 const x=B.selectEligible({date:'2026-10-22',races:r,now});
 assert.equal(x.count,1);assert.equal(x.eligible[0].track,'浦和');
});
test('JRA uses its own research freeze window, not LOCAL three-minute rule',()=>{
 const r=[{...base,circuit:'JRA',track:'東京',post_time:'2026-10-22T01:14:00Z'},
 {...base,circuit:'JRA',track:'京都',post_time:'2026-10-22T02:00:00Z'},
 {...base,circuit:'JRA',track:'新潟',post_time:'2026-10-22T03:20:00Z'}];
 const x=B.selectEligible({date:'2026-10-22',races:r,now});
 assert.equal(x.count,1);assert.equal(x.eligible[0].track,'京都');
});
test('stale selected date rejected instead of replaying yesterday',()=>{
 assert.throws(()=>B.selectEligible({date:'2026-10-21',races:[base],now}),/TODAY_ONLY/);
});
test('duplicate race, invalid race and data error do not enter',()=>{
 const r=[base,{...base},{...base,track:'園田',race_no:30},
 {...base,track:'門別',data_error:{code:'bad'}}];
 const x=B.selectEligible({date:'2026-10-22',races:r,now});
 assert.equal(x.count,1);assert.equal(x.skipped.duplicate,1);
});
test('prompt explicitly forbids paid worker and false saved claims',()=>{
 const x=B.selectEligible({date:'2026-10-22',races:[base],now});
 const text=B.makePrompt(x);
 assert.match(text,/有料OpenAI API/);assert.match(text,/CLAIM/);
 assert.match(text,/保存件数と未処理理由/);assert.match(text,/笠松1R/);
});
