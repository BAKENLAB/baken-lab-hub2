import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraPriorAbilityRankShadow} from './jra-prior-ability-rank-shadow.mjs';
const target={raceDate:'2026-11-08',postTime:'2026-11-08T15:30:00+09:00',
 frozenAt:'2026-11-08T14:27:00+09:00',surface:'芝',distance:2500,officialVerified:true};
const roster=()=>Array.from({length:6},(_,i)=>({horse_no:i+1,
 horse_name:'テスト馬'+(i+1),rank:i+1,score:94-i*2,status:'ACTIVE'}));
const proof=(n,date='2026-01-18',checked='2026-11-08T12:40:00+09:00')=>
 [{horse_no:n,horse_name:'テスト馬'+n,priorRuns:[{
 raceDate:date,track:'京都',surface:'芝',distance:2400,finish:2,margin:0.0,
 grade:'G2',earlyPos:1,officialSourceRef:'https://www.jra.go.jp/JRADB/accessS.html?CNAME=test',
 sourceCheckedAt:checked,identityVerified:true,officialVerified:true
 }]}];
test('verified prior graded evidence changes only a research shadow rank',()=>{
 const frozenRunners=roster(),copy=structuredClone(frozenRunners);
 const got=buildJraPriorAbilityRankShadow({target,frozenRunners,proofByHorse:proof(6),bonusPoints:6});
 assert.equal(got.status,'RESEARCH_SHADOW_NOT_VALIDATED');
 assert.deepEqual(got.promoted_to_top5,[6]);
 assert.deepEqual(got.lost_from_top5,[5]);
 assert.equal(got.entries.find(x=>x.horse_no===6).old_rank,6);
 assert.equal(got.entries.find(x=>x.horse_no===6).shadow_rank,4);
 assert.equal(got.production_rank_effect,false);
 assert.equal(got.production_score_effect,false);
 assert.equal(got.changed_frozen,false);
 assert.deepEqual(frozenRunners,copy);
});
test('evidence checked after frozen is not treated as pre-race proof',()=>{
 const got=buildJraPriorAbilityRankShadow({target,frozenRunners:roster(),
  proofByHorse:proof(6,'2026-01-18','2026-11-08T14:28:00+09:00')});
 assert.equal(got.evidence_used_runners,0);
 assert.equal(got.altered_rank_runners,0);
});
test('old record without exact official provenance cannot create a score bonus',()=>{
 const bad=proof(6);bad[0].priorRuns[0].officialSourceRef='https://not-jra.example/race';
 const got=buildJraPriorAbilityRankShadow({target,frozenRunners:roster(),proofByHorse:bad});
 assert.equal(got.evidence_used_runners,0);
});
test('current race result, popularity, or new historical result is not an input',()=>{
 const data=proof(6,'2026-11-08');
 const got=buildJraPriorAbilityRankShadow({target,frozenRunners:roster(),proofByHorse:data});
 assert.equal(got.evidence_used_runners,0);
 assert.equal(got.market_used,false);
 assert.equal(got.target_result_used,false);
});
test('duplicate horse identity and after-post target reject the shadow',()=>{
 const dup=[...proof(6),...proof(6)];
 assert.equal(buildJraPriorAbilityRankShadow({target,frozenRunners:roster(),proofByHorse:dup}).status,'BAD_EVIDENCE_IDENTITY');
 const after={...target,frozenAt:target.postTime};
 assert.equal(buildJraPriorAbilityRankShadow({target:after,frozenRunners:roster(),proofByHorse:proof(6)}).status,'UNVERIFIED_TARGET');
});
test('all runners must be ACTIVE with exact contiguous pre-saved rank',()=>{
 const f=roster();f[5].rank=5;
 assert.equal(buildJraPriorAbilityRankShadow({target,frozenRunners:f,proofByHorse:[]}).status,'INVALID_FROZEN_ROSTER');
});
