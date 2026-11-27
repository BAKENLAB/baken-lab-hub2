import assert from 'node:assert/strict';
import {loadV40,acceptedRequest,analyzeVerified} from './v43-generic.mjs';
import {makeEnvelope} from '../../reborn2-work42/validate-v0.4.mjs';
import {prepareSupply} from '../../reborn2-work42/codex-contract-v0.4.mjs';
const V=await loadV40(),id='FK34_FULL',docs=V.C.fixtures.find(f=>f.id===id).docs,{request,receipt}=acceptedRequest(V,id),envelope=makeEnvelope(docs);
const on=await analyzeVerified(V,request,receipt,{semanticVersion:48,work42Envelope:envelope});
const labels=z=>z.candidate.runners.map(h=>h.grade);
assert.deepEqual(labels(on),['B','A','UNASSESSED','A','C']);
assert.equal(on.groups,118);assert.equal(on.held,826);assert.ok(on.runners.every(h=>h.itemConsumption.length===115&&h.grade===null&&h.current_grade===null));
assert.ok(on.candidate.runners.every(h=>h.ability.axes.length===5&&h.eye.length===15&&h.formalGrade===null));
console.log('V48_BASELINE_CONTRACT PASS '+JSON.stringify(labels(on)));
function scenario(name,time,first,end){
 const d=structuredClone(docs[1]);d.eventId='TEST:'+name;d.eventAt=time;d.publishedAt=time+1;d.updatedAt=time+2;
 const starts=[48000,48050,49000,49200,49400];
 d.rows=d.rows.map((r,i)=>({...r,clockMs:end[i],final600Ms:end[i]-starts[i],checkpointMs:[first[i],starts[i],starts[i]+Math.round((end[i]-starts[i])*2/3)]}));
 for(const r of d.rows){r.finish=1+d.rows.filter(q=>q.clockMs<r.clockMs).length;r.officialMargin=r.finish===1?null:'TEST_LITERAL';r.checkpointRanks=r.checkpointMs.map((v,j)=>1+d.rows.filter(q=>q.checkpointMs[j]<v).length);}
 const v=[0,...[0,1,2].map(j=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...end)];d.leaderLaps.valuesMs=v.slice(1).map((x,i)=>x-v[i]);
 d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);
 return d;
}
const card=structuredClone(docs[0]);card.eventId='TEST:V46_TARGET';
const overlap=[12000,12050,12400,12600,12800],separate=[12000,12150,12400,12600,12800];
const aw=[84000,85000,86500,87000,87500],bw=[85000,84000,86500,87000,87500];
const sd=[card,scenario('V46_OA',10,overlap,aw),scenario('V46_OB',20,overlap,bw),scenario('V46_SA',30,separate,aw),scenario('V46_SB',40,separate,bw)];
async function synthetic(name,docs,options={}){
 const envelope=makeEnvelope(docs),p=await prepareSupply(envelope,{id:name});
 return analyzeVerified(V,p.request,p.receipt,{semanticVersion:48,work42Envelope:envelope,...options});
}

const multi=await synthetic('V48_MULTI',sd);assert.deepEqual(labels(multi),['S','S','C','C','C']);
console.log('V48_MULTI_S PASS '+JSON.stringify(labels(multi)));
// Same venue, class, measured geometry and anchor conditions; no race
// includes all current horses. Two external opponents in each event.
const target=structuredClone(card);target.eventId='TEST:V48_TARGET';
const first=[12000,12050,12400,12600,12800];
const a=scenario('V48_FIELD_A',10,first,[83000,84000,85500,86000,88000]);
const b=scenario('V48_FIELD_B',20,first,[84500,85000,86000,87000,88000]);
a.rows[2].nativeId='TEST:X3';a.rows[3].nativeId='TEST:X4';
b.rows[0].nativeId='TEST:Y1';b.rows[1].nativeId='TEST:Y2';
const cross=await synthetic('V48_DIFFERENT_FIELDS',[target,a,b]);
const compact=z=>z.candidate.runners.map(h=>({horse:h.horse,grade:h.grade,win:h.winPaths,place:h.placePaths,rank:h.rankBoundsAcrossReviewedScenarios,bridge:h.paths.filter(p=>p.kind==='COMMON_PEER').map(p=>({id:p.id,rank:p.rank,state:p.state,missing:p.missing,win:p.winBoundary,place:p.placeBoundary}))}));
console.log('V48_CROSS_DETAIL '+JSON.stringify(compact(cross)));
assert.ok(cross.candidate.bridge.scenarios.length);
assert.equal(cross.candidate.runners[0].grade,'A');assert.equal(cross.candidate.runners[1].grade,'B');
assert.ok(cross.candidate.runners[0].winPaths.some(p=>p.startsWith('BRIDGE:')));
assert.ok(cross.candidate.bridge.scenarios.every(s=>s.events.length>=2&&s.vector.length===5));
assert.ok(cross.candidate.bridge.scenarios.every(s=>s.numeric.state!=='CONTRADICTED_NUMERIC_DIFFERENCES'));
console.log('V48_DIFFERENT_FIELD PASS');
const missing=structuredClone(b);missing.rows[3].nativeId='TEST:Y4';
const partial=await synthetic('V48_PARTIAL',[target,a,missing]);
console.log('V48_PARTIAL_DETAIL '+JSON.stringify(compact(partial)));
assert.equal(partial.candidate.runners[0].grade,'B');
assert.equal(partial.candidate.runners[1].grade,'UNASSESSED');
assert.equal(partial.candidate.runners[3].grade,'UNASSESSED');
assert.ok(partial.candidate.runners[0].paths.some(p=>p.kind==='COMMON_PEER'&&p.winBoundary.status==='UNRESOLVED_BOUND_CROSSES_THRESHOLD'&&p.placeBoundary.status==='SUPPORTED_AT_WORST_BOUND'));
console.log('V48_BOUNDED_MISSING PASS');
const changed=structuredClone(b);changed.rows[4].weightG+=1000;
const broken=await synthetic('V48_ANCHOR_COUNTER',[target,a,changed]);
assert.equal(broken.candidate.bridge.scenarios.length,0);
assert.ok(broken.candidate.runners.every(h=>h.grade==='UNASSESSED'));
console.log('V48_ANCHOR_CONTEXT_HOLD PASS');
const z=await analyzeVerified(V,structuredClone(request),receipt,{semanticVersion:48,work42Envelope:envelope});assert.deepEqual(z,on);
await assert.rejects(()=>analyzeVerified(V,{...request,result:{winner:'TEST:H1'}},receipt,{semanticVersion:48,work42Envelope:envelope}));
console.log('V48_RESULT_BOUNDARY PASS');
