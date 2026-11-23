import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectResearchWinChallenge} from '../research/jra-scoring-integrity-20261121/win-challenge/win-evidence-review.candidate.mjs';

const race={race_date:'2026-11-23',track:'福島',surface:'芝',distance:1200};
const top5=[11,3,12,1,6].map((horse_no,i)=>({
 horse_no,horse_name:'fixture-'+horse_no,rank:i+1,score:70-i
}));
function previous({date='2026-11-07',track='福島',dist=1200,margin=.4,
 surface='芝',corners=[3,2],finish=2}={}) {
 return {prior_date:date,prior_track:track,prior_surface:surface,
  prior_distance:dist,margin_to_winner:margin,finish,
  live_corner_positions:corners,source_ref:'FIXTURE:'+date+':'+track+':'+dist};
}
function fixture(){
 return {
  race:{...race},
  top5:top5.map(x=>({...x})),
  historyByHorse:{
   11:[previous({margin:1.2}),previous({date:'2026-10-15',track:'新潟',margin:1.0}),previous({date:'2026-09-19',track:'中山',margin:1.0}),previous({date:'2026-09-12',track:'札幌',margin:1.0})],
   3:[previous({margin:.2})],
   12:[previous({margin:1.0})],
   1:[previous({margin:0,track:'新潟',date:'2026-10-25'})],
   6:[previous({margin:2.0})]
  },
  marketExcluded:true
 };
}
test('current ◎ is preserved even with stronger direct-course challengers',()=>{
 const data=fixture(),immutable=structuredClone(data);
 const a=inspectResearchWinChallenge(data);
 assert.equal(a.ok,true);
 assert.equal(a.current_official_honmei,11);
 assert.deepEqual(a.original_top5,[11,3,12,1,6]);
 assert.deepEqual(a.challenge_candidate_horse_nos,[3]);
 assert.equal(a.review_required,true);
 assert.ok(a.human_review_flags.includes('LOW_SCORE_GAP_TO_2ND'));
 assert.ok(a.human_review_flags.includes('TOP1_HAS_FOUR_OR_MORE_HISTORY_ROWS_CHECK_VOLUME_EFFECTS'));
 assert.ok(a.human_review_flags.includes('OTHER_TOP5_HAS_STRONGER_CURRENT_DIRECT_EVIDENCE'));
 assert.equal(a.per_top5[1].exact_course_close_count,1);
 assert.equal(a.per_top5[0].exact_course_close_count,0);
 assert.equal(a.production_scoring_authorized,false);
 assert.equal(a.official_save_allowed,false);
 assert.equal(a.auto_promoted,false);
 assert.equal(a.ranking_changed,false);
 assert.equal(a.proposed_rank_change,null);
 assert.equal(a.score_deltas,null);
 assert.equal(a.bet_recommendation,null);
 assert.deepEqual(data,immutable,'must not mutate official or as-of data');
});
test('pre-race gate refuses post-race history (no hindsight)',()=>{
 const d=fixture();d.historyByHorse[3][0].prior_date='2026-11-23';
 const x=inspectResearchWinChallenge(d);
 assert.equal(x.ok,false);
 assert.match(x.reason,/INVALID_ASOF_HISTORY_3/);
 assert.equal(x.official_save_allowed,false);
});
test('gate refuses absent runner evidence and unexcluded market inputs',()=>{
 const d=fixture();d.historyByHorse[1]=[];
 assert.match(inspectResearchWinChallenge(d).reason,/HISTORY_MISSING_FOR_TOP5_HORSE_1/);
 const x=inspectResearchWinChallenge({...fixture(),marketExcluded:false});
 assert.equal(x.ok,false);
 assert.equal(x.reason,'MARKET_INPUT_NOT_PROVEN_EXCLUDED');
});
test('gate refuses a synthetic TOP5 that is not exactly ranks 1..5',()=>{
 const d=fixture();d.top5[1].rank=4;
 assert.equal(inspectResearchWinChallenge(d).ok,false);
});
test('no automatic preference when top1 already has strong same-course evidence',()=>{
 const d=fixture();
 d.historyByHorse[11][0]=previous({margin:0.2});
 d.historyByHorse[3][0]=previous({margin:.4,track:'東京'});
 const x=inspectResearchWinChallenge(d);
 assert.equal(x.ok,true);
 assert.deepEqual(x.challenge_candidate_horse_nos,[]);
 assert.equal(x.auto_promoted,false);
});
test('a prior race row lacking same-surface/near-distance does not count as win proof',()=>{
 const d=fixture();
 d.historyByHorse[3][0]=previous({track:'福島',dist:3000,surface:'芝',margin:0.1});
 const x=inspectResearchWinChallenge(d);
 assert.equal(x.ok,true);
 assert.equal(x.per_top5[1].recent_near_close_count,0);
 assert.equal(x.per_top5[1].exact_course_close_count,0);
});

test('recent same-track/distance 2nd with 0.1 gap challenges 7th with 0.7 gap, even with equal close-run counts',()=>{
 const d=fixture();
 // Both technically have one recent close run. Only the challenger has a
 // relevant same-course podium; this must not disappear in a binary count.
 d.historyByHorse[11][0]=previous({margin:.7,finish:7});
 d.historyByHorse[3][0]=previous({margin:.1,finish:2});
 const x=inspectResearchWinChallenge(d);
 assert.equal(x.ok,true);
 assert.equal(x.per_top5[0].exact_course_close_count,1);
 assert.equal(x.per_top5[1].exact_course_close_count,1);
 assert.equal(x.per_top5[0].recent_exact_podium_count,0);
 assert.equal(x.per_top5[1].recent_exact_podium_count,1);
 assert.deepEqual(x.challenge_candidate_horse_nos,[3]);
 assert.equal(x.current_official_honmei,11);
 assert.equal(x.ranking_changed,false);
 assert.equal(x.official_save_allowed,false);
});
