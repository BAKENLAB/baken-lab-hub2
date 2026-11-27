import assert from 'node:assert/strict';
import {analyzeField100} from './analyze-field-100.mjs';
import {analyzeField} from '../reborn2-analysis-circuit/analyze.mjs';
for(const circuit of ['JRA','LOCAL']){
 const target={circuit,race_id:'fixture',field_size:2,cutoff:'2026-11-22T04:00:00Z',started_at:'2026-11-22T05:00:00Z',local_date:'2026-11-22'};
 const roster=[{horse_no:1},{horse_no:2}];
 const baseArgs={input:{circuit,targetDate:target.local_date,targetRaceId:target.race_id,cutoff:target.cutoff,roster:[1,2],rows:[]}};
 const args={baseArgs,oppositionArgs:{target,roster}};
 const old=analyzeField(baseArgs),out=analyzeField100(args);
 assert.deepEqual(out.previous.base01to32,old);
 assert.equal(out.audit.runners.length,2);
 for(const h of out.audit.runners){
   assert.equal(h.items.length,100);
   assert.equal(h.assessment.item_consumption.length,100);
   assert.ok(h.items.every(i=>!i.assessment_consumed&&!i.release_eligible));
   assert.equal(h.assessment.rank_candidate,null);
 }
 assert.equal(Object.keys(out.audit.coverage).length,100);
 assert.equal(out.release_eligible,false);
 assert.deepEqual(analyzeField100(args),out);
 assert.throws(()=>analyzeField100({...args,oppositionArgs:{target:{...target,race_id:'wrong'},roster}}),/TARGET_CONTEXT_MISMATCH/);
}
console.log('PASS 100-item empty/missing all-field integration JRA and LOCAL, legacy preservation and target isolation');
