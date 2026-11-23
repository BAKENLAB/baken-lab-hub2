import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 inspectPreRaceBaseCoreSnapshot,compareFrozenToPreRaceBaseCore
} from '../automation/jra-score-ledger/prerace-basecore-audit.mjs';
const raw=readFileSync(new URL('../research/jra-scoring-integrity-20261121/observations/jra-20261123-basecore-prerace-readonly.json',import.meta.url));
const snapshot=JSON.parse(raw);
test('historical captured at 08:10 JST baseline bytes match pre-pinned Git blob',()=>{
 const calculated=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 assert.equal(calculated,'07f8672655e987ed7fbe0b13d93551fabbe13175');
 assert.equal(snapshot.captured_at_jst,'2026-11-23T08:10:02.320');
});
test('all 23 future race cards and 345 horse rows have valid ordered BASE_CORE coverage',()=>{
 const result=inspectPreRaceBaseCoreSnapshot(snapshot);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.race_count,23);
 assert.equal(result.horse_count,345);
 assert.equal(result.ranked_races,20);
 assert.equal(result.ranked_horses,302);
 assert.equal(result.unsupported_races,3);
 assert.equal(result.unsupported_horses,43);
 assert.equal(result.issuer_authenticated,false);
 assert.equal(result.formal_scoring_allowed,false);
});
test('unsupported new-horse races never acquire invented official ranked predictions',()=>{
 for(const [track,no] of [['福島',5],['東京',5],['東京',6]]){
   const race=snapshot.races.find(r=>r.track===track&&r.race_no===no);
   assert.equal(race.runners.every(x=>x.data_status==='UNSUPPORTED_SEGMENT'),true);
   assert.equal(compareFrozenToPreRaceBaseCore({snapshot,track,race_no:no,payload:{runners:[]}}).reason,
     'BASE_CORE_UNSUPPORTED_SEGMENT');
 }
});
test('synthetic frozen reorder shows exactly which horses diverge but proves no official point policy',()=>{
 const race=snapshot.races.find(r=>r.track==='福島'&&r.race_no===1);
 const runners=race.runners.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
   rank:r.base_rank,score:100-r.base_rank}));
 const good=compareFrozenToPreRaceBaseCore({snapshot,track:'福島',race_no:1,payload:{runners}});
 assert.equal(good.ok,true);assert.equal(good.changed_runners,0);
 assert.equal(good.formal_scoring_allowed,false);
 const changed=structuredClone(runners);
 const a=changed[0].rank,b=changed[1].rank;
 changed[0].rank=b;changed[1].rank=a;
 const drift=compareFrozenToPreRaceBaseCore({snapshot,track:'福島',race_no:1,
   payload:{runners:changed}});
 assert.equal(drift.ok,true);assert.equal(drift.changed_runners,2);
 assert.equal(drift.manual_rank_changes_verified,false);
 assert.equal(drift.actual_score_policy_verified,false);
});
test('post-frozen field tampering, identity drift and changed post time fail closed',()=>{
 const altered=structuredClone(snapshot);
 altered.races[0].post_at_jst='2026-11-23T08:00:00';
 assert.equal(inspectPreRaceBaseCoreSnapshot(altered).reason,'POST_TIME_NOT_AFTER_SNAPSHOT');
 const dup=structuredClone(snapshot);
 dup.races[0].runners[0].horse_no=dup.races[0].runners[1].horse_no;
 assert.equal(inspectPreRaceBaseCoreSnapshot(dup).reason,'HORSE_NO_DUPLICATED');
 const race=snapshot.races.find(r=>r.track==='東京'&&r.race_no===1);
 const bad=race.runners.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
   rank:r.base_rank,score:50}));
 bad[0].horse_name='ANOTHER_HORSE';
 assert.equal(compareFrozenToPreRaceBaseCore({snapshot,track:'東京',race_no:1,
   payload:{runners:bad}}).reason,'FROZEN_HORSE_IDENTITY_DRIFT');
});
