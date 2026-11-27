import assert from 'node:assert/strict';
import {replayWork32,reviewWork32} from './work32-replay.mjs';
const report=[];
for(const n of [3,5,12]){
  const run=reviewWork32(n,{placeThreshold:2});
  assert.equal(run.runners.filter(h=>h.status==='ACTIVE').length,n);
  assert.equal(run.runners.length,n+2);
  assert.equal(run.formal,false);
  for(const h of run.runners){
    assert.equal(new Set(h.audit.map(x=>x.id)).size,115);
    assert.equal(h.grade,null);
    if(h.status!=='ACTIVE'){
      assert.equal(h.axes.B.conditions.length,0);
      assert.equal(h.axes.D.scenarios.length,0);
    }
  }
  const h=run.runners[1];
  assert.ok(h.axes.B.conditions.some(x=>x.matched.includes('distance')));
  assert.ok(h.axes.B.conditions.some(x=>x.changed.includes('distance')&&x.changed.includes('weight')));
  assert.equal(h.axes.B.current_support,null);
  report.push({active:n,audit_rows:run.runners.length*115,candidates:0,
    historical_rebuttals:run.runners.reduce((count,h)=>count+h.axes.E.opposing.length,0)});
}
const {pack}=replayWork32(3);
const evidence=pack.packet.evidence.find(e=>e.field==='current_card_row'&&e.subject==='TEST:H2');
assert.ok(evidence);
const withdrawn=reviewWork32(3,{withdraw:evidence.evidenceId,placeThreshold:2});
assert.equal(withdrawn.runners.find(h=>h.slot.endsWith('|TEST:H2')).state,'HELD_IDENTITY_OR_STATUS');
assert.throws(()=>reviewWork32(3,{withdraw:'unknown'}),/UNKNOWN_WITHDRAWAL/);
const rankConflict=reviewWork32('CLOCK_RANK_CONFLICT');
assert.ok(rankConflict.conflicts.length>0);
const paceConflict=reviewWork32('LAP_CROSSING_CONFLICT');
assert.ok(paceConflict.runners[0].axes.D.observed_pace.some(p=>p.state==='LEADER_PACE_UNAVAILABLE'));
const missing=reviewWork32('MISSING_CONDITIONS');
assert.ok(missing.runners[0].axes.B.conditions.some(p=>p.unknown.includes('distance')));
assert.ok([rankConflict,paceConflict,missing].every(x=>x.runners.every(h=>h.grade===null)));
console.log(JSON.stringify({adverse_cases:3,cases:report,entry_withdrawal:'HELD_IDENTITY_OR_STATUS',formal:false}));
