import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLocalHistoricalSurface,resolveLocalOfficialClassLiteral} from '../automation/local-verified-condition-bridge.mjs';
import {buildLocalRelativeConditionComparison} from '../automation/local-relative-condition-comparison.mjs';
import {buildRelativeAbilityRankProposal} from '../automation/relative-ability-rank-proposal.mjs';

const time='2026-11-09T10:05:00+09:00';
const future='2026-11-09T13:00:00+09:00';
const runs=(n,track='名古屋')=>(n===5?[
 {race_date:'2026-10-20',track,surface:undefined,distance:1400,race_name:'C29組',finish:9,margin:'2.2'},
 {race_date:'2026-10-28',track,surface:undefined,distance:1400,race_name:'C29組',finish:8,margin:'1.9'}
]:n===6?[
 {race_date:'2026-10-20',track,surface:undefined,distance:1400,race_name:'C29組',finish:2,margin:'クビ'},
 {race_date:'2026-10-28',track,surface:undefined,distance:1400,race_name:'C29組',finish:1,margin:'1'}
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
 assert.deepEqual(resolveLocalOfficialClassLiteral('C29組','名古屋'),
  {status:'OFFICIAL_TOKAI_GROUP_LITERAL',class_label:'C29'});
 assert.deepEqual(resolveLocalOfficialClassLiteral('C23組','名古屋'),
  {status:'OFFICIAL_TOKAI_GROUP_LITERAL',class_label:'C23'});
 assert.deepEqual(resolveLocalOfficialClassLiteral('C2七組','盛岡'),
  {status:'OFFICIAL_CLASS_LITERAL',class_label:'C2'});
 assert.deepEqual(resolveLocalOfficialClassLiteral('C2-18組','高知'),
  {status:'OFFICIAL_CLASS_LITERAL',class_label:'C2'});
 assert.deepEqual(resolveLocalOfficialClassLiteral('オッズパーク賞C2','高知'),
  {status:'OFFICIAL_CLASS_LITERAL',class_label:'C2'});
 assert.equal(resolveLocalOfficialClassLiteral('C29組').class_label,null);
 assert.equal(resolveLocalOfficialClassLiteral('C14・C17組','笠松').status,'AMBIGUOUS_CLASS');
 assert.equal(resolveLocalOfficialClassLiteral('3歳C2').class_label,'3歳C2');
 assert.equal(resolveLocalOfficialClassLiteral('A1・A2').status,'AMBIGUOUS_CLASS');
 assert.equal(resolveLocalOfficialClassLiteral('スポンサー賞').status,'CLASS_NOT_EXPLICIT');
});
test('verified Tokai group and second-place neck with missing surface become auditable evidence',()=>{
 const before=field(),unchanged=structuredClone(before);
 const c=buildLocalRelativeConditionComparison(before,{surface:'ダート',distance:1400},'2026-11-09');
 assert.equal(c.status,'READY');
 assert.equal(c.recovered_surface_run_count,4);
 assert.equal(c.comparable_runner_count,2);
 assert.equal(c.runner_evidence[5].close_runs,2);
 assert.equal(c.runner_evidence[5].supporting_runs[0].margin,0.30);
 assert.equal(c.runner_evidence[5].supporting_runs[0].margin_unit,'LENGTHS_TO_WINNER');
 assert.equal(c.runner_evidence[5].supporting_runs[0].margin_basis,'NAR_SECOND_PLACE_PRECEDING_IS_WINNER');
 assert.equal(c.runner_evidence[5].supporting_runs[0].class,'C29');
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
 assert.equal(p.target_class_evidence.class_label,'C29');
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
 const p=proposal(f,'名古屋','C29組');
 assert.equal(p.status,'UNCHANGED');
});
test('no current result or odds ever enter ranking proposal',()=>{
 const f=field();f[5].popularity=14;f[5].win_odds=88;
 const p=proposal(f);
 assert.equal(p.market_used,false);
 assert.equal(p.target_result_used,false);
 assert.equal(JSON.stringify(p).includes('win_odds'),false);
});

test('today Nagoya C23 is NOT Morioka C2 and never comparable to C2 group',()=>{
 assert.deepEqual(resolveLocalOfficialClassLiteral('C23組','名古屋'),
  {status:'OFFICIAL_TOKAI_GROUP_LITERAL',class_label:'C23'});
 assert.deepEqual(resolveLocalOfficialClassLiteral('C20組','名古屋'),
  {status:'OFFICIAL_TOKAI_GROUP_LITERAL',class_label:'C20'});
 assert.equal(resolveLocalOfficialClassLiteral('C23組','名古屋').class_label===
   resolveLocalOfficialClassLiteral('C2七組','盛岡').class_label,false);
 const f=field();
 for(const row of f)for(const h of row.recent_runs)h.race_name='C2七組';
 const v=proposal(f,'名古屋','C23組');
 assert.equal(v.status,'UNCHANGED');
 assert.equal(v.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
});
test('Tokai group number is exact and literal, unlike other venues same tier',()=>{
 for(const [title,track,class_label] of [
  ['やまぐち和牛燦C22','名古屋','C22'],
  ['イロハ疾風戦C17','名古屋','C17'],
  ['B5組','名古屋','B5'],
  ['アルマーズ大空戦B3','名古屋','B3'],
  ['C14組','笠松','C14'],
  ['C2-18','高知','C2'],
  ['C2四組','盛岡','C2']
 ])assert.equal(resolveLocalOfficialClassLiteral(title,track).class_label,class_label,title);
 assert.equal(resolveLocalOfficialClassLiteral('金シャチ最終戦C','名古屋').class_label,null);
 assert.equal(resolveLocalOfficialClassLiteral('A4・B3組','笠松').status,'AMBIGUOUS_CLASS');
});
test('NAR third-place neck and distant numerical lengths never become close-to-winner proof',()=>{
 const f=field();
 f[5].recent_runs=[
  {race_date:'2026-10-20',track:'名古屋',distance:1400,
    race_name:'C29組',finish:3,margin:'クビ'},
  {race_date:'2026-10-28',track:'名古屋',distance:1400,
    race_name:'C29組',finish:2,margin:'3'}
 ];
 const p=proposal(f);
 assert.equal(p.status,'UNCHANGED');
 assert.equal(p.proof_by_horse.find(h=>h.horse_no===6).same_class_close_runs,0);
});

test('official 門別 C4 is a distinct tier and mixed C3/C4/B3B4 is never a single class',()=>{
 assert.deepEqual(resolveLocalOfficialClassLiteral('3歳以上 C4-2','門別'),
  {status:'OFFICIAL_CLASS_LITERAL',class_label:'C4'});
 assert.deepEqual(resolveLocalOfficialClassLiteral('3歳以上 C4-3','門別'),
  {status:'OFFICIAL_CLASS_LITERAL',class_label:'C4'});
 for(const label of ['3歳以上 C3-2 C4-1','B4-2~C3','B3B4-1']){
  assert.equal(resolveLocalOfficialClassLiteral(label,'門別').status,'AMBIGUOUS_CLASS');
 }
 assert.equal(resolveLocalOfficialClassLiteral('B1B2 3歳以上','園田').status,'AMBIGUOUS_CLASS');
 assert.equal(resolveLocalOfficialClassLiteral('C23組','名古屋').class_label,'C23');
});
