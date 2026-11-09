import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalRelativeConditionComparison as compare} from '../automation/local-relative-condition-comparison.mjs';
const runs=[
 {race_date:'2026-10-10',track:'高知',race_name:'C3-10',surface:'ダート',distance:1300,finish:1,margin:'0.2',early_pos:2,final_turn_pos:2},
 {race_date:'2026-10-25',track:'高知',race_name:'C3-9',surface:'ダート',distance:1400,finish:2,margin:'クビ',early_pos:2,final_turn_pos:3}
];
const field=()=>[
 {horse_no:1,horse_name:'A',recent_runs:structuredClone(runs)},
 {horse_no:2,horse_name:'B',recent_runs:[
 {race_date:'2026-10-10',track:'高知',surface:'ダート',distance:1300,finish:9,margin:'1.9',early_pos:8},
 {race_date:'2026-10-25',track:'高知',surface:'ダート',distance:1300,finish:7,margin:'0.5',early_pos:7}
 ]},
 {horse_no:3,horse_name:'C',recent_runs:[]}
];
test('compares confirmed second-place gap without inventing NAR winner downside',()=>{
 const f=field(),before=structuredClone(f),v=compare(f,{surface:'ダート',distance:1300},'2026-11-08');
 assert.equal(v.status,'READY');assert.equal(v.runner_count,3);assert.equal(v.comparison_count,1);
 assert.equal(v.runner_evidence[0].close_runs,2);
 assert.equal(v.runner_evidence[1].decisive_defeats,0);
 assert.equal(v.runner_evidence[2].comparison_status,'NO_COMPARABLE_RUN');
 assert.equal(v.comparisons[0].close_evidence_leader,1);
 assert.equal(v.rank_effect,false);assert.equal(v.score_effect,false);
 assert.equal(v.market_used,false);assert.equal(v.target_result_used,false);
 assert.deepEqual(f,before);
});
test('does not invent margin from nonnumeric official historical text',()=>{
 const f=field();f[0].recent_runs[1].finish=3;f[0].recent_runs[1].margin='ハナ';
 const v=compare(f,{surface:'ダート',distance:1300},'2026-11-08');
 assert.equal(v.runner_evidence[0].close_runs,1);
 assert.equal(v.runner_evidence[0].podium_runs,2);
});
test('invalid roster and future date fail closed',()=>{
 let f=field();f[1].horse_no=1;
 assert.equal(compare(f,{surface:'ダート',distance:1300},'2026-11-08').status,'UNVERIFIED_ROSTER');
 f=field();f[0].recent_runs[0].race_date='2026-11-08';
 assert.equal(compare(f,{surface:'ダート',distance:1300},'2026-11-08').status,'HISTORICAL_ASOF_REJECTED');
});
test('unknown conditions cannot become an adopted scorer',()=>{
 const v=compare(field(),{},'2026-11-08');
 assert.equal(v.status,'CONDITIONS_OR_ROSTER_UNAVAILABLE');
 assert.equal(v.rank_effect,false);
});
test('odds and current result are not input features',()=>{
 const f=field();f[0].popularity=1;f[0].win_odds=1.1;f[0].result={finish:16};
 const v=compare(f,{surface:'ダート',distance:1300},'2026-11-08');
 const str=JSON.stringify(v);
 assert.equal(v.status,'READY');
 assert.equal(str.includes('popularity'),false);
 assert.equal(str.includes('win_odds'),false);
 assert.equal(str.includes('"result"'),false);
});

test('CLAIM comparison must NOT discard verified prior runs after class, district or distance change',()=>{
 const f=field();
 f[0].recent_runs=[
  {race_date:'2026-10-25',track:'佐賀',race_name:'C2-18',surface:'ダート',
   distance:1300,finish:2,margin:'クビ'},
  {race_date:'2026-09-19',track:'東京',race_name:'1勝クラス',surface:'芝',
   distance:1800,finish:5,margin:null}
 ];
 const v=compare(f,{surface:'ダート',distance:900},'2026-11-10');
 assert.equal(v.status,'READY');
 assert.equal(v.runner_evidence[0].supporting_runs.length,0);
 assert.equal(v.runner_evidence[0].context_runs.length,2);
 assert.equal(v.runner_evidence[0].cross_condition_run_count,2);
 assert.equal(v.runner_evidence[0].context_runs[0].finish,2);
 assert.equal(v.runner_evidence[0].context_runs[0].distance,1300);
 assert.equal(v.runner_evidence[0].context_runs[1].finish,5);
 assert.equal(v.runner_evidence[0].context_runs[1].track,'東京');
 assert.equal(v.rank_effect,false);
});
test('projected context does not carry market or results, and never treats NAR raw margin as seconds',()=>{
 const f=field();
 f[0].recent_runs[1].popularity=1;
 f[0].recent_runs[1].win_odds=1.1;
 const v=compare(f,{surface:'ダート',distance:1300},'2026-11-08');
 const h=v.runner_evidence[0].context_runs[1];
 assert.equal(h.raw_margin,'クビ');
 assert.equal(h.margin_basis,'NAR_SECOND_PLACE_PRECEDING_IS_WINNER');
 assert.equal(h.margin_unit,'LENGTHS_TO_WINNER');
 assert.equal(JSON.stringify(v).includes('win_odds'),false);
 assert.equal(JSON.stringify(v).includes('popularity'),false);
 assert.equal(v.target_result_used,false);
});
