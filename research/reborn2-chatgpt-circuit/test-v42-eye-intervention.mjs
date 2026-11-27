import assert from 'node:assert/strict';
import {loadV40} from './work36-v40-integrated.mjs';
import {admission,leakAudit} from './work36-v41-local-decision.mjs';
import {integrate} from './work36-v42-propagation.mjs';

const V=await loadV40();
const docs=V.master.f.docs;
const standard=new Set(V.generated.find(g=>g.f.id==='W36_BASE').f.docs.map(d=>d.eventId));
const available=docs.filter(d=>d.kind==='HISTORICAL_RESULT'&&!standard.has(d.eventId)).slice(0,2).map(d=>d.eventId);
assert.deepEqual(available,['TEST:W36_POS_A','TEST:W36_POS_B']);
const on=admission(V,available);
const off=admission(V,available,{eyeEnabled:false});
assert.deepEqual(on.admitted,off.admitted);
assert.equal(on.x.source_digest,off.x.source_digest);
assert.deepEqual(on.x.source_packet,off.x.source_packet);
assert.deepEqual(on.x.history_v41,off.x.history_v41);
const a=integrate(on.x,docs),b=integrate(off.x,docs,{eyeEnabled:false});
assert.deepEqual(a.routes,b.routes);
for(const [x,z] of [[on.x,a],[off.x,b]]){
  const leak=leakAudit({...x,v42:z});
  assert.equal(leak.leaks.length+leak.events.length+leak.broken.length,0);
}
const horse='TEST:NAR|TEST:H4',peer='TEST:NAR|TEST:H1';
const runner=z=>z.runners.find(h=>h.horse===horse);
const upstream=x=>x.runners.find(h=>h.slot===horse).findings_v33??[];
const recovery=f=>f.item==='RANK18'&&f.eye_id&&f.observation?.rival===peer;
assert.ok(upstream(on.x).some(recovery));
assert.ok(!upstream(off.x).some(recovery));
const route='TEST:NAR|TEST:COUNTER@800>TEST:NAR|TEST:W36_POS_B@800';
const path=z=>runner(z).paths.find(p=>p.id===route);
const enabled=path(a),disabled=path(b);
assert.equal(enabled.decision,disabled.decision);
assert.ok(enabled.axes[4].support.some(e=>e.item==='EYE03'&&e.rival===peer));
assert.equal(disabled.axes[4].support.length,0);
assert.deepEqual(enabled.axes.slice(0,4),disabled.axes.slice(0,4));
assert.ok(a.runners.every(h=>h.grade===null&&h.current_grade===null&&h.items.length===115));
console.log(JSON.stringify({test:'SAME_PACKET_EYE03',digest:a.digest,horse,peer,route,
  before:disabled.decision,after:enabled.decision,axisESupport:[disabled.axes[4].support.length,enabled.axes[4].support.length],formal:false}));

const roster=on.x.roster.possible_active;
assert.deepEqual(new Set(a.runners.map(h=>h.horse)),new Set(roster));
const evidence=new Map(on.x.source_packet.evidence.map(e=>[e.evidenceId,e]));
const retained=new Map(on.x.admissionTrace.retained.map(e=>[e.id,e]));
const field=a.runners.map(h=>{
  const p=h.paths.find(x=>x.id===route);
  assert.ok(p);
  const axes=p.axes.map(({axis,support,counter,unknown,refs})=>({
    axis,support:support.length,counter:counter.length,unknown:unknown.length,refs
  }));
  const usedRoots=[...new Set(axes.flatMap(axis=>axis.refs))].map(ref=>{
    const source=evidence.get(ref);
    if(source)return {ref,root:source.root};
    const derived=retained.get(ref);
    return {ref,root:null,dependencies:derived?.depends??null};
  });
  return {horse:h.horse,conditionalGrade:h.conditional_grade,currentGrade:h.current_grade,
    routeDecision:p.decision,mathematicalEnvelope:p.field&&[p.field.min,p.field.max],
    currentApplicability:p.actual_current,axes,usedRoots};
});
console.log('FULL_FIELD '+JSON.stringify({schema:'REBORN2_SYNTHETIC_REVIEW_V1',sourceDigest:a.digest,
  admittedEvents:on.admitted,route,scope:'HISTORICAL_SCENARIO_ONLY',formal:false,field}));
