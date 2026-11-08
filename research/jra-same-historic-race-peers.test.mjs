import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJraSameRacePeerEvidence} from '../automation/jra-same-historic-race-peers.mjs';
const ref='/JRADB/accessS.html?CNAME=pw01sde1008202604040820261011/E8';
const nums=[1,2,8,9,13],finishes=[3,10,5,4,2],
  margins=[0.1,0.4,0.1,0.1,0.1],
  pos=[[11,11,14,14],[3,3,4,5],[13,13,11,8],[14,13,11,11],[2,2,2,2]];
const officialRunners=nums.map(n=>({
 horse_no:n,horse_name:'Horse'+n,horse_ref:'official-horse-'+n,status:'ACTIVE'
}));
const liveRunners=nums.map((n,i)=>({
 horse_no:n,horse_name:'Horse'+n,horse_ref:'official-horse-'+n,
 past_runs:[{race_date:'2026-10-11',track:'京都',surface:'ダート',
  distance:1800,source_ref:ref,finish:finishes[i],
  margin_to_winner:margins[i],corner_positions:pos[i],
  final3f:[36.4,37.4,36.6,36.4,37.4][i]}]
}));
const clock=()=>Date.parse('2026-11-08T12:27:00+09:00');
const params={targetRaceDate:'2026-11-08',targetPostTime:'2026-11-08T13:30:00+09:00',officialRunners,liveRunners,clock};
test('five official-ref-matched rivals in one historical JRA race are directly compared',()=>{
 const out=buildJraSameRacePeerEvidence(params);
 assert.equal(out.status,'SAME_RACE_PEERS_GROUPED');
 assert.equal(out.groups.length,1);
 const g=out.groups[0];
 assert.equal(g.runners.length,5);
 assert.equal(g.race_date,'2026-10-11');
 assert.equal(g.source_ref,ref);
 assert.deepEqual(g.runners.map(x=>x.horse_no),[13,1,9,8,2]);
 assert.equal(g.runners.find(x=>x.horse_no===2).winner_margin_seconds,0.4);
 assert.deepEqual(g.runners.find(x=>x.horse_no===9).corners,[14,13,11,11]);
 assert.equal(g.runners.find(x=>x.horse_no===1).final3f_seconds,36.4);
 assert.equal(g.independently_refetched,false);
 assert.equal(g.race_laps_checked,false);
 assert.equal(g.loss_cause,'UNPROVEN');
 assert.equal(out.market_used,false);
 assert.equal(out.score_change,false);
 assert.equal(out.prediction_saved,false);
});
test('same historical date but different result URLs cannot be claimed as direct rivals',()=>{
 const other=structuredClone(liveRunners);
 other[1].past_runs[0].source_ref=ref.replace('/E8','/F2');
 const out=buildJraSameRacePeerEvidence({...params,liveRunners:other});
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].runners.length,4);
 assert.equal(out.groups[0].runners.some(x=>x.horse_no===2),false);
});
test('current JRA official horse identity must match exact name and official URL',()=>{
 const other=structuredClone(liveRunners);
 other[0].horse_ref='wrong-person';
 const out=buildJraSameRacePeerEvidence({...params,liveRunners:other});
 assert.equal(out.status,'OFFICIAL_CURRENT_HORSE_IDENTITY_MISMATCH');
 assert.deepEqual(out.groups,[]);
});
test('post-start or nonprior results never enter research evidence',()=>{
 const after=buildJraSameRacePeerEvidence({...params,clock:()=>Date.parse(params.targetPostTime)});
 assert.equal(after.status,'UNVERIFIED_PRE_RACE_INPUT');
 const copy=structuredClone(liveRunners);
 copy.forEach(x=>{x.past_runs[0].race_date='2026-11-08';});
 const future=buildJraSameRacePeerEvidence({...params,liveRunners:copy});
 assert.equal(future.groups.length,0);
});
test('winners recorded leading margins are NOT treated as beaten margins',()=>{
 const copy=structuredClone(liveRunners);
 copy[0].past_runs[0].finish=1;
 copy[0].past_runs[0].margin_to_winner=0.7;
 const g=buildJraSameRacePeerEvidence({...params,liveRunners:copy}).groups[0];
 const winner=g.runners.find(x=>x.horse_no===1);
 assert.equal(winner.winner_margin_seconds,0);
 assert.equal(winner.reported_margin_when_winner,0.7);
});
test('untrusted result host paths and invalid competitor statuses cannot pass',()=>{
 const copy=structuredClone(liveRunners);
 copy.forEach(x=>{x.past_runs[0].source_ref='https://fake-jra.example/result';});
 const x=buildJraSameRacePeerEvidence({...params,liveRunners:copy});
 assert.equal(x.groups.length,0);
 const of=structuredClone(officialRunners);of[0].status='SCRATCHED';
 const y=buildJraSameRacePeerEvidence({...params,officialRunners:of});
 assert.equal(y.status,'OFFICIAL_CURRENT_ROSTER_UNVERIFIED');
});
