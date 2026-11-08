import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyLocalOfficialRaceLabel} from '../automation/local-official-class-label.mjs';
const ref='COMPACT_V1.runners[horse_no=2].recent_runs[3]';
test('official race sponsor string is not ability evidence; keep only explicit C1 grade and immutable ref',()=>{
 const x=classifyLocalOfficialRaceLabel({race_name:'オッズパーク賞C1',evidence_ref:ref});
 assert.deepEqual(x,{status:'OFFICIAL_CLASS_LITERAL',class_label:'C1',source_ref:ref});
 assert.equal(JSON.stringify(x).includes('オッズ'),false);
});
test('C2 variants, 3歳B1, and JpnIII are preserved as explicit classes',()=>{
 assert.equal(classifyLocalOfficialRaceLabel({race_name:'C2九組',evidence_ref:ref}).class_label,'C2');
 assert.equal(classifyLocalOfficialRaceLabel({race_name:'3歳B1二組',evidence_ref:ref}).class_label,'3歳B1');
 assert.equal(classifyLocalOfficialRaceLabel({race_name:'クラスターカップJpnIII',evidence_ref:ref}).class_label,'JpnIII');
});
test('class not visibly in source is missing, never inferred from unrelated event name',()=>{
 const x=classifyLocalOfficialRaceLabel({race_name:'レース名だけ',evidence_ref:ref});
 assert.equal(x.status,'CLASS_NOT_EXPLICIT');assert.equal(x.class_label,null);
});
test('wrong or missing evidence reference fails closed',()=>{
 assert.equal(classifyLocalOfficialRaceLabel({race_name:'C1',evidence_ref:'fake-link'}).status,'UNVERIFIED_SOURCE');
 assert.equal(classifyLocalOfficialRaceLabel({race_name:'C1'}).status,'UNVERIFIED_SOURCE');
});
