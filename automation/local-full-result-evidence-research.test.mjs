import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeNarPastResult,summarizeOpponentFollowup} from './local-full-result-evidence-research.mjs';

// Synthetic fixture only; this is not a saved prediction or real horse evidence.
const headers=['着順','馬番','馬名','タイム','着差','上がり 3F','コーナー 通過順','人気','単勝 オッズ'];
const base={
 priorRace:{raceDate:'2025-11-16',track:'高知',raceNo:1},targetDate:'2025-11-20',
 cutoff:'2025-11-20T01:00:00Z',observedAt:'2025-11-19T01:00:00Z',
 sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=31&k_raceDate=2025%2F11%2F16&k_raceNo=1',
 heading:'2025年11月16日 高知 第1競走 競走成績',headers,expectedRosterCount:4,
 rows:[
 {cells:['1','1','テストA','1:32.9','','40.0','2-2-1-1','3','5.0'],horseRef:'/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=1001'},
 {cells:['2','2','テストB','1:33.2','1.1/2','40.5','1-1-2-2','1','2.0'],horseRef:'/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=1002'},
 {cells:['3','3','テストC','1:34.5','6','40.4','3-3-3-3','2','4.0'],horseRef:'/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=1003'},
 {cells:['取消','4','テストD','','','','','',''],horseRef:null}
 ]};
test('result facts, winner gap, cancellation, market exclusion',()=>{
 const p=normalizeNarPastResult(base);
 assert.equal(p.coverage.finishers,3);assert.equal(p.coverage.ids,3);
 assert.equal(p.records[2].winner_gap_seconds,1.6);assert.equal(p.records[1].winner_gap_seconds,0.3);
 assert.equal(p.records[3].status,'CANCELLED');assert.equal(p.records[3].time_tenths,null);
 assert.equal(p.roster_status,'COUNT_MATCHED');assert.equal(p.rank_authorized,false);
 assert.ok(!Object.hasOwn(p.records[0],'odds'));assert.ok(!Object.hasOwn(p.records[0],'popularity'));
});
test('no inferred official ID or full-field claim',()=>{
 const p=normalizeNarPastResult({...base,expectedRosterCount:null,rows:base.rows.map(r=>({...r,horseRef:null}))});
 assert.equal(p.coverage.ids,0);assert.equal(p.roster_status,'UNVERIFIED_OR_PARTIAL');
});
test('same day, post cutoff and incorrect identity source fail closed',()=>{
 assert.throws(()=>normalizeNarPastResult({...base,targetDate:base.priorRace.raceDate}),/INVALID_PAST_RACE/);
 assert.throws(()=>normalizeNarPastResult({...base,observedAt:base.cutoff}),/AFTER_CUTOFF/);
 assert.throws(()=>normalizeNarPastResult({...base,sourceUrl:base.sourceUrl.replace('www.keiba.go.jp','example.com')}),/INVALID_SOURCE/);
 assert.throws(()=>normalizeNarPastResult({...base,sourceUrl:base.sourceUrl.replace('k_raceNo=1','k_raceNo=2')}),/SOURCE_RACE_MISMATCH/);
 assert.throws(()=>normalizeNarPastResult({...base,heading:base.heading.replace('第1競走','第2競走')}),/HEADER_RACE_MISMATCH/);
});
test('duplicate number and ID are rejected',()=>{
 assert.throws(()=>normalizeNarPastResult({...base,rows:[...base.rows,base.rows[0]]}),/DUPLICATE_HORSE/);
 assert.throws(()=>normalizeNarPastResult({...base,rows:base.rows.map((r,i)=>i===1?{...r,horseRef:base.rows[0].horseRef}:r)}),/DUPLICATE_OFFICIAL_ID/);
});
test('followup must be exact ID, official link, earlier date and earlier observation',()=>{
 const packet=normalizeNarPastResult(base);
 const h={official_horse_id:'1002',source:'NAR_OFFICIAL_HORSE_HISTORY',source_ref:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=1002',race_date:'2025-11-18',race_no:2,track:'高知',finish:1,observed_at:'2025-11-19T01:00:00Z'};
 const out=summarizeOpponentFollowup({packet,currentHorseId:'1001',historyRows:[h,h,{...h,race_date:'2025-11-20'},{...h,official_horse_id:'1003'},{...h,observed_at:base.cutoff}]});
 assert.equal(out.evidence.length,1);assert.equal(out.winning_peer_count,1);assert.equal(out.status,'PARTIAL_OR_MISSING');
 const reconstructed=normalizeNarPastResult({...base,mode:'RECONSTRUCTED',observedAt:'2026-11-16T00:00:00Z'});
 assert.equal(reconstructed.source_timing,'RECONSTRUCTED_NOT_ASOF');
 assert.throws(()=>summarizeOpponentFollowup({packet:reconstructed,currentHorseId:'1001',historyRows:[h]}),/UNVERIFIED_PAST_PACKET/);
});
