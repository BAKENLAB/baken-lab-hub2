import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalClaimedCornerShadow} from '../automation/local-claimed-corner-shadow.mjs';
import {officialNarPastResultUrl} from '../automation/nar-prior-corners.mjs';
const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
const targetRace={raceDate:'2026-11-08',track:'佐賀',raceNo:1,postTime:'2026-11-08T09:30:00+09:00'};
const now=()=>Date.parse('2026-11-08T08:00:00+09:00');
const prior=(race_date,race_no)=>({
 race_date,track:'佐賀',race_no,horse_no:6,horse_ref:horseRef,
 source:'NAR_OFFICIAL_HISTORY',identity_verified_by:'OFFICIAL_HORSE_REF',
 surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null
});
const unredacted=[{horse_no:1,horse_name:'架空馬6',identity_refs:[horseRef],
 recent_runs:[prior('2026-11-07',5),prior('2026-11-01',3)]}];
const compact=[{horse_no:1,horse_name:'架空馬6',recent_runs:[
 {race_date:'2026-11-07',track:'佐賀',race_no:5,surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null},
 {race_date:'2026-11-01',track:'佐賀',race_no:3,surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null}
]}];
const event=(raceDate,raceNo,earlyPos,finalTurnPos)=>{
 const pastRace={raceDate,track:'佐賀',raceNo};
 return {horseNo:1,horseName:'架空馬6',horseRef,
  identityVerifiedBy:'OFFICIAL_HORSE_REF',pastRace,pastHorseNo:6,earlyPos,finalTurnPos,
  source:'NAR_OFFICIAL_PAST_RACE_RESULT',sourceRef:officialNarPastResultUrl(pastRace),
  sourceCheckedAt:'2026-11-08T07:55:00+09:00',rankingEffect:'NONE_UNTIL_REVIEWED'};
};
const packet={status:'PREFETCH_ONLY',raceDate:'2026-11-08',raceTrack:'佐賀',raceNo:1,
 claimStarted:false,saveAuthorized:false,marketUsed:false,targetResultUsed:false,rankChanged:false,
 evidence:[event('2026-11-07',5,1,10),event('2026-11-01',3,2,6)]};
const make=(overrides={})=>buildLocalClaimedCornerShadow({
 targetRace,verifiedRunners:unredacted,compactRunners:compact,
 cornerPacket:packet,conditions:{surface:'ダート',distance:1300},clock:now,...overrides
});
test('same verified pre-CLAIM corners enter shadow field pace without changing core prediction input',()=>{
 const original=structuredClone(compact),witness=structuredClone(unredacted);
 const x=make();
 assert.equal(x.applied_prior_runs,2);
 assert.equal(x.inserted_corner_fields,4);
 assert.equal(x.field_pace_evidence.runners[0].repeated_front_evidence,true);
 assert.equal(x.verified_corner_sources.length,2);
 assert.deepEqual(x.verified_corner_sources.map(s=>s.past_race.race_no),[5,3]);
 assert.equal(x.verified_corner_sources[0].official_source_ref,
  officialNarPastResultUrl({raceDate:'2026-11-07',track:'佐賀',raceNo:5}));
 assert.equal(x.verified_corner_sources[0].current_horse_no,1);
 assert.equal(x.verified_corner_sources[0].past_horse_no,6);
 assert.equal(x.verified_corner_sources[0].source_checked_at,'2026-11-08T07:55:00+09:00');
 assert.equal(x.verified_corner_sources[0].rank_effect,'NONE_UNTIL_REVIEWED');
 assert.deepEqual(compact,original);assert.deepEqual(unredacted,witness);
 assert.equal(x.use_for_rank,false);assert.equal(x.use_for_save_gate,false);
 assert.equal(JSON.stringify(x).includes('claim_token'),false);
});
test('unmatched confirmed horse identity never creates new historical facts',()=>{
 const copy=structuredClone(unredacted);copy[0].recent_runs[0].horse_no=11;
 const x=make({verifiedRunners:copy});
 assert.equal(x.applied_prior_runs,1);
 assert.equal(x.verified_corner_sources.length,1);
 assert.equal(x.verified_corner_sources[0].past_race.race_no,3);
 assert.equal(x.runners[0].recent_runs[0].early_pos,null);
 assert.equal(x.field_pace_evidence.runners[0].repeated_front_evidence,false);
});
test('swapped official field identity is rejected before optional overlay',()=>{
 const copy=structuredClone(unredacted);copy[0].horse_name='別の馬';
 assert.throws(()=>make({verifiedRunners:copy}),/CLAIM_ROSTER_MISMATCH/);
});
test('invalid target packet is rejected; no cross-race mixing',()=>{
 assert.throws(()=>make({cornerPacket:{...packet,raceNo:99}}),/UNTRUSTED_PREFETCH_PACKET/);
});
test('core position mismatch fails closed and never rewrites core values',()=>{
 const copy=structuredClone(compact);copy[0].recent_runs[0].early_pos=9;
 assert.throws(()=>make({compactRunners:copy}),/CORE_POSITION_MISMATCH/);
 assert.equal(copy[0].recent_runs[0].early_pos,9);
});

test('future-checked official page never becomes a cited witness',()=>{
 const copy=structuredClone(packet);
 copy.evidence[0].sourceCheckedAt='2026-11-08T09:31:00+09:00';
 const x=make({cornerPacket:copy});
 assert.equal(x.applied_prior_runs,1);
 assert.equal(x.verified_corner_sources.length,1);
 assert.equal(x.verified_corner_sources[0].past_race.race_no,3);
});


test('validated pre-CLAIM corners become shadow relative evidence, never core ranks',()=>{
 // Relative whole-field review deliberately requires at least two starters.
 const x=make({
  verifiedRunners:[...structuredClone(unredacted),{
   horse_no:2,horse_name:'架空馬2',identity_refs:[],recent_runs:[]}],
  compactRunners:[...structuredClone(compact),{
   horse_no:2,horse_name:'架空馬2',recent_runs:[]}]
 });
 const v=x.research_relative_condition_evidence;
 assert.equal(v.status,'READY');
 assert.equal(v.corner_evidence_scope,'VERIFIED_PRECLAIM_OFFICIAL_HISTORY_ONLY');
 assert.equal(v.corner_enriched_prior_runs,2);
 assert.equal(v.runner_evidence[0].supporting_runs.length,2);
 assert.deepEqual(v.runner_evidence[0].supporting_runs.map(h=>h.early_pos),[1,2]);
 assert.deepEqual(v.runner_evidence[0].supporting_runs.map(h=>h.final_turn_pos),[10,6]);
 assert.equal(v.rank_effect,false);
 assert.equal(v.score_effect,false);
 assert.equal(v.market_used,false);
 assert.equal(v.target_result_used,false);
 assert.equal(x.use_for_rank,false);
 assert.equal(x.use_for_save_gate,false);
 assert.equal(compact[0].recent_runs[0].early_pos,null);
 assert.equal(unredacted[0].recent_runs[0].early_pos,null);
});
test('rejected or missing preclaim corners produce no shadow relative comparison',()=>{
 const copy=structuredClone(packet);
 copy.evidence.forEach(e=>e.sourceCheckedAt='2026-11-08T09:31:00+09:00');
 const x=make({cornerPacket:copy});
 assert.equal(x.applied_prior_runs,0);
 assert.equal(x.research_relative_condition_evidence,null);
 assert.equal(x.runners[0].recent_runs[0].early_pos,null);
});
