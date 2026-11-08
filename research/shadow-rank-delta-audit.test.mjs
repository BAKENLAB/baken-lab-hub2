import test from 'node:test';
import assert from 'node:assert/strict';
import {auditShadowRankDelta} from '../automation/shadow-rank-delta-audit.mjs';
const field=Array.from({length:7},(_,i)=>({horse_no:i+1,horse_name:'馬'+(i+1)}));
const baseline=field.map(x=>({...x}));
const proposed=[field[0],field[1],field[5],field[3],field[4],field[2],field[6]];
const race={race_date:'2026-11-07',track:'高知',race_no:11};
const evidence=[{horse_no:6,category:'SAME_CONDITION',fact_count:2,status:'VERIFIED',
 source_ref:'OFFICIAL_PAST_RESULT',checked_at:'2026-11-07T09:00:00+09:00',past_race_date:'2026-11-01'}];
const args={circuit:'LOCAL',modelVersion:'1.6',race,field,baseline,proposed,
 evidence,asOf:'2026-11-07T11:00:00+09:00',resultFinisherNos:[6,2,3]};
test('LOCAL full-field comparison reports gained AND lost finishers',()=>{
 const x=auditShadowRankDelta(args);
 assert.deepEqual(x.newly_selected,[6]);
 assert.deepEqual(x.lost_from_top5,[3]);
 assert.deepEqual(x.newly_captured_finishers,[6]);
 assert.deepEqual(x.lost_captured_finishers,[3]);
 assert.equal(x.baseline_top3_captured,2);
 assert.equal(x.shadow_top3_captured,2);
 assert.equal(x.production_rank_changed,false);
});
test('JRA0.4 uses the same independent evidence audit',()=>{
 const x=auditShadowRankDelta({...args,circuit:'JRA',modelVersion:'0.4'});
 assert.equal(x.circuit,'JRA');assert.equal(x.market_used,false);
});
test('post-race source timing is not allowed as pre-race evidence',()=>{
 assert.throws(()=>auditShadowRankDelta({...args,evidence:[{...evidence[0],checked_at:'2026-11-07T12:00:00+09:00'}]}),/EVIDENCE_NOT_AS_OF_VERIFIED/);
});
test('future past-run and unsupported evidence category are rejected',()=>{
 assert.throws(()=>auditShadowRankDelta({...args,evidence:[{...evidence[0],past_race_date:'2026-11-07'}]}),/EVIDENCE_NOT_AS_OF_VERIFIED/);
 assert.throws(()=>auditShadowRankDelta({...args,evidence:[{...evidence[0],category:'ODDS'}]}),/EVIDENCE_NOT_AS_OF_VERIFIED/);
});
test('market data cannot enter ability comparison',()=>{
 assert.throws(()=>auditShadowRankDelta({...args,field:[{...field[0],win_odds:2.3},...field.slice(1)]}),/MARKET_CONTAMINATION/);
});
test('partial field or duplicate horse identities are rejected',()=>{
 assert.throws(()=>auditShadowRankDelta({...args,proposed:proposed.slice(0,5)}),/ROSTER_INCOMPLETE/);
 assert.throws(()=>auditShadowRankDelta({...args,proposed:[proposed[0],proposed[0],...proposed.slice(2)]}),/ROSTER_MISMATCH/);
});
test('unverified evidence cannot claim positive facts',()=>{
 assert.throws(()=>auditShadowRankDelta({...args,evidence:[{...evidence[0],status:'UNVERIFIED'}]}),/EVIDENCE_NOT_AS_OF_VERIFIED/);
});
