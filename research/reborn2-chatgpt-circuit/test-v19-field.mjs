import assert from 'node:assert/strict';
import {analyzeV19,prototype,heterogeneous} from './field-interaction-v19.mjs';
import {readWork18,inspectWork18,makeFixtureEnvelope,routeFixtureEnvelope} from './work18-v19-intake.mjs';
const test=(id,f)=>{f();console.log(id+' PASS (V19 research)');};
const p=prototype(),a=analyzeV19(p,{compareV18:true}),off=analyzeV19(p,{disabled:['EYE-03','EYE-07','EYE-09','EYE-05']});
const horse=(r,id)=>r.decisions.find(x=>x.id===id);
test('F19-01',()=>{
 assert.equal(a.audit.length,460);assert.ok(a.field.scenarios.every(s=>s.roster.length===4&&s.actual_pace===null&&s.probability===null));
 assert.ok(a.field.scenarios.some(s=>s.pressure==='SETTLE'));assert.ok(a.field.scenarios.some(s=>s.pressure==='CONTEST'));
 assert.ok(a.decisions.every(h=>h.scenarios.length===a.field.scenarios.length&&h.scenarios.every(s=>s.actual_win_viability==='NOT_ESTABLISHED')));
 assert.ok(a.conflicts.every(c=>c.exclusive_win.startsWith('ONE_WINNER')));
});
test('F19-02',()=>{
 const d=horse(a,'FIXTURE-D');assert.ok(d.history.some(x=>x.finish===3&&x.field===3&&x.beaten===0));assert.ok(d.scenarios.some(s=>s.counter.some(x=>x.reason.includes('Finished last'))));
 assert.ok(d.scenarios.every(s=>s.support.every(r=>!d.history.some(o=>o.race===r.race&&o.beaten===0))));
 assert.ok(a.decisions.every(h=>Object.values(h.views).every(v=>v.actual_current_suitability===null)));
 assert.ok(a.decisions.some(h=>h.views.E.counter.length>0));
});
test('F19-03',()=>{
 assert.ok(a.traces.some(t=>t.item_id==='EYE-03'&&t.consumer_item_id==='73'));
 assert.ok(a.traces.some(t=>t.item_id==='EYE-09'&&t.consumer_item_id==='69'));
 assert.ok(a.traces.some(t=>t.item_id==='EYE-05'&&t.consumer_item_id==='37'));
 assert.ok(!off.traces.some(t=>['EYE-03','EYE-07','EYE-09','EYE-05'].includes(t.item_id)));
 assert.deepEqual(a.field,off.field);assert.deepEqual(horse(a,'FIXTURE-A').history,horse(off,'FIXTURE-A').history);
 assert.ok(a.audit.some(x=>x.item==='73'&&x.changed));
});
const h=heterogeneous(20261127),b=analyzeV19(h.p,{reserve:h.reserve});
test('F19-04',()=>{
 assert.equal(b.field.scenarios[0].roster.length,6);assert.equal(b.disclosed.length,1);
 assert.ok(b.decisions.some(h=>h.history.some(o=>o.applicability.state==='PARTIAL_HYPOTHESIS')));
 assert.ok(b.decisions.every(h=>h.comparisons.direct.filter(x=>x.scope.state==='PARTIAL_HYPOTHESIS').every(x=>x.state==='APPLICABILITY_UNESTABLISHED')));
 const m=horse(b,'FIXTURE-A6');assert.equal(m.history.length,0);assert.equal(m.views.A.state,'UNKNOWN');assert.ok(m.scenarios.every(s=>s.support.length===0));
});
test('F19-05',()=>{
 const q=structuredClone(p);q.target.entrants.reverse();q.history.reverse();q.history.forEach(r=>r.rows.reverse());
 const n=analyzeV19(q,{compareV18:true});assert.deepEqual(a,n);
 const v=structuredClone(h.p);v.target.entrants.at(-1).id='FIXTURE-Z99';const changed=analyzeV19(v);
 assert.ok(changed.field.scenarios.every(s=>s.roster.includes('FIXTURE-Z99')&&!s.roster.includes('FIXTURE-A6')));
 assert.deepEqual(horse(changed,'FIXTURE-A1').history,horse(analyzeV19(h.p),'FIXTURE-A1').history);
});
test('F19-06',()=>{
 const q=structuredClone(p);q.history[0].conditions.surface='turf';const r=analyzeV19(q);
 assert.ok(r.decisions.every(h=>h.scenarios.every(s=>s.support.every(x=>x.race!==q.history[0].id))));
 const h0=horse(a,'FIXTURE-A'),h1=horse(r,'FIXTURE-A');assert.deepEqual(h0.history.map(x=>[x.race,x.finish,x.clock_tenths]),h1.history.map(x=>[x.race,x.finish,x.clock_tenths]));
 assert.ok(h1.history.some(o=>o.race===q.history[0].id&&o.applicability.state==='NOT_APPLICABLE_TO_CURRENT_CLAIM'));
});
const work=inspectWork18(readWork18()),env=makeFixtureEnvelope(p),positive=routeFixtureEnvelope(env,{required_fields:work.required_fields});
test('F19-07',()=>{
 assert.equal(work.histories,147);assert.equal(work.card,69);assert.equal(work.eligible_values.length,0);
 assert.ok(positive.accepted_test_records>0);assert.equal(positive.analysis.audit.length,460);assert.equal(positive.formal_admissions,0);
 assert.deepEqual(positive.analysis,analyzeV19(p));assert.equal(positive.official_replay_eligible,0);
});
test('F19-08',()=>{
 for(const [mutate,reason] of [[x=>x.records[0].issuer='JRA','TEST_PROVENANCE'],[x=>x.records[1].observations.kg++,'ROOT_OR_DIGEST'],[x=>x.records[1].observed_at='2026-11-21T00:00:00+09:00','ASOF'],[x=>x.records.push(x.records[1]),'ROOT_OR_DIGEST'],[x=>delete x.records[1].permission_scope,'MISSING_FIELD'],[x=>x.records[1].official_evidence=true,'TEST_PROVENANCE']]){
 const x=structuredClone(env);mutate(x);assert.throws(()=>routeFixtureEnvelope(x),new RegExp(reason));}
 assert.throws(()=>routeFixtureEnvelope({schema:'evidence-v1',scope:'DIAGNOSTIC_ONLY',records:[]}),/TEST_SCOPE/);
});
test('F19-09',()=>{
 const b=horse(a,'FIXTURE-B');assert.equal(b.views.D.state,'MIXED');assert.ok(b.views.D.counter.some(x=>x.kind==='WIN'&&x.path==='LEAD'));
 const s=a.field.scenarios.find(s=>s.id==='CONTEST-SUSTAIN:FIXTURE-B'),e=a.field.scenarios.find(s=>s.id==='CONTEST-EASE:FIXTURE-B');
 assert.ok(s.interactions.some(q=>q.rival==='FIXTURE-A'&&q.pattern==='RIVAL_TAKES_LEAD'&&q.leader_finish===2&&q.rival_finish===1));
 assert.ok(s.interactions.some((q,i)=>q.compatible_position_proxy!==e.interactions[i].compatible_position_proxy));
 assert.ok(s.interactions.every(q=>q.actual_pace===null&&q.causal_pressure===null));
 const q=structuredClone(p);
 // Change only the first corner observations of the two named runners;
 // historical finish/clock/late positions remain exact. No individual
 // sectional clock was supplied to this normalized fixture.
 const r=q.history.find(x=>x.id==='FK-GEN-1'),br=r.rows.find(x=>x.id==='FIXTURE-B'),cr=r.rows.find(x=>x.id==='FIXTURE-C');
 [br.corners[0],cr.corners[0]]=[cr.corners[0],br.corners[0]];
 const n=analyzeV19(q);
 assert.ok(n.field.leaders.includes('FIXTURE-C')&&!a.field.leaders.includes('FIXTURE-C'));
 assert.deepEqual(horse(n,'FIXTURE-A').history,horse(a,'FIXTURE-A').history);
 assert.deepEqual(horse(n,'FIXTURE-D').history,horse(a,'FIXTURE-D').history);
 assert.ok(n.field.scenarios.some(s=>s.leader==='FIXTURE-C'));
});
test('F19-10',()=>{
 const q=structuredClone(p);q.history=q.history.filter(x=>x.id!=='FK-GEN-4');q.history.find(x=>x.id==='FK-GEN-3').conditions.going='重';
 const n=analyzeV19(q),b=horse(n,'FIXTURE-B');
 assert.ok(b.conditionReturn.some(x=>x.positive&&x.state==='CORROBORATED_HISTORICAL_RETURN'&&x.paired_rivals.some(y=>y.peer==='FIXTURE-C')));
 assert.ok(b.conditionReturn.every(x=>x.causal_effect===null));
 const c=horse(a,'FIXTURE-C');assert.ok(c.conditionReturn.some(x=>x.state==='CONTROLLED_DUPLICATE_NEUTRAL'&&!x.positive&&!x.negative));
 assert.ok(a.decisions.every(h=>h.scenarios.every(s=>new Set(s.witness_families.map(x=>x.family)).size===s.witness_families.length&&s.witness_families.every(x=>x.independent_vote===false))));
 assert.ok(a.decisions.some(h=>h.comparisons.later.some(x=>x.state==='CONDITIONAL_SUPPORT')));
 assert.ok(a.decisions.some(h=>h.comparisons.later.some(x=>x.state==='SCOPED_COUNTER')));
 assert.ok(a.decisions.some(h=>h.comparisons.later.some(x=>x.state==='NEUTRAL_CONTEXT')));
 const z=structuredClone(h.p),unrelated=structuredClone(h.reserve[0]);unrelated.id='FK-SYN19-UNRELATED';unrelated.rows=unrelated.rows.map((r,i)=>({...r,id:'FIXTURE-Z'+(100+i)}));
 const u=analyzeV19(z,{reserve:[unrelated]});assert.deepEqual(u.disclosed,[]);assert.deepEqual(u.decisions,analyzeV19(z).decisions);
});

const summary={formal:false,work,positive_test_records:positive.accepted_test_records,prototype:{field:a.field,returns:a.returns.map(r=>({id:r.horse_id,eye:r.eye,kind:r.kind,race:r.race_id})),traces:a.traces,horse:a.decisions.map(h=>({id:h.id,history:h.history.map(o=>({race:o.race,finish:o.finish,field:o.field,beaten:o.beaten,scope:o.applicability.state,positions:o.positions})),before:h.priorV18.perspectives,after:Object.fromEntries(Object.entries(h.views).map(([k,v])=>[k,v.state])),scenarios:h.scenarios.map(s=>({id:s.scenario,role:s.role,support:s.support.map(x=>({race:x.race,path:x.path,kind:x.kind})),counter:s.counter.map(x=>({race:x.race,reason:x.reason})),unestablished:s.unestablished.map(x=>({race:x.race,path:x.path,kind:x.kind})),unknown:s.unknown.map(x=>x.reason)}))}))},heterogeneous:{field:b.field,disclosed:b.disclosed,returns:b.returns.length,trace:b.traces.length,horse:b.decisions.map(h=>({id:h.id,views:Object.fromEntries(Object.entries(h.views).map(([k,v])=>[k,v.state])),history:h.history.length}))}};
console.log('F19_SUMMARY '+JSON.stringify(summary));
for(const [label,out] of [['prototype',a],['heterogeneous',b]])for(const h of out.decisions)console.log('F19_HORSE '+JSON.stringify({label,horse:h,audit:out.audit.filter(x=>x.id===h.id),formal:false}));
