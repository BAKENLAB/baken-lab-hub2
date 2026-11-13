import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewDeepHistory } from './deep-history-review.mjs';
const race = {race_date:'2026-10-30',track:'名古屋',distance:1500,going:'稍重',race_name:'金シャチ最終戦C'};
const current = {horse_no:9,horse_name:'キャンディタフト',rank:8,score:66,win_odds:7.8,
  recent_runs:[
    {race_date:'2026-10-19',finish:11}, {race_date:'2026-10-02',finish:9},
    {race_date:'2026-09-18',finish:9}, {race_date:'2026-08-21',finish:7},
    {race_date:'2026-07-17',finish:4},
  ]};
const old={race_date:'2026-06-05',track:'名古屋',race_name:'金シャチ最終戦Ｃ',distance:1500,going:'稍重',finish:2,
  horse_no:9,horse_name:'キャンディタフト',identity_verified:true,source_verified:true,source_ref:'https://www.keiba.go.jp/KeibaWeb/DataRoom/...' };
const run = (over={}) => reviewDeepHistory({race,runners:[current],archiveByHorseNo:{9:[old]},...over});
test('flags historical exact-condition top3 after latest five, including full-width C',()=>{
  const got=run();assert.equal(got.alerts.length,1);assert.equal(got.alerts[0].same_race_name_old_top3_count,1);
  assert.equal(got.alerts[0].original_rank,8);assert.equal(got.alerts[0].auto_score_delta,0);
  assert.equal(got.alerts[0].auto_promote,false);assert.equal(got.alerts[0].warnings[1],'RECENT_8TH_OR_WORSE_3_OF_5');
});
test('no silent mutation, no market use, no results input',()=>{
  const input=structuredClone(current), archive=structuredClone(old);
  const original=JSON.stringify({input,archive}); const got=reviewDeepHistory({race,runners:[input],archiveByHorseNo:{9:[archive]}});
  assert.equal(JSON.stringify({input,archive}),original);assert.equal(JSON.stringify(got).includes('win_odds'),false);
});
test('ignores future starts and starts within last-five boundary',()=>{
  const got=run({archiveByHorseNo:{9:[{...old,race_date:'2026-11-02'}, {...old,race_date:'2026-09-18'}]}});
  assert.equal(got.alerts.length,0);
});
test('requires verified identity, verified official source and matching horse number/name',()=>{
  const invalid=[{...old,identity_verified:false},{...old,source_ref:'https://example.com/fake'},
    {...old,horse_name:'別の馬'},{...old,horse_no:8},{...old,source_verified:false}];
  assert.equal(run({archiveByHorseNo:{9:invalid}}).alerts.length,0);
});
test('same track/distance/going mandatory; not a generic old-form bonus',()=>{
  const variants=[{...old,going:'良'},{...old,track:'金沢'}, {...old,distance:1400}, {...old,finish:4}];
  assert.equal(run({archiveByHorseNo:{9:variants}}).alerts.length,0);
});
test('less than five recent runs is insufficient, not a positive',()=>{
  const got=run({runners:[{...current,recent_runs:current.recent_runs.slice(0,3)}]});
  assert.equal(got.coverage.insufficientRecentHistory,1);assert.equal(got.alerts.length,0);
});
test('not applicable to TOP5; no automatic promotion of the sixth horse',()=>{
  const got=run({runners:[{...current,rank:5},{...current,horse_no:8,horse_name:'別の馬',rank:6}],archiveByHorseNo:{9:[old],8:[]}});
  assert.equal(got.alerts.length,0);
});
test('invalid race and missing context fail closed',()=>{
  assert.throws(()=>run({race:{...race,race_date:'2026-02-30'}}),/INVALID_RACE/);
  assert.throws(()=>reviewDeepHistory({race,runners:[current]}),/INVALID_INPUT/);
});
