import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNarCornerOrder,buildVerifiedPriorCornerEvidence,checkOfficialPastRaceSource} from '../automation/nar-prior-corners.mjs';
const knownHorseNos=Array.from({length:11},(_,i)=>i+1);
const priorRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
const common={sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
priorRace,targetRaceDate:'2026-11-08',targetPostTime:'2026-11-08T09:00:00+09:00',
sourceCheckedAt:'2026-11-08T07:00:00+09:00',
raceHeaderText:'2026年11月7日（土）　佐　賀　第5競走　競走成績',
knownHorseNos};
test('NAR real published corner text: parentheses share position, dash means separation',()=>{
 const x=parseNarCornerOrder('6 , 7 , ( 4 , 9 ) , ( 8 , 11 ) , 5 - 1 , ( 3 , 10 )- 2',{knownHorseNos});
 assert.equal(x['6'],1);assert.equal(x['7'],2);assert.equal(x['4'],3);
 assert.equal(x['9'],3);assert.equal(x['8'],5);assert.equal(x['11'],5);
 assert.equal(x['5'],7);assert.equal(x['1'],8);assert.equal(x['3'],9);
 assert.equal(x['10'],9);assert.equal(x['2'],11);
});
test('full 4-corner official 2026-11-07 Saga5 example identifies each past horse',()=>{
 const o=buildVerifiedPriorCornerEvidence({...common,cornerRows:[
 ['１角','6 , 7 , ( 4 , 9 ) , ( 8 , 11 ) , 5 - 1 , ( 3 , 10 )- 2'],
 ['２角','6 , 7 , 9 , 4 , ( 8 , 11 ) , 5 , ( 3 , 10 ) , 1 , 2'],
 ['３角','( 7 , 9 , 11 ) , 6 -( 4 , 8 ) , ( 3 , 10 ) , 5 , 1 - 2'],
 ['４角','11 , 9 - 8 , 7 - 3 , 10 , 4 , 1 , 5 , ( 6 , 2 )']
 ]});
 assert.equal(o.positions_covered,11);assert.equal(o.runners.length,11);
 assert.equal(o.runners.find(x=>x.prior_horse_no===11).final_turn_pos,1);
 assert.equal(o.runners.find(x=>x.prior_horse_no===6).early_pos,1);
 assert.equal(o.runners.find(x=>x.prior_horse_no===4).early_pos,3);
 assert.equal(o.market_used,false);assert.equal(o.scoring_effect,0);
 assert.equal('finish' in o.runners[0],false);
});
test('never confuse past race results with upcoming target race',()=>{
 assert.throws(()=>checkOfficialPastRaceSource({...common,targetRaceDate:'2026-11-07'}),/PRE_RACE/);
 assert.throws(()=>checkOfficialPastRaceSource({...common,sourceCheckedAt:'2026-11-08T09:02:00+09:00'}),/SOURCE_AFTER/);
});
test('forged official URLs, altered race header, or extra URL parameters are rejected',()=>{
 assert.throws(()=>checkOfficialPastRaceSource({...common,sourceUrl:'https://evil.example/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5'}),/UNTRUSTED/);
 assert.throws(()=>checkOfficialPastRaceSource({...common,raceHeaderText:'2026年11月7日 高知第5競走 競走成績'}),/HEADING/);
 assert.throws(()=>checkOfficialPastRaceSource({...common,sourceUrl:common.sourceUrl+'&mode=market'}),/UNTRUSTED/);
});
test('duplicate/noisy corners cannot silently assign wrong horse position',()=>{
 assert.throws(()=>parseNarCornerOrder('1,2,(2,3)',{knownHorseNos:[1,2,3]}),/CONFLICT/);
 assert.throws(()=>parseNarCornerOrder('1,2,99',{knownHorseNos:[1,2,3]}),/CONFLICT/);
 assert.throws(()=>parseNarCornerOrder('1,2、あ',{knownHorseNos:[1,2,3]}),/UNRECOGNIZED/);
});
test('unknown horse numbers are rejected, no guesswork',()=>{
 assert.throws(()=>buildVerifiedPriorCornerEvidence({...common,knownHorseNos:[1,2],cornerRows:[['４角','1,2,3']]}),/CONFLICT/);
});
test('two-corner sprint is allowed; only actually observed early and final corners emitted',()=>{
 const o=buildVerifiedPriorCornerEvidence({...common,knownHorseNos:[1,2,3],
 cornerRows:[['３角','2,(1,3)'],['４角','3,2,1']]});
 assert.equal(o.runners.find(x=>x.prior_horse_no===1).early_pos,2);
 assert.equal(o.runners.find(x=>x.prior_horse_no===1).final_turn_pos,3);
 assert.equal(o.runners.find(x=>x.prior_horse_no===1).first_recorded_corner,3);
});
test('source never infers lap times or passing order for horses absent at a corner',()=>{
 const o=buildVerifiedPriorCornerEvidence({...common,knownHorseNos:[1,2,3],
 cornerRows:[['４角','1,2']]});
 assert.equal(o.positions_covered,2);
 assert.equal(o.runners.find(x=>x.prior_horse_no===3).evidence_status,'PARTIAL_CORNER_COVERAGE');
 assert.equal(JSON.stringify(o).includes('halon_times'),false);
});
