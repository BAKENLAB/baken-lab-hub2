import test from 'node:test';
import assert from 'node:assert/strict';
import {projectOfficialOpponentFollowups as project} from './local-opponent-followup-claimed-bridge.mjs';
const race={race_date:'2026-11-19',track:'園田',race_no:5,post_time:'2026-11-19T12:00:00+09:00'};
const a={raceDate:'2026-10-02',track:'園田',raceNo:2},b={raceDate:'2026-10-30',track:'園田',raceNo:3};
const priorUrl='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=27&k_raceDate=2026%2F10%2F02&k_raceNo=2';
const nextUrl='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=27&k_raceDate=2026%2F10%2F30&k_raceNo=3';
const observation='2026-11-19T07:00:00+09:00',now=Date.parse(observation)+1000;
const runners=[{horse_no:5,horse_name:'SYNTHETIC_A',recent_runs:[{race_date:'2026-10-02',track:'園田',race_no:2}]}];
const cornerSources=[{current_horse_no:5,past_race:{race_date:'2026-10-02',track:'園田',race_no:2},official_source_ref:priorUrl,source_checked_at:observation,verification_scope:'PRECLAIM_OFFICIAL_PAST_RESULT'}];
const packet=[{horseNo:5,horseName:'SYNTHETIC_A',priorRace:a,sourceRef:priorUrl,sourceCheckedAt:observation,
 peerOfficialHorseId:'12345678',peerName:'VERIFIED_PEER',peerPriorFinish:2,
 followupRace:b,followupSourceRef:nextUrl,followupCheckedAt:observation,
 peerFollowupFinish:1,identityMethod:'EXACT_NAR_OFFICIAL_HORSE_ID_TWO_RESULT_PAGES',rankingEffect:'NONE_UNTIL_REVIEWED'}];
const run=extra=>project({race,runners,cornerSources,packet,now,...extra});
test('same official ID two prior results can supply only cited peer later finish',()=>{const result=run();assert.equal(result.status,'VERIFIED_PARTIAL_FOLLOWUP');assert.equal(result.followup_count,1);assert.equal(result.score_effect,0);assert.equal(result.rows[0].peer_finish_in_followup,1);assert.equal(result.rows[0].original_run_ref,'COMPACT_V1.runners[horse_no=5].recent_runs[0]')});
test('name-only and different current horse cannot attach',()=>{assert.equal(run({cornerSources:[]}).followup_count,0);assert.equal(run({packet:[{...packet[0],horseNo:6}]}).followup_count,0)});
test('post-start and later target results cannot leak',()=>{assert.equal(run({now:Date.parse(race.post_time)+1}).status,'PRE_RACE_CONTEXT_REQUIRED');assert.equal(run({packet:[{...packet[0],followupRace:{...b,raceDate:'2026-11-19'}}]}).followup_count,0)});
test('untrusted identity method cannot authorize strength',()=>{assert.equal(run({packet:[{...packet[0],identityMethod:'NAME_ONLY'}]}).followup_count,0)});
