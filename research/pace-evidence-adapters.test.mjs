import test from 'node:test';
import assert from 'node:assert/strict';
import {fromJraLiveRunner, fromLocalHorseRuns, indexMatchedJraLaps, buildFromJraRows, buildFromLocalRows} from './pace-evidence-adapters.mjs';
const race={raceDate:'2026-11-07',track:'福島',raceNo:10,surface:'芝',distance:1200};
const asOf='2026-11-07T04:00:00Z';
test('actual JRA snake_case field names map correctly',()=>{
 const runner=fromJraLiveRunner({horse_no:8,horse_name:'カレンデュラ',source_checked_at:'2026-11-01T00:00:00Z',past_runs:[{race_date:'2026-04-26',track:'福島',surface:'芝',distance:1200,early_pos:1,final_turn_pos:1,final3f:34.3,finish:1,race_class:'未勝利'}]});
 assert.equal(runner.pastRuns[0].raceDate,'2026-04-26');
 assert.equal(runner.pastRuns[0].earlyPos,1);
 assert.equal(runner.pastRuns[0].raceClass,'未勝利');
});
test('actual after-freeze JRA live runner snapshot is not retroactively eligible',()=>{
 const result=buildFromJraRows({race,asOf,liveRunners:[{horse_no:8,horse_name:'カレンデュラ',source_checked_at:'2026-11-07T05:36:02Z',past_runs:[{race_date:'2026-04-26',track:'福島',surface:'芝',distance:1200,early_pos:1,finish:1}]}]});
 assert.equal(result.runners[0].pastRuns,0);
 assert.equal(result.runners[0].excluded.sourceAfterFreeze,1);
});
test('real archived JRA halon time is usable only if archive matched and checked before freeze',()=>{
 const runner={horse_no:8,horse_name:'カレンデュラ',source_checked_at:'2026-11-01T00:00:00Z',past_runs:[{race_date:'2026-04-26',track:'福島',surface:'芝',distance:1200,early_pos:1,final_turn_pos:1,finish:1}]};
 const lap={horse_name:'カレンデュラ',race_date:'2026-04-26',track:'福島',surface:'芝',distance:1200,halon_times:'12.5 - 11.1 - 11.3 - 11.1 - 11.3 - 11.9',source_checked_at:'2026-09-18T18:21:04Z'};
 const result=buildFromJraRows({race,asOf,liveRunners:[runner],matchedArchiveRows:[lap]});
 assert.equal(result.runners[0].lapAvailable,1);
 assert.equal(result.runners[0].sameTrackDistanceTop3,1);
 assert.throws(()=>indexMatchedJraLaps([lap,lap]),/Ambiguous/);
});
test('local archival corner positions are usable while unknown ingestion timing is flagged',()=>{
 const localRace={raceDate:'2026-11-07',track:'高知',raceNo:12,surface:'ダート',distance:1300};
 const rows=[{horse_name:'マサハヤアン',race_date:'2026-06-28',track:'高知',surface:'ダート',distance:1300,finish:8,early_pos:11,final_turn_pos:9,final3f:40.6}];
 const data=fromLocalHorseRuns({horseNo:4,horseName:'マサハヤアン',runs:rows});
 assert.equal(data.identityProvenance,'NAME_ONLY_UNVERIFIED');
 const out=buildFromLocalRows({race:localRace,asOf,horseRows:[{horseNo:4,horseName:'マサハヤアン',runs:rows}]});
 assert.equal(out.runners[0].positionAvailable,1);
 assert.equal(out.runners[0].evidenceQuality,'PARTLY_UNVERIFIED_SOURCE_TIME');
 assert.equal(out.runners[0].lapAvailable,0);
});
test('local source name mismatch is rejected rather than mixed into another horse',()=>{
 assert.throws(()=>fromLocalHorseRuns({horseNo:4,horseName:'A',runs:[{horse_name:'B'}]}),/mismatch/);
});
