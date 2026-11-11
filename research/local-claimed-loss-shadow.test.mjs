import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalClaimedLossShadow} from './local-claimed-loss-shadow.mjs';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';
const ref='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const targetRace={raceDate:'2026-11-08',track:'佐賀',raceNo:1,postTime:'2026-11-08T09:30:00+09:00'};
const clock=()=>Date.parse('2026-11-08T08:00:00+09:00');
const past=(d,n)=>({
 race_date:d,track:'佐賀',race_no:n,horse_no:6,horse_ref:ref,
 source:'NAR_OFFICIAL_HISTORY',identity_verified_by:'OFFICIAL_HORSE_REF',
 surface:'ダート',distance:1300,finish:7,early_pos:null,final_turn_pos:null
});
const verifiedRunners=[{horse_no:1,horse_name:'架空馬6',identity_refs:[ref],
 recent_runs:[past('2026-11-07',5),past('2026-11-01',3)]}];
const compactRunners=[{horse_no:1,horse_name:'架空馬6',recent_runs:[
 {race_date:'2026-11-07',track:'佐賀',race_no:5,surface:'ダート',distance:1300,
  finish:7,early_pos:null,final_turn_pos:null},
 {race_date:'2026-11-01',track:'佐賀',race_no:3,surface:'ダート',distance:1300,
  finish:7,early_pos:null,final_turn_pos:null}
]}];
const evidence=(date,n,early,final)=>{
 const prior={raceDate:date,track:'佐賀',raceNo:n};
 return {horseNo:1,horseName:'架空馬6',horseRef:ref,
  identityVerifiedBy:'OFFICIAL_HORSE_REF',pastRace:prior,pastHorseNo:6,
  earlyPos:early,finalTurnPos:final,
  source:'NAR_OFFICIAL_PAST_RACE_RESULT',
  sourceRef:officialNarPastResultUrl(prior),
  sourceCheckedAt:'2026-11-08T07:55:00+09:00',
  rankingEffect:'NONE_UNTIL_REVIEWED'};
};
const packet={status:'PREFETCH_ONLY',raceDate:'2026-11-08',raceTrack:'佐賀',raceNo:1,
 claimStarted:false,saveAuthorized:false,marketUsed:false,targetResultUsed:false,
 rankChanged:false,evidence:[evidence('2026-11-07',5,1,10),evidence('2026-11-01',3,2,6)]};
const run=(overrides={})=>buildLocalClaimedLossShadow({
 targetRace,verifiedRunners,compactRunners,cornerPacket:packet,
 conditions:{surface:'ダート',distance:1300,class_name:'C1'},clock,...overrides
});
test('official past corners feed observed loss clues but never a causal claim',()=>{
 const before=structuredClone(compactRunners);
 const result=run();
 assert.equal(result.status,'EVIDENCE_ONLY');
 assert.equal(result.applied_prior_runs,2);
 assert.equal(result.audit.verified_runner_count,1);
 assert.equal(result.audit.runners[0].observed_corners_count,2);
 assert.equal(result.audit.runners[0].records[0].clues[0].code,'LOST_POSITION_BEFORE_FINAL_TURN');
 assert.equal(result.audit.runners[0].records[0].true_loss_cause,'UNPROVEN');
 assert.equal(result.audit.market_used,false);
 assert.equal(result.rank_effect,false);
 assert.equal(result.save_gate_effect,false);
 assert.deepEqual(compactRunners,before);
});
test('partial official evidence is labelled, and no core ranking effects follow',()=>{
 const unredacted=structuredClone(verifiedRunners);
 unredacted[0].recent_runs[1].horse_no=11;
 const x=run({verifiedRunners:unredacted});
 assert.equal(x.status,'PARTIAL_EVIDENCE');
 assert.equal(x.applied_prior_runs,1);
 assert.equal(x.ignored_prior_runs,1);
 assert.equal(x.audit.runners[0].observed_corners_count,1);
});
test('swapped horse and future outcome cannot enter the optional loss audit',()=>{
 const bad=structuredClone(verifiedRunners);bad[0].horse_name='別の馬';
 assert.equal(run({verifiedRunners:bad}).status,'UNVERIFIED_CORNER_CONTEXT');
 const time=()=>Date.parse(targetRace.postTime);
 assert.equal(run({clock:time}).status,'NO_INDEPENDENT_CORNER_PROOF');
});
