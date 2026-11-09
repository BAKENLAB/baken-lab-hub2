import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLocalHistoricalSurface,resolveLocalOfficialClassLiteral} from '../automation/local-verified-condition-bridge.mjs';
import {buildLocalRelativeConditionComparison} from '../automation/local-relative-condition-comparison.mjs';
import {buildRelativeAbilityRankProposal} from '../automation/relative-ability-rank-proposal.mjs';

const time='2026-11-09T10:05:00+09:00';
const future='2026-11-09T13:00:00+09:00';
const runs=(n,track='名古屋')=>(n===5?[
 {race_date:'2026-10-20',track,surface:undefined,distance:1400,race_name:'C29組',finish:9,margin:'2.2'},
 {race_date:'2026-10-28',track,surface:undefined,distance:1400,race_name:'C2七組',finish:8,margin:'1.9'}
]:n===6?[
 {race_date:'2026-10-20',track,surface:undefined,distance:1400,race_name:'C29組',finish:2,margin:'0.2'},
 {race_date:'2026-10-28',track,surface:undefined,distance:1400,race_name:'C2七組',finish:1,margin:'0.3'}
]:[]);
const field=()=>Array.from({length:7},(_,i)=>({
 horse_no:i+1,horse_name:'検証馬'+(i+1),recent_runs:runs(i+1)
}));
const proposal=(runners=field(),track='名古屋',race_name='C29組')=>{
 const comparison=buildLocalRelativeConditionComparison(runners,{surface:'ダート',distance:1400},'2026-11-09');
 return buildRelativeAbilityRankProposal({
  race:{race_date:'2026-11-09',post_time:future,observation_at:time,
   track,circuit:'LOCAL',race_name,surface:'ダート',distance:1400},
  baseline:runners.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,rank:r.horse_no})),
  comparison
 });
};
test('NAR official course capability resolves dirt-only but NEVER Morioka/JRA mixed track',()=>{
 assert.deepEqual(resolveLocalHistoricalSurface({track:'名古屋'}),{
  surface:'ダート',provenance:'NAR_OFFICIAL_SINGLE_SURFACE_TRACK_CAPABILITY',
  source_ref:'https://www.keiba.go.jp/guide/course/'});
 assert.equal(resolveLocalHistoricalSurface({track:'盛岡'}).surface,null);
 assert.equal(resolveLocalHistoricalSurface({track:'京都'}).surface,null);
 assert.equal(resolveLocalHistoricalSurface({track:'名古屋',surface:'芝'}).surface,'芝');
 assert.equal(resolveLocalHistoricalSurface({track:'名古屋',surface:'UNKNOWN'}).surface,null);
});
test('only literal unambiguous official classes, do not conflate adult and age 3',()=>{
 for(const s of ['C29組','C2七組','C2-18組','オッズパーク賞C2'])
  assert.deepEqual(resolveLocalOfficialClassLiteral(s),{status:'OFFICIAL_CLASS_LITERAL',class_label:'C2'});
 assert.equal(resolveLocalOfficialClassLiteral('3歳C2').class_label,'3歳C2');
 assert.equal(resolveLocalOfficialClassLiteral('A1・A2').status,'AMBIGUOUS_CLASS');
 assert.equal(resolveLocalOfficialClassLiteral('スポンサー賞').status,'CLASS_NOT_EXPLICIT');
});
test('historical numeric strings and missing surface become auditable comparable evidence',()=>{
 const before=field(),unchanged=structuredClone(before);
 const c=buildLocalRelativeConditionComparison(before,{surface:'ダート',distance:1400},'2026-11-09');
 assert.equal(c.status,'READY');
 assert.equal(c.recovered_surface_run_count,4);
 assert.equal(c.comparable_runner_count,2);
 assert.equal(c.runner_evidence[5].close_runs,2);
 assert.equal(c.runner_evidence[5].supporting_runs[0].margin,0.2);
 assert.equal(c.runner_evidence[5].supporting_runs[0].class,'C2');
 assert.equal(c.runner_evidence[5].supporting_runs[0].surface_provenance,'NAR_OFFICIAL_SINGLE_SURFACE_TRACK_CAPABILITY');
 assert.equal(c.runner_evidence[5].supporting_runs[0].evidence_ref,'COMPACT_V1.runners[horse_no=6].recent_runs[0]');
 assert.equal(c.rank_effect,false);
 assert.deepEqual(before,unchanged);
});
test('LOCAL pre-race challenger actually swaps boundary in research preview only',()=>{
 const original=field(),copy=structuredClone(original),p=proposal(original);
 assert.equal(p.status,'REORDERED');
 assert.deepEqual(p.baseline_top5,[1,2,3,4,5]);
 assert.deepEqual(p.top5,[1,2,3,4,6]);
 assert.equal(p.elected_challenger.horse_no,6);
 assert.deepEqual(p.rank_deltas.map(x=>x.horse_no),[5,6]);
 assert.equal(p.target_class_evidence.class_label,'C2');
 assert.equal(p.production_rank_effect,false);
 assert.equal(p.frozen_modified,false);
 assert.deepEqual(original,copy);
});
test('Morioka missing surface does not invent same-track evidence, rank never promotes',()=>{
 const f=field().map(r=>({...r,recent_runs:r.recent_runs.map(h=>({...h,track:'盛岡'}))}));
 const c=buildLocalRelativeConditionComparison(f,{surface:'ダート',distance:1400},'2026-11-09');
 assert.equal(c.comparable_runner_count,0);
 const r=buildRelativeAbilityRankProposal({
  race:{race_date:'2026-11-09',post_time:future,observation_at:time,
   track:'盛岡',circuit:'LOCAL',race_name:'C2七組',surface:'ダート',distance:1400},
  baseline:f.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,rank:h.horse_no})),comparison:c
 });
 assert.equal(r.status,'UNCHANGED');
});
test('unverified target class and age-three mismatch cannot cause senior C2 promotion',()=>{
 const f=field();
 assert.equal(proposal(f,'名古屋','A1・A2').status,'PRE_RACE_IDENTITY_OR_TIME_UNVERIFIED');
 for(const r of f)for(const h of r.recent_runs)h.race_name='3歳C2';
 const p=proposal(f,'名古屋','C2七組');
 assert.equal(p.status,'UNCHANGED');
});
test('no current result or odds ever enter ranking proposal',()=>{
 const f=field();f[5].popularity=14;f[5].win_odds=88;
 const p=proposal(f);
 assert.equal(p.market_used,false);
 assert.equal(p.target_result_used,false);
 assert.equal(JSON.stringify(p).includes('win_odds'),false);
});
