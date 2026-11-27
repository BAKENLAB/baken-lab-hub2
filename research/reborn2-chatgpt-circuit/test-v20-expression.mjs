import assert from 'node:assert/strict';
import {prototypePacket} from './allfield-prototype-v17.mjs';
import {validateV16} from './synthetic-generator-v16.mjs';
import {analyzeV20,validateScenario} from './race-expression-v20.mjs';
import {readFileSync} from 'node:fs';
const test=(id,f)=>{f();console.log(id+' PASS (V20 research)');};
const p=prototypePacket(),a=analyzeV20(p),horse=(o,id)=>o.decisions.find(h=>h.id===id),race=(o,id)=>o.measured.find(r=>r.race===id);
const target='FIXTURE-A';
function rebuild(r){
 const leader=Array.from({length:7},(_,j)=>Math.min(...r.rows.map(h=>h.checkpoint_tenths[j])));
 r.lap_tenths=leader.map((x,j)=>x-(leader[j-1]??0));
 for(const h of r.rows){const rank=j=>1+r.rows.filter(x=>x.checkpoint_tenths[j]<h.checkpoint_tenths[j]).length;h.finish=rank(6);h.corners=[0,1,3,5].map(rank);h.clock_tenths=h.checkpoint_tenths[6];h.final3f_tenths=h.clock_tenths-h.checkpoint_tenths[3];h.margin_tenths=h.finish===1?null:h.clock_tenths-leader[6];}
}
test('F20-01',()=>{
 assert.equal(a.audit.length,460);assert.ok(a.measured.every(r=>r.scope==='RACE_LEADER_CLOCK_NOT_INDIVIDUAL'&&r.calibrated_pace===null));
 assert.ok(a.measured[0].phases.every(x=>x.direction==='UNKNOWN_NO_REFERENCE'));
 assert.ok(a.measured.some(r=>r.reference.sample_size>0));
 assert.ok(a.measured.every(r=>r.phases.reduce((n,x)=>n+x.tenths,0)===r.race_clock_tenths));
});
const q=structuredClone(p), changed=q.history.find(r=>r.id==='FK-GEN-2');
// Coherent timing intervention: move every horse's early checkpoints by the
// same offset, preserve crossing orders and final clock; rebuild derived values.
const early=race(a,changed.id).phases[0],delta=early.reference_tenths+(early.delta_tenths<=0?2:-2)-early.tenths;
assert.ok(Number.isInteger(delta));
for(const h of changed.rows)h.checkpoint_tenths=h.checkpoint_tenths.map((x,j)=>x+[Math.trunc(delta/2),delta,Math.trunc(delta/2),0,0,0,0][j]);
rebuild(changed);
const b=analyzeV20(q);
test('F20-02',()=>{
 assert.equal(validateV16(q).valid,true);
 assert.deepEqual(changed.rows.map(x=>x.corners),p.history.find(r=>r.id===changed.id).rows.map(x=>x.corners));
 assert.notDeepEqual(race(a,changed.id).phases,race(b,changed.id).phases);
 assert.equal(race(a,changed.id).race_clock_tenths,race(b,changed.id).race_clock_tenths);
 assert.notDeepEqual(horse(a,target).views.B.observations.find(x=>x.race===changed.id).pace_context,horse(b,target).views.B.observations.find(x=>x.race===changed.id).pace_context);
 assert.notDeepEqual(horse(a,target).views.B.observations.find(x=>x.race===changed.id).phase_comparison,horse(b,target).views.B.observations.find(x=>x.race===changed.id).phase_comparison);
});
const k=structuredClone(p), kr=k.history[0], u=kr.rows.find(x=>x.id==='FIXTURE-B'),v=kr.rows.find(x=>x.id==='FIXTURE-C');
[u.checkpoint_tenths[0],v.checkpoint_tenths[0]]=[v.checkpoint_tenths[0],u.checkpoint_tenths[0]];rebuild(kr);
const c=analyzeV20(k);
test('F20-03',()=>{
 assert.equal(validateV16(k).valid,true);assert.deepEqual(a.measured,c.measured);
 assert.notDeepEqual(horse(a,'FIXTURE-B').views.A.observations,horse(c,'FIXTURE-B').views.A.observations);
 assert.deepEqual(horse(a,target).views.A.observations.map(x=>x.positions),horse(c,target).views.A.observations.map(x=>x.positions));
});
const d=structuredClone(p);d.target.entrants[0].kg+=1;d.target.conditions.first_corner_m+=50;d.target.conditions.going='重';const e=analyzeV20(d);
test('F20-04',()=>{
 assert.deepEqual(horse(a,target).views.A,horse(e,target).views.A);
 assert.notDeepEqual(horse(a,target).views.B,horse(e,target).views.B);
 assert.ok(horse(e,target).views.B.observations.every(x=>x.transfer.status==='TRANSFER_UNESTABLISHED'));
 assert.deepEqual(a.field.scenarios.map(x=>x.leader),e.field.scenarios.map(x=>x.leader));
});
test('F20-05',()=>{
 const ids=p.target.entrants.map(x=>x.id);
 assert.ok(a.field.scenarios.some(s=>s.kind==='LEADER_OTHERS_YIELD'));
 assert.ok(a.field.scenarios.some(s=>s.kind==='SUBSET_CHALLENGE'));
 assert.ok(a.field.scenarios.some(s=>s.kind==='MID_RACE_ADVANCE'));
 assert.ok(a.field.scenarios.every(s=>validateScenario(s,ids)&&s.pace===null&&s.winner===null));
 const bad=structuredClone(a.field.scenarios[0]);bad.mid[1]=bad.mid[0];assert.equal(validateScenario(bad,ids),false);
 assert.ok(a.decisions.every(h=>h.views.D.paths.length===a.field.scenarios.length));
});
test('F20-06',()=>{
 assert.ok(a.decisions.some(h=>h.views.D.paths.some(s=>s.witness.some(w=>w.goals.includes('WIN')&&w.goals.includes('PLACE')))));
 assert.ok(horse(a,'FIXTURE-D').history.every(o=>o.beaten===0));
 assert.ok(a.decisions.every(h=>new Set(h.views.D.families).size===h.views.D.families.length));
 assert.ok(a.decisions.every(h=>h.rank===null&&h.formal===false));
});
test('F20-07',()=>{
 const no=analyzeV20(p,{disableEye01:true});
 assert.ok(a.trace.some(t=>t.eye==='EYE-01'&&t.roots.length>0));
 assert.equal(no.trace.filter(t=>t.eye==='EYE-01').length,0);
 assert.ok(a.decisions.some(h=>h.views.A.defeat_context.some(x=>x.interpretation==='COUNTER_TO_BEATING_A_RIVAL')));
 assert.ok(a.decisions.some(h=>h.views.A.defeat_context.some(x=>x.interpretation==='NEUTRAL_MEASURED_DEFEAT_CONTEXT')));
 for(const h of a.decisions){const n=horse(no,h.id);assert.deepEqual(h.views.B,n.views.B);assert.deepEqual(h.views.D,n.views.D);assert.deepEqual(h.views.A.observations,n.views.A.observations);}
});
test('F20-08',()=>{
 const rev=structuredClone(p);rev.history.reverse();rev.target.entrants.reverse();rev.history.forEach(r=>r.rows.reverse());
 assert.deepEqual(a,analyzeV20(rev));
 const wrong=structuredClone(p);wrong.history[0].lap_tenths[0]++;assert.throws(()=>analyzeV20(wrong),/V20_INPUT/);
});
test('F20-09',()=>{
 const changed=structuredClone(p);const [x,y]=changed.target.entrants;[x.draw,y.draw]=[y.draw,x.draw];const result=analyzeV20(changed);
 assert.deepEqual(horse(result,target).views.A,horse(a,target).views.A);
 assert.notDeepEqual(horse(result,target).views.B,horse(a,target).views.B);
 assert.notDeepEqual(result.field.scenarios[0].geometry.draw_order,a.field.scenarios[0].geometry.draw_order);
});
test('F20-10',()=>{
 const w=JSON.parse(readFileSync(new URL('./work19-v20-diagnostic.json',import.meta.url)));
 assert.equal(w.unresolved,26);assert.equal(w.saga_histories,55);assert.equal(w.saga_locators,55);assert.equal(w.eligible,0);assert.equal(w.formal,0);assert.equal(w.flags,826);assert.equal(w.all_held,true);assert.equal(w.raw_bytes,false);
 assert.equal(a.formal,false);assert.equal(a.release_eligible,false);
});
test('F20-11',()=>{
 const paths=a.decisions.flatMap(h=>h.views.D.paths.map(p=>({id:h.id,...p})));
 assert.ok(paths.some(p=>p.witness.some(w=>w.status==='PATH_MOVEMENT_DIFFERS_NOT_ABILITY_COUNTER')));
 assert.ok(paths.some(p=>p.witness.some(w=>w.pair.some(q=>q.status==='NO_SHARED_RACE'))));
 for(const path of paths){const s=a.field.scenarios.find(x=>x.id===path.scenario);const expected=[...new Set([s.leader,...s.challengers,...(s.mover?[s.mover]:[])].filter(id=>id!==path.id))].sort();for(const w of path.witness)assert.deepEqual(w.pair.map(x=>x.rival),expected);}
 assert.ok(paths.some(p=>p.witness.some(w=>w.historicalCounter==='NO_BEATEN_RIVAL')));
});
test('F20-12',()=>{
 const off=analyzeV20(p,{disableEye12:true});
 assert.ok(off.trace.every(t=>t.eye!=='EYE-12'));
 for(const h of a.decisions){const n=horse(off,h.id);assert.deepEqual(h.views.A,n.views.A);assert.deepEqual(h.views.B,n.views.B);assert.deepEqual(h.views.D.paths.map(({eyeReview,...x})=>x),n.views.D.paths.map(({eyeReview,...x})=>x));}
 const reviews=a.decisions.flatMap(h=>h.views.D.paths.flatMap(x=>x.eyeReview));
 assert.equal(a.trace.filter(x=>x.eye==='EYE-12').length,reviews.length);
 assert.ok(reviews.every(x=>x.actual_improvement===null&&x.roots.length>0));
 // Lack of a canonical source is explicitly not a claimed EYE12 material success.
 console.log('F20_EYE12_ACTUAL_REVIEWS '+reviews.length);
});
test('F20-13',()=>{assert.ok(a.root_check.distinct>0);assert.deepEqual(a.root_check.unbound,[]);assert.ok(a.measured.every(r=>r.roots.some(x=>x==='fixture-v2:laps:'+r.race)));});
console.log('F20_SUMMARY '+JSON.stringify({formal:false,root_check:a.root_check,measured:a.measured,pace_intervention:{before:race(a,changed.id),after:race(b,changed.id)},position_intervention:{before:horse(a,'FIXTURE-B').history[0].positions,after:horse(c,'FIXTURE-B').history[0].positions},scenarios:a.field.scenarios,trace:a.trace,decisions:a.decisions.map(h=>({id:h.id,A:h.views.A.observations.map(o=>({race:o.race,finish:o.finish,positions:o.positions,role:o.role})),B:h.views.B.observations,paths:h.views.D.paths}))}));
