import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalFieldContentFacts} from '../automation/local-field-content-facts.mjs';
const ctx=()=>({context_format:'COMPACT_V1',field_integrity_checked:true,race:{circuit:'LOCAL',race_date:'2026-11-14',track:'高知',conditions:{distance:1400,surface:'ダート'}},
runners:[{horse_no:1,horse_name:'試験A',recent_runs:[{race_date:'2026-11-01',track:'高知',race_no:5,race_name:'C2',distance:1400,surface:'ダート',finish:4,time_raw:'1:31.4',final3f:'39.2',early_pos:8,final_turn_pos:6,margin:'クビ'}]},
{horse_no:2,horse_name:'試験B',recent_runs:[{race_date:'2026-11-01',track:'高知',race_no:5,race_name:'C2',distance:1400,surface:'ダート',finish:2,time_raw:'1:31.1',final3f:'39.8',early_pos:2,final_turn_pos:2}]}]});
test('actual same-race finish, time difference and corner movement, not constructed winner gap',()=>{
 const x=buildLocalFieldContentFacts(ctx());
 assert.equal(x.status,'VERIFIED_WHOLE_FIELD_FACTS');assert.equal(x.runner_count,2);
 assert.equal(x.head_to_head.length,1);assert.equal(x.head_to_head[0].finish_leader,2);
 assert.equal(x.head_to_head[0].elapsed_a_minus_b_seconds,0.3);
 assert.equal(x.head_to_head[0].final3f_a_minus_b_seconds,-0.6);
 assert.equal(x.per_runner[0].runs[0].first_to_final_corner_gain,2);
 assert.equal(x.per_runner[0].runs[0].raw_margin,'クビ');assert.equal(x.score_effect,0);
});
test('conflicting conditions, unavailable times and future records never generate invented comparisons',()=>{
 let c=ctx();c.runners[1].recent_runs[0].distance=1300;
 assert.equal(buildLocalFieldContentFacts(c).head_to_head_count,0);
 c=ctx();c.runners[1].recent_runs[0].time_raw='非計測';
 assert.equal(buildLocalFieldContentFacts(c).head_to_head[0].elapsed_a_minus_b_seconds,null);
 c=ctx();c.runners[1].recent_runs[0].race_date='2026-11-14';
 assert.equal(buildLocalFieldContentFacts(c).status,'UNVERIFIED_INPUT');
});

test('real LOCAL condition omission is resolved only by verified single-surface venue capability',()=>{
 const c=ctx();for(const r of c.runners)delete r.recent_runs[0].surface;
 const x=buildLocalFieldContentFacts(c);
 assert.equal(x.head_to_head_count,1);
 assert.equal(x.per_runner[0].runs[0].surface_provenance,'NAR_OFFICIAL_SINGLE_SURFACE_TRACK_CAPABILITY');
 for(const r of c.runners)r.recent_runs[0].track='盛岡';
 assert.equal(buildLocalFieldContentFacts(c).head_to_head_count,0);
});

test('verified course transitions and loss-review flags are descriptive, market-free and score-neutral',()=>{
 const c=ctx();c.race.conditions.going='良';
 c.runners[0].recent_runs[0].going='稍重';
 const x=buildLocalFieldContentFacts(c,{transitionStats:[{
  current_track:'高知',current_distance:1400,current_going:'良',
  prev_track:'高知',prev_distance:1400,prev_going:'稍重',
  sample_n:42,wins:7,top3s:19,win_rate:0.1667,top3_rate:0.4524,
  baseline_win_rate:0.1,baseline_top3_rate:0.3,win_lift_pp:6.67,
  top3_lift_pp:15.24,avg_popularity:1.1
 }]});
 assert.equal(x.course_correlation.status,'VERIFIED_DESCRIPTIVE_TRANSITIONS');
 assert.equal(x.course_correlation.matched_run_count,1);
 assert.equal(x.per_runner[0].runs[0].course_transition_evidence.sample_n,42);
 assert.equal('avg_popularity' in x.per_runner[0].runs[0].course_transition_evidence,false);
 assert.equal(x.per_runner[0].loss_review_candidate_count,1);
 assert.deepEqual(x.per_runner[0].loss_review_candidates[0].flags,
  ['LATE_POSITION_GAIN_OUTSIDE_TOP3','VERIFIED_FINAL3F_SUPPORTS_REVIEW']);
 assert.equal(x.loss_with_merit_review.automatic_score_effect,0);
 assert.equal(x.score_effect,0);assert.equal(x.market_used,false);
});

test('unsupported laps and opponent follow-up stay explicitly unverified',()=>{
 const x=buildLocalFieldContentFacts(ctx());
 assert.equal(x.full_race_laps.status,'NOT_VERIFIED');
 assert.equal(x.opponent_followup_strength.status,'NOT_VERIFIED');
});
