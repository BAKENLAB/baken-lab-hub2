import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareHistoricalRaceReview} from '../automation/historical-race-review-handoff.mjs';
const targetRace={circuit:'LOCAL',race_date:'2026-11-09',post_time:'2026-11-09T14:00:00+09:00'};
const runners=[{horse_no:1,horse_name:'甲',status:'ACTIVE'},{horse_no:2,horse_name:'乙',status:'ACTIVE'}];
const evidence={horse_no:1,horse_name:'甲',past_race_date:'2026-11-07',
 past_race:{race_date:'2026-11-07',track:'佐賀',race_no:5},
 early_pos:3,final_turn_pos:1,source:'NAR_OFFICIAL_PAST_RACE_RESULT',
 source_ref:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable',
 source_checked_at:'2026-11-09T12:00:00+09:00'};
test('LOCAL: actual historical positions reach horse-specific review without rank edits',()=>{
 const x=prepareHistoricalRaceReview({targetRace,runners,evidence:[evidence]});
 assert.equal(x.position_covered_horses,1);assert.equal(x.whole_field_position_coverage,false);
 assert.equal(x.runners[0].history[0].positions.final_turn_pos,1);
 assert.equal(x.runners[1].missing,true);assert.equal(x.ranking_changed,false);
});
test('JRA: independent verified lap evidence enters same review structure',()=>{
 const x=prepareHistoricalRaceReview({targetRace:{...targetRace,circuit:'JRA'},
 runners,evidence:[{...evidence,source:'JRA_OFFICIAL_LAP',lap_splits:[12.2,11.8],early_pos:null,final_turn_pos:null}]});
 assert.equal(x.lap_covered_horses,1);assert.equal(x.position_covered_horses,0);
});
test('reject target-day, post-time, and name mismatch; never leak results',()=>{
 const bad=[{...evidence,past_race_date:'2026-11-09',past_race:{...evidence.past_race,race_date:'2026-11-09'}},
 {...evidence,source_checked_at:'2026-11-09T14:01:00+09:00'},
 {...evidence,horse_name:'別馬'}];
 const x=prepareHistoricalRaceReview({targetRace,runners,evidence:bad});
 assert.equal(x.position_covered_horses,0);assert.equal(x.excluded_count,3);
 assert.equal(JSON.stringify(x).includes('finish'),false);
});
test('duplicates and unsupported odds-like evidence cannot change ranking',()=>{
 const x=prepareHistoricalRaceReview({targetRace,runners,evidence:[evidence,evidence,{...evidence,source:'MARKET_ODDS'}]});
 assert.equal(x.runners[0].history.length,1);assert.equal(x.excluded_count,2);
 assert.equal(x.betting_data_used,false);assert.equal(x.save_authorized,false);
});
