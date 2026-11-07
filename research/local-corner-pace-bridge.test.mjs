import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeLocalOfficialCorners} from '../automation/local-corner-pace-bridge.mjs';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';
const date='2026-11-08',clock=()=>Date.parse('2026-11-08T08:00:00+09:00');
const targetRace={raceDate:date,track:'佐賀',raceNo:1,postTime:'2026-11-08T09:30:00+09:00'};
const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const officialRunners=[
 {horse_no:1,horse_name:'ハヤブサブロー',recent_runs:[
  {race_date:'2026-11-07',track:'佐賀',race_no:5,surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null},
  {race_date:'2026-11-01',track:'佐賀',race_no:3,surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null}]},
 {horse_no:2,horse_name:'シエルブリエ',recent_runs:[]}
];
const evidence=(raceDate,raceNo,earlyPos,finalTurnPos)=>{
 const pastRace={raceDate,track:'佐賀',raceNo};return {
  horseNo:1,horseName:'ハヤブサブロー',horseRef,identityVerifiedBy:'OFFICIAL_HORSE_REF',
  pastRace,pastHorseNo:6,earlyPos,finalTurnPos,
  source:'NAR_OFFICIAL_PAST_RACE_RESULT',sourceRef:officialNarPastResultUrl(pastRace),
  sourceCheckedAt:'2026-11-08T07:50:00+09:00',rankingEffect:'NONE_UNTIL_REVIEWED'};
};
const packet={status:'PREFETCH_ONLY',raceDate:date,raceTrack:'佐賀',raceNo:1,
 claimStarted:false,saveAuthorized:false,marketUsed:false,targetResultUsed:false,rankChanged:false,
 evidence:[evidence('2026-11-07',5,1,10),evidence('2026-11-01',3,2,5)]};
const bridge=(p=packet,r=officialRunners)=>bridgeLocalOfficialCorners({
 targetRace,officialRunners:r,cornerPacket:p,
 conditions:{surface:'ダート',distance:1300},clock
});
test('verified official corners enrich exact runner and drive two-run front tendency',()=>{
 const out=bridge();
 assert.equal(out.applied,2);assert.equal(out.ignored,0);
 assert.equal(out.field_pace_evidence.runners_with_historical_passing_order,1);
 assert.equal(out.field_pace_evidence.repeated_front_style_contenders,1);
 assert.equal(out.field_pace_evidence.runners[0].repeated_front_evidence,true);
 assert.equal(out.runners[0].recent_runs[0].early_pos,1);
 assert.equal(out.runners[0].recent_runs[0].final_turn_pos,10);
 assert.equal(officialRunners[0].recent_runs[0].early_pos,null);
 assert.equal(out.rankChanged,false);assert.equal(out.claimStarted,false);assert.equal(out.saveAuthorized,false);
});
test('horse-name mismatch and wrong official URL reject optional rows without changing other runners',()=>{
 const bad=structuredClone(packet);bad.evidence[0].horseName='別の馬';bad.evidence[1].sourceRef='https://evil.example';
 const out=bridge(bad);assert.equal(out.applied,0);assert.equal(out.ignored,2);
 assert.equal(out.field_pace_evidence.repeated_front_style_contenders,0);
});
test('missing corresponding claimed historic run does not fabricate history',()=>{
 const out=bridge(packet,[{...officialRunners[0],recent_runs:[]},officialRunners[1]]);
 assert.equal(out.applied,0);assert.equal(out.ignored,2);
});
test('conflicting existing original position stays immutable',()=>{
 const copied=structuredClone(officialRunners);copied[0].recent_runs[0].early_pos=4;
 const out=bridge(packet,copied);assert.equal(out.applied,1);
 assert.equal(out.runners[0].recent_runs[0].early_pos,4);
 assert.equal(out.runners[0].recent_runs[0].final_turn_pos,null);
});
test('after post do not admit any historical evidence',()=>{
 const out=bridgeLocalOfficialCorners({targetRace,officialRunners,cornerPacket:packet,
  clock:()=>Date.parse(targetRace.postTime)});
 assert.equal(out.status,'SKIPPED_POST_TIME');assert.equal(out.applied,0);
});
test('wrong target race and unsafe market or claim packet are rejected',()=>{
 assert.throws(()=>bridge({...packet,raceNo:2}),/UNTRUSTED/);
 assert.throws(()=>bridge({...packet,marketUsed:true}),/UNTRUSTED/);
 assert.throws(()=>bridge({...packet,claimStarted:true}),/UNTRUSTED/);
});
test('duplicate historic race cannot add two independent examples',()=>{
 const out=bridge({...packet,evidence:[packet.evidence[0],packet.evidence[0]]});
 assert.equal(out.applied,1);assert.equal(out.ignored,1);
});
