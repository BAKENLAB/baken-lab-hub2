import test from 'node:test';
import assert from 'node:assert/strict';
import { auditUnknownCapability } from './audit.mjs';

const race = Object.freeze({
  race_date:'2026-10-31',track:'京都',surface:'芝',distance:1400,class_name:'オープン'
});
const historical = (date, finish, distance, margin, extras={}) => ({
  race_date:date,finish,surface:'芝',distance,margin_to_winner:margin,
  track:'中山',race_class:'未勝利',...extras
});
const baseline = () => [
  ...Array.from({length:5},(_,i)=>({
    horse_no:i+1,horse_name:'baseline-'+(i+1),rank:i+1,score:98-i*2,past_runs:[]
  })),
];
const runner = (no,rank,score,past_runs,extra={})=>({
  horse_no:no,horse_name:'candidate-'+no,rank,score,past_runs,...extra
});
const evaluate = (...challengers) => auditUnknownCapability(race,[...baseline(),...challengers]);

test('Butterfly: 1200 win + 1500 second gives 1400 bridge, not an auto-upgrade',()=>{
  const history=[
    historical('2026-09-22',1,1200,0.6),
    historical('2026-08-29',2,1500,0.5,{track:'札幌'})
  ];
  const report=evaluate(runner(9,10,73,history));
  const c=report.review_queue[0];
  assert.equal(report.review_queue.length,1);
  assert.ok(c.capability_evidence.includes('POSITIVE_DISTANCE_BRIDGE'));
  assert.ok(c.capability_evidence.includes('TWO_RECENT_TOP3'));
  assert.ok(c.unknown_conditions.includes('CLASS_UNTESTED'));
  assert.equal(c.proposed_rank,null);
  assert.equal(c.proposed_score,null);
  assert.equal(c.original_rank,10);
  assert.equal(report.comparison_anchor.rank,5);
  assert.equal(report.prediction_unchanged,true);
});
test('Nix Luna: repeated 1400 top3 triggers review even if winning margin is zero',()=>{
  const h=[
    historical('2026-09-26',1,1400,0,{track:'阪神'}),
    historical('2026-09-06',2,1400,0.1,{track:'阪神'})
  ];
  const c=evaluate(runner(6,6,84,h)).review_queue[0];
  assert.ok(c.capability_evidence.includes('REPEATED_EXACT_DISTANCE_TOP3'));
  assert.ok(c.capability_evidence.includes('TWO_RECENT_TOP3'));
  assert.equal(c.verified_good_races,2);
});
test('one-race debut winner does not meet independent-run gate',()=>{
  const c=evaluate(runner(6,6,86,[historical('2026-10-04',1,1400,0.5,{track:'京都',race_class:'新馬'})]));
  assert.equal(c.review_queue.length,0);
});
test('explicit high-grade result retained as verified capability; unverified still separate',()=>{
  const c=evaluate(runner(7,7,80,[
    historical('2026-10-05',1,1400,0.3),
    historical('2026-08-30',3,1400,0.1,{race_class:'GⅠ'})
  ])).review_queue[0];
  assert.ok(c.capability_evidence.includes('VERIFIED_GRADED_TOP3'));
  assert.equal(c.unknown_conditions.includes('CLASS_UNTESTED'),false);
});
test('comparable actual defeats are contradictions, not "unknown"',()=>{
  const c=evaluate(runner(6,6,79,[
    historical('2026-10-20',10,1400,2.1,{track:'京都'}),
    historical('2026-10-10',8,1400,1.8,{track:'京都'})
  ])).audits.find(x=>x.horse_no===6);
  assert.ok(c.explicit_contradictions.includes('REPEATED_COMPARABLE_DEFEATS'));
  assert.equal(c.unknown_conditions.includes('EXACT_COURSE_UNTESTED'),false);
  assert.equal(c.category,'NO_AUTOMATIC_REVIEW');
});
test('obstacle races cannot be used as flat capability proof',()=>{
  const c=evaluate(runner(6,6,73,[
    historical('2026-10-20',1,1400,1.5,{race_class:'障害未勝利',track:'京都'}),
    historical('2026-09-02',1,1400,0.3,{race_class:'未勝利',track:'京都'})
  ])).audits.find(x=>x.horse_no===6);
  assert.equal(c.verified_good_races,1);
  assert.equal(c.category,'NO_AUTOMATIC_REVIEW');
});
test('race-day or future records are excluded (no result leakage)',()=>{
  const c=evaluate(runner(6,6,73,[
    historical('2026-10-31',1,1400,4),
    historical('2026-09-02',1,1400,0.3)
  ])).audits.find(x=>x.horse_no===6);
  assert.ok(c.history_warnings.includes('INVALID_OR_NON_PRERACE_HISTORY'));
  assert.equal(c.verified_good_races,1);
  assert.equal(c.category,'NO_AUTOMATIC_REVIEW');
});
test('no source mutation; market popularity is ignored',()=>{
  const h=[historical('2026-09-22',1,1200,0.6),historical('2026-08-29',2,1500,0.5)];
  const original=runner(6,6,73,h,{popularity:1,odds:1.1});
  const originalJson=JSON.stringify(original);
  const a=evaluate(original).review_queue[0];
  assert.equal(JSON.stringify(original),originalJson);
  assert.equal(a.original_score,73);
  assert.equal('market_popularity' in a,false);
  assert.equal('odds' in a,false);
});
test('duplicate horse or rank fails closed',()=>{
  assert.throws(()=>auditUnknownCapability(race,[...baseline(),runner(1,6,75,[])]),/duplicate horse/);
  assert.throws(()=>auditUnknownCapability(race,[...baseline(),runner(6,5,75,[])]),/duplicate horse or rank/);
});
test('no automatic promotion even when two pieces of evidence exist',()=>{
  const report=evaluate(
    runner(6,6,80,[historical('2026-09-22',1,1200,0.6),historical('2026-08-29',2,1500,0.5)]),
    runner(7,7,75,[])
  );
  assert.deepEqual(report.audits.map(x=>x.original_rank),[1,2,3,4,5,6,7]);
  assert.equal(report.review_queue[0].review_instruction,'COMPARE_WITH_ALL_TOP5_BY_ABILITY_AND_COUNTEREVIDENCE');
  assert.ok(report.audits.every(x=>x.proposed_rank===null));
});
