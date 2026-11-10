import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeLocalCornerEvidenceToReview} from '../automation/local-corner-review-bridge.mjs';
const targetRace={circuit:'LOCAL',race_date:'2026-11-10',track:'佐賀',race_no:7,post_time:'2026-11-10T15:30:00+09:00'};
const runners=[{horse_no:1,horse_name:'甲',status:'ACTIVE'},{horse_no:2,horse_name:'乙',status:'ACTIVE'}];
const one={horseNo:1,horseName:'甲',pastRace:{raceDate:'2026-11-07',track:'佐賀',raceNo:5},
 pastHorseNo:6,earlyPos:3,finalTurnPos:1,corners:[{corner:1,position:3},{corner:4,position:1}],
 source:'NAR_OFFICIAL_PAST_RACE_RESULT',
 sourceRef:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
 sourceCheckedAt:'2026-11-10T10:00:00+09:00'};
const packet={status:'PREFETCH_ONLY',raceDate:'2026-11-10',raceTrack:'佐賀',raceNo:7,evidence:[one]};
const run=(changes={})=>bridgeLocalCornerEvidenceToReview({targetRace,runners,cornerPacket:packet,...changes});
test('official LOCAL corners flow to shared whole-field review without changing ranks',()=>{
 const r=run();
 assert.equal(r.position_covered_horses,1);assert.equal(r.runners[0].history[0].positions.early_pos,3);
 assert.equal(r.runners[0].history[0].positions.final_turn_pos,1);
 assert.equal(r.runners[1].missing,true);assert.equal(r.bridge.causal_inference_performed,false);
 assert.equal(r.ranking_changed,false);assert.equal(r.save_authorized,false);
});
test('race identity mismatch is a hard rejection',()=>{
 assert.throws(()=>run({cornerPacket:{...packet,raceNo:8}}),/RACE_MISMATCH/);
});
test('wrong current horse name is rejected rather than silently mapped',()=>{
 const r=run({cornerPacket:{...packet,evidence:[{...one,horseName:'別馬'}]}});
 assert.equal(r.bridge.excluded,1);assert.equal(r.position_covered_horses,0);
});
test('inconsistent corner order cannot manufacture movement',()=>{
 const r=run({cornerPacket:{...packet,evidence:[{...one,finalTurnPos:2}]}});
 assert.equal(r.bridge.excluded,1);assert.equal(r.position_covered_horses,0);
});
test('as-of rejects source checked after target race starts',()=>{
 const r=run({cornerPacket:{...packet,evidence:[{...one,sourceCheckedAt:'2026-11-10T15:31:00+09:00'}]}});
 assert.equal(r.position_covered_horses,0);assert.equal(r.excluded_reasons.NOT_PRE_RACE_AS_OF,1);
});
test('prior race on target day is not valid historical evidence',()=>{
 const r=run({cornerPacket:{...packet,evidence:[{...one,pastRace:{...one.pastRace,raceDate:'2026-11-10'}}]}});
 assert.equal(r.position_covered_horses,0);assert.equal(r.excluded_reasons.NOT_HISTORICAL,1);
});
test('same source duplicate is counted once; never invent lap, cause or market data',()=>{
 const r=run({cornerPacket:{...packet,evidence:[one,{...one}]}});
 assert.equal(r.runners[0].history.length,1);
 assert.equal(r.lap_covered_horses,0);assert.equal(r.betting_data_used,false);
 assert.equal(r.excluded_reasons.DUPLICATE_SOURCE,1);
});
test('JRA independent lap review stays available in common handoff',()=>{
 const {prepareHistoricalRaceReview}=await import('../automation/historical-race-review-handoff.mjs');
 const r=prepareHistoricalRaceReview({targetRace:{...targetRace,circuit:'JRA'},
 runners,evidence:[{horse_no:2,horse_name:'乙',past_race_date:'2026-11-07',
 past_race:{race_date:'2026-11-07',track:'京都',race_no:8},
 source:'JRA_OFFICIAL_LAP',source_ref:'https://www.jra.go.jp/JRADB/',
 source_checked_at:'2026-11-10T10:00:00+09:00',lap_splits:[12.3,11.8]}]});
 assert.equal(r.lap_covered_horses,1);assert.equal(r.position_covered_horses,0);
});
